'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface MediaContextType {
    localStream: MediaStream | null;
    isAudioOn: boolean;
    isVideoOn: boolean;
    startLocalStream: () => Promise<void>;
    stopLocalStream: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider = ({ children }: { children: ReactNode }) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);

    const startLocalStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setIsAudioOn(true);
            setIsVideoOn(true);
        } catch (error) {
            console.error('Error accessing media devices.', error);
        }
    }, []); // <-- Empty array makes it stable

    // This function will also be created only once
    const stopLocalStream = useCallback(() => {
        // Use a functional update to access the latest stream without needing it as a dependency
        setLocalStream(currentStream => {
            currentStream?.getTracks().forEach(track => track.stop());
            return null;
        });
    }, []); // <-- Empty array makes it stable

    const toggleAudio = useCallback(() => {
        if (localStream) {
            const isEnabled = !isAudioOn;
            localStream.getAudioTracks().forEach((track) => {
                track.enabled = isEnabled;
            });
            setIsAudioOn(isEnabled);
        }
    }, [localStream, isAudioOn, setIsAudioOn]); // <-- Add all dependencies here

    // --- THIS IS THE CORRECTED LOGIC ---
    const toggleVideo = useCallback(() => {
        const newIsVideoOn = !isVideoOn;
        setIsVideoOn(newIsVideoOn);

        if (newIsVideoOn) {
            // If turning the video ON, get a new stream
            startLocalStream();
        } else {
            // If turning the video OFF, stop the tracks
            localStream?.getVideoTracks().forEach(track => track.stop());
            // Optional: You might want to keep the stream object but with a dead track
            // to avoid the video element disappearing entirely.
        }
    }, [localStream, isVideoOn, startLocalStream]);


    return (
        <MediaContext.Provider value={{
            localStream,
            isAudioOn,
            isVideoOn,
            startLocalStream,
            stopLocalStream,
            toggleAudio,
            toggleVideo,
        }}>
            {children}
        </MediaContext.Provider>
    );
};

export const useMedia = () => {
    const context = useContext(MediaContext);
    if (context === undefined) {
        throw new Error('useMedia must be used within a MediaProvider');
    }
    return context;
};