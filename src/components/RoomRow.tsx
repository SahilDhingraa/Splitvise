'use client';

import { useRouter } from 'next/navigation';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { RoomMenu } from './RoomMenu';
import { LocalTime } from './LocalTime';
import { formatMoney } from '@/lib/money';
import { isSettled } from '@/lib/balances';
import type { RoomSummary } from '@/lib/queries';
import type { Room } from '@/lib/types';

// One room on the home page. The whole card opens the room; the ⋯ menu in the
// corner holds rename, lock, delete or leave.
export function RoomRow({ room, summary }: { room: Room; summary: RoomSummary | undefined }) {
  const router = useRouter();
  const href = `/rooms/${room.id}`;
  const members = summary?.members ?? [];
  const balance = summary?.yourBalance ?? 0;
  const tone = isSettled(balance) ? '' : balance > 0 ? ' pos' : ' neg';
  const sign = isSettled(balance) ? '' : balance > 0 ? '+' : '−';
  const payments = summary?.paymentCount ?? 0;

  return (
    <div
      className="rcard"
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') router.push(href);
      }}
      onMouseEnter={() => router.prefetch(href)}
    >
      <div className="rname">{room.name}</div>

      <div className="meta">
        <span className={`pill${room.isOwner ? ' pill-accent' : ''}`}>
          {room.isOwner ? 'Owner' : 'Member'}
        </span>
        {room.isLocked && (
          <span className="pill pill-warn">
            <Icon name="lock" />
            Locked
          </span>
        )}
        {members.length > 0 && (
          <span className="av-stack">
            {members.slice(0, 4).map((name, index) => (
              <Avatar key={`${name}-${index}`} name={name} size="sm" />
            ))}
          </span>
        )}
        <span className="hint">
          {room.participantCount} {room.participantCount === 1 ? 'person' : 'people'}
        </span>
      </div>

      <div className="kv">
        <span>Total spent</span>
        <span className="num">{formatMoney(summary?.totalSpent ?? 0)}</span>
      </div>
      <div className="kv">
        <span>Your balance</span>
        <span className={`num${tone}`}>
          {sign}
          {formatMoney(Math.abs(balance))}
        </span>
      </div>

      <div className="foot">
        <span>
          {payments} {payments === 1 ? 'payment' : 'payments'}
        </span>
        <span>
          Last activity <LocalTime iso={summary?.lastActivity ?? room.createdAt} relative />
        </span>
      </div>

      <RoomMenu room={room} buttonClassName="btn btn-ghost btn-sm btn-icon" />
    </div>
  );
}
