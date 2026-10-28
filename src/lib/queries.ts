import { createClient } from './supabase/server';
import type { Participant, Payment, PaymentKind, Room } from './types';

// Reads. RLS scopes every row to rooms the caller belongs to, so none of these
// filter by user by hand -- the database does it.

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getDisplayName(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user!.id)
    .maybeSingle();

  // Fall back to the email's local part if the profile row is somehow missing,
  // so the settings field is never blank.
  return data?.display_name ?? user!.email!.split('@')[0];
}

export async function getRooms(): Promise<Room[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('rooms')
    // `participants(count)` is an aggregate on the join, so the roster itself
    // never crosses the wire -- the list only needs the number.
    .select('id, name, invite_code, owner_id, locked_at, created_at, participants(count)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    ownerId: row.owner_id,
    isOwner: row.owner_id === userId,
    lockedAt: row.locked_at,
    isLocked: row.locked_at !== null,
    participantCount: countOf(row.participants),
    createdAt: row.created_at,
  }));
}

// Returns null when the room does not exist OR the caller is not a member --
// RLS makes those two cases indistinguishable, which is exactly what we want:
// a non-member cannot probe for the existence of a room.
export async function getRoom(roomId: string): Promise<Room | null> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, invite_code, owner_id, locked_at, created_at, participants(count)')
    .eq('id', roomId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    inviteCode: data.invite_code,
    ownerId: data.owner_id,
    isOwner: data.owner_id === userId,
    lockedAt: data.locked_at,
    isLocked: data.locked_at !== null,
    participantCount: countOf(data.participants),
    createdAt: data.created_at,
  };
}

// PostgREST returns an aggregate on an embedded table as `[{ count: n }]`, and
// omits the row entirely when the count is zero.
function countOf(embedded: { count: number }[] | null): number {
  return embedded?.[0]?.count ?? 0;
}

export async function getParticipants(roomId: string): Promise<Participant[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('participants')
    .select('id, user_id, name, email')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    isYou: row.user_id !== null && row.user_id === userId,
  }));
}

export async function getPayments(room: Room): Promise<Payment[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('payments')
    .select(
      `
        id,
        kind,
        amount,
        description,
        created_at,
        edited_at,
        created_by,
        payer:payer_id ( id, name ),
        payment_splits ( participant:participant_id ( id, name ) )
      `,
    )
    .eq('room_id', room.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    kind: PaymentKind;
    amount: string | number;
    description: string;
    created_at: string;
    edited_at: string | null;
    created_by: string;
    payer: { id: string; name: string };
    payment_splits: { participant: { id: string; name: string } }[];
  };

  // PostgREST's inferred types do not narrow embedded joins to single objects,
  // so assert the shape and map it into our own Payment type.
  return (data as unknown as Row[]).map((row) => {
    // Editing and deleting answer to the same policy, so they are the same
    // question here. This only hides buttons; the database is still the thing
    // that enforces it.
    const mine = !room.isLocked && (row.created_by === userId || room.isOwner);

    return {
      id: row.id,
      kind: row.kind,
      payerId: row.payer.id,
      payer: row.payer.name,
      createdBy: row.created_by,
      // numeric(12,2) arrives as a string; parse before any arithmetic.
      amount: Number(row.amount),
      description: row.description,
      splitAmong: row.payment_splits.map((split) => split.participant.name),
      splitAmongIds: row.payment_splits.map((split) => split.participant.id),
      createdAt: row.created_at,
      editedAt: row.edited_at,
      canEdit: mine,
      canDelete: mine,
    };
  });
}

export async function getRoomPreview(code: string): Promise<string | null> {
  const supabase = await createClient();

  // A SECURITY DEFINER function, because a non-member has no SELECT access to
  // the room yet. It leaks only the name, and only to someone holding the code.
  const { data, error } = await supabase.rpc('room_preview', { code });

  if (error) throw new Error(error.message);
  return data?.[0]?.name ?? null;
}

// Per-room figures for the home page: what each room has spent, where you stand
// in it, who is in it, and when anything last happened. Two queries for every
// room at once, rather than one per room -- RLS already limits both to rooms you
// are in.
export async function getRoomSummaries(): Promise<Map<string, RoomSummary>> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  const [participantsResult, paymentsResult] = await Promise.all([
    supabase
      .from('participants')
      .select('id, room_id, user_id, name')
      .order('created_at', { ascending: true }),
    supabase
      .from('payments')
      .select('room_id, kind, amount, payer_id, created_at, payment_splits ( participant_id )'),
  ]);

  if (participantsResult.error) throw new Error(participantsResult.error.message);
  if (paymentsResult.error) throw new Error(paymentsResult.error.message);

  const summaries = new Map<string, RoomSummary>();
  const myParticipant = new Map<string, string>();
  const nets = new Map<string, number>();

  const summary = (roomId: string): RoomSummary => {
    let found = summaries.get(roomId);
    if (!found) {
      found = { totalSpent: 0, yourBalance: 0, paymentCount: 0, lastActivity: null, members: [] };
      summaries.set(roomId, found);
    }
    return found;
  };

  for (const row of participantsResult.data ?? []) {
    summary(row.room_id).members.push(row.name);
    if (row.user_id !== null && row.user_id === userId) myParticipant.set(row.room_id, row.id);
  }

  type Row = {
    room_id: string;
    kind: PaymentKind;
    amount: string | number;
    payer_id: string;
    created_at: string;
    payment_splits: { participant_id: string }[];
  };

  for (const row of (paymentsResult.data ?? []) as unknown as Row[]) {
    const entry = summary(row.room_id);
    const amount = Number(row.amount);
    const splitIds = row.payment_splits.map((split) => split.participant_id);

    entry.paymentCount += 1;
    if (!entry.lastActivity || row.created_at > entry.lastActivity) {
      entry.lastActivity = row.created_at;
    }

    // Same rules as lib/balances: a payment split among nobody is ignored, and
    // cash handed to one other person is not spending.
    if (splitIds.length === 0) continue;
    const transfer =
      row.kind === 'transfer' || (splitIds.length === 1 && splitIds[0] !== row.payer_id);
    if (!transfer) entry.totalSpent += amount;

    const share = amount / splitIds.length;
    nets.set(row.payer_id, (nets.get(row.payer_id) ?? 0) + amount);
    splitIds.forEach((id) => nets.set(id, (nets.get(id) ?? 0) - share));
  }

  myParticipant.forEach((participantId, roomId) => {
    summary(roomId).yourBalance = nets.get(participantId) ?? 0;
  });

  return summaries;
}

export type RoomSummary = {
  totalSpent: number;
  // Positive: the room owes you. Negative: you owe the room.
  yourBalance: number;
  paymentCount: number;
  lastActivity: string | null;
  members: string[];
};
