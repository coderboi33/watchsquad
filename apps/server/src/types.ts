import mediasoup from 'mediasoup';

// These interfaces define the shape of the data we will store in Redis.
export interface PeerData {
    socketId: string;
    roomId: string;
    producerTransportIds: string[];
    consumerTransportIds: string[];
    producerIds: string[];
    consumerIds: string[];
}

export interface RoomData {
    id: string;
    peerIds: string[];
}

export const mediaCodecs: mediasoup.types.RtpCodecCapability[] =
    [
        {
            kind: "audio",
            mimeType: "audio/opus",
            clockRate: 48000,
            channels: 2,
            preferredPayloadType: 100
        },
        {
            kind: "video",
            mimeType: "video/H264",
            clockRate: 90000,
            preferredPayloadType: 101,
            parameters:
            {
                "packetization-mode": 1,
                "profile-level-id": "42e01f",
                "level-asymmetry-allowed": 1
            }
        }
    ];

// Keep the mediasoup mediaCodecs configuration here for organization
// export const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
//     {
//         kind: "audio",
//         mimeType: "audio/opus",
//         clockRate: 48000,
//         channels: 2,
//     },
//     {
//         kind: "video",
//         mimeType: "video/VP8",
//         clockRate: 90000,
//         parameters: { 'x-google-start-bitrate': 1000 },
//     },
// ];

// // Define the structure for a peer and a room
// export interface Peer {
//     socketId: string;
//     producerTransports: Map<string, mediasoup.types.WebRtcTransport>;
//     consumerTransports: Map<string, mediasoup.types.WebRtcTransport>;
//     producers: Map<string, mediasoup.types.Producer>;
//     consumers: Map<string, mediasoup.types.Consumer>;
// }

// export interface Room {
//     router: mediasoup.types.Router;
//     peers: Map<string, Peer>; // key = socketId
// }