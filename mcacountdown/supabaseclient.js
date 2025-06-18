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
}

function parameter(name) {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(name);
    if (name === 'cardmode') {
        return value === 'true' || value === '1';
    }
    return value;
}