'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { setRoomLock } from '@/app/actions';
import { MergePeople } from './MergePeople';
import { RoomMenu } from './RoomMenu';
import { LocalTime } from './LocalTime';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useDialog } from './Dialog';
import type { Participant, Payment, Room } from '@/lib/types';

export function RoomHeader({
  room,
  inviteUrl,
  participants,
  payments,
}: {
  room: Room;
  inviteUrl: string;
  participants: Participant[];
  payments: Payment[];
}) {
  const [isInviting, setIsInviting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { confirm, alert, dialog } = useDialog();

  async function handleUnlock() {
    const ok = await confirm({
      title: `Unlock ${room.name}?`,
      message: 'Everyone will be able to record and remove payments again.',
      confirmLabel: 'Unlock room',
      icon: 'unlock',
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await setRoomLock(room.id, false);
      if (result.error) await alert({ title: 'Could not unlock the room', message: result.error });
    });
  }

  // Owner-only and unavailable while the room is locked, mirroring what
  // merge_participants will refuse. It needs two people to work with.
  const canMerge = room.isOwner && participants.length > 1;

  return (
    <>
      <header className="room-head">
        <div>
          <Link href="/" className="back">
            <Icon name="chevL" />
            All rooms
          </Link>
          <div className="title-row">
            <h1 className="room-title">{room.name}</h1>
            {room.isLocked && (
              <span className="pill pill-warn">
                <Icon name="lock" />
                Locked
              </span>
            )}
            <span className={`pill${room.isOwner ? ' pill-accent' : ''}`}>
              {room.isOwner ? 'You own this room' : 'You are a member'}
            </span>
          </div>
          <div className="sub">
            <span>
              {participants.length} {participants.length === 1 ? 'person' : 'people'}
            </span>
            ·
            <span>
              {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
            </span>
            ·
            <span>
              code <span className="mono">{room.inviteCode}</span>
            </span>
          </div>
        </div>

        <div className="head-acts">
          <button type="button" className="btn btn-ghost" onClick={() => setIsInviting(true)}>
            <Icon name="link" />
            Invite
          </button>
          <RoomMenu
            room={room}
            buttonClassName="btn btn-ghost btn-icon"
            onMerge={canMerge ? () => setIsMerging(true) : undefined}
          />
        </div>
      </header>

      {room.isLocked && (
        <div className="banner">
          <Icon name="lock" />
          <div className="grow">
            <b>
              Locked{room.lockedAt && <> since <LocalTime iso={room.lockedAt} /></>}.
            </b>{' '}
            Payments and people cannot be added, changed or removed
            {room.isOwner ? ' until you unlock it.' : '. Only the room owner can unlock it.'}
          </div>
          {room.isOwner && (
            <button
              type="button"
              className="btn btn-sm btn-soft"
              onClick={handleUnlock}
              disabled={isPending}
            >
              <Icon name="unlock" />
              Unlock
            </button>
          )}
        </div>
      )}

      {dialog}

      {isInviting && (
        <Modal onClose={() => setIsInviting(false)}>
          <InviteDialog room={room} inviteUrl={inviteUrl} onDone={() => setIsInviting(false)} />
        </Modal>
      )}

      {isMerging && !room.isLocked && (
        <Modal onClose={() => setIsMerging(false)}>
          <MergePeople
            roomId={room.id}
            participants={participants}
            payments={payments}
            onDone={() => setIsMerging(false)}
          />
        </Modal>
      )}
    </>
  );
}

// The merge entry point on the People tab, alongside the one in the ⋯ menu.
export function MergePeopleButton({
  room,
  participants,
  payments,
}: {
  room: Room;
  participants: Participant[];
  payments: Payment[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setIsOpen(true)}
        disabled={room.isLocked || participants.length < 2}
      >
        <Icon name="merge" />
        Merge duplicates
      </button>
      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <MergePeople
            roomId={room.id}
            participants={participants}
            payments={payments}
            onDone={() => setIsOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

function InviteDialog({
  room,
  inviteUrl,
  onDone,
}: {
  room: Room;
  inviteUrl: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  async function copy(text: string, what: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // The link is on screen and selectable, so this is not worth an alert.
      setCopied(null);
    }
  }

  return (
    <>
      <h3 className="modal-t">Invite people to {room.name}</h3>
      <p className="modal-p">Anyone with this link can join the room and see its payments.</p>

      <div className="invite-box">
        <code>{inviteUrl}</code>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => copy(inviteUrl, 'link')}>
          <Icon name={copied === 'link' ? 'check' : 'copy'} />
          {copied === 'link' ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <div className="code-big">{room.inviteCode}</div>
      <p className="hint" style={{ textAlign: 'center' }}>
        Or share just the code. They enter it under <b>Join with code</b>.
      </p>

      <div className="modal-acts">
        <button type="button" className="btn btn-ghost" onClick={() => copy(room.inviteCode, 'code')}>
          <Icon name={copied === 'code' ? 'check' : 'copy'} />
          {copied === 'code' ? 'Copied!' : 'Copy code'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}
