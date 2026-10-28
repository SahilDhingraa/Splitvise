'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { joinRoom } from '@/app/actions';
import { Icon } from './Icon';

export function JoinRoomForm({ code, roomName }: { code: string; roomName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinRoom(code);
      // On success joinRoom redirects, so reaching here means it failed.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="form">
      <p className="lede" style={{ marginBottom: 0 }}>
        You have been invited to join <strong>{roomName}</strong>. Joining lets you record payments
        and see everyone&apos;s balances in this room.
      </p>

      {error && <p className="err">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" onClick={handleJoin} disabled={isPending}>
        <Icon name="key" />
        {isPending ? 'Joining…' : `Join ${roomName}`}
      </button>
      <Link href="/" className="btn btn-ghost btn-block">
        Back to your rooms
      </Link>
    </div>
  );
}
