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
    }, []);

    const stopLocalStream = useCallback(() => {
        setLocalStream(currentStream => {
            currentStream?.getTracks().forEach(track => track.stop());
            return null;
        });
    }, []);

    const toggleAudio = useCallback(() => {
        // --- CHANGE ---
        // Using a "functional update" for `setIsAudioOn`.
        // This gives you the previous state value safely, so you don't need
        // to include `isAudioOn` in the dependency array.
        setIsAudioOn(prevIsAudioOn => {
            const newIsAudioOn = !prevIsAudioOn;
            localStream?.getAudioTracks().forEach(track => {
                track.enabled = newIsAudioOn;
            });
            return newIsAudioOn;
        });
        // --- CHANGE ---
        // The dependency array now only needs `localStream`. This makes the function
        // more stable and prevents unnecessary re-creations.
    }, [localStream]);

    const toggleVideo = useCallback(() => {
        // --- CHANGE ---
        // Using a "functional update" for `setIsVideoOn` for the same reason.
        setIsVideoOn(prevIsVideoOn => {
            const newIsVideoOn = !prevIsVideoOn;
            localStream?.getVideoTracks().forEach(track => {
                track.enabled = newIsVideoOn;
            });
            return newIsVideoOn;
        });
        // --- CHANGE ---
        // The dependency array is now more stable.
    }, [localStream]);

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