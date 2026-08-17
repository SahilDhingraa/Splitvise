import { createClient } from './supabase/server';
import type { Participant, Payment, Room } from './types';

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
