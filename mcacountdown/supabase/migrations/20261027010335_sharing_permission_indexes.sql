-- Reuse the pre-existing creator and collaborator indexes after comparing definitions.
create index if not exists idx_countdown_creator on public.countdown (creator);
create index if not exists idx_countdown_collaborator_ids on public.countdown using gin (collaborator_ids);
drop index if exists public.countdown_creator_idx;
drop index if exists public.countdown_editors_idx;

-- View events are accessible only through the narrowly scoped functions.
create policy "No direct view event access" on private.countdown_view_days
    for all to anon, authenticated using (false) with check (false);

alter policy "Users can create their own profile" on public.users to authenticated with check ((select auth.uid()) = id);
alter policy "Users can update their own profile" on public.users to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "Users can view their own profile" on public.users to authenticated using ((select auth.uid()) = id);
alter policy "Users can delete their own profile" on public.users to authenticated using ((select auth.uid()) = id);
