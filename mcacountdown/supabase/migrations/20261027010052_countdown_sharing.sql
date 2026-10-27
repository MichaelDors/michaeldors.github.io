-- Visibility: 0 private, 1 unlisted (link access), 2 public (discoverable).
-- Existing countdowns remain unlisted. No countdown is published by this migration.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter table public.countdown add column revision bigint not null default 0;
update public.countdown set visibility = 1 where visibility is null;
alter table public.countdown alter column visibility set not null;
alter table public.countdown add constraint countdown_visibility_valid check (visibility in (0, 1, 2));
comment on column public.countdown.visibility is '0=private, 1=unlisted, 2=public';
create index if not exists countdown_creator_idx on public.countdown (creator);
create index countdown_public_created_idx on public.countdown (created_at desc, id) where visibility = 2;
create index countdown_editors_idx on public.countdown using gin (collaborator_ids);

-- Keep the existing public_profiles API, backed only by intentionally public fields.
create table public.profile_directory (
    id uuid primary key references public.users(id) on delete cascade,
    name text not null,
    has_plus boolean,
    avatar_url text,
    official boolean
);
alter table public.profile_directory enable row level security;
revoke all on public.profile_directory from public, anon, authenticated;
grant select on public.profile_directory to anon, authenticated;
create policy "Public profile directory" on public.profile_directory for select to anon, authenticated using (true);
insert into public.profile_directory select id, coalesce(nullif(name, ''), 'Minutehand user'), has_plus, avatar_url, official from public.users;
create or replace view public.public_profiles with (security_invoker = true) as
    select id, name, has_plus, avatar_url, official from public.profile_directory;
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

create function private.sync_public_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
    insert into public.profile_directory (id, name, has_plus, avatar_url, official)
    values (new.id, coalesce(nullif(new.name, ''), 'Minutehand user'), new.has_plus, new.avatar_url, new.official)
    on conflict (id) do update set name = excluded.name, has_plus = excluded.has_plus,
        avatar_url = excluded.avatar_url, official = excluded.official;
    return new;
end;
$$;
revoke all on function private.sync_public_profile() from public, anon, authenticated;
create trigger sync_public_profile after insert or update on public.users for each row execute function private.sync_public_profile();
drop policy if exists "Anyone can read user rows for public view" on public.users;
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
grant insert (id, name, email, avatar_url, settings), update (id, name, email, avatar_url, settings) on public.users to authenticated;

create table public.user_follows (
    follower_id uuid not null references public.users(id) on delete cascade,
    following_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (follower_id, following_id),
    check (follower_id <> following_id)
);
create index user_follows_following_idx on public.user_follows (following_id, follower_id);
alter table public.user_follows enable row level security;
revoke all on public.user_follows from public, anon, authenticated;
grant select, delete on public.user_follows to authenticated;
grant insert (follower_id, following_id) on public.user_follows to authenticated;
create policy "Read own follow relationships" on public.user_follows for select to authenticated
    using ((select auth.uid()) in (follower_id, following_id));
create policy "Follow as yourself" on public.user_follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "Unfollow as yourself" on public.user_follows for delete to authenticated using (follower_id = (select auth.uid()));

create table public.countdown_invitations (
    id uuid primary key default gen_random_uuid(),
    countdown_id text not null references public.countdown(id) on delete cascade,
    inviter_id uuid not null references public.users(id) on delete cascade,
    invitee_id uuid not null references public.users(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '14 days'),
    unique (countdown_id, invitee_id),
    check (inviter_id <> invitee_id)
);
create index countdown_invitations_recipient_idx on public.countdown_invitations (invitee_id, status, created_at desc);
create index countdown_invitations_inviter_idx on public.countdown_invitations (inviter_id);
alter table public.countdown_invitations enable row level security;
revoke all on public.countdown_invitations from public, anon, authenticated;
grant select on public.countdown_invitations to authenticated;
create policy "Read own invitations" on public.countdown_invitations for select to authenticated
    using ((select auth.uid()) in (inviter_id, invitee_id));

-- Replace recursive/overbroad legacy countdown policies with a single rule per operation.
do $$ declare p record; begin
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'countdown' loop
        execute format('drop policy %I on public.countdown', p.policyname);
    end loop;
end $$;
revoke all on public.countdown from public, anon, authenticated;
grant select on public.countdown to anon, authenticated;
grant insert (id, data, creator, collaborator_ids, visibility, clonedfrom), update (data, visibility), delete on public.countdown to authenticated;
-- Unlisted rows retain direct-link compatibility with older clients; all discovery APIs
-- below explicitly require visibility=2. Private rows always require membership.
create policy "Read accessible countdowns" on public.countdown for select to anon, authenticated
    using (visibility in (1, 2) or creator = (select auth.uid()) or (select auth.uid())::text = any(collaborator_ids));
create policy "Create own countdowns" on public.countdown for insert to authenticated
    with check (creator = (select auth.uid()) and coalesce(cardinality(collaborator_ids), 0) = 0);
create policy "Edit owned or shared countdowns" on public.countdown for update to authenticated
    using (creator = (select auth.uid()) or (select auth.uid())::text = any(collaborator_ids))
    with check (creator = (select auth.uid()) or (select auth.uid())::text = any(collaborator_ids));
create policy "Delete own countdowns" on public.countdown for delete to authenticated using (creator = (select auth.uid()));

create function private.guard_countdown_update() returns trigger language plpgsql set search_path = '' as $$
begin
    if current_user in ('anon', 'authenticated') then
        if new.visibility is distinct from old.visibility and old.creator is distinct from auth.uid() then
            raise exception 'Only the owner can change visibility' using errcode = '42501';
        end if;
    end if;
    if new.data is distinct from old.data then new.revision := old.revision + 1; end if;
    return new;
end;
$$;
revoke all on function private.guard_countdown_update() from public, anon, authenticated;
create trigger guard_countdown_update before update on public.countdown for each row execute function private.guard_countdown_update();

-- Remove the old path that added editors without mutual follows or acceptance.
revoke all on function public.add_collaborator(text, text) from public, anon, authenticated;
revoke all on function public.remove_collaborator(text, text) from public, anon, authenticated;
alter function public.add_collaborator(text, text) set search_path = public, pg_temp;
alter function public.remove_collaborator(text, text) set search_path = public, pg_temp;

