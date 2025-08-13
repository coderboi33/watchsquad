// handlers/registerRoomHandlers.ts
import { Socket } from "socket.io";
import RoomManager from "../rooms";

export default function registerRoomHandlers(socket: Socket, roomManager: RoomManager) {

    const { id: socketId } = socket;

    socket.on("createRoom", async ({ roomId }, callback) => {
        try {
            const router = await roomManager.getOrCreateRoom(roomId);
            roomManager.addPeerToRoom(roomId, socketId); // BUG FIX: Add creator as a peer
            socket.join(roomId);
            callback({ routerRtpCapabilities: router.rtpCapabilities });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("joinRoom", async ({ roomId }, callback) => {
        try {
            const router = roomManager.getRoomRouter(roomId);
            if (!router) throw new Error(`Room ${roomId} not found`);

            // Get existing producers to inform the new peer
            const producerIds = roomManager.getProducersForRoom(roomId, socketId);

            roomManager.addPeerToRoom(roomId, socketId);
            socket.join(roomId);

            callback({
                routerRtpCapabilities: router.rtpCapabilities,
                producerIds, // Send existing producers to the new peer
            });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("createTransport", async ({ roomId, isProducer }, callback) => {
        try {
            const router = roomManager.getRoomRouter(roomId);
            if (!router) throw new Error(`Room ${roomId} not found`);

            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '127.0.0.1' /* announcedIp: 'YOUR_PUBLIC_IP' */ }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            if (isProducer) {
                roomManager.setProducerTransport(roomId, socketId, transport);
            } else {
                roomManager.setConsumerTransport(roomId, socketId, transport);
            }

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("connectTransport", async ({ roomId, transportId, dtlsParameters }, callback) => {
        try {
            const peer = roomManager.getPeer(roomId, socketId);
            if (!peer) throw new Error(`Peer ${socketId} not found`);

            const transport = peer.producerTransports.get(transportId) || peer.consumerTransports.get(transportId);
            if (!transport) throw new Error(`Transport ${transportId} not found`);

            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("produce", async ({ roomId, transportId, kind, rtpParameters }, callback) => {
        try {
            const peer = roomManager.getPeer(roomId, socketId);
            if (!peer) throw new Error(`Peer ${socketId} not found`);

            const transport = peer.producerTransports.get(transportId);
            if (!transport) throw new Error(`Producer transport ${transportId} not found`);

            const producer = await transport.produce({ kind, rtpParameters });
            roomManager.addProducer(roomId, socketId, producer);

            // Inform everyone else in the room that a new producer is available
            socket.to(roomId).emit("new-producer", { producerId: producer.id });

            callback({ id: producer.id });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("consume", async ({ roomId, transportId, producerId, rtpCapabilities }, callback) => {
        try {
            const router = roomManager.getRoomRouter(roomId);
            const peer = roomManager.getPeer(roomId, socketId);

            if (!router || !peer) throw new Error(`Room or Peer not found`);
            if (!router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error("Client cannot consume this producer");
            }

            const transport = peer.consumerTransports.get(transportId);
            if (!transport) throw new Error(`Consumer transport ${transportId} not found`);

            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: true, // Always start consumers paused, client will resume
            });
            roomManager.addConsumer(roomId, socketId, consumer);

            consumer.on("producerclose", () => {
                socket.emit("consumer-closed", { consumerId: consumer.id });
            });

            callback({
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("resume", async ({ roomId, consumerId }, callback) => {
        try {
            const peer = roomManager.getPeer(roomId, socketId);
            if (!peer) throw new Error(`Peer not found`);

            const consumer = peer.consumers.get(consumerId);
            if (!consumer) throw new Error(`Consumer not found`);

            await consumer.resume();
            callback({ success: true });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });
}