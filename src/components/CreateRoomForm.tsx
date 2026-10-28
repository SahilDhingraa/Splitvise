'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createRoom, type ActionResult } from '@/app/actions';
import { Icon } from './Icon';
import { Modal } from './Modal';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      <Icon name="plus" />
      {pending ? 'Creating…' : 'Create room'}
    </button>
  );
}

// A button that opens the "New room" dialog. Styled by the caller, since it
// appears both as a rail item and as a page button.
export function CreateRoomButton({
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
          <CreateRoomForm onCancel={() => setIsOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function CreateRoomForm({ onCancel }: { onCancel: () => void }) {
  // On success createRoom redirects into the new room, so the state only ever
  // carries an error.
  const [state, formAction] = useActionState(createRoom, EMPTY);

  return (
    <>
      <h3 className="modal-t">New room</h3>
      <p className="modal-p">
        One room per trip, flat or dinner. You can invite people after it&apos;s made.
      </p>

      <form action={formAction} className="form">
        <div className="field">
          <label className="label" htmlFor="roomName">
            Room name
          </label>
          <input
            id="roomName"
            name="name"
            type="text"
            className="input"
            maxLength={40}
            placeholder="Europe trip, Imagica, Flat rent…"
            required
          />
        </div>

        {state.error && <p className="err">{state.error}</p>}

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
