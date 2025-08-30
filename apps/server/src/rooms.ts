import { types as MediasoupTypes } from 'mediasoup';
import { createClient, RedisClientType } from 'redis';
import { PeerData, RoomData, mediaCodecs } from './types.js'; // Import from types.ts

const ROOM_KEY = (roomId: string) => `room:${roomId}`;
const PEER_KEY = (socketId: string) => `peer:${socketId}`;

export default class RoomManager {
    public redis: RedisClientType;
    public worker: MediasoupTypes.Worker;

    // Mediasoup objects are process-specific and live in memory on this server instance
    public routers = new Map<string, MediasoupTypes.Router>();
    public transports = new Map<string, MediasoupTypes.Transport>();
    public producers = new Map<string, MediasoupTypes.Producer>();
    public consumers = new Map<string, MediasoupTypes.Consumer>();

    constructor(worker: MediasoupTypes.Worker) {
        this.worker = worker;
        this.redis = createClient({ url: process.env.REDIS_URL });
        this.redis.on('error', (err) => console.error('Redis Client Error', err));
        this.redis.connect();
        console.log('RoomManager connected to Redis.');
    }

    public async getPeerData(socketId: string): Promise<PeerData | null> {
        const peerJson = await this.redis.get(PEER_KEY(socketId));
        return peerJson ? JSON.parse(peerJson) : null;
    }

    public async getRoomData(roomId: string): Promise<RoomData | null> {
        const roomJson = await this.redis.get(ROOM_KEY(roomId));
        return roomJson ? JSON.parse(roomJson) : null;
    }

    public async getOrCreateRoom(roomId: string): Promise<MediasoupTypes.Router> {
        if (this.routers.has(roomId)) {
            return this.routers.get(roomId)!;
        }

        const roomExists = await this.redis.exists(ROOM_KEY(roomId));
        if (!roomExists) {
            const newRoom: RoomData = { id: roomId, peerIds: [] };
            await this.redis.set(ROOM_KEY(roomId), JSON.stringify(newRoom));
        }

        const router = await this.worker.createRouter({ mediaCodecs });
        this.routers.set(roomId, router);
        return router;
    }

    public async addPeerToRoom(roomId: string, socketId: string) {
        const room = await this.getRoomData(roomId);
        if (!room) throw new Error(`Room ${roomId} not found in Redis.`);
        if (room.peerIds.includes(socketId)) return;

        room.peerIds.push(socketId);
        const newPeer: PeerData = {
            socketId,
            roomId,
            producerTransportIds: [],
            consumerTransportIds: [],
            producerIds: [],
            consumerIds: [],
        };

        await this.redis.multi()
            .set(ROOM_KEY(roomId), JSON.stringify(room))
            .set(PEER_KEY(socketId), JSON.stringify(newPeer))
            .exec();
    }

    public async removePeerFromRoom(socketId: string) {
        const peer = await this.getPeerData(socketId);
        if (!peer) return;

        // Close and remove any in-memory mediasoup objects for this peer
        peer.producerTransportIds.forEach(id => this.transports.get(id)?.close());
        peer.consumerTransportIds.forEach(id => this.transports.get(id)?.close());
        peer.producerIds.forEach(id => this.producers.get(id)?.close());
        peer.consumerIds.forEach(id => this.consumers.get(id)?.close());

        const room = await this.getRoomData(peer.roomId);
        if (room) {
            const updatedPeerIds = room.peerIds.filter(id => id !== socketId);
            if (updatedPeerIds.length === 0) {
                await this.redis.del(ROOM_KEY(peer.roomId));
                this.routers.get(peer.roomId)?.close();
                this.routers.delete(peer.roomId);
            } else {
                room.peerIds = updatedPeerIds;
                await this.redis.set(ROOM_KEY(peer.roomId), JSON.stringify(room));
            }
        }

        await this.redis.del(PEER_KEY(socketId));
        console.log(`Peer ${socketId} removed from Redis and resources closed.`);
    }

    public async getRoomRouter(roomId: string): Promise<MediasoupTypes.Router | undefined> {
        // 1. First, check if the router already exists in this server's memory.
        if (this.routers.has(roomId)) {
            return this.routers.get(roomId);
        }

        // 2. If not, check the shared Redis store to see if the room exists.
        const roomExists = await this.redis.exists(ROOM_KEY(roomId));

        if (roomExists) {
            // 3. If the room exists in Redis but not in this server's memory,
            // create a new in-memory router instance for it.
            const router = await this.worker.createRouter({ mediaCodecs });
            this.routers.set(roomId, router);
            return router;
        }

        // 4. If the room doesn't exist anywhere, return undefined.
        return undefined;
    }

    public async getProducersForRoom(roomId: string, requestingSocketId: string): Promise<{ producerId: string; peerId: string }[]> {
        const room = await this.getRoomData(roomId);
        if (!room) {
            console.log("sending empty producers list");
            return []; // Room doesn't exist
        };

        const producersData: { producerId: string; peerId: string }[] = [];
        for (const peerId of room.peerIds) {
            // --- THIS CHECK IS CRUCIAL ---
            // Only get producers for OTHER peers
            const peer = await this.getPeerData(peerId);
            if (peer) {
                for (const producerId of peer.producerIds) {
                    producersData.push({ producerId, peerId });
                }
            }
        }
        return producersData;
    }

    public async setProducerTransport(socketId: string, transport: MediasoupTypes.WebRtcTransport) {
        const peer = await this.getPeerData(socketId);
        if (!peer) throw new Error(`Peer ${socketId} not found`);

        peer.producerTransportIds.push(transport.id);
        await this.redis.set(PEER_KEY(socketId), JSON.stringify(peer));
        this.transports.set(transport.id, transport);
    }

    public async setConsumerTransport(socketId: string, transport: MediasoupTypes.WebRtcTransport) {
        const peer = await this.getPeerData(socketId);
        if (!peer) throw new Error(`Peer ${socketId} not found`);

        peer.consumerTransportIds.push(transport.id);
        await this.redis.set(PEER_KEY(socketId), JSON.stringify(peer));
        this.transports.set(transport.id, transport);
    }

    public async addProducer(socketId: string, producer: MediasoupTypes.Producer) {
        const peer = await this.getPeerData(socketId);
        if (!peer) throw new Error(`Peer ${socketId} not found`);

        peer.producerIds.push(producer.id);
        await this.redis.set(PEER_KEY(socketId), JSON.stringify(peer));
        this.producers.set(producer.id, producer);
    }

    public async addConsumer(socketId: string, consumer: MediasoupTypes.Consumer) {
        const peer = await this.getPeerData(socketId);
        if (!peer) throw new Error(`Peer ${socketId} not found`);

        peer.consumerIds.push(consumer.id);
        await this.redis.set(PEER_KEY(socketId), JSON.stringify(peer));
        this.consumers.set(consumer.id, consumer);
    }
    public getTransport(transportId: string): MediasoupTypes.Transport | undefined {
        return this.transports.get(transportId);
    }

    public getProducer(producerId: string): MediasoupTypes.Producer | undefined {
        return this.producers.get(producerId);
    }

    public getConsumer(consumerId: string): MediasoupTypes.Consumer | undefined {
        return this.consumers.get(consumerId);
    }
}