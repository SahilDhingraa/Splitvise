'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { addParticipant, type ActionResult } from '@/app/actions';
import { ParticipantRow, type RemovalImpact } from './ParticipantRow';
import { MergePeopleButton } from './RoomHeader';
import { Icon } from './Icon';
import type { Participant, Payment, Room } from '@/lib/types';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      <Icon name="plus" />
      {pending ? 'Adding…' : 'Add person'}
    </button>
  );
}

export function ParticipantManager({
  room,
  participants,
  payments,
}: {
  room: Room;
  participants: Participant[];
  payments: Payment[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { id: roomId, isOwner, isLocked } = room;

  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await addParticipant(roomId, prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, EMPTY);

  // What removing each person would do to the payments, so the confirm can say
  // exactly that. Mirrors removeParticipant and the database cascade: payments
  // they paid are deleted; payments split only with them (including cash given
  // to them) are deleted; shared payments are re-split among everyone else.
  function removalImpact(participantId: string): RemovalImpact {
    const impact = { paid: 0, toThem: 0, reSplit: 0 };
    for (const payment of payments) {
      if (payment.payerId === participantId) impact.paid += 1;
      else if (payment.splitAmongIds.includes(participantId)) {
        if (payment.splitAmongIds.length === 1) impact.toThem += 1;
        else impact.reSplit += 1;
      }
    }
    return impact;
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-h">
          <div className="card-t">
            <Icon name="users" />
            People <span className="count">{participants.length}</span>
          </div>
          {isOwner && (
            <MergePeopleButton room={room} participants={participants} payments={payments} />
          )}
        </div>

        {participants.map((participant) => (
          <ParticipantRow
            key={participant.id}
            roomId={roomId}
            participant={participant}
            isRoomOwner={participant.userId !== null && participant.userId === room.ownerId}
            removalImpact={removalImpact(participant.id)}
            isOwner={isOwner}
            isLocked={isLocked}
          />
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t">
            <Icon name="plus" />
            Add someone without an account
          </div>
        </div>

        {isLocked ? (
          <div className="empty small">
            <Icon name="lock" />
            This room is locked. The list of people is frozen until the room owner unlocks it.
          </div>
        ) : isOwner ? (
          <form action={formAction} ref={formRef} className="form">
            <div className="two">
              <div className="field">
                <label className="label" htmlFor="participantName">
                  Name
                </label>
                <input
                  id="participantName"
                  name="name"
                  type="text"
                  className="input"
                  maxLength={40}
                  placeholder="e.g. Chaitnya"
                  required
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="participantEmail">
                  Email <span className="opt">optional</span>
                </label>
                <input
                  id="participantEmail"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <p className="hint">
              If you add an email, that person takes over this entry — and everything already
              recorded against it — as soon as they sign up or join.
            </p>

            {state.error && <p className="err">{state.error}</p>}
            <div className="form-acts">
              <SubmitButton />
            </div>
          </form>
        ) : (
          <p className="hint">Only the room owner can add or remove people. You can rename yourself.</p>
        )}
      </div>
    </div>
  );
}
