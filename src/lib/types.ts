export type Room = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  isOwner: boolean;
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
