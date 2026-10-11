-- A completed appointment and its human-written report are business evidence.
-- The lifecycle trigger makes terminal rows immutable, but DELETE does not run
-- UPDATE triggers. Remove direct deletion from authenticated members so a
-- client cannot erase the report and bypass the terminal-state guarantee.
--
-- GDPR erasure still starts from `contacts`: a director may delete a contact,
-- and PostgreSQL's existing foreign-key cascade removes its appointments in
-- the same database operation.

drop policy if exists "appointments_delete_members" on public.appointments;
revoke delete on table public.appointments from authenticated;
