import Lobby from "@/components/lobby";

interface LobbyPageProps {
    params: {
        roomId: string;
    };
}

export default async function LobbyPage({ params }: LobbyPageProps) {
    const { roomId } = await params;

    return <Lobby roomId={roomId} />;
}