import { Socket } from "socket.io";
import RoomManager from "../rooms.js";

export default function registerRoomHandlers(socket: Socket, roomManager: RoomManager) {
    const { id: socketId } = socket;

    socket.on("join", async ({ roomId }, callback) => {
        try {
            // Ensure the mediasoup router for this room is created.
            // This is idempotent, so it's safe to call even if the room already exists.
            await roomManager.getOrCreateRoom(roomId);

            // Add the peer to our room's state
            roomManager.addPeerToRoom(roomId, socketId);

            // Join the socket.io room for broadcasting
            socket.join(roomId);

            // Get a list of all producer IDs for producers that are already
            // in the room. We'll send this to the new client.
            const producersData = roomManager.getProducersForRoom(roomId, socketId);

            // Send the list of producers back to the client so they can consume them
            if (callback)
                callback({ producersData });

        } catch (e: any) {
            console.error("Error joining room:", e);
            if (callback)
                callback({ error: e.message });
        }
    });

    socket.on("getRtpCapabilities", async ({ roomId }, callback) => {
        try {
            const router = roomManager.getRoomRouter(roomId);
            const routerRtpCapabilities = router?.rtpCapabilities;
            console.log("Router RTP Capabilities:", routerRtpCapabilities);
            callback({ routerRtpCapabilities: routerRtpCapabilities });
        } catch (e: any) {
            console.error("Error getting RTP capabilities:", e);
        }
    });

    socket.on("createTransport", async ({ isProducer }, callback) => {
        try {
            const peerInfo = roomManager.getPeer(socketId);
            if (!peerInfo) throw new Error(`Peer ${socketId} not found`);

            const router = roomManager.getRoomRouter(peerInfo.roomId)!;
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '127.0.0.1' /* TODO: Use announced IP for production */ }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            if (isProducer) {
                roomManager.setProducerTransport(socketId, transport);
            } else {
                roomManager.setConsumerTransport(socketId, transport);
            }

            console.log("Created transport:", transport.id, "for peer:", socketId);

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

    socket.on("connectTransport", async ({ transportId, dtlsParameters }, callback) => {
        try {
            const peerInfo = roomManager.getPeer(socketId);
            if (!peerInfo) throw new Error(`Peer ${socketId} not found`);

            const transport = peerInfo.peer.producerTransports.get(transportId) || peerInfo.peer.consumerTransports.get(transportId);
            if (!transport) throw new Error(`Transport ${transportId} not found`);

            await transport.connect({ dtlsParameters });

            console.log("Transport connected:", transportId, "for peer:", socketId);
            callback({ success: true });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("produce", async ({ transportId, kind, rtpParameters }, callback) => {
        try {
            const peerInfo = roomManager.getPeer(socketId);
            if (!peerInfo) throw new Error(`Peer ${socketId} not found`);

            const transport = peerInfo.peer.producerTransports.get(transportId);
            if (!transport) throw new Error(`Producer transport ${transportId} not found`);

            const producer = await transport.produce({ kind, rtpParameters });
            roomManager.addProducer(socketId, producer);

            // Inform other peers in the room about the new producer
            socket.to(peerInfo.roomId).emit("new-producer", { producerId: producer.id, peerId: socketId });
            console.log("New producer added:", producer.id, "for peer:", socketId);

            callback({ id: producer.id });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("consume", async ({ transportId, producerId, rtpCapabilities }, callback) => {
        try {
            const peerInfo = roomManager.getPeer(socketId);
            if (!peerInfo) throw new Error(`Peer ${socketId} not found`);

            const router = roomManager.getRoomRouter(peerInfo.roomId)!;
            if (!router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error("Client cannot consume this producer");
            }

            const transport = peerInfo.peer.consumerTransports.get(transportId);
            if (!transport) throw new Error(`Consumer transport ${transportId} not found`);

            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: true,
            });
            roomManager.addConsumer(socketId, consumer);

            consumer.on("producerclose", () => {
                socket.emit("consumer-closed", { consumerId: consumer.id });
            });
            console.log("Consumer created:", consumer.id, "for peer:", socketId);

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

    socket.on("resume", async ({ consumerId }, callback) => {
        try {
            const peerInfo = roomManager.getPeer(socketId);
            if (!peerInfo) throw new Error(`Peer not found`);

            const consumer = peerInfo.peer.consumers.get(consumerId);
            if (!consumer) throw new Error(`Consumer not found`);

            await consumer.resume();

            console.log("Consumer resumed:", consumerId, "for peer:", socketId);
            callback({ success: true });
        } catch (e: any) {
            callback({ error: e.message });
        }
    });

    socket.on("disconnect", () => {
        try {
            const peerInfo = roomManager.getPeer(socketId);
            if (!peerInfo) {
                // This can happen if the server restarts and a client tries to reconnect
                return;
            }

            console.log(`Peer disconnected: ${socketId}`);

            // Notify other peers in the room that this peer has left
            socket.to(peerInfo.roomId).emit("peer-left", { peerId: socketId });

            // Clean up all resources associated with this peer
            roomManager.removePeerFromRoom(socketId);

        } catch (e: any) {
            console.error(`Error handling disconnect for peer ${socketId}:`, e);
        }
    });

    // socket.on("disconnect", () => {
    //     try {
    //         const peerInfo = roomManager.getPeer(socketId);
    //         if (!peerInfo) {
    //             // This can happen if the server restarts and a client tries to reconnect
    //             return;
    //         }

    //         console.log(`Peer disconnected: ${socketId}`);

    //         // Notify other peers in the room that this peer has left
    //         socket.to(peerInfo.roomId).emit("peer-left", { peerId: socketId });

    //         // Clean up all resources associated with this peer
    //         roomManager.removePeerFromRoom(socketId);

    //     } catch (e: any) {
    //         console.error(`Error handling disconnect for peer ${socketId}:`, e);
    //     }
    // });

}