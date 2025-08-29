import Call from "@/components/call";

interface CallPageProps {
    params: {
        roomId: string;
    };
}

export default async function CallPage({ params }: CallPageProps) {
    const { roomId } = await params;

    return <Call roomId={roomId} />;
}