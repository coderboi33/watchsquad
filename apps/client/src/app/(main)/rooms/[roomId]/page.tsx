import Call from "@/components/call";

interface CallPageProps {
    params: {
        roomId: string;
    };
}

// This is a Server Component. It can access params directly without hooks.
export default async function CallPage({ params }: CallPageProps) {
    const { roomId } = await params;

    // Render the Client Component and pass the roomId as a simple string prop.
    return <Call roomId={roomId} />;
}