import { getDisplayName, getRooms } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './login/actions';
import { RoomList } from '@/components/RoomList';
import { CreateRoomForm } from '@/components/CreateRoomForm';
import { JoinByCodeForm } from '@/components/JoinByCodeForm';
import { AccountSettings } from '@/components/AccountSettings';
import { Brand } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirected signed-out visitors, so `user` exists here.
  const [rooms, displayName] = await Promise.all([getRooms(), getDisplayName()]);

  return (
    <div className="container">
      <ThemeToggle />

      <Brand>
        <div className="account-bar">
          <span>{user?.email}</span>
          <form action={signOut}>
            <button type="submit" className="secondary-btn">
              Sign out
            </button>
          </form>
        </div>
      </Brand>

      <div className="main-content">
        <RoomList rooms={rooms} />
        <CreateRoomForm />
        <JoinByCodeForm />
        <AccountSettings displayName={displayName} />
      </div>
    </div>
  );
}
