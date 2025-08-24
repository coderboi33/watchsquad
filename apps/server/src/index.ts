import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import https from "https";
import cors from "cors";
import { Server } from "socket.io";
import mediasoup from "mediasoup";
import RoomManager from "./rooms.js";
import registerRoomHandlers from "./handlers/registerRoomHandlers.js";

dotenv.config();
const options = {
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem')
}

const PORT = process.env.PORT || 5000; // Use a default port if not set
const app = express();
const server = https.createServer(options, app);

// Use express.json() middleware to parse JSON request bodies
app.use(express.json());
app.use(
    cors({
        origin: "*",
        credentials: true,
    })
);

const io = new Server(server, {
    cors: {
        origin: "*",
        credentials: true,
    },
});

app.get("/", (req, res) => {
    res.send("Welcome to the Video Conference Server");
});

// --- Mediasoup Worker and RoomManager Initialization ---
let worker: mediasoup.types.Worker;
let roomManager: RoomManager;

const createWorker = async () => {
    console.log("Creating mediasoup worker...");
    const newWorker = await mediasoup.createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020,
        logLevel: "debug",
        logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
    })
    console.log(`Worker created with PID: ${newWorker.pid}`);

    newWorker.on("died", () => {
        console.error("Worker died, exiting in 2 seconds...");
        setTimeout(() => process.exit(), 2000);
    });

    return newWorker;
}

// Self-invoking async function to start the server
(async () => {
    worker = await createWorker();
    roomManager = new RoomManager(worker);

    app.get("/", (req, res) => {
        res.send("Welcome to the Video Conference Server");
    });

    // --- Room Creation and Joining Endpoints ---

    /**
     * @description Creates a new room. Fails if the room already exists.
     * @route POST /create-room
     * @returns {object} 201 - { roomId: string }
     * @returns {object} 400 - Invalid input
     * @returns {object} 409 - Room already exists
     */
    app.post("/create-room", async (req, res) => {
        const { roomId } = req.body;

        // Check if the room already exists to prevent duplicates
        if (roomManager.getRoomRouter(roomId)) {
            return res.status(409).json({ error: `Room "${roomId}" already exists.` }); // 409 Conflict
        }

        // Create the room
        try {
            await roomManager.getOrCreateRoom(roomId);
            console.log(`Room "${roomId}" created`);
            res.status(201).json({ roomId }); // 201 Created is more semantic
        } catch (error) {
            console.error("Error creating room:", error);
            res.status(500).json({ error: "Failed to create room" });
        }
    });

    /**
     * @description Checks if a room exists before a client attempts to join.
     * @route GET /check-room/:roomId
     * @returns {object} 200 - Confirmation that room exists
     * @returns {object} 404 - Room not found
     */
    app.get("/check-room/:roomId", (req, res) => {
        const { roomId } = req.params;
        const router = roomManager.getRoomRouter(roomId);

        if (router) {
            // The room exists, so the client can proceed with the WebSocket connection
            console.log(`Room "${roomId}" exists`);
            res.status(200).json({ message: true });
        } else {
            // The room does not exist
            res.status(404).json({ error: false });
        }
    });


    // --- Socket.IO Connection Handling for Mediasoup ---
    const room = io.of("/rooms");

    room.on("connection", (socket) => {
        console.log(`Client connected to /rooms: ${socket.id}`);
        socket.emit("connected", { socketId: socket.id });

        registerRoomHandlers(socket, roomManager);

        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`);
            // This is crucial for cleanup
            roomManager.removePeerFromRoom(socket.id);
        });
    });

    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
})();