'use client';

import { useState, useTransition } from 'react';
import { mergeParticipants } from '@/app/actions';
import { Icon } from './Icon';
import type { Participant, Payment } from '@/lib/types';

// Folding two entries for one person into one. Deliberately a three-step panel
// rather than a button on each person: this rewrites the history of every payment
// either of them touched and cannot be undone, so the last thing before the
// button is a plain statement of who survives and what moves.
export function MergePeople({
  roomId,
  participants,
  payments,
  onDone,
}: {
  roomId: string;
  participants: Participant[];
  payments: Payment[];
  onDone: () => void;
}) {
  // The duplicate: the entry that goes away.
  const [duplicateId, setDuplicateId] = useState('');
  // The one that survives, with its name and login.
  const [keepId, setKeepId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const duplicate = participants.find((person) => person.id === duplicateId);
  const keep = participants.find((person) => person.id === keepId);

  // What the merge actually moves, counted from the payments already on screen.
  const moving = duplicate
    ? payments.filter(
        (payment) =>
          payment.payerId === duplicate.id || payment.splitAmongIds.includes(duplicate.id),
      ).length
    : 0;

  function submit() {
    if (!duplicate || !keep) return;

    setError(null);
    startTransition(async () => {
      const result = await mergeParticipants(roomId, keep.id, duplicate.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <>
      <h3 className="modal-t">Merge two entries for one person</h3>
      <p className="modal-p">
        Someone added twice — once as a placeholder, once by invite link, or under two spellings.
        Keep one entry and fold the other into it.
      </p>

      <div className="form">
        <div className="field">
          <label className="label" htmlFor="mergeDuplicate">
            1. Which entry is the duplicate?
          </label>
          <select
            id="mergeDuplicate"
            className="select"
            value={duplicateId}
            onChange={(event) => {
              setDuplicateId(event.target.value);
              // The two selects must not land on the same person, and the choice
              // below was made about a different duplicate anyway.
              setKeepId('');
              setError(null);
            }}
          >
            <option value="">Select the entry to remove</option>
            {participants.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.isYou ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </div>

        {duplicate && (
          <div className="field">
            <label className="label" htmlFor="mergeKeep">
              2. Merge {duplicate.name} into
            </label>
            <select
              id="mergeKeep"
              className="select"
              value={keepId}
              onChange={(event) => {
                setKeepId(event.target.value);
                setError(null);
              }}
            >
              <option value="">Select the entry to keep</option>
              {participants
                .filter((person) => person.id !== duplicate.id)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.isYou ? ' (you)' : ''}
                  </option>
                ))}
            </select>
          </div>
        )}

        {duplicate && keep && (
          <div className="preview">
            <div className="pv-row">
              <Icon name="check" />
              <span>
                <b>Kept:</b> {keep.name} · {describe(keep)}
              </span>
            </div>
            <div className="pv-row">
              <Icon name="trash" />
              <span>
                <b>Removed:</b> {duplicate.name} · {describe(duplicate)}
              </span>
            </div>
            <p>
              {moving === 0
                ? `${duplicate.name} is not part of any payment, so only the entry itself goes.`
                : `${moving} payment${moving === 1 ? '' : 's'} involving ${duplicate.name} ${
                    moving === 1 ? 'moves' : 'move'
                  } to ${keep.name}. Where a payment was split between both entries, it counts once from now on, so everyone's share of it changes.`}
            </p>

            {/* The one consequence that reaches outside this room's ledger. */}
            {duplicate.userId && keep.userId && (
              <div className="warn-box">
                <Icon name="alert" />
                <span>
                  {duplicate.name} is a signed-in member. Merging removes their access to this
                  room. Their SplitVise login is not deleted — they can rejoin with the invite link.
                </span>
              </div>
            )}
            {duplicate.userId && !keep.userId && (
              <p className="hint">
                {keep.name} takes over {duplicate.name}&apos;s login, so nobody loses access to the
                room.
              </p>
            )}

            <p className="hint">This cannot be undone.</p>
          </div>
        )}

        {error && <p className="err">{error}</p>}
      </div>

      <div className="modal-acts">
        <button type="button" className="btn btn-ghost" onClick={onDone} disabled={isPending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={!duplicate || !keep || isPending}
        >
          <Icon name="merge" />
          {isPending ? 'Merging…' : 'Merge people'}
        </button>
      </div>
    </>
  );
}

// What kind of entry this is, in the same words the roster uses.
function describe(person: Participant): string {
  if (person.userId) return 'signed-in member';
  return person.email ? `invited (${person.email})` : 'placeholder, no login';
}
