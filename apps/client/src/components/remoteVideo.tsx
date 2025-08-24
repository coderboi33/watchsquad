'use client';

import { useEffect, useRef } from 'react';

export default function RemoteVideo({ stream }: { stream: MediaStream }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '8px' }}
        />
    );
}