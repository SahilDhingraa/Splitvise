-- SplitVise database schema — the complete, only SQL you need.
--
-- Setting up a new Supabase project:
--   1. Dashboard -> SQL Editor -> New query -> paste this entire file -> Run.
--   2. Authentication -> Providers -> Email: leave "Confirm email" ON. This is
--      not cosmetic; see the note on handle_new_user below.
--   3. Authentication -> URL Configuration: set the Site URL, and add a redirect
--      URL ending in /auth/callback for every origin you use -- production,
--      http://localhost:3000, and any LAN or tunnel origin listed in
--      next.config.ts if you test on a phone.
--   4. Settings -> API: copy the Project URL and the anon key into
--      NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Those two
--      values are the only place the project is named -- no code changes.
--      They are inlined at build time, so a rebuild is required, not a restart.
--
-- Running it on a database that already has an older version of this schema
-- resets it: the RESET block below drops every object this file owns, and the
-- rest of the file rebuilds them from scratch. You always end up with exactly
-- the schema described here, whatever state you started from. A run that fails
-- halfway can simply be run again.
--
-- THE RESET IS DESTRUCTIVE. It deletes every room, participant, payment and
-- split. Signed-up accounts survive (auth.users is not touched), and their
-- profiles are rebuilt by the backfill at the end of this file. If you ever need
-- to run this against a database whose data you want to keep, comment out the
-- RESET block first -- everything after it is safe on a live database.
--
-- Model
-- -----
-- A ROOM ("Europe trip") is owned by one account and holds a set of PARTICIPANTS.
-- A participant is either:
--   * a LINKED ACCOUNT  (user_id is set)  -- someone who joined via the invite link
--   * a PLACEHOLDER     (user_id is null) -- just a name, optionally with an email
--
-- A placeholder with an email can later be CLAIMED: when that person signs up or
-- joins the room, their account is attached to the existing participant row, so
-- every payment already recorded against that name becomes theirs. This is why
-- payments point at participants and never at accounts directly -- the payment
-- history survives a placeholder becoming a real user.

create extension if not exists "pgcrypto";

-- RESET =======================================================================
-- Drops everything this file owns, so the rebuild below starts from nothing.
-- No-op on a brand new project. On an existing one it DELETES ALL APP DATA.
-- Comment out this whole block to run the file without losing data.
--
-- Accounts are deliberately left alone: dropping auth.users would delete the
-- logins too. To wipe those as well, add `delete from auth.users;` at the end of
-- this block -- but note that cascades through profiles, rooms and payments.

-- The trigger must go before the function it calls.
drop trigger if exists on_auth_user_created on auth.users;

-- Child tables first. `cascade` also removes the RLS policies on each table.
drop table if exists public.payment_splits cascade;
drop table if exists public.payments cascade;
drop table if exists public.participants cascade;
drop table if exists public.rooms cascade;
drop table if exists public.profiles cascade;

-- The original single-ledger schema, before rooms existed. Only present on very
-- old databases; harmless everywhere else.
drop table if exists public.users cascade;

-- Argument types are part of a function's identity, so they cannot be omitted.
drop function if exists public.handle_new_user() cascade;
drop function if exists public.join_room(text) cascade;
drop function if exists public.room_preview(text) cascade;
drop function if exists public.is_room_member(uuid) cascade;
drop function if exists public.is_room_owner(uuid) cascade;
drop function if exists public.generate_invite_code() cascade;
-- END RESET ===================================================================

-- Profiles ------------------------------------------------------------------
-- auth.users is not readable from the client, so mirror the bits we display.
create table if not exists public.profiles (
    id           uuid primary key references auth.users (id) on delete cascade,
    email        text not null,
    display_name text not null,
    created_at   timestamptz not null default now()
);

-- Rooms ---------------------------------------------------------------------
-- Short, unambiguous invite codes: no 0/O/1/I to confuse anyone reading one aloud.
create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
    select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1),
        ''
    )
    from generate_series(1, 8);
$$;

create table if not exists public.rooms (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name        text not null check (length(trim(name)) > 0),
    invite_code text not null unique default public.generate_invite_code(),
    created_at  timestamptz not null default now()
);

-- Participants --------------------------------------------------------------
create table if not exists public.participants (
    id         uuid primary key default gen_random_uuid(),
    room_id    uuid not null references public.rooms (id) on delete cascade,

    -- null => placeholder. on delete set null, so deleting an account leaves the
    -- participant (and its payment history) behind as a placeholder rather than
    -- silently rewriting everyone else's balances.
    user_id    uuid references auth.users (id) on delete set null,

    name       text not null check (length(trim(name)) > 0),
    email      text,
    created_at timestamptz not null default now(),

    unique (room_id, name)
);

-- One participant row per account per room. Partial, because many placeholders
-- may share a null user_id.
create unique index if not exists participants_room_user_idx
    on public.participants (room_id, user_id)
    where user_id is not null;

-- Speeds up the claim lookup below.
create index if not exists participants_email_idx
    on public.participants (lower(email))
    where user_id is null and email is not null;

-- Payments ------------------------------------------------------------------
create table if not exists public.payments (
    id          uuid primary key default gen_random_uuid(),
    room_id     uuid not null references public.rooms (id) on delete cascade,

    -- Who fronted the money. May be a placeholder.
    payer_id    uuid not null references public.participants (id) on delete cascade,

    -- Which account typed it in. Used to decide who may delete it.
    created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,

    amount      numeric(12, 2) not null check (amount > 0),
    description text not null check (length(trim(description)) > 0),
    created_at  timestamptz not null default now()
);

create table if not exists public.payment_splits (
    payment_id     uuid not null references public.payments (id) on delete cascade,
    participant_id uuid not null references public.participants (id) on delete cascade,
    primary key (payment_id, participant_id)
);

create index if not exists rooms_owner_idx on public.rooms (owner_id);
create index if not exists participants_room_idx on public.participants (room_id);
create index if not exists participants_user_idx on public.participants (user_id);
create index if not exists payments_room_idx on public.payments (room_id);
create index if not exists payments_payer_idx on public.payments (payer_id);
create index if not exists payment_splits_participant_idx on public.payment_splits (participant_id);

-- Membership helpers --------------------------------------------------------
-- These are SECURITY DEFINER on purpose. A policy on `participants` that asked
-- "is the caller a participant of this room?" by selecting from `participants`
-- would re-trigger that same policy and recurse forever (Postgres raises
-- "infinite recursion detected in policy"). Running the check as the definer
-- bypasses RLS for this one narrow lookup, which breaks the cycle.
--
-- `set search_path = public` is not decoration: without it, a SECURITY DEFINER
-- function can be hijacked by a caller who puts a malicious table earlier on
-- their own search_path.

create or replace function public.is_room_member(room uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from participants
        where room_id = room and user_id = (select auth.uid())
    );
$$;

create or replace function public.is_room_owner(room uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from rooms
        where id = room and owner_id = (select auth.uid())
    );
$$;

-- Signup: create the profile, and claim any placeholders left for this email ---
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;

    -- Attach this account to any unclaimed placeholder someone left for their
    -- email. The payments already recorded against that name come with it.
    --
    -- This trusts the email on the account, so it is only as strong as email
    -- confirmation. Leave "Confirm email" ON in Supabase Auth, or anyone could
    -- claim a placeholder by signing up with someone else's address.
    update public.participants p
    set user_id = new.id
    where p.user_id is null
      and lower(p.email) = lower(new.email)
      -- Skip rooms where this account is somehow already a participant, which
      -- would violate participants_room_user_idx.
      and not exists (
          select 1 from public.participants existing
          where existing.room_id = p.room_id and existing.user_id = new.id
      );

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Joining a room ------------------------------------------------------------
-- Chicken-and-egg: to join a room you must read it by invite code, but you are
-- not a member yet, so no SELECT policy will show it to you. These two functions
-- are the only sanctioned way in. Being SECURITY DEFINER, they see the room; they
-- expose nothing but the name, and only to someone holding a valid code.

create or replace function public.room_preview(code text)
returns table (name text)
language sql
security definer
stable
set search_path = public
as $$
    select r.name from rooms r where r.invite_code = upper(trim(code));
$$;

create or replace function public.join_room(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    target_room   uuid;
    caller        uuid := (select auth.uid());
    caller_email  text;
    caller_name   text;
    claimed       uuid;
begin
    if caller is null then
        raise exception 'You must be signed in to join a room.';
    end if;

    select id into target_room from rooms where invite_code = upper(trim(code));
    if target_room is null then
        raise exception 'That invite code is not valid.';
    end if;

    -- Already in? Idempotent, so a double-clicked invite link is harmless.
    select id into claimed
    from participants
    where room_id = target_room and user_id = caller;

    if claimed is not null then
        return target_room;
    end if;

    select email, display_name into caller_email, caller_name
    from profiles where id = caller;

    -- Prefer claiming the placeholder someone already created for this email,
    -- so the payments recorded against that name follow the account.
    update participants
    set user_id = caller
    where room_id = target_room
      and user_id is null
      and lower(email) = lower(caller_email)
    returning id into claimed;

    if claimed is null then
        insert into participants (room_id, user_id, name, email)
        values (
            target_room,
            caller,
            -- The (room_id, name) unique constraint would reject a duplicate name,
            -- so disambiguate with the email rather than failing the join.
            case
                when exists (select 1 from participants where room_id = target_room and name = caller_name)
                    then caller_name || ' (' || caller_email || ')'
                else caller_name
            end,
            caller_email
        );
    end if;

    return target_room;
end;
$$;

-- Row Level Security --------------------------------------------------------
-- Postgres has no `create policy if not exists`, so every policy below is
-- dropped first. Redundant after a RESET, which already took the policies down
-- with their tables -- but it is what lets the file still run cleanly when the
-- RESET block is commented out.

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.payments enable row level security;
alter table public.payment_splits enable row level security;

-- profiles: yours only. Other people's names are read from `participants`, so
-- there is never a reason to expose the profiles table across accounts.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
    for select to authenticated using (id = (select auth.uid()));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
    for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Normally handle_new_user creates the profile, and it is SECURITY DEFINER so it
-- does not need a policy. But an account that signed up BEFORE that trigger
-- existed has no profile row at all, and an UPDATE against a missing row silently
-- changes nothing. The app upserts instead, which needs this.
drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
    for insert to authenticated with check (id = (select auth.uid()));

-- rooms: visible to members and the owner. Only the owner may rename or delete.
drop policy if exists "members read rooms" on public.rooms;
create policy "members read rooms" on public.rooms
    for select to authenticated
    using (owner_id = (select auth.uid()) or public.is_room_member(id));

drop policy if exists "create own rooms" on public.rooms;
create policy "create own rooms" on public.rooms
    for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "owner updates room" on public.rooms;
create policy "owner updates room" on public.rooms
    for update to authenticated
    using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner deletes room" on public.rooms;
create policy "owner deletes room" on public.rooms
    for delete to authenticated using (owner_id = (select auth.uid()));

-- participants: any member sees the roster. Only the owner edits it -- otherwise
-- a member could add or rename people and shift what everyone owes.
drop policy if exists "members read participants" on public.participants;
create policy "members read participants" on public.participants
    for select to authenticated using (public.is_room_member(room_id));

drop policy if exists "owner adds participants" on public.participants;
create policy "owner adds participants" on public.participants
    for insert to authenticated with check (public.is_room_owner(room_id));

drop policy if exists "owner updates participants" on public.participants;
create policy "owner updates participants" on public.participants
    for update to authenticated
    using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));

-- You may edit your own row: rename yourself, or detach your account to leave the
-- room. The WITH CHECK permits `user_id = null` precisely so leaving works --
-- leaveRoom() nulls the account out but keeps the participant, so the payments
-- you recorded stay in the room's history and everyone's balances still add up.
-- Without the null case, a member could never leave.
drop policy if exists "members update their own participant" on public.participants;
create policy "members update their own participant" on public.participants
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) or user_id is null);

-- The owner can remove anyone; a member can remove themselves (leave the room).
drop policy if exists "owner removes participants, members leave" on public.participants;
create policy "owner removes participants, members leave" on public.participants
    for delete to authenticated
    using (public.is_room_owner(room_id) or user_id = (select auth.uid()));

-- payments: any member of the room may read and record. Deleting is restricted to
-- whoever recorded it, or the room owner.
drop policy if exists "members read payments" on public.payments;
create policy "members read payments" on public.payments
    for select to authenticated using (public.is_room_member(room_id));

drop policy if exists "members add payments" on public.payments;
create policy "members add payments" on public.payments
    for insert to authenticated
    with check (
        public.is_room_member(room_id)
        and created_by = (select auth.uid())
        -- The payer must belong to THIS room. Without this, a member could name a
        -- participant from an unrelated room as the payer.
        and exists (
            select 1 from participants p
            where p.id = payer_id and p.room_id = payments.room_id
        )
    );

drop policy if exists "creator or owner deletes payments" on public.payments;
create policy "creator or owner deletes payments" on public.payments
    for delete to authenticated
    using (created_by = (select auth.uid()) or public.is_room_owner(room_id));

-- payment_splits: ownership is inherited from the parent payment.
drop policy if exists "members read splits" on public.payment_splits;
create policy "members read splits" on public.payment_splits
    for select to authenticated
    using (
        exists (
            select 1 from payments p
            where p.id = payment_id and public.is_room_member(p.room_id)
        )
    );

drop policy if exists "creator adds splits" on public.payment_splits;
create policy "creator adds splits" on public.payment_splits
    for insert to authenticated
    with check (
        exists (
            select 1 from payments p
            where p.id = payment_id and p.created_by = (select auth.uid())
        )
        -- ...and the person being split with must be in the same room as the payment.
        and exists (
            select 1
            from payments p
            join participants pa on pa.id = participant_id
            where p.id = payment_id and pa.room_id = p.room_id
        )
    );

drop policy if exists "creator or owner removes splits" on public.payment_splits;
create policy "creator or owner removes splits" on public.payment_splits
    for delete to authenticated
    using (
        exists (
            select 1 from payments p
            where p.id = payment_id
              and (p.created_by = (select auth.uid()) or public.is_room_owner(p.room_id))
        )
    );

-- Profile backfill ----------------------------------------------------------
-- A no-op on a brand new project, where no accounts exist yet. It matters in two
-- cases: an account that signed up before the on_auth_user_created trigger
-- existed, and a region move where auth.users was restored from a dump with the
-- trigger disabled. Both leave accounts with no row in public.profiles, and the
-- app then falls back to showing the local part of the email as a display name.
--
-- Uses the display name captured at signup where there is one, otherwise the
-- email's local part as a placeholder the user can change in Account settings.
insert into public.profiles (id, email, display_name)
select
    u.id,
    u.email,
    coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
        split_part(u.email, '@', 1)
    )
from auth.users u
where u.email is not null
on conflict (id) do nothing;
