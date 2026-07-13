'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Every mutation lives here. These run on the server but under the caller's JWT,
// so RLS is still the enforcement layer -- the checks below are for good error
// messages, not for security.

export type ActionResult = { error: string | null };

const ok: ActionResult = { error: null };
const fail = (error: string): ActionResult => ({ error });

// Postgres error codes we translate into something a human can act on.
const UNIQUE_VIOLATION = '23505';

// Rooms ---------------------------------------------------------------------

export async function createRoom(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return fail('Give the room a name.');

  const supabase = await createClient();

  const { data: room, error } = await supabase
    .from('rooms')
    .insert({ name })
    .select('id')
    .single();

  if (error) return fail(error.message);

  // The creator is not a participant by virtue of owning the room -- add them, or
  // they could not be a payer in their own room.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user!.id)
    .single();

  const { error: participantError } = await supabase.from('participants').insert({
    room_id: room.id,
    user_id: user!.id,
    name: profile?.display_name ?? user!.email!.split('@')[0],
    email: profile?.email ?? user!.email,
  });

  if (participantError) {
    // A room with no participants is unusable, so do not leave one behind.
    await supabase.from('rooms').delete().eq('id', room.id);
    return fail(participantError.message);
  }

  revalidatePath('/');
  redirect(`/rooms/${room.id}`);
}

export async function renameRoom(roomId: string, rawName: string): Promise<ActionResult> {
  const name = rawName.trim();
  if (!name) return fail('Enter a room name.');

  const supabase = await createClient();

  // Owner-only, per RLS. Room names are not unique, so there is no conflict to
  // handle -- two of your rooms may both be called "Goa".
  const { error } = await supabase.from('rooms').update({ name }).eq('id', roomId);
  if (error) return fail(error.message);

  revalidatePath('/');
  revalidatePath(`/rooms/${roomId}`);
  return ok;
}

export async function deleteRoom(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Participants, payments and splits all cascade. Only the owner passes RLS here.
  const { error } = await supabase.from('rooms').delete().eq('id', roomId);
  if (error) return fail(error.message);

  revalidatePath('/');
  redirect('/');
}

export async function leaveRoom(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Detach the account but keep the participant row, so the payments recorded
  // against this person stay in the room's history and the balances still add up.
  const { error } = await supabase
    .from('participants')
    .update({ user_id: null })
    .eq('room_id', roomId)
    .eq('user_id', user!.id);

  if (error) return fail(error.message);

  revalidatePath('/');
  redirect('/');
}

export async function joinRoomWithCode(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = String(formData.get('code') ?? '').trim();
  if (!raw) return fail('Enter an invite code.');

  // People paste the whole invite link as often as they type the code, so accept
  // both: take the last path segment if it looks like a URL.
  const code = raw.includes('/') ? raw.replace(/\/+$/, '').split('/').pop()! : raw;

  return joinRoom(code);
}

export async function joinRoom(code: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: roomId, error } = await supabase.rpc('join_room', { code });
  if (error) return fail(error.message);

  revalidatePath('/');
  redirect(`/rooms/${roomId}`);
}

// Participants --------------------------------------------------------------

