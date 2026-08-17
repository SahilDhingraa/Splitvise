'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteRoom, renameRoom } from '@/app/actions';
import type { Room } from '@/lib/types';

export function RoomRow({ room }: { room: Room }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(room.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
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

  function cancel() {
    setDraft(room.name);
    setError(null);
    setIsEditing(false);
  }

  function handleDelete() {
    // Typing the name, rather than an OK/Cancel confirm. This wipes every payment
    // and balance in the room for everyone in it, and it cannot be undone -- a
    // misplaced click should not be enough to do that.
    const typed = window.prompt(
      `Deleting "${room.name}" permanently removes every payment and balance in it, for everyone in the room. This cannot be undone.\n\nType the room name to confirm:`,
    );
    if (typed !== room.name) return;

    startTransition(async () => {
      const result = await deleteRoom(room.id);
      if (result?.error) window.alert(result.error);
    });
  }

  if (isEditing) {
    return (
      <li className="user-item editing">
        <div className="rename-row">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') cancel();
            }}
            autoFocus
            aria-label={`Rename ${room.name}`}
          />
          <button type="button" onClick={save} disabled={isPending} className="inline-btn">
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancel} className="secondary-btn inline-btn">
            Cancel
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </li>
    );
  }

  return (
    <li className="user-item">
      <Link href={`/rooms/${room.id}`} className="room-link">
        <strong>{room.name}</strong>
        {room.isLocked && <span className="room-badge locked-badge">🔒</span>}
        <span className="room-badge">{room.isOwner ? 'Owner' : 'Member'}</span>
        <span className="room-badge">
          👥 {room.participantCount}
        </span>
      </Link>

      {/* Only the owner can rename or delete. This mirrors RLS; it decides what
          to show, not what is permitted. */}
      {room.isOwner && (
        <span className="row-actions">
          <button
            type="button"
            className="secondary-btn inline-btn"
            onClick={() => setIsEditing(true)}
            disabled={isPending}
          >
            Rename
          </button>
          <button type="button" className="remove-btn" onClick={handleDelete} disabled={isPending}>
            Delete
          </button>
        </span>
      )}
    </li>
  );
}
