'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMedia } from '@/app/contexts/mediaContext';
import MyVideo from './myVideo';

export default function Lobby({ roomId }: { roomId: string }) {
    const router = useRouter();
    const {
        localStream,
        isAudioOn,
        isVideoOn,
        startLocalStream,
        toggleAudio,
        toggleVideo
    } = useMedia();

    // This effect correctly starts the camera and cleans it up
    useEffect(() => {
        startLocalStream();


    }, [startLocalStream]);


    const handleJoinCall = () => {
        // When navigating, the localStream will persist in the context
        router.push(`/rooms/${roomId}`);
    };

    // Moved RoomIdShare logic here
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
        } catch {
            // fallback or error handling if needed
        }
    };

    return (
        <div className="p-5 max-w-xl mx-auto text-center">
            <h1 className="text-2xl font-bold mb-6">Ready to join?</h1>
            {/* RoomIdShare UI */}
            <div className="flex items-center justify-center gap-2 mb-4">
                <span className="px-3 py-1 bg-zinc-800 text-white rounded font-mono text-sm select-all">{roomId}</span>
                <button
                    onClick={handleCopy}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                    aria-label="Copy room ID"
                    type="button"
                >
                    Copy
                </button>
            </div>
            <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden mb-5 flex items-center justify-center">

                {/* The MyVideo component handles the stream display */}
                {localStream ? (
                    <MyVideo stream={localStream} width="100%" height="100%" />
                ) : (
                    <p className="text-white m-auto">Starting camera...</p>
                )}

                {/* Your control buttons */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-3">
                    <button
                        onClick={toggleAudio}
                        className="text-2xl p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        aria-label={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
                    >
                        {isAudioOn ? '🎤' : '🔇'}
                    </button>
                    <button
                        onClick={toggleVideo}
                        className="text-2xl p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        aria-label={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                    >
                        {isVideoOn ? '📹' : '📸'}
                    </button>
                </div>
            </div>

            <button
                onClick={handleJoinCall}
                className="px-6 py-2 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
                Join Now
            </button>
        </div>
    );
}