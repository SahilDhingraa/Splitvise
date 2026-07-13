'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { addParticipant, type ActionResult } from '@/app/actions';
import { ParticipantRow } from './ParticipantRow';
import type { Participant, Payment } from '@/lib/types';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Adding…' : 'Add Person'}
    </button>
  );
}

export function ParticipantManager({
  roomId,
  participants,
  payments,
  isOwner,
}: {
  roomId: string;
  participants: Participant[];
  payments: Payment[];
  isOwner: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await addParticipant(roomId, prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, EMPTY);

  // How many payments each person is tangled up in, so removing them can warn
  // about what it is really about to delete.
  function involvedPayments(participantId: string) {
    return payments.filter(
      (payment) =>
        payment.payerId === participantId || payment.splitAmongIds.includes(participantId),
    ).length;
  }

  return (
    <div className="section">
      <h2>👥 People</h2>

      <ul className="user-list">
        {participants.map((participant) => (
          <ParticipantRow
            key={participant.id}
            roomId={roomId}
            participant={participant}
            involvedPayments={involvedPayments(participant.id)}
            isOwner={isOwner}
          />
        ))}
      </ul>

      {isOwner ? (
        <form action={formAction} ref={formRef} className="add-person-form">
          <div className="form-group">
            <label htmlFor="participantName">Add someone without an account</label>
            <input id="participantName" name="name" type="text" placeholder="Name" required />
          </div>

          <div className="form-group">
            <label htmlFor="participantEmail">Their email (optional)</label>
            <input id="participantEmail" name="email" type="email" placeholder="name@example.com" />
            <p className="form-hint left">
              If you add an email, that person takes over this entry — and everything already
              recorded against it — as soon as they sign up or join.
            </p>
          </div>

          {state.error && <p className="form-error">{state.error}</p>}
          <SubmitButton />
        </form>
      ) : (
        <p className="form-hint left">
          Only the room owner can add or remove people. You can rename yourself.
        </p>
      )}
    </div>
  );
}
