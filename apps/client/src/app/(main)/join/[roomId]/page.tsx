import Lobby from "@/components/lobby";

interface LobbyPageProps {
    roomId: string;
}

export default async function LobbyPage({ params }: { params: LobbyPageProps }) {
    const { roomId } = await params;

    return <Lobby roomId={roomId} />;
}