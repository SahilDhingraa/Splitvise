'use client';

import { useState, useTransition } from 'react';
import { joinRoom } from '@/app/actions';

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
    <>
      <p className="join-blurb">
        You have been invited to join <strong>{roomName}</strong>. Joining lets you record payments
        and see everyone&apos;s balances in this room.
      </p>

      {error && <p className="form-error">{error}</p>}

      <button type="button" onClick={handleJoin} disabled={isPending}>
        {isPending ? 'Joining…' : `Join ${roomName}`}
      </button>
    </>
  );
}
