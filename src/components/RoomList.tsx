import { RoomRow } from './RoomRow';
import { CreateRoomButton } from './CreateRoomForm';
import { JoinByCodeButton } from './JoinByCodeForm';
import { Icon } from './Icon';
import type { RoomSummary } from '@/lib/queries';
import type { Room } from '@/lib/types';

export function RoomList({
  rooms,
  summaries,
}: {
  rooms: Room[];
  summaries: Map<string, RoomSummary>;
}) {
  return (
    <>
      <div className="sec-h">
        <h2>Your rooms</h2>
      </div>

      {rooms.length === 0 ? (
        <div className="empty">
          <svg className="empty-art" viewBox="0 0 120 72" aria-hidden="true">
            <circle cx="40" cy="36" r="24" fill="var(--accent-soft)" />
            <circle cx="80" cy="36" r="24" fill="var(--pos-soft)" />
            <path d="M60 14v44" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
          <h3>No rooms yet</h3>
          <p>
            A room is one trip, flat or dinner. Create one and share the invite code, or open an
            invite link someone sent you.
          </p>
          <div className="btn-row">
            <CreateRoomButton className="btn btn-primary">
              <Icon name="plus" />
              New room
            </CreateRoomButton>
            <JoinByCodeButton className="btn btn-ghost">
              <Icon name="key" />
              Join with code
            </JoinByCodeButton>
          </div>
        </div>
      ) : (
        <div className="rooms">
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} summary={summaries.get(room.id)} />
          ))}
        </div>
      )}
    </>
  );
}
