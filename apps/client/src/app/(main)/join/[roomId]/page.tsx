import Lobby from "@/components/lobby";


interface CallPageProps {
    params: {
        roomId: string;
    };
}

export default async function CallPage({ params }: CallPageProps) {
    const { roomId } = await params;

    return <Lobby roomId={roomId} />;
}
