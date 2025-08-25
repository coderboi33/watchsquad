import mediasoup from "mediasoup";

// Define the structure for a peer and a room
export interface Peer {
    socketId: string;
    producerTransports: Map<string, mediasoup.types.WebRtcTransport>;
    consumerTransports: Map<string, mediasoup.types.WebRtcTransport>;
    producers: Map<string, mediasoup.types.Producer>;
    consumers: Map<string, mediasoup.types.Consumer>;
}

export interface Room {
    router: mediasoup.types.Router;
    peers: Map<string, Peer>; // key = socketId
}

// Media codecs configuration for the router
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
        parameters: {
            'x-google-start-bitrate': 1000,
        },
    },
];

export default class RoomManager {
    private worker: mediasoup.types.Worker;
    private rooms: Map<string, Room> = new Map(); // key = roomId

    constructor(worker: mediasoup.types.Worker) {
        this.worker = worker;
    }

    /**
     * Creates a new room or returns the existing one.
     */
    public async getOrCreateRoom(roomId: string): Promise<mediasoup.types.Router> {
        let room = this.rooms.get(roomId);

        if (room) {
            return room.router;
        }

        const router = await this.worker.createRouter({ mediaCodecs });
        room = { router, peers: new Map() };
        this.rooms.set(roomId, room);

        // When the router is closed, remove the room from the map
        router.on('@close', () => {
            this.rooms.delete(roomId);
            console.log(`Room ${roomId} closed and removed.`);
        });

        return router;
    }

    /**
     * Adds a new peer to the specified room.
     */
    public addPeerToRoom(roomId: string, socketId: string): void {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Room ${roomId} not found while trying to add peer.`);
        }
        if (room.peers.has(socketId)) {
            console.warn(`Peer ${socketId} already in room ${roomId}.`);
            return;
        }

        const newPeer: Peer = {
            socketId,
            producerTransports: new Map(),
            consumerTransports: new Map(),
            producers: new Map(),
            consumers: new Map(),
        };
        room.peers.set(socketId, newPeer);
        console.log(`Peer ${socketId} added to room ${roomId}.`);
    }

    /**
     * Retrieves a peer by their socket ID from any room.
     */
    public getPeer(socketId: string): { peer: Peer; roomId: string } | undefined {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.peers.has(socketId)) {
                return { peer: room.peers.get(socketId)!, roomId };
            }
        }
        return undefined;
    }

    /**
     * Removes a peer and cleans up all their associated resources.
     */
    public removePeerFromRoom(socketId: string): void {
        const peerInfo = this.getPeer(socketId);
        if (!peerInfo) {
            return;
        }

        const { peer, roomId } = peerInfo;
        const room = this.rooms.get(roomId)!;

        console.log(`Removing peer ${socketId} from room ${roomId}`);

        // Close all associated Mediasoup objects
        peer.producers.forEach(p => p.close());
        peer.consumers.forEach(c => c.close());
        peer.producerTransports.forEach(t => t.close());
        peer.consumerTransports.forEach(t => t.close());

        // Remove the peer from the room
        room.peers.delete(socketId);

        // If the room is now empty, close the router to clean up resources
        if (room.peers.size === 0) {
            console.log(`Room ${roomId} is empty, closing router.`);
            room.router.close(); // This will trigger the '@close' event and delete the room from the map
        }
    }

    // --- Getters and Setters for Peer Resources ---

    public getRoomRouter(roomId: string): mediasoup.types.Router | undefined {
        return this.rooms.get(roomId)?.router;
    }

    // public getProducersForRoom(roomId: string, requestingSocketId: string): string[] {
    //     const room = this.rooms.get(roomId);
    //     if (!room) return [];

    //     const producerIds: string[] = [];
    //     for (const peer of room.peers.values()) {
    //         if (peer.socketId !== requestingSocketId) {
    //             producerIds.push(...peer.producers.keys());
    //         }
    //     }
    //     return producerIds;
    // }

    // Inside your RoomManager class

    public getProducersForRoom(roomId: string, requestingSocketId: string): { producerId: string; peerId: string }[] {
        const room = this.rooms.get(roomId);
        if (!room) return [];

        const producersData: { producerId: string; peerId: string }[] = [];

        // Iterate through each peer in the room
        for (const peer of room.peers.values()) {
            // --- THIS IS THE FIX ---
            // Only include producers from OTHER peers
            if (peer.socketId !== requestingSocketId) {
                for (const producerId of peer.producers.keys()) {
                    producersData.push({ producerId, peerId: peer.socketId });
                }
            }
        }

        return producersData;
    }

    public setProducerTransport(socketId: string, transport: mediasoup.types.WebRtcTransport): void {
        const peerInfo = this.getPeer(socketId);
        if (peerInfo) {
            peerInfo.peer.producerTransports.set(transport.id, transport);
        }
    }

    public setConsumerTransport(socketId: string, transport: mediasoup.types.WebRtcTransport): void {
        const peerInfo = this.getPeer(socketId);
        if (peerInfo) {
            peerInfo.peer.consumerTransports.set(transport.id, transport);
        }
    }

    public addProducer(socketId: string, producer: mediasoup.types.Producer): void {
        const peerInfo = this.getPeer(socketId);
        if (peerInfo) {
            peerInfo.peer.producers.set(producer.id, producer);

            // When a producer is closed (e.g., camera is turned off), notify other peers
            producer.on('@close', () => {
                const room = this.rooms.get(peerInfo.roomId);
                if (room) {
                    room.peers.forEach(p => {
                        if (p.socketId !== socketId) {
                            p.consumers.forEach(consumer => {
                                if (consumer.producerId === producer.id) {
                                    // This event can be listened to on the client side
                                    // to close the corresponding video element.
                                    // The 'producerclose' event on the consumer will handle the actual closing.
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    public addConsumer(socketId: string, consumer: mediasoup.types.Consumer): void {
        const peerInfo = this.getPeer(socketId);
        if (peerInfo) {
            peerInfo.peer.consumers.set(consumer.id, consumer);
        }
    }
}