/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Device } from "mediasoup-client";
import { DtlsParameters, IceCandidate, IceParameters, RtpCapabilities, Transport } from "mediasoup-client/types";
import React, { useEffect } from "react";
import { io, Socket } from "socket.io-client";

export default function LandingPage() {

    const videoRef = React.useRef<HTMLVideoElement>(null);
    const remoteVideoRef = React.useRef<HTMLVideoElement>(null);

    const [params, setParams] = React.useState({
        encoding: [
            { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" },
            { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" },
            { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" }
        ],
        codecOptions: {
            videoGoogleStartBitrate: 1000
        },
    });

    const [device, setDevice] = React.useState<Device | null>(null);
    const [socket, setSocket] = React.useState<Socket | null>(null);
    const [rtpCapabilities, setRtpCapabilities] = React.useState<RtpCapabilities | null>(null);
    const [producerTransport, setProducerTransport] = React.useState<Transport | null>(null);
    const [consumerTransport, setConsumerTransport] = React.useState<Transport | null>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                const track = stream.getVideoTracks()[0];
                videoRef.current.srcObject = stream;
                setParams((current) => ({ ...current, track }));
            }
        }
        catch (error) {
            console.error("Error starting camera:", error);
        }
    }

    useEffect(() => {
        const socket = io("wss://localhost:5000/mediasoup", {
            transports: ["websocket"],
            secure: true,
        }); setSocket(socket);
        socket.on("ConnectionSuccess", (data) => {
            console.log("Connected to server", data);
            startCamera();
        });

        return () => {
            socket.disconnect();
        }
    }, []);

    const join = () => {
        try {
            getRouterRtpCapabilities();
            createDevice();
            createSendTransport();
            connectSendTransport();
            createReceiveTransport();
            connectReceiveTransport();
        } catch (error) {
            console.error('Error joining:', error);
        }
    }

    const getRouterRtpCapabilities = async () => {
        socket?.emit("getRouterRtpCapabilities", (data: any) => {
            setRtpCapabilities(data.routerRtpCapabilities);
            console.log("Router RTP capabilities received:", data.routerRtpCapabilities);
        });
    };

    const createDevice = async () => {
        console.log("Creating device...");
        try {
            const newDevice = new Device();
            if (!rtpCapabilities) {
                console.error("RTP capabilities are not set");
                return;
            }
            await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
            setDevice(newDevice);
        }
        catch (error) {
            console.error("Error creating device:", error);
        }
    };

    const createSendTransport = async () => {
        socket?.emit("createTransport", { sender: true }, ({ params }: {
            params: {
                id: string;
                iceParameters: IceParameters;
                iceCandidates: IceCandidate[];
                dtlsParameters: DtlsParameters;
                error?: unknown;
            };
        }) => {
            if (!params || params.error) {
                console.error("Error consuming media:", params?.error);
                return;
            }
            const transport = device?.createSendTransport(params);
            setProducerTransport(transport || null);

            transport?.on("connect", async ({ dtlsParameters }: any, callback: any, errback: any) => {
                try {
                    console.log("----------> producer transport has connected");
                    socket.emit("connectProducerTransport", { dtlsParameters });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            transport?.on("produce", async (parameters: any, callback: any, errback: any) => {
                const { kind, rtpParameters } = parameters;
                console.log("----------> transport-produce");
                try {
                    socket.emit("transport-produce",
                        { kind, rtpParameters },
                        ({ id }: any) => {
                            callback({ id });
                        }
                    );
                } catch (error) {
                    errback(error);
                }
            }
            );
        }
        );
    };

    const connectSendTransport = async () => {
        const localProducer = await producerTransport?.produce(params);
        localProducer?.on("trackended", () => {
            console.log("Track ended");
        });

        localProducer?.on("transportclose", () => {
            console.log("Producer transport closed");
        });
    };
    const createReceiveTransport = async () => {
        socket?.emit("createTransport", { sender: false }, ({ params }) => {
            if (params.error) {
                console.error(params.error);
                return;
            }
            const transport = device?.createRecvTransport(params);
            setConsumerTransport(transport || null);

            transport?.on("connect", async ({ dtlsParameters }: any, callback: any, errback: any) => {
                try {
                    await socket.emit("connectConsumerTransport", { dtlsParameters });
                    console.log("----------> consumer transport has connected");
                    callback();
                }
                catch (error) {
                    console.error("Error connecting consumer transport:", error);
                    errback(error);
                }
            });
        });
    };

    const connectReceiveTransport = async () => {
        await socket?.emit("consumeMedia", { rtpCapabilities: device?.rtpCapabilities }, async ({ params }) => {
            if (params.error) {
                console.error("Error consuming media:", params.error);
                return;
            }
            const consumer = await consumerTransport?.consume({
                id: params.id,
                producerId: params.producerId,
                kind: params.kind,
                rtpParameters: params.rtpParameters,
            });

            const { track } = consumer;
            if (!track) {
                console.log("Missing Track")
            }
            console.log("Track kind:", track.kind);
            console.log("Track readyState:", track.readyState);

            if (!track) {
                console.error("No track received in consumer");
                return;
            }
            console.log("----------> consumer track has been created", track);

            if (remoteVideoRef.current) {
                const stream = new MediaStream([track]);

                console.log("Stream created with track:", stream);

                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current.muted = true;

                remoteVideoRef.current.onloadedmetadata = () => {
                    remoteVideoRef.current?.play().then(() => { console.log("Playback started") }).catch(e => console.error("Play failed:", e));
                }
            }
            socket?.emit("resumePausedConsumer", () => { });
            console.log("----------> consumer track has been resumed");
        });
    };

    // const getRouterRtpCapabilities = async () => {
    //     return new Promise(() => {

    //         socket?.emit("getRouterRtpCapabilities", (data: any) => {
    //             setRtpCapabilities(data.routerRtpCapabilities);
    //             console.log("Router RTP capabilities received:", data.routerRtpCapabilities);
    //         });
    //     })
    // };

    // const createDevice = async () => {
    //     return new Promise(async() => {

    //         console.log("Creating device...");
    //         try {
    //             const newDevice = new Device();
    //             if (!rtpCapabilities) {
    //                 console.error("RTP capabilities are not set");
    //                 return;
    //             }
    //             await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
    //             setDevice(newDevice);
    //         }
    //         catch (error) {
    //             console.error("Error creating device:", error);
    //         }
    //     })
    // };

    // const createSendTransport = async () => {
    //     return new Promise(() => {

    //         socket?.emit("createTransport", { sender: true }, ({ params }: {
    //             params: {
    //                 id: string;
    //                 iceParameters: IceParameters;
    //                 iceCandidates: IceCandidate[];
    //                 dtlsParameters: DtlsParameters;
    //                 error?: unknown;
    //             };
    //         }) => {
    //             if (!params || params.error) {
    //                 console.error("Error consuming media:", params?.error);
    //                 return;
    //             }
    //             const transport = device?.createSendTransport(params);
    //             setProducerTransport(transport || null);

    //             transport?.on("connect", async ({ dtlsParameters }: any, callback: any, errback: any) => {
    //                 try {
    //                     console.log("----------> producer transport has connected");
    //                     socket.emit("connectProducerTransport", { dtlsParameters });
    //                     callback();
    //                 } catch (error) {
    //                     errback(error);
    //                 }
    //             });

    //             transport?.on("produce", async (parameters: any, callback: any, errback: any) => {
    //                 const { kind, rtpParameters } = parameters;
    //                 console.log("----------> transport-produce");
    //                 try {
    //                     socket.emit("transport-produce",
    //                         { kind, rtpParameters },
    //                         ({ id }: any) => {
    //                             callback({ id });
    //                         }
    //                     );
    //                 } catch (error) {
    //                     errback(error);
    //                 }
    //             }
    //             );
    //         }
    //         );
    //     })
    // };

    // const connectSendTransport = async () => {
    //     return new Promise(async () => {

    //         const localProducer = await producerTransport?.produce(params);
    //         localProducer?.on("trackended", () => {
    //             console.log("Track ended");
    //         });

    //         localProducer?.on("transportclose", () => {
    //             console.log("Producer transport closed");
    //         });
    //     })
    // };
    // const createReceiveTransport = async () => {
    //     return new Promise(() => {

    //         socket?.emit("createTransport", { sender: false }, ({ params }) => {
    //             if (params.error) {
    //                 console.error(params.error);
    //                 return;
    //             }
    //             const transport = device?.createRecvTransport(params);
    //             setConsumerTransport(transport || null);

    //             transport?.on("connect", async ({ dtlsParameters }: any, callback: any, errback: any) => {
    //                 try {
    //                     await socket.emit("connectConsumerTransport", { dtlsParameters });
    //                     console.log("----------> consumer transport has connected");
    //                     callback();
    //                 }
    //                 catch (error) {
    //                     console.error("Error connecting consumer transport:", error);
    //                     errback(error);
    //                 }
    //             });
    //         });
    //     })
    // };

    // const connectReceiveTransport = async () => {
    //     await socket?.emit("consumeMedia", { rtpCapabilities: device?.rtpCapabilities }, async ({ params }) => {
    //         if (params.error) {
    //             console.error("Error consuming media:", params.error);
    //             return;
    //         }
    //         const consumer = await consumerTransport?.consume({
    //             id: params.id,
    //             producerId: params.producerId,
    //             kind: params.kind,
    //             rtpParameters: params.rtpParameters,
    //         });

    //         const { track } = consumer;
    //         console.log("Track kind:", track.kind);
    //         console.log("Track readyState:", track.readyState);

    //         if (!track) {
    //             console.error("No track received in consumer");
    //             return;
    //         }
    //         console.log("----------> consumer track has been created", track);

    //         if (remoteVideoRef.current) {
    //             const stream = new MediaStream([track]);

    //             console.log("Stream created with track:", stream);

    //             remoteVideoRef.current.srcObject = stream;
    //             remoteVideoRef.current.muted = true;

    //             remoteVideoRef.current.onloadedmetadata = () => {
    //                 remoteVideoRef.current?.play().then(() => { console.log("Playback started") }).catch(e => console.error("Play failed:", e));
    //             }
    //         }
    //         socket?.emit("resumePausedConsumer", () => { });
    //         console.log("----------> consumer track has been resumed");
    //     });
    // };


    // const join = () => {
    //     getRouterRtpCapabilities()
    //         .then(() => createDevice())
    //         .then(() => createSendTransport())
    //         .then(() => connectSendTransport())
    //         .then(() => createReceiveTransport())
    //         .then(() => connectReceiveTransport())
    //         .catch((err) => {
    //             console.error('Error during join:', err);
    //         });
    // };

    return (
        <main>
            <video ref={videoRef}
                id="localVideo"
                autoPlay
                playsInline
                muted
                style={{ width: "400px", height: "300px", background: "black" }} />
            <video ref={remoteVideoRef}
                id="remoteVideo"
                autoPlay
                playsInline
                muted
                style={{ width: "400px", height: "300px", background: "yellow" }} />
            <div className="flex flex-col items-center">
                <button onClick={join}>
                    JOIN   dont for now!   use 1 2 3 4 5 6
                </button>
                <button onClick={getRouterRtpCapabilities}>1</button>
                <button onClick={createDevice}>2</button>
                <button onClick={createSendTransport}>3</button>
                <button onClick={connectSendTransport}>4</button>
                <button onClick={createReceiveTransport}>5</button>
                <button onClick={connectReceiveTransport}>6</button>
            </div>
        </main>
    );
}