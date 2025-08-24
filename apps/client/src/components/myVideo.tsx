'use client';

import React, { useEffect, useRef } from 'react';

// Accept string or number for width/height
interface MyVideoProps {
    stream: MediaStream | null;
    width: number | string;
    height: number | string;
    style?: React.CSSProperties;
}

export default function MyVideo({ stream, width, height, style }: MyVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                ...style,
            }}
        />
    );
}