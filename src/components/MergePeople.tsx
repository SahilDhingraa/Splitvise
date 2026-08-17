'use client';

import { useState, useTransition } from 'react';
import { mergeParticipants } from '@/app/actions';
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
    <div className="merge-panel">
      <h3>👥 Merge two entries for one person</h3>
      <p className="form-hint left">
        Someone added twice — once as a placeholder, once by invite link, or under two spellings.
        Keep one entry and fold the other into it.
      </p>

      <div className="form-group">
        <label htmlFor="mergeDuplicate">1. Which entry is the duplicate?</label>
        <select
          id="mergeDuplicate"
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
        <div className="form-group">
          <label htmlFor="mergeKeep">2. Merge {duplicate.name} into</label>
          <select
            id="mergeKeep"
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
        <div className="merge-summary">
          <p>
            <strong>✅ Kept:</strong> {keep.name} — {describe(keep)}
          </p>
          <p>
            <strong>🗑️ Removed:</strong> {duplicate.name} — {describe(duplicate)}
          </p>
          <p className="form-hint left">
            {moving === 0
              ? `${duplicate.name} is not part of any payment, so only the entry itself goes.`
              : `${moving} payment${moving === 1 ? '' : 's'} involving ${duplicate.name} ${
                  moving === 1 ? 'moves' : 'move'
                } to ${keep.name}. Where a payment was split between both entries, it counts once from now on, so everyone's share of it changes.`}
          </p>

          {/* The one consequence that reaches outside this room's ledger. */}
          {duplicate.userId && keep.userId && (
            <p className="merge-warning">
              ⚠️ {duplicate.name} is a signed-in member. Merging removes their access to this room.
              Their SplitVise login is not deleted — they can rejoin with the invite link.
            </p>
          )}
          {duplicate.userId && !keep.userId && (
            <p className="form-hint left">
              {keep.name} takes over {duplicate.name}&apos;s login, so nobody loses access to the
              room.
            </p>
          )}

          <p className="form-hint left">This cannot be undone.</p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="row-actions">
        <button type="button" onClick={submit} disabled={!duplicate || !keep || isPending}>
          {isPending ? 'Merging…' : 'Merge people'}
        </button>
        <button type="button" className="secondary-btn" onClick={onDone} disabled={isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// What kind of entry this is, in the same words the roster uses.
function describe(person: Participant): string {
  if (person.userId) return 'signed-in member';
  return person.email ? `invited (${person.email})` : 'placeholder, no login';
}
