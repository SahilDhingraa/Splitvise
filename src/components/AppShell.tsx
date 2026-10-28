import Link from 'next/link';
import { getDisplayName, getRooms } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { Brand } from './Brand';
import { CreateRoomButton } from './CreateRoomForm';
import { JoinByCodeButton } from './JoinByCodeForm';
import { ProfileButton } from './AccountSettings';
import { ThemeToggle } from './ThemeToggle';
import { Icon } from './Icon';

// The signed-in frame around every page: a navy rail listing your rooms on the
// left, and on a phone a navy top bar in its place. `activeRoomId` highlights the
// room being viewed; without it, "Overview" is the current item.
export async function AppShell({
  activeRoomId,
  children,
}: {
  activeRoomId?: string;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [rooms, displayName] = await Promise.all([getRooms(), getDisplayName()]);
  const email = user?.email ?? '';

  return (
    <div className="shell">
      <aside className="rail">
        <Brand />

        <Link href="/" className={`rail-i${activeRoomId ? '' : ' on'}`}>
          <Icon name="home" />
          <span className="grow">Overview</span>
        </Link>

        <div className="rail-s">Rooms</div>
        <nav className="rail-list" aria-label="Your rooms">
          {rooms.length === 0 ? (
            <div className="rail-empty">No rooms yet</div>
          ) : (
            rooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className={`rail-i${room.id === activeRoomId ? ' on' : ''}`}
                aria-current={room.id === activeRoomId ? 'page' : undefined}
              >
                <span className={`dot${room.isLocked ? ' lock' : ''}`} />
                <span className="grow ell">{room.name}</span>
                <span className="cnt">{room.participantCount}</span>
              </Link>
            ))
          )}
        </nav>

        <div className="rail-foot">
          <CreateRoomButton className="rail-i">
            <Icon name="plus" />
            <span className="grow">New room</span>
          </CreateRoomButton>
          <JoinByCodeButton className="rail-i">
            <Icon name="key" />
            <span className="grow">Join with code</span>
          </JoinByCodeButton>
          <ProfileButton displayName={displayName} email={email} variant="rail" />
        </div>
      </aside>

      <div className="main-wrap">
        <div className="topbar">
          {activeRoomId ? (
            <Link href="/" className="tb-btn">
              <Icon name="chevL" />
              Rooms
            </Link>
          ) : (
            <Brand />
          )}
          <div className="tb-acts">
            <ThemeToggle className="tb-btn" />
            <ProfileButton displayName={displayName} email={email} variant="topbar" />
          </div>
        </div>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}
