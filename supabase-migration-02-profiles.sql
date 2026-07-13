-- Migration 02 — backfill missing profiles, and let the app create one.
--
-- Run this if you signed up BEFORE applying supabase-schema.sql. The
-- handle_new_user trigger did not exist yet, so it never fired for your account
-- and you have no row in public.profiles. Two consequences:
--
--   * The app falls back to showing the local part of your email as your name.
--   * Saving a new display name silently did nothing -- it is an UPDATE, and
--     there was no row to update.
--
-- Safe to run twice.

-- 1. Let an account create its own profile row, so the app can upsert.
--    (handle_new_user is SECURITY DEFINER and bypasses RLS, so it never needed
--    an INSERT policy -- which is why one did not exist.)
drop policy if exists "create own profile" on public.profiles;

create policy "create own profile" on public.profiles
    for insert to authenticated with check (id = (select auth.uid()));

-- 2. Backfill a profile for every existing account that lacks one. Uses the
--    display name from signup if there was one, otherwise the email's local part
--    as a placeholder you can change in the app.
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
