import { RoomRow } from './RoomRow';
import type { Room } from '@/lib/types';

export function RoomList({ rooms }: { rooms: Room[] }) {
  return (
    <div className="section">
      <h2>🏠 Your Rooms</h2>

      <ul className="user-list room-list">
        {rooms.length === 0 ? (
          <li className="empty-state">
            No rooms yet. Create one, or open an invite link someone sent you.
          </li>
        ) : (
          rooms.map((room) => <RoomRow key={room.id} room={room} />)
        )}
      </ul>
    </div>
  );
}
