'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addPayment, type ActionResult } from '@/app/actions';
import { PaymentFields } from './PaymentFields';
import type { Participant } from '@/lib/types';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Recording…' : 'Record Payment'}
    </button>
  );
}

export function PaymentForm({
  roomId,
  participants,
  isLocked,
}: {
  roomId: string;
  participants: Participant[];
  isLocked: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  // Bumped on success to remount the fields. form.reset() clears the inputs but
  // not the "specific people" toggle, which is React state inside PaymentFields.
  const [resetKey, setResetKey] = useState(0);

  // Clear the form only once the insert succeeded, so a rejected payment is still
  // there to correct.
  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await addPayment(roomId, prev, formData);
    if (!result.error) {
      formRef.current?.reset();
      setResetKey((key) => key + 1);
    }
    return result;
  }, EMPTY);

  // No form at all while the room is locked, rather than a disabled one: there is
  // nothing here to come back to, and a filled-in form that cannot be submitted
  // reads as a bug.
  if (isLocked) {
    return (
      <div className="section">
        <h2>💳 Record Payment</h2>
        <p className="empty-state">
          🔒 This room is locked. No new payments can be recorded until the room owner unlocks it.
        </p>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>💳 Record Payment</h2>

      <form action={formAction} ref={formRef}>
        <PaymentFields key={resetKey} idPrefix="new-payment" participants={participants} />

        {state.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}