create function private.invite_countdown_editor(p_countdown_id text, p_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.countdown; invitation_id uuid; caller uuid := auth.uid();
begin
    if caller is null then raise exception 'Sign in to invite an editor' using errcode = '42501'; end if;
    select * into c from public.countdown where id = p_countdown_id for update;
    if c.creator is distinct from caller then raise exception 'Only the owner can invite editors' using errcode = '42501'; end if;
    if p_user_id = caller or not exists (select 1 from public.user_follows where follower_id = caller and following_id = p_user_id)
        or not exists (select 1 from public.user_follows where follower_id = p_user_id and following_id = caller) then
        raise exception 'You must follow each other before inviting an editor' using errcode = '42501';
    end if;
    if p_user_id::text = any(coalesce(c.collaborator_ids, array[]::text[])) then raise exception 'This person is already an editor'; end if;
    if coalesce(cardinality(c.collaborator_ids), 0) + (select count(*) from public.countdown_invitations
        where countdown_id = p_countdown_id and status = 'pending' and expires_at > now() and invitee_id <> p_user_id) >= 5 then
        raise exception 'This countdown already has five editors or pending invitations';
    end if;
    insert into public.countdown_invitations (countdown_id, inviter_id, invitee_id)
    values (p_countdown_id, caller, p_user_id)
    on conflict (countdown_id, invitee_id) do update set status = 'pending', created_at = now(), expires_at = now() + interval '14 days'
    returning id into invitation_id;
    return invitation_id;
end;
$$;

create function private.respond_countdown_invitation(p_invitation_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare invitation public.countdown_invitations; c public.countdown; caller uuid := auth.uid(); target_id text;
begin
    if caller is null then raise exception 'Sign in to respond' using errcode = '42501'; end if;
    select countdown_id into target_id from public.countdown_invitations where id = p_invitation_id and invitee_id = caller;
    -- All membership mutations lock the countdown first, so accept/revoke cannot race.
    select * into c from public.countdown where id = target_id for update;
    select * into invitation from public.countdown_invitations where id = p_invitation_id and invitee_id = caller for update;
    if invitation.id is null or invitation.status <> 'pending' or invitation.expires_at <= now() then
        raise exception 'This invitation is no longer available' using errcode = '42501';
    end if;
    if p_accept then
        if c.creator is distinct from invitation.inviter_id
            or not exists (select 1 from public.user_follows where follower_id = caller and following_id = c.creator)
            or not exists (select 1 from public.user_follows where follower_id = c.creator and following_id = caller) then
            raise exception 'You must still follow each other to accept' using errcode = '42501';
        end if;
        if coalesce(cardinality(c.collaborator_ids), 0) >= 5 then raise exception 'This countdown already has five editors'; end if;
        update public.countdown set collaborator_ids = array_append(coalesce(collaborator_ids, array[]::text[]), caller::text)
            where id = target_id and not (caller::text = any(coalesce(collaborator_ids, array[]::text[])));
    end if;
    update public.countdown_invitations set status = case when p_accept then 'accepted' else 'declined' end where id = p_invitation_id;
end;
$$;

create function private.remove_countdown_editor(p_countdown_id text, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.countdown; caller uuid := auth.uid();
begin
    if caller is null then raise exception 'Sign in to manage editors' using errcode = '42501'; end if;
    select * into c from public.countdown where id = p_countdown_id for update;
    if c.id is null or (c.creator is distinct from caller and not (p_user_id = caller and caller::text = any(coalesce(c.collaborator_ids, array[]::text[])))) then
        raise exception 'Only the owner can remove other editors' using errcode = '42501';
    end if;
    update public.countdown set collaborator_ids = array_remove(collaborator_ids, p_user_id::text) where id = p_countdown_id;
    update public.countdown_invitations set status = 'revoked' where countdown_id = p_countdown_id and invitee_id = p_user_id;
end;
$$;

-- Public wrappers are invokers. Privileged helpers live outside the exposed API,
-- check the caller explicitly, and never accept ownership or status from the client.
create function public.invite_countdown_editor(p_countdown_id text, p_user_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.invite_countdown_editor(p_countdown_id, p_user_id); $$;
create function public.respond_countdown_invitation(p_invitation_id uuid, p_accept boolean) returns void
language sql security invoker set search_path = '' as $$ select private.respond_countdown_invitation(p_invitation_id, p_accept); $$;
create function public.remove_countdown_editor(p_countdown_id text, p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.remove_countdown_editor(p_countdown_id, p_user_id); $$;
revoke all on function private.invite_countdown_editor(text, uuid), private.respond_countdown_invitation(uuid, boolean), private.remove_countdown_editor(text, uuid),
    public.invite_countdown_editor(text, uuid), public.respond_countdown_invitation(uuid, boolean), public.remove_countdown_editor(text, uuid) from public, anon, authenticated;
grant execute on function private.invite_countdown_editor(text, uuid), private.respond_countdown_invitation(uuid, boolean), private.remove_countdown_editor(text, uuid),
    public.invite_countdown_editor(text, uuid), public.respond_countdown_invitation(uuid, boolean), public.remove_countdown_editor(text, uuid) to authenticated;

-- A pending invitation reveals the event title to its recipient, never the private
-- timer payload or owner-provided details. No viewing/editing access until acceptance.
create function private.countdown_inbox() returns table (id uuid, countdown_id text, inviter_id uuid, inviter_name text, title text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
    select i.id, i.countdown_id, i.inviter_id, p.name,
        coalesce(substring(c.data from '(?:[?&])title=([^&]*)'), 'Countdown'), i.expires_at
    from public.countdown_invitations i join public.countdown c on c.id = i.countdown_id
    join public.profile_directory p on p.id = i.inviter_id
    where auth.uid() is not null and i.invitee_id = auth.uid() and i.status = 'pending' and i.expires_at > now()
    order by i.created_at desc limit 100;
$$;
create function public.countdown_inbox() returns table (id uuid, countdown_id text, inviter_id uuid, inviter_name text, title text, expires_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.countdown_inbox(); $$;
revoke all on function private.countdown_inbox(), public.countdown_inbox() from public, anon, authenticated;
grant execute on function private.countdown_inbox(), public.countdown_inbox() to authenticated;

create function private.profile_stats(p_user_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
        'followers', (select count(*) from public.user_follows where following_id = p_user_id),
        'following', (select count(*) from public.user_follows where follower_id = p_user_id),
        'is_following', exists (select 1 from public.user_follows where follower_id = auth.uid() and following_id = p_user_id),
        'follows_you', exists (select 1 from public.user_follows where follower_id = p_user_id and following_id = auth.uid())
    );
$$;
create function public.profile_stats(p_user_id uuid) returns jsonb language sql stable security invoker set search_path = '' as $$ select private.profile_stats(p_user_id); $$;
revoke all on function private.profile_stats(uuid), public.profile_stats(uuid) from public, anon, authenticated;
grant execute on function private.profile_stats(uuid), public.profile_stats(uuid) to anon, authenticated;

create table private.countdown_view_days (
    countdown_id text not null references public.countdown(id) on delete cascade,
    viewer_key text not null,
    view_day date not null,
    viewed_at timestamptz not null default now(),
    primary key (countdown_id, viewer_key, view_day)
);
alter table private.countdown_view_days enable row level security;
revoke all on private.countdown_view_days from public, anon, authenticated;
create index countdown_view_days_recent_idx on private.countdown_view_days (viewed_at desc, countdown_id);
create function private.record_countdown_view(p_countdown_id text, p_visitor_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare c public.countdown; visitor text; ip text; inserted integer;
begin
    select * into c from public.countdown where id = p_countdown_id;
    if c.id is null or c.visibility <> 2 or c.creator = auth.uid() or auth.uid()::text = any(coalesce(c.collaborator_ids, array[]::text[])) then return false; end if;
    ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ''), ',', 1);
    visitor := case when auth.uid() is not null then 'user:' || auth.uid()::text
        when ip <> '' then 'ip:' || ip else 'visitor:' || p_visitor_id::text end;
    if visitor is null then return false; end if;
    -- One view per visitor per UTC day, using server time; no raw IP addresses retained.
    insert into private.countdown_view_days (countdown_id, viewer_key, view_day)
        values (c.id, md5(visitor), (now() at time zone 'utc')::date) on conflict do nothing;
    get diagnostics inserted = row_count;
    delete from private.countdown_view_days where viewed_at < now() - interval '8 days';
    return inserted = 1;
end;
$$;
create function public.record_countdown_view(p_countdown_id text, p_visitor_id uuid) returns boolean
language sql security invoker set search_path = '' as $$ select private.record_countdown_view(p_countdown_id, p_visitor_id); $$;
create function private.popular_countdowns(p_limit integer default 12) returns table (id text, data text, creator uuid, name text, recent_views bigint)
language sql stable security definer set search_path = '' as $$
    select c.id, c.data, c.creator, p.name, count(v.countdown_id) as recent_views
    from public.countdown c join public.profile_directory p on p.id = c.creator
    join private.countdown_view_days v on v.countdown_id = c.id and v.viewed_at >= now() - interval '7 days'
    where c.visibility = 2
    group by c.id, p.name order by recent_views desc, max(v.viewed_at) desc, c.id
    limit greatest(1, least(coalesce(p_limit, 12), 48));
$$;
create function public.popular_countdowns(p_limit integer default 12) returns table (id text, data text, creator uuid, name text, recent_views bigint)
language sql stable security invoker set search_path = '' as $$ select * from private.popular_countdowns(p_limit); $$;
revoke all on function private.record_countdown_view(text, uuid), public.record_countdown_view(text, uuid), private.popular_countdowns(integer), public.popular_countdowns(integer) from public, anon, authenticated;
grant execute on function private.record_countdown_view(text, uuid), public.record_countdown_view(text, uuid), private.popular_countdowns(integer), public.popular_countdowns(integer) to anon, authenticated;
