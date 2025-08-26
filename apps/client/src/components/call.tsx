'use client';

import { useEffect, useRef, useState } from 'react';
import { useMedia } from '@/app/contexts/mediaContext';
import { useDraggable } from '@/hooks/useDraggable';
import MyVideo from './myVideo';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import { Consumer, Producer, Transport, RtpCapabilities, IceCandidate, DtlsParameters, IceParameters, MediaKind, RtpParameters } from 'mediasoup-client/types';
import RemoteVideo from './remoteVideo';

// A new interface to hold combined streams for a single peer
interface RemotePeer {
    id: string; // This will be the peer's socketId
    stream: MediaStream;
    // Keep track of which producers belong to this peer
    producerIds: Set<string>;
}

// Data shape for the server's 'join' callback
interface ProducerData {
    producerId: string;
    peerId: string;
}

interface routerRtpCapabilities {
    routerRtpCapabilities: RtpCapabilities;
}

interface createTransportParams {
    id: string;
    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    dtlsParameters: DtlsParameters;
}

interface connectTransportParams {
    success: boolean;
}

interface produceResponseParams {
    id: string;
    error?: string;
}

interface consumeResponseParams {
    id: string;
    producerId: string;
    kind: MediaKind;
    rtpParameters: RtpParameters;
    error?: string;
}

