'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { createRoom, type ActionResult } from '@/app/actions';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create Room'}
    </button>
  );
}

export function CreateRoomForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await createRoom(prev, formData);
    // On success createRoom redirects into the new room, so this only runs on failure.
    if (!result.error) formRef.current?.reset();
    return result;
  }, EMPTY);

  return (
    <div className="section">
      <h2>➕ New Room</h2>

      <form action={formAction} ref={formRef}>
        <div className="form-group">
          <label htmlFor="roomName">Room name</label>
          <input
            id="roomName"
            name="name"
            type="text"
            placeholder="Europe trip, Imagica, Flat rent…"
            required
          />
        </div>

        {state.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}
