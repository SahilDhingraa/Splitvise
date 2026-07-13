-- Migration 01 — let people rename themselves, and fix leaving a room.
--
-- Run this ONLY if you already applied supabase-schema.sql. A fresh run of the
-- full schema already includes this policy; this file exists so you do not have
-- to re-run (and therefore drop) your existing tables.
--
-- Safe to run twice.
--
-- Two things this fixes:
--   1. Members could not rename themselves -- the only UPDATE policy on
--      participants was owner-only.
--   2. Leaving a room was broken for the same reason. leaveRoom() detaches the
--      account by setting user_id = null, which is an UPDATE, so a member could
--      never actually leave.

drop policy if exists "members update their own participant" on public.participants;

create policy "members update their own participant" on public.participants
    for update to authenticated
    using (user_id = (select auth.uid()))
    -- The `or user_id is null` case is what permits leaving.
    with check (user_id = (select auth.uid()) or user_id is null);
