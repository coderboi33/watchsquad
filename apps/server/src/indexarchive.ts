import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import https from "https";
import cors from "cors";
import { Server } from "socket.io";
import mediasoup from "mediasoup";


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

const peers = io.of("/mediasoup");

let worker: mediasoup.types.Worker<mediasoup.types.AppData>;
let router: mediasoup.types.Router<mediasoup.types.AppData>;

let producerTransport: mediasoup.types.WebRtcTransport<mediasoup.types.AppData>;
let consumerTransport: mediasoup.types.WebRtcTransport<mediasoup.types.AppData>;

let producer: mediasoup.types.Producer<mediasoup.types.AppData>;
let consumer: mediasoup.types.Consumer<mediasoup.types.AppData>;

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

worker = await createWorker();

const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
        preferredPayloadType: 96,
        rtcpFeedback: [
            { type: "transport-cc", parameter: "" },
            { type: "nack", parameter: "" },
            { type: "nack", parameter: "pli" }
        ]
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        preferredPayloadType: 97,
        rtcpFeedback: [
            { type: "transport-cc", parameter: "" },
            { type: "nack", parameter: "" },
            { type: "nack", parameter: "pli" }
        ]
    }
]

peers.on("connection", async (socket) => {
    console.log(`Peer connected: ${socket.id}`);
    socket.emit("ConnectionSuccess", { socketId: socket.id });

    socket.on("disconnect", () => {
        console.log(`Peer disconnected: ${socket.id}`);
    });

    router = await worker.createRouter({ mediaCodecs: mediaCodecs });

    socket.on("getRouterRtpCapabilities", (callback) => {
        console.log(`Router RTP capabilities requested by: ${socket.id}`);
        const routerRtpCapabilities = router.rtpCapabilities;
        callback({ routerRtpCapabilities });
    });

    socket.on("createTransport", async ({ sender }, callback) => {
        if (sender) {
            producerTransport = await createWebRtcTransport(callback);
        }
        else {
            consumerTransport = await createWebRtcTransport(callback);
        }
    });

    socket.on("connectProducerTransport", async ({ dtlsParameters }) => {
        await producerTransport.connect({ dtlsParameters });
        console.log(`Producer transport connected: ${producerTransport.id}`);
    });

    socket.on("transport-produce", async ({ kind, rtpParameters }, callback) => {
        producer = await producerTransport?.produce({
            kind,
            rtpParameters
        });

        producer.on("transportclose", () => {
            console.log(`Producer transport closed: ${producerTransport.id}`);
            producer?.close();
        })

        await producer.resume();
        callback({
            id: producer?.id,
        });
    });

    socket.on("connectConsumerTransport", async ({ dtlsParameters }) => {
        await consumerTransport.connect({ dtlsParameters });
        console.log(`Consumer transport connected: ${consumerTransport.id}`);
    });

    socket.on("consumeMedia", async ({ rtpCapabilities }, callback) => {
        try {
            if (producer) {
                if (!router.canConsume({
                    producerId: producer.id,
                    rtpCapabilities: rtpCapabilities
                })) {
                    console.log({ producer, rtpCapabilities });

                    return;
                }
                console.log(`Consuming media from producer: ${producer.id}`);

                consumer = await consumerTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities: rtpCapabilities,
                    paused: producer?.kind === "video",
                });

                consumer?.on("transportclose", () => {
                    console.log("Producer closed");
                    consumer?.close();
                });

                consumer?.on("producerclose", () => {
                    console.log(`Producer closed: ${producer.id}`);
                    consumer?.close();
                });

                callback({
                    params: {
                        id: consumer.id,
                        producerId: producer.id,
                        kind: consumer.kind,
                        rtpParameters: consumer.rtpParameters,
                    }
                });
            }
        }
        catch (error) {
            console.error("Error consuming media:", error);
            callback({
                params: {
                    error,
                },
            });
            return;
        }
    });

    socket.on("resumePausedConsumer", async () => {
        if (consumer) {
            console.log(`Consumer resumed: ${consumer.id}`);
            await consumer?.resume();
        }
        else {
            console.error("No consumer to resume");
        }
    });
});

const createWebRtcTransport = async (
    callback: (arg0: {
        params: {
            id: string;
            iceParameters: mediasoup.types.IceParameters;
            iceCandidates: mediasoup.types.IceCandidate[];
            dtlsParameters: mediasoup.types.DtlsParameters;
        } | {
            error: Error;
        }
    }) => void
) => {
    try {
        const webRtcTranspoetOptions: mediasoup.types.WebRtcTransportOptions = {
            listenIps: [
                {
                    ip: "127.0.0.1",
                },
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        };

        const transport = await router.createWebRtcTransport(webRtcTranspoetOptions);

        console.log(`WebRTC transport created with ID: ${transport.id}`);

        transport.on("dtlsstatechange", (dtlsState) => {
            console.log(`DTLS state changed: ${dtlsState}`);
            if (dtlsState === "closed") {
                transport.close();
            }
        });

        transport.on("@close", () => {
            console.log(`WebRTC transport closed: ${transport.id}`);
        });

        callback({
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            }
        });

        return transport;
    }
    catch (error) {
        console.error("Error creating WebRTC transport:", error);
        throw error;
        callback({
            params: {
                error: new Error("Failed to create WebRTC transport"),
            }
        });
    }
};

app.get("/", (req, res) => {
    res.send("Welcome to the WatchSquad Server!");
});

server.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});


