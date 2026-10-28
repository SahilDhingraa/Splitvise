'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { joinRoomWithCode, type ActionResult } from '@/app/actions';
import { Icon } from './Icon';
import { Modal } from './Modal';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      <Icon name="key" />
      {pending ? 'Joining…' : 'Join room'}
    </button>
  );
}

// A button that opens the "Join a room" dialog. Styled by the caller.
export function JoinByCodeButton({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setIsOpen(true)}>
        {children}
      </button>
      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <JoinByCodeForm onCancel={() => setIsOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function JoinByCodeForm({ onCancel }: { onCancel: () => void }) {
  const [state, formAction] = useActionState(joinRoomWithCode, EMPTY);

  return (
    <>
      <h3 className="modal-t">Join a room</h3>
      <p className="modal-p">Paste the code someone sent you, or the whole invite link.</p>

      <form action={formAction} className="form">
        <div className="field">
          <label className="label" htmlFor="inviteCode">
            Invite code or link
          </label>
          <input
            id="inviteCode"
            name="code"
            type="text"
            placeholder="ABCD1234"
            // The codes are uppercase, so type them that way. The database
            // upper()s the input anyway -- this is just so what you type matches
            // what you were sent.
            className="input mono"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          {state.error && <p className="err">{state.error}</p>}
        </div>

        <div className="modal-acts">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <SubmitButton />
        </div>
      </form>
    </>
  );
}
