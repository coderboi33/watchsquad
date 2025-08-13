// rooms.ts
import mediasoup from "mediasoup";

export interface Room {
    router: mediasoup.types.Router;
    peers: Map<string, Peer>; // socketId -> Peer
}

export interface Peer {
    socketId: string;
    // A peer can have multiple transports for sending media
    producerTransports: Map<string, mediasoup.types.WebRtcTransport>; // transportId -> transport
    // And multiple transports for receiving media
    consumerTransports: Map<string, mediasoup.types.WebRtcTransport>; // transportId -> transport
    producers: Map<string, mediasoup.types.Producer>; // producerId -> producer
    consumers: Map<string, mediasoup.types.Consumer>; // consumerId -> consumer
}

const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
    },
];

export default class RoomManager {
    private worker: mediasoup.types.Worker<mediasoup.types.AppData>;
    private rooms: Map<string, Room> = new Map();

    // Constructor is simplified for better encapsulation.
    constructor(worker: mediasoup.types.Worker<mediasoup.types.AppData>) {
        this.worker = worker;
    }

    public async getOrCreateRoom(roomId: string): Promise<mediasoup.types.Router> {
        let room = this.rooms.get(roomId);
        if (room) {
            return room.router;
        }

        const router = await this.worker.createRouter({ mediaCodecs });
        room = { router, peers: new Map() };
        this.rooms.set(roomId, room);

        router.on('@close', () => {
            this.rooms.delete(roomId);
            console.log(`Room ${roomId} closed and removed.`);
        });

        return router;
    }

    public addPeerToRoom(roomId: string, socketId: string) {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        room.peers.set(socketId, {
            socketId,
            producerTransports: new Map(),
            consumerTransports: new Map(),
            producers: new Map(),
            consumers: new Map(),
        });
    }

    public getPeer(roomId: string, socketId: string): Peer | undefined {
        return this.rooms.get(roomId)?.peers.get(socketId);
    }

    public getRoomRouter(roomId: string): mediasoup.types.Router | undefined {
        return this.rooms.get(roomId)?.router;
    }

    public getProducersForRoom(roomId: string, requestingSocketId: string): string[] {
        const room = this.rooms.get(roomId);
        if (!room) return [];

        let producerIds: string[] = [];
        for (const peer of room.peers.values()) {
            if (peer.socketId !== requestingSocketId) {
                producerIds.push(...peer.producers.keys());
            }
        }
        return producerIds;
    }

    public removePeerFromRoom(socketId: string) {
        for (const [roomId, room] of this.rooms.entries()) {
            const peer = room.peers.get(socketId);
            if (peer) {
                console.log(`Removing peer ${socketId} from room ${roomId}`);

                // Close and remove all associated objects
                peer.producers.forEach(p => p.close());
                peer.consumers.forEach(c => c.close());
                peer.producerTransports.forEach(t => t.close());
                peer.consumerTransports.forEach(t => t.close());

                room.peers.delete(socketId);

                if (room.peers.size === 0) {
                    console.log(`Room ${roomId} is empty, closing router.`);
                    room.router.close();
                }
                return;
            }
        }
    }

    // ... (You can now add the other methods from your original code like setProducerTransport, addProducer etc.)
    public setProducerTransport(roomId: string, socketId: string, transport: mediasoup.types.WebRtcTransport) {
        const peer = this.getPeer(roomId, socketId);
        if (peer) peer.producerTransports.set(transport.id, transport);
    }

    public setConsumerTransport(roomId: string, socketId: string, transport: mediasoup.types.WebRtcTransport) {
        const peer = this.getPeer(roomId, socketId);
        if (peer) peer.consumerTransports.set(transport.id, transport);
    }

    public addProducer(roomId: string, socketId: string, producer: mediasoup.types.Producer) {
        const peer = this.getPeer(roomId, socketId);
        if (peer) peer.producers.set(producer.id, producer);
    }

    public addConsumer(roomId: string, socketId: string, consumer: mediasoup.types.Consumer) {
        const peer = this.getPeer(roomId, socketId);
        if (peer) peer.consumers.set(consumer.id, consumer);
    }
}