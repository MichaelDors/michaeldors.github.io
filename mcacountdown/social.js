/* Shared profile, discovery and collaboration UI. Permissions are enforced in Postgres. */
(() => {
    'use strict';
    const client = window.supabaseClient;
    if (!client || new URLSearchParams(location.search).has('cardmode')) return;
    const byId = id => document.getElementById(id);
    const visibilityNames = ['Private', 'Unlisted', 'Public'];
    const visibilityHelp = [
        'Only you and accepted editors can open this countdown. A link does not grant access.',
        'Anyone with the link can view. Hidden from profiles and popular countdowns.',
        'Anyone can view. Appears on your profile and can appear in popular countdowns.'
    ];
    let user = null, generation = 0, timerGeneration = 0, timerRow = null, profileOffset = 0, profileId = null;
    let viewTimer = null, viewCounted = false, activeUserId;
    const element = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    };
    const link = (label, href, className) => { const node = element('a', label, className); node.href = href; return node; };
    const profileURL = id => 'profile.html?id=' + encodeURIComponent(id);
    const countdownURL = id => 'betatimer.html?id=' + encodeURIComponent(id);
    const title = row => {
        const source = String(row.data || '').replace(/^"|"$/g, '');
        return new URLSearchParams(source.replace(/^.*?\?/, '')).get('title') || 'Untitled countdown';
    };
    const decode = value => { try { return decodeURIComponent(value.replace(/\+/g, ' ')); } catch { return value; } };
    async function result(request) { const response = await request; if (response.error) throw response.error; return response.data; }
    const rpc = (name, args) => result(client.rpc(name, args));
    function status(node, message, error = false) {
        if (!node) return;
        node.textContent = message;
        node.classList.toggle('social-error', error);
    }
    function button(label, action, secondary = false) {
        const node = element('button', label, 'social-button' + (secondary ? ' social-secondary' : ''));
        node.type = 'button';
        node.addEventListener('click', async () => {
            if (node.disabled) return;
            node.disabled = true;
            try { await action(node); }
            catch (error) {
                const output = node.closest('[data-social-status]')?.querySelector('[role="status"]') || byId('social-status');
                status(output, error.message || 'Something went wrong. Please try again.', true);
            } finally { if (node.isConnected) node.disabled = false; }
        });
        return node;
    }
    async function copy(value, node) {
        try { await navigator.clipboard.writeText(value); node.textContent = 'Copied'; }
        catch { throw new Error('Could not copy. Select and copy the link from the address bar.'); }
    }
    function previewCard(row) {
        const name = title(row);
        const card = element('article', undefined, 'card profile-countdown');
        const frame = element('iframe');
        frame.src = countdownURL(row.id) + '&cardmode=true';
        frame.title = name + ' preview';
        frame.loading = 'lazy';
        frame.tabIndex = -1;
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        const content = element('div', undefined, 'card-content');
        content.append(element('h3', name));
        // A native link covers the card for keyboard navigation and open-in-new-tab.
        const open = link('', countdownURL(row.id), 'profile-countdown-open');
        open.setAttribute('aria-label', 'Open countdown: ' + name);
        card.append(frame, content, open);
        return card;
    }
    function renderCards(container, rows, { popular = false, append = false, previews = false, empty = 'No public countdowns yet.' } = {}) {
        if (!append) container.replaceChildren();
        if (!rows.length && !append) { container.append(element('p', empty, 'social-empty')); return; }
        for (const row of rows) {
            if (previews) { container.append(previewCard(row)); continue; }
            const card = element('article', undefined, 'social-countdown');
            const source = new URLSearchParams(String(row.data || '').replace(/^"|"$/g, '').replace(/^.*?\?/, ''));
            const color = source.get('colorone');
            if (/^[a-f\d]{6}$/i.test(color || '')) card.style.setProperty('--countdown-accent', '#' + color);
            const schedule = source.get('schedule');
            card.append(element('span', schedule && schedule !== 'null' ? 'SCHEDULE' : 'COUNTDOWN', 'social-eyebrow'));
            card.append(link(title(row), countdownURL(row.id), 'social-countdown-title'));
            if (row.creator) card.append(link(row.name || 'View creator', profileURL(row.creator), 'social-byline'));
            if (popular) card.append(element('span', `${Number(row.recent_views).toLocaleString()} recent ${Number(row.recent_views) === 1 ? 'view' : 'views'}`, 'social-meta'));
            else if (row.visibility !== undefined) card.append(element('span', visibilityNames[row.visibility] || 'Unlisted', 'social-meta'));
            container.append(card);
        }
    }
    async function profiles(ids) {
        if (!ids.length) return [];
        return result(client.from('public_profiles').select('id, name, avatar_url, official').in('id', [...new Set(ids)]));
    }
    async function mutuals() {
        if (!user) return [];
        const [following, followers] = await Promise.all([
            result(client.from('user_follows').select('following_id').eq('follower_id', user.id)),
            result(client.from('user_follows').select('follower_id').eq('following_id', user.id))
        ]);
        const followerIds = new Set(followers.map(row => row.follower_id));
        return profiles(following.map(row => row.following_id).filter(id => followerIds.has(id)));
    }
    async function section(containerId, load, version) {
        const container = byId(containerId);
        if (!container) return;
        container.replaceChildren(element('p', 'Loading…', 'social-empty'));
        try {
            const render = await load();
            if (version === generation) render(container);
        } catch (error) {
            if (version !== generation) return;
            container.replaceChildren(element('p', 'Could not load this section.', 'social-error'), button('Try again', refresh, true));
        }
    }
    async function dashboard(version) {
        if (!byId('popular-countdowns')) return;
        await Promise.all([
            section('popular-countdowns', async () => {
                const rows = await rpc('popular_countdowns', { p_limit: 12 });
                return container => renderCards(container, rows, { popular: true, empty: 'Public countdowns will appear here as people visit them.' });
            }, version),
            section('shared-countdowns', async () => {
                const rows = user ? await result(client.from('countdown').select('id, data, creator, visibility').contains('collaborator_ids', [user.id]).order('created_at', { ascending: false })) : [];
                return container => renderCards(container, rows, { empty: user ? 'Countdowns you help edit will appear here.' : 'Sign in to see shared countdowns.' });
            }, version),
            section('countdown-inbox', async () => {
                const rows = user ? await rpc('countdown_inbox') : [];
                return container => {
                    container.replaceChildren();
                    if (!rows.length) container.append(element('p', 'You’re all caught up. New editor invitations will appear here.', 'social-empty'));
                    for (const invitation of rows) {
                        const card = element('article', undefined, 'social-invitation');
                        card.dataset.socialStatus = '';
                        card.append(element('h3', decode(invitation.title)), link(invitation.inviter_name, profileURL(invitation.inviter_id)), element('p', 'Invited you to edit · expires ' + new Date(invitation.expires_at).toLocaleDateString()));
                        const actions = element('div', undefined, 'social-actions');
                        for (const accept of [true, false]) actions.append(button(accept ? 'Accept invitation' : 'Decline', async () => {
                            await rpc('respond_countdown_invitation', { p_invitation_id: invitation.id, p_accept: accept });
                            await refresh();
                        }, !accept));
                        const output = element('p'); output.setAttribute('role', 'status');
                        card.append(actions, output); container.append(card);
                    }
                };
            }, version),
            section('following-people', async () => {
                const rows = user ? await result(client.from('user_follows').select('following_id').eq('follower_id', user.id)) : [];
                const people = await profiles(rows.map(row => row.following_id));
                return container => {
                    container.replaceChildren();
                    if (!people.length) container.append(element('p', 'Find someone below to follow their countdowns.', 'social-empty'));
                    people.forEach(person => container.append(link(person.name || 'Minutehand user', profileURL(person.id), 'social-person')));
                };
            }, version)
        ]);
    }
    async function loadProfileCountdowns(append = false, version = generation) {
        const container = byId('profile-countdowns'), more = byId('profile-more');
        const offset = append ? profileOffset : 0;
        more.disabled = true;
        try {
            const rows = await result(client.from('countdown').select('id, data, creator').eq('creator', profileId).eq('visibility', 2)
                .order('created_at', { ascending: false }).order('id').range(offset, offset + 23));
            if (version !== generation) return;
            renderCards(container, rows, { append, previews: true });
            profileOffset = offset + rows.length;
            more.hidden = rows.length < 24;
        } finally { more.disabled = false; }
    }
    async function profile(version) {
        if (!byId('profile-header')) return;
        const requested = new URLSearchParams(location.search).get('id');
        profileId = requested || user?.id;
        if (!profileId) {
            byId('profile-header').replaceChildren(element('h1', 'Your profile'), link('Sign in to view your profile', 'auth', 'social-button'));
            return;
        }
        if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(profileId)) {
            status(byId('social-status'), 'This profile could not be found.', true); return;
        }
        try {
            const [person, stats] = await Promise.all([
                result(client.from('public_profiles').select('id, name, avatar_url, official').eq('id', profileId).maybeSingle()),
                rpc('profile_stats', { p_user_id: profileId })
            ]);
            if (version !== generation) return;
            if (!person) throw new Error('This profile could not be found.');
            document.title = (person.name || 'Profile') + ' | Minutehand';
            const header = byId('profile-header'); header.replaceChildren();
            const avatar = element('div', (person.name || '?').trim().slice(0, 1).toUpperCase(), 'social-avatar');
            if (/^https:\/\//i.test(person.avatar_url || '')) {
                const img = element('img'); img.src = person.avatar_url; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', () => img.remove()); avatar.append(img);
            }
            header.append(avatar, element('p', person.official ? 'OFFICIAL CREATOR' : 'MINUTEHAND PROFILE', 'social-eyebrow'), element('h1', person.name || 'Minutehand user'));
            header.append(element('p', `${stats.followers} ${Number(stats.followers) === 1 ? 'follower' : 'followers'} · ${stats.following} following`, 'social-meta'));
            const actions = element('div', undefined, 'social-actions');
            if (user?.id !== profileId) {
                if (!user) actions.append(link('Sign in to follow', 'auth?profile=' + encodeURIComponent(profileId), 'social-button'));
                else actions.append(button(stats.is_following ? 'Following · Unfollow' : 'Follow', async () => {
                    if (stats.is_following) await result(client.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profileId));
                    else await result(client.from('user_follows').insert({ follower_id: user.id, following_id: profileId }));
                    await refresh();
                }, stats.is_following));
            }
            actions.append(button('Copy profile link', node => copy(new URL(profileURL(profileId), location.href).href, node), true));
            header.append(actions);
            if (stats.is_following && stats.follows_you) header.append(element('p', 'You follow each other. You can invite one another to edit countdowns.', 'social-meta'));
            else if (stats.follows_you) header.append(element('p', 'Follows you', 'social-meta'));
            status(byId('social-status'), '');
            await loadProfileCountdowns(false, version);
        } catch (error) { if (version === generation) status(byId('social-status'), error.message || 'Could not load profile. Try again.', true); }
    }
    function clearTimerAccess(message) {
        timerRow = null;
        byId('sharing-fields')?.setAttribute('disabled', '');
        byId('countdown-editors')?.replaceChildren();
        byId('invite-editor-form')?.setAttribute('hidden', '');
        status(byId('sharing-status'), message);
    }
    async function loadTimer() {
        if (!byId('sharing-fields')) return;
        const version = ++timerGeneration;
        const id = window.CountdownDataID;
        if (!id) { clearTimerAccess('Sign in and save this countdown to manage sharing.'); return; }
        try {
            const [{ data: { session } }, row] = await Promise.all([
                client.auth.getSession(), result(client.from('countdown').select('id, creator, collaborator_ids, visibility, revision').eq('id', id).maybeSingle())
            ]);
            if (version !== timerGeneration) return;
            user = session?.user || null;
            if (!row) { clearTimerAccess('This countdown is unavailable to your account.'); return; }
            timerRow = row;
            const owner = user?.id === row.creator;
            byId('sharing-fields').disabled = !owner;
            byId('countdown-visibility').value = String(row.visibility);
            status(byId('visibility-help'), visibilityHelp[row.visibility]);
            status(byId('sharing-status'), owner ? 'Only you can change visibility and manage editors.' : 'The owner manages sharing and editor invitations.');
            const ownerLink = byId('creator-profile-link');
            ownerLink.hidden = !row.creator; ownerLink.href = profileURL(row.creator);
            byId('invite-editor-form').hidden = !owner;
            const editorContainer = byId('countdown-editors'); editorContainer.replaceChildren();
            const ids = row.collaborator_ids || [];
            const [people, invites, friends] = await Promise.all([
                owner || ids.includes(user?.id) ? profiles(ids) : [],
                owner ? result(client.from('countdown_invitations').select('invitee_id, status, expires_at').eq('countdown_id', id).eq('status', 'pending')) : [],
                owner ? mutuals() : []
            ]);
            if (version !== timerGeneration) return;
            if (owner) {
                const pending = invites.filter(invite => new Date(invite.expires_at) > new Date());
                const pendingPeople = await profiles(pending.map(invite => invite.invitee_id));
                if (version !== timerGeneration) return;
                const select = byId('editor-person'); select.replaceChildren(element('option', 'Choose someone you follow mutually'));
                select.firstChild.value = '';
                friends.filter(person => !ids.includes(person.id) && !pending.some(invite => invite.invitee_id === person.id)).forEach(person => {
                    const option = element('option', person.name || 'Minutehand user'); option.value = person.id; select.append(option);
                });
                byId('invite-editor-button').disabled = select.options.length === 1 || ids.length + pending.length >= 5;
                status(byId('editor-help'), friends.length ? 'Up to 5 editors. Invitations expire after 14 days.' : 'Follow each other first, then invite them here. Find people on the dashboard.');
                for (const person of pendingPeople) editorContainer.append(editorLine(person, 'Invited', true, id));
            }
            for (const person of people) editorContainer.append(editorLine(person, 'Editor', owner, id));
            if (owner && !editorContainer.children.length) editorContainer.append(element('p', 'No editors yet. Invite someone to work on this countdown together.', 'social-empty'));
            if (!owner && ids.includes(user?.id)) editorContainer.append(button('Leave this countdown', async () => {
                await rpc('remove_countdown_editor', { p_countdown_id: id, p_user_id: user.id }); location.reload();
            }, true));
            scheduleView(row);
        } catch (error) {
            if (version !== timerGeneration) return;
            clearTimerAccess('Could not load sharing. Use Refresh to try again.');
        }
    }
    function editorLine(person, label, removable, id) {
        const row = element('div', undefined, 'social-editor');
        row.append(link(person.name || 'Minutehand user', profileURL(person.id)), element('span', label, 'social-meta'));
        if (removable) row.append(button(label === 'Invited' ? 'Cancel invitation' : 'Remove editor', async () => {
            await rpc('remove_countdown_editor', { p_countdown_id: id, p_user_id: person.id }); await loadTimer();
        }, true));
        return row;
    }
    function scheduleView(row) {
        clearTimeout(viewTimer);
        if (viewCounted || document.hidden || window.top !== window || row.visibility !== 2 || row.creator === user?.id || row.collaborator_ids?.includes(user?.id) || document.body.classList.contains('viewer-preview')) return;
        viewTimer = setTimeout(async () => {
            if (document.hidden || document.body.classList.contains('viewer-preview')) return;
            try {
                let visitor;
                try { visitor = localStorage.getItem('minutehand_view_visitor'); } catch {}
                if (!/^[\da-f-]{36}$/i.test(visitor || '')) {
                    visitor = crypto.randomUUID();
                    try { localStorage.setItem('minutehand_view_visitor', visitor); } catch {}
                }
                await rpc('record_countdown_view', { p_countdown_id: row.id, p_visitor_id: visitor });
                viewCounted = true;
            } catch { /* Analytics failure must never prevent viewing a countdown. */ }
        }, 4000);
    }
    async function refresh() {
        const version = ++generation;
        try {
            const { data: { session } } = await client.auth.getSession();
            if (version !== generation) return;
            user = session?.user || null;
            if (user) {
                const existing = await result(client.from('users').select('id').eq('id', user.id).maybeSingle());
                if (!existing) await result(client.from('users').upsert({
                    id: user.id, name: user.user_metadata?.full_name || user.user_metadata?.name || 'Minutehand user',
                    email: user.email || null, avatar_url: user.user_metadata?.avatar_url || null
                }, { onConflict: 'id' }));
                if (version !== generation) return;
            }
            document.querySelectorAll('[data-my-profile]').forEach(node => { node.href = user ? profileURL(user.id) : 'auth'; });
            await Promise.all([dashboard(version), profile(version)]);
        } catch (error) { if (version === generation) status(byId('social-status'), 'Could not load your account. Please retry.', true); }
    }
    byId('people-search')?.addEventListener('submit', async event => {
        event.preventDefault();
        const input = byId('people-query'), container = byId('people-results'), query = input.value.trim();
        if (query.length < 2) { status(container, 'Enter at least two characters.'); return; }
        const version = generation;
        status(container, 'Searching…');
        try {
            const people = await result(client.from('public_profiles').select('id, name').ilike('name', '%' + query.replace(/[\\%_]/g, '\\$&') + '%').order('name').limit(30));
            if (version !== generation || input.value.trim() !== query) return;
            container.replaceChildren();
            if (!people.length) status(container, 'No people found. Try another name.');
            people.forEach(person => container.append(link(person.name || 'Minutehand user', profileURL(person.id), 'social-person')));
        } catch { status(container, 'Search is unavailable. Please try again.', true); }
    });
    byId('profile-more')?.addEventListener('click', () => loadProfileCountdowns(true).catch(() => status(byId('social-status'), 'Could not load more countdowns. Please try again.', true)));
    byId('social-retry')?.addEventListener('click', refresh);
    byId('sharing-retry')?.addEventListener('click', loadTimer);
    byId('countdown-visibility')?.addEventListener('change', async event => {
        if (!timerRow || user?.id !== timerRow.creator) return;
        const select = event.target, previous = timerRow.visibility, id = timerRow.id, version = timerGeneration;
        select.disabled = true;
        try {
            const row = await result(client.from('countdown').update({ visibility: Number(select.value) }).eq('id', id).eq('creator', user.id).select('id, visibility').single());
            if (version !== timerGeneration) return;
            timerRow.visibility = row.visibility;
            if (window.CountdownUserData?.countdown) window.CountdownUserData.countdown.visibility = row.visibility;
            status(byId('visibility-help'), visibilityHelp[row.visibility]);
            status(byId('sharing-status'), visibilityNames[row.visibility] + ' · sharing updated.');
        } catch (error) {
            if (version === timerGeneration) { select.value = String(previous); status(byId('sharing-status'), 'Could not change visibility. Please retry.', true); }
        } finally { select.disabled = false; }
    });
    byId('invite-editor-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const invite = byId('invite-editor-button'), person = byId('editor-person').value;
        if (!person || invite.disabled || !timerRow) return;
        invite.disabled = true;
        try {
            await rpc('invite_countdown_editor', { p_countdown_id: timerRow.id, p_user_id: person });
            await loadTimer(); status(byId('sharing-status'), 'Invitation sent. They can accept it from their dashboard.');
        } catch (error) { status(byId('sharing-status'), error.message || 'Could not send invitation. Please retry.', true); }
        finally { invite.disabled = false; }
    });
    byId('copy-conflicted-countdown')?.addEventListener('click', event => {
        copy(window.CountdownDataSource || '', event.currentTarget).catch(error => status(byId('sharing-status'), error.message, true));
    });
    window.addEventListener('focus', async () => {
        if (!window.CountdownDataID || !timerRow) return;
        try {
            const row = await result(client.from('countdown').select('creator, collaborator_ids, visibility, revision').eq('id', window.CountdownDataID).maybeSingle());
            if (!row) { window.MinutehandAccessUnavailable?.(); return; }
            if (window.CountdownUserData) window.CountdownUserData.countdown = row;
            window.gearIconUpdated = false;
            window.updateGearIconForUser?.();
        } catch { /* Keep the current view; saves still require server authorization. */ }
    });
    byId('sharing-copy')?.addEventListener('click', event => {
        if (!window.CountdownDataID) { status(byId('sharing-status'), 'Save your countdown first.'); return; }
        copy(new URL(countdownURL(window.CountdownDataID), location.href).href, event.currentTarget).catch(error => status(byId('sharing-status'), error.message, true));
    });
    document.addEventListener('data-ready', loadTimer);
    document.addEventListener('countdown-saved', event => { if (event.detail?.created) loadTimer(); });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) clearTimeout(viewTimer); else if (timerRow) scheduleView(timerRow);
    });
    client.auth.onAuthStateChange((event, session) => {
        const next = session?.user?.id || null;
        if (next === activeUserId) return;
        activeUserId = next;
        if (timerRow?.visibility === 0 && !next) { window.MinutehandAccessUnavailable?.(); return; }
        generation++; timerGeneration++;
        clearTimerAccess('Refreshing account…');
        for (const id of ['shared-countdowns', 'countdown-inbox', 'following-people']) byId(id)?.replaceChildren();
        // Never await another Supabase request inside its auth callback.
        setTimeout(() => { refresh(); loadTimer(); }, 0);
    });
    window.MinutehandSocial = { refresh, loadTimer, title };
    refresh();
})();
