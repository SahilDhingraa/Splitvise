'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useTransition } from 'react';
import { deleteRoom, leaveRoom, renameRoom, setRoomLock } from '@/app/actions';
import { MergePeople } from './MergePeople';
import type { Participant, Payment, Room } from '@/lib/types';

export function RoomHeader({
  room,
  inviteUrl,
  participants,
  payments,
}: {
  room: Room;
  inviteUrl: string;
  participants: Participant[];
  payments: Payment[];
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [draft, setDraft] = useState(room.name);
  const [error, setError] = useState<string | null>(null);

  function saveName() {
    const name = draft.trim();
    if (!name || name === room.name) {
      setDraft(room.name);
      setIsEditing(false);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await renameRoom(room.id, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIsEditing(false);
    });
  }

  function cancelRename() {
    setDraft(room.name);
    setError(null);
    setIsEditing(false);
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // The link is on screen and selectable, so this is not worth an alert.
      setCopied(false);
    }
  }

  function handleDelete() {
    const confirmation = window.prompt(
      `Deleting "${room.name}" permanently removes every payment and balance in it. This cannot be undone.\n\nType the room name to confirm:`,
    );
    if (confirmation !== room.name) return;

    startTransition(async () => {
      const result = await deleteRoom(room.id);
      if (result?.error) window.alert(result.error);
    });
  }

  function handleLock() {
    const question = room.isLocked
      ? `Unlock "${room.name}"? Everyone will be able to record and remove payments again.`
      : `Lock "${room.name}"? Nobody — including you — can record or remove payments, or change who is in the room, until you unlock it. People can still open the room and read it.`;

    if (!window.confirm(question)) return;

    setError(null);
    startTransition(async () => {
      const result = await setRoomLock(room.id, !room.isLocked);
      if (result.error) setError(result.error);
    });
  }

  function handleLeave() {
    if (!window.confirm(`Leave "${room.name}"? Payments you recorded stay in the room.`)) return;

    startTransition(async () => {
      const result = await leaveRoom(room.id);
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <div className="header room-header">
      <Link href="/" className="back-link">
        <Image src="/logo.png" alt="" width={400} height={432} className="back-logo" />← All rooms
      </Link>

      {isEditing ? (
        <div className="rename-row rename-title">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveName();
              if (event.key === 'Escape') cancelRename();
            }}
            autoFocus
            aria-label="Room name"
          />
          <button type="button" onClick={saveName} disabled={isPending} className="inline-btn">
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancelRename} className="secondary-btn inline-btn">
            Cancel
          </button>
        </div>
      ) : (
        <h1 className="room-title">
          {room.name}
          {room.isLocked && <span className="room-badge locked-badge">🔒 Locked</span>}
          {room.isOwner && (
            <button
              type="button"
              className="secondary-btn inline-btn"
              onClick={() => setIsEditing(true)}
              disabled={isPending}
            >
              Rename
            </button>
          )}
        </h1>
      )}

      {error && <p className="form-error">{error}</p>}

      <p>{room.isOwner ? 'You own this room' : 'You are a member of this room'}</p>

      {room.isLocked && (
        <p className="locked-banner">
          🔒 This room is locked{room.lockedAt && <> since <LocalTime iso={room.lockedAt} /></>}.
          Payments and people cannot be added, changed or removed
          {room.isOwner ? ' until you unlock it.' : '. Only the room owner can unlock it.'}
        </p>
      )}

      <div className="invite-bar">
        <code className="invite-link">{inviteUrl}</code>
        <button type="button" className="secondary-btn" onClick={copyInvite}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </div>
      <p className="form-hint">
        Anyone with this link can join the room and see its payments. Or share just the code:{' '}
        <strong className="invite-code">{room.inviteCode}</strong>
      </p>

      <div className="account-bar">
        {/* Owner-only, mirroring the "owner updates room" policy. A member never
            sees the button; the database is what actually refuses them. */}
        {room.isOwner && (
          <button
            type="button"
            className="secondary-btn"
            onClick={handleLock}
            disabled={isPending}
          >
            {room.isLocked ? '🔓 Unlock room' : '🔒 Lock room'}
          </button>
        )}

        {/* Owner-only and hidden while the room is locked, mirroring what
            merge_participants will refuse. It needs two people to work with. */}
        {room.isOwner && !room.isLocked && participants.length > 1 && (
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setIsMerging((open) => !open)}
            disabled={isPending}
          >
            👥 Merge people
          </button>
        )}

        {room.isOwner ? (
          <button type="button" className="remove-btn" onClick={handleDelete} disabled={isPending}>
            Delete room
          </button>
        ) : (
          <button type="button" className="remove-btn" onClick={handleLeave} disabled={isPending}>
            Leave room
          </button>
        )}
      </div>

      {isMerging && (
        <MergePeople
          roomId={room.id}
          participants={participants}
          payments={payments}
          onDone={() => setIsMerging(false)}
        />
      )}
    </div>
  );
}

// Client-side, so the timestamp is in the viewer's timezone. See the same helper
// in PaymentHistory for why the hydration warning is suppressed.
function LocalTime({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString()}</span>;
}
