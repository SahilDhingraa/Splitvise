'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addPayment, type ActionResult } from '@/app/actions';
import { PaymentFields } from './PaymentFields';
import { Icon } from './Icon';
import { Modal } from './Modal';
import type { Participant } from '@/lib/types';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
      {pending ? 'Recording…' : 'Record payment'}
    </button>
  );
}

// "Record payment": a card beside the ledger on a wide screen, and a sheet
// behind the floating button on narrower ones (see RecordPaymentFab).
export function PaymentForm({
  roomId,
  participants,
  isLocked,
  idPrefix = 'new-payment',
  onRecorded,
}: {
  roomId: string;
  participants: Participant[];
  isLocked: boolean;
  idPrefix?: string;
  onRecorded?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  // Bumped on success to remount the fields. form.reset() clears the inputs but
  // not the kind and split toggles, which are React state inside PaymentFields.
  const [resetKey, setResetKey] = useState(0);

  // Clear the form only once the insert succeeded, so a rejected payment is still
  // there to correct.
  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await addPayment(roomId, prev, formData);
    if (!result.error) {
      formRef.current?.reset();
      setResetKey((key) => key + 1);
      onRecorded?.();
    }
    return result;
  }, EMPTY);

  const heading = (
    <div className="card-h">
      <div className="card-t">
        <Icon name="card" />
        Record payment
      </div>
    </div>
  );

  // No form at all while the room is locked, rather than a disabled one: there is
  // nothing here to come back to, and a filled-in form that cannot be submitted
  // reads as a bug.
  if (isLocked) {
    return (
      <>
        {heading}
        <div className="empty small">
          <Icon name="lock" />
          This room is locked. No new payments can be recorded until the room owner unlocks it.
        </div>
      </>
    );
  }

  return (
    <>
      {heading}
      <form action={formAction} ref={formRef} className="form">
        <PaymentFields key={resetKey} idPrefix={idPrefix} participants={participants} />

        {state.error && <p className="err">{state.error}</p>}
        <SubmitButton />
      </form>
    </>
  );
}

// The floating "Record" button on phones and tablets, where the side card is
// hidden. Opens the same form as a sheet and closes it once the payment is in.
export function RecordPaymentFab({
  roomId,
  participants,
}: {
  roomId: string;
  participants: Participant[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" className="fab" onClick={() => setIsOpen(true)}>
        <Icon name="plus" />
        Record
      </button>
      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <PaymentForm
            roomId={roomId}
            participants={participants}
            isLocked={false}
            idPrefix="sheet-payment"
            onRecorded={() => setIsOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
