import { getDisplayName, getRooms, getRoomSummaries } from '@/lib/queries';
import { RoomList } from '@/components/RoomList';
import { CreateRoomButton } from '@/components/CreateRoomForm';
import { JoinByCodeButton } from '@/components/JoinByCodeForm';
import { AppShell } from '@/components/AppShell';
import { Greeting } from '@/components/Greeting';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/lib/money';
import { isSettled } from '@/lib/balances';

export default async function Home() {
  // The proxy already redirected signed-out visitors, so there is a user here.
  const [rooms, summaries, displayName] = await Promise.all([
    getRooms(),
    getRoomSummaries(),
    getDisplayName(),
  ]);

  let owed = 0;
  let owe = 0;
  let owedRooms = 0;
  let oweRooms = 0;
  rooms.forEach((room) => {
    const balance = summaries.get(room.id)?.yourBalance ?? 0;
    if (isSettled(balance)) return;
    if (balance > 0) {
      owed += balance;
      owedRooms += 1;
    } else {
      owe -= balance;
      oweRooms += 1;
    }
  });
  const locked = rooms.filter((room) => room.isLocked).length;
  const roomsLabel = (n: number) => `across ${n} ${n === 1 ? 'room' : 'rooms'}`;

  return (
    <AppShell>
      <header className="page-head">
        <Greeting name={displayName.split(' ')[0]} />
        <div className="head-acts">
          <JoinByCodeButton className="btn btn-ghost">
            <Icon name="key" />
            Join with code
          </JoinByCodeButton>
          <CreateRoomButton className="btn btn-primary">
            <Icon name="plus" />
            New room
          </CreateRoomButton>
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="k">You are owed</div>
          <div className="v pos">{formatMoney(owed)}</div>
          <div className="s">{roomsLabel(owedRooms)}</div>
        </div>
        <div className="stat">
          <div className="k">You owe</div>
          <div className="v neg">{formatMoney(owe)}</div>
          <div className="s">{roomsLabel(oweRooms)}</div>
        </div>
        <div className="stat">
          <div className="k">Rooms</div>
          <div className="v">{rooms.length}</div>
          <div className="s">
            {locked ? `${locked} ${locked === 1 ? 'room' : 'rooms'} locked` : 'none locked'}
          </div>
        </div>
      </section>

      <RoomList rooms={rooms} summaries={summaries} />
    </AppShell>
  );
}
