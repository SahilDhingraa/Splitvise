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
    .select('id, name, invite_code, owner_id, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    ownerId: row.owner_id,
    isOwner: row.owner_id === userId,
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
    .select('id, name, invite_code, owner_id, created_at')
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
    createdAt: data.created_at,
  };
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

export async function getPayments(roomId: string, isOwner: boolean): Promise<Payment[]> {
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
        created_by,
        payer:payer_id ( id, name ),
        payment_splits ( participant:participant_id ( id, name ) )
      `,
    )
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    amount: string | number;
    description: string;
    created_at: string;
    created_by: string;
    payer: { id: string; name: string };
    payment_splits: { participant: { id: string; name: string } }[];
  };

  // PostgREST's inferred types do not narrow embedded joins to single objects,
  // so assert the shape and map it into our own Payment type.
  return (data as unknown as Row[]).map((row) => ({
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
    // Mirrors the delete policy. This only hides the button; the database is
    // still the thing that enforces it.
    canDelete: row.created_by === userId || isOwner,
  }));
}

export async function getRoomPreview(code: string): Promise<string | null> {
  const supabase = await createClient();

  // A SECURITY DEFINER function, because a non-member has no SELECT access to
  // the room yet. It leaks only the name, and only to someone holding the code.
  const { data, error } = await supabase.rpc('room_preview', { code });

  if (error) throw new Error(error.message);
  return data?.[0]?.name ?? null;
}
