'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addPayment, type ActionResult } from '@/app/actions';
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
}: {
  roomId: string;
  participants: Participant[];
}) {
  const [splitType, setSplitType] = useState<'all' | 'specific'>('all');
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form only once the insert succeeded, so a rejected payment is still
  // there to correct.
  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await addPayment(roomId, prev, formData);
    if (!result.error) {
      formRef.current?.reset();
      setSplitType('all');
    }
    return result;
  }, EMPTY);

  // Default the payer to you, since that is the overwhelmingly common case.
  const you = participants.find((participant) => participant.isYou);

  return (
    <div className="section">
      <h2>💳 Record Payment</h2>

      <form action={formAction} ref={formRef}>
        <div className="form-group">
          <label htmlFor="payerSelect">Who Paid:</label>
          <select id="payerSelect" name="payerId" defaultValue={you?.id ?? ''} required>
            <option value="" disabled>
              Select payer
            </option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
                {participant.isYou ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="paymentAmount">Amount:</label>
          <input
            id="paymentAmount"
            name="amount"
            type="number"
            placeholder="0.00"
            step="0.01"
            min="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="paymentDescription">Description:</label>
          <input
            id="paymentDescription"
            name="description"
            type="text"
            placeholder="What was this payment for?"
            required
          />
        </div>

        <div className="form-group">
          <label>Split Among:</label>

          <div className="radio-row">
            <input
              type="radio"
              id="splitAll"
              name="splitType"
              value="all"
              checked={splitType === 'all'}
              onChange={() => setSplitType('all')}
            />
            <label htmlFor="splitAll" className="inline-label">
              Everyone in the room
            </label>
          </div>

          <div className="radio-row">
            <input
              type="radio"
              id="splitSpecific"
              name="splitType"
              value="specific"
              checked={splitType === 'specific'}
              onChange={() => setSplitType('specific')}
            />
            <label htmlFor="splitSpecific" className="inline-label">
              Specific people
            </label>
          </div>

          {splitType === 'specific' && (
            <div className="checkbox-group">
              {participants.map((participant) => (
                <label key={participant.id} className="checkbox-item">
                  <input type="checkbox" name="splitAmong" value={participant.id} />
                  <span>{participant.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {state.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}
