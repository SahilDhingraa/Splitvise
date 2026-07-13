'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { joinRoomWithCode, type ActionResult } from '@/app/actions';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="secondary-btn" disabled={pending}>
      {pending ? 'Joining…' : 'Join Room'}
    </button>
  );
}

export function JoinByCodeForm() {
  const [state, formAction] = useActionState(joinRoomWithCode, EMPTY);

  return (
    <div className="section">
      <h2>🔑 Join a Room</h2>

      <form action={formAction}>
        <div className="form-group">
          <label htmlFor="inviteCode">Invite code</label>
          <input
            id="inviteCode"
            name="code"
            type="text"
            placeholder="ABCD1234"
            // The codes are uppercase, so type them that way. The database
            // upper()s the input anyway -- this is just so what you type matches
            // what you were sent.
            className="code-input"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <p className="form-hint left">Paste the code someone sent you, or the whole link.</p>
        </div>

        {state.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}
