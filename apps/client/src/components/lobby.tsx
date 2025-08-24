'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMedia } from '@/app/contexts/mediaContext';
import MyVideo from './myVideo'; // Make sure this path is correct

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

    return (
        <div className="p-5 max-w-xl mx-auto text-center">
            <h1 className="text-2xl font-bold mb-6">Ready to join?</h1>
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