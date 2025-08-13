//create rooms here and then head to a different file for logic in the rooms
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import https from "https";
import cors from "cors";
import { Server } from "socket.io";
import mediasoup from "mediasoup";
import RoomManager, { Room } from "./rooms.js";
import registerRoomHandlers from "./handlers/registerRoomHandlers.js";

dotenv.config();
const options = {
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem')
}

const PORT = process.env.PORT;
const app = express();
const server = https.createServer(options, app);

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

let worker: mediasoup.types.Worker<mediasoup.types.AppData>;
let roomManager: RoomManager;

const createWorker = async (): Promise<mediasoup.types.Worker<mediasoup.types.AppData>> => {
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

const room = io.of("/rooms");

(async () => {
    worker = await createWorker();
    roomManager = new RoomManager(worker);

    room.on("connection", (socket) => {
        console.log(`Client connected to /rooms: ${socket.id}`);

        registerRoomHandlers(socket, roomManager);

        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`);
            roomManager.removePeerFromRoom(socket.id);
        });
    });

    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
})();