export default function Call({ roomId }: { roomId: string }) {
    const {
        localStream,
        stopLocalStream, // Get stopLocalStream for cleanup
        toggleAudio,
        toggleVideo,
        isAudioOn,
        isVideoOn
    } = useMedia();
    const pageRouter = useRouter();

    // --- State and Refs ---
    const [remotePeers, setRemotePeers] = useState<Record<string, RemotePeer>>({});
    const socketRef = useRef<Socket | null>(null);
    const deviceRef = useRef<Device | null>(null);
    const producerTransportRef = useRef<Transport | null>(null);
    const consumerTransportRef = useRef<Transport | null>(null);
    const producersRef = useRef<Record<string, Producer>>({});
    const consumersRef = useRef<Record<string, Consumer>>({});
    const BACKEND_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;


    useEffect(() => {

        if (!localStream) {
            // pageRouter.push(`/join/${roomId}`);
            console.warn("Local stream not available, redirecting to join page.");
            return;
        }

        // Now that we are sure the stream exists, connect to the server
        const socket = io(BACKEND_SOCKET_URL + '/rooms');
        socketRef.current = socket;

        socket.on("connected", async ({ socketId }) => {
            console.log(`Connected to room ${roomId} with socket ID: ${socketId}`);
        });

        // --- Event: "new-producer" ---
        // A new peer has joined and started producing, let's consume them.
        socket.on('new-producer', ({ producerId, peerId }) => {
            consumeStream(socket, producerId, peerId);
        });

        socket.on('peer-left', ({ peerId }) => {
            console.log(`Peer ${peerId} left`);
            setRemotePeers(prev => {
                const newPeers = { ...prev };
                delete newPeers[peerId];
                return newPeers;
            });
        });

        socket.emit('join', { roomId }, async ({ producersData }: { producersData: ProducerData[] }) => {
            // console.log(`Joined room. Found ${producersData.length} existing producers.`);

            // --- Server Event: "getRtpCapabilities" ---
            socket.emit('getRtpCapabilities', { roomId }, async (data: routerRtpCapabilities) => {
                const device = new Device();
                await device.load({ routerRtpCapabilities: data.routerRtpCapabilities });
                deviceRef.current = device;

                // Create transports and produce media
                await createSendTransport(socket);
                await createRecvTransport(socket);
                await startProducing();

                // Consume existing producers
                for (const { producerId, peerId } of producersData) {
                    await consumeStream(socket, producerId, peerId);
                }
            });
        });

    }, [roomId, pageRouter, stopLocalStream, localStream]);

    // useEffect(() => {
    //     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    //         // This event fires when the user tries to close the tab or refresh.
    //         // It's a good place to notify the server you're leaving.
    //         if (socketRef.current) {
    //             socketRef.current.emit('leave-room', { roomId });
    //         }
    //         // Most browsers will show a generic confirmation dialog.
    //         // You can optionally try to set a custom message, but it's often ignored.
    //         e.preventDefault();
    //         e.returnValue = '';
    //     };

    //     const handlePopState = () => {
    //         // This event fires when the user clicks the browser's back or forward buttons.
    //         if (socketRef.current) {
    //             socketRef.current.emit('leave-room', { roomId });
    //         }
    //         stopLocalStream();
    //     };

    //     // Attach the event listeners
    //     window.addEventListener('beforeunload', handleBeforeUnload);
    //     window.addEventListener('popstate', handlePopState);

    //     // Cleanup function to remove the listeners when the component unmounts
    //     return () => {
    //         window.removeEventListener('beforeunload', handleBeforeUnload);
    //         window.removeEventListener('popstate', handlePopState);
    //     };
    // }, [roomId, stopLocalStream]);


    console.log('Call component mounted', localStream);

    const createSendTransport = async (socket: Socket) => {
        return new Promise<void>((resolve) => {
            // --- Server Event: "createTransport" ---
            socket.emit('createTransport', { isProducer: true }, (params: createTransportParams) => {
                const transport = deviceRef.current!.createSendTransport(params);
                producerTransportRef.current = transport;

                transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                    // --- Server Event: "connectTransport" ---
                    socket.emit('connectTransport', { transportId: transport.id, dtlsParameters }, ({ success }: connectTransportParams) => {
                        if (success) {
                            callback();
                        }
                        else {
                            errback(new Error('Transport connection failed.'));
                        }
                    });
                });

                transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                    try {
                        const { id } = await new Promise<{ id: string }>((res, rej) => {
                            // --- Server Event: "produce" ---
                            socket.emit('produce', { transportId: transport.id, kind, rtpParameters }, (response: produceResponseParams) => {
                                if (response.error) rej(new Error(response.error));
                                else res(response);
                            });
                        });
                        callback({ id });
                    } catch (error) { errback(error as Error); }
                });
                resolve();
            });
        });
    };

    const createRecvTransport = async (socket: Socket) => {
        return new Promise<void>((resolve) => {
            // --- Server Event: "createTransport" ---
            socket.emit('createTransport', { isProducer: false }, (params: createTransportParams) => {
                const transport = deviceRef.current!.createRecvTransport(params);
                consumerTransportRef.current = transport;

                transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                    // --- Server Event: "connectTransport" ---
                    socket.emit('connectTransport', { transportId: transport.id, dtlsParameters }, ({ success }: connectTransportParams) => {
                        if (success) {
                            callback();
                        }
                        else {
                            errback(new Error('Transport connection failed.'));
                        }
                    });
                });
                resolve();
            });
        });
    };

    const startProducing = async () => {
        if (!producerTransportRef.current) return;
        const videoTrack = localStream!.getVideoTracks()[0];
        if (videoTrack) {
            producersRef.current['video'] = await producerTransportRef.current!.produce({ track: videoTrack });
            if (!isVideoOn) {
                producersRef.current['video'].pause();
            }
        }
        const audioTrack = localStream!.getAudioTracks()[0];
        if (audioTrack) {
            producersRef.current['audio'] = await producerTransportRef.current!.produce({ track: audioTrack });
            if (!isAudioOn) {
                producersRef.current['audio'].pause();
            }
        }
    };

    const consumeStream = async (socket: Socket, producerId: string, peerId: string) => {
        if (!consumerTransportRef.current) return;
        const rtpCapabilities = deviceRef.current!.rtpCapabilities;
        const transport = consumerTransportRef.current;

        // --- Server Event: "consume" ---
        socket.emit('consume', { transportId: transport.id, producerId, rtpCapabilities }, async (params: consumeResponseParams) => {
            if (params.error) return console.error("Cannot consume", params.error);

            const consumer = await transport.consume(params);
            consumersRef.current[producerId] = consumer;

            const { track } = consumer;
            // const stream = new MediaStream([track]);
            setRemotePeers(prevPeers => {
                const newPeers = { ...prevPeers };
                let peer = newPeers[peerId];

                if (peer) {
                    // If peer already exists, add the new track to their stream
                    peer.stream.addTrack(track);
                    peer.producerIds.add(producerId);
                } else {
                    // If it's a new peer, create a new entry for them
                    const newStream = new MediaStream([track]);
                    peer = { id: peerId, stream: newStream, producerIds: new Set([producerId]) };
                }

                newPeers[peerId] = peer;
                return newPeers;
            });

            socket.emit('resume', { consumerId: consumer.id }, () => {
                console.log('Consumer resumed on server');
            });
        });
    };

    const handleEndCall = () => {
        // Notify the server that you are leaving
        if (socketRef.current) {
            socketRef.current.emit('leave-room', { roomId });
        }

        // Stop your local camera and microphone
        stopLocalStream();

        // Navigate back to the homepage
        pageRouter.push('/');
    };

    const draggableRef = useRef<HTMLDivElement>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);
    const { position, size } = useDraggable({ elRef: draggableRef, resizeHandleRef: resizeHandleRef });

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#222', color: 'white', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', padding: '10px' }}>
                {Object.entries(remotePeers).map(([peerId, peer]) => (
                    <RemoteVideo key={peerId} stream={peer.stream} />
                ))}
            </div>

            <div ref={draggableRef} style={{ position: 'absolute', left: `${position.x}px`, top: `${position.y}px`, width: `${size.width}px`, height: `${size.height}px`, border: '2px solid white', borderRadius: '8px', overflow: 'hidden', cursor: 'move' }}>
                {localStream && <MyVideo stream={localStream} width={size.width} height={size.height} />}
                <div ref={resizeHandleRef} style={{ position: 'absolute', width: '20px', height: '20px', bottom: '0', right: '0', cursor: 'nwse-resize' }} />
            </div>

            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '15px', background: 'rgba(0, 0, 0, 0.5)', padding: '10px 20px', borderRadius: '25px' }}>
                <button onClick={toggleAudio} style={{ fontSize: '20px', background: isAudioOn ? '#343a40' : '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px' }}>{isAudioOn ? '🎤' : '🔇'}</button>
                <button onClick={toggleVideo} style={{ fontSize: '20px', background: isVideoOn ? '#343a40' : '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px' }}>{isVideoOn ? '📹' : '📸'}</button>
                <button onClick={handleEndCall} style={{ fontSize: '20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px' }}>📞</button>
            </div>
        </div>
    );
}