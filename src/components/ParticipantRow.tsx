'use client';

import { useState, useTransition } from 'react';
import { removeParticipant, renameParticipant } from '@/app/actions';
import type { Participant } from '@/lib/types';

export function ParticipantRow({
  roomId,
  participant,
  involvedPayments,
  isOwner,
  isLocked,
}: {
  roomId: string;
  participant: Participant;
  involvedPayments: number;
  isOwner: boolean;
  isLocked: boolean;
}) {
  // Mirrors the RLS policies: the owner may rename anyone, and anyone may rename
  // themselves. Removal stays owner-only -- it cascade-deletes that person's
  // payments, which is a very different act from leaving a room, and a member
  // reaching for "Remove" on themselves almost certainly means "Leave".
  //
  // A locked room takes both away from everyone, the owner included.
  const canRename = !isLocked && (isOwner || participant.isYou);
  const canRemove = !isLocked && isOwner;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(participant.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const name = draft.trim();
    if (!name || name === participant.name) {
      setIsEditing(false);
      setDraft(participant.name);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await renameParticipant(roomId, participant.id, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIsEditing(false);
    });
  }

  function cancel() {
    setDraft(participant.name);
    setError(null);
    setIsEditing(false);
  }

  function handleRemove() {
    const warning =
      involvedPayments > 0
        ? `Remove ${participant.name}? This also deletes ${involvedPayments} payment(s) they were part of.`
        : `Remove ${participant.name}?`;

    if (!window.confirm(warning)) return;

    startTransition(async () => {
      const result = await removeParticipant(roomId, participant.id);
      if (result.error) window.alert(result.error);
    });
  }

  if (isEditing) {
    return (
      <li className="user-item editing">
        <div className="rename-row">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') cancel();
            }}
            autoFocus
            aria-label={`Rename ${participant.name}`}
          />
          <button type="button" onClick={save} disabled={isPending} className="inline-btn">
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancel} className="secondary-btn inline-btn">
            Cancel
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </li>
    );
  }

  return (
    <li className="user-item">
      <span>
        👤 {participant.name}
        {participant.isYou && <span className="room-badge">You</span>}
        {!participant.userId && (
          <span className="room-badge muted-badge">
            {participant.email ? 'Invited' : 'Placeholder'}
          </span>
        )}
      </span>

      <span className="row-actions">
        {canRename && (
          <button
            type="button"
            className="secondary-btn inline-btn"
            onClick={() => setIsEditing(true)}
            disabled={isPending}
          >
            Rename
          </button>
        )}
        {canRemove && (
          <button type="button" className="remove-btn" onClick={handleRemove} disabled={isPending}>
            Remove
          </button>
        )}
      </span>
    </li>
  );
}
