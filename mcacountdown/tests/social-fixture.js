(() => {
    const params = new URLSearchParams(location.search);
    const owner = '10000000-0000-4000-8000-000000000001', friend = '20000000-0000-4000-8000-000000000002';
    const other = '30000000-0000-4000-8000-000000000003';
    const role = params.get('role') || 'owner';
    const userId = role === 'owner' ? owner : role === 'editor' ? friend : role === 'viewer' ? other : null;
    let session = userId ? { user: { id: userId, email: 'test@example.invalid', user_metadata: { full_name: 'Test User' } } } : null;
    const callbacks = [], writes = [], calls = [];
    const row = { id: 'social-countdown', creator: owner, collaborator_ids: [friend], visibility: params.has('private') ? 0 : 2, revision: 0, created_at: '2026-09-01T12:00:00Z',
        data: '?date=2099-12-25T00:00&title=Winter%20break&atc=none&colorone=8426ff&colortwo=3ab6ff&colorthree=00df52&colorfour=ff9900&typeface=Fredoka%20One&confettitype=1&progress=&progressposition=null&endingsound=&schedule=null' };
    const tables = {
        public_profiles: [{ id: owner, name: 'Alex Owner', official: false }, { id: friend, name: 'Jamie Editor' }, { id: other, name: 'Morgan Friend' }],
        users: [{ id: userId, name: 'Test User', settings: {} }], user_dashboards: [], countdown_info: [],
        countdown: [row, { ...row, id: 'unlisted', visibility: 1 }, { ...row, id: 'private', visibility: 0 }, { ...row, id: 'shared', creator: friend, collaborator_ids: [owner] }],
        user_follows: [{ follower_id: owner, following_id: friend }, { follower_id: friend, following_id: owner }, { follower_id: owner, following_id: other }, { follower_id: other, following_id: owner }],
        countdown_invitations: []
    };
    let inbox = [{ id: 'invitation', countdown_id: 'shared', inviter_id: friend, inviter_name: 'Jamie Editor', title: 'Launch%20day', expires_at: '2099-12-31' }];
    let fail = '', denied = params.has('denied');
    const client = {
        auth: {
            getSession: async () => ({ data: { session }, error: null }),
            getUser: async () => ({ data: { user: session?.user || null }, error: null }),
            onAuthStateChange(callback) { callbacks.push(callback); setTimeout(() => callback('INITIAL_SESSION', session), 0); return { data: { subscription: { unsubscribe() {} } } }; }
        },
        from(table) {
            const filters = []; let single = false, action, payload, start = 0, end = Infinity, count;
            const query = {
                select() { return query; }, eq(key, value) { filters.push(row => row[key] === value); return query; },
                in(key, values) { filters.push(row => values.includes(row[key])); return query; },
                contains(key, values) { filters.push(row => values.every(value => row[key]?.includes(value))); return query; },
                ilike(key, value) { filters.push(row => row[key]?.toLowerCase().includes(value.replace(/^%|%$/g, '').toLowerCase())); return query; },
                order() { return query; }, limit(n) { count = n; return query; }, range(a, b) { start = a; end = b + 1; return query; },
                single() { single = true; return query; }, maybeSingle() { single = true; return query; },
                insert(value) { action = 'insert'; payload = value; return query; }, upsert(value) { action = 'upsert'; payload = value; return query; },
                update(value) { action = 'update'; payload = value; return query; }, delete() { action = 'delete'; return query; },
                then(resolve, reject) {
                    calls.push({ table, action });
                    if (fail === table) return Promise.resolve({ data: null, error: { message: 'Simulated server failure' } }).then(resolve, reject);
                    let rows = (tables[table] || []).filter(row => filters.every(test => test(row)));
                    if (table === 'countdown' && denied) rows = [];
                    if (action) {
                        writes.push({ table, action, payload });
                        if (action === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
                        if (action === 'insert' || action === 'upsert') {
                            const existing = action === 'upsert' && payload.id ? tables[table]?.find(row => row.id === payload.id) : null;
                            if (existing) Object.assign(existing, payload);
                            else { const added = { ...payload }; tables[table]?.push(added); rows = [added]; }
                        }
                        if (action === 'update') rows.forEach(row => { if (payload.data !== undefined && payload.data !== row.data) row.revision++; Object.assign(row, payload); });
                    }
                    rows = rows.slice(start, end); if (count) rows = rows.slice(0, count);
                    return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject);
                }
            }; return query;
        },
        async rpc(name, args) {
            calls.push({ rpc: name, args });
            if (fail === name) return { data: null, error: { message: 'Simulated server failure' } };
            if (name === 'popular_countdowns') return { data: [{ ...row, name: 'Alex Owner', recent_views: 42 }] };
            if (name === 'countdown_inbox') return { data: inbox };
            if (name === 'profile_stats') return { data: { followers: 2, following: 2,
                is_following: tables.user_follows.some(r => r.follower_id === userId && r.following_id === args.p_user_id),
                follows_you: tables.user_follows.some(r => r.follower_id === args.p_user_id && r.following_id === userId) } };
            if (name === 'invite_countdown_editor') tables.countdown_invitations.push({ invitee_id: args.p_user_id, countdown_id: row.id, status: 'pending', expires_at: '2099-12-31' });
            if (name === 'respond_countdown_invitation') inbox = [];
            if (name === 'remove_countdown_editor') { row.collaborator_ids = row.collaborator_ids.filter(id => id !== args.p_user_id); tables.countdown_invitations = tables.countdown_invitations.filter(r => r.invitee_id !== args.p_user_id); }
            return { data: true };
        }
    };
    window.supabaseClient = client;
    window.__socialTest = { owner, friend, other, row, tables, calls, writes, fail: value => { fail = value; }, deny: () => { denied = true; }, async signOut() { session = null; for (const callback of callbacks) callback('SIGNED_OUT', null); } };
    document.cookie = 'cookiesAccepted=True; Path=/; SameSite=Lax';
})();
