import Link from 'next/link';
import { getRoomPreview } from '@/lib/queries';
import { JoinRoomForm } from '@/components/JoinRoomForm';
import { Brand } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';

// Signed-out visitors are sent to /login?next=/join/<code> by the proxy, so by the
// time this renders they are authenticated and the invite still resolves.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const roomName = await getRoomPreview(code);

  return (
    <div className="container">
      <ThemeToggle />

      <Brand />

      <div className="auth-shell">
        <div className="section">
          {roomName ? (
            <>
              <h2>Join room</h2>
              <JoinRoomForm code={code} roomName={roomName} />
            </>
          ) : (
            <>
              <h2>Invalid invite</h2>
              <p className="join-blurb">
                That invite link is not valid. The room may have been deleted, or the link may have
                been mistyped.
              </p>
              <Link href="/" className="block-link">
                <button type="button" className="secondary-btn">
                  Back to your rooms
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
