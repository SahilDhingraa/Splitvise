import Link from 'next/link';
import { getRoomPreview } from '@/lib/queries';
import { JoinRoomForm } from '@/components/JoinRoomForm';
import { Brand } from '@/components/Brand';

// Signed-out visitors are sent to /login?next=/join/<code> by the proxy, so by the
// time this renders they are authenticated and the invite still resolves.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const roomName = await getRoomPreview(code);

  return (
    <div className="auth">
      <div className="auth-card">
        <Brand />
        {roomName ? (
          <>
            <h1>Join {roomName}</h1>
            <JoinRoomForm code={code} roomName={roomName} />
          </>
        ) : (
          <>
            <h1>Invalid invite</h1>
            <p className="lede">
              That invite link is not valid. The room may have been deleted, or the link may have
              been mistyped.
            </p>
            <Link href="/" className="btn btn-ghost btn-block">
              Back to your rooms
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
