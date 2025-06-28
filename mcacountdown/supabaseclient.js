function parameter(name) {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(name);
    if (name === 'cardmode') {
        return value === 'true' || value === '1';
    }
    return value;
}

if(!parameter('cardmode')){
    // Hardcoded Supabase credentials
    const supabaseUrl = 'https://milgdlhbepxdzxiylgqj.supabase.co/';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbGdkbGhiZXB4ZHp4aXlsZ3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4ODU0MjAsImV4cCI6MjA2NDQ2MTQyMH0.pkJC5dKql4yiwGL6NZ-X7dqTqTAd4VlhYid0nJ0AHL8';
    
    // Create Supabase client
    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    });
    console.log('[supabaseclient] Supabase client created:', window.supabaseClient);

    // Check if we have a session immediately
    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        console.log('[supabaseclient] Initial session check:', session ? 'Logged in' : 'Not logged in');
        if (session) {
            // We have a session, trigger the auth state change
            window.supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log('[supabaseclient] Auth state change:', event, session);
            });
        }
    });
} else {
    // In card mode, create a dummy supabaseClient that does nothing
    window.supabaseClient = {
        auth: {
            onAuthStateChange: () => {},
            getUser: () => Promise.resolve({ data: null }),
            signInWithOAuth: () => Promise.resolve({ error: null }),
            getSession: () => Promise.resolve({ data: { session: null } })
        },
        from: () => ({
            upsert: () => Promise.resolve({ error: null }),
            select: () => ({
                eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    single: () => Promise.resolve({ data: null, error: null })
                })
            }),
            update: () => ({
                eq: () => Promise.resolve({ error: null })
            })
        })
    };
}