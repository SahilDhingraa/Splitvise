export type Room = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  isOwner: boolean;
  // A locked room is read-only: no payments, no roster changes, for anyone.
  // People can still join it and still leave it. Only the owner may lock.
  lockedAt: string | null;
  isLocked: boolean;
  // How many people are in the room. RLS scopes the count the same way it
  // scopes the roster, so a member always sees the full number.
  participantCount: number;
  createdAt: string;
};

// Someone in a room. Either a linked account (userId set) or a placeholder that
// may still be claimed by whoever owns `email`.
export type Participant = {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  isYou: boolean;
};

export type Payment = {
  id: string;
  payerId: string;
  payer: string;
  createdBy: string;
  amount: number;
  description: string;
  splitAmong: string[];
  splitAmongIds: string[];
  createdAt: string;
  // null until someone changes the payment. Stamped by the database, so it is
  // there whether the edit came through the app or not.
  editedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
};

export type Balance = {
  participant: string;
  amount: number;
};

export type Settlement = {
  from: string;
  to: string;
  amount: number;
};