export async function addParticipant(
  roomId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();

  if (!name) return fail('Enter a name.');

  const supabase = await createClient();

  // A placeholder: no account attached yet. If an email is given, whoever owns it
  // claims this row (and its payment history) when they sign up or join.
  const { error } = await supabase.from('participants').insert({
    room_id: roomId,
    name,
    email: email || null,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail(`"${name}" is already in this room.`);
    return fail(error.message);
  }

  revalidatePath(`/rooms/${roomId}`);
  return ok;
}

export async function renameParticipant(
  roomId: string,
  participantId: string,
  rawName: string,
): Promise<ActionResult> {
  const name = rawName.trim();
  if (!name) return fail('Enter a name.');

  const supabase = await createClient();

  // RLS decides who may do this: the room owner for anyone, or a member for
  // their own row. Renaming does not touch payments -- they reference the
  // participant by id -- so history and balances follow the new name.
  const { error } = await supabase
    .from('participants')
    .update({ name })
    .eq('id', participantId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail(`"${name}" is already taken in this room.`);
    return fail(error.message);
  }

  revalidatePath(`/rooms/${roomId}`);
  return ok;
}

export async function removeParticipant(roomId: string, participantId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('participants').delete().eq('id', participantId);
  if (error) return fail(error.message);

  revalidatePath(`/rooms/${roomId}`);
  return ok;
}

// Account -------------------------------------------------------------------

export async function updateDisplayName(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get('displayName') ?? '').trim();
  if (!name) return fail('Enter a display name.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Upsert, not update. An account that signed up before the handle_new_user
  // trigger existed has no profile row, and an UPDATE matching nothing succeeds
  // while changing nothing -- the save would appear to work and silently not.
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user!.id, email: user!.email!, display_name: name });

  if (error) return fail(error.message);

  // Changing your profile name should also change how you appear in the rooms
  // you are already in -- otherwise the setting looks like it did nothing.
  //
  // Room by room, because names are unique per room: if someone in one room is
  // already called "Sahil", that single room keeps your old name rather than the
  // whole rename failing.
  const { data: mine } = await supabase
    .from('participants')
    .select('id, room_id')
    .eq('user_id', user!.id);

  const conflicts: string[] = [];

  for (const participant of mine ?? []) {
    const { error: renameError } = await supabase
      .from('participants')
      .update({ name })
      .eq('id', participant.id);

    if (renameError?.code === UNIQUE_VIOLATION) {
      const { data: room } = await supabase
        .from('rooms')
        .select('name')
        .eq('id', participant.room_id)
        .maybeSingle();

      conflicts.push(room?.name ?? 'a room');
    } else if (renameError) {
      return fail(renameError.message);
    }

    revalidatePath(`/rooms/${participant.room_id}`);
  }

  revalidatePath('/', 'layout');

  if (conflicts.length > 0) {
    return fail(
      `Saved, but "${name}" is already taken in ${conflicts.join(', ')} — you keep your old name there.`,
    );
  }

  return ok;
}

// Payments ------------------------------------------------------------------

export async function addPayment(
  roomId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const payerId = String(formData.get('payerId') ?? '');
  const amount = Number(formData.get('amount'));
  const description = String(formData.get('description') ?? '').trim();
  const splitType = String(formData.get('splitType') ?? 'all');
  const selectedIds = formData.getAll('splitAmong').map(String);

  if (!payerId) return fail('Select who paid.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter a valid amount.');
  if (!description) return fail('Enter a description.');

  const supabase = await createClient();

  let splitAmongIds = selectedIds;
  if (splitType === 'all') {
    const { data: participants, error } = await supabase
      .from('participants')
      .select('id')
      .eq('room_id', roomId);

    if (error) return fail(error.message);
    splitAmongIds = (participants ?? []).map((participant) => participant.id);
  }

  if (splitAmongIds.length === 0) return fail('Select at least one person to split among.');

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({ room_id: roomId, payer_id: payerId, amount, description })
    .select('id')
    .single();

  if (paymentError) return fail(paymentError.message);

  const { error: splitsError } = await supabase.from('payment_splits').insert(
    splitAmongIds.map((participantId) => ({
      payment_id: payment.id,
      participant_id: participantId,
    })),
  );

  if (splitsError) {
    // PostgREST has no multi-statement transactions, so undo the payment by hand.
    // A payment split among nobody would divide by zero when balances are computed.
    await supabase.from('payments').delete().eq('id', payment.id);
    return fail(splitsError.message);
  }

  revalidatePath(`/rooms/${roomId}`);
  return ok;
}

export async function removePayment(roomId: string, paymentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // RLS allows this only for the payment's creator or the room's owner.
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) return fail(error.message);

  revalidatePath(`/rooms/${roomId}`);
  return ok;
}
