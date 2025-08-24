"use client";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uniqueNamesGenerator, Config, adjectives, animals, colors } from 'unique-names-generator';

export default function HomePage() {
    const router = useRouter();
    const [roomId, setRoomId] = useState("");
    const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL;

    const handleCreateRoom = () => {
        const config: Config = {
            dictionaries: [adjectives, colors, animals],
            separator: '-',
            style: 'capital',
            length: 3,
        };

        const newRoomId = uniqueNamesGenerator(config);

        axios.post(`${BACKEND_API_URL}/create-room`, { roomId: newRoomId })
            .then(() => {
                console.log(`Room created with ID: ${newRoomId}`);
            })
            .catch((error) => {
                console.error("Error creating room:", error);
            });

        router.push(`/join/${newRoomId}`);
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();

        axios.get(`${BACKEND_API_URL}/check-room/${roomId}`)
            .then((response) => {
                if (response.data && response.data.message === true) {
                    router.push(`/join/${roomId}`);
                } else {
                    alert(`Room "${roomId}" does not exist.`);
                }
            })
            .catch(() => {
                alert(`Room "${roomId}" does not exist.`);
            });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
                <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Video Conference</h1>
                <div className="flex flex-col gap-6">
                    <button
                        onClick={handleCreateRoom}
                        className="w-full py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
                    >
                        Create New Room
                    </button>
                    <div className="flex items-center my-2">
                        <div className="flex-1 h-px bg-gray-300" />
                        <span className="mx-3 text-gray-400 font-medium">OR</span>
                        <div className="flex-1 h-px bg-gray-300" />
                    </div>
                    <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="Enter Room ID to Join"
                            className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                            type="submit"
                            className="w-full py-3 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition"
                        >
                            Join Room
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}