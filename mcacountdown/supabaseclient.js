// Function to get Supabase credentials from localStorage or prompt user
function getSupabaseCredentials() {
    let supabaseUrl = localStorage.getItem('supabaseUrl');
    let supabaseAnonKey = localStorage.getItem('supabaseAnonKey');
    
    // If credentials don't exist in localStorage, prompt user
    if (!supabaseUrl || !supabaseAnonKey) {
        supabaseUrl = prompt('Enter your Supabase URL:');
        supabaseAnonKey = prompt('Enter your Supabase anon key:');
        
        // Save to localStorage if user provided values
        if (supabaseUrl && supabaseAnonKey) {
            localStorage.setItem('supabaseUrl', supabaseUrl);
            localStorage.setItem('supabaseAnonKey', supabaseAnonKey);
        } else {
            throw new Error('Supabase credentials are required');
        }
    }
    
    return { supabaseUrl, supabaseAnonKey };
}

// Get credentials and create client
const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();

window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});