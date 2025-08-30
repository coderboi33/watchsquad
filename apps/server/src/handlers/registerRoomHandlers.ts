import { Socket } from "socket.io";
import RoomManager from "../rooms.js"; // This should be your Redis-based RoomManager

export default function registerRoomHandlers(socket: Socket, roomManager: RoomManager) {
    const { id: socketId } = socket;

    socket.on("join", async ({ roomId }, callback) => {
        try {
            await roomManager.getOrCreateRoom(roomId);
            await roomManager.addPeerToRoom(roomId, socketId);
            socket.join(roomId);

            const producersData = await roomManager.getProducersForRoom(roomId, socketId);

            console.log(`Peer ${socketId} joined room ${roomId}. Existing producers:`, producersData.forEach(p => console.log(p.producerId)));

            // 2. Send that list back to the new client immediately via the callback.
            if (callback) {
                callback({ producersData });
            }
        } catch (e: any) {
            if (callback) callback({ producersData: [], error: e.message });
        }
    });

    socket.on("getRtpCapabilities", async ({ roomId }, callback) => {
        try {
            console.log(`Getting RTP capabilities for room ${roomId}`);
            const router = await roomManager.getRoomRouter(roomId);
            if (!router) throw new Error(`Router for room ${roomId} not found.`);

            callback({ routerRtpCapabilities: router.rtpCapabilities });
        } catch (e: any) {
            console.error(`Error getting RTP capabilities for room ${roomId}:`, e);
            if (callback) callback({ error: e.message });
        }
    });

    socket.on("createTransport", async ({ isProducer }, callback) => {
        try {
            const peerData = await roomManager.getPeerData(socketId);
            if (!peerData) throw new Error(`Peer ${socketId} not found`);

            const router = await roomManager.getRoomRouter(peerData.roomId);
            if (!router) throw new Error(`Router for room ${peerData.roomId} not found`);

            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '127.0.0.1' /* TODO: Use announced IP for production */ }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            if (isProducer) {
                await roomManager.setProducerTransport(socketId, transport);
            } else {
                await roomManager.setConsumerTransport(socketId, transport);
            }

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (e: any) {
            console.error(`Error creating transport for peer ${socketId}:`, e);
            if (callback) callback({ error: e.message });
        }
    });

    socket.on("connectTransport", async ({ transportId, dtlsParameters }, callback) => {
        try {
            const transport = await roomManager.getTransport(transportId);
            if (!transport) throw new Error(`Transport ${transportId} not found`);

            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (e: any) {
            console.error(`Error connecting transport ${transportId} for peer ${socketId}:`, e);
            if (callback) callback({ error: e.message });
        }
    });

    socket.on("produce", async ({ transportId, kind, rtpParameters }, callback) => {
        try {
            const transport = await roomManager.getTransport(transportId);
            if (!transport) throw new Error(`Transport ${transportId} not found`);

            const producer = await transport.produce({ kind, rtpParameters });
            await roomManager.addProducer(socketId, producer);
            console.log(`Peer ${socketId} produced a new ${kind} producer with ID ${producer.id}`);

            const peerData = await roomManager.getPeerData(socketId);
            if (peerData) {
                socket.to(peerData.roomId).emit("new-producer", { producerId: producer.id, peerId: socketId });
            }

            callback({ id: producer.id });
        } catch (e: any) {
            console.error(`Error producing on transport ${transportId} for peer ${socketId}:`, e);
            if (callback) callback({ error: e.message });
        }
    });

    socket.on("consume", async ({ transportId, producerId, rtpCapabilities }, callback) => {
        try {
            const transport = await roomManager.getTransport(transportId);
            if (!transport) throw new Error(`Transport ${transportId} not found`);

            const peerData = await roomManager.getPeerData(socketId);
            if (!peerData) throw new Error(`Peer ${socketId} not found`);

            const router = await roomManager.getRoomRouter(peerData.roomId);
            if (!router || !router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error(`Client cannot consume producer ${producerId}`);
            }

            const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
            await roomManager.addConsumer(socketId, consumer);

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
            console.error(`Error consuming producer ${producerId} for peer ${socketId}:`, e);
            if (callback) callback({ error: e.message });
        }
    });

    socket.on("resume", async ({ consumerId }, callback) => {
        try {
            const consumer = await roomManager.getConsumer(consumerId);
            if (!consumer) throw new Error(`Consumer ${consumerId} not found`);

            await consumer.resume();
            callback({ success: true });
        } catch (e: any) {
            console.error(`Error resuming consumer ${consumerId} for peer ${socketId}:`, e);
            if (callback) callback({ error: e.message });
        }
    });

    socket.on("leave-room", async ({ roomId }) => {
        socket.to(roomId).emit("peer-left", { peerId: socketId });
        await roomManager.removePeerFromRoom(socketId);
    });

    socket.on("disconnect", async () => {
        const peerData = await roomManager.getPeerData(socketId);
        if (peerData) {
            socket.to(peerData.roomId).emit("peer-left", { peerId: socketId });
            await roomManager.removePeerFromRoom(socketId);
        }
    });
}