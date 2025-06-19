function parameter(name) {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(name);
    if (name === 'cardmode') {
        return value === 'true' || value === '1';
    }
    return value;
}

if(!parameter('cardmode')){
    // Function to get Supabase credentials from localStorage or prompt user
    function getSupabaseCredentials() {
        let supabaseUrl = localStorage.getItem('supabaseUrl');
        let supabaseAnonKey = localStorage.getItem('supabaseAnonKey');
        console.log('[supabaseclient] Fetching credentials from localStorage:', { supabaseUrl, supabaseAnonKey });
        
        // If credentials don't exist in localStorage, prompt user
        if (!supabaseUrl || !supabaseAnonKey) {
            supabaseUrl = prompt('Enter your Supabase URL:');
            supabaseAnonKey = prompt('Enter your Supabase anon key:');
            console.log('[supabaseclient] Prompted user for credentials:', { supabaseUrl, supabaseAnonKey });
            
            // Save to localStorage if user provided values
            if (supabaseUrl && supabaseAnonKey) {
                localStorage.setItem('supabaseUrl', supabaseUrl);
                localStorage.setItem('supabaseAnonKey', supabaseAnonKey);
                console.log('[supabaseclient] Saved credentials to localStorage');
            } else {
                console.error('[supabaseclient] Supabase credentials are required, aborting');
                throw new Error('Supabase credentials are required');
            }
        }
        
        console.log('[supabaseclient] Returning credentials:', { supabaseUrl, supabaseAnonKey });
        return { supabaseUrl, supabaseAnonKey };
    }

    // Get credentials and create client
    const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
    console.log('[supabaseclient] Creating Supabase client with:', { supabaseUrl, supabaseAnonKey });
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