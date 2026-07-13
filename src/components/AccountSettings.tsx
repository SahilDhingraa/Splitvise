'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateDisplayName, type ActionResult } from '@/app/actions';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save name'}
    </button>
  );
}

export function AccountSettings({ displayName }: { displayName: string }) {
  const [state, formAction] = useActionState(updateDisplayName, EMPTY);

  return (
    <div className="section">
      <h2>⚙️ Your Name</h2>

      <form action={formAction}>
        <div className="form-group">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            defaultValue={displayName}
            required
          />
          <p className="form-hint left">
            This is how you appear in every room you are in. Changing it updates those rooms too.
          </p>
        </div>

        {state.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}
