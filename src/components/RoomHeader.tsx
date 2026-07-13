'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useTransition } from 'react';
import { deleteRoom, leaveRoom, renameRoom } from '@/app/actions';
import type { Room } from '@/lib/types';

export function RoomHeader({ room, inviteUrl }: { room: Room; inviteUrl: string }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
    </div>
  );
}
