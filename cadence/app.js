import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const SUPABASE_URL = "https://pvqrxkbyjhgomwqwkedw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cXJ4a2J5amhnb213cXdrZWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg1NTQsImV4cCI6MjA3ODEwNDU1NH0.FWrCZOExwjhfihh7nSZFR2FkIhcJjVyDo0GdDaGKg1g";

// Check for access_token in URL BEFORE creating Supabase client
// This way we can intercept it before detectSessionInUrl processes it
// IMPORTANT: This must run synchronously at module load time, before Supabase client is created
(function() {
  const urlHash = window.location.hash;
  const hashParams = new URLSearchParams(urlHash.substring(1));
  window.__hasAccessToken = hashParams.get('access_token');
  window.__isRecovery = hashParams.get('type') === 'recovery';
  window.__isInviteLink = window.__hasAccessToken && !window.__isRecovery;
  
  console.log('🔍 Pre-init check - Full URL:', window.location.href);
  console.log('🔍 Pre-init check - URL hash:', urlHash);
  console.log('🔍 Pre-init check - hashParams keys:', Array.from(hashParams.keys()));
  console.log('🔍 Pre-init check - hasAccessToken:', !!window.__hasAccessToken);
  console.log('🔍 Pre-init check - isRecovery:', window.__isRecovery);
  console.log('🔍 Pre-init check - isInviteLink:', window.__isInviteLink);
})();

const hasAccessToken = window.__hasAccessToken;
const isRecovery = window.__isRecovery;
const isInviteLink = window.__isInviteLink;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
  },
});

const state = {
  session: null,
  profile: null,
  sets: [],
  songs: [],
  people: [],
  pendingInvites: [],
  selectedSet: null,
  currentSetSongs: [],
  creatingSongFromModal: false,
  expandedSets: new Set(),
  currentSongDetailsId: null, // Track which song is open in details modal
  isPasswordSetup: isInviteLink, // Set flag immediately if this is an invite link
  isPasswordReset: isRecovery, // Set flag immediately if this is a password reset link
  isMemberView: false, // Track if manager is viewing as member
  currentTeamId: null, // Current team the user is viewing/working with
  userTeams: [], // Array of all teams the user is a member of
  teamAssignmentMode: 'per_set', // Team-wide assignment mode (default: per_set)
  metronome: {
    isPlaying: false,
    bpm: null,
    intervalId: null,
    audioContext: null,
  },
};

const el = (id) => document.getElementById(id);
const authGate = el("auth-gate");
const dashboard = el("dashboard");
const userInfo = el("user-info");
const userName = el("user-name");
const createSetBtn = el("btn-create-set");
const setsList = el("sets-list");
const yourSetsList = el("your-sets-list");
const setModal = el("set-modal");
const songModal = el("song-modal");
const tagModal = el("tag-modal");
const sectionModal = el("section-modal");
const sectionHeaderModal = el("section-header-modal");
const authForm = el("auth-form");
const loginEmailInput = el("login-email");
const loginPasswordInput = el("login-password");
const authMessage = el("auth-message");
const authSubmitBtn = el("auth-submit-btn");
const loginFormContainer = el("login-form-container");
const forgotPasswordContainer = el("forgot-password-container");
const forgotPasswordForm = el("forgot-password-form");
const forgotPasswordEmailInput = el("forgot-password-email");
const forgotPasswordMessage = el("forgot-password-message");
// Team leader signup mode - allows team leaders to create teams
let isSignUpMode = false;

const TAG_PRESET_OPTIONS = [
  { value: "chorus", label: "Chorus" },
  { value: "verse", label: "Verse" },
  { value: "bridge", label: "Bridge" },
  { value: "pre-chorus", label: "Pre-Chorus" },
  { value: "intro", label: "Intro" },
  { value: "outro", label: "Outro" },
  { value: "instrumental", label: "Instrumental" },
  { value: "tag", label: "Tag" },
  { value: "custom", label: "Custom" },
  { value: "none", label: "Clear Tag" },
];

// Toast System
function showToast(message, type = 'info', duration = 5000) {
  const container = el('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Add icon based on type
  const icon = document.createElement('div');
  icon.className = 'toast-icon';
  if (type === 'error') {
    icon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
  } else if (type === 'success') {
    icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  } else {
    icon.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
  }
  
  const content = document.createElement('div');
  content.className = 'toast-content';
  content.textContent = message;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.onclick = () => removeToast(toast);
  
  toast.appendChild(icon);
  toast.appendChild(content);
  toast.appendChild(closeBtn);
  container.appendChild(toast);
  
  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }
  
  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('slide-out');
  setTimeout(() => {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
  }, 300);
}

// Convenience functions
function toastError(message, duration = 6000) {
  return showToast(message, 'error', duration);
}

function toastSuccess(message, duration = 4000) {
  return showToast(message, 'success', duration);
}

function toastInfo(message, duration = 5000) {
  return showToast(message, 'info', duration);
}

// Database Error Overlay System
function showDatabaseError() {
  const overlay = el('database-error-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    // Prevent body scroll when overlay is shown
    document.body.style.overflow = 'hidden';
  }
}

function hideDatabaseError() {
  const overlay = el('database-error-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    // Restore body scroll
    document.body.style.overflow = '';
  }
}

// Check if an error indicates database is unresponsive
function isDatabaseUnresponsive(error) {
  if (!error) return false;
  
  // Network errors
  if (error.message?.includes('Failed to fetch') || 
      error.message?.includes('NetworkError') ||
      error.message?.includes('Network request failed') ||
      error.message?.includes('fetch failed')) {
    return true;
  }
  
  // Timeout errors
  if (error.message?.includes('timeout') || 
      error.message?.includes('timed out') ||
      error.message?.includes('aborted')) {
    return true;
  }
  
  // Connection errors
  if (error.message?.includes('ERR_INTERNET_DISCONNECTED') ||
      error.message?.includes('ERR_CONNECTION_REFUSED') ||
      error.message?.includes('ERR_CONNECTION_RESET') ||
      error.message?.includes('ERR_CONNECTION_CLOSED') ||
      error.message?.includes('ERR_CONNECTION_TIMED_OUT')) {
    return true;
  }
  
  // Supabase-specific errors
  if (error.code === 'PGRST301' || // Service unavailable
      error.code === 'PGRST302' || // Connection timeout
      error.message?.includes('service unavailable') ||
      error.message?.includes('connection refused') ||
      error.message?.includes('503') ||
      error.message?.includes('502') ||
      error.message?.includes('504')) {
    return true;
  }
  
  // Check for network error in the error object
  if (error.name === 'NetworkError' || 
      error.name === 'TypeError' && error.message?.includes('fetch')) {
    return true;
  }
  
  return false;
}

// Wrapper function to handle Supabase operations with database error detection
async function safeSupabaseOperation(operation, options = {}) {
  const { 
    showErrorOnFailure = true,
    retryOnError = false,
    maxRetries = 0,
    timeout = 30000 // 30 second default timeout
  } = options;
  
  try {
    // Wrap operation in timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeout)
    );
    
    const result = await Promise.race([operation(), timeoutPromise]);
    
    // If we got here, operation succeeded - hide error overlay
    if (result?.error && isDatabaseUnresponsive(result.error)) {
      if (showErrorOnFailure) {
        showDatabaseError();
      }
      return result;
    }
    
    // Success - hide error overlay
    hideDatabaseError();
    return result;
    
  } catch (error) {
    console.error('Database operation error:', error);
    
    if (isDatabaseUnresponsive(error)) {
      if (showErrorOnFailure) {
        showDatabaseError();
      }
      
      // Return error in Supabase format for consistency
      return { 
        data: null, 
        error: {
          message: error.message || 'Database is unresponsive',
          code: error.code || 'DATABASE_UNRESPONSIVE'
        }
      };
    }
    
    // For non-database errors, rethrow or return
    throw error;
  }
}

// Helper function to check if user has manager permissions
// Returns false if in member view mode, even if user is a manager
// Returns true for both owners and managers
// IMPORTANT: Like isOwner(), this prefers team_members (state.userTeams) over profile flags
function isManager() {
  if (state.isMemberView) return false;
  
  // Prefer per-team permissions when we have them
  if (state.currentTeamId && state.userTeams && state.userTeams.length > 0) {
    const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
    if (currentTeam) {
      const canManageFromTeam = currentTeam.is_owner === true || currentTeam.can_manage === true;
      if (canManageFromTeam) {
        return true;
      } else {
        // If team_members says user is NOT manager, treat them as a member
        // even if older profile flags suggest otherwise (stale data)
        if (state.profile?.is_owner || state.profile?.can_manage) {
          console.warn('⚠️ isManager() mismatch: userTeams says NOT manager, but profile flags suggest manager. Using userTeams (correct).', {
            currentTeamId: state.currentTeamId,
            currentTeamName: currentTeam.name,
            'userTeams.is_owner': currentTeam.is_owner,
            'userTeams.can_manage': currentTeam.can_manage,
            'profile.is_owner': state.profile.is_owner,
            'profile.can_manage': state.profile.can_manage
          });
        }
        return false;
      }
    }
  }
  
  // Fallback to profile only if userTeams is not available yet (during initial load)
  if ((state.profile?.is_owner || state.profile?.can_manage) && (!state.userTeams || state.userTeams.length === 0)) {
    return true;
  }
  
  return false;
}

// Helper function to check if user is team owner
// Returns false if in member view mode, even if user is an owner
function isOwner() {
  if (state.isMemberView) return false;
  
  // CRITICAL: Prioritize state.userTeams (from team_members) over state.profile.is_owner
  // state.profile.is_owner can be stale after ownership transfers
  // Check if user is owner in current team (multi-team support)
  if (state.currentTeamId && state.userTeams && state.userTeams.length > 0) {
    const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
    if (currentTeam) {
      // If userTeams has data for this team, use it as source of truth
      // Explicitly check is_owner from team_members, not profile
      const isOwnerFromUserTeams = currentTeam.is_owner === true;
      if (isOwnerFromUserTeams) {
        return true;
      } else {
        // If userTeams says user is NOT owner, return false immediately
        // Don't fall back to stale profile data
        // Log this to help debug stale profile data issues
        if (state.profile?.is_owner) {
          console.warn('⚠️ isOwner() mismatch: userTeams says NOT owner, but profile.is_owner is true. Using userTeams (correct).', {
            currentTeamId: state.currentTeamId,
            currentTeamName: currentTeam.name,
            'userTeams.is_owner': currentTeam.is_owner,
            'profile.is_owner': state.profile.is_owner
          });
        }
        return false;
      }
    }
  }
  
  // Fallback to profile only if userTeams is not available yet (during initial load)
  // This should only happen before fetchUserTeams() completes
  if (state.profile?.is_owner && (!state.userTeams || state.userTeams.length === 0)) {
    return true;
  }
  
  return false;
}

async function init() {
  console.log('🚀 init() called');
  console.log('🔍 State.isPasswordSetup:', state.isPasswordSetup);
  console.log('🔍 Current URL hash:', window.location.hash);
  console.log('🔍 isInviteLink (from top level):', isInviteLink);
  
  let initialSessionChecked = false;
  let isProcessingSession = false;
  
  // Set up auth state change handler FIRST so it can handle password setup cases
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth state change event:', event);
    console.log('  - Session:', session ? 'Has session' : 'No session');
    console.log('  - initialSessionChecked:', initialSessionChecked);
    console.log('  - isProcessingSession:', isProcessingSession);
    console.log('  - Session user:', session?.user?.email);
    
    // Don't process INITIAL_SESSION if we haven't done getSession() yet
    if (!initialSessionChecked && event === 'INITIAL_SESSION') {
      console.log('  - Ignoring INITIAL_SESSION event, waiting for getSession()');
      return;
    }
    
    // Prevent double-processing
    if (isProcessingSession && event === 'SIGNED_IN') {
      console.log('  - Already processing session, skipping duplicate SIGNED_IN');
      return;
    }
    
    state.session = session;
    
    // If we're in password reset mode, show password reset form
    if (state.isPasswordReset && session) {
      console.log('  - Password reset mode with session, showing password reset form');
      showPasswordSetupGate();
      return; // Don't proceed with normal flow
    }
    
    // If we're in password setup mode, check if profile exists
    if (state.isPasswordSetup && session) {
      console.log('  - Password setup mode with session, checking profile...');
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();
      
      if (!existingProfile) {
        console.log('  - No profile found in password setup mode, showing password setup form');
        showPasswordSetupGate();
        return; // Don't proceed with normal flow
      } else {
        console.log('  - Profile exists, clearing password setup mode');
        state.isPasswordSetup = false; // Profile exists, proceed normally
      }
    }
    
    // Skip normal flow if we're in password setup or reset mode and no session
    if ((state.isPasswordSetup || state.isPasswordReset) && !session) {
      console.log('  - Password setup/reset mode, skipping normal auth flow');
      return;
    }
    
    if (session) {
      console.log('  - Session exists, setting up profile and showing app...');
      isProcessingSession = true;
      
      // Create fallback profile immediately so UI can show
      if (!state.profile) {
        state.profile = {
          id: session.user.id,
          full_name: session.user.user_metadata.full_name || session.user.email || "User",
          can_manage: false,
        };
        console.log('  - Created temporary profile:', state.profile);
      }
      
      // Show app immediately, don't wait for profile fetch
      console.log('  - Showing app immediately...');
      showApp();
      
      // Fetch profile FIRST, then load data
      const profileTimeout = setTimeout(() => {
        console.log('  - ⚠️ Profile fetch timeout, keeping temporary profile');
        isProcessingSession = false;
      }, 2000); // 2 second timeout
      
      fetchProfile().then(() => {
        clearTimeout(profileTimeout);
        console.log('  - Profile fetch complete, state.profile:', state.profile);
        console.log('  - team_id available:', state.profile?.team_id);
        
        // NOW load data after profile is loaded
        Promise.all([loadSongs(), loadSets(), loadPeople()]).then(() => {
          console.log('  - Data loading complete');
          // Refresh the active tab to show newly loaded data
          refreshActiveTab();
        }).catch(err => {
          console.error('  - Error loading data:', err);
        });
        
        // Update UI in case profile changed (e.g., can_manage status)
        console.log('  - Updating UI with final profile');
        showApp();
        isProcessingSession = false;
      }).catch(err => {
        clearTimeout(profileTimeout);
        console.error('  - ❌ Error fetching profile:', err);
        isProcessingSession = false;
      });
    } else {
      console.log('  - No session');
      // Only reset if this isn't the initial load
      if (initialSessionChecked) {
        console.log('  - Initial check done, showing auth gate');
        resetState();
        showAuthGate();
      } else {
        console.log('  - Initial check not done yet, skipping auth gate');
      }
    }
  });

  // Check localStorage for session data
  const supabaseKeys = Object.keys(localStorage).filter(key => key.startsWith('sb-'));
  console.log('LocalStorage Supabase keys:', supabaseKeys.length > 0 ? supabaseKeys : 'None found');
  
  // Bind events first so password setup form handler is ready
  bindEvents();
  
  // Check for password reset link BEFORE checking for session
  // This must happen first so we don't show the login form
  if (state.isPasswordReset || isRecovery) {
    console.log('🔐 Password reset link detected!');
    console.log('  - state.isPasswordReset:', state.isPasswordReset);
    console.log('  - isRecovery:', isRecovery);
    console.log('  - URL hash:', window.location.hash);
    
    // Ensure flag is set
    state.isPasswordReset = true;
    
    // Wait a moment for Supabase to process the URL (detectSessionInUrl)
    // This gives Supabase time to create the session from the access_token
    console.log('⏳ Waiting for Supabase to process URL...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('🔍 Checking for session after wait...');
    const { data: { session: recoverySession }, error: sessionError } = await supabase.auth.getSession();
    
    if (recoverySession && !sessionError) {
      console.log('✅ Session created from password reset link for:', recoverySession.user.email);
      state.session = recoverySession; // Set session so we can use it in password reset
      console.log('👤 Showing password reset form');
      showPasswordSetupGate();
      initialSessionChecked = true; // Mark as checked so we don't process INITIAL_SESSION
      return; // Don't proceed with normal auth flow yet
    } else {
      console.log('⚠️ Could not get session from password reset link');
      console.log('  - Session error:', sessionError);
      console.log('  - Session:', recoverySession);
      showAuthGate();
      setAuthMessage("Invalid or expired password reset link. Please request a new one.", true);
      initialSessionChecked = true;
      return;
    }
  }
  
  // Check for invite link BEFORE checking for session
  // This must happen first so we don't show the login form
  if (state.isPasswordSetup || isInviteLink) {
    console.log('🔗 Invite link detected!');
    console.log('  - state.isPasswordSetup:', state.isPasswordSetup);
    console.log('  - isInviteLink:', isInviteLink);
    console.log('  - URL hash:', window.location.hash);
    
    // Ensure flag is set
    state.isPasswordSetup = true;
    
    // Wait a moment for Supabase to process the URL (detectSessionInUrl)
    // This gives Supabase time to create the session from the access_token
    console.log('⏳ Waiting for Supabase to process URL...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('🔍 Checking for session after wait...');
    const { data: { session: inviteSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (inviteSession && !sessionError) {
      console.log('✅ Session created from invite link for:', inviteSession.user.email);
      state.session = inviteSession; // Set session so we can use it in password setup
      
      // Check if profile exists
      console.log('🔍 Checking if profile exists...');
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", inviteSession.user.id)
        .maybeSingle();
      
      if (!existingProfile) {
        console.log('👤 No profile found, showing password setup form');
        showPasswordSetupGate();
        initialSessionChecked = true; // Mark as checked so we don't process INITIAL_SESSION
        return; // Don't proceed with normal auth flow yet
      } else {
        console.log('✅ Profile already exists, proceeding with normal flow');
        // Profile exists, so they've already set up their account - proceed normally
        state.isPasswordSetup = false; // Reset flag since we're proceeding normally
        // Continue with normal flow below
      }
    } else {
      console.log('⚠️ Could not get session from invite link');
      console.log('  - Session error:', sessionError);
      console.log('  - Session:', inviteSession);
      console.log('  - Still showing password setup form...');
      showPasswordSetupGate();
      initialSessionChecked = true; // Mark as checked so we don't process INITIAL_SESSION
      return;
    }
  } else {
    console.log('ℹ️ Not an invite link, proceeding with normal flow');
  }
  
  // Check for existing session first
  console.log('🔍 Checking for existing session...');
  const { data: { session }, error } = await supabase.auth.getSession();
  initialSessionChecked = true;
  
  if (error) {
    console.error('❌ Session error:', error);
  }
  
  console.log('📋 Initial session check result:', session ? '✅ Found session' : '❌ No session');
  if (session) {
    console.log('  - Session user:', session.user?.email);
    console.log('  - Session expires at:', new Date(session.expires_at * 1000));
    console.log('  - Current time:', new Date());
    console.log('  - Session expired?', new Date(session.expires_at * 1000) < new Date());
  }
  
  // Only process if we have a session and haven't already processed it via onAuthStateChange
  if (session && !isProcessingSession) {
    console.log('✅ Session found, setting up profile and showing app...');
    state.session = session;
    isProcessingSession = true;
    
    // Create fallback profile immediately so UI can show
    if (!state.profile) {
      state.profile = {
        id: session.user.id,
        full_name: session.user.user_metadata.full_name || session.user.email || "User",
        can_manage: false,
      };
      console.log('  - Created temporary profile:', state.profile);
    }
    
    // Show app immediately, don't wait for profile fetch
    console.log('  - Showing app immediately...');
    showApp();
    
    // Load data in background (non-blocking)
    // Fetch profile FIRST, then load data
    const profileTimeout = setTimeout(() => {
      console.log('  - ⚠️ Profile fetch timeout, keeping temporary profile');
      isProcessingSession = false;
    }, 2000); // 2 second timeout
    
    fetchProfile().then(() => {
      clearTimeout(profileTimeout);
      console.log('✅ Profile fetch complete, state.profile:', state.profile);
      console.log('  - team_id available:', state.profile?.team_id);
      
      // NOW load data after profile is loaded
      Promise.all([loadSongs(), loadSets(), loadPeople()]).then(() => {
        console.log('✅ Data loading complete');
        // Refresh the active tab to show newly loaded data
        refreshActiveTab();
      }).catch(err => {
        console.error('❌ Error loading data:', err);
      });
      
      // Update UI in case profile changed (e.g., can_manage status)
      console.log('  - Updating UI with final profile');
      showApp();
      isProcessingSession = false;
    }).catch(err => {
      clearTimeout(profileTimeout);
      console.error('❌ Error fetching profile:', err);
      isProcessingSession = false;
    });
  } else if (!session) {
    console.log('❌ No session, calling showAuthGate()');
    showAuthGate();
  } else {
    console.log('⏳ Session already being processed by auth state change handler');
  }
  
  // Handle recovery or other auth redirects - clear hash after processing
  if (isRecovery || (hasAccessToken && !isRecovery)) {
    // Supabase will handle this via detectSessionInUrl, but we'll clean up the URL after processing
    // Don't clear it yet if we're showing password setup or reset
    if (!state.isPasswordSetup && !state.isPasswordReset) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
}

function bindEvents() {
  console.log('🔗 bindEvents() called');
  console.log('  - authForm element:', authForm);
  console.log('  - loginEmailInput element:', loginEmailInput);
  console.log('  - loginPasswordInput element:', loginPasswordInput);
  console.log('  - authSubmitBtn element:', authSubmitBtn);
  
  // Database error retry button
  const retryBtn = el('database-error-retry');
  retryBtn?.addEventListener('click', async () => {
    hideDatabaseError();
    // Try to reconnect by testing a simple query
    try {
      const { error } = await safeSupabaseOperation(async () => {
        return await supabase.from('profiles').select('id').limit(1);
      });
      
      if (!error || !isDatabaseUnresponsive(error)) {
        // Database is responsive, reload data
        if (state.session) {
          await Promise.all([fetchProfile(), loadSongs(), loadSets(), loadPeople()]);
          refreshActiveTab();
        }
      } else {
        // Still unresponsive, show error again
        showDatabaseError();
      }
    } catch (err) {
      console.error('Retry failed:', err);
      showDatabaseError();
    }
  });
  
  authForm?.addEventListener("submit", handleAuth);
  
  // Toggle signup mode for team leaders
  const toggleSignupBtn = el("toggle-signup");
  toggleSignupBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    updateAuthUI();
  });
  
  // Forgot password link
  const forgotPasswordLink = el("forgot-password-link");
  forgotPasswordLink?.addEventListener("click", (e) => {
    e.preventDefault();
    showForgotPasswordForm();
  });
  
  // Back to login link
  const backToLoginLink = el("back-to-login-link");
  backToLoginLink?.addEventListener("click", (e) => {
    e.preventDefault();
    showLoginForm();
  });
  
  // Forgot password form submit
  forgotPasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleForgotPasswordSubmit();
  });
  
  // Account management
  el("btn-edit-account")?.addEventListener("click", () => openEditAccountModal());
  
  // Team settings button (owners only)
  el("btn-team-settings")?.addEventListener("click", () => {
    if (isOwner()) {
      openTeamSettingsModal();
    }
  });
  
  // Team settings modal
  el("team-settings-form")?.addEventListener("submit", handleTeamSettingsSubmit);
  el("cancel-team-settings")?.addEventListener("click", () => closeTeamSettingsModal());
  el("close-team-settings-modal")?.addEventListener("click", () => closeTeamSettingsModal());
  el("btn-delete-team-settings")?.addEventListener("click", () => {
    closeTeamSettingsModal();
    deleteTeam();
  });
  el("team-settings-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "team-settings-modal") {
      closeTeamSettingsModal();
    }
  });
  el("btn-leave-team")?.addEventListener("click", () => {
    const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
    if (currentTeam) {
      openLeaveTeamModal(currentTeam.id, currentTeam.name);
    }
  });
  
  // Leave team modal
  el("confirm-leave-team")?.addEventListener("click", async () => {
    const modal = el("leave-team-modal");
    if (modal && modal.dataset.teamId && modal.dataset.teamName) {
      await leaveTeam(modal.dataset.teamId, modal.dataset.teamName);
    }
  });
  el("cancel-leave-team")?.addEventListener("click", () => closeLeaveTeamModal());
  el("close-leave-team-modal")?.addEventListener("click", () => closeLeaveTeamModal());
  el("leave-team-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "leave-team-modal") {
      closeLeaveTeamModal();
    }
  });
  
  // Edit account modal
  el("edit-account-form")?.addEventListener("submit", handleEditAccountSubmit);
  el("cancel-edit-account")?.addEventListener("click", () => closeEditAccountModal());
  el("close-edit-account-modal")?.addEventListener("click", () => closeEditAccountModal());
  el("edit-account-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "edit-account-modal") {
      closeEditAccountModal();
    }
  });
  el("btn-delete-account")?.addEventListener("click", () => deleteAccount());
  
  
  // Account switcher
  const accountMenuBtn = el("btn-account-menu");
  const accountMenu = el("account-menu");
  accountMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    accountMenu?.classList.toggle("hidden");
  });
  
  // Close account menu when clicking outside
  document.addEventListener("click", (e) => {
    if (accountMenu && !accountMenu.contains(e.target) && !accountMenuBtn?.contains(e.target)) {
      accountMenu.classList.add("hidden");
    }
    // Close person menus when clicking outside
    document.querySelectorAll(".person-menu").forEach(menu => {
      const menuBtn = document.querySelector(`.person-menu-btn[data-person-id="${menu.dataset.personId}"]`);
      if (menu && !menu.contains(e.target) && (!menuBtn || !menuBtn.contains(e.target))) {
        menu.classList.add("hidden");
      }
    });
  });
  
  // Account menu buttons
  el("btn-create-team")?.addEventListener("click", () => {
    el("account-menu")?.classList.add("hidden");
    openCreateTeamModal();
  });
  
  // Empty state create team button
  el("btn-create-team-empty")?.addEventListener("click", () => {
    openCreateTeamModal();
  });
  
  el("btn-logout-menu")?.addEventListener("click", () => {
    supabase.auth.signOut();
  });
  
  // Team switcher - handled in updateTeamSwitcher via click events
  
  // Create team modal
  el("create-team-form")?.addEventListener("submit", handleCreateTeamSubmit);
  el("cancel-create-team")?.addEventListener("click", () => {
    el("create-team-modal")?.classList.add("hidden");
    document.body.style.overflow = "";
  });
  el("close-create-team-modal")?.addEventListener("click", () => {
    el("create-team-modal")?.classList.add("hidden");
    document.body.style.overflow = "";
  });
  
  // Password setup form
  const passwordSetupForm = el("password-setup-form");
  passwordSetupForm?.addEventListener("submit", handlePasswordSetup);
  createSetBtn?.addEventListener("click", () => openSetModal());
  el("btn-invite-member")?.addEventListener("click", () => openInviteModal());
  
  // Member view toggle (header button)
  el("btn-view-as-member")?.addEventListener("click", () => {
    state.isMemberView = true;
    showApp();
    // Refresh current view (could be dashboard or set detail)
    const setDetailView = el("set-detail");
    if (setDetailView && !setDetailView.classList.contains("hidden") && state.selectedSet) {
      showSetDetail(state.selectedSet);
    } else {
      refreshActiveTab();
    }
  });
  
  // Member view toggle (set detail button)
  el("btn-view-as-member-detail")?.addEventListener("click", () => {
    state.isMemberView = true;
    showApp();
    // Refresh set detail view
    if (state.selectedSet) {
      showSetDetail(state.selectedSet);
    } else {
      refreshActiveTab();
    }
  });
  
  el("btn-exit-member-view")?.addEventListener("click", () => {
    state.isMemberView = false;
    showApp();
    // Refresh current view (could be dashboard or set detail)
    const setDetailView = el("set-detail");
    if (setDetailView && !setDetailView.classList.contains("hidden") && state.selectedSet) {
      showSetDetail(state.selectedSet);
    } else {
      refreshActiveTab();
    }
  });
  el("close-invite-modal")?.addEventListener("click", () => closeInviteModal());
  el("cancel-invite")?.addEventListener("click", () => closeInviteModal());
  
  // In-app invite modal
  el("invite-form")?.addEventListener("submit", handleInviteSubmit);
  el("close-edit-person-modal")?.addEventListener("click", () => closeEditPersonModal());
  el("cancel-edit-person")?.addEventListener("click", () => closeEditPersonModal());
  el("edit-person-form")?.addEventListener("submit", handleEditPersonSubmit);
  
  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
  
  // Songs tab search
  el("songs-tab-search")?.addEventListener("input", () => {
    renderSongCatalog();
  });
  
  // People tab search
  el("people-tab-search")?.addEventListener("input", () => {
    renderPeople();
  });
  
  // Window resize handler for recalculating assignment pills
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Only recalculate if sets tab is visible
      const setsTab = el("sets-tab");
      if (setsTab && !setsTab.classList.contains("hidden")) {
        recalculateAllAssignmentPills();
      }
    }, 150);
  });
  
  el("btn-back")?.addEventListener("click", () => hideSetDetail());
  
  // Set detail tab switching (mobile only) - use event delegation
  document.addEventListener("click", (e) => {
    const tabBtn = e.target.closest(".set-detail-tabs .tab-btn");
    if (tabBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const tab = tabBtn.dataset.detailTab;
      if (tab) {
        switchSetDetailTab(tab);
      }
      return false;
    }
  }, true); // Use capture phase to catch event early
  el("btn-export-set-print")?.addEventListener("click", () => {
    if (state.selectedSet) {
      openPrintSet(state.selectedSet);
    }
  });
  el("btn-edit-set-detail")?.addEventListener("click", () => {
    if (state.selectedSet) {
      // Open the modal without hiding the detail view
      // The modal will overlay on top of the detail view
      const setToEdit = state.selectedSet;
      openSetModal(setToEdit);
      // Don't hide the detail view - we want to stay on it after closing the modal
    }
  });
  el("btn-delete-set-detail")?.addEventListener("click", () => {
    if (state.selectedSet) {
      deleteSet(state.selectedSet);
      hideSetDetail();
    }
  });
  
  // Header dropdown toggle (desktop)
  el("btn-header-add-toggle")?.addEventListener("click", (e) => {
    // Extra safety: if user isn't a manager (or is in member view), do nothing
    if (!isManager()) return;
    e.stopPropagation();
    const dropdownMenu = el("header-add-dropdown-menu");
    if (dropdownMenu) {
      dropdownMenu.classList.toggle("hidden");
    }
  });
  
  // Mobile header dropdown toggle
  el("btn-mobile-header-add-toggle")?.addEventListener("click", (e) => {
    // Extra safety: if user isn't a manager (or is in member view), do nothing
    if (!isManager()) return;
    e.stopPropagation();
    const dropdownMenu = el("mobile-header-add-dropdown-menu");
    const button = e.currentTarget;
    if (dropdownMenu && button) {
      const isHidden = dropdownMenu.classList.contains("hidden");
      if (isHidden) {
        // Get click position relative to the button
        const buttonRect = button.getBoundingClientRect();
        const clickX = e.clientX - buttonRect.left;
        
        // Position dropdown based on click position
        // Align the left edge of dropdown with the click position
        const dropdownWidth = 180; // min-width from CSS
        const container = button.closest('.header-dropdown-container');
        
        if (container) {
          const containerRect = container.getBoundingClientRect();
          
          // Start with click position as left edge
          let leftPosition = clickX;
          
          // Ensure dropdown doesn't go off the right edge of container
          const maxLeft = containerRect.width - dropdownWidth;
          if (leftPosition > maxLeft) {
            leftPosition = maxLeft;
          }
          
          // Ensure dropdown doesn't go off the left edge of container
          if (leftPosition < 0) {
            leftPosition = 0;
          }
          
          dropdownMenu.style.left = `${leftPosition}px`;
          dropdownMenu.style.right = 'auto';
        }
      }
      dropdownMenu.classList.toggle("hidden");
    }
  });
  
  // Header dropdown items (desktop)
  el("btn-header-add-song")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openSongModal();
    }
  });
  
  el("btn-header-add-tag")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openTagModal();
    }
  });
  
  el("btn-header-add-section")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openSectionModal();
    }
  });
  
  el("btn-header-add-section-header")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openSectionHeaderModal();
    }
  });
  
  // Mobile header dropdown items
  el("btn-mobile-header-add-song")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openSongModal();
    }
  });
  
  el("btn-mobile-header-add-tag")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openTagModal();
    }
  });
  
  el("btn-mobile-header-add-section")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openSectionModal();
    }
  });
  
  el("btn-mobile-header-add-section-header")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHeaderDropdown();
    if (state.selectedSet) {
      openSectionHeaderModal();
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const container = el("header-add-dropdown-container");
    const menu = el("header-add-dropdown-menu");
    const mobileContainer = el("mobile-header-add-dropdown-container");
    const mobileMenu = el("mobile-header-add-dropdown-menu");
    if (container && menu && !container.contains(e.target) && !menu.classList.contains("hidden")) {
      closeHeaderDropdown();
    }
    if (mobileContainer && mobileMenu && !mobileContainer.contains(e.target) && !mobileMenu.classList.contains("hidden")) {
      closeHeaderDropdown();
    }
  });
  el("close-set-modal")?.addEventListener("click", () => closeSetModal());
  el("cancel-set")?.addEventListener("click", () => closeSetModal());
  el("set-form")?.addEventListener("submit", handleSetSubmit);
  el("btn-edit-times")?.addEventListener("click", () => openTimesModal());
  el("btn-edit-times-mobile")?.addEventListener("click", () => openTimesModal());
  el("btn-edit-assignments")?.addEventListener("click", () => openSetAssignmentsModal());
  el("btn-edit-assignments-mobile")?.addEventListener("click", () => openSetAssignmentsModal());
  el("close-times-modal")?.addEventListener("click", () => closeTimesModal());
  el("cancel-times")?.addEventListener("click", () => closeTimesModal());
  el("times-form")?.addEventListener("submit", handleTimesSubmit);
  el("close-set-assignments-modal")?.addEventListener("click", () => closeSetAssignmentsModal());
  el("cancel-set-assignments")?.addEventListener("click", () => closeSetAssignmentsModal());
  el("set-assignments-form")?.addEventListener("submit", handleSetAssignmentsSubmit);
  el("close-assignment-details-modal")?.addEventListener("click", () => {
    const modal = el("assignment-details-modal");
    if (modal) {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
    }
  });
  el("btn-add-set-assignment")?.addEventListener("click", () => addSetAssignmentInput());
  el("btn-add-service-time")?.addEventListener("click", () => addServiceTimeRow());
  el("btn-add-rehearsal-time")?.addEventListener("click", () => addRehearsalTimeRow());
  el("btn-add-song")?.addEventListener("click", () => openSongModal());
  el("close-song-modal")?.addEventListener("click", () => closeSongModal());
  el("cancel-song")?.addEventListener("click", () => closeSongModal());
  el("close-tag-modal")?.addEventListener("click", () => closeTagModal());
  el("cancel-tag")?.addEventListener("click", () => closeTagModal());
  el("tag-form")?.addEventListener("submit", handleAddTagToSong);
  el("close-section-modal")?.addEventListener("click", () => closeSectionModal());
  el("cancel-section")?.addEventListener("click", () => closeSectionModal());
  el("close-section-header-modal")?.addEventListener("click", () => closeSectionHeaderModal());
  el("cancel-section-header")?.addEventListener("click", () => closeSectionHeaderModal());
  el("song-form")?.addEventListener("submit", handleAddSongToSet);
  el("section-form")?.addEventListener("submit", handleAddSectionToSet);
  el("section-header-form")?.addEventListener("submit", handleAddSectionHeaderToSet);
  el("create-song-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    state.creatingSongFromModal = true;
    // Don't close the song modal, just open the edit modal on top
    openSongEditModal();
  });
  el("btn-add-assignment")?.addEventListener("click", addAssignmentInput);
  el("btn-add-section-assignment")?.addEventListener("click", () => addAssignmentInput("section-assignments-list"));
  el("btn-create-song")?.addEventListener("click", () => openSongEditModal());
  el("btn-edit-song-from-set")?.addEventListener("click", () => {
    // Get the current song from the edit-set-song modal
    const form = el("edit-set-song-form");
    const songId = form.dataset.songId;
    if (songId) {
      closeEditSetSongModal();
      openSongEditModal(songId);
    }
  });
  el("close-song-edit-modal")?.addEventListener("click", () => closeSongEditModal());
  el("cancel-song-edit")?.addEventListener("click", () => closeSongEditModal());
  el("song-edit-form")?.addEventListener("submit", handleSongEditSubmit);
  el("btn-add-song-key")?.addEventListener("click", () => addSongKeyInput());
  el("close-song-details-modal")?.addEventListener("click", () => closeSongDetailsModal());
  
  // Format duration input to help with MM:SS entry
  const durationInput = el("song-edit-duration");
  if (durationInput) {
    durationInput.addEventListener("input", (e) => {
      let value = e.target.value.replace(/[^\d:]/g, ""); // Remove non-digits and colons
      
      // Auto-format as user types
      if (value.length > 0 && !value.includes(":")) {
        // If they type just numbers, format it
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 60) {
          const mins = Math.floor(num / 60);
          const secs = num % 60;
          value = `${mins}:${secs.toString().padStart(2, "0")}`;
        }
      }
      
      // Limit to reasonable format (max 999:59)
      const parts = value.split(":");
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10);
        const secs = parts[1];
        if (!isNaN(mins) && mins > 999) {
          value = "999:59";
        } else if (secs && secs.length === 2) {
          const secNum = parseInt(secs, 10);
          if (!isNaN(secNum) && secNum >= 60) {
            value = `${mins + 1}:00`;
          }
        }
      }
      
      e.target.value = value;
    });
    
    // Validate on blur
    durationInput.addEventListener("blur", (e) => {
      const value = e.target.value.trim();
      if (value && !parseDuration(value)) {
        // Invalid format, try to fix it
        const fixed = parseDuration(value);
        if (fixed !== null) {
          e.target.value = formatDuration(fixed);
        } else {
          // Show placeholder hint
          e.target.setAttribute("placeholder", "3:45");
        }
      }
    });
  }
  
  el("close-edit-set-song-modal")?.addEventListener("click", () => closeEditSetSongModal());
  el("cancel-edit-set-song")?.addEventListener("click", () => closeEditSetSongModal());
  el("edit-set-song-form")?.addEventListener("submit", handleEditSetSongSubmit);
  el("btn-add-edit-assignment")?.addEventListener("click", addEditAssignmentInput);
  
  console.log('  - ✅ Events bound');
  
  // Cleanup: stop metronome on page unload
  window.addEventListener("beforeunload", () => {
    stopMetronome();
  });
}

function showAuthGate() {
  console.log('🔒 showAuthGate() called');
  console.log('  - authGate element:', authGate);
  console.log('  - dashboard element:', dashboard);
  console.log('  - Current state.session:', state.session);
  console.log('  - Current state.profile:', state.profile);
  
  // Always close set details when showing auth gate
  hideSetDetail();
  
  const passwordSetupGate = el("password-setup-gate");
  if (passwordSetupGate) passwordSetupGate.classList.add("hidden");
  
  const emptyState = el("empty-state");
  if (emptyState) emptyState.classList.add("hidden");
  
  if (authGate) authGate.classList.remove("hidden");
  if (dashboard) dashboard.classList.add("hidden");
  if (userInfo) userInfo.classList.add("hidden");
  if (createSetBtn) createSetBtn.classList.add("hidden");
  setAuthMessage("");
  isSignUpMode = false;
  updateAuthUI();
  
  // Ensure login form is shown (not forgot password form)
  showLoginForm();
  
  console.log('  - authGate hidden class removed:', !authGate?.classList.contains('hidden'));
  console.log('  - dashboard hidden class added:', dashboard?.classList.contains('hidden'));
}

function showPasswordSetupGate() {
  console.log('🔐 showPasswordSetupGate() called');
  console.log('  - isPasswordReset:', state.isPasswordReset);
  console.log('  - isPasswordSetup:', state.isPasswordSetup);
  
  // Always close set details when showing password setup gate
  hideSetDetail();
  
  const passwordSetupGate = el("password-setup-gate");
  const authGateEl = el("auth-gate");
  const dashboardEl = el("dashboard");
  
  if (passwordSetupGate) passwordSetupGate.classList.remove("hidden");
  if (authGateEl) authGateEl.classList.add("hidden");
  if (dashboardEl) dashboardEl.classList.add("hidden");
  
  setPasswordSetupMessage("");
  const form = el("password-setup-form");
  if (form) form.reset();
  
  // Update text based on whether it's password reset or setup
  const heading = passwordSetupGate?.querySelector('h2');
  const description = passwordSetupGate?.querySelector('p:not(.muted)');
  const submitButton = el("password-setup-submit-btn");
  
  if (state.isPasswordReset) {
    // Password reset mode
    if (heading) heading.textContent = "Reset Your Password";
    if (description) description.textContent = "Please enter a new password for your account.";
    if (submitButton) submitButton.textContent = "Reset Password";
  } else {
    // Password setup mode (invite link)
    if (heading) heading.textContent = "Set Up Your Account";
    if (description) description.textContent = "Please set a password to complete your account setup.";
    if (submitButton) submitButton.textContent = "Set Password";
  }
  
  // Show the user's email if we have a session
  if (state.session?.user?.email) {
    const emailDisplay = passwordSetupGate?.querySelector('.password-setup-email');
    if (emailDisplay) {
      emailDisplay.textContent = state.session.user.email;
      emailDisplay.parentElement?.classList.remove('hidden');
    }
  }
}

function showApp() {
  console.log('✅ showApp() called');
  console.log('  - state.session:', !!state.session);
  console.log('  - state.profile:', state.profile);
  
  // Re-fetch elements in case they weren't available during init
  const authGateEl = el("auth-gate");
  const passwordSetupGateEl = el("password-setup-gate");
  const dashboardEl = el("dashboard");
  const userInfoEl = el("user-info");
  const userNameEl = el("user-name");
  const createSetBtnEl = el("btn-create-set");
  const createSongBtnEl = el("btn-create-song");
  const inviteMemberBtnEl = el("btn-invite-member");
  
  console.log('  - authGate element:', authGateEl);
  console.log('  - passwordSetupGate element:', passwordSetupGateEl);
  console.log('  - dashboard element:', dashboardEl);
  console.log('  - userInfo element:', userInfoEl);
  
  if (!authGateEl || !dashboardEl) {
    console.error('❌ Critical elements not found! authGate:', !!authGateEl, 'dashboard:', !!dashboardEl);
    return;
  }
  
  // Check if user has no teams - show empty state
  if (!state.currentTeamId || state.userTeams.length === 0) {
    showEmptyState();
    return;
  }
  
  // Force hide auth gate, password setup gate, and show dashboard
  authGateEl.classList.add("hidden");
  if (passwordSetupGateEl) passwordSetupGateEl.classList.add("hidden");
  dashboardEl.classList.remove("hidden");
  el("empty-state")?.classList.add("hidden");
  
  // Check if there's a saved set ID - if so, don't hide set details yet
  // (restoration will happen after sets are loaded)
  const savedSetId = localStorage.getItem('cadence-selected-set-id');
  if (!savedSetId) {
    // No saved set ID, hide set detail view normally
    hideSetDetail();
  }
  // If there's a saved set ID, we'll restore it after sets are loaded (in loadSets or renderSets)
  
  // Restore the saved tab, defaulting to "sets" if none is saved
  const savedTab = localStorage.getItem('cadence-active-tab') || 'sets';
  switchTab(savedTab);
  
  if (userInfoEl) {
    userInfoEl.classList.remove("hidden");
  }
  
  if (userNameEl) {
    userNameEl.textContent = state.profile?.full_name ?? "Signed In";
  }
  
  // Update team switcher
  updateTeamSwitcher();
  
  // Update team name header above tabs
  const teamNameDisplay = el("team-name-display");
  const teamNameHeader = el("team-name-header");
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  if (teamNameDisplay && currentTeam) {
    teamNameDisplay.textContent = currentTeam.name;
    if (teamNameHeader) {
      teamNameHeader.classList.remove("hidden");
    }
  } else if (teamNameHeader) {
    teamNameHeader.classList.add("hidden");
  }
  
  // Show/hide manager buttons based on actual manager status (not member view)
  const viewAsMemberBtn = el("btn-view-as-member");
  const memberViewBanner = el("member-view-banner");
  
  if (state.profile?.can_manage) {
    // Show "View as Member" button if user is a manager
    if (viewAsMemberBtn) {
      viewAsMemberBtn.classList.remove("hidden");
      // Grey out the button when already in member view
      if (state.isMemberView) {
        viewAsMemberBtn.classList.add("disabled");
        viewAsMemberBtn.disabled = true;
      } else {
        viewAsMemberBtn.classList.remove("disabled");
        viewAsMemberBtn.disabled = false;
      }
    }
  } else {
    // Hide "View as Member" button if user is not a manager
    if (viewAsMemberBtn) viewAsMemberBtn.classList.add("hidden");
  }
  
  // Show/hide member view banner
  if (state.isMemberView) {
    if (memberViewBanner) memberViewBanner.classList.remove("hidden");
  } else {
    if (memberViewBanner) memberViewBanner.classList.add("hidden");
  }
  
  // Show/hide management buttons based on isManager() (respects member view)
  if (isManager()) {
    if (createSetBtnEl) createSetBtnEl.classList.remove("hidden");
    if (createSongBtnEl) createSongBtnEl.classList.remove("hidden");
    if (inviteMemberBtnEl) inviteMemberBtnEl.classList.remove("hidden");
  } else {
    if (createSetBtnEl) createSetBtnEl.classList.add("hidden");
    if (createSongBtnEl) createSongBtnEl.classList.add("hidden");
    if (inviteMemberBtnEl) inviteMemberBtnEl.classList.add("hidden");
  }
  
  // Show/hide team settings button for owners only
  const teamSettingsBtn = el("btn-team-settings");
  if (isOwner()) {
    if (teamSettingsBtn) teamSettingsBtn.classList.remove("hidden");
  } else {
    if (teamSettingsBtn) teamSettingsBtn.classList.add("hidden");
  }
  
  // Verify the changes took effect
  const authGateHidden = authGateEl.classList.contains('hidden');
  const dashboardVisible = !dashboardEl.classList.contains('hidden');
  
  console.log('  - authGate hidden:', authGateHidden);
  console.log('  - dashboard visible:', dashboardVisible);
  
  if (!authGateHidden || !dashboardVisible) {
    console.error('❌ UI update failed! Forcing update...');
    // Force update with setTimeout to ensure DOM has processed
    setTimeout(() => {
      authGateEl.classList.add("hidden");
      dashboardEl.classList.remove("hidden");
      console.log('  - Forced update complete');
    }, 0);
  }
}

function showEmptyState() {
  const authGateEl = el("auth-gate");
  const passwordSetupGateEl = el("password-setup-gate");
  const dashboardEl = el("dashboard");
  const emptyStateEl = el("empty-state");
  const userInfoEl = el("user-info");
  const userNameEl = el("user-name");
  
  if (!emptyStateEl) return;
  
  // Hide auth gate, password setup gate, dashboard
  if (authGateEl) authGateEl.classList.add("hidden");
  if (passwordSetupGateEl) passwordSetupGateEl.classList.add("hidden");
  if (dashboardEl) dashboardEl.classList.add("hidden");
  
  // Show empty state and user info
  emptyStateEl.classList.remove("hidden");
  if (userInfoEl) userInfoEl.classList.remove("hidden");
  if (userNameEl) userNameEl.textContent = state.profile?.full_name ?? "Signed In";
  
  // Update team switcher
  updateTeamSwitcher();
}

function resetState() {
  state.profile = null;
  state.sets = [];
  state.songs = [];
  state.people = [];
  state.pendingInvites = [];
  state.selectedSet = null;
  state.currentSetSongs = [];
  state.currentTeamId = null;
  state.userTeams = [];
  setsList.innerHTML = "";
}

// toggleAuthMode removed - no manual signup allowed
// Users must be invited by a manager

function updateAuthUI() {
  // Show login/signup toggle for team leaders
  const heading = authGate?.querySelector("h2");
  const description = authGate?.querySelector("p:first-of-type");
  
  if (isSignUpMode) {
    if (heading) heading.textContent = "Team Leader Signup";
    if (description) description.textContent = "Sign up and create a new team. If you're joining a team, ask your team leader to invite you instead.";
    if (authSubmitBtn) authSubmitBtn.textContent = "Create Team";
  } else {
    if (heading) heading.textContent = "Login";
    if (description) description.textContent = "Sign in with your email and password.";
    if (authSubmitBtn) authSubmitBtn.textContent = "Sign in";
  }
  
  // Show signup toggle
  const toggleSignup = el("toggle-signup");
  const toggleParagraph = toggleSignup?.parentElement;
  if (toggleParagraph && toggleSignup) {
    toggleParagraph.style.display = "block";
    toggleSignup.textContent = isSignUpMode 
      ? "Already have an account? Sign in" 
      : "Team leader? Create a team";
  }
}

async function handleAuth(event) {
  console.log('🔐 handleAuth() called');
  console.log('  - isSignUpMode:', isSignUpMode);
  event.preventDefault();
  const email = loginEmailInput?.value.trim();
  const password = loginPasswordInput?.value;

  console.log('  - Email provided:', !!email);
  console.log('  - Password provided:', !!password);

  if (!email || !password) {
    console.log('  - ❌ Missing email or password');
    setAuthMessage("Please enter both email and password.", true);
    return;
  }

  if (password.length < 6) {
    console.log('  - ❌ Password too short');
    setAuthMessage("Password must be at least 6 characters.", true);
    return;
  }

  console.log('  - ✅ Validation passed, proceeding with auth');
  toggleAuthButton(true);
  
  if (isSignUpMode) {
    // Team leader signup - create account and team
    setAuthMessage("Creating team...");
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (signUpError) {
      console.error('Signup error:', signUpError);
      
      // Handle rate limiting with a user-friendly message
      if (signUpError.status === 429 || signUpError.message?.includes('security purposes')) {
        const waitTimeMatch = signUpError.message?.match(/(\d+)\s+seconds?/);
        const waitTime = waitTimeMatch ? waitTimeMatch[1] : 'a few';
        setAuthMessage(`Too many signup attempts. Please wait ${waitTime} seconds before trying again.`, true);
      } else {
        setAuthMessage(signUpError.message || "Unable to create account. Please try again.", true);
      }
      
      toggleAuthButton(false);
      return;
    }
    
    if (!signUpData.user) {
      setAuthMessage("Unable to create account. Please try again.", true);
      toggleAuthButton(false);
      return;
    }
    
    // Create profile first, then team, then update profile with team_id
    // Order matters: profile must exist before team (foreign key constraint)
    // Use RPC function to create team since user might not have a session yet
    // (if email confirmation is enabled, signUp doesn't create a session)
    const teamName = email.split('@')[0] + "'s Team"; // Default team name
    
    // Step 1: Create profile first (without team_id, will update later)
    // Use RPC function to create profile since user might not have a session yet
    let profileData;
    let profileError;
    
    // Try using the function first (works even without session)
    const { data: profileId, error: profileFunctionError } = await supabase
      .rpc('create_profile_for_user', {
        p_user_id: signUpData.user.id,
        p_full_name: signUpData.user.user_metadata?.full_name || email,
        p_email: email.toLowerCase(),
        p_is_owner: true,
        p_can_manage: true
      });
    
    // If function doesn't exist or fails, fall back to direct insert
    if (profileFunctionError && (profileFunctionError.code === '42883' || profileFunctionError.message?.includes('function'))) {
      console.log('Profile function not available, trying direct insert...');
      const { data: directProfileData, error: directProfileError } = await supabase
        .from("profiles")
        .insert({
          id: signUpData.user.id,
          full_name: signUpData.user.user_metadata?.full_name || email,
          email: email.toLowerCase(),
          team_id: null, // Will be set after team creation
          is_owner: true,
          can_manage: true
        })
        .select()
        .single();
      
      profileData = directProfileData;
      profileError = directProfileError;
    } else if (profileFunctionError) {
      // Function exists but returned an error
      profileError = profileFunctionError;
    } else if (profileId) {
      // Function succeeded - construct profile data from what we know
      // We don't need to fetch it since we know all the values we just inserted
      profileData = {
        id: profileId,
        full_name: signUpData.user.user_metadata?.full_name || email,
        email: email.toLowerCase(),
        team_id: null, // Will be set after team creation
        is_owner: true,
        can_manage: true
      };
    } else {
      profileError = new Error('Profile creation function returned no ID');
    }
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      setAuthMessage("Account created but profile creation failed. Please contact support.", true);
      toggleAuthButton(false);
      return;
    }
    
    if (!profileData || !profileData.id) {
      console.error('Profile creation failed: No profile data returned');
      setAuthMessage("Account created but profile creation failed. Please contact support.", true);
      toggleAuthButton(false);
      return;
    }
    
    // Step 2: Create team (now that profile exists, owner_id foreign key will work)
    let teamData;
    let teamError;
    
    // Try using the function first (works even without session)
    const { data: teamId, error: teamFunctionError } = await supabase
      .rpc('create_team_for_user', {
        p_team_name: teamName,
        p_owner_id: signUpData.user.id
      });
    
    // If function doesn't exist or fails, fall back to direct insert
    if (teamFunctionError && (teamFunctionError.code === '42883' || teamFunctionError.message?.includes('function'))) {
      console.log('Function not available, trying direct insert...');
      const { data: directTeamData, error: directTeamError } = await supabase
        .from("teams")
        .insert({
          name: teamName,
          owner_id: signUpData.user.id
        })
        .select()
        .single();
      
      teamData = directTeamData;
      teamError = directTeamError;
    } else if (teamFunctionError) {
      // Function exists but returned an error
      teamError = teamFunctionError;
    } else if (teamId) {
      // Function succeeded - construct team data from what we know
      // We don't need to fetch it since we know all the values we just inserted
      teamData = {
        id: teamId,
        name: teamName,
        owner_id: signUpData.user.id
      };
    } else {
      teamError = new Error('Team creation function returned no ID');
    }
    
    if (teamError) {
      console.error('Team creation error:', teamError);
      // Clean up: delete the profile we just created
      await supabase.from("profiles").delete().eq("id", signUpData.user.id);
      setAuthMessage("Account created but team creation failed. Please contact support.", true);
      toggleAuthButton(false);
      return;
    }
    
    if (!teamData || !teamData.id) {
      console.error('Team creation failed: No team data returned');
      // Clean up: delete the profile we just created
      await supabase.from("profiles").delete().eq("id", signUpData.user.id);
      setAuthMessage("Account created but team creation failed. Please contact support.", true);
      toggleAuthButton(false);
      return;
    }
    
    // Step 3: Add user to team_members as owner
    const { error: teamMemberError } = await supabase
      .from("team_members")
      .insert({
        team_id: teamData.id,
        user_id: signUpData.user.id,
        role: 'owner',
        is_owner: true,
        can_manage: true
      });
    
    if (teamMemberError) {
      console.error('Team member creation error:', teamMemberError);
      // Clean up: delete both profile and team
      await supabase.from("teams").delete().eq("id", teamData.id);
      await supabase.from("profiles").delete().eq("id", signUpData.user.id);
      setAuthMessage("Account and team created but team membership failed. Please contact support.", true);
      toggleAuthButton(false);
      return;
    }
    
    // Step 4: Update profile with team_id
    // Use RPC function to update profile since user might not have a session yet
    const { error: updateProfileFunctionError } = await supabase
      .rpc('update_profile_team_id', {
        p_user_id: signUpData.user.id,
        p_team_id: teamData.id
      });
    
    let updateProfileError = updateProfileFunctionError;
    
    // If function doesn't exist, fall back to direct update
    // IMPORTANT: Explicitly preserve full_name to prevent it from being reset to email
    if (updateProfileFunctionError && (updateProfileFunctionError.code === '42883' || updateProfileFunctionError.message?.includes('function'))) {
      console.log('Update function not available, trying direct update...');
      const updateData = { team_id: teamData.id };
      
      // Preserve full_name if it exists (prevent reset to email)
      if (profileData?.full_name) {
        updateData.full_name = profileData.full_name;
      }
      
      const { error: directUpdateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", signUpData.user.id);
      
      updateProfileError = directUpdateError;
    }
    
    if (updateProfileError) {
      console.error('Profile update error:', updateProfileError);
      // Clean up: delete team_members, team, and profile
      await supabase.from("team_members").delete().eq("team_id", teamData.id).eq("user_id", signUpData.user.id);
      await supabase.from("teams").delete().eq("id", teamData.id);
      await supabase.from("profiles").delete().eq("id", signUpData.user.id);
      setAuthMessage("Account and team created but profile update failed. Please contact support.", true);
      toggleAuthButton(false);
      return;
    }
    
    // Update local profileData object with team_id
    profileData.team_id = teamData.id;
    
    setAuthMessage("Team created! Please check your email to verify your account.", false);
    toggleAuthButton(false);
    // Don't auto-login - they need to verify email first
    return;
  } else {
    // Regular login
    setAuthMessage("Signing in…");

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    const error = signInError;
    
    if (!error && signInData.session) {
      console.log('✅ Sign in successful!');
      console.log('  - Session user:', signInData.session.user?.email);
      console.log('  - Session expires at:', new Date(signInData.session.expires_at * 1000));
      
      // Verify session is stored
      const { data: { session: storedSession } } = await supabase.auth.getSession();
      console.log('  - Stored session after sign in:', storedSession ? '✅ Found' : '❌ Not found');
      
      // Update state immediately
      console.log('  - Updating state.session...');
      state.session = signInData.session;
      console.log('  - state.session updated:', !!state.session);
      
    console.log('  - Fetching profile...');
    await fetchProfile();
    console.log('  - Profile fetched, state.profile:', state.profile);
    console.log('  - team_id available:', state.profile?.team_id);
    
    console.log('  - Loading songs, sets, and people...');
    await Promise.all([loadSongs(), loadSets(), loadPeople()]);
    console.log('  - Data loaded');
      
      console.log('  - Calling showApp()...');
      showApp();
      setAuthMessage("");
      authForm?.reset();
      toggleAuthButton(false);
      return;
    }

    if (error) {
      console.error('Auth error:', error);
      
      // Handle rate limiting with a user-friendly message
      if (error.status === 429 || error.message?.includes('security purposes')) {
        const waitTimeMatch = error.message?.match(/(\d+)\s+seconds?/);
        const waitTime = waitTimeMatch ? waitTimeMatch[1] : 'a few';
        setAuthMessage(`Too many login attempts. Please wait ${waitTime} seconds before trying again.`, true);
      } else {
        setAuthMessage(error.message || "Unable to sign in. Please check your credentials.", true);
      }
      
      toggleAuthButton(false);
    } else {
      // Fallback - onAuthStateChange should handle this
      setAuthMessage("");
      authForm?.reset();
      toggleAuthButton(false);
    }
  }
}

function toggleAuthButton(isLoading) {
  if (!authSubmitBtn) return;
  authSubmitBtn.disabled = isLoading;
}

function setAuthMessage(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.classList.toggle("error-text", Boolean(isError));
  authMessage.classList.toggle("muted", !isError);
}

function setPasswordSetupMessage(message, isError = false) {
  const messageEl = el("password-setup-message");
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.classList.toggle("error-text", Boolean(isError));
  messageEl.classList.toggle("muted", !isError);
}

function showForgotPasswordForm() {
  console.log('🔐 showForgotPasswordForm() called');
  
  // Hide login form, show forgot password form
  if (loginFormContainer) loginFormContainer.classList.add("hidden");
  if (forgotPasswordContainer) forgotPasswordContainer.classList.remove("hidden");
  
  // Pre-fill email from login form if available
  if (loginEmailInput?.value && forgotPasswordEmailInput) {
    forgotPasswordEmailInput.value = loginEmailInput.value;
  }
  
  // Focus on email input
  if (forgotPasswordEmailInput) {
    setTimeout(() => forgotPasswordEmailInput.focus(), 100);
  }
  
  // Clear any previous messages
  if (forgotPasswordMessage) {
    forgotPasswordMessage.textContent = "";
    forgotPasswordMessage.classList.remove("error-text", "muted");
  }
}

function showLoginForm() {
  console.log('🔐 showLoginForm() called');
  
  // Hide forgot password form, show login form
  if (forgotPasswordContainer) forgotPasswordContainer.classList.add("hidden");
  if (loginFormContainer) loginFormContainer.classList.remove("hidden");
  
  // Clear forgot password form
  if (forgotPasswordForm) forgotPasswordForm.reset();
  if (forgotPasswordMessage) {
    forgotPasswordMessage.textContent = "";
    forgotPasswordMessage.classList.remove("error-text", "muted");
  }
  
  // Clear auth message
  if (authMessage) {
    authMessage.textContent = "";
    authMessage.classList.remove("error-text", "muted");
  }
}

async function handleForgotPasswordSubmit() {
  console.log('🔐 handleForgotPasswordSubmit() called');
  
  const email = forgotPasswordEmailInput?.value.trim();
  
  if (!email) {
    setForgotPasswordMessage("Please enter your email address.", true);
    return;
  }
  
  await sendPasswordResetEmail(email);
}

function setForgotPasswordMessage(message, isError = false) {
  if (!forgotPasswordMessage) return;
  forgotPasswordMessage.textContent = message;
  forgotPasswordMessage.classList.toggle("error-text", Boolean(isError));
  forgotPasswordMessage.classList.toggle("muted", !isError);
}

async function sendPasswordResetEmail(email) {
  console.log('📧 Sending password reset email to:', email);
  setForgotPasswordMessage("Sending password reset email...", false);
  
  // Disable submit button
  const submitBtn = el("forgot-password-submit-btn");
  if (submitBtn) submitBtn.disabled = true;
  
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    
    if (error) {
      console.error('❌ Error sending password reset email:', error);
      setForgotPasswordMessage(error.message || "Failed to send password reset email. Please try again.", true);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    
    console.log('✅ Password reset email sent successfully');
    setForgotPasswordMessage("Password reset email sent! Please check your inbox and follow the instructions to reset your password.", false);
    
    // Clear the form
    if (forgotPasswordForm) forgotPasswordForm.reset();
    
    // Re-enable button
    if (submitBtn) submitBtn.disabled = false;
  } catch (err) {
    console.error('❌ Unexpected error sending password reset email:', err);
    setForgotPasswordMessage("An unexpected error occurred. Please try again.", true);
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handlePasswordSetup(event) {
  event.preventDefault();
  console.log('🔐 handlePasswordSetup() called');
  
  const password = el("setup-password")?.value;
  const passwordConfirm = el("setup-password-confirm")?.value;
  const submitBtn = el("password-setup-submit-btn");
  
  if (!password || !passwordConfirm) {
    setPasswordSetupMessage("Please enter and confirm your password.", true);
    return;
  }
  
  if (password.length < 6) {
    setPasswordSetupMessage("Password must be at least 6 characters.", true);
    return;
  }
  
  if (password !== passwordConfirm) {
    setPasswordSetupMessage("Passwords do not match.", true);
    return;
  }
  
  // Disable button
  if (submitBtn) submitBtn.disabled = true;
  
  // Show appropriate message based on mode
  if (state.isPasswordReset) {
    setPasswordSetupMessage("Resetting your password...");
  } else {
    setPasswordSetupMessage("Setting up your account...");
  }
  
  setTimeout(() => {
    window.location.reload();
  }, 3000);
  
  // Auto-reload after 5 seconds as fallback - set at function scope so it's always accessible
  let reloadTimeout = setTimeout(() => {
    console.log('⏰ Auto-reloading after 5 seconds (fallback)...');
    window.location.reload();
  }, 5000);
  
  // Store timeout ID globally so it can't be lost
  window.__passwordSetupTimeout = reloadTimeout;
  
  try {
    // Get the current session from the access_token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ No session found:', sessionError);
      clearTimeout(reloadTimeout);
      if (window.__passwordSetupTimeout) {
        clearTimeout(window.__passwordSetupTimeout);
        delete window.__passwordSetupTimeout;
      }
      const errorMsg = state.isPasswordReset 
        ? "Invalid or expired password reset link. Please request a new one."
        : "Invalid invite link. Please request a new invite.";
      setPasswordSetupMessage(errorMsg, true);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    
    console.log('✅ Session found, updating password for user:', session.user.email);
    console.log('  - isPasswordReset:', state.isPasswordReset);
    console.log('  - isPasswordSetup:', state.isPasswordSetup);
    
    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });
    
    if (updateError) {
      console.error('❌ Password update error:', updateError);
      clearTimeout(reloadTimeout);
      if (window.__passwordSetupTimeout) {
        clearTimeout(window.__passwordSetupTimeout);
        delete window.__passwordSetupTimeout;
      }
      setPasswordSetupMessage(updateError.message || "Failed to set password. Please try again.", true);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    
    console.log('✅ Password updated successfully');
    
    if (state.isPasswordReset) {
      // Password reset flow: user already has a profile, just update password and keep them logged in
      console.log('🔄 Password reset complete, keeping user logged in...');
      
      // Clean up URL and reset password reset flag
      window.history.replaceState(null, '', window.location.pathname);
      state.isPasswordReset = false;
      
      // Clear the auto-reload timeout since we're reloading now
      clearTimeout(reloadTimeout);
      if (window.__passwordSetupTimeout) {
        clearTimeout(window.__passwordSetupTimeout);
        delete window.__passwordSetupTimeout;
      }
      
      // Reload the page to show the app (user is already logged in)
      console.log('🔄 Reloading page to show app...');
      window.location.reload();
    } else {
      // Password setup flow (invite link): create profile and migrate invites
      console.log('👤 Creating profile and migrating invites...');
      try {
        await Promise.race([
          createProfileAndMigrateInvites(session.user),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile creation timeout')), 3000)
          )
        ]);
        console.log('✅ Profile created and invites migrated');
      } catch (profileError) {
        console.error('⚠️ Profile creation error or timeout:', profileError);
        // Continue anyway - profile might have been created, or we'll reload and it will be created
      }
      
      // Sign out the user so they can log in with their new password
      console.log('🔓 Signing out user to redirect to login...');
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Sign out timeout')), 2000)
          )
        ]);
      } catch (signOutError) {
        console.error('⚠️ Sign out error or timeout:', signOutError);
        // Continue anyway - we'll reload
      }
      
      // Clean up URL and reset password setup flag
      window.history.replaceState(null, '', window.location.pathname);
      state.isPasswordSetup = false;
      state.session = null;
      state.profile = null;
      
      // Clear the auto-reload timeout since we're reloading now
      clearTimeout(reloadTimeout);
      if (window.__passwordSetupTimeout) {
        clearTimeout(window.__passwordSetupTimeout);
        delete window.__passwordSetupTimeout;
      }
      
      // Reload the page to show the login form
      // This ensures a clean state and the login form appears properly
      console.log('🔄 Reloading page to show login form...');
      window.location.reload();
    }
    
  } catch (err) {
    console.error('❌ Unexpected error in handlePasswordSetup:', err);
    clearTimeout(reloadTimeout);
    if (window.__passwordSetupTimeout) {
      clearTimeout(window.__passwordSetupTimeout);
      delete window.__passwordSetupTimeout;
    }
    setPasswordSetupMessage("An unexpected error occurred. Please try again.", true);
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function createProfileAndMigrateInvites(user) {
  console.log('👤 createProfileAndMigrateInvites() called for user:', user.email);
  
  const userEmail = user.email?.toLowerCase();
  if (!userEmail) {
    console.error('❌ No email found for user');
    return;
  }
  
  // Find the pending invite FIRST - this is critical for auto-adding to team
  const { data: pendingInvite, error: inviteError } = await supabase
    .from("pending_invites")
    .select("*")
    .eq("email", userEmail)
    .maybeSingle();
  
  if (inviteError && inviteError.code !== "PGRST116") {
    console.error('❌ Error finding pending invite:', inviteError);
  }
  
  const fullName = pendingInvite?.full_name || user.user_metadata?.full_name || userEmail;
  const teamId = pendingInvite?.team_id || null;
  
  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  
  if (existingProfile) {
    console.log('👤 Profile already exists, updating with pending invite info...');
    
    // Update profile with team_id from pending invite if it exists
    const updateData = {
      full_name: fullName,
      email: userEmail,
    };
    
    // Always update team_id if we have one from pending invite
    if (teamId) {
      updateData.team_id = teamId;
    }
    
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      // Continue anyway - might still be able to add to team
    } else {
      console.log('✅ Profile updated:', updatedProfile);
      state.profile = updatedProfile;
    }
  } else {
    // Create the profile with team_id from pending invite
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: fullName,
        email: userEmail,
        team_id: teamId,
        is_owner: false,
        can_manage: false,
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('❌ Error creating profile:', profileError);
      // Continue anyway - might still be able to add to team
    } else {
      console.log('✅ Profile created:', newProfile);
      state.profile = newProfile;
    }
  }
  
  // ALWAYS add user to team_members if there's a pending invite with team_id
  // This ensures invited users are automatically added to the team
  if (teamId) {
    console.log('👥 Auto-adding user to team_members for team:', teamId);
    
    // Check if already a member first
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (existingMember) {
      console.log('✅ User already in team_members');
    } else {
      // Use RPC function to bypass RLS (similar to invite flow)
      const { error: teamMemberError } = await supabase
        .rpc('add_team_member', {
          p_team_id: teamId,
          p_user_id: user.id,
          p_role: 'member',
          p_is_owner: false,
          p_can_manage: false
        });
      
      if (teamMemberError && (teamMemberError.code === '42883' || teamMemberError.message?.includes('function'))) {
        // Function doesn't exist, try direct insert
        console.log('⚠️ add_team_member function not available, trying direct insert...');
        const { error: directError } = await supabase
          .from("team_members")
          .insert({
            team_id: teamId,
            user_id: user.id,
            role: 'member',
            is_owner: false,
            can_manage: false
          });
        
        if (directError) {
          // If error is because user is already a member, that's okay
          if (directError.code !== '23505') { // Unique violation
            console.error('❌ Error adding user to team_members:', directError);
          } else {
            console.log('✅ User already in team_members');
          }
        } else {
          console.log('✅ User added to team_members (direct insert)');
        }
      } else if (teamMemberError) {
        // If error is because user is already a member, that's okay
        if (teamMemberError.code !== '23505') { // Unique violation
          console.error('❌ Error adding user to team_members:', teamMemberError);
        } else {
          console.log('✅ User already in team_members');
        }
      } else {
        console.log('✅ User added to team_members (via RPC)');
      }
    }
  }
  
  // Migrate assignments from pending_invite to the new profile
  if (pendingInvite) {
    console.log('🔄 Migrating assignments from pending invite:', pendingInvite.id);
    
    const { error: migrateError } = await supabase
      .from("song_assignments")
      .update({
        person_id: user.id,
        person_name: fullName,
        person_email: userEmail,
        pending_invite_id: null,
      })
      .eq("pending_invite_id", pendingInvite.id);
    
    if (migrateError) {
      console.error('❌ Error migrating assignments:', migrateError);
    } else {
      console.log('✅ Assignments migrated successfully');
    }
    
    // Delete the pending invite
    const { error: deleteError } = await supabase
      .from("pending_invites")
      .delete()
      .eq("id", pendingInvite.id);
    
    if (deleteError) {
      console.error('❌ Error deleting pending invite:', deleteError);
    } else {
      console.log('✅ Pending invite deleted');
    }
  }
}

async function fetchProfile() {
  console.log('👤 fetchProfile() called');
  console.log('  - state.session:', !!state.session);
  console.log('  - state.session.user:', state.session?.user?.id);
  
  if (!state.session?.user?.id) {
    console.error('  - ❌ No session or user ID');
    return;
  }
  
  try {
    console.log('  - Querying profiles table...');
    
    // IMPORTANT: Select team_id explicitly to ensure it's available
    const result = await safeSupabaseOperation(async () => {
      return await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          can_manage,
          is_owner,
          team_id,
          created_at,
          team:team_id (
            id,
            name,
            owner_id
          )
        `)
        .eq("id", state.session.user.id)
        .single();
    }, { timeout: 2000 });
    
    const { data, error } = result;

    console.log('  - Query completed. Error:', error?.code || 'none');
    console.log('  - Data:', data ? 'found' : 'not found');

    // NEW: Always reconcile any pending invites for this logged-in user.
    // There should never be a case where a user with an account remains "pending".
    // This will:
    // - Attach them to any team that has invited them
    // - Migrate assignments
    // - Delete the pending_invites row
    if (state.session?.user) {
      try {
        await createProfileAndMigrateInvites(state.session.user);
      } catch (reconcileError) {
        console.error('❌ Error reconciling pending invites for logged-in user:', reconcileError);
      }
    }

    if (error && error.code !== "PGRST116") {
      console.error('  - ❌ Profile fetch error:', error);
      console.error('  - Error details:', JSON.stringify(error, null, 2));
      // Create a minimal profile so the app can still function
      state.profile = {
        id: state.session.user.id,
        full_name: state.session.user.user_metadata.full_name || state.session.user.email || "User",
        can_manage: false,
      };
      console.log('  - ⚠️ Using fallback profile:', state.profile);
      return;
    }

    if (!data) {
      console.log('  - No profile found, creating new one...');
      
      // Use the migration function to create profile and migrate invites
      await createProfileAndMigrateInvites(state.session.user);
      
      // If profile was created, fetch it again to get the full data
      if (state.profile) {
        console.log('  - ✅ Profile created via migration function:', state.profile);
        return;
      }
      
      // Fallback: try direct insert if migration didn't work
      // First check for pending invite to get team_id
      const userEmail = state.session.user.email?.toLowerCase();
      let pendingInvite = null;
      let teamId = null;
      
      if (userEmail) {
        const { data: invite } = await supabase
          .from("pending_invites")
          .select("*")
          .eq("email", userEmail)
          .maybeSingle();
        pendingInvite = invite;
        teamId = invite?.team_id || null;
      }
      
      const insertPromise = supabase
        .from("profiles")
        .insert({
          id: state.session.user.id,
          full_name: pendingInvite?.full_name || state.session.user.user_metadata.full_name || state.session.user.email || "New User",
          email: state.session.user.email || null,
          team_id: teamId,
        })
        .select()
        .single();
      
      const insertTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile insert timeout after 2 seconds')), 2000)
      );
      
      let newProfile, insertError;
      try {
        const result = await Promise.race([insertPromise, insertTimeoutPromise]);
        newProfile = result.data;
        insertError = result.error;
      } catch (timeoutErr) {
        console.error('  - ⚠️ Insert timed out:', timeoutErr.message);
        insertError = timeoutErr;
      }
      
      console.log('  - Insert completed. Error:', insertError?.code || 'none');
      
      if (insertError) {
        console.error('  - ❌ Profile creation error:', insertError);
        console.error('  - Error details:', JSON.stringify(insertError, null, 2));
        // Use fallback profile
        state.profile = {
          id: state.session.user.id,
          full_name: state.session.user.user_metadata.full_name || state.session.user.email || "User",
          can_manage: false,
        };
        console.log('  - ⚠️ Using fallback profile:', state.profile);
        return;
      }
      state.profile = newProfile;
      console.log('  - ✅ Profile created:', newProfile);
      
      // If there's a pending invite with team_id, add user to team_members
      if (teamId && newProfile) {
        console.log('  - 👥 Auto-adding user to team_members (fallback)...');
        const { error: teamMemberError } = await supabase
          .from("team_members")
          .insert({
            team_id: teamId,
            user_id: state.session.user.id,
            role: 'member',
            is_owner: false,
            can_manage: false
          });
        
        if (teamMemberError && teamMemberError.code !== '23505') {
          console.error('  - ❌ Error adding user to team_members (fallback):', teamMemberError);
        } else if (!teamMemberError) {
          console.log('  - ✅ User added to team_members (fallback)');
        }
      }
    } else {
      // Sync email if missing
      if (data && !data.email && state.session.user.email) {
        await supabase
          .from("profiles")
          .update({ email: state.session.user.email })
          .eq("id", state.session.user.id);
        data.email = state.session.user.email;
      }
      state.profile = data;
      // Ensure team_id is directly accessible (it might be nested in team relationship)
      if (!data.team_id) {
        if (data.team && data.team.id) {
          data.team_id = data.team.id;
          state.profile.team_id = data.team.id;
          console.log('  - ⚠️ team_id was missing, extracted from team relationship:', data.team_id);
        } else {
          console.error('  - ❌ CRITICAL: Profile has no team_id and no team relationship!');
          console.error('  - Profile data:', JSON.stringify(data, null, 2));
        }
      }
      console.log('  - ✅ Profile found:', data);
      console.log('  - can_manage:', data.can_manage);
      console.log('  - is_owner:', data.is_owner);
      console.log('  - team_id:', data.team_id);
      console.log('  - team:', data.team);
      console.log('  - Final state.profile.team_id:', state.profile.team_id);
      
      // Double-check: if team_id is still missing, try to fetch it directly
      if (!data.team_id) {
        console.warn('  - ⚠️ Attempting to fetch team_id directly from database...');
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("team_id")
          .eq("id", state.session.user.id)
          .single();
        
        if (!profileError && profileData?.team_id) {
          data.team_id = profileData.team_id;
          state.profile.team_id = profileData.team_id;
          console.log('  - ✅ Retrieved team_id directly:', profileData.team_id);
        } else {
          console.error('  - ❌ Could not retrieve team_id:', profileError);
        }
      }
      
      // If we still don't have team_id, this is a critical error
      if (!state.profile.team_id) {
        console.error('  - ❌❌❌ CRITICAL ERROR: Profile has no team_id after all attempts!');
        console.error('  - This user cannot access any data. They need to be assigned to a team.');
      }
    }
    
    // Fetch user teams and set current team
    await fetchUserTeams();
    
  } catch (err) {
    console.error('  - ❌ Unexpected error in fetchProfile:', err);
    // Use fallback profile
    state.profile = {
      id: state.session.user.id,
      full_name: state.session.user.user_metadata.full_name || state.session.user.email || "User",
      can_manage: false,
    };
    console.log('  - ⚠️ Using fallback profile after error:', state.profile);
  }
  
  console.log('  - ✅ fetchProfile() completed. Final state.profile:', state.profile);
}

async function fetchUserTeams() {
  console.log('👥 fetchUserTeams() called');
  
  if (!state.session?.user?.id) {
    console.error('  - ❌ No session or user ID');
    return;
  }
  
  try {
    // Fetch all teams the user is a member of
    const { data: teamMembers, error } = await supabase
      .from("team_members")
      .select(`
        team_id,
        role,
        is_owner,
        can_manage,
        team:team_id (
          id,
          name,
          owner_id
        )
      `)
      .eq("user_id", state.session.user.id)
      .order("joined_at", { ascending: true });
    
    if (error) {
      console.error('  - ❌ Error fetching user teams:', error);
      console.log('  - ⚠️ Falling back to profile.team_id (migration may not be run yet)');
      
      // Fallback: use profile.team_id if available (backward compatibility)
      if (state.profile?.team_id) {
        state.currentTeamId = state.profile.team_id;
        state.userTeams = [{
          id: state.profile.team_id,
          name: state.profile.team?.name || 'Unknown Team',
          role: state.profile.is_owner ? 'owner' : (state.profile.can_manage ? 'manager' : 'member'),
          is_owner: state.profile.is_owner || false,
          can_manage: state.profile.can_manage || false,
        }];
        console.log('  - ✅ Using profile.team_id as fallback:', state.currentTeamId);
        updateTeamSwitcher();
      } else {
        state.currentTeamId = null;
        console.log('  - ⚠️ No team_id available');
      }
      return;
    }
    
    state.userTeams = (teamMembers || []).map(tm => ({
      id: tm.team_id,
      name: tm.team?.name || 'Unknown Team',
      role: tm.role,
      is_owner: tm.is_owner,
      can_manage: tm.can_manage,
    }));
    
    console.log('  - ✅ Found', state.userTeams.length, 'teams');
    console.log('  - Teams:', state.userTeams.map(t => t.name));
    
    // Set current team: use profile.team_id if it exists and user is member, otherwise use first team
    if (state.profile?.team_id) {
      const profileTeam = state.userTeams.find(t => t.id === state.profile.team_id);
      if (profileTeam) {
        state.currentTeamId = state.profile.team_id;
        console.log('  - ✅ Using profile team_id as current team:', profileTeam.name);
      } else if (state.userTeams.length > 0) {
        // Profile has team_id but user is not a member (shouldn't happen, but handle it)
        state.currentTeamId = state.userTeams[0].id;
        console.log('  - ⚠️ Profile team_id not in user teams, using first team');
      }
    } else if (state.userTeams.length > 0) {
      state.currentTeamId = state.userTeams[0].id;
      console.log('  - ✅ No profile team_id, using first team:', state.userTeams[0].name);
    } else {
      state.currentTeamId = null;
      console.log('  - ⚠️ User is not a member of any teams');
    }
    
    // Update team switcher UI
    updateTeamSwitcher();
    
  } catch (err) {
    console.error('  - ❌ Unexpected error in fetchUserTeams:', err);
    
    // Fallback: use profile.team_id if available
    if (state.profile?.team_id) {
      state.currentTeamId = state.profile.team_id;
      state.userTeams = [{
        id: state.profile.team_id,
        name: state.profile.team?.name || 'Unknown Team',
        role: state.profile.is_owner ? 'owner' : (state.profile.can_manage ? 'manager' : 'member'),
        is_owner: state.profile.is_owner || false,
        can_manage: state.profile.can_manage || false,
      }];
      console.log('  - ✅ Using profile.team_id as fallback after error:', state.currentTeamId);
      updateTeamSwitcher();
    } else {
      state.currentTeamId = null;
      console.log('  - ⚠️ No team_id available after error');
    }
  }
}

async function switchTeam(teamId) {
  console.log('🔄 switchTeam() called with teamId:', teamId);
  
  if (!teamId) {
    console.error('  - ❌ No teamId provided');
    return;
  }
  
  // Verify user is a member of this team
  const team = state.userTeams.find(t => t.id === teamId);
  if (!team) {
    console.error('  - ❌ User is not a member of team:', teamId);
    return;
  }
  
  // Update current team
  state.currentTeamId = teamId;
  
  // Clear saved set ID when switching teams (set belongs to different team)
  localStorage.removeItem('cadence-selected-set-id');
  hideSetDetail();
  
  // Update profile.team_id (for backward compatibility and default team)
  // IMPORTANT: Explicitly preserve full_name to prevent it from being reset to email
  if (state.profile) {
    const updateData = { 
      team_id: teamId 
    };
    
    // Preserve full_name if it exists (prevent reset to email)
    if (state.profile.full_name) {
      updateData.full_name = state.profile.full_name;
    }
    
    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", state.session.user.id);
    
    if (error) {
      console.error('  - ❌ Error updating profile team_id:', error);
    } else {
      state.profile.team_id = teamId;
      console.log('  - ✅ Updated profile team_id');
    }
  }
  
  // Reload all data for the new team
  console.log('  - 🔄 Reloading data for new team...');
  await Promise.all([loadSongs(), loadSets(), loadPeople()]);
  
  // Refresh UI
  refreshActiveTab();
  updateTeamSwitcher();
  showApp();
  
  console.log('  - ✅ Team switched to:', team.name);
}

function updateTeamSwitcher() {
  const teamSwitcherContainer = el("team-switcher-container");
  const teamSwitcherList = el("team-switcher-list");
  const accountMenuTeamName = el("account-menu-team-name");
  const accountMenuTeamSection = el("account-menu-team-section");
  const accountMenuActionsSection = el("account-menu-actions-section");
  
  if (!teamSwitcherContainer || !teamSwitcherList) return;
  
  const hasMultipleTeams = state.userTeams.length > 1;
  
  // Show switcher if user has multiple teams
  if (hasMultipleTeams) {
    teamSwitcherContainer.style.display = "block";
    
    // Clear and populate custom list
    teamSwitcherList.innerHTML = "";
    state.userTeams.forEach(team => {
      const teamItem = document.createElement("div");
      teamItem.className = "team-switcher-item";
      teamItem.dataset.teamId = team.id;
      teamItem.style.cssText = `
        padding: 0.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      `;
      
      // Highlight current team
      if (team.id === state.currentTeamId) {
        teamItem.style.backgroundColor = "var(--accent-color)";
        teamItem.style.color = "var(--bg-primary)";
      } else {
        teamItem.style.backgroundColor = "transparent";
        teamItem.style.color = "var(--text-primary)";
      }
      
      // Hover effect
      teamItem.addEventListener("mouseenter", () => {
        if (team.id !== state.currentTeamId) {
          teamItem.style.backgroundColor = "var(--bg-primary)";
        }
      });
      teamItem.addEventListener("mouseleave", () => {
        if (team.id !== state.currentTeamId) {
          teamItem.style.backgroundColor = "transparent";
        }
      });
      
      // Team name and role
      const teamInfo = document.createElement("div");
      teamInfo.style.cssText = "flex: 1; min-width: 0;";
      
      const teamName = document.createElement("div");
      teamName.textContent = team.name;
      teamName.style.cssText = "font-weight: 500; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
      
      const teamRole = document.createElement("div");
      teamRole.textContent = team.is_owner ? "Owner" : (team.can_manage ? "Manager" : "Member");
      teamRole.style.cssText = "font-size: 0.75rem; opacity: 0.7; margin-top: 0.125rem;";
      
      teamInfo.appendChild(teamName);
      teamInfo.appendChild(teamRole);
      
      // Checkmark for current team
      if (team.id === state.currentTeamId) {
        const checkmark = document.createElement("i");
        checkmark.className = "fa-solid fa-check";
        checkmark.style.cssText = "font-size: 0.85rem;";
        teamItem.appendChild(teamInfo);
        teamItem.appendChild(checkmark);
      } else {
        teamItem.appendChild(teamInfo);
      }
      
      // Click handler
      teamItem.addEventListener("click", async () => {
        if (team.id !== state.currentTeamId) {
          await switchTeam(team.id);
          // Close menu after switching
          el("account-menu")?.classList.add("hidden");
        }
      });
      
      teamSwitcherList.appendChild(teamItem);
    });
  } else {
    teamSwitcherContainer.style.display = "none";
  }
  
  // Hide dividers if user only has one team
  if (accountMenuTeamSection && accountMenuActionsSection) {
    if (hasMultipleTeams) {
      accountMenuTeamSection.style.borderBottom = "1px solid var(--border-color)";
      accountMenuTeamSection.style.marginBottom = "0.5rem";
      accountMenuActionsSection.style.borderTop = "1px solid var(--border-color)";
      accountMenuActionsSection.style.marginTop = "0.5rem";
    } else {
      accountMenuTeamSection.style.borderBottom = "none";
      accountMenuTeamSection.style.marginBottom = "0";
      accountMenuActionsSection.style.borderTop = "none";
      accountMenuActionsSection.style.marginTop = "0";
    }
  }
  
  // Update current team name display
  if (accountMenuTeamName) {
    const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
    if (currentTeam) {
      accountMenuTeamName.textContent = currentTeam.name;
    } else if (state.profile?.team?.name) {
      accountMenuTeamName.textContent = state.profile.team.name;
    } else {
      accountMenuTeamName.textContent = "No Team";
    }
  }
}

async function loadSongs() {
  console.log('🎵 loadSongs() called');
  console.log('  - state.currentTeamId:', state.currentTeamId);
  
  if (!state.currentTeamId) {
    console.warn('⚠️ No currentTeamId, cannot load songs');
    state.songs = [];
    return;
  }
  
  console.log('  - Loading songs for team_id:', state.currentTeamId);
  
  // First, test if we can query songs at all (check RLS)
  console.log('  - Testing songs query...');
  const result = await safeSupabaseOperation(async () => {
    return await supabase
      .from("songs")
      .select(`
        *,
        song_keys (
          id,
          key
        ),
        song_links (
          id,
          title,
          url,
          key,
          file_path,
          file_name,
          file_type,
          is_file_upload
        )
      `)
      .eq("team_id", state.currentTeamId)
      .order("title");
  });
  
  const { data, error } = result;
  
  if (error) {
    console.error('❌ Error loading songs:', error);
    console.error('  - Error code:', error.code);
    console.error('  - Error message:', error.message);
    console.error('  - Error details:', JSON.stringify(error, null, 2));
    console.error('  - Query was for team_id:', state.profile?.team_id);
    state.songs = [];
    return;
  }
  
  console.log('  - ✅ Songs loaded:', data?.length || 0, 'songs');
  if (data && data.length > 0) {
    console.log('  - First song sample:', data[0]);
  } else {
    console.warn('  - ⚠️ No songs returned. This could mean:');
    console.warn('    1. No songs exist for this team');
    console.warn('    2. RLS policies are blocking access');
    console.warn('    3. team_id mismatch');
  }
  state.songs = data || [];
}

async function loadSets() {
  console.log('📋 loadSets() called');
  console.log('  - state.currentTeamId:', state.currentTeamId);
  
  if (!state.currentTeamId) {
    console.warn('⚠️ No currentTeamId, cannot load sets');
    state.sets = [];
    renderSets();
    return;
  }
  
  console.log('  - Loading sets for team_id:', state.currentTeamId);
  console.log('  - Testing sets query...');
  
  // Load team assignment mode (handle gracefully if column doesn't exist yet)
  try {
    const { data: teamData } = await supabase
      .from("teams")
      .select("assignment_mode")
      .eq("id", state.currentTeamId)
      .single();
    
    if (teamData?.assignment_mode) {
      state.teamAssignmentMode = teamData.assignment_mode;
    } else {
      // Default to per_set if not set
      state.teamAssignmentMode = 'per_set';
    }
  } catch (err) {
    // If assignment_mode column doesn't exist yet, default to per_set
    console.warn('Assignment mode column may not exist yet, defaulting to per_set');
    state.teamAssignmentMode = 'per_set';
  }
  
  // Try to load with service/rehearsal times first
  let result = await safeSupabaseOperation(async () => {
    return await supabase
      .from("sets")
      .select(
        `
      *,
      service_times (
        id,
        service_time
      ),
      rehearsal_times (
        id,
        rehearsal_date,
        rehearsal_time
      ),
      set_assignments (
        id,
        person_id,
        person_name,
        person_email,
        pending_invite_id,
        role,
        status,
        person:person_id (
          id,
          full_name
        ),
        pending_invite:pending_invite_id (
          id,
          full_name,
          email
        )
      ),
      set_songs (
        id,
        sequence_order,
        notes,
        title,
        description,
        planned_duration_seconds,
        song_id,
        key,
        song:song_id (
          id, title, bpm, time_signature, duration_seconds, description,
          song_keys (
            id,
            key
          ),
          song_links (
            id,
            title,
            url,
            key,
            file_path,
            file_name,
            file_type,
            is_file_upload
          )
        ),
        song_links (
          id,
          title,
          url,
          key,
          display_order,
          file_path,
          file_name,
          file_type,
          is_file_upload
        ),
        song_assignments (
          id,
          person_id,
          person_name,
          person_email,
          pending_invite_id,
          role,
          status,
          person:person_id (
            id,
            full_name
          ),
          pending_invite:pending_invite_id (
            id,
            full_name,
            email
          )
        )
      )
    `
    )
    .eq("team_id", state.currentTeamId)
    .order("scheduled_date", { ascending: true });
  });
  
  let { data, error } = result;

  // If error is due to missing tables (service_times, rehearsal_times, or set_assignments), fall back to query without them
  if (error && (error.message?.includes("service_times") || error.message?.includes("rehearsal_times") || error.message?.includes("set_assignments") || error.code === "PGRST116" || error.code === "42P01")) {
    console.warn("service_times or rehearsal_times tables not found, loading sets without them:", error.message);
    console.log('  - Falling back to query without service/rehearsal times...');
    const fallbackResult = await safeSupabaseOperation(async () => {
      return await supabase
      .from("sets")
      .select(
        `
        *,
        set_assignments (
          id,
          person_id,
          person_name,
          person_email,
          pending_invite_id,
          role,
          status,
          person:person_id (
            id,
            full_name
          ),
          pending_invite:pending_invite_id (
            id,
            full_name,
            email
          )
        ),
        set_songs (
          id,
          sequence_order,
          notes,
          title,
          description,
          planned_duration_seconds,
          song_id,
          key,
          song:song_id (
            id, title, bpm, time_signature, duration_seconds, description,
            song_keys (
              id,
              key
            ),
            song_links (
              id,
              title,
              url,
              key
            )
          ),
        song_links (
          id,
          title,
          url,
          key,
          display_order,
          file_path,
          file_name,
          file_type,
          is_file_upload
        ),
          song_assignments (
            id,
            person_id,
            person_name,
            person_email,
            pending_invite_id,
            role,
            status,
            person:person_id (
              id,
              full_name
            ),
            pending_invite:pending_invite_id (
              id,
              full_name,
              email
            )
          )
        )
      `
      )
      .eq("team_id", state.currentTeamId)
      .order("scheduled_date", { ascending: true });
    });
    
    console.log('  - Fallback query result - error:', fallbackResult.error?.code || 'none');
    console.log('  - Fallback query result - data count:', fallbackResult.data?.length || 0);
    
    if (fallbackResult.error) {
      console.error("Error loading sets:", fallbackResult.error);
      state.sets = [];
      renderSets();
      return;
    }
    
    data = fallbackResult.data;
    // Add empty arrays for service_times, rehearsal_times, and set_assignments if they don't exist
    if (data) {
      data = data.map(set => ({
        ...set,
        service_times: [],
        rehearsal_times: [],
        set_assignments: []
      }));
    }
  } else if (error) {
    console.error("❌ Error loading sets:", error);
    console.error("  - Error code:", error.code);
    console.error("  - Error message:", error.message);
    console.error("  - Error details:", JSON.stringify(error, null, 2));
    console.error("  - Query was for team_id:", state.currentTeamId);
    state.sets = [];
    renderSets();
    return;
  }

  console.log('  - ✅ Sets loaded:', data?.length || 0, 'sets');
  if (data && data.length > 0) {
    console.log('  - First set sample:', { id: data[0].id, title: data[0].title, team_id: data[0].team_id });
  } else {
    console.warn('  - ⚠️ No sets returned. This could mean:');
    console.warn('    1. No sets exist for this team');
    console.warn('    2. RLS policies are blocking access');
    console.warn('    3. team_id mismatch');
  }
  state.sets = data ?? [];
  renderSets();
  
  // Load and render pending requests
  await loadPendingRequests();
  
  // Restore set detail view if there's a saved set ID
  restoreSetDetailIfSaved();
}

// Migration function to set existing assignments to 'accepted' status
// This should be run once after adding the status column to the database
// Note: This function assumes the status column exists. If it doesn't, the queries will fail gracefully.
async function migrateExistingAssignmentsToAccepted() {
  console.log('🔄 Starting migration of existing assignments to accepted status...');
  
  try {
    // Update set_assignments without status (null or missing) to 'accepted'
    const { data: setAssignments, error: setError } = await supabase
      .from("set_assignments")
      .select("id")
      .is("status", null)
      .limit(1000);
    
    if (setError && !setError.message?.includes("column") && !setError.message?.includes("does not exist")) {
      console.error("Error fetching set assignments for migration:", setError);
      return;
    }
    
    if (setAssignments && setAssignments.length > 0) {
      const { error: updateSetError } = await supabase
        .from("set_assignments")
        .update({ status: 'accepted' })
        .is("status", null);
      
      if (updateSetError) {
        console.error("Error updating set assignments:", updateSetError);
      } else {
        console.log(`✅ Migrated ${setAssignments.length} set assignments to accepted status`);
      }
    }
    
    // Update song_assignments without status (null or missing) to 'accepted'
    const { data: songAssignments, error: songError } = await supabase
      .from("song_assignments")
      .select("id")
      .is("status", null)
      .limit(1000);
    
    if (songError && !songError.message?.includes("column") && !songError.message?.includes("does not exist")) {
      console.error("Error fetching song assignments for migration:", songError);
      return;
    }
    
    if (songAssignments && songAssignments.length > 0) {
      const { error: updateSongError } = await supabase
        .from("song_assignments")
        .update({ status: 'accepted' })
        .is("status", null);
      
      if (updateSongError) {
        console.error("Error updating song assignments:", updateSongError);
      } else {
        console.log(`✅ Migrated ${songAssignments.length} song assignments to accepted status`);
      }
    }
    
    console.log('✅ Migration complete!');
  } catch (error) {
    console.error("Migration error:", error);
    console.log("⚠️ If you see column errors, make sure to add the status column to set_assignments and song_assignments tables first.");
  }
}

function restoreSetDetailIfSaved() {
  const savedSetId = localStorage.getItem('cadence-selected-set-id');
  if (!savedSetId || state.sets.length === 0) {
    return; // No saved set or sets not loaded yet
  }
  
  const setToRestore = state.sets.find(s => s.id.toString() === savedSetId);
  if (setToRestore) {
    showSetDetail(setToRestore);
  } else {
    // Set not found (might have been deleted), clear the saved ID
    localStorage.removeItem('cadence-selected-set-id');
  }
}

// Load pending assignment requests for current user
async function loadPendingRequests() {
  const currentUserId = state.profile?.id;
  if (!currentUserId) {
    el("pending-requests-section")?.classList.add("hidden");
    el("pending-requests-badge")?.classList.add("hidden");
    return;
  }

  // Get pending set assignments
  const { data: pendingSetAssignments } = await supabase
    .from("set_assignments")
    .select(`
      id,
      role,
      set_id,
      set:set_id (
        id,
        title,
        scheduled_date
      )
    `)
    .eq("person_id", currentUserId)
    .eq("status", "pending");

  // Get pending song assignments grouped by set
  const { data: pendingSongAssignments } = await supabase
    .from("song_assignments")
    .select(`
      id,
      role,
      set_song_id,
      set_song:set_song_id (
        id,
        set_id,
        set:set_id (
          id,
          title,
          scheduled_date
        )
      )
    `)
    .eq("person_id", currentUserId)
    .eq("status", "pending");

  // Group song assignments by set
  const songAssignmentsBySet = {};
  if (pendingSongAssignments) {
    pendingSongAssignments.forEach(assignment => {
      const setId = assignment.set_song?.set_id;
      if (setId) {
        if (!songAssignmentsBySet[setId]) {
          songAssignmentsBySet[setId] = {
            set: assignment.set_song.set,
            assignments: []
          };
        }
        songAssignmentsBySet[setId].assignments.push(assignment);
      }
    });
  }

  const pendingRequests = [];

  // Add set-level pending requests
  if (pendingSetAssignments) {
    pendingSetAssignments.forEach(assignment => {
      pendingRequests.push({
        type: 'set',
        assignmentId: assignment.id,
        setId: assignment.set_id,
        set: assignment.set,
        role: assignment.role
      });
    });
  }

  // Add song-level pending requests (one per set)
  Object.keys(songAssignmentsBySet).forEach(setId => {
    const { set, assignments } = songAssignmentsBySet[setId];
    pendingRequests.push({
      type: 'song',
      assignmentIds: assignments.map(a => a.id),
      setId: setId,
      set: set,
      roles: [...new Set(assignments.map(a => a.role))],
      assignmentCount: assignments.length
    });
  });

  renderPendingRequests(pendingRequests);
}

// Render pending requests UI
function renderPendingRequests(requests) {
  const section = el("pending-requests-section");
  const list = el("pending-requests-list");
  const badge = el("pending-requests-badge");

  if (!section || !list) return;

  if (requests.length === 0) {
    section.classList.add("hidden");
    if (badge) badge.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  // Move badge to the requests section header
  const sectionHeader = section.querySelector(".section-header h2");
  if (badge && sectionHeader) {
    badge.textContent = requests.length;
    badge.classList.remove("hidden");
    // Ensure badge is in the header (in case it was moved)
    if (!sectionHeader.contains(badge)) {
      sectionHeader.appendChild(badge);
    }
  } else if (badge) {
    badge.classList.add("hidden");
  }

  list.innerHTML = "";

  requests.forEach(request => {
    const item = document.createElement("div");
    item.className = "pending-request-item";

    const info = document.createElement("div");
    info.className = "pending-request-info";

    const setTitle = document.createElement("div");
    setTitle.className = "set-title";
    setTitle.textContent = request.set?.title || "Unknown Set";

    const details = document.createElement("div");
    details.className = "request-details";
    if (request.type === 'set') {
      details.textContent = `Role: ${request.role}`;
    } else {
      details.textContent = `${request.assignmentCount} song assignment${request.assignmentCount > 1 ? 's' : ''} - ${request.roles.join(', ')}`;
    }

    info.appendChild(setTitle);
    info.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "pending-request-actions";

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "btn primary small";
    acceptBtn.innerHTML = '<i class="fa-solid fa-check"></i> Accept';
    acceptBtn.onclick = () => handleAcceptRequest(request);

    const declineBtn = document.createElement("button");
    declineBtn.className = "btn ghost small";
    declineBtn.innerHTML = '<i class="fa-solid fa-x"></i> Decline';
    declineBtn.onclick = () => handleDeclineRequest(request);

    actions.appendChild(acceptBtn);
    actions.appendChild(declineBtn);

    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

// Handle accepting an assignment request
async function handleAcceptRequest(request) {
  const currentUserId = state.profile?.id;
  if (!currentUserId) return;

  try {
    if (request.type === 'set') {
      // Accept set-level assignment
      console.log("Accepting set assignment:", {
        assignmentId: request.assignmentId,
        currentUserId: currentUserId,
        request: request
      });
      
      // First, verify the assignment exists and belongs to the user
      const { data: verifyData, error: verifyError } = await supabase
        .from("set_assignments")
        .select("id, person_id, status")
        .eq("id", request.assignmentId)
        .eq("person_id", currentUserId)
        .single();
      
      if (verifyError || !verifyData) {
        console.error("Cannot verify assignment ownership:", verifyError, verifyData);
        toastError("Unable to accept assignment. You may not have permission.");
        return;
      }
      
      console.log("Assignment verified, current status:", verifyData.status);
      
      // Update the status
      const { data, error } = await supabase
        .from("set_assignments")
        .update({ status: 'accepted' })
        .eq("id", request.assignmentId)
        .eq("person_id", currentUserId)
        .select();

      if (error) {
        console.error("Error accepting set assignment:", error);
        console.error("Assignment ID:", request.assignmentId);
        console.error("Current User ID:", currentUserId);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.error("Update returned no data - assignment may not exist or permission denied");
        toastError("Unable to accept assignment. Please try again.");
        return;
      }
      
      console.log("Set assignment accepted successfully:", data);
      
      // Verify the update persisted
      const { data: verifyAfter, error: verifyAfterError } = await supabase
        .from("set_assignments")
        .select("id, status")
        .eq("id", request.assignmentId)
        .single();
      
      console.log("Verification after update:", verifyAfter, verifyAfterError);
      if (verifyAfter?.status !== 'accepted') {
        console.error("WARNING: Status did not persist! Expected 'accepted', got:", verifyAfter?.status);
      }
    } else {
      // Accept all song assignments for this set (per-song mode)
      const { error } = await supabase
        .from("song_assignments")
        .update({ status: 'accepted' })
        .in("id", request.assignmentIds);

      if (error) throw error;

      // Create set acceptance record for future auto-acceptance
      const setId = request.setId || request.set?.id;
      console.log("Creating set_acceptances record:", {
        set_id: setId,
        person_id: currentUserId,
        request: request
      });
      
      if (!setId) {
        console.error("No set_id available for set_acceptances:", request);
      } else {
        const { data: acceptanceData, error: acceptanceError } = await supabase
          .from("set_acceptances")
          .upsert({
            set_id: setId,
            person_id: currentUserId,
            accepted_at: new Date().toISOString()
          }, {
            onConflict: 'set_id,person_id'
          })
          .select();

        if (acceptanceError) {
          console.error("Error creating set acceptance record:", acceptanceError);
          console.error("Set ID:", setId);
          console.error("Person ID:", currentUserId);
          // Don't fail the whole operation if this fails, but log it
        } else {
          console.log("Set acceptance record created successfully:", acceptanceData);
        }
      }
    }

    toastSuccess("Assignment accepted!");
    await loadSets(); // Reload to refresh UI
    await loadPendingRequests(); // Refresh pending requests list
  } catch (error) {
    console.error("Error accepting request:", error);
    toastError("Unable to accept assignment. Please try again.");
  }
}

// Handle declining an assignment request
async function handleDeclineRequest(request) {
  try {
    if (request.type === 'set') {
      const { error } = await supabase
        .from("set_assignments")
        .update({ status: 'declined' })
        .eq("id", request.assignmentId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("song_assignments")
        .update({ status: 'declined' })
        .in("id", request.assignmentIds);

      if (error) throw error;
    }

    toastSuccess("Assignment declined.");
    await loadSets(); // Reload to refresh UI
    await loadPendingRequests(); // Refresh pending requests list
  } catch (error) {
    console.error("Error declining request:", error);
    toastError("Unable to decline assignment. Please try again.");
  }
}

// Show assignment details modal
async function showAssignmentDetailsModal(assignment) {
  const modal = el("assignment-details-modal");
  const personEl = el("assignment-details-person");
  const roleEl = el("assignment-details-role");
  const songEl = el("assignment-details-song");
  const songLabel = songEl?.parentElement?.querySelector("label");
  const statusEl = el("assignment-details-status");
  const actionsEl = el("assignment-details-actions");
  const closeBtn = el("close-assignment-details-modal");

  if (!modal) return;

  // Determine assignment type: if songTitle exists, it's a song assignment
  const assignmentType = assignment.songTitle ? 'song' : 'set';
  const currentUserId = state.profile?.id;
  const currentSet = state.selectedSet;

  // Populate modal content
  if (personEl) personEl.textContent = assignment.personName || "Unknown";
  
  // For per-song assignments, fetch all assignments for this person in this set
  if (assignmentType === 'song' && currentSet && assignment.assignmentId && currentUserId) {
    // Get person_id from the assignment
    const { data: assignmentData } = await supabase
      .from("song_assignments")
      .select("person_id")
      .eq("id", assignment.assignmentId)
      .single();
    
    if (assignmentData?.person_id) {
      // Get all song assignments for this person in this set
      const { data: allAssignments } = await supabase
        .from("song_assignments")
        .select(`
          id,
          role,
          status,
          set_song_id,
          set_song:set_song_id (
            id,
            song_id,
            title,
            song:song_id (
              id,
              title
            )
          )
        `)
        .eq("person_id", assignmentData.person_id)
        .in("set_song_id", currentSet.set_songs?.map(ss => ss.id) || []);
      
      if (allAssignments && allAssignments.length > 0) {
        // Separate current assignment from others
        const currentAssignment = allAssignments.find(a => a.id === assignment.assignmentId);
        const otherAssignments = allAssignments.filter(a => a.id !== assignment.assignmentId);
        
        // Build role display
        if (roleEl) {
          roleEl.innerHTML = "";
          
          // Collect all unique roles (current + others)
          const allRoles = new Set();
          if (currentAssignment) {
            allRoles.add(currentAssignment.role);
          }
          otherAssignments.forEach(a => allRoles.add(a.role));
          
          // Show current role first (if it exists)
          if (currentAssignment) {
            const currentRole = document.createElement("div");
            currentRole.style.fontSize = "1rem";
            currentRole.textContent = currentAssignment.role;
            roleEl.appendChild(currentRole);
          }
          
          // Add other roles (excluding the current one)
          const otherRoles = Array.from(allRoles).filter(role => 
            !currentAssignment || role !== currentAssignment.role
          );
          if (otherRoles.length > 0) {
            otherRoles.forEach(role => {
              const roleDiv = document.createElement("div");
              roleDiv.style.fontSize = "0.85rem";
              roleDiv.style.color = "var(--text-secondary)";
              roleDiv.style.marginTop = "0.25rem";
              roleDiv.textContent = role;
              roleEl.appendChild(roleDiv);
            });
          }
        }
        
        // Build song display
        if (songEl) {
          songEl.innerHTML = "";
          if (currentAssignment) {
            const songTitle = currentAssignment.set_song?.song_id 
              ? (currentAssignment.set_song.song?.title || currentAssignment.set_song.title || "Unknown Song")
              : (currentAssignment.set_song?.title || "Unknown Section");
            const currentSong = document.createElement("div");
            currentSong.style.fontSize = "1rem";
            currentSong.textContent = songTitle;
            songEl.appendChild(currentSong);
          }
          
          // Add other songs
          const otherSongs = otherAssignments.map(a => {
            const songTitle = a.set_song?.song_id 
              ? (a.set_song.song?.title || a.set_song.title || "Unknown Song")
              : (a.set_song?.title || "Unknown Section");
            return { title: songTitle, role: a.role };
          });
          
          // Group by song title and show unique songs
          const uniqueSongs = [...new Map(otherSongs.map(s => [s.title, s])).values()];
          if (uniqueSongs.length > 0) {
            uniqueSongs.forEach(song => {
              const songDiv = document.createElement("div");
              songDiv.style.fontSize = "0.85rem";
              songDiv.style.color = "var(--text-secondary)";
              songDiv.style.marginTop = "0.25rem";
              songDiv.textContent = song.title;
              songEl.appendChild(songDiv);
            });
          }
        }
      } else {
        // Fallback if we can't fetch all assignments
        if (roleEl) roleEl.textContent = assignment.role || "Unknown";
        if (songEl) songEl.textContent = assignment.songTitle || "";
      }
    } else {
      // Fallback
      if (roleEl) roleEl.textContent = assignment.role || "Unknown";
      if (songEl) songEl.textContent = assignment.songTitle || "";
    }
  } else {
    // Per-set assignment - just show the role, hide song
    if (roleEl) roleEl.textContent = assignment.role || "Unknown";
    if (songEl) {
      songEl.innerHTML = "";
      songEl.style.display = "none";
    }
    if (songLabel) songLabel.style.display = "none";
  }
  
  // Show/hide song field based on assignment type (do this after populating)
  if (assignmentType === 'set') {
    if (songEl) songEl.style.display = "none";
    if (songLabel) songLabel.style.display = "none";
  } else {
    if (songEl && songEl.style.display === "none") songEl.style.display = "";
    if (songLabel && songLabel.style.display === "none") songLabel.style.display = "";
  }

  // Create status badge
  if (statusEl) {
    statusEl.innerHTML = "";
    const statusBadge = document.createElement("span");
    statusBadge.className = "assignment-status-badge";
    
    if (assignment.status === 'accepted') {
      statusBadge.className += " accepted";
      statusBadge.textContent = "Accepted";
      statusBadge.style.background = "rgba(40, 167, 69, 0.2)";
      statusBadge.style.color = "#28a745";
      statusBadge.style.border = "1px solid rgba(40, 167, 69, 0.3)";
    } else if (assignment.status === 'declined') {
      statusBadge.className += " declined";
      statusBadge.textContent = "Declined";
      statusBadge.style.background = "rgba(220, 53, 69, 0.2)";
      statusBadge.style.color = "#dc3545";
      statusBadge.style.border = "1px solid rgba(220, 53, 69, 0.3)";
    } else {
      statusBadge.className += " pending";
      statusBadge.textContent = "Pending";
    }
    
    statusEl.appendChild(statusBadge);
  }

  // Show/hide song field based on assignment type
  if (assignmentType === 'set') {
    if (songEl) songEl.style.display = "none";
    if (songLabel) songLabel.style.display = "none";
  } else {
    if (songEl) songEl.style.display = "";
    if (songLabel) songLabel.style.display = "";
  }

  // Add action buttons (accept/decline) if assignment can be changed
  if (actionsEl) {
    actionsEl.innerHTML = "";
    
    if (currentUserId && assignment.assignmentId) {
      
      // Show accept button if pending or declined
      if (assignment.status === 'pending' || assignment.status === 'declined') {
        const acceptBtn = document.createElement("button");
        acceptBtn.className = "btn primary";
        acceptBtn.innerHTML = '<i class="fa-solid fa-check"></i> Accept';
        acceptBtn.onclick = async () => {
          await handleChangeAssignmentStatus(assignment.assignmentId, 'accepted', assignmentType);
          closeModal();
        };
        actionsEl.appendChild(acceptBtn);
      }
      
      // Show decline button if pending or accepted
      if (assignment.status === 'pending' || assignment.status === 'accepted') {
        const declineBtn = document.createElement("button");
        declineBtn.className = "btn ghost";
        declineBtn.innerHTML = '<i class="fa-solid fa-x"></i> Decline';
        declineBtn.onclick = async () => {
          await handleChangeAssignmentStatus(assignment.assignmentId, 'declined', assignmentType);
          closeModal();
        };
        actionsEl.appendChild(declineBtn);
      }
    }
  }

  // Show modal
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Close handlers
  const closeModal = () => {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  };

  closeBtn.onclick = closeModal;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

// Handle changing assignment status (accept/decline)
async function handleChangeAssignmentStatus(assignmentId, newStatus, assignmentType) {
  const currentUserId = state.profile?.id;
  if (!currentUserId) return;

  try {
    const tableName = assignmentType === 'song' ? 'song_assignments' : 'set_assignments';
    
    const { error } = await supabase
      .from(tableName)
      .update({ status: newStatus })
      .eq("id", assignmentId)
      .eq("person_id", currentUserId);

    if (error) throw error;

    // If accepting a song assignment in per-song mode, create set acceptance record
    if (newStatus === 'accepted' && assignmentType === 'song') {
      // Get the set_id from the assignment
      const { data: assignment } = await supabase
        .from("song_assignments")
        .select("set_song_id, set_song:set_song_id(set_id)")
        .eq("id", assignmentId)
        .single();

      if (assignment?.set_song?.set_id) {
        console.log("Creating set_acceptances record from modal:", {
          set_id: assignment.set_song.set_id,
          person_id: currentUserId
        });
        
        const { data: acceptanceData, error: acceptanceError } = await supabase
          .from("set_acceptances")
          .upsert({
            set_id: assignment.set_song.set_id,
            person_id: currentUserId,
            accepted_at: new Date().toISOString()
          }, {
            onConflict: 'set_id,person_id'
          })
          .select();

        if (acceptanceError) {
          console.error("Error creating set acceptance record from modal:", acceptanceError);
          console.error("Set ID:", assignment.set_song.set_id);
          console.error("Person ID:", currentUserId);
        } else {
          console.log("Set acceptance record created successfully from modal:", acceptanceData);
        }
      } else {
        console.warn("Could not get set_id from assignment:", assignment);
      }
    }

    toastSuccess(`Assignment ${newStatus === 'accepted' ? 'accepted' : 'declined'}!`);
    await loadSets(); // Reload to refresh UI
    await loadPendingRequests(); // Refresh pending requests list
  } catch (error) {
    console.error("Error changing assignment status:", error);
    toastError(`Unable to ${newStatus === 'accepted' ? 'accept' : 'decline'} assignment. Please try again.`);
  }
}

function isUserAssignedToSet(set, userId) {
  if (!userId) return false;
  
  const assignmentMode = getSetAssignmentMode(set);
  
  if (assignmentMode === 'per_set') {
    // Check set-level assignments (any status - pending, accepted, declined)
    return set.set_assignments?.some(assignment => 
      assignment.person_id === userId
    ) || false;
  } else {
    // Check song-level assignments (any status - pending, accepted, declined)
    if (!set.set_songs) return false;
  return set.set_songs.some(setSong => 
    setSong.song_assignments?.some(assignment => 
      assignment.person_id === userId
    )
  );
  }
}

function calculateVisiblePills(card, pills, rolesWrapper) {
  // Temporarily hide to measure card width without pills
  rolesWrapper.style.visibility = "hidden";
  
  // Use double requestAnimationFrame to ensure layout is complete
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Get reference width from a card without assignments (from "All Sets" section)
      let maxWidth;
      const allSetsContainer = setsList;
      if (allSetsContainer && allSetsContainer.children.length > 0) {
        // Use the first card from "All Sets" as reference (they don't have assignments)
        const referenceCard = allSetsContainer.querySelector(".set-card");
        if (referenceCard) {
          const refRect = referenceCard.getBoundingClientRect();
          maxWidth = refRect.width - 64; // Account for padding (32px each side)
        } else {
          // Fallback: use computed style width of current card
          const computedStyle = window.getComputedStyle(card);
          maxWidth = parseFloat(computedStyle.width) - 64;
        }
      } else {
        // Fallback: use computed style width of current card
        const computedStyle = window.getComputedStyle(card);
        maxWidth = parseFloat(computedStyle.width) - 64;
      }
      
      // Remove any existing "+X more" pill
      const allPills = rolesWrapper.querySelectorAll('.assignment-pill');
      allPills.forEach(pill => {
        if (pill.textContent.startsWith('+') && pill.textContent.includes('more')) {
          pill.remove();
        }
      });
      
      // Show all pills first
      pills.forEach(pill => {
        pill.style.display = "";
      });
      
      // Now show the wrapper
      rolesWrapper.style.visibility = "visible";
      
      let totalWidth = 0;
      let visibleCount = 0;
      const gap = 8; // Gap between pills
      
      // Measure each pill to see how many fit
      for (let index = 0; index < pills.length; index++) {
        const pill = pills[index];
        const pillWidth = pill.offsetWidth;
        const neededWidth = totalWidth + (visibleCount > 0 ? gap : 0) + pillWidth;
        
        // Reserve space for "+X more" if there are more pills after this one
        const remainingAfterThis = pills.length - index - 1;
        const spaceForMore = remainingAfterThis > 0 ? 100 : 0; // Approx width for "+X more"
        
        if (neededWidth + spaceForMore <= maxWidth) {
          totalWidth = neededWidth;
          visibleCount++;
        } else {
          // Can't fit this pill, hide it and remaining ones
          pill.style.display = "none";
          const remaining = pills.length - visibleCount;
          if (remaining > 0) {
            // Remove any existing "+X more" pill first
            const morePills = Array.from(rolesWrapper.querySelectorAll('.assignment-pill')).filter(p => 
              p.textContent.startsWith('+') && p.textContent.includes('more')
            );
            morePills.forEach(p => p.remove());
            
            const morePill = document.createElement("span");
            morePill.className = "assignment-pill user-role-pill";
            morePill.textContent = `+${remaining} more`;
            rolesWrapper.appendChild(morePill);
          }
          // Hide remaining pills
          for (let i = index + 1; i < pills.length; i++) {
            pills[i].style.display = "none";
          }
          break; // Break out of loop
        }
      }
    });
  });
}

function recalculateAllAssignmentPills() {
  if (!yourSetsList) return;
  
  const cardsWithAssignments = yourSetsList.querySelectorAll('.set-card[data-has-assignments="true"]');
  cardsWithAssignments.forEach(card => {
    const pills = card._assignmentPills;
    const wrapper = card._assignmentWrapper;
    if (pills && wrapper) {
      calculateVisiblePills(card, pills, wrapper);
    }
  });
}

function renderSetCard(set, container) {
  const template = document.getElementById("set-card-template");
  const node = template.content.cloneNode(true);
  
  node.querySelector(".set-title").textContent = set.title;
  const date = parseLocalDate(set.scheduled_date);
  node.querySelector(".set-date").textContent = date ? date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }) : "";
  node.querySelector(".set-description").textContent =
    set.description || "No description yet";

  const card = node.querySelector(".set-card");
  const editBtn = node.querySelector(".edit-set-btn");
  const deleteBtn = node.querySelector(".delete-set-btn");
  
  // Make card clickable to view details
  card.addEventListener("click", (e) => {
    // Don't trigger if clicking edit/delete buttons
    if (e.target === editBtn || e.target === deleteBtn || 
        editBtn.contains(e.target) || deleteBtn.contains(e.target)) {
      return;
    }
    showSetDetail(set);
  });

  if (isManager()) {
    editBtn.classList.remove("hidden");
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSetModal(set);
    });
    deleteBtn.classList.remove("hidden");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSet(set);
    });
  }

  container.appendChild(node);
  
  // Display user roles if this is in "Your Sets" (after appending to DOM so we can measure)
  const userRolesContainer = card.querySelector(".user-roles-container");
  const currentUserId = state.profile?.id;
  if (container === yourSetsList && currentUserId) {
    const assignmentMode = getSetAssignmentMode(set);
    const userAssignments = [];
    
    if (assignmentMode === 'per_set') {
      // Collect set-level assignments (all statuses)
      if (set.set_assignments) {
        set.set_assignments.forEach(assignment => {
          if (assignment.person_id === currentUserId) {
            userAssignments.push({
              role: assignment.role,
              isSetLevel: true,
              assignmentId: assignment.id,
              assignmentStatus: assignment.status || 'pending',
              personName: assignment.person?.full_name || assignment.person_name || "Unknown"
            });
          }
        });
      }
    } else {
      // Collect song-level assignments, sorted by setlist order (only accepted ones)
      if (set.set_songs) {
    const sortedSetSongs = [...set.set_songs].sort((a, b) => {
      const orderA = a.sequence_order ?? 0;
      const orderB = b.sequence_order ?? 0;
      return orderA - orderB;
    });
    
    sortedSetSongs.forEach(setSong => {
      if (setSong.song_assignments) {
        setSong.song_assignments.forEach(assignment => {
          if (assignment.person_id === currentUserId) {
            // Include all statuses, not just accepted
            // Get title: from song if it's a song, from title field if it's a section
            const songTitle = setSong.song_id 
              ? (setSong.song?.title || "Unknown Song")
              : (setSong.title || "Unknown Section");
            userAssignments.push({
              setSongId: setSong.id,
              songId: setSong.song_id || null,
              song: setSong.song || null,
              selectedKey: setSong.key || null,
              songTitle,
              role: assignment.role,
              sequenceOrder: setSong.sequence_order ?? 0,
              isSetLevel: false,
              assignmentId: assignment.id,
              assignmentStatus: assignment.status || 'pending',
              personName: assignment.person?.full_name || assignment.person_name || "Unknown"
            });
          }
        });
      }
    });
      }
    }

    if (userAssignments.length > 0) {
      const rolesWrapper = document.createElement("div");
      rolesWrapper.className = "user-roles-wrapper";
      userRolesContainer.appendChild(rolesWrapper);
      
      // Create all pills and append them
      const pills = [];
      userAssignments.forEach((assignment) => {
        const pill = document.createElement("span");
        pill.className = "assignment-pill user-role-pill";
        // For per-set: just show role. For per-song: show song - role
        if (assignment.isSetLevel) {
          pill.textContent = assignment.role;
          
          // Add status styling for per-set assignments
          const assignmentStatus = assignment.assignmentStatus || 'pending';
          if (assignmentStatus === 'pending') {
            pill.classList.add("pending-status");
          } else if (assignmentStatus === 'declined') {
            pill.classList.add("declined-status");
          }
        } else {
          pill.textContent = `${assignment.songTitle} - ${assignment.role}`;
          
          // Add pending styling for per-song assignments
          const assignmentStatus = assignment.assignmentStatus || 'pending';
          if (assignmentStatus === 'pending') {
            pill.classList.add("pending-status");
          } else if (assignmentStatus === 'declined') {
            pill.classList.add("declined-status");
          }
          
          // Clicking a "Your Sets" assignment pill should open the set and the song details
          pill.style.cursor = "pointer";
          if (assignment.setSongId) pill.dataset.setSongId = String(assignment.setSongId);
          if (assignment.songId) pill.dataset.songId = String(assignment.songId);
          if (assignment.selectedKey) pill.dataset.selectedKey = assignment.selectedKey;
          pill.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSetDetail(set);
            // Only open details for real songs (not sections)
            if (assignment.songId) {
              const songForModal =
                assignment.song || { id: assignment.songId, title: assignment.songTitle };
              await openSongDetailsModal(songForModal, assignment.selectedKey || null);
            }
          });
        }
        rolesWrapper.appendChild(pill);
        pills.push(pill);
      });
      
      // Store reference to pills and wrapper on the card for recalculation
      card.dataset.hasAssignments = "true";
      card._assignmentPills = pills;
      card._assignmentWrapper = rolesWrapper;
      
      // Calculate initially
      calculateVisiblePills(card, pills, rolesWrapper);
    } else {
      userRolesContainer.style.display = "none";
    }
  } else {
    if (userRolesContainer) {
      userRolesContainer.style.display = "none";
    }
  }
}

function renderSets() {
  setsList.innerHTML = "";
  if (yourSetsList) yourSetsList.innerHTML = "";
  
  if (!state.sets.length) {
    setsList.innerHTML = `<p class="muted">No sets scheduled yet.</p>`;
    if (yourSetsList) {
      yourSetsList.innerHTML = `<p class="muted">You're not assigned to any sets yet.</p>`;
    }
    return;
  }

  const currentUserId = state.profile?.id;
  const yourSets = [];
  const allSets = [];

  // Separate sets into "your sets" and "all sets"
  state.sets.forEach((set) => {
    if (currentUserId && isUserAssignedToSet(set, currentUserId)) {
      yourSets.push(set);
    }
    allSets.push(set);
  });

  // Render "All Sets" section FIRST so we have reference cards for width measurement
  if (allSets.length === 0) {
    setsList.innerHTML = `<p class="muted">No sets scheduled yet.</p>`;
  } else {
    allSets.forEach((set) => {
      renderSetCard(set, setsList);
    });
  }

  // Render "Your Sets" section AFTER "All Sets" so we can use them as reference
  if (yourSetsList) {
    if (yourSets.length === 0) {
      yourSetsList.innerHTML = `<p class="muted">You're not assigned to any sets yet.</p>`;
    } else {
      yourSets.forEach((set) => {
        renderSetCard(set, yourSetsList);
      });
    }
  }
  
  // Recalculate assignment pills after rendering (with delay to ensure layout is complete)
  setTimeout(() => {
    recalculateAllAssignmentPills();
  }, 100);
}

function switchTab(tabName) {
  // Save the current tab to localStorage
  localStorage.setItem('cadence-active-tab', tabName);
  
  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  // Show/hide tab content
  el("sets-tab").classList.toggle("hidden", tabName !== "sets");
  el("songs-tab").classList.toggle("hidden", tabName !== "songs");
  el("people-tab").classList.toggle("hidden", tabName !== "people");
  
  // Load data if switching to tabs
  if (tabName === "songs") {
    renderSongCatalog();
  } else if (tabName === "people") {
    loadPeople();
  } else if (tabName === "sets") {
    // Recalculate assignment pills when switching to sets tab
    // Use a small delay to ensure the tab is visible and layout is complete
    setTimeout(() => {
      recalculateAllAssignmentPills();
    }, 100);
  }
}

function refreshActiveTab() {
  // Get the currently active tab
  const activeTabBtn = document.querySelector(".tab-btn.active");
  if (!activeTabBtn) return;
  
  const activeTab = activeTabBtn.dataset.tab;
  
  // Re-render the active tab content
  if (activeTab === "sets") {
    renderSets();
  } else if (activeTab === "songs") {
    renderSongCatalog();
  } else if (activeTab === "people") {
    loadPeople();
  }
  
  // If set detail view is open, refresh it too
  const setDetailView = el("set-detail");
  if (setDetailView && !setDetailView.classList.contains("hidden") && state.selectedSet) {
    renderSetDetailSongs(state.selectedSet);
  }
}

async function loadPeople() {
  console.log('👥 loadPeople() called');
  console.log('  - state.currentTeamId:', state.currentTeamId);
  
  if (!state.currentTeamId) {
    console.warn('⚠️ No currentTeamId, cannot load people');
    state.people = [];
    state.pendingInvites = [];
    renderPeople();
    return;
  }
  
  console.log('  - Loading people for team_id:', state.currentTeamId);
  console.log('  - Current user ID:', state.session?.user?.id);
  console.log('  - Current user is owner (from state):', isOwner());
  
  // Query team_members WITHOUT profile join first to avoid RLS issues
  // Then fetch profiles separately and merge
  let teamMembers, teamMembersError, pendingInvites, pendingError;
  
  try {
    const [
      teamMembersResult,
      pendingInvitesResult
    ] = await Promise.all([
      safeSupabaseOperation(async () => {
        return await supabase
          .from("team_members")
          .select(`
            id,
            user_id,
            role,
            is_owner,
            can_manage,
            joined_at
          `)
          .eq("team_id", state.currentTeamId)
          .order("joined_at", { ascending: true });
      }),
      safeSupabaseOperation(async () => {
        return await supabase
          .from("pending_invites")
          .select("*")
          .eq("team_id", state.currentTeamId)
          .is("resolved_at", null)
          .order("full_name", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });
      }),
    ]);
    
    teamMembers = teamMembersResult?.data;
    teamMembersError = teamMembersResult?.error;
    pendingInvites = pendingInvitesResult?.data;
    pendingError = pendingInvitesResult?.error;
  } catch (err) {
    console.error('Error in loadPeople Promise.all:', err);
    teamMembersError = err;
    pendingError = err;
    teamMembers = null;
    pendingInvites = null;
  }
  
  // Now fetch profiles separately for all user_ids to avoid join RLS issues
  let profilesMap = {};
  if (teamMembers && teamMembers.length > 0) {
    const userIds = teamMembers.map(tm => tm.user_id).filter(Boolean);
    console.log('  - Fetching profiles for user_ids:', userIds);
    const profilesResult = await safeSupabaseOperation(async () => {
      return await supabase
        .from("profiles")
        .select("id, full_name, email, team_id, created_at")
        .in("id", userIds);
    });
    const { data: profiles, error: profilesError } = profilesResult;
    
    if (profilesError) {
      console.error('  - ❌ Error fetching profiles:', profilesError);
    } else {
      console.log('  - ✅ Fetched profiles:', profiles?.length || 0);
      // Create a map for quick lookup
      profilesMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
    }
  }

  // Log raw query results for debugging
  console.log('  - Raw team_members query result (NO profile join):', teamMembers);
  console.log('  - Number of members:', teamMembers?.length || 0);
  if (teamMembers) {
    teamMembers.forEach((tm, idx) => {
      const profile = profilesMap[tm.user_id];
      console.log(`  - Member ${idx + 1}:`, {
        user_id: tm.user_id,
        is_owner: tm.is_owner,
        can_manage: tm.can_manage,
        role: tm.role,
        profile_name: profile?.full_name || 'NOT FOUND',
        profile_email: profile?.email || 'NOT FOUND',
        'team_members.is_owner': tm.is_owner,
        'team_members.can_manage': tm.can_manage,
        'team_members.role': tm.role
      });
    });
  }
  
  // Also do a direct query to verify database state
  console.log('  - Verifying database state with direct query...');
  console.log('  - Querying team_id:', state.currentTeamId);
  const { data: directCheck, error: directError } = await supabase
    .from("team_members")
    .select("user_id, is_owner, can_manage, role, team_id")
    .eq("team_id", state.currentTeamId);
  console.log('  - Direct database check:', directCheck);
  console.log('  - Direct query error:', directError);
  
  // Check teams.owner_id
  const { data: teamCheck, error: teamCheckError } = await supabase
    .from("teams")
    .select("id, owner_id, name")
    .eq("id", state.currentTeamId)
    .single();
  console.log('  - Team check:', teamCheck);
  console.log('  - Team owner_id in database:', teamCheck?.owner_id);
  console.log('  - Team name:', teamCheck?.name);
  console.log('  - Team check error:', teamCheckError);
  
  // Verify: if team owner_id doesn't match what we expect, log a warning
  if (teamCheck?.owner_id && directCheck) {
    const ownerInMembers = directCheck.find(m => m.user_id === teamCheck.owner_id);
    console.log('  - Owner from teams.owner_id is in team_members:', !!ownerInMembers);
    if (ownerInMembers) {
      console.log('  - Owner member data:', {
        user_id: ownerInMembers.user_id,
        is_owner: ownerInMembers.is_owner,
        can_manage: ownerInMembers.can_manage,
        role: ownerInMembers.role
      });
      if (!ownerInMembers.is_owner) {
        console.error('  - ⚠️ WARNING: teams.owner_id points to a user who is NOT marked as owner in team_members!');
      }
    }
  }

  if (teamMembersError) {
    console.error("❌ Error loading team members:", teamMembersError);
    console.error("  - Error details:", JSON.stringify(teamMembersError, null, 2));
    
    // Fallback to old method if team_members table doesn't exist or RLS fails
    console.log("  - ⚠️ Falling back to profiles query...");
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .eq("team_id", state.currentTeamId)
      .order("full_name");
    
    if (profilesError) {
      console.error("❌ Error loading people (fallback):", profilesError);
      return;
    }
    
    // Filter out pending invites for users who already have accounts (profiles)
    const profileEmails = new Set(
      (profiles || []).map(p => (p.email || '').toLowerCase().trim()).filter(Boolean)
    );
    const filteredPendingInvites = (pendingInvites || []).filter(invite => {
      const inviteEmail = (invite.email || '').toLowerCase().trim();
      return !profileEmails.has(inviteEmail);
    });
    
    state.people = profiles || [];
    state.pendingInvites = filteredPendingInvites;
    renderPeople();
    return;
  }

  if (pendingError) {
    console.error("❌ Error loading pending invites:", pendingError);
    console.error("  - Error details:", JSON.stringify(pendingError, null, 2));
  }

  // Transform team_members data to match expected format
  // Merge with profiles data fetched separately
  const profiles = (teamMembers || [])
    .map(tm => {
      const profile = profilesMap[tm.user_id];
      if (!profile) {
        console.warn(`  - ⚠️ No profile found for user_id: ${tm.user_id}`);
        return null;
      }
      
      // CRITICAL: Ensure team_members data is the ONLY source for ownership/management
      // Profile data should ONLY provide name, email, etc. - NOT role/permissions
      const personData = {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        created_at: profile.created_at,
        // CRITICAL: Use ONLY team_members data for ownership/management
        // We explicitly set these from team_members to be absolutely sure
        role: tm.role,
        is_owner: tm.is_owner === true, // Explicit boolean conversion
        can_manage: tm.can_manage === true, // Explicit boolean conversion
        team_member_id: tm.id,
        joined_at: tm.joined_at,
        // Only include team_id from profile if it exists
        team_id: profile.team_id
      };
      
      // Log for debugging ownership issues - especially for owners
      if (tm.is_owner) {
        console.log('  - ✅ Owner detected (from team_members):', {
          id: personData.id,
          name: personData.full_name,
          email: personData.email,
          'team_members.is_owner': tm.is_owner,
          'team_members.can_manage': tm.can_manage,
          'team_members.role': tm.role,
          'final.is_owner': personData.is_owner,
          'final.can_manage': personData.can_manage,
          'final.role': personData.role
        });
      }
      
      // Also log if current user is owner but this person is not marked as owner
      if (isOwner() && tm.user_id === state.session?.user?.id && !tm.is_owner) {
        console.error('  - 🚨 CRITICAL: Current user is owner but team_members says they are NOT owner!', {
          current_user_id: state.session?.user?.id,
          team_member_user_id: tm.user_id,
          team_member_is_owner: tm.is_owner,
          team_member_role: tm.role
        });
      }
      
      return personData;
    })
    .filter(p => p !== null)
    .sort((a, b) => {
      // Sort by full_name
      const nameA = (a.full_name || "").toLowerCase();
      const nameB = (b.full_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  
  console.log('  - Final people data (showing is_owner status):', profiles.map(p => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
    is_owner: p.is_owner,
    can_manage: p.can_manage,
    role: p.role
  })));
  
  // CRITICAL CHECK: Compare what we're about to render vs what's in the database
  if (teamCheck?.owner_id) {
    const renderedOwner = profiles.find(p => p.is_owner === true);
    const expectedOwner = profiles.find(p => p.id === teamCheck.owner_id);
    console.log('  - 🔍 OWNERSHIP VERIFICATION:');
    console.log('    - teams.owner_id:', teamCheck.owner_id);
    console.log('    - Expected owner (from teams.owner_id):', expectedOwner ? {
      id: expectedOwner.id,
      name: expectedOwner.full_name,
      is_owner: expectedOwner.is_owner
    } : 'NOT FOUND IN PROFILES');
    console.log('    - Rendered owner (is_owner=true):', renderedOwner ? {
      id: renderedOwner.id,
      name: renderedOwner.full_name,
      is_owner: renderedOwner.is_owner
    } : 'NONE FOUND');
    if (renderedOwner && expectedOwner && renderedOwner.id !== expectedOwner.id) {
      console.error('  - 🚨 MISMATCH: Rendered owner does not match teams.owner_id!');
      console.error('    - Rendered:', renderedOwner.id, renderedOwner.full_name);
      console.error('    - Expected:', expectedOwner.id, expectedOwner.full_name);
    }
  }

  // Filter out pending invites for users who already have accounts (profiles)
  // Only show pending invites for users who still need to sign up
  const profileEmails = new Set(
    (profiles || []).map(p => (p.email || '').toLowerCase().trim()).filter(Boolean)
  );
  const filteredPendingInvites = (pendingInvites || []).filter(invite => {
    const inviteEmail = (invite.email || '').toLowerCase().trim();
    // Exclude if this email matches an existing profile
    return !profileEmails.has(inviteEmail);
  });

  console.log('  - ✅ People loaded:', profiles?.length || 0, 'profiles,', filteredPendingInvites?.length || 0, 'pending invites (filtered from', pendingInvites?.length || 0, 'total)');
  state.people = profiles || [];
  state.pendingInvites = filteredPendingInvites;
  renderPeople();
}

function renderPeople() {
  const peopleList = el("people-list");
  if (!peopleList) return;
  
  // Update team name display when rendering people (already handled in showApp, but keep for consistency)
  const teamNameDisplay = el("team-name-display");
  const teamNameHeader = el("team-name-header");
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  if (teamNameDisplay && currentTeam) {
    teamNameDisplay.textContent = currentTeam.name;
    if (teamNameHeader) {
      teamNameHeader.classList.remove("hidden");
    }
  } else if (teamNameHeader) {
    teamNameHeader.classList.add("hidden");
  }
  
  // Show/hide leave team button
  const leaveTeamBtn = el("btn-leave-team");
  if (leaveTeamBtn && currentTeam) {
    // Show leave button if user is not the only owner
    // We'll check this asynchronously to avoid blocking render
    (async () => {
      if (currentTeam.is_owner) {
        // Check if there are other owners
        const { data: owners } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", state.currentTeamId)
          .eq("is_owner", true);
        
        if (owners && owners.length === 1) {
          // Only owner - hide leave button
          leaveTeamBtn.classList.add("hidden");
        } else {
          // Not the only owner - show leave button
          leaveTeamBtn.classList.remove("hidden");
        }
      } else {
        // Not an owner - show leave button
        leaveTeamBtn.classList.remove("hidden");
      }
    })();
  } else if (leaveTeamBtn) {
    leaveTeamBtn.classList.add("hidden");
  }
  
  const searchInput = el("people-tab-search");
  const isManagerCheck = isManager();
  const searchTermRaw = searchInput ? searchInput.value.trim() : "";
  const searchTerm = searchTermRaw.toLowerCase();
  
  peopleList.innerHTML = "";
  
  // Add invite card for managers/owners (always show, not affected by search)
  // Check if user can manage the current team (owner or manager)
  const canManageCurrentTeam = currentTeam && (currentTeam.is_owner || currentTeam.can_manage);
  if (canManageCurrentTeam || isManager()) {
    const inviteCard = document.createElement("div");
    inviteCard.className = "card person-card invite-card";
    inviteCard.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 1rem; text-align: center; cursor: pointer;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">+</div>
        <h3 class="person-name" style="margin: 0;">Invite Member</h3>
      </div>
    `;
    inviteCard.addEventListener("click", () => openInviteModal());
    peopleList.appendChild(inviteCard);
  }
  
  // Filter people and pending invites based on search
  let filteredPeople = state.people || [];
  let filteredPending = state.pendingInvites || [];
  
  if (searchTerm) {
    // Filter people: prioritize name matches over email matches
    const allPeopleMatches = (state.people || []).filter((person) => {
      const nameMatch = (person.full_name || "").toLowerCase().includes(searchTerm);
      const emailMatch = (person.email || "").toLowerCase().includes(searchTerm);
      return nameMatch || emailMatch;
    });
    
    const nameMatches = allPeopleMatches.filter((person) =>
      (person.full_name || "").toLowerCase().includes(searchTerm)
    );
    const emailMatches = allPeopleMatches.filter((person) =>
      !(person.full_name || "").toLowerCase().includes(searchTerm)
    );
    filteredPeople = [...nameMatches, ...emailMatches];
    
    // Filter pending invites: prioritize name matches over email matches
    const allPendingMatches = (state.pendingInvites || []).filter((invite) => {
      const nameMatch = (invite.full_name || "").toLowerCase().includes(searchTerm);
      const emailMatch = (invite.email || "").toLowerCase().includes(searchTerm);
      return nameMatch || emailMatch;
    });
    
    const pendingNameMatches = allPendingMatches.filter((invite) =>
      (invite.full_name || "").toLowerCase().includes(searchTerm)
    );
    const pendingEmailMatches = allPendingMatches.filter((invite) =>
      !(invite.full_name || "").toLowerCase().includes(searchTerm)
    );
    filteredPending = [...pendingNameMatches, ...pendingEmailMatches];
  }
  
  // Sort people: managers first, then members, both alphabetically by name
  filteredPeople.sort((a, b) => {
    // First, sort by manager status (managers first)
    const aIsManager = a.can_manage === true;
    const bIsManager = b.can_manage === true;
    if (aIsManager !== bIsManager) {
      return bIsManager ? 1 : -1; // Managers come first
    }
    // Then sort alphabetically by name within each group
    const aName = (a.full_name || "").toLowerCase();
    const bName = (b.full_name || "").toLowerCase();
    return aName.localeCompare(bName);
  });
  
  const hasMembers = filteredPeople.length > 0;
  const hasPending = filteredPending.length > 0;
  const totalEntries = filteredPeople.length + filteredPending.length;

  if (totalEntries === 0) {
    if (searchTerm) {
      const noResults = document.createElement("p");
      noResults.className = "muted";
      noResults.textContent = "No members match your search.";
      peopleList.appendChild(noResults);
      return;
    }
    if (!isManagerCheck) {
      peopleList.innerHTML = '<p class="muted">No members yet.</p>';
      return;
    }
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "muted";
    emptyMessage.textContent = "No members yet. Invite someone to get started.";
    peopleList.appendChild(emptyMessage);
    return;
  }

  if (hasMembers) {
    filteredPeople.forEach((person) => {
      const div = document.createElement("div");
      div.className = "card person-card";
      
      if (isManagerCheck) {
        // Manager view: show email, edit name, delete
        const highlightedName = searchTermRaw ? highlightMatch(person.full_name || "", searchTermRaw) : escapeHtml(person.full_name || "");
        const highlightedEmail = person.email 
          ? (searchTermRaw && person.email.toLowerCase().includes(searchTerm) 
              ? highlightMatch(person.email, searchTermRaw)
              : escapeHtml(person.email))
          : null;
        
        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start; width: 100%; gap: 0.5rem;">
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <h3 class="person-name" style="margin: 0 0 0.5rem 0;">${highlightedName}</h3>
              ${highlightedEmail ? `
                <a href="mailto:${escapeHtml(person.email)}" class="person-email-link" style="color: var(--text-muted); text-decoration: none; font-size: 0.9rem;">
                  ${highlightedEmail}
                </a>
              ` : person.email ? `
                <a href="mailto:${escapeHtml(person.email)}" class="person-email-link" style="color: var(--text-muted); text-decoration: none; font-size: 0.9rem;">
                  ${escapeHtml(person.email)}
                </a>
              ` : '<span class="muted" style="font-size: 0.9rem;">No email</span>'}
              <div style="margin-top: 0.5rem;">
                ${person.is_owner ? '<span class="person-role" style="background: var(--accent-color); color: var(--bg-primary);">Owner</span>' : person.can_manage ? '<span class="person-role">Manager</span>' : '<span class="person-role">Member</span>'}
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; position: relative;">
              <div style="position: relative;">
                <button class="btn small ghost person-menu-btn" data-person-id="${person.id}" style="padding: 0.5rem;">
                  <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <div class="person-menu hidden" data-person-id="${person.id}" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 0.5rem; min-width: 180px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000;">
                  <button class="btn small ghost edit-person-btn" data-person-id="${person.id}" style="width: 100%; justify-content: flex-start; text-align: left;"><i class="fa-solid fa-pencil" style="margin-right: 0.5rem;"></i> Edit</button>
                  <button class="btn small ghost delete-person-btn" data-person-id="${person.id}" style="width: 100%; justify-content: flex-start; text-align: left; margin-top: 0.25rem;"><i class="fa-solid fa-trash" style="margin-right: 0.5rem;"></i> Remove</button>
                  ${isOwner() && !person.is_owner ? `
                    <div style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 0.5rem;">
                      ${person.can_manage 
                        ? `<button class="btn small ghost demote-manager-btn" data-person-id="${person.id}" style="width: 100%; justify-content: flex-start; text-align: left;"><i class="fa-solid fa-user-minus" style="margin-right: 0.5rem;"></i> Remove Manager</button>`
                        : `<button class="btn small ghost promote-manager-btn" data-person-id="${person.id}" style="width: 100%; justify-content: flex-start; text-align: left;"><i class="fa-solid fa-user-plus" style="margin-right: 0.5rem;"></i> Make Manager</button>`
                      }
                      <button class="btn small ghost transfer-ownership-btn" data-person-id="${person.id}" style="width: 100%; justify-content: flex-start; text-align: left; margin-top: 0.25rem;"><i class="fa-solid fa-crown" style="margin-right: 0.5rem;"></i> Transfer Ownership</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
        
        // Person menu button and handlers
        const menuBtn = div.querySelector(".person-menu-btn");
        const menu = div.querySelector(".person-menu");
        if (menuBtn && menu) {
          menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            // Close all other menus
            document.querySelectorAll(".person-menu").forEach(m => {
              if (m !== menu) m.classList.add("hidden");
            });
            menu.classList.toggle("hidden");
          });
        }
        
        const editBtn = div.querySelector(".edit-person-btn");
        if (editBtn) {
          editBtn.addEventListener("click", () => {
            openEditPersonModal(person);
            menu?.classList.add("hidden");
          });
        }
        
        const deleteBtn = div.querySelector(".delete-person-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", () => {
            deletePerson(person);
            menu?.classList.add("hidden");
          });
        }
        
        const promoteBtn = div.querySelector(".promote-manager-btn");
        if (promoteBtn) {
          promoteBtn.addEventListener("click", () => {
            promoteToManager(person.id);
            menu?.classList.add("hidden");
          });
        }
        
        const demoteBtn = div.querySelector(".demote-manager-btn");
        if (demoteBtn) {
          demoteBtn.addEventListener("click", () => {
            demoteFromManager(person.id);
            menu?.classList.add("hidden");
          });
        }
        
        const transferBtn = div.querySelector(".transfer-ownership-btn");
        if (transferBtn) {
          transferBtn.addEventListener("click", () => {
            transferOwnership(person);
            menu?.classList.add("hidden");
          });
        }
      } else {
        // Regular user view: just show name and role
        const highlightedName = searchTermRaw ? highlightMatch(person.full_name || "", searchTermRaw) : escapeHtml(person.full_name || "");
        div.innerHTML = `
          <h3 class="person-name">${highlightedName}</h3>
          ${person.is_owner ? '<span class="person-role" style="background: var(--accent-color); color: var(--bg-primary);">Owner</span>' : person.can_manage ? '<span class="person-role">Manager</span>' : '<span class="person-role">Member</span>'}
        `;
      }
      
      peopleList.appendChild(div);
    });
  }

  if (hasPending) {
    filteredPending.forEach((invite) => {
      const div = document.createElement("div");
      div.className = "card person-card pending-person-card";
      const displayName = invite.full_name || invite.email;
      
      // Highlight name and email
      const highlightedName = searchTermRaw ? highlightMatch(displayName || "", searchTermRaw) : escapeHtml(displayName || "");
      const highlightedEmail = invite.email 
        ? (searchTermRaw && invite.email.toLowerCase().includes(searchTerm)
            ? highlightMatch(invite.email, searchTermRaw)
            : escapeHtml(invite.email))
        : null;
      
      if (isManagerCheck) {
        // Manager view: show cancel button
        div.innerHTML = `
          <div class="pending-person-header">
            <div style="flex: 1; min-width: 0;">
              <h3 class="person-name" style="margin: 0;">${highlightedName}</h3>
              ${highlightedEmail ? `<span class="pending-person-email">${highlightedEmail}</span>` : invite.email ? `<span class="pending-person-email">${escapeHtml(invite.email)}</span>` : ""}
            </div>
            <span class="pending-pill">Pending</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
            <p class="muted small-text" style="margin: 0;">Invite sent</p>
            <button class="btn small ghost cancel-invite-btn" data-invite-id="${invite.id}">Cancel Invite</button>
          </div>
        `;
        
        const cancelBtn = div.querySelector(".cancel-invite-btn");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => cancelPendingInvite(invite));
        }
      } else {
        // Regular user view: no cancel button
        div.innerHTML = `
          <div class="pending-person-header">
            <div style="flex: 1; min-width: 0;">
              <h3 class="person-name" style="margin: 0;">${highlightedName}</h3>
              ${highlightedEmail ? `<span class="pending-person-email">${highlightedEmail}</span>` : invite.email ? `<span class="pending-person-email">${escapeHtml(invite.email)}</span>` : ""}
            </div>
            <span class="pending-pill">Pending</span>
          </div>
          <p class="muted small-text" style="margin-top: 0.75rem;">Invite sent</p>
        `;
      }
      
      peopleList.appendChild(div);
    });
  }
}

function formatTime(timeString) {
  if (!timeString) return "";
  // timeString is in format "HH:MM:SS" or "HH:MM"
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function renderTimes(serviceTimesContent, rehearsalTimesContent, set) {
  // Show/hide edit buttons for managers
  const editTimesBtn = el("btn-edit-times");
  const editTimesBtnMobile = el("btn-edit-times-mobile");
  
  if (isManager()) {
    if (editTimesBtn) editTimesBtn.classList.remove("hidden");
    if (editTimesBtnMobile) editTimesBtnMobile.classList.remove("hidden");
  } else {
    if (editTimesBtn) editTimesBtn.classList.add("hidden");
    if (editTimesBtnMobile) editTimesBtnMobile.classList.add("hidden");
  }
  
  // Render service times
  serviceTimesContent.innerHTML = "";
  if (set.service_times && set.service_times.length > 0) {
    // Sort service times
    const sortedTimes = [...set.service_times].sort((a, b) => 
      a.service_time.localeCompare(b.service_time)
    );
    sortedTimes.forEach((st) => {
      const timeItem = document.createElement("div");
      timeItem.className = "time-item";
      timeItem.innerHTML = `
        <div class="time-item-time">${formatTime(st.service_time)}</div>
      `;
      serviceTimesContent.appendChild(timeItem);
    });
  } else {
    serviceTimesContent.innerHTML = '<div class="no-times">No service times added</div>';
  }
  
  // Render rehearsal times
  rehearsalTimesContent.innerHTML = "";
  if (set.rehearsal_times && set.rehearsal_times.length > 0) {
    // Sort rehearsal times by date, then by time
    const sortedRehearsals = [...set.rehearsal_times].sort((a, b) => {
      const dateCompare = a.rehearsal_date.localeCompare(b.rehearsal_date);
      if (dateCompare !== 0) return dateCompare;
      return a.rehearsal_time.localeCompare(b.rehearsal_time);
    });
    sortedRehearsals.forEach((rt) => {
      const timeItem = document.createElement("div");
      timeItem.className = "time-item";
      const rehearsalDate = parseLocalDate(rt.rehearsal_date);
      const dateStr = rehearsalDate ? rehearsalDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) : rt.rehearsal_date;
      timeItem.innerHTML = `
        <div class="time-item-time">${formatTime(rt.rehearsal_time)}</div>
        <div class="time-item-date">${dateStr}</div>
      `;
      rehearsalTimesContent.appendChild(timeItem);
    });
  } else {
    rehearsalTimesContent.innerHTML = '<div class="no-times">No rehearsal times added</div>';
  }
}

// Helper function to get effective assignment mode for a set
function getSetAssignmentMode(set) {
  // If set has assignment_mode_override set, use it
  if (set.assignment_mode_override) {
    return set.assignment_mode_override;
  }
  
  // If no override, check what assignments the set actually has to determine mode
  // This preserves the mode for sets created before the override feature
  if (set.set_assignments && set.set_assignments.length > 0) {
    // Has set-level assignments, so it's per-set
    return 'per_set';
  }
  
  // Check if any songs have assignments (per-song mode)
  if (set.set_songs && set.set_songs.length > 0) {
    const hasSongAssignments = set.set_songs.some(setSong => 
      setSong.song_assignments && setSong.song_assignments.length > 0
    );
    if (hasSongAssignments) {
      return 'per_song';
    }
  }
  
  // If no assignments exist, use team default
  return state.teamAssignmentMode || 'per_set';
}

// Render per-set assignments
function renderSetAssignments(set, container) {
  if (!container) return;
  
  const assignmentMode = getSetAssignmentMode(set);
  
  // Only show assignments card when in per-set mode
  const assignmentsCard = el("set-assignments-display");
  const assignmentsCardMobile = el("set-assignments-display-mobile");
  
  if (assignmentMode === 'per_set') {
    if (assignmentsCard) assignmentsCard.classList.remove("hidden");
    if (assignmentsCardMobile) assignmentsCardMobile.classList.remove("hidden");
    
    // Get set-level assignments
    const setAssignments = set.set_assignments || [];
    
    if (setAssignments.length === 0) {
      container.innerHTML = '<div class="no-assignments">No assignments yet.</div>';
      return;
    }
    
    // Group assignments by role
    const assignmentsByRole = {};
    setAssignments.forEach(assignment => {
      if (!assignmentsByRole[assignment.role]) {
        assignmentsByRole[assignment.role] = [];
      }
      assignmentsByRole[assignment.role].push(assignment);
    });
    
    // Render grouped assignments
    container.innerHTML = "";
    Object.keys(assignmentsByRole).sort().forEach(role => {
      const roleItem = document.createElement("div");
      roleItem.className = "assignment-role-item";
      
      const roleName = document.createElement("div");
      roleName.className = "assignment-role-name";
      roleName.textContent = role;
      roleItem.appendChild(roleName);
      
      const peopleList = document.createElement("div");
      peopleList.className = "assignment-role-people";
      
      assignmentsByRole[role].forEach(assignment => {
        const personEl = document.createElement("div");
        const isPendingInvite = Boolean(assignment.pending_invite_id);
        const assignmentStatus = assignment.status || 'pending';
        const personName =
          assignment.person?.full_name ||
          assignment.pending_invite?.full_name ||
          assignment.person_name ||
          assignment.person_email ||
          assignment.pending_invite?.email ||
          "Unknown";
        
        personEl.className = `assignment-role-person ${isPendingInvite ? 'pending' : ''} status-${assignmentStatus}`;
        personEl.textContent = personName;
        
        // Make clickable to show assignment details modal
        personEl.style.cursor = "pointer";
        personEl.dataset.assignmentId = assignment.id;
        personEl.dataset.assignmentStatus = assignmentStatus;
        personEl.dataset.personName = personName;
        personEl.dataset.role = assignment.role;
        
        personEl.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showAssignmentDetailsModal({
            personName: personName,
            role: assignment.role,
            songTitle: null, // No song for set-level
            status: assignmentStatus,
            assignmentId: assignment.id
          });
        });
        
        // Add status indicator
        if (assignmentStatus === 'pending') {
          const statusBadge = document.createElement("span");
          statusBadge.className = "assignment-status-badge pending";
          statusBadge.textContent = "Pending";
          statusBadge.title = "Awaiting acceptance";
          personEl.appendChild(statusBadge);
        } else if (assignmentStatus === 'declined') {
          const statusBadge = document.createElement("span");
          statusBadge.className = "assignment-status-badge declined";
          statusBadge.textContent = "Declined";
          statusBadge.title = "Assignment declined";
          personEl.appendChild(statusBadge);
        }
        
        if (isPendingInvite) {
          const inviteBadge = document.createElement("span");
          inviteBadge.className = "assignment-status-badge invite";
          inviteBadge.textContent = "Invite";
          inviteBadge.title = "Pending invite";
          personEl.appendChild(inviteBadge);
        }
        
        peopleList.appendChild(personEl);
      });
      
      roleItem.appendChild(peopleList);
      container.appendChild(roleItem);
    });
  } else {
    // Hide assignments card when in per-song mode
    if (assignmentsCard) assignmentsCard.classList.add("hidden");
    if (assignmentsCardMobile) assignmentsCardMobile.classList.add("hidden");
  }
}

function switchSetDetailTab(tabName) {
  // Only switch tabs on mobile (tabs are hidden on desktop)
  const tabsContainer = document.querySelector(".set-detail-tabs");
  if (!tabsContainer || window.getComputedStyle(tabsContainer).display === "none") {
    return; // Don't switch if tabs aren't visible (desktop)
  }
  
  // Update tab buttons
  document.querySelectorAll(".set-detail-tabs .tab-btn").forEach(btn => {
    if (btn.dataset.detailTab === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  // Update tab content
  const songsTab = el("set-detail-tab-songs");
  const assignmentsTab = el("set-detail-tab-assignments");
  const timesTab = el("set-detail-tab-times");
  
  if (!songsTab || !timesTab) {
    console.error("Tab content elements not found", { songsTab, timesTab });
    return;
  }
  
  if (tabName === "songs") {
    songsTab.classList.remove("hidden");
    if (assignmentsTab) assignmentsTab.classList.add("hidden");
    timesTab.classList.add("hidden");
  } else if (tabName === "assignments") {
    songsTab.classList.add("hidden");
    if (assignmentsTab) assignmentsTab.classList.remove("hidden");
    timesTab.classList.add("hidden");
  } else if (tabName === "times") {
    songsTab.classList.add("hidden");
    if (assignmentsTab) assignmentsTab.classList.add("hidden");
    timesTab.classList.remove("hidden");
  }
}

function showSetDetail(set) {
  state.selectedSet = set;
  // Save selected set ID to localStorage so it persists across page reloads
  if (set?.id) {
    localStorage.setItem('cadence-selected-set-id', set.id.toString());
  }
  const dashboard = el("dashboard");
  const detailView = el("set-detail");
  
  dashboard.classList.add("hidden");
  detailView.classList.remove("hidden");
  
  // Populate detail view
  el("detail-set-title").textContent = set.title;
  const date = parseLocalDate(set.scheduled_date);
  el("detail-set-date").textContent = date ? date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) : "";
  el("detail-set-description").textContent = set.description || "No description yet";
  updateServiceLengthDisplay(set);
  
  // Show/hide edit/delete buttons for managers
  const editBtn = el("btn-edit-set-detail");
  const deleteBtn = el("btn-delete-set-detail");
  const viewAsMemberDetailBtn = el("btn-view-as-member-detail");
  const headerAddDropdown = el("header-add-dropdown-container");
  const mobileHeaderAddDropdown = el("mobile-header-add-dropdown-container");
  
  if (isManager()) {
    editBtn.classList.remove("hidden");
    deleteBtn.classList.remove("hidden");
    if (headerAddDropdown) {
      headerAddDropdown.classList.remove("hidden");
    }
    if (mobileHeaderAddDropdown) {
      mobileHeaderAddDropdown.classList.remove("hidden");
    }
  } else {
    editBtn.classList.add("hidden");
    deleteBtn.classList.add("hidden");
    if (headerAddDropdown) {
      headerAddDropdown.classList.add("hidden");
    }
    if (mobileHeaderAddDropdown) {
      mobileHeaderAddDropdown.classList.add("hidden");
    }
  }
  
  // Show/hide "View as Member" button in set detail (only for managers, not when already in member view)
  if (state.profile?.can_manage) {
    if (viewAsMemberDetailBtn) {
      viewAsMemberDetailBtn.classList.remove("hidden");
      // Grey out the button when already in member view
      if (state.isMemberView) {
        viewAsMemberDetailBtn.classList.add("disabled");
        viewAsMemberDetailBtn.disabled = true;
      } else {
        viewAsMemberDetailBtn.classList.remove("disabled");
        viewAsMemberDetailBtn.disabled = false;
      }
    }
  } else {
    if (viewAsMemberDetailBtn) viewAsMemberDetailBtn.classList.add("hidden");
  }
  
  // Render service times (desktop sidebar)
  const serviceTimesContent = el("service-times-content");
  const rehearsalTimesContent = el("rehearsal-times-content");
  renderTimes(serviceTimesContent, rehearsalTimesContent, set);
  
  // Render service times (mobile tab)
  const serviceTimesContentMobile = el("service-times-content-mobile");
  const rehearsalTimesContentMobile = el("rehearsal-times-content-mobile");
  if (serviceTimesContentMobile && rehearsalTimesContentMobile) {
    renderTimes(serviceTimesContentMobile, rehearsalTimesContentMobile, set);
  }
  
  // Render assignments (desktop sidebar)
  const assignmentsContent = el("set-assignments-content");
  const editAssignmentsBtn = el("btn-edit-assignments");
  if (assignmentsContent) {
    renderSetAssignments(set, assignmentsContent);
    // Show/hide edit button for managers
    if (isManager() && getSetAssignmentMode(set) === 'per_set') {
      if (editAssignmentsBtn) editAssignmentsBtn.classList.remove("hidden");
    } else {
      if (editAssignmentsBtn) editAssignmentsBtn.classList.add("hidden");
    }
  }
  
  // Render assignments (mobile tab)
  const assignmentsContentMobile = el("set-assignments-content-mobile");
  const editAssignmentsBtnMobile = el("btn-edit-assignments-mobile");
  if (assignmentsContentMobile) {
    renderSetAssignments(set, assignmentsContentMobile);
    // Show/hide edit button for managers
    if (isManager() && getSetAssignmentMode(set) === 'per_set') {
      if (editAssignmentsBtnMobile) editAssignmentsBtnMobile.classList.remove("hidden");
    } else {
      if (editAssignmentsBtnMobile) editAssignmentsBtnMobile.classList.add("hidden");
    }
  }
  
  // Ensure songs tab is visible initially
  const songsTab = el("set-detail-tab-songs");
  const assignmentsTab = el("set-detail-tab-assignments");
  const timesTab = el("set-detail-tab-times");
  if (songsTab) songsTab.classList.remove("hidden");
  if (assignmentsTab) assignmentsTab.classList.add("hidden");
  if (timesTab) timesTab.classList.add("hidden");
  
  // Show/hide assignments tab button on mobile based on assignment mode
  const assignmentMode = getSetAssignmentMode(set);
  const assignmentsTabButton = document.querySelector('.set-detail-tabs .tab-btn[data-detail-tab="assignments"]');
  if (assignmentsTabButton) {
    if (assignmentMode === 'per_set') {
      assignmentsTabButton.classList.remove("hidden");
    } else {
      assignmentsTabButton.classList.add("hidden");
      // If assignments tab is currently active, switch to songs tab
      if (assignmentsTabButton.classList.contains("active")) {
        switchSetDetailTab("songs");
      }
    }
  }
  
  // Reset to songs tab on mobile (only if tabs are visible)
  const tabsContainer = document.querySelector(".set-detail-tabs");
  if (tabsContainer && window.getComputedStyle(tabsContainer).display !== "none") {
    switchSetDetailTab("songs");
  }
  
  // Render songs
  renderSetDetailSongs(set);
}

function renderSetDetailSongs(set) {
  const songsList = el("detail-songs-list");
  songsList.innerHTML = "";
  // Reset drag setup flag since we're re-rendering
  delete songsList.dataset.dragSetup;
  const svcIconHtml = '<i class="fa-solid fa-pen-nib"></i>';
  const safeJoinMeta = (el, parts) => {
    if (!el) return;
    const safe = (str) => {
      if (str === null || str === undefined) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };
    const html = parts
      .filter(Boolean)
      .map((part) => {
        if (typeof part === "string") return safe(part);
        if (part?.html) return part.value;
        return "";
      })
      .filter(Boolean)
      .join(" • ");
    el.innerHTML = html;
  };
  
  // Render existing songs
  if (set.set_songs?.length) {
      set.set_songs
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .forEach((setSong, index) => {
        const plannedDurationSeconds = getSetSongDurationSeconds(setSong);
        const baseSongDurationSeconds = setSong.song?.duration_seconds || null;
        const durationLabel = (() => {
          if (plannedDurationSeconds !== undefined && plannedDurationSeconds !== null) {
            const base = formatDuration(plannedDurationSeconds);
            if (setSong.song_id && baseSongDurationSeconds && plannedDurationSeconds !== baseSongDurationSeconds) {
              return { html: true, value: `${base} ${svcIconHtml}` };
            }
            return base;
          }
          return baseSongDurationSeconds ? formatDuration(baseSongDurationSeconds) : null;
        })();
        
        // Check if this is a tag
        const tagInfo = isTag(setSong) ? parseTagDescription(setSong) : null;
        const isTagItem = !!tagInfo;
        
        // Check if this is a section (no song_id) or a song
        const isSection = !setSong.song_id && !isTagItem;
        
        // Check if this is a section header (section with no description, notes, or assignments)
        const isSectionHeader = isSection && 
          !setSong.description && 
          !setSong.notes && 
          (!setSong.song_assignments || setSong.song_assignments.length === 0);
        
        if (isSectionHeader) {
          // Render as section header (H1 title) - simple header with line underneath, no card styling
          const headerWrapper = document.createElement("div");
          headerWrapper.className = "draggable-item section-header-wrapper";
          headerWrapper.dataset.setSongId = setSong.id;
          headerWrapper.dataset.sequenceOrder = setSong.sequence_order;
          headerWrapper.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin: 2rem 0 1rem 0; border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; position: relative;";
          headerWrapper.draggable = false; // Will be set to true when dragging from handle
          
          // Add drag handle for managers (positioned on the left)
          const hasDragHandle = isManager();
          if (hasDragHandle) {
            const dragHandle = document.createElement("div");
            dragHandle.className = "drag-handle";
            dragHandle.style.cssText = "position: absolute; left: 0.5rem; top: 50%; transform: translateY(-50%); cursor: grab; color: var(--text-muted); font-size: 1.2rem; line-height: 1; padding: 0.5rem; display: flex; align-items: center; justify-content: center; transition: color 0.2s ease; flex-shrink: 0; z-index: 1;";
            dragHandle.textContent = "⋮⋮";
            dragHandle.title = "Drag to reorder";
            dragHandle.addEventListener("mousedown", function(e) {
              headerWrapper.draggable = true;
            });
            dragHandle.addEventListener("selectstart", function(e) {
              e.preventDefault();
            });
            dragHandle.style.userSelect = "none";
            headerWrapper.appendChild(dragHandle);
          }
          
          const headerElement = document.createElement("h1");
          headerElement.className = "section-header-title";
          headerElement.textContent = setSong.title || "Untitled Header";
          // If user can edit and there's a drag handle, add padding to move title over
          // Otherwise, keep title left aligned
          if (hasDragHandle) {
            headerElement.style.cssText = "margin: 0; font-size: 1.75rem; font-weight: 700; color: var(--text-primary); flex: 1; padding-left: 2.5rem;";
          } else {
            headerElement.style.cssText = "margin: 0; font-size: 1.75rem; font-weight: 700; color: var(--text-primary); flex: 1;";
          }
          
          headerWrapper.appendChild(headerElement);
          
          // Add edit/remove buttons for managers
          if (isManager()) {
            const actionsContainer = document.createElement("div");
            actionsContainer.style.cssText = "display: flex; gap: 0.5rem; align-items: center;";
            
            const editBtn = document.createElement("button");
            editBtn.className = "btn small ghost";
            editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i> Edit';
            editBtn.dataset.setSongId = setSong.id;
            editBtn.addEventListener("click", () => openEditSetSongModal(setSong));
            
            const removeBtn = document.createElement("button");
            removeBtn.className = "btn small ghost";
            removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Remove';
            removeBtn.dataset.setSongId = setSong.id;
            removeBtn.addEventListener("click", async () => {
              const headerTitle = setSong.title || "this header";
              showDeleteConfirmModal(
                headerTitle,
                `Remove "${headerTitle}" from this set?`,
                async () => {
                  await removeSongFromSet(setSong.id, set.id);
                }
              );
            });
            
            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(removeBtn);
            headerWrapper.appendChild(actionsContainer);
          }
          
          songsList.appendChild(headerWrapper);
          return; // Skip the normal card rendering
        }
        
        const songNode = document
          .getElementById("song-item-template")
          .content.cloneNode(true);
        const card = songNode.querySelector(".set-song-card");
        card.dataset.setSongId = setSong.id;
        card.dataset.sequenceOrder = setSong.sequence_order;
        
        // Only make draggable for managers
        const dragHandle = songNode.querySelector(".drag-handle");
        const songHeader = songNode.querySelector(".set-song-header");
        if (isManager()) {
          card.classList.add("draggable-item");
          card.draggable = false; // Will be set to true when dragging from handle
          if (dragHandle) {
            dragHandle.style.display = "flex";
            dragHandle.style.cursor = "grab";
          }
          // Keep padding for drag handle
          if (songHeader) {
            songHeader.style.paddingLeft = "2.5rem";
          }
        } else {
          card.classList.remove("draggable-item");
          card.draggable = false;
          if (dragHandle) dragHandle.style.display = "none";
          // Remove padding when drag handle is hidden
          if (songHeader) {
            songHeader.style.paddingLeft = "0";
          }
        }
        
        if (isTagItem) {
          // Render as tag
          const tagSongTitle = setSong.song?.title ?? "Untitled";
          const partName = setSong.title || "Untitled Part";
          songNode.querySelector(".song-title").textContent = `${tagSongTitle} - ${partName}`;
          
          // Add tag indicator class
          card.classList.add("set-song-tag-card");
          
          const displayKey = setSong.key || (setSong.song?.song_keys && setSong.song.song_keys.length > 0 
            ? setSong.song.song_keys.map(k => k.key).join(", ")
            : null);
          safeJoinMeta(songNode.querySelector(".song-meta"), [
            displayKey,
            setSong.song?.time_signature,
            setSong.song?.bpm ? `${setSong.song.bpm} BPM` : null,
            durationLabel,
          ]);
          songNode.querySelector(".song-notes").textContent =
            setSong.notes || "";
        } else if (isSection) {
          // Render as section
          songNode.querySelector(".song-title").textContent = setSong.title || "Untitled Section";
          const sectionMetaParts = [];
          if (setSong.description) sectionMetaParts.push(setSong.description);
          if (durationLabel) sectionMetaParts.push({ html: true, value: durationLabel.html ? `Length: ${durationLabel.value}` : `Length: ${durationLabel}` });
          safeJoinMeta(songNode.querySelector(".song-meta"), sectionMetaParts);
          songNode.querySelector(".song-notes").textContent = setSong.notes || "";
          // View Details button will be set up later in the code
          
          // Display section links if they exist
          const sectionLinks = setSong.song_links || [];
          if (sectionLinks.length > 0) {
            // Sort links by display_order
            const sortedLinks = [...sectionLinks].sort((a, b) => {
              const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
              const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
              if (ao !== bo) return ao - bo;
              const at = (a?.title || "").toLowerCase();
              const bt = (b?.title || "").toLowerCase();
              return at.localeCompare(bt);
            });
            
            // Create links container after notes
            const notesEl = songNode.querySelector(".song-notes");
            if (notesEl) {
              const linksContainer = document.createElement("div");
              linksContainer.className = "section-links-display";
              linksContainer.style.marginTop = "1rem";
              linksContainer.style.paddingTop = "1rem";
              linksContainer.style.borderTop = "1px solid var(--border-color)";
              
              const linksTitle = document.createElement("h4");
              linksTitle.className = "section-subtitle";
              linksTitle.textContent = "Links & Resources";
              linksTitle.style.marginBottom = "0.75rem";
              linksTitle.style.fontSize = "0.9rem";
              linksTitle.style.fontWeight = "600";
              linksTitle.style.color = "var(--text-primary)";
              linksContainer.appendChild(linksTitle);
              
              const linksList = document.createElement("div");
              linksList.style.display = "flex";
              linksList.style.flexDirection = "column";
              linksList.style.gap = "0.5rem";
              
              // Render links asynchronously to handle file URL generation
              (async () => {
                for (const link of sortedLinks) {
                  const linkEl = document.createElement("a");
                  linkEl.className = "song-link-display";
                  
                  if (link.is_file_upload && link.file_path) {
                    console.log('Rendering file upload in set detail:', {
                      title: link.title,
                      file_path: link.file_path,
                      file_name: link.file_name,
                      is_file_upload: link.is_file_upload
                    });
                    
                    // Check if it's an audio file
                    const isAudio = isAudioFile(link.file_type, link.file_name);
                    
                    // File upload - get signed URL
                    const fileUrl = await getFileUrl(link.file_path);
                    
                    if (isAudio && fileUrl) {
                      // Create audio player instead of download link
                      const audioContainer = document.createElement("div");
                      audioContainer.className = "song-link-display audio-player-container";
                      audioContainer.style.display = "flex";
                      audioContainer.style.alignItems = "center";
                      audioContainer.style.gap = "0.75rem";
                      audioContainer.style.padding = "0.75rem";
                      audioContainer.style.background = "var(--bg-secondary)";
                      audioContainer.style.borderRadius = "0.5rem";
                      audioContainer.style.border = "1px solid var(--border-color)";
                      
                      // Audio icon
                      const audioIcon = document.createElement("div");
                      audioIcon.className = "song-link-favicon";
                      audioIcon.innerHTML = '<i class="fa-solid fa-music" style="font-size: 1.2rem; color: var(--accent-color);"></i>';
                      
                      const content = document.createElement("div");
                      content.className = "song-link-content";
                      content.style.flex = "1";
                      content.style.minWidth = "0";
                      
                      const title = document.createElement("div");
                      title.className = "song-link-title";
                      title.textContent = link.title;
                      
                      // Audio player
                      const audio = document.createElement("audio");
                      audio.controls = true;
                      audio.src = fileUrl;
                      audio.style.width = "100%";
                      audio.style.marginTop = "0.5rem";
                      audio.preload = "metadata";
                      
                      content.appendChild(title);
                      content.appendChild(audio);
                      
                      audioContainer.appendChild(audioIcon);
                      audioContainer.appendChild(content);
                      
                      linksList.appendChild(audioContainer);
                      continue; // Skip the link creation for audio files
                    }
                    
                    // For non-audio files, create download link
                    if (fileUrl) {
                      linkEl.href = fileUrl;
                      linkEl.target = "_blank";
                      linkEl.rel = "noopener noreferrer";
                      linkEl.download = link.file_name || link.title;
                      linkEl.style.cursor = "pointer";
                    } else {
                      // Don't make it clickable if URL generation failed
                      linkEl.href = "#";
                      linkEl.onclick = (e) => {
                        e.preventDefault();
                        toastError("Unable to load file. Please try again later.");
                        return false;
                      };
                      linkEl.style.cursor = "not-allowed";
                      linkEl.style.opacity = "0.6";
                      linkEl.title = "File unavailable";
                    }
                    
                    // File icon
                    const fileIcon = document.createElement("div");
                    fileIcon.className = "song-link-favicon";
                    fileIcon.innerHTML = '<i class="fa-solid fa-file" style="font-size: 1.2rem; color: var(--text-secondary);"></i>';
                    
                    const content = document.createElement("div");
                    content.className = "song-link-content";
                    
                    const title = document.createElement("div");
                    title.className = "song-link-title";
                    title.textContent = link.title;
                    
                    const fileInfo = document.createElement("div");
                    fileInfo.className = "song-link-url";
                    fileInfo.textContent = link.file_name || "File";
                    if (link.file_type) {
                      fileInfo.textContent += ` (${link.file_type})`;
                    }
                    
                    content.appendChild(title);
                    content.appendChild(fileInfo);
                    
                    linkEl.appendChild(fileIcon);
                    linkEl.appendChild(content);
                  } else {
                    // URL link
                    linkEl.href = link.url;
                    linkEl.target = "_blank";
                    linkEl.rel = "noopener noreferrer";
                    
                    const favicon = document.createElement("img");
                    favicon.className = "song-link-favicon";
                    favicon.src = getFaviconUrl(link.url);
                    favicon.alt = "";
                    favicon.onerror = () => {
                      favicon.style.display = "none";
                    };
                    
                    const content = document.createElement("div");
                    content.className = "song-link-content";
                    
                    const title = document.createElement("div");
                    title.className = "song-link-title";
                    title.textContent = link.title;
                    
                    const url = document.createElement("div");
                    url.className = "song-link-url";
                    url.textContent = link.url;
                    
                    content.appendChild(title);
                    content.appendChild(url);
                    
                    linkEl.appendChild(favicon);
                    linkEl.appendChild(content);
                  }
                  
                  linksList.appendChild(linkEl);
                }
              })();
              
              linksContainer.appendChild(linksList);
              notesEl.parentNode.insertBefore(linksContainer, notesEl.nextSibling);
            }
          }
        } else {
          // Render as song
          songNode.querySelector(".song-title").textContent =
            setSong.song?.title ?? "Untitled";
          const displayKey = setSong.key || (setSong.song?.song_keys && setSong.song.song_keys.length > 0 
            ? setSong.song.song_keys.map(k => k.key).join(", ")
            : null);
          safeJoinMeta(songNode.querySelector(".song-meta"), [
            displayKey,
            setSong.song?.time_signature,
            setSong.song?.bpm ? `${setSong.song.bpm} BPM` : null,
            durationLabel,
          ]);
          songNode.querySelector(".song-notes").textContent =
            setSong.notes || "";
        }

        // Remove old tag pill code - tags are now separate items
        const tagsWrap = songNode.querySelector(".set-song-tags");
        if (tagsWrap) {
          tagsWrap.innerHTML = "";
        }

        const assignmentsWrap = songNode.querySelector(".assignments");
        const assignmentMode = getSetAssignmentMode(set);
        
        // Hide assignments section completely when in per-set mode
        if (assignmentMode === 'per_set') {
          assignmentsWrap.style.display = 'none';
        } else {
          assignmentsWrap.style.display = '';
        if (!setSong.song_assignments?.length) {
          assignmentsWrap.innerHTML =
            '<span class="muted">No assignments yet.</span>';
        } else {
          setSong.song_assignments.forEach((assignment) => {
            const pill = document
              .getElementById("assignment-pill-template")
              .content.cloneNode(true);
            pill.querySelector(".assignment-role").textContent =
              assignment.role;
            const personEl = pill.querySelector(".assignment-person");
            const isPendingInvite = Boolean(assignment.pending_invite_id);
            const assignmentStatus = assignment.status || 'pending';
            const personName =
              assignment.person?.full_name ||
              assignment.pending_invite?.full_name ||
              assignment.person_name ||
              assignment.person_email ||
              assignment.pending_invite?.email ||
              "Unknown";
            if (personEl) {
              personEl.textContent = personName;
              if (isPendingInvite) {
                const inviteTag = document.createElement("span");
                inviteTag.className = "pending-inline-tag";
                inviteTag.textContent = " (Invite)";
                personEl.appendChild(inviteTag);
              }
              // Add status indicator
              if (assignmentStatus === 'pending') {
                const statusBadge = document.createElement("span");
                statusBadge.className = "assignment-status-badge pending";
                statusBadge.textContent = "Pending";
                statusBadge.title = "Awaiting acceptance";
                statusBadge.style.marginLeft = "0.25rem";
                statusBadge.style.fontSize = "0.7rem";
                personEl.appendChild(statusBadge);
              } else if (assignmentStatus === 'declined') {
                const statusBadge = document.createElement("span");
                statusBadge.className = "assignment-status-badge declined";
                statusBadge.textContent = "Declined";
                statusBadge.title = "Assignment declined";
                statusBadge.style.marginLeft = "0.25rem";
                statusBadge.style.fontSize = "0.7rem";
                personEl.appendChild(statusBadge);
              }
            }
            const pillRoot = pill.querySelector(".assignment-pill");
            if (isPendingInvite && pillRoot) {
              pillRoot.classList.add("pending");
            }
            if (assignmentStatus === 'pending' && pillRoot) {
              pillRoot.classList.add("status-pending");
            }
            if (assignmentStatus === 'declined' && pillRoot) {
              pillRoot.classList.add("status-declined");
            }
            
            // Make clickable to show assignment details modal (in set detail view)
            if (pillRoot) {
              pillRoot.style.cursor = "pointer";
              pillRoot.dataset.assignmentId = assignment.id;
              pillRoot.dataset.assignmentStatus = assignmentStatus;
              pillRoot.dataset.personName = personName;
              pillRoot.dataset.role = assignment.role;
              pillRoot.dataset.songTitle = setSong.song_id 
                ? (setSong.song?.title || setSong.title || "Unknown Song")
                : (setSong.title || "Unknown Section");
              
              pillRoot.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                showAssignmentDetailsModal({
                  personName: personName,
                  role: assignment.role,
                  songTitle: setSong.song_id 
                    ? (setSong.song?.title || setSong.title || "Unknown Song")
                    : (setSong.title || "Unknown Section"),
                  status: assignmentStatus,
                  assignmentId: assignment.id
                });
              });
            }
            
            assignmentsWrap.appendChild(pill);
          });
          }
        }

        // Add edit and remove buttons for managers
        const editBtn = songNode.querySelector(".edit-set-song-btn");
        const removeBtn = songNode.querySelector(".remove-song-from-set-btn");
        if (isManager()) {
          if (editBtn) {
            editBtn.classList.remove("hidden");
            editBtn.dataset.setSongId = setSong.id;
            editBtn.addEventListener("click", () => openEditSetSongModal(setSong));
          }
          if (removeBtn) {
            removeBtn.classList.remove("hidden");
            removeBtn.dataset.setSongId = setSong.id;
            removeBtn.addEventListener("click", async () => {
              // For sections, use title; for songs, use song.title
              // Check if it's a section by checking if song_id is null
              const isSectionItem = !setSong.song_id;
              const itemTitle = isSectionItem ? (setSong.title || "this section") : (setSong.song?.title || "this song");
              showDeleteConfirmModal(
                itemTitle,
                `Remove "${itemTitle}" from this set?`,
                async () => {
                  await removeSongFromSet(setSong.id, set.id);
                }
              );
            });
          }
        }
        
        // Add view details button (for songs, tags, and sections)
        const viewDetailsBtn = songNode.querySelector(".view-song-details-btn");
        if (viewDetailsBtn && setSong.song && !isSection) {
          viewDetailsBtn.dataset.songId = setSong.song.id;
          viewDetailsBtn.addEventListener("click", () => {
            openSongDetailsModal(setSong.song, setSong.key || null);
          });
        } else if (viewDetailsBtn && isSection) {
          // Set up section details button
          viewDetailsBtn.style.display = "";
          viewDetailsBtn.textContent = "View Details";
          viewDetailsBtn.dataset.setSongId = setSong.id;
          viewDetailsBtn.addEventListener("click", () => {
            openSectionDetailsModal(setSong);
          });
        }

        songsList.appendChild(songNode);
      });
    
    // Setup drag and drop for songs (managers only)
    if (isManager()) {
      setupSongDragAndDrop(songsList);
    }
  }
  
  // Add "Add Song/Section" card at the end for managers
  if (isManager()) {
    const addCard = document.createElement("div");
    addCard.className = "card set-song-card add-song-card";
    addCard.innerHTML = `
      <div style="display: flex; min-height: 150px;">
        <div class="add-item-half add-song-half" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; cursor: pointer; position: relative;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-compact-disc"></i></div>
          <h4 style="margin: 0; color: var(--text-primary); font-weight: 600;">Add Song</h4>
          <p style="margin: 0.5rem 0 0 0; color: var(--text-muted); font-size: 0.9rem;">From catalog</p>
        </div>
        <div style="width: 1px; background: var(--border-color); margin: 1rem 0;"></div>
        <div class="add-item-half add-section-half" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; cursor: pointer; position: relative;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-microphone-lines"></i></div>
          <h4 style="margin: 0; color: var(--text-primary); font-weight: 600;">Add Section</h4>
          <p style="margin: 0.5rem 0 0 0; color: var(--text-muted); font-size: 0.9rem;">Custom section</p>
        </div>
      </div>
    `;
    addCard.querySelector(".add-song-half").addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.selectedSet) {
        openSongModal();
      }
    });
    addCard.querySelector(".add-section-half").addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.selectedSet) {
        openSectionModal();
      }
    });
    songsList.appendChild(addCard);
  } else if (!set.set_songs?.length) {
    songsList.innerHTML = '<p class="muted">No songs or sections added to this set yet.</p>';
  }
  
  updateServiceLengthDisplay(set);
}

function hideSetDetail() {
  closeHeaderDropdown();
  const dashboard = el("dashboard");
  const detailView = el("set-detail");
  
  // Stop all audio players in the set detail view before hiding
  if (detailView) {
    const audioPlayers = detailView.querySelectorAll("audio");
    audioPlayers.forEach(audio => {
      audio.pause();
      audio.currentTime = 0; // Reset to beginning
    });
  }
  
  dashboard.classList.remove("hidden");
  detailView.classList.add("hidden");
  state.selectedSet = null;
  // Clear saved set ID from localStorage
  localStorage.removeItem('cadence-selected-set-id');
  
  // Recalculate assignment pills to show actual assignments instead of "+X more"
  // Use a small delay to ensure the dashboard is visible and layout is complete
  setTimeout(() => {
    recalculateAllAssignmentPills();
  }, 100);
}

// Drag and Drop Functions
function setupSongDragAndDrop(container) {
  // Store handlers on the container so we can remove them later
  if (container._songDragHandlers) {
    // Remove old listeners
    container.removeEventListener("dragover", container._songDragHandlers.containerDragOver);
    container.removeEventListener("drop", container._songDragHandlers.containerDrop);
  }
  
  // Include song cards, section headers, and tag cards in drag and drop
  const items = container.querySelectorAll(".set-song-card.draggable-item, .section-header-wrapper.draggable-item");
  
  // Define handlers as named functions
  const handleDragStart = function(e) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", this.dataset.setSongId);
    this.classList.add("dragging");
    this.style.opacity = "0.5";
  };
  
  const handleDragEnd = function(e) {
    this.classList.remove("dragging");
    this.style.opacity = "";
    this.draggable = false;
    container.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
  };
  
  const handleDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    const dragging = container.querySelector(".dragging");
    if (!dragging || dragging === this) return;
    
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    
    const afterElement = getDragAfterElement(container, e.clientY, dragging);
    
    container.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    
    if (afterElement == null) {
      // Drop at the end
      const addCard = container.querySelector(".add-song-card");
      if (addCard && addCard.previousSibling !== dragging) {
        container.insertBefore(dragging, addCard);
        const indicator = document.createElement("div");
        indicator.className = "drop-indicator";
        container.insertBefore(indicator, addCard);
      } else if (!addCard) {
        container.appendChild(dragging);
        const indicator = document.createElement("div");
        indicator.className = "drop-indicator";
        container.appendChild(indicator);
      }
    } else {
      // Drop before afterElement (could be at beginning, middle, or end)
      container.insertBefore(dragging, afterElement);
      const indicator = document.createElement("div");
      indicator.className = "drop-indicator";
      container.insertBefore(indicator, afterElement);
    }
  };
  
  const handleDrop = async function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double-processing
    if (container.dataset.processingDrop === "true") {
      return;
    }
    container.dataset.processingDrop = "true";
    
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedItem = container.querySelector(`[data-set-song-id="${draggedId}"]`);
    
    if (!draggedItem) {
      container.dataset.processingDrop = "false";
      return;
    }
    
    // Remove indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    
    // Get fresh bounding rects by forcing a reflow
    container.offsetHeight;
    
    // Calculate where the item should be dropped based on current mouse position
    const afterElement = getDragAfterElement(container, e.clientY, draggedItem);
    const addCard = container.querySelector(".add-song-card");
    
    // Move the dragged item to its final position
    if (afterElement == null) {
      // Drop at the end (after all items, before add card if it exists)
      if (addCard) {
        container.insertBefore(draggedItem, addCard);
      } else {
        container.appendChild(draggedItem);
      }
    } else {
      // Drop before the afterElement (which could be at the beginning or middle)
      container.insertBefore(draggedItem, afterElement);
    }
    
    // Clean up dragging state
    draggedItem.classList.remove("dragging");
    draggedItem.style.opacity = "";
    draggedItem.draggable = false;
    
    // Get the final DOM order (include both song cards and section headers)
    const allItems = Array.from(container.children);
    const items = allItems
      .filter(el => (el.classList.contains("set-song-card") || el.classList.contains("section-header-wrapper")) && el.classList.contains("draggable-item"))
      .map((el, index) => {
        const id = el.dataset.setSongId;
        if (!id) {
          console.warn("Missing setSongId on element:", el);
        }
        return {
          id: id,
          sequence_order: index
        };
      })
      .filter(item => item.id); // Filter out any items without IDs
    
    if (items.length === 0) {
      console.warn("No items to update in handleDrop");
      return;
    }
    
    // Optimistically update the state to match DOM order immediately
    if (state.selectedSet && state.selectedSet.set_songs) {
      const orderedSetSongs = items.map(item => {
        const setSong = state.selectedSet.set_songs.find(ss => String(ss.id) === String(item.id));
        return setSong ? { ...setSong, sequence_order: item.sequence_order } : null;
      }).filter(Boolean);
      
      // Update state immediately to prevent re-render from reverting DOM
      state.selectedSet.set_songs = orderedSetSongs;
      
      // Update data attributes to match new order
      allItems.forEach((el, index) => {
        if ((el.classList.contains("set-song-card") || el.classList.contains("section-header-wrapper")) && el.classList.contains("draggable-item")) {
          el.dataset.sequenceOrder = index;
        }
      });
    }
    
    console.log("handleDrop - items to update:", items);
    
    // Check if the dragged item is a tag and update its parent if needed
    const draggedSetSong = state.selectedSet?.set_songs?.find(ss => String(ss.id) === String(draggedId));
    if (draggedSetSong && isTag(draggedSetSong)) {
      // Find the nearest song above the tag (not a section or another tag)
      const finalIndex = Array.from(container.children).indexOf(draggedItem);
      let parentSetSong = null;
      
      // Look backwards from the tag's position to find the nearest song
      for (let i = finalIndex - 1; i >= 0; i--) {
        const prevItem = container.children[i];
        if (prevItem.classList.contains("set-song-card") || prevItem.classList.contains("section-header-wrapper")) {
          const prevId = prevItem.dataset.setSongId;
          if (prevId) {
            const prevSetSong = state.selectedSet.set_songs.find(ss => String(ss.id) === String(prevId));
            if (prevSetSong && prevSetSong.song_id && !isTag(prevSetSong)) {
              parentSetSong = prevSetSong;
              break;
            }
          }
        }
      }
      
      if (parentSetSong) {
        // Update tag's parent reference
        const tagInfo = parseTagDescription(draggedSetSong);
        if (tagInfo && tagInfo.parentSetSongId !== parentSetSong.id) {
          const newDescription = JSON.stringify({
            parentSetSongId: parentSetSong.id,
            tagType: tagInfo.tagType,
          });
          
          await supabase
            .from("set_songs")
            .update({ description: newDescription })
            .eq("id", draggedSetSong.id);
        }
      }
    }
    
    await updateSongOrder(items, false); // Pass false to skip re-render
    
    // Clear processing flag
    container.dataset.processingDrop = "false";
  };
  
  items.forEach((item) => {
    const dragHandle = item.querySelector(".drag-handle");
    if (dragHandle) {
      dragHandle.addEventListener("mousedown", function(e) {
        item.draggable = true;
      });
      // Prevent text selection on the drag handle
      dragHandle.addEventListener("selectstart", function(e) {
        e.preventDefault();
      });
      dragHandle.style.userSelect = "none";
    }
    
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragend", handleDragEnd);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("drop", handleDrop);
  });
  
  // Container-level handlers
  const handleContainerDragOver = function(e) {
    e.preventDefault();
    const dragging = container.querySelector(".dragging");
    if (!dragging) return;
    
    const addCard = container.querySelector(".add-song-card");
    const draggableItems = container.querySelectorAll(".set-song-card.draggable-item:not(.dragging), .section-header-wrapper.draggable-item:not(.dragging)");
    const lastItem = draggableItems[draggableItems.length - 1];
    
    if (lastItem && e.clientY > lastItem.getBoundingClientRect().bottom) {
      container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
      
      if (addCard && dragging.nextSibling !== addCard) {
        container.insertBefore(dragging, addCard);
        const indicator = document.createElement("div");
        indicator.className = "drop-indicator";
        container.insertBefore(indicator, addCard);
      } else if (!addCard) {
        container.appendChild(dragging);
        const indicator = document.createElement("div");
        indicator.className = "drop-indicator";
        container.appendChild(indicator);
      }
    }
  };
  
  const handleContainerDrop = async function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double-processing
    if (container.dataset.processingDrop === "true") {
      return;
    }
    
    // Only handle if the drop didn't happen on a specific item
    // (items have their own drop handlers that should take precedence)
    if (e.target.classList.contains("set-song-card") || 
        e.target.classList.contains("section-header-wrapper") ||
        e.target.closest(".set-song-card") || 
        e.target.closest(".section-header-wrapper")) {
      // Let the item's drop handler deal with it
      return;
    }
    
    container.dataset.processingDrop = "true";
    
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedItem = container.querySelector(`[data-set-song-id="${draggedId}"]`);
    
    if (!draggedItem) {
      container.dataset.processingDrop = "false";
      return;
    }
    
    // Remove indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    
    // Get fresh bounding rects by forcing a reflow
    container.offsetHeight;
    
    // Use the same logic as handleDrop for consistency
    const afterElement = getDragAfterElement(container, e.clientY, draggedItem);
    const addCard = container.querySelector(".add-song-card");
    
    // Move the dragged item to its final position
    if (afterElement == null) {
      // Drop at the end (after all items, before add card if it exists)
      if (addCard) {
        container.insertBefore(draggedItem, addCard);
      } else {
        container.appendChild(draggedItem);
      }
    } else {
      // Drop before the afterElement (which could be at the beginning or middle)
      container.insertBefore(draggedItem, afterElement);
    }
    
    // Clean up dragging state
    draggedItem.classList.remove("dragging");
    draggedItem.style.opacity = "";
    draggedItem.draggable = false;
    
    // Get the final DOM order (include both song cards and section headers)
    const allItems = Array.from(container.children);
    const items = allItems
      .filter(el => (el.classList.contains("set-song-card") || el.classList.contains("section-header-wrapper")) && el.classList.contains("draggable-item"))
      .map((el, index) => {
        const id = el.dataset.setSongId;
        if (!id) {
          console.warn("Missing setSongId on element:", el);
        }
        return {
          id: id,
          sequence_order: index
        };
      })
      .filter(item => item.id); // Filter out any items without IDs
    
    if (items.length === 0) {
      console.warn("No items to update in handleContainerDrop");
      container.dataset.processingDrop = "false";
      return;
    }
    
    // Check if the dragged item is a tag and update its parent if needed
    const draggedSetSong = state.selectedSet?.set_songs?.find(ss => String(ss.id) === String(draggedId));
    if (draggedSetSong && isTag(draggedSetSong)) {
      // Find the nearest song above the tag (not a section or another tag)
      const finalIndex = Array.from(container.children).indexOf(draggedItem);
      let parentSetSong = null;
      
      // Look backwards from the tag's position to find the nearest song
      for (let i = finalIndex - 1; i >= 0; i--) {
        const prevItem = container.children[i];
        if (prevItem.classList.contains("set-song-card") || prevItem.classList.contains("section-header-wrapper")) {
          const prevId = prevItem.dataset.setSongId;
          if (prevId) {
            const prevSetSong = state.selectedSet.set_songs.find(ss => String(ss.id) === String(prevId));
            if (prevSetSong && prevSetSong.song_id && !isTag(prevSetSong)) {
              parentSetSong = prevSetSong;
              break;
            }
          }
        }
      }
      
      if (parentSetSong) {
        // Update tag's parent reference
        const tagInfo = parseTagDescription(draggedSetSong);
        if (tagInfo && tagInfo.parentSetSongId !== parentSetSong.id) {
          const newDescription = JSON.stringify({
            parentSetSongId: parentSetSong.id,
            tagType: tagInfo.tagType,
          });
          
          await supabase
            .from("set_songs")
            .update({ description: newDescription })
            .eq("id", draggedSetSong.id);
        }
      }
    }
    
    // Optimistically update the state to match DOM order immediately
    if (state.selectedSet && state.selectedSet.set_songs) {
      const orderedSetSongs = items.map(item => {
        const setSong = state.selectedSet.set_songs.find(ss => String(ss.id) === String(item.id));
        return setSong ? { ...setSong, sequence_order: item.sequence_order } : null;
      }).filter(Boolean);
      
      // Update state immediately to prevent re-render from reverting DOM
      state.selectedSet.set_songs = orderedSetSongs;
      
      // Update data attributes to match new order
      allItems.forEach((el, index) => {
        if ((el.classList.contains("set-song-card") || el.classList.contains("section-header-wrapper")) && el.classList.contains("draggable-item")) {
          el.dataset.sequenceOrder = index;
        }
      });
    }
    
    console.log("handleContainerDrop - items to update:", items);
    await updateSongOrder(items, false); // Pass false to skip re-render
    
    // Clear processing flag
    container.dataset.processingDrop = "false";
  };
  
  // Store handlers for cleanup
  container._songDragHandlers = {
    containerDragOver: handleContainerDragOver,
    containerDrop: handleContainerDrop
  };
  
  container.addEventListener("dragover", handleContainerDragOver);
  container.addEventListener("drop", handleContainerDrop);
}

function getDragAfterElement(container, y, dragging) {
  // Get all draggable elements, excluding the one being dragged
  const draggableElements = [...container.querySelectorAll(".set-song-card.draggable-item:not(.dragging), .section-header-wrapper.draggable-item:not(.dragging)")];
  
  if (draggableElements.length === 0) {
    return null;
  }
  
  // Get fresh bounding rects for all elements
  const elementsWithRects = draggableElements.map(el => ({
    element: el,
    rect: el.getBoundingClientRect()
  }));
  
  // Check if dropping at the very beginning (above all elements)
  const first = elementsWithRects[0];
  if (y < first.rect.top) {
    // Dropping at the beginning - return first element so it gets inserted before it
    return first.element;
  }
  
  // Check if dropping at the very end (below all elements)
  const last = elementsWithRects[elementsWithRects.length - 1];
  if (y > last.rect.bottom) {
    // Dropping at the end - return null to append
    return null;
  }
  
  // Find the element to insert before by checking each element's position
  // We want to find the first element where the mouse Y is above its center
  for (let i = 0; i < elementsWithRects.length; i++) {
    const { element, rect } = elementsWithRects[i];
    const centerY = rect.top + rect.height / 2;
    
    // If mouse is above the center of this element, insert before it
    if (y < centerY) {
      return element;
    }
  }
  
  // If we get here, mouse is below all element centers, so append at end
  return null;
}

async function updateSongOrder(orderedItems, shouldRerender = true) {
  if (!state.selectedSet) {
    console.warn("No selected set, cannot update song order");
    return;
  }
  
  if (!isManager()) {
    console.warn("Only managers can reorder songs");
    toastError("Only managers can reorder songs.");
    return;
  }
  
  console.log("Updating song order:", orderedItems);
  console.log("Selected set ID:", state.selectedSet.id);
  
  // Verify all set_song IDs belong to the selected set
  const validSetSongIds = new Set((state.selectedSet.set_songs || []).map(ss => String(ss.id)));
  const invalidItems = orderedItems.filter(item => !validSetSongIds.has(String(item.id)));
  
  if (invalidItems.length > 0) {
    console.error("Some items don't belong to the selected set:", invalidItems);
    toastError("Some songs don't belong to this set. Please refresh and try again.");
    // Revert optimistic update on error
    if (!shouldRerender) {
      await loadSets();
      const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
      if (updatedSet) {
        state.selectedSet = updatedSet;
        renderSetDetailSongs(updatedSet);
      }
    }
    return;
  }
  
  // Update sequence orders using a two-phase approach to avoid unique constraint violations
  // Phase 1: Set all to temporary negative values to free up the target positions
  // Phase 2: Set all to their final values
  
  const errors = [];
  const maxOrder = Math.max(...orderedItems.map(item => item.sequence_order), 0);
  const tempOffset = -(maxOrder + 1000); // Use negative values well below any possible sequence_order
  
  console.log("Phase 1: Setting all songs to temporary negative values...");
  // Phase 1: Set all to temporary negative values (unique for each)
  for (let i = 0; i < orderedItems.length; i++) {
    const { id } = orderedItems[i];
    const songId = String(id);
    const tempValue = tempOffset - i; // Each gets a unique temporary value
    
    const { error } = await supabase
      .from("set_songs")
      .update({ sequence_order: tempValue })
      .eq("id", songId)
      .eq("set_id", state.selectedSet.id);
    
    if (error) {
      console.error(`Error setting temporary value for set_song ${songId}:`, error);
      errors.push({ id: songId, error, phase: "temporary" });
    } else {
      console.log(`Set temporary value ${tempValue} for set_song ${songId}`);
    }
  }
  
  if (errors.length > 0) {
    console.error("Failed to set temporary values:", errors);
    const errorMessages = errors.map(e => `Song ${e.id}: ${e.error?.message || JSON.stringify(e.error)}`).join("\n");
    toastError(`Failed to reorder songs:\n${errorMessages}\n\nCheck the console for more details.`);
    // Revert optimistic update on error
    if (!shouldRerender) {
      await loadSets();
      const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
      if (updatedSet) {
        state.selectedSet = updatedSet;
        renderSetDetailSongs(updatedSet);
      }
    }
    return;
  }
  
  console.log("Phase 2: Setting all songs to their final sequence_order values...");
  // Phase 2: Set all to their final values - use Promise.all for parallel updates
  const updatePromises = orderedItems.map(async ({ id, sequence_order }) => {
    const songId = String(id);
    const orderValue = Number(sequence_order);
    
    console.log(`Updating set_song ${songId} to sequence_order ${orderValue}...`);
    
    const { data, error } = await supabase
      .from("set_songs")
      .update({ sequence_order: orderValue })
      .eq("id", songId)
      .eq("set_id", state.selectedSet.id)
      .select();
    
    if (error) {
      console.error(`Error updating set_song ${songId} to sequence_order ${orderValue}:`, error);
      errors.push({ id: songId, sequence_order: orderValue, error, phase: "final" });
      return { success: false, id: songId, error };
    } else if (!data || data.length === 0) {
      console.error(`No set_song found with id ${songId} in set ${state.selectedSet.id}`);
      errors.push({ id: songId, sequence_order: orderValue, error: { message: "Song not found in this set" }, phase: "final" });
      return { success: false, id: songId, error: { message: "Song not found in this set" } };
    } else {
      console.log(`Successfully updated set_song ${songId} to sequence_order ${orderValue}`, data);
      return { success: true, id: songId, data };
    }
  });
  
  await Promise.all(updatePromises);
  
  if (errors.length > 0) {
    console.error("Some updates failed:", errors);
    const errorMessages = errors.map(e => `Song ${e.id} (order ${e.sequence_order}): ${e.error?.message || JSON.stringify(e.error)}`).join("\n");
    console.error("Error details:", errorMessages);
    toastError(`Some songs could not be reordered:\n${errorMessages}\n\nCheck the console for more details.`);
    // Revert optimistic update on error
    if (!shouldRerender) {
      await loadSets();
      const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
      if (updatedSet) {
        state.selectedSet = updatedSet;
        renderSetDetailSongs(updatedSet);
      }
    }
    return;
  }
  
  console.log("All updates successful");
  
  // Only reload and re-render if explicitly requested (for non-drag operations)
  if (shouldRerender) {
    await loadSets();
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      // Ensure set_songs are sorted by sequence_order
      if (updatedSet.set_songs) {
        updatedSet.set_songs.sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
        console.log("Updated set songs order:", updatedSet.set_songs.map(s => ({ id: s.id, title: s.song?.title, order: s.sequence_order })));
      }
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    } else {
      console.error("Could not find updated set after reload");
    }
  } else {
    // Just update the state to match what we already have in DOM
    // The optimistic update was already done, just sync the sequence_order values
    if (state.selectedSet && state.selectedSet.set_songs) {
      state.selectedSet.set_songs.forEach(setSong => {
        const orderedItem = orderedItems.find(item => String(item.id) === String(setSong.id));
        if (orderedItem) {
          setSong.sequence_order = orderedItem.sequence_order;
        }
      });
      // Ensure sorted
      state.selectedSet.set_songs.sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
    }
  }
}

function setupLinkDragAndDrop(item, container) {
  // Only allow dragging from the drag handle
  const dragHandle = item.querySelector(".drag-handle");
  if (dragHandle) {
    dragHandle.addEventListener("mousedown", (e) => {
      item.draggable = true;
    });
    // Prevent text selection on the drag handle
    dragHandle.addEventListener("selectstart", (e) => {
      e.preventDefault();
    });
    dragHandle.style.userSelect = "none";
  }
  
  item.addEventListener("dragstart", (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.linkId);
    item.classList.add("dragging");
    item.style.opacity = "0.5";
  });
  
  item.addEventListener("dragend", (e) => {
    item.classList.remove("dragging");
    item.style.opacity = "";
    item.draggable = false;
    // Remove all drop indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
  });
  
  item.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    const dragging = container.querySelector(".dragging");
    if (!dragging || dragging === item) return;
    
    // Remove existing indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    
    const afterElement = getDragAfterElementForLinks(container, e.clientY, dragging);
    
    if (afterElement == null) {
      // Dropping at the end
      container.appendChild(dragging);
      // Add indicator at the end
      const indicator = document.createElement("div");
      indicator.className = "drop-indicator";
      container.appendChild(indicator);
    } else {
      container.insertBefore(dragging, afterElement);
      // Add indicator before the afterElement
      const indicator = document.createElement("div");
      indicator.className = "drop-indicator";
      container.insertBefore(indicator, afterElement);
    }
  });
  
  item.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Update the order in the DOM (global across all link sections)
    updateAllLinkOrderInDom();
    // Save the order to the database immediately (like song/section reorder)
    await saveAllLinkOrder();
    // Remove indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
  });
  
  // Also handle dragover on container for end-of-list drops
  if (!container.dataset.linkDragSetup) {
    container.dataset.linkDragSetup = "true";
    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = container.querySelector(".dragging");
      if (!dragging) return;
      
      const items = container.querySelectorAll(".song-link-row.draggable-item:not(.dragging)");
      if (items.length === 0) return;
      
      const lastItem = items[items.length - 1];
      if (lastItem && e.clientY > lastItem.getBoundingClientRect().bottom) {
        // Remove existing indicators
        container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
        
        if (dragging.nextSibling !== lastItem.nextSibling) {
          container.appendChild(dragging);
          // Add indicator at the end
          const indicator = document.createElement("div");
          indicator.className = "drop-indicator";
          container.appendChild(indicator);
        }
      }
    });
    
    // Handle drop on container (for drops at the end of the list)
    container.addEventListener("drop", async (e) => {
      e.preventDefault();
      const dragging = container.querySelector(".dragging");
      if (!dragging) return;
      
      // Update the order in the DOM (global across all link sections)
      updateAllLinkOrderInDom();
      // Save the order to the database immediately (like song/section reorder)
      await saveAllLinkOrder();
      // Remove indicators
      container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    });
  }
}

function getDragAfterElementForLinks(container, y, dragging) {
  const draggableElements = [...container.querySelectorAll(".song-link-row.draggable-item:not(.dragging)")];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateLinkOrder(container) {
  const items = Array.from(container.querySelectorAll(".song-link-row.draggable-item"));
  items.forEach((item, index) => {
    item.dataset.displayOrder = index;
  });
}

function updateAllLinkOrderInDom() {
  const linksRoot = el("song-links-list");
  if (!linksRoot) return;
  let globalOrder = 0;
  const sections = Array.from(linksRoot.querySelectorAll(".song-links-section"));
  sections.forEach(section => {
    const sectionContent = section.querySelector(".song-links-section-content");
    if (!sectionContent) return;
    const items = Array.from(sectionContent.querySelectorAll(".song-link-row.draggable-item"));
    items.forEach((item) => {
      item.dataset.displayOrder = String(globalOrder++);
    });
  });
}

function getOrderedExistingSongLinksFromDom() {
  const linksRoot = el("song-links-list");
  if (!linksRoot) return [];
  const orderedLinks = [];
  let globalOrder = 0;
  const sections = Array.from(linksRoot.querySelectorAll(".song-links-section"));
  sections.forEach(section => {
    const sectionContent = section.querySelector(".song-links-section-content");
    if (!sectionContent) return;
    const items = Array.from(sectionContent.querySelectorAll(".song-link-row.draggable-item"));
    items.forEach((item) => {
      const idInput = item.querySelector(".song-link-id");
      const linkId = idInput?.value;
      if (linkId) {
        orderedLinks.push({ id: linkId, display_order: globalOrder });
      }
      globalOrder += 1;
    });
  });
  return orderedLinks;
}

async function reorderSongLinks(orderedLinks, songId) {
  if (!songId || !Array.isArray(orderedLinks) || orderedLinks.length === 0) return;
  
  // Two-phase update, matching the set song/section reorder strategy.
  // This avoids unique constraint collisions on (song_id, display_order).
  const errors = [];
  
  // Phase 1: move everything to unique temporary values
  const tempBase = -1000000;
  const phase1 = orderedLinks.map(async ({ id }, idx) => {
    const tempValue = tempBase - idx;
    const { error } = await supabase
      .from("song_links")
      .update({ display_order: tempValue })
      .eq("id", id)
      .eq("song_id", songId);
    if (error) errors.push({ phase: "temporary", id, error });
  });
  await Promise.all(phase1);
  
  if (errors.length > 0) {
    console.error("Failed to set temporary display_order values for song_links:", errors);
    toastError("Failed to reorder links. Check console for details.");
    return;
  }
  
  // Phase 2: set final display_order values
  const phase2 = orderedLinks.map(async ({ id, display_order }) => {
    const { error } = await supabase
      .from("song_links")
      .update({ display_order })
      .eq("id", id)
      .eq("song_id", songId);
    if (error) errors.push({ phase: "final", id, display_order, error });
  });
  await Promise.all(phase2);
  
  if (errors.length > 0) {
    console.error("Failed to set final display_order values for song_links:", errors);
    toastError("Some links could not be reordered. Check console for details.");
  }
}

async function saveAllLinkOrder() {
  const form = el("song-edit-form");
  const songId = form?.dataset.songId;
  
  // Only save if we're editing an existing song
  if (!songId) return;
  
  const orderedLinks = getOrderedExistingSongLinksFromDom();
  if (orderedLinks.length === 0) return;
  
  await reorderSongLinks(orderedLinks, songId);
}

function openSetModal(set = null) {
  if (!isManager()) return;
  state.selectedSet = set;
  setModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  el("set-modal-title").textContent = set ? "Edit Set" : "New Set";
  el("set-title").value = set?.title ?? "";
  el("set-date").value = set?.scheduled_date ?? "";
  el("set-description").value = set?.description ?? "";
  
  // Show assignment mode section only for managers
  const assignmentModeSection = el("set-assignment-mode-section");
  if (assignmentModeSection) {
    assignmentModeSection.classList.remove("hidden");
  }
  
  // Set assignment mode override checkbox
  const overrideCheckbox = el("set-override-assignment-mode");
  const overrideText = el("set-override-assignment-mode-text");
  
  if (overrideCheckbox && overrideText) {
    const teamMode = state.teamAssignmentMode || 'per_set';
    
    // Set the text based on current team mode
    if (teamMode === 'per_set') {
      overrideText.textContent = 'Use per-song assignments';
    } else {
      overrideText.textContent = 'Use per-set assignments';
    }
    
    // For new sets, checkbox is always unchecked (no override yet)
    if (!set) {
      overrideCheckbox.checked = false;
    } else {
      // For existing sets, check if we're overriding the team mode
      const overrideMode = set.assignment_mode_override;
      const hasExplicitOverride = overrideMode !== null && overrideMode !== undefined;
      
      // Get the effective mode (what the set is actually using)
      const effectiveMode = getSetAssignmentMode(set);
      
      // Checkbox should be checked ONLY if we're actually overriding the team mode
      // 1) Explicit override exists and differs from team mode
      // 2) No explicit override but effective mode differs from team mode (legacy sets)
      const shouldBeChecked =
        (hasExplicitOverride && overrideMode !== teamMode) ||
        (!hasExplicitOverride && effectiveMode !== teamMode);
      overrideCheckbox.checked = shouldBeChecked;
    }
  }
}

function closeSetModal() {
  setModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("set-form").reset();
  
  // Preserve state.selectedSet if we're in detail view mode
  // (i.e., if the detail view is currently visible)
  const detailView = el("set-detail");
  const isDetailViewVisible = detailView && !detailView.classList.contains("hidden");
  
  if (!isDetailViewVisible) {
    // Only clear selectedSet if we're not in detail view
    state.selectedSet = null;
  }
  // If detail view is visible, keep state.selectedSet so the detail view stays open
  
  state.currentSetSongs = [];
}

async function openTimesModal() {
  if (!isManager() || !state.selectedSet) return;
  const set = state.selectedSet;
  const timesModal = el("times-modal");
  timesModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  // Prepare in-memory map of existing time alerts
  state.setTimeAlerts = { service: {}, rehearsal: {} };
  
  // Load existing alerts BEFORE rendering rows so we can pre-select chips
  await safeSupabaseOperation(async () => {
    const { data: timeAlerts, error } = await supabase
      .from("set_time_alerts")
      .select("time_type, time_id, offset_days")
      .eq("set_id", set.id);

    if (error) {
      console.error("Error loading time alerts:", error);
      return;
    }

    (timeAlerts || []).forEach((a) => {
      const bucket = a.time_type === "rehearsal" ? state.setTimeAlerts.rehearsal : state.setTimeAlerts.service;
      if (!bucket[a.time_id]) bucket[a.time_id] = new Set();
      bucket[a.time_id].add(a.offset_days);
    });
  });
  
  // Clear and populate service times
  const serviceTimesList = el("service-times-list");
  serviceTimesList.innerHTML = "";
  if (set?.service_times && set.service_times.length > 0) {
    set.service_times.forEach((st) => {
      const existingOffsets = (state.setTimeAlerts.service[st.id] || new Set());
      addServiceTimeRow(st.service_time, st.id, Array.from(existingOffsets));
    });
  }
  
  // Clear and populate rehearsal times
  const rehearsalTimesList = el("rehearsal-times-list");
  rehearsalTimesList.innerHTML = "";
  if (set?.rehearsal_times && set.rehearsal_times.length > 0) {
    set.rehearsal_times.forEach((rt) => {
      const existingOffsets = (state.setTimeAlerts.rehearsal[rt.id] || new Set());
      addRehearsalTimeRow(rt.rehearsal_date, rt.rehearsal_time, rt.id, Array.from(existingOffsets));
    });
  }
}

function closeTimesModal() {
  const timesModal = el("times-modal");
  timesModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("times-form").reset();
  el("service-times-list").innerHTML = "";
  el("rehearsal-times-list").innerHTML = "";
}

function openSetAssignmentsModal() {
  if (!isManager() || !state.selectedSet) return;
  const set = state.selectedSet;
  const modal = el("set-assignments-modal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  // Clear and populate set assignments
  const assignmentsList = el("set-assignments-list");
  assignmentsList.innerHTML = "";
  if (set?.set_assignments && set.set_assignments.length > 0) {
    set.set_assignments.forEach((assignment) => {
      addSetAssignmentInput(assignment);
    });
  }
}

function closeSetAssignmentsModal() {
  const modal = el("set-assignments-modal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  el("set-assignments-form").reset();
  el("set-assignments-list").innerHTML = "";
}

function addSetAssignmentInput(existingAssignment = null) {
  const container = el("set-assignments-list");
  const div = document.createElement("div");
  div.className = "assignment-row";
  
  // Build person dropdown options
  const personOptions = buildPersonOptions();
  
  div.innerHTML = `
    <label>
      Role
      <input type="text" class="assignment-role-input" placeholder="Lead Vocal" value="${existingAssignment?.role || ''}" required />
    </label>
    <label>
      Person
      <div class="assignment-person-container"></div>
    </label>
    <button type="button" class="btn small ghost remove-assignment">Remove</button>
  `;
  
  // Create searchable dropdown for person
  const personContainer = div.querySelector(".assignment-person-container");
  const selectedValue = existingAssignment?.person_id || existingAssignment?.pending_invite_id || null;
  const personDropdown = createSearchableDropdown(
    personOptions, 
    "Select a person...",
    selectedValue,
    isManager() ? (name) => openInviteModal(name) : null
  );
  personContainer.appendChild(personDropdown);
  
  // Store assignment ID if editing
  if (existingAssignment?.id) {
    div.dataset.assignmentId = existingAssignment.id;
  }
  
  div.querySelector(".remove-assignment").addEventListener("click", () => {
    container.removeChild(div);
  });
  container.appendChild(div);
}

// Helper to build a stable "identity" key for an assignment row from the database
function getAssignmentIdentityKeyFromDbRow(row) {
  if (!row) return null;
  if (row.person_id) return `person:${row.person_id}`;
  if (row.pending_invite_id) return `invite:${row.pending_invite_id}`;
  if (row.person_email) return `email:${String(row.person_email).toLowerCase()}`;
  return null;
}

// Helper to build a stable "identity" key for an assignment object from the UI
function getAssignmentIdentityKeyFromFormAssignment(assignment) {
  if (!assignment) return null;
  if (assignment.person_id) return `person:${assignment.person_id}`;
  if (assignment.pending_invite_id) return `invite:${assignment.pending_invite_id}`;
  if (assignment.person_email) return `email:${String(assignment.person_email).toLowerCase()}`;
  return null;
}

// Fire-and-forget wrapper for sending assignment notification emails via Supabase Edge Function
async function notifyAssignmentEmails(setId, teamId, recipients, mode) {
  if (!setId || !teamId || !recipients || recipients.length === 0) return;

  try {
    // Quick client-side check against team daily email limit so we can
    // show a toast immediately without waiting for the edge function.
    try {
      const { data: teamLimitData, error: teamLimitError } = await supabase
        .from("teams")
        .select("daily_email_limit, daily_email_count, daily_email_count_date")
        .eq("id", teamId)
        .maybeSingle();

      if (!teamLimitError && teamLimitData) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const limit =
          typeof teamLimitData.daily_email_limit === "number"
            ? teamLimitData.daily_email_limit
            : 500;

        let count =
          typeof teamLimitData.daily_email_count === "number"
            ? teamLimitData.daily_email_count
            : 0;
        const countDate = teamLimitData.daily_email_count_date || null;

        if (countDate !== today) {
          count = 0;
        }

        const toSend = recipients.length;
        const newCount = count + toSend;

        if (newCount > limit) {
          console.warn("Skipping assignment emails due to client-side daily limit check", {
            teamId,
            limit,
            currentCount: count,
            attemptedToSend: toSend,
          });
          toastError(
            "Couldn't send assignment emails: this team has hit its daily email limit. Please contact support if you think this is a mistake."
          );
          return;
        }
      }
    } catch (limitErr) {
      console.error("Error checking team email limits on client:", limitErr);
      // If this fails, we still let the edge function enforce limits server-side.
    }

    console.log("📧 Calling notify-assignments edge function:", {
      setId,
      teamId,
      mode,
      recipientCount: recipients.length,
    });

    // Fire-and-forget: don't block UI on email sending.
    supabase.functions
      .invoke("notify-assignments", {
        body: {
          setId,
          teamId,
          mode, // 'per_set' or 'per_song'
          recipients,
        },
      })
      .then(({ data, error }) => {
        if (error) {
          console.error("❌ Edge function returned error:", error);
          const status = error?.context?.response?.status;
          if (status === 429) {
            toastError(
              "Couldn't send assignment emails: this team has hit its daily email limit. Please contact support if you think this is a mistake."
            );
          }
        } else {
          console.log("✅ Edge function response:", data);
          if (data?.error === "daily_email_limit_exceeded") {
            toastError(
              "Couldn't send assignment emails: this team has hit its daily email limit. Please contact support if you think this is a mistake."
            );
          }
        }
      })
      .catch((error) => {
        console.error("❌ Error calling assignment notification edge function:", error);
      });
  } catch (error) {
    console.error("❌ Error calling assignment notification edge function:", error);
    // Do not block the main flow on email failures
  }
}

async function handleSetAssignmentsSubmit(event) {
  event.preventDefault();
  if (!isManager() || !state.selectedSet) return;
  
  const set = state.selectedSet;
  const setId = set.id;
  
  const assignments = collectSetAssignments();
  
  // Get existing assignments
  const { data: existingAssignments, error: fetchError } = await supabase
    .from("set_assignments")
    .select("*")
    .eq("set_id", setId);
  
  if (fetchError) {
    console.error("Error fetching existing assignments:", fetchError);
    toastError("Unable to load existing assignments. Check console.");
    return;
  }

  // Determine assignment mode and which people are *newly* assigned to this set
  const assignmentMode = getSetAssignmentMode(set);
  let newRecipients = [];

  if (assignmentMode === "per_set") {
    const existingKeys = new Set(
      (existingAssignments || [])
        .map((row) => getAssignmentIdentityKeyFromDbRow(row))
        .filter(Boolean)
    );

    const currentAssignments = assignments || [];
    const currentKeys = new Map(); // key -> recipient info for backend

    currentAssignments.forEach((a) => {
      const key = getAssignmentIdentityKeyFromFormAssignment(a);
      if (!key) return;
      if (!currentKeys.has(key)) {
        currentKeys.set(key, {
          key,
          person_id: a.person_id || null,
          pending_invite_id: a.pending_invite_id || null,
          person_email: a.person_email || null,
        });
      }
    });

    // Newly assigned = in current but not in existing
    newRecipients = Array.from(currentKeys.values()).filter(
      (r) => !existingKeys.has(r.key)
    );
  }
  
  // Determine which to delete, update, and insert
  const existingIds = new Set(existingAssignments?.map(a => a.id) || []);
  const newAssignments = assignments.filter(a => !a.id);
  const updatedAssignments = assignments.filter(a => a.id && existingIds.has(a.id));
  const deletedIds = Array.from(existingIds).filter(id => 
    !assignments.some(a => a.id === id)
  );
  
  // Delete removed assignments
  if (deletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("set_assignments")
      .delete()
      .in("id", deletedIds);
    
    if (deleteError) {
      console.error("Error deleting assignments:", deleteError);
      toastError("Unable to delete some assignments. Check console.");
      return;
    }
  }
  
  // Update existing assignments
  for (const assignment of updatedAssignments) {
    // Get existing assignment to preserve status
    const { data: existingAssignment, error: fetchExistingError } = await supabase
      .from("set_assignments")
      .select("status, person_id")
      .eq("id", assignment.id)
      .single();
    
    if (fetchExistingError) {
      console.error("Error fetching existing assignment:", fetchExistingError);
      // Continue to next assignment rather than failing completely
      continue;
    }
    
    // Determine status: preserve if person hasn't changed, otherwise set to pending
    let newStatus = 'pending'; // Default to pending
    
    // Convert person_ids to strings for comparison (they might be UUIDs or strings)
    const existingPersonId = existingAssignment?.person_id?.toString();
    const newPersonId = assignment.person_id?.toString();
    
    if (existingPersonId && newPersonId && existingPersonId === newPersonId) {
      // Person didn't change, preserve existing status
      if (existingAssignment?.status) {
        newStatus = existingAssignment.status;
        console.log(`Preserving status '${newStatus}' for assignment ${assignment.id} (person unchanged)`);
      }
    } else if (existingPersonId && newPersonId && existingPersonId !== newPersonId) {
      // Person changed, set to pending
      newStatus = 'pending';
      console.log(`Resetting status to 'pending' for assignment ${assignment.id} (person changed)`);
    } else if (existingAssignment?.status) {
      // No person_id comparison possible, but we have existing status - preserve it
      newStatus = existingAssignment.status;
      console.log(`Preserving status '${newStatus}' for assignment ${assignment.id} (no person comparison)`);
    }
    
    const { error: updateError } = await supabase
      .from("set_assignments")
      .update({
        role: assignment.role,
        person_id: assignment.person_id || null,
        pending_invite_id: assignment.pending_invite_id || null,
        person_name: assignment.person_name || null,
        person_email: assignment.person_email || null,
        // Preserve existing status when person hasn't changed
        status: newStatus,
      })
      .eq("id", assignment.id);
    
    if (updateError) {
      console.error("Error updating assignment:", updateError);
      toastError("Unable to update some assignments. Check console.");
      return;
    }
  }
  
  // Insert new assignments
  if (newAssignments.length > 0) {
    const { error: insertError } = await supabase
      .from("set_assignments")
      .insert(
        newAssignments.map((assignment) => ({
          role: assignment.role,
          person_id: assignment.person_id || null,
          pending_invite_id: assignment.pending_invite_id || null,
          person_name: assignment.person_name || null,
          person_email: assignment.person_email || null,
          set_id: setId,
          team_id: state.currentTeamId,
          status: 'pending',
        }))
      );
    
    if (insertError) {
      console.error("Error inserting assignments:", insertError);
      toastError("Unable to save assignments. Check console.");
      return;
    }
  }

  // Send notifications for newly assigned people (per-set mode only)
  if (assignmentMode === "per_set" && newRecipients.length > 0) {
    await notifyAssignmentEmails(setId, state.currentTeamId, newRecipients, "per_set");
  }

  toastSuccess("Assignments saved successfully");
  closeSetAssignmentsModal();
  await loadSets();
  
  // Refresh detail view if it's showing
  if (state.selectedSet && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      showSetDetail(updatedSet);
    }
  }
}

function collectSetAssignments() {
  const container = el("set-assignments-list");
  if (!container) return [];
  
  const rows = container.querySelectorAll(".assignment-row");
  const assignments = [];
  
  rows.forEach((row) => {
    const roleInput = row.querySelector(".assignment-role-input");
    const personContainer = row.querySelector(".assignment-person-container");
    const personDropdown = personContainer?.querySelector(".searchable-dropdown");
    
    if (!roleInput || !personDropdown) return;
    
    const role = roleInput.value.trim();
    if (!role) return;
    
    // Get value using the dropdown's getValue method if available
    let personValue = null;
    if (personDropdown.getValue) {
      personValue = personDropdown.getValue();
    } else {
      // Fallback: get selected value from dropdown
      const dropdownInput = personDropdown.querySelector(".searchable-dropdown-input");
      if (!dropdownInput || dropdownInput.classList.contains("placeholder")) return;
      
      // Find the selected option
      const selectedOption = Array.from(personDropdown.querySelectorAll(".searchable-dropdown-option"))
        .find(opt => opt.classList.contains("selected"));
      
      if (!selectedOption) return;
      personValue = selectedOption.dataset.value;
    }
    
    if (!personValue) return;
    
    // Determine if it's a person or pending invite
    const personOptions = buildPersonOptions();
    const option = personOptions.find(opt => opt.value === personValue);
    
    if (!option) return;
    
    const assignment = {
      role,
    };
    
    // Store assignment ID if editing
    if (row.dataset.assignmentId) {
      assignment.id = row.dataset.assignmentId;
    }
    
    if (option.meta?.isPending) {
      assignment.pending_invite_id = personValue;
      assignment.person_name = option.label;
      assignment.person_email = option.meta?.email || null;
    } else {
      assignment.person_id = personValue;
    }
    
    assignments.push(assignment);
  });
  
  return assignments;
}

async function handleTimesSubmit(event) {
  event.preventDefault();
  if (!isManager() || !state.selectedSet) return;
  
  const set = state.selectedSet;
  const setId = set.id;
  
  // Handle service times
  const serviceTimeRows = el("service-times-list").querySelectorAll(".service-time-row");
  const serviceTimes = Array.from(serviceTimeRows)
    .map(row => {
      const input = row.querySelector('input[type="time"]');
      const time = input?.value || null;
      const offsets = getSelectedTimeAlertsForRow(row);
      return time ? { time, offsets } : null;
    })
    .filter(st => st);
  
  // Handle rehearsal times
  const rehearsalTimeRows = el("rehearsal-times-list").querySelectorAll(".rehearsal-time-row");
  const rehearsalTimes = Array.from(rehearsalTimeRows)
    .map(row => {
      const dateInput = row.querySelector('input[type="date"]');
      const timeInput = row.querySelector('input[type="time"]');
      const offsets = getSelectedTimeAlertsForRow(row);
      if (dateInput?.value && timeInput?.value) {
        return {
          date: dateInput.value,
          time: timeInput.value,
          offsets,
        };
      }
      return null;
    })
    .filter(rt => rt);

  // Enforce max 3 alerts per set across all times
  const totalAlerts =
    serviceTimes.reduce((sum, st) => sum + (st.offsets?.length || 0), 0) +
    rehearsalTimes.reduce((sum, rt) => sum + (rt.offsets?.length || 0), 0);

  if (totalAlerts > 3) {
    toastError("You can set up to 3 alerts per set across all service and rehearsal times.");
    return;
  }

  // Delete existing service times for this set
  await supabase
    .from("service_times")
    .delete()
    .eq("set_id", setId);

  // Insert new service times
  let insertedServiceTimes = null;
  if (serviceTimes.length > 0) {
    const { data, error: serviceError } = await supabase
      .from("service_times")
      .insert(serviceTimes.map(st => ({
        set_id: setId,
        service_time: st.time,
        team_id: state.currentTeamId
      })))
      .select("id, service_time");

    insertedServiceTimes = data;

    if (serviceError) {
      console.error("Error saving service times:", serviceError);
      toastError("Error saving service times. Check console.");
      return;
    }
  }

  // Delete existing rehearsal times for this set
  await supabase
    .from("rehearsal_times")
    .delete()
    .eq("set_id", setId);

  // Insert new rehearsal times
  let insertedRehearsalTimes = null;
  if (rehearsalTimes.length > 0) {
    const { data, error: rehearsalError } = await supabase
      .from("rehearsal_times")
      .insert(rehearsalTimes.map(rt => ({
        set_id: setId,
        rehearsal_date: rt.date,
        rehearsal_time: rt.time,
        team_id: state.currentTeamId
      })))
      .select("id, rehearsal_date, rehearsal_time");

    insertedRehearsalTimes = data;

    if (rehearsalError) {
      console.error("Error saving rehearsal times:", rehearsalError);
      toastError("Error saving rehearsal times. Check console.");
      return;
    }
  }
  
  // Delete existing alerts for this set before recreating them
  await supabase.from("set_time_alerts").delete().eq("set_id", setId);

  // Recreate alerts for service times
  const alertInserts = [];
  if (serviceTimes.length > 0 && insertedServiceTimes) {
    insertedServiceTimes.forEach((row, index) => {
      const cfg = serviceTimes[index];
      (cfg.offsets || []).forEach((offset) => {
        alertInserts.push({
          set_id: setId,
          team_id: state.currentTeamId,
          time_type: "service",
          time_id: row.id,
          offset_days: offset,
          created_by: state.profile.id,
        });
      });
    });
  }

  // Recreate alerts for rehearsal times
  if (rehearsalTimes.length > 0 && insertedRehearsalTimes) {
    insertedRehearsalTimes.forEach((row, index) => {
      const cfg = rehearsalTimes[index];
      (cfg.offsets || []).forEach((offset) => {
        alertInserts.push({
          set_id: setId,
          team_id: state.currentTeamId,
          time_type: "rehearsal",
          time_id: row.id,
          offset_days: offset,
          created_by: state.profile.id,
        });
      });
    });
  }

  if (alertInserts.length > 0) {
    const { error: alertError } = await supabase
      .from("set_time_alerts")
      .insert(alertInserts);

    if (alertError) {
      console.error("Error saving time alerts:", alertError);
      toastError("Times saved, but alerts could not be saved. Check console.");
    }
  }

  toastSuccess("Times and alerts saved successfully");
  closeTimesModal();
  
  // Reload sets to get updated times
  await loadSets();
  
  // Refresh detail view if it's showing the edited set
  if (!el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === setId);
    if (updatedSet) {
      showSetDetail(updatedSet);
    }
  }
}

const TIME_ALERT_OPTIONS = [
  { label: "1w", value: -7 },
  { label: "3d", value: -3 },
  { label: "2d", value: -2 },
  { label: "1d", value: -1 },
  { label: "Day Of", value: 0 },
];

function getSelectedTimeAlertsForRow(row) {
  const chips = row.querySelectorAll(".time-alert-chip.selected");
  return Array.from(chips).map((chip) => parseInt(chip.dataset.offsetDays, 10));
}

function applySelectedTimeAlertsToRow(row, offsets = []) {
  const chips = row.querySelectorAll(".time-alert-chip");
  const set = new Set(offsets.map((v) => Number(v)));
  chips.forEach((chip) => {
    const value = parseInt(chip.dataset.offsetDays, 10);
    if (set.has(value)) {
      chip.classList.add("selected");
    } else {
      chip.classList.remove("selected");
    }
  });
}

function addServiceTimeRow(time = "", id = null, alertOffsets = []) {
  const container = el("service-times-list");
  const row = document.createElement("div");
  row.className = "service-time-row";
  row.style.display = "flex";
  row.style.gap = "0.75rem";
  row.style.alignItems = "flex-end";
  row.dataset.tempId = id || `temp-${Date.now()}-${Math.random()}`;

  const timeWrapper = document.createElement("div");
  timeWrapper.style.display = "flex";
  timeWrapper.style.flexDirection = "column";
  timeWrapper.style.flex = "1";

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  // Convert "HH:MM:SS" to "HH:MM" if needed for time input
  const timeValue = time ? time.substring(0, 5) : "";
  timeInput.value = timeValue;
  timeInput.required = false;
  timeInput.style.flex = "1";

  const alertsRow = document.createElement("div");
  alertsRow.className = "time-alerts-row";
  alertsRow.innerHTML = `<span class="muted small-text" style="margin-right: 0.35rem;">Alerts:</span>`;

  TIME_ALERT_OPTIONS.forEach((opt) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "time-alert-chip";
    chip.dataset.offsetDays = String(opt.value);
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      const isSelected = chip.classList.contains("selected");
      if (!isSelected) {
        const currentlySelected = document.querySelectorAll("#times-modal .time-alert-chip.selected").length;
        if (currentlySelected >= 3) {
          toastError("You can only have up to 3 alerts per set.");
          return;
        }
      }
      chip.classList.toggle("selected");
    });
    alertsRow.appendChild(chip);
  });

  timeWrapper.appendChild(timeInput);
  timeWrapper.appendChild(alertsRow);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn ghost small";
  removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  removeBtn.addEventListener("click", () => row.remove());
  
  row.appendChild(timeWrapper);
  row.appendChild(removeBtn);
  container.appendChild(row);

  if (alertOffsets && alertOffsets.length > 0) {
    applySelectedTimeAlertsToRow(row, alertOffsets);
  }
}

function addRehearsalTimeRow(date = "", time = "", id = null, alertOffsets = []) {
  const container = el("rehearsal-times-list");
  const row = document.createElement("div");
  row.className = "rehearsal-time-row";
  row.style.display = "flex";
  row.style.gap = "0.75rem";
  row.style.alignItems = "flex-end";
  row.dataset.tempId = id || `temp-${Date.now()}-${Math.random()}`;

  const timeWrapper = document.createElement("div");
  timeWrapper.style.display = "flex";
  timeWrapper.style.flexDirection = "column";
  timeWrapper.style.flex = "1";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = date;
  dateInput.required = false;
  dateInput.style.flex = "1";

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  // Convert "HH:MM:SS" to "HH:MM" if needed for time input
  const timeValue = time ? time.substring(0, 5) : "";
  timeInput.value = timeValue;
  timeInput.required = false;
  timeInput.style.flex = "1";

  const alertsRow = document.createElement("div");
  alertsRow.className = "time-alerts-row";
  alertsRow.innerHTML = `<span class="muted small-text" style="margin-right: 0.35rem;">Alerts:</span>`;

  TIME_ALERT_OPTIONS.forEach((opt) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "time-alert-chip";
    chip.dataset.offsetDays = String(opt.value);
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      const isSelected = chip.classList.contains("selected");
      if (!isSelected) {
        const currentlySelected = document.querySelectorAll("#times-modal .time-alert-chip.selected").length;
        if (currentlySelected >= 3) {
          toastError("You can only have up to 3 alerts per set.");
          return;
        }
      }
      chip.classList.toggle("selected");
    });
    alertsRow.appendChild(chip);
  });

  timeWrapper.appendChild(dateInput);
  timeWrapper.appendChild(timeInput);
  timeWrapper.appendChild(alertsRow);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn ghost small";
  removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  removeBtn.addEventListener("click", () => row.remove());
  
  row.appendChild(timeWrapper);
  row.appendChild(removeBtn);
  container.appendChild(row);

  if (alertOffsets && alertOffsets.length > 0) {
    applySelectedTimeAlertsToRow(row, alertOffsets);
  }
}

async function handleSetSubmit(event) {
  event.preventDefault();
  if (!isManager()) return;

  // Preserve the selectedSet ID immediately - don't rely on state.selectedSet staying set
  const editingSetId = state.selectedSet?.id || null;
  const isEditing = !!editingSetId;

  const payload = {
    title: el("set-title").value,
    scheduled_date: el("set-date").value,
    description: el("set-description").value,
    team_id: state.currentTeamId,
  };
  
  // Handle assignment mode override (only if columns exist)
  let newAssignmentMode = null;
  let oldAssignmentMode = null;
  try {
    const overrideCheckbox = el("set-override-assignment-mode");
    if (overrideCheckbox) {
      const teamMode = state.teamAssignmentMode || 'per_set';
      if (isEditing) {
        // Get old assignment mode
        oldAssignmentMode = getSetAssignmentMode(state.selectedSet);
        
        // When editing: checkbox controls whether to override
        if (overrideCheckbox.checked) {
          // Checkbox is checked - set override to the opposite of team mode
          newAssignmentMode = teamMode === 'per_set' ? 'per_song' : 'per_set';
          payload.assignment_mode_override = newAssignmentMode;
        } else {
          // Checkbox is unchecked - remove override (will use team default)
          newAssignmentMode = teamMode;
          payload.assignment_mode_override = null;
        }
      } else {
        // When creating: checkbox controls whether to override
        if (overrideCheckbox.checked) {
          // User wants to override to the opposite of team mode
          newAssignmentMode = teamMode === 'per_set' ? 'per_song' : 'per_set';
          payload.assignment_mode_override = newAssignmentMode;
        } else {
          // No override - will use team default (but lock it in so it doesn't change)
          newAssignmentMode = teamMode;
          payload.assignment_mode_override = teamMode;
        }
      }
    }
  } catch (err) {
    // If assignment_mode_override column doesn't exist yet, skip it
    console.warn('Assignment mode override column may not exist yet, skipping');
  }

  // Only include created_by when creating a new set
  if (!isEditing) {
    payload.created_by = state.profile.id;
  }

  let response;
  if (isEditing) {
    response = await supabase
      .from("sets")
      .update(payload)
      .eq("id", editingSetId)
      .eq("team_id", state.currentTeamId)
      .select()
      .single();
  } else {
    response = await supabase.from("sets").insert(payload).select().single();
  }

  if (response.error) {
    toastError("Unable to save set. Check console.");
    console.error(response.error);
    return;
  }

  const finalSetId = response.data.id;
  
  // If assignment mode changed, clear all assignments for this set
  if (isEditing && oldAssignmentMode && newAssignmentMode && oldAssignmentMode !== newAssignmentMode) {
    console.log(`Assignment mode changed from ${oldAssignmentMode} to ${newAssignmentMode}, clearing all assignments`);
    
    // Delete all set_assignments for this set
    const { error: deleteSetAssignmentsError } = await supabase
      .from("set_assignments")
      .delete()
      .eq("set_id", finalSetId);
    
    if (deleteSetAssignmentsError) {
      console.error("Error deleting set assignments:", deleteSetAssignmentsError);
      toastError("Set saved but failed to clear old assignments. Please clear them manually.");
    } else {
      console.log("Cleared all set_assignments for set:", finalSetId);
    }
    
    // Delete all song_assignments for songs in this set
    // First get all set_song IDs for this set
    const { data: setSongs, error: fetchSetSongsError } = await supabase
      .from("set_songs")
      .select("id")
      .eq("set_id", finalSetId);
    
    if (!fetchSetSongsError && setSongs && setSongs.length > 0) {
      const setSongIds = setSongs.map(ss => ss.id);
      const { error: deleteSongAssignmentsError } = await supabase
        .from("song_assignments")
        .delete()
        .in("set_song_id", setSongIds);
      
      if (deleteSongAssignmentsError) {
        console.error("Error deleting song assignments:", deleteSongAssignmentsError);
        toastError("Set saved but failed to clear old assignments. Please clear them manually.");
      } else {
        console.log("Cleared all song_assignments for set:", finalSetId);
      }
    }
    
    // Also delete set_acceptances for this set (for per-song mode)
    const { error: deleteAcceptancesError } = await supabase
      .from("set_acceptances")
      .delete()
      .eq("set_id", finalSetId);
    
    if (deleteAcceptancesError) {
      console.warn("Error deleting set acceptances (non-critical):", deleteAcceptancesError);
    } else {
      console.log("Cleared all set_acceptances for set:", finalSetId);
    }
    
    toastSuccess("Assignment mode changed. All assignments have been cleared.");
  }

  // Preserve selectedSet ID before closing modal (use the one we saved at the start)
  const editedSetId = editingSetId;
  
  closeSetModal();
  await loadSets();
  
  // Refresh detail view if it's showing the edited set
  if (editedSetId && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === editedSetId);
    if (updatedSet) {
      showSetDetail(updatedSet);
    }
  }
}

async function loadSetSongs(setId) {
  const { data, error } = await supabase
    .from("set_songs")
    .select(
      `
      *,
      song:song_id (*),
      song_assignments (*)
    `
    )
    .eq("set_id", setId)
    .order("sequence_order", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  state.currentSetSongs = data ?? [];
  renderSetSongsEditor();
}

async function removeSongFromSet(setSongId, setId) {
  const { error } = await supabase
    .from("set_songs")
    .delete()
    .eq("id", setSongId);
  
  if (error) {
    console.error(error);
    toastError("Unable to remove song from set.");
    return;
  }
  
  // Reload the set to refresh the detail view
  await loadSets();
  if (state.selectedSet && state.selectedSet.id === setId) {
    const updatedSet = state.sets.find(s => s.id === setId);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    }
  }
}

function renderSetSongsEditor() {
  const container = el("set-songs-list");
  if (!container) return;
  container.innerHTML = "";
  if (!state.currentSetSongs.length) {
    container.innerHTML = `<p class="muted">No songs in this set yet.</p>`;
    return;
  }

  state.currentSetSongs.forEach((setSong) => {
    const div = document.createElement("div");
    div.className = "set-song-card";
    div.innerHTML = `
      <div class="set-song-header">
        <div>
          <strong>${setSong.song?.title ?? "Untitled"}</strong>
          <p class="song-meta">${[
            setSong.key || (setSong.song?.song_keys && setSong.song.song_keys.length > 0 
              ? setSong.song.song_keys.map(k => k.key).join(", ")
              : null),
            setSong.song?.time_signature,
          ].filter(Boolean).join(" • ") || ""}</p>
        </div>
        <button class="btn small ghost" data-remove="${setSong.id}">Remove</button>
      </div>
      <p class="song-notes">${setSong.notes ?? ""}</p>
    `;

    div.querySelector("[data-remove]")?.addEventListener("click", async () => {
      await removeSongFromSet(setSong.id, setSong.set_id);
    });

    container.appendChild(div);
  });
}

async function openSongModal() {
  if (!isManager() || !state.selectedSet) return;
  songModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  await populateSongOptions();
  
  // Reset key input
  const keySelect = el("song-key-select");
  if (keySelect) {
    keySelect.value = "";
  }
  
  // Hide assignments section if in per-set mode
  const assignmentSection = songModal.querySelector(".assignment-section");
  const assignmentMode = getSetAssignmentMode(state.selectedSet);
  if (assignmentSection) {
    if (assignmentMode === 'per_set') {
      assignmentSection.style.display = 'none';
    } else {
      assignmentSection.style.display = 'block';
  populateImportAssignmentsDropdown("import-assignments-container", null);
  el("assignments-list").innerHTML = "";
    }
  }
}

function closeSongModal() {
  songModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("song-form").reset();
  el("assignments-list").innerHTML = "";
  el("import-assignments-container").innerHTML = "";
  const keySelect = el("song-key-select");
  if (keySelect) {
    keySelect.value = "";
  }
  const durationInput = el("song-service-duration");
  if (durationInput) {
    durationInput.value = "";
    durationInput.placeholder = "e.g., 3:45";
  }
  importAssignmentsDropdown = null;
}

function handleTagTypeChange() {
  const customLabel = el("tag-custom-label");
  if (!tagTypeDropdown || !customLabel) return;
  const selectedValue = tagTypeDropdown.getValue();
  if (selectedValue === "custom") {
    customLabel.classList.remove("hidden");
  } else {
    customLabel.classList.add("hidden");
    const customInput = el("tag-custom-input");
    if (customInput) customInput.value = "";
  }
}

function resolveTagLabel(selectedValue, customValue = "") {
  if (selectedValue === "custom") {
    return customValue?.trim() || null;
  }
  if (selectedValue === "none") {
    return null;
  }
  const preset = TAG_PRESET_OPTIONS.find(opt => opt.value === selectedValue);
  return preset?.label ?? (selectedValue || null);
}

function findPresetValueByLabel(label) {
  if (!label) return "none";
  const normalized = label.trim().toLowerCase();
  const preset = TAG_PRESET_OPTIONS.find(opt => opt.label.toLowerCase() === normalized);
  return preset?.value ?? "custom";
}

function populateTagSongOptions() {
  const container = el("tag-song-select-container");
  if (!container) return;
  container.innerHTML = "";
  
  const options = state.songs.map(song => ({
    value: song.id,
    label: song.title,
    meta: {
      bpm: song.bpm,
      key: (song.song_keys || []).map(k => k.key).join(", "),
      timeSignature: song.time_signature,
      duration: song.duration_seconds ? formatDuration(song.duration_seconds) : null,
    }
  }));
  
  tagSongDropdown = createSearchableDropdown(options, "Select a song to tag...");
  container.appendChild(tagSongDropdown);
}

function populateTagParentOptions() {
  const container = el("tag-parent-select-container");
  if (!container || !state.selectedSet) return;
  container.innerHTML = "";
  
  // Only include actual songs (not sections or tags) from the current set
  const setSongs = (state.selectedSet.set_songs || [])
    .filter(ss => ss.song_id && !isTag(ss))
    .sort((a, b) => a.sequence_order - b.sequence_order);
  
  if (!setSongs.length) {
    const noSongs = document.createElement("div");
    noSongs.className = "muted small-text";
    noSongs.textContent = "No songs in this set to attach tag to";
    container.appendChild(noSongs);
    return;
  }
  
  const options = setSongs.map((setSong, idx) => ({
    value: String(setSong.id), // Ensure value is a string for consistency
    label: `${idx + 1}. ${setSong.song?.title || "Untitled Song"}`,
  }));
  
  tagParentDropdown = createSimpleDropdown(options, "Select song to attach tag to...");
  container.appendChild(tagParentDropdown);
}

function populateTagTypeOptions() {
  const container = el("tag-type-select-container");
  if (!container) return;
  container.innerHTML = "";
  
  const options = TAG_PRESET_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
  }));
  
  tagTypeDropdown = createSimpleDropdown(options, "Select part...");
  tagTypeDropdown.addEventListener("change", handleTagTypeChange);
  container.appendChild(tagTypeDropdown);
}

async function openTagModal() {
  if (!isManager() || !state.selectedSet) return;
  const modal = el("tag-modal");
  if (!modal) return;
  
  // Ensure we have fresh set and song data
  await loadSets();
  await loadSongs?.(); // safeguard if helper exists
  const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
  if (updatedSet) {
    state.selectedSet = updatedSet;
  }
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  populateTagSongOptions();
  populateTagTypeOptions();
  populateTagParentOptions();
  
  // Set default to "chorus"
  if (tagTypeDropdown) {
    tagTypeDropdown.setValue("chorus");
  }
  
  const customInput = el("tag-custom-input");
  if (customInput) {
    customInput.value = "";
  }
  handleTagTypeChange();
}

function closeTagModal() {
  const modal = el("tag-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  
  // Clear dropdowns
  const songContainer = el("tag-song-select-container");
  const typeContainer = el("tag-type-select-container");
  const parentContainer = el("tag-parent-select-container");
  if (songContainer) songContainer.innerHTML = "";
  if (typeContainer) typeContainer.innerHTML = "";
  if (parentContainer) parentContainer.innerHTML = "";
  
  tagSongDropdown = null;
  tagTypeDropdown = null;
  tagParentDropdown = null;
  
  const form = el("tag-form");
  form?.reset();
  const customLabel = el("tag-custom-label");
  if (customLabel) customLabel.classList.add("hidden");
  const customInput = el("tag-custom-input");
  if (customInput) customInput.value = "";
}

function isTag(setSong) {
  if (!setSong || !setSong.description) return false;
  try {
    const desc = JSON.parse(setSong.description);
    return desc && typeof desc === 'object' && desc.parentSetSongId !== undefined;
  } catch {
    return false;
  }
}

function parseTagDescription(setSong) {
  if (!isTag(setSong)) return null;
  try {
    return JSON.parse(setSong.description);
  } catch {
    return null;
  }
}

function resolveTagPartName(tagType, customValue = "") {
  if (tagType === "custom") {
    return customValue?.trim() || null;
  }
  const preset = TAG_PRESET_OPTIONS.find(opt => opt.value === tagType);
  return preset?.label ?? null;
}

async function handleAddTagToSong(event) {
  event.preventDefault();
  if (!isManager() || !state.selectedSet) return;
  
  const songId = tagSongDropdown?.getValue();           // uuid string
  const tagType = tagTypeDropdown?.getValue();
  const parentSetSongId = tagParentDropdown?.getValue(); // uuid string
  const customInput = el("tag-custom-input");
  const customValue = customInput?.value || "";
  
  if (!songId) {
    toastError("Please select a song to tag.");
    return;
  }
  
  if (!tagType) {
    toastError("Please select a part of the song.");
    return;
  }
  
  if (!parentSetSongId) {
    toastError("Please select a song to attach the tag to.");
    return;
  }
  
  const partName = resolveTagPartName(tagType, customValue);
  if (tagType === "custom" && !partName) {
    toastError("Enter a custom part name.");
    return;
  }
  
  // Ensure we have fresh set data
  if (!state.selectedSet.set_songs || state.selectedSet.set_songs.length === 0) {
    await loadSets();
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
    }
  }
  
  // Find parent song to get its sequence_order (match by UUID string)
  const parentSong = (state.selectedSet.set_songs || []).find(ss => {
    if (!ss) return false;
    return String(ss.id) === String(parentSetSongId);
  });
  
  if (!parentSong) {
    console.error("Parent song not found.", {
      parentSetSongId,
      availableSongs: (state.selectedSet.set_songs || []).map(ss => ({ 
        id: ss.id, 
        idType: typeof ss.id,
        title: ss.song?.title || ss.title,
        song_id: ss.song_id 
      }))
    });
    toastError("Parent song not found. Please refresh and try again.");
    return;
  }
  
  // Get the song being tagged
  let taggedSong = state.songs.find(s => String(s.id) === String(songId));
  if (!taggedSong) {
    // Refresh songs in case state is stale
    await loadSongs?.();
    taggedSong = state.songs.find(s => String(s.id) === String(songId));
  }
  if (!taggedSong) {
    console.error("Tagged song not found.", {
      songId,
      availableSongs: state.songs.map(s => ({ id: s.id, title: s.title }))
    });
    toastError("Tagged song not found. Please refresh and try again.");
    return;
  }
  
  // Calculate sequence_order (right after parent and any existing tags attached to parent)
  const parentOrder = parentSong.sequence_order || 0;
  
  // Find all items that come after the parent (including tags attached to the parent)
  // Tags attached to the parent should stay grouped with the parent
  const itemsAfterParent = state.selectedSet.set_songs.filter(ss => {
    const ssOrder = ss.sequence_order || 0;
    if (ssOrder <= parentOrder) return false;
    
    // If it's a tag, check if it's attached to this parent
    if (isTag(ss)) {
      const tagInfo = parseTagDescription(ss);
      return tagInfo && String(tagInfo.parentSetSongId) === String(parentSetSongId);
    }
    
    // For non-tags, include if they come after the parent
    return true;
  });
  
  // Find the maximum sequence_order among items that should stay grouped with parent
  // (parent itself + tags attached to parent)
  const parentGroupItems = state.selectedSet.set_songs.filter(ss => {
    if (String(ss.id) === String(parentSetSongId)) return true;
    if (isTag(ss)) {
      const tagInfo = parseTagDescription(ss);
      return tagInfo && String(tagInfo.parentSetSongId) === String(parentSetSongId);
    }
    return false;
  });
  
  const maxParentGroupOrder = parentGroupItems.length > 0
    ? Math.max(...parentGroupItems.map(ss => ss.sequence_order || 0))
    : parentOrder;
  
  // New tag should go right after the last item in the parent group
  const newSequenceOrder = maxParentGroupOrder + 1;
  
  // Shift all items that come after the parent group down by 1
  const itemsToShift = state.selectedSet.set_songs.filter(ss => 
    (ss.sequence_order || 0) >= newSequenceOrder
  );
  
  // Update sequence orders for items that need to shift (in reverse order to avoid conflicts)
  const sortedItemsToShift = [...itemsToShift].sort((a, b) => 
    (b.sequence_order || 0) - (a.sequence_order || 0)
  );
  
  for (const item of sortedItemsToShift) {
    const { error: shiftError } = await supabase
      .from("set_songs")
      .update({ sequence_order: (item.sequence_order || 0) + 1 })
      .eq("id", item.id);
    
    if (shiftError) {
      console.error("Error shifting item:", shiftError);
      toastError("Unable to reorder items. Please try again.");
      return;
    }
  }
  
  // Refresh set data to ensure we have the latest sequence_order values
  await loadSets();
  const refreshedSet = state.sets.find(s => s.id === state.selectedSet.id);
  if (refreshedSet) {
    state.selectedSet = refreshedSet;
    
    // Recalculate newSequenceOrder in case it changed after shifts
    const refreshedParentGroupItems = refreshedSet.set_songs.filter(ss => {
      if (String(ss.id) === String(parentSetSongId)) return true;
      if (isTag(ss)) {
        const tagInfo = parseTagDescription(ss);
        return tagInfo && String(tagInfo.parentSetSongId) === String(parentSetSongId);
      }
      return false;
    });
    
    const refreshedMaxOrder = refreshedParentGroupItems.length > 0
      ? Math.max(...refreshedParentGroupItems.map(ss => ss.sequence_order || 0))
      : (refreshedSet.set_songs.find(ss => String(ss.id) === String(parentSetSongId))?.sequence_order || 0);
    
    const finalSequenceOrder = refreshedMaxOrder + 1;
    
    // Create tag entry
    const tagDescription = JSON.stringify({
      parentSetSongId: String(parentSetSongId),
      tagType: tagType,
    });
    
    const { data: newTag, error } = await supabase
      .from("set_songs")
      .insert({
        set_id: state.selectedSet.id,
        song_id: String(songId),
        title: partName,
        description: tagDescription,
        sequence_order: finalSequenceOrder,
        team_id: state.currentTeamId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating tag:", error);
      if (error.code === "23505") {
        toastError("A tag already exists at this position. Please refresh and try again.");
      } else {
        toastError("Unable to add tag.");
      }
      return;
    }
  } else {
    toastError("Unable to refresh set data. Please try again.");
    return;
  }

  toastSuccess("Tag added successfully.");
  closeTagModal();
  await loadSets();

  if (state.selectedSet && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    }
  }
}

async function openSectionModal() {
  if (!isManager() || !state.selectedSet) return;
  sectionModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  // Hide assignments section if in per-set mode
  const assignmentSection = sectionModal.querySelector(".assignment-section");
  const assignmentMode = getSetAssignmentMode(state.selectedSet);
  if (assignmentSection) {
    if (assignmentMode === 'per_set') {
      assignmentSection.style.display = 'none';
    } else {
      assignmentSection.style.display = 'block';
  el("section-assignments-list").innerHTML = "";
    }
  }
}

function closeSectionModal() {
  sectionModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("section-form").reset();
  el("section-assignments-list").innerHTML = "";
  el("import-section-assignments-container").innerHTML = "";
  const sectionLinksList = el("section-links-list");
  if (sectionLinksList) {
    sectionLinksList.innerHTML = "";
  }
  const sectionDurationInput = el("section-duration");
  if (sectionDurationInput) {
    sectionDurationInput.value = "";
    sectionDurationInput.placeholder = "e.g., 30:00";
  }
}

async function openSectionHeaderModal() {
  if (!isManager() || !state.selectedSet) return;
  if (sectionHeaderModal) {
    sectionHeaderModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeSectionHeaderModal() {
  if (sectionHeaderModal) {
    sectionHeaderModal.classList.add("hidden");
    document.body.style.overflow = "";
    el("section-header-form")?.reset();
  }
}

function closeHeaderDropdown() {
  const dropdownMenu = el("header-add-dropdown-menu");
  const mobileDropdownMenu = el("mobile-header-add-dropdown-menu");
  if (dropdownMenu) {
    dropdownMenu.classList.add("hidden");
  }
  if (mobileDropdownMenu) {
    mobileDropdownMenu.classList.add("hidden");
  }
}

let songDropdown = null;
let teamAssignmentModeDropdown = null;
let tagSongDropdown = null;
let tagTypeDropdown = null;
let tagParentDropdown = null;

async function populateSongOptions() {
  const container = el("song-select-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Get weeks offset to nearest scheduled performance (past or future) for each song
  const weeksSinceMap = await getWeeksSinceLastPerformance();
  
  const options = state.songs.map(song => ({
    value: song.id,
    label: song.title,
    meta: {
      bpm: song.bpm,
      key: (song.song_keys || []).map(k => k.key).join(", "),
      timeSignature: song.time_signature,
      duration: song.duration_seconds ? formatDuration(song.duration_seconds) : null,
      durationSeconds: song.duration_seconds || null,
      weeksSinceLastPerformed: weeksSinceMap.get(song.id) || null,
    }
  }));
  
  songDropdown = createSearchableDropdown(options, "Select a song...");
  container.appendChild(songDropdown);
  
  if (songDropdown) {
    songDropdown.addEventListener("change", (e) => {
      const durationInput = el("song-service-duration");
      if (!durationInput) return;
      const baseSeconds = e.detail?.option?.meta?.durationSeconds;
      if (baseSeconds) {
        durationInput.placeholder = `${formatDuration(baseSeconds)}`;
      } else {
        durationInput.placeholder = "e.g., 3:45";
      }
    });
  }
}

async function getWeeksSinceLastPerformance() {
  const weeksMap = new Map();
  
  if (!state.songs || state.songs.length === 0) {
    return weeksMap;
  }
  
  const songIds = state.songs.map(s => s.id);
  
  // Query to find all set dates for each song
  const { data, error } = await supabase
    .from("set_songs")
    .select(`
      song_id,
      set:set_id (
        scheduled_date
      )
    `)
    .in("song_id", songIds);
  
  if (error) {
    console.error("Error fetching song performance history:", error);
    return weeksMap;
  }
  
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of day
  
  // Track nearest future date and most recent past date for each song
  const songScheduleMap = new Map();
  
  if (data) {
    data.forEach(item => {
      const songId = item.song_id;
      // Handle both object and array responses from Supabase
      const setEntries = Array.isArray(item.set) ? item.set : [item.set].filter(Boolean);
      
      setEntries.forEach(setData => {
        const scheduledDate = setData?.scheduled_date;
        if (!scheduledDate) return;
        
        const dateValue = new Date(scheduledDate);
        dateValue.setHours(0, 0, 0, 0);
        
        const entry = songScheduleMap.get(songId) || { next: null, last: null };
        
        if (dateValue >= now) {
          if (!entry.next || dateValue < entry.next) {
            entry.next = dateValue;
          }
        } else {
          if (!entry.last || dateValue > entry.last) {
            entry.last = dateValue;
          }
        }
        
        songScheduleMap.set(songId, entry);
      });
    });
  }
  
  const weekMs = 1000 * 60 * 60 * 24 * 7;
  
  // Prefer future schedule if present; otherwise show most recent past
  songScheduleMap.forEach((entry, songId) => {
    if (entry.next) {
      const diffWeeks = Math.round((entry.next.getTime() - now.getTime()) / weekMs);
      const label = diffWeeks > 0 ? `+${diffWeeks}` : "0";
      weeksMap.set(songId, label);
    } else if (entry.last) {
      const diffWeeks = Math.round((now.getTime() - entry.last.getTime()) / weekMs);
      const label = diffWeeks > 0 ? `-${diffWeeks}` : "0";
      weeksMap.set(songId, label);
    }
  });
  
  return weeksMap;
}

async function handleAddSongToSet(event) {
  event.preventDefault();
  const songId = songDropdown?.getValue();
  if (!songId) {
    toastError("Please select a song.");
    return;
  }
  const notes = el("song-notes").value;
  const selectedKey = el("song-key-select")?.value.trim() || null;
  const plannedDurationRaw = el("song-service-duration")?.value.trim() || "";
  let plannedDurationSeconds = null;
  if (plannedDurationRaw) {
    const parsedDuration = parseDuration(plannedDurationRaw);
    if (parsedDuration === null) {
      toastError("Please enter a valid length (use MM:SS or minutes).");
      return;
    }
    plannedDurationSeconds = parsedDuration;
  }
  const assignments = collectAssignments();

  // Calculate sequence_order from the current set's songs
  const currentSequenceOrder = state.selectedSet.set_songs?.length || 0;

  const { data: setSong, error } = await supabase
    .from("set_songs")
    .insert({
      set_id: state.selectedSet.id,
      song_id: songId,
      key: selectedKey,
      notes,
      planned_duration_seconds: plannedDurationSeconds,
      sequence_order: currentSequenceOrder,
      team_id: state.currentTeamId,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    toastError("Unable to add song.");
    return;
  }

  if (assignments.length) {
    // Check if assigned users have already accepted this set (for per-song mode)
    const set = state.selectedSet;
    const assignmentMode = getSetAssignmentMode(set);
    
    // For per-song sets, check if each assigned person has already accepted this set
    const assignmentsToInsert = await Promise.all(assignments.map(async (assignment) => {
      let shouldAutoAccept = false;
      
      if (assignmentMode === 'per_song' && assignment.person_id) {
        const { data: setAcceptance } = await supabase
          .from("set_acceptances")
          .select("id")
          .eq("set_id", set.id)
          .eq("person_id", assignment.person_id)
          .maybeSingle();
        shouldAutoAccept = !!setAcceptance;
      }
      
      return {
        role: assignment.role,
        person_id: assignment.person_id || null,
        pending_invite_id: assignment.pending_invite_id || null,
        person_name: assignment.person_name || null,
        person_email: assignment.person_email || null,
        set_song_id: setSong.id,
        team_id: state.currentTeamId,
        status: shouldAutoAccept ? 'accepted' : 'pending',
      };
    }));

    // In per-song mode, compute people who are newly assigned to this set (across all songs)
    let newSongRecipients = [];
    if (assignmentMode === 'per_song' && assignmentsToInsert.length > 0) {
      const { data: existingSetSongAssignments, error: existingSetSongErr } = await supabase
        .from("song_assignments")
        .select(`
          person_id,
          pending_invite_id,
          person_email,
          set_song:set_song_id ( set_id )
        `)
        .eq("set_song.set_id", set.id);

      if (existingSetSongErr) {
        console.error("Error fetching existing song assignments for notifications:", existingSetSongErr);
      } else {
        const existingKeys = new Set(
          (existingSetSongAssignments || [])
            .map((row) => getAssignmentIdentityKeyFromDbRow(row))
            .filter(Boolean)
        );

        const currentKeys = new Map();
        assignmentsToInsert.forEach((a) => {
          const key = getAssignmentIdentityKeyFromFormAssignment(a);
          if (!key) return;
          if (!currentKeys.has(key)) {
            currentKeys.set(key, {
              key,
              person_id: a.person_id || null,
              pending_invite_id: a.pending_invite_id || null,
              person_email: a.person_email || null,
            });
          }
        });

        newSongRecipients = Array.from(currentKeys.values()).filter(
          (r) => !existingKeys.has(r.key)
        );
      }
    }
    
    const { error: assignmentError } = await supabase
      .from("song_assignments")
      .insert(assignmentsToInsert);
      
    if (assignmentError) {
      console.error(assignmentError);
      toastError("Assignments partially failed.");
    } else if (assignmentMode === 'per_song' && newSongRecipients.length > 0) {
      await notifyAssignmentEmails(set.id, state.currentTeamId, newSongRecipients, "per_song");
    }
  }

  closeSongModal();
  await loadSets();
  
  // Refresh detail view if it's showing
  if (state.selectedSet && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    }
  }
}

async function handleAddSectionToSet(event) {
  event.preventDefault();
  const title = el("section-title").value.trim();
  if (!title) {
    toastError("Please enter a section title.");
    return;
  }
  const description = el("section-description").value.trim();
  const notes = el("section-notes").value.trim();
  const durationRaw = el("section-duration")?.value.trim() || "";
  let plannedDurationSeconds = null;
  if (durationRaw) {
    const parsedDuration = parseDuration(durationRaw);
    if (parsedDuration === null) {
      toastError("Please enter a valid length (use MM:SS or minutes).");
      return;
    }
    plannedDurationSeconds = parsedDuration;
  }
  const assignments = collectAssignments("section-assignments-list");

  // Refresh set data to get latest sequence_order values
  const { data: currentSet } = await supabase
    .from("sets")
    .select(`
      *,
      set_songs (
        id,
        sequence_order
      )
    `)
    .eq("id", state.selectedSet.id)
    .single();

  // Calculate sequence_order from the refreshed set's songs/sections
  // Use max sequence_order + 1 to avoid conflicts, or 0 if no items exist
  const existingOrders = (currentSet?.set_songs || []).map(ss => ss.sequence_order || 0);
  const currentSequenceOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0;

  const { data: setSong, error } = await supabase
    .from("set_songs")
    .insert({
      set_id: state.selectedSet.id,
      song_id: null, // Sections don't have a song_id
      title: title,
      description: description || null,
      notes: notes || null,
      planned_duration_seconds: plannedDurationSeconds,
      sequence_order: currentSequenceOrder,
      team_id: state.currentTeamId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding section:", error);
    // 409 is HTTP conflict, could be from unique constraint or other conflicts
    if (error.code === '23505' || error.status === 409 || error.statusCode === 409) {
      toastError("Unable to add section due to a conflict. Please refresh and try again.");
    } else {
      toastError("Unable to add section. Please try again.");
    }
    return;
  }

  if (assignments.length) {
    // Check if assigned users have already accepted this set (for per-song mode)
    const set = state.selectedSet;
    const assignmentMode = getSetAssignmentMode(set);
    
    // For per-song sets, check if each assigned person has already accepted this set
    const assignmentsToInsert = await Promise.all(assignments.map(async (assignment) => {
      let shouldAutoAccept = false;
      
      if (assignmentMode === 'per_song' && assignment.person_id) {
        const { data: setAcceptance } = await supabase
          .from("set_acceptances")
          .select("id")
          .eq("set_id", set.id)
          .eq("person_id", assignment.person_id)
          .maybeSingle();
        shouldAutoAccept = !!setAcceptance;
      }
      
      return {
        role: assignment.role,
        person_id: assignment.person_id || null,
        pending_invite_id: assignment.pending_invite_id || null,
        person_name: assignment.person_name || null,
        person_email: assignment.person_email || null,
        set_song_id: setSong.id,
        team_id: state.currentTeamId,
        status: shouldAutoAccept ? 'accepted' : 'pending',
      };
    }));
    
    const { error: assignmentError } = await supabase
      .from("song_assignments")
      .insert(assignmentsToInsert);
      
    if (assignmentError) {
      console.error(assignmentError);
      toastError("Assignments partially failed.");
    } else if (assignmentMode === 'per_song' && newSongRecipients.length > 0) {
      await notifyAssignmentEmails(set.id, state.currentTeamId, newSongRecipients, "per_song");
    }
  }

  // Handle section links
  const links = collectSectionLinks("section-links-list");
  if (links.length > 0) {
    const { error: linksError } = await supabase
      .from("song_links")
      .insert(
        links.map(link => ({
          set_song_id: setSong.id,
          song_id: null,
          title: link.title,
          url: link.url,
          key: link.key || null,
          display_order: link.display_order,
          team_id: state.currentTeamId,
        }))
      );
    
    if (linksError) {
      console.error("Error saving section links:", linksError);
      toastError("Some links could not be saved. Please try again.");
    }
  }

  closeSectionModal();
  await loadSets();
  
  // Refresh detail view if it's showing
  if (state.selectedSet && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    }
  }
}

async function handleAddSectionHeaderToSet(event) {
  event.preventDefault();
  const title = el("section-header-title").value.trim();
  if (!title) {
    toastError("Please enter a header title.");
    return;
  }

  // Refresh set data to get latest sequence_order values
  const { data: currentSet } = await supabase
    .from("sets")
    .select(`
      *,
      set_songs (
        id,
        sequence_order
      )
    `)
    .eq("id", state.selectedSet.id)
    .single();

  // Calculate sequence_order from the refreshed set's songs/sections
  // Use max sequence_order + 1 to avoid conflicts, or 0 if no items exist
  const existingOrders = (currentSet?.set_songs || []).map(ss => ss.sequence_order || 0);
  const currentSequenceOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0;

  const { data: setSong, error } = await supabase
    .from("set_songs")
    .insert({
      set_id: state.selectedSet.id,
      song_id: null, // Section headers don't have a song_id
      title: title,
      description: null, // Section headers have no description
      notes: null, // Section headers have no notes
      sequence_order: currentSequenceOrder,
      team_id: state.currentTeamId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding section header:", error);
    // 409 is HTTP conflict, could be from unique constraint or other conflicts
    if (error.code === '23505' || error.status === 409 || error.statusCode === 409) {
      toastError("Unable to add section header due to a conflict. Please refresh and try again.");
    } else {
      toastError("Unable to add section header. Please try again.");
    }
    return;
  }

  closeSectionHeaderModal();
  await loadSets();
  
  // Refresh detail view if it's showing
  if (state.selectedSet && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    }
  }
}

function buildPersonOptions() {
  const peopleOptions =
    (state.people || []).map((person) => {
      const email = (person.email || "").toLowerCase();
      return {
        value: person.id,
        label: person.full_name || email || "Unnamed Member",
        meta: {
          type: "profile",
          email,
          profileId: person.id,
          isPending: false,
        },
      };
    }) ?? [];

  const pendingOptions =
    (state.pendingInvites || []).map((invite) => {
      const email = (invite.email || "").toLowerCase();
      return {
        value: invite.id,
        label: invite.full_name || email || "Pending Member",
        meta: {
          type: "pending",
          email,
          pendingInviteId: invite.id,
          isPending: true,
        },
      };
    }) ?? [];

  return [...peopleOptions, ...pendingOptions];
}

function addAssignmentInput() {
  const container = el("assignments-list");
  const div = document.createElement("div");
  div.className = "assignment-row";
  
  // Build person dropdown options
  const personOptions = buildPersonOptions();
  
  div.innerHTML = `
    <label>
      Role
      <input type="text" class="assignment-role-input" placeholder="Lead Vocal" required />
    </label>
    <label>
      Person
      <div class="assignment-person-container"></div>
    </label>
    <button type="button" class="btn small ghost remove-assignment">Remove</button>
  `;
  
  // Create searchable dropdown for person
  const personContainer = div.querySelector(".assignment-person-container");
  const personDropdown = createSearchableDropdown(
    personOptions, 
    "Select a person...",
    null,
    isManager() ? (name) => openInviteModal(name) : null
  );
  personContainer.appendChild(personDropdown);
  
  div.querySelector(".remove-assignment").addEventListener("click", () => {
    container.removeChild(div);
  });
  container.appendChild(div);
}

function collectAssignments(containerId = "assignments-list") {
  const container = el(containerId);
  if (!container) return [];
  
  const roles = Array.from(container.querySelectorAll(".assignment-role-input"));
  const personContainers = Array.from(
    container.querySelectorAll(".assignment-person-container")
  );
  const assignments = [];

  roles.forEach((roleInput, index) => {
    const role = roleInput.value.trim();
    const personContainer = personContainers[index];
    const personDropdown = personContainer?.querySelector(".searchable-dropdown");
    const selectedOption = personDropdown?.getSelectedOption?.();
    if (role && selectedOption) {
      const baseAssignment = {
        role,
        person_name: selectedOption.label,
        person_email: selectedOption.meta?.email || null,
      };
      if (selectedOption.meta?.type === "pending") {
        assignments.push({
          ...baseAssignment,
          pending_invite_id: selectedOption.value,
        });
      } else {
        assignments.push({
          ...baseAssignment,
          person_id: selectedOption.value,
        });
      }
    }
  });
  return assignments;
}

// Edit Set Song Functions
async function openEditSetSongModal(setSong) {
  if (!isManager() || !setSong) return;
  
  const modal = el("edit-set-song-modal");
  const form = el("edit-set-song-form");
  const notesInput = el("edit-set-song-notes");
  const assignmentsList = el("edit-assignments-list");
  const isSection = !setSong.song_id;
  const durationLabel = el("edit-set-song-duration-label");
  const durationInput = el("edit-set-song-duration");
  const durationHint = el("edit-set-song-duration-hint");
  
  // Check if this is a section header (section with no description, notes, or assignments)
  const isSectionHeader = isSection && 
    !setSong.description && 
    !setSong.notes && 
    (!setSong.song_assignments || setSong.song_assignments.length === 0);
  
  // Store the set song ID and song ID for saving/editing
  form.dataset.setSongId = setSong.id;
  form.dataset.songId = setSong.song_id || setSong.song?.id || null;
  form.dataset.isSection = isSection ? "true" : "false";
  form.dataset.isSectionHeader = isSectionHeader ? "true" : "false";
  
  // Update modal title
  const titleEl = el("edit-set-item-title");
  if (titleEl) {
    if (isSectionHeader) {
      titleEl.textContent = "Edit Section Header";
    } else {
    titleEl.textContent = isSection ? "Edit Section in Set" : "Edit Song in Set";
    }
  }
  
  // Show/hide section fields and song edit button
  const sectionFields = el("edit-section-fields");
  const editSongBtn = el("btn-edit-song-from-set");
  const assignmentSection = el("edit-set-song-modal")?.querySelector(".assignment-section");
  const keyLabel = el("edit-set-song-key-label");
  const keyInput = el("edit-set-song-key");
  
  // Show/hide key field based on whether it's a song or section
  if (keyLabel && keyInput) {
    if (isSection) {
      keyLabel.classList.add("hidden");
      keyInput.value = "";
    } else {
      keyLabel.classList.remove("hidden");
      keyInput.value = setSong.key || "";
    }
  }
  
  if (durationLabel && durationInput) {
    if (isSectionHeader) {
      durationLabel.classList.add("hidden");
      durationInput.value = "";
      if (durationHint) durationHint.classList.add("hidden");
    } else {
      durationLabel.classList.remove("hidden");
      const hasPlannedDuration = setSong.planned_duration_seconds !== undefined && setSong.planned_duration_seconds !== null;
      durationInput.value = hasPlannedDuration ? formatDuration(setSong.planned_duration_seconds) : "";
      if (!isSection && setSong.song?.duration_seconds) {
        durationInput.placeholder = `${formatDuration(setSong.song.duration_seconds)}`;
        if (durationHint) durationHint.classList.remove("hidden");
      } else {
        durationInput.placeholder = "e.g., 30:00";
        if (durationHint) durationHint.classList.add("hidden");
      }
    }
  }
  
  // Hide assignments section if in per-set mode
  const assignmentMode = getSetAssignmentMode(state.selectedSet);
  if (assignmentSection) {
    if (assignmentMode === 'per_set') {
      assignmentSection.style.display = 'none';
    } else {
      assignmentSection.style.display = 'block';
    }
  }
  
  if (sectionFields) {
    if (isSection) {
      sectionFields.classList.remove("hidden");
      el("edit-section-title").value = setSong.title || "";
      const descriptionField = sectionFields.querySelector('label:has(textarea), label:has(#edit-section-description)');
      const descriptionInput = el("edit-section-description");
      if (isSectionHeader) {
        // Hide description field for section headers
        if (descriptionInput) {
          descriptionInput.closest("label")?.classList.add("hidden");
        }
      } else {
        // Show description field for regular sections
        if (descriptionInput) {
          descriptionInput.closest("label")?.classList.remove("hidden");
          descriptionInput.value = setSong.description || "";
        }
      }
    } else {
      sectionFields.classList.add("hidden");
    }
  }
  if (editSongBtn) {
    editSongBtn.classList.toggle("hidden", isSection);
  }
  
  // Hide notes and assignments for section headers
  if (isSectionHeader) {
    if (notesInput) {
      notesInput.closest("label")?.classList.add("hidden");
    }
    if (assignmentSection) {
      assignmentSection.classList.add("hidden");
    }
  } else {
    if (notesInput) {
      notesInput.closest("label")?.classList.remove("hidden");
  notesInput.value = setSong.notes || "";
    }
    if (assignmentSection) {
      assignmentSection.classList.remove("hidden");
    }
  // Clear and populate assignments
  assignmentsList.innerHTML = "";
  if (setSong.song_assignments && setSong.song_assignments.length > 0) {
    setSong.song_assignments.forEach((assignment) => {
      addEditAssignmentInput(assignment);
    });
    }
  }
  
  // Populate import dropdown, excluding current song/section
  populateImportAssignmentsDropdown("import-edit-assignments-container", setSong.id);
  
  // Load section links if this is a section
  const editSectionLinksContainer = el("edit-section-links-container");
  const editSectionLinksList = el("edit-section-links-list");
  if (isSection && editSectionLinksContainer && editSectionLinksList) {
    editSectionLinksContainer.classList.remove("hidden");
    // Fetch section links
    const { data: sectionLinksData } = await supabase
      .from("song_links")
      .select("*")
      .eq("set_song_id", setSong.id)
      .order("display_order", { ascending: true });
    
    renderSectionLinks(sectionLinksData || [], "edit-section-links-list");
  } else if (editSectionLinksContainer) {
    editSectionLinksContainer.classList.add("hidden");
  }
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditSetSongModal() {
  const modal = el("edit-set-song-modal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  el("edit-set-song-form").reset();
  el("edit-assignments-list").innerHTML = "";
  el("import-edit-assignments-container").innerHTML = "";
  const editSectionLinksList = el("edit-section-links-list");
  if (editSectionLinksList) {
    editSectionLinksList.innerHTML = "";
  }
  const editSectionLinksContainer = el("edit-section-links-container");
  if (editSectionLinksContainer) {
    editSectionLinksContainer.classList.add("hidden");
  }
  const keyInput = el("edit-set-song-key");
  if (keyInput) {
    keyInput.value = "";
  }
  const durationInput = el("edit-set-song-duration");
  if (durationInput) {
    durationInput.value = "";
    durationInput.placeholder = "e.g., 4:00";
  }
  importEditAssignmentsDropdown = null;
  delete el("edit-set-song-form").dataset.setSongId;
}

function addEditAssignmentInput(existingAssignment = null) {
  const container = el("edit-assignments-list");
  const div = document.createElement("div");
  div.className = "assignment-row";
  
  // Build person dropdown options
  const personOptions = buildPersonOptions();
  
  div.innerHTML = `
    <label>
      Role
      <input type="text" class="edit-assignment-role-input" placeholder="Lead Vocal" value="${existingAssignment?.role || ''}" required />
    </label>
    <label>
      Person
      <div class="edit-assignment-person-container"></div>
    </label>
    ${existingAssignment?.id ? `<input type="hidden" class="edit-assignment-id" value="${existingAssignment.id}" />` : ''}
    <button type="button" class="btn small ghost remove-edit-assignment">Remove</button>
  `;
  
  // Create searchable dropdown for person
  const personContainer = div.querySelector(".edit-assignment-person-container");
  const selectedValue =
    existingAssignment?.pending_invite_id ||
    existingAssignment?.person_id ||
    null;
  const personDropdown = createSearchableDropdown(
    personOptions, 
    "Select a person...",
    selectedValue,
    state.profile?.can_manage ? (name) => openInviteModal(name) : null
  );
  personContainer.appendChild(personDropdown);
  
  div.querySelector(".remove-edit-assignment").addEventListener("click", () => {
    container.removeChild(div);
  });
  container.appendChild(div);
}

let importAssignmentsDropdown = null;
let importEditAssignmentsDropdown = null;

function populateImportAssignmentsDropdown(containerId, excludeSetSongId) {
  const container = el(containerId);
  if (!container || !state.selectedSet) {
    // Show placeholder even if no set selected
    if (container) {
      container.innerHTML = "";
    }
    return;
  }
  
  container.innerHTML = "";
  
  // Get songs from the current set, excluding the current song if editing
  const setSongs = (state.selectedSet.set_songs || [])
    .filter(setSong => setSong.id !== excludeSetSongId)
    .sort((a, b) => a.sequence_order - b.sequence_order);
  
  if (setSongs.length === 0) {
    // Show message when no other songs to import from
    const message = document.createElement("span");
    message.className = "muted small-text";
    message.style.fontSize = "0.85rem";
    message.textContent = "No other songs in set";
    container.appendChild(message);
    return;
  }
  
  // Add a compact label
  const labelText = document.createElement("span");
  labelText.className = "small-text";
  labelText.style.fontSize = "0.85rem";
  labelText.style.color = "var(--text-muted)";
  labelText.style.whiteSpace = "nowrap";
  labelText.textContent = "or import from:";
  container.appendChild(labelText);
  
  // Add dropdown
  const dropdownContainer = document.createElement("div");
  dropdownContainer.style.minWidth = "180px";
  dropdownContainer.style.flex = "0 1 auto";
  
  // Only include songs (not sections) since you can't import assignments from sections
  const options = setSongs
    .filter(setSong => setSong.song_id !== null) // Only songs, not sections
    .map(setSong => ({
      value: setSong.id,
      label: setSong.song?.title || "Untitled",
      meta: { setSong }
    }));
  
  const dropdown = createSearchableDropdown(options, "Select a song...");
  dropdownContainer.appendChild(dropdown);
  container.appendChild(dropdownContainer);
  
  // Store reference based on which container
  if (containerId === "import-assignments-container") {
    importAssignmentsDropdown = dropdown;
    // Clear previous event listener and add new one
    dropdown.addEventListener("change", (e) => {
      if (e.detail && e.detail.value) {
        handleImportAssignments(e.detail.value);
      }
    });
  } else {
    importEditAssignmentsDropdown = dropdown;
    dropdown.addEventListener("change", (e) => {
      if (e.detail && e.detail.value) {
        handleImportEditAssignments(e.detail.value);
      }
    });
  }
}

function handleImportAssignments(selectedValue) {
  if (!selectedValue) return;
  
  // Find the set song
  const setSong = state.selectedSet.set_songs?.find(ss => ss.id === selectedValue);
  if (!setSong || !setSong.song_assignments?.length) {
    toastError("Selected song has no assignments to import.");
    // Reset dropdown
    if (importAssignmentsDropdown) {
      importAssignmentsDropdown.setValue("");
    }
    return;
  }
  
  // Clear existing assignments
  el("assignments-list").innerHTML = "";
  
  // Add assignments from selected song
  setSong.song_assignments.forEach((assignment) => {
    addAssignmentInputFromImport(assignment);
  });
  
  // Reset dropdown
  if (importAssignmentsDropdown) {
    importAssignmentsDropdown.setValue("");
  }
}

function handleImportEditAssignments(selectedValue) {
  if (!selectedValue) return;
  
  // Find the set song
  const setSong = state.selectedSet.set_songs?.find(ss => ss.id === selectedValue);
  if (!setSong || !setSong.song_assignments?.length) {
    toastError("Selected song has no assignments to import.");
    // Reset dropdown
    if (importEditAssignmentsDropdown) {
      importEditAssignmentsDropdown.setValue("");
    }
    return;
  }
  
  // Clear existing assignments
  el("edit-assignments-list").innerHTML = "";
  
  // Add assignments from selected song
  setSong.song_assignments.forEach((assignment) => {
    addEditAssignmentInputFromImport(assignment);
  });
  
  // Reset dropdown
  if (importEditAssignmentsDropdown) {
    importEditAssignmentsDropdown.setValue("");
  }
}

function addAssignmentInputFromImport(assignment) {
  const container = el("assignments-list");
  const div = document.createElement("div");
  div.className = "assignment-row";
  
  // Build person dropdown options
  const personOptions = buildPersonOptions();
  
  // Find the person option that matches this assignment
  let selectedPersonValue = null;
  if (assignment.pending_invite_id) {
    selectedPersonValue = assignment.pending_invite_id;
  } else if (assignment.person_id) {
    selectedPersonValue = assignment.person_id;
  }
  
  div.innerHTML = `
    <label>
      Role
      <input type="text" class="assignment-role-input" placeholder="Lead Vocal" value="${assignment.role || ''}" required />
    </label>
    <label>
      Person
      <div class="assignment-person-container"></div>
    </label>
    <button type="button" class="btn small ghost remove-assignment">Remove</button>
  `;
  
  // Create searchable dropdown for person
  const personContainer = div.querySelector(".assignment-person-container");
  const personDropdown = createSearchableDropdown(
    personOptions, 
    "Select a person...",
    selectedPersonValue,
    state.profile?.can_manage ? (name) => openInviteModal(name) : null
  );
  personContainer.appendChild(personDropdown);
  
  div.querySelector(".remove-assignment").addEventListener("click", () => {
    container.removeChild(div);
  });
  container.appendChild(div);
}

function addEditAssignmentInputFromImport(assignment) {
  const container = el("edit-assignments-list");
  const div = document.createElement("div");
  div.className = "assignment-row";
  
  // Build person dropdown options
  const personOptions = buildPersonOptions();
  
  // Find the person option that matches this assignment
  let selectedPersonValue = null;
  if (assignment.pending_invite_id) {
    selectedPersonValue = assignment.pending_invite_id;
  } else if (assignment.person_id) {
    selectedPersonValue = assignment.person_id;
  }
  
  div.innerHTML = `
    <label>
      Role
      <input type="text" class="edit-assignment-role-input" placeholder="Lead Vocal" value="${assignment.role || ''}" required />
    </label>
    <label>
      Person
      <div class="edit-assignment-person-container"></div>
    </label>
    <button type="button" class="btn small ghost remove-edit-assignment">Remove</button>
  `;
  
  // Create searchable dropdown for person
  const personContainer = div.querySelector(".edit-assignment-person-container");
  const personDropdown = createSearchableDropdown(
    personOptions, 
    "Select a person...",
    selectedPersonValue,
    state.profile?.can_manage ? (name) => openInviteModal(name) : null
  );
  personContainer.appendChild(personDropdown);
  
  div.querySelector(".remove-edit-assignment").addEventListener("click", () => {
    container.removeChild(div);
  });
  container.appendChild(div);
}

function collectEditAssignments() {
  const roles = Array.from(document.querySelectorAll(".edit-assignment-role-input"));
  const personContainers = Array.from(
    document.querySelectorAll(".edit-assignment-person-container")
  );
  const ids = Array.from(document.querySelectorAll(".edit-assignment-id"));
  const assignments = [];

  roles.forEach((roleInput, index) => {
    const role = roleInput.value.trim();
    const personContainer = personContainers[index];
    const personDropdown = personContainer?.querySelector(".searchable-dropdown");
    const selectedOption = personDropdown?.getSelectedOption?.();
    const assignmentId = ids[index]?.value;
    if (role && selectedOption) {
      const baseAssignment = {
        role,
        id: assignmentId || null,
        person_name: selectedOption.label,
        person_email: selectedOption.meta?.email || null,
      };
      if (selectedOption.meta?.type === "pending") {
        assignments.push({
          ...baseAssignment,
          pending_invite_id: selectedOption.value,
        });
      } else {
        assignments.push({
          ...baseAssignment,
          person_id: selectedOption.value,
        });
      }
    }
  });

  return assignments;
}

async function handleEditSetSongSubmit(event) {
  event.preventDefault();
  const form = el("edit-set-song-form");
  const setSongId = form.dataset.setSongId;
  const isSection = form.dataset.isSection === "true";
  const isSectionHeader = form.dataset.isSectionHeader === "true";
  
  if (!setSongId) {
    toastError("Missing set song ID.");
    return;
  }
  
  // Build update object
  const updateData = {};
  let plannedDurationSeconds = null;
  
  if (!isSectionHeader) {
    const durationValue = el("edit-set-song-duration")?.value.trim() || "";
    if (durationValue) {
      const parsedDuration = parseDuration(durationValue);
      if (parsedDuration === null) {
        toastError("Please enter a valid length (use MM:SS or minutes).");
        return;
      }
      plannedDurationSeconds = parsedDuration;
    }
  }
  
  // If it's a section header, only update title
  if (isSectionHeader) {
    const title = el("edit-section-title").value.trim();
    if (!title) {
      toastError("Header title is required.");
      return;
    }
    updateData.title = title;
    updateData.description = null;
    updateData.notes = null;
    updateData.planned_duration_seconds = null;
  } else if (isSection) {
    // Regular section: update title, description, and notes
    const title = el("edit-section-title").value.trim();
    const description = el("edit-section-description").value.trim();
    const notes = el("edit-set-song-notes").value.trim();
    if (!title) {
      toastError("Section title is required.");
      return;
    }
    updateData.title = title;
    updateData.description = description || null;
    updateData.notes = notes || null;
    updateData.planned_duration_seconds = plannedDurationSeconds;
  } else {
    // Song: update notes and key
    const notes = el("edit-set-song-notes").value.trim();
    const key = el("edit-set-song-key")?.value.trim() || null;
    updateData.notes = notes || null;
    updateData.key = key;
    updateData.planned_duration_seconds = plannedDurationSeconds;
  }
  
  // Update set_song
  const { data: updatedSetSong, error: updateError } = await supabase
    .from("set_songs")
    .update(updateData)
    .eq("id", setSongId)
    .select("id, set_id")
    .single();
  
  if (updateError) {
    console.error(updateError);
    const itemType = isSectionHeader ? 'section header' : (isSection ? 'section' : 'song');
    toastError(`Unable to update ${itemType}.`);
    return;
  }
  
  // Skip assignment handling for section headers
  if (!isSectionHeader) {
    const setId = updatedSetSong?.set_id || state.selectedSet?.id || null;
    const setForMode = state.selectedSet && state.selectedSet.id === setId
      ? state.selectedSet
      : state.selectedSet;
    const assignmentMode = setForMode ? getSetAssignmentMode(setForMode) : 'per_song';

    const assignments = collectEditAssignments();
    let newSongRecipients = [];

    // For per-song mode, detect people who are newly assigned to this set (across all songs)
    if (setId && assignmentMode === 'per_song' && assignments.length > 0) {
      const { data: existingSetSongAssignments, error: existingSetSongErr } = await supabase
        .from("song_assignments")
        .select(`
          person_id,
          pending_invite_id,
          person_email,
          set_song:set_song_id ( set_id )
        `)
        .eq("set_song.set_id", setId);

      if (existingSetSongErr) {
        console.error("Error fetching existing song assignments for notifications:", existingSetSongErr);
      } else {
        const existingKeys = new Set(
          (existingSetSongAssignments || [])
            .map((row) => getAssignmentIdentityKeyFromDbRow(row))
            .filter(Boolean)
        );

        const currentKeys = new Map();
        assignments.forEach((a) => {
          const key = getAssignmentIdentityKeyFromFormAssignment(a);
          if (!key) return;
          if (!currentKeys.has(key)) {
            currentKeys.set(key, {
              key,
              person_id: a.person_id || null,
              pending_invite_id: a.pending_invite_id || null,
              person_email: a.person_email || null,
            });
          }
        });

        newSongRecipients = Array.from(currentKeys.values()).filter(
          (r) => !existingKeys.has(r.key)
        );
      }
    }
  
  // Get existing assignments
  const { data: existingAssignments } = await supabase
    .from("song_assignments")
    .select("*")
    .eq("set_song_id", setSongId);
  
  // Determine which to delete, update, and insert
  const existingIds = new Set(existingAssignments?.map(a => a.id) || []);
  const newAssignments = assignments.filter(a => !a.id);
  const updatedAssignments = assignments.filter(a => a.id && existingIds.has(a.id));
  const deletedIds = Array.from(existingIds).filter(id => 
    !assignments.some(a => a.id === id)
  );
  
  // Delete removed assignments
  if (deletedIds.length > 0) {
    await supabase
      .from("song_assignments")
      .delete()
      .in("id", deletedIds);
  }
  
  // Update existing assignments
  for (const assignment of updatedAssignments) {
    await supabase
      .from("song_assignments")
      .update({
        role: assignment.role,
        person_id: assignment.person_id || null,
        pending_invite_id: assignment.pending_invite_id || null,
        person_name: assignment.person_name || null,
        person_email: assignment.person_email || null,
        // Preserve existing status when updating, or set to pending if person changed
        status: assignment.status || 'pending',
      })
      .eq("id", assignment.id);
  }
  
  // Insert new assignments
  if (newAssignments.length > 0) {
    await supabase
      .from("song_assignments")
      .insert(
        newAssignments.map((assignment) => ({
          role: assignment.role,
          person_id: assignment.person_id || null,
          pending_invite_id: assignment.pending_invite_id || null,
          person_name: assignment.person_name || null,
          person_email: assignment.person_email || null,
          set_song_id: setSongId,
          team_id: state.currentTeamId,
          status: 'pending',
        }))
      );
    }

    // Send notifications for newly assigned people in per-song mode
    if (setId && assignmentMode === 'per_song' && newSongRecipients.length > 0) {
      await notifyAssignmentEmails(setId, state.currentTeamId, newSongRecipients, "per_song");
    }
  }
  
  // Handle section links if this is a section
  if (isSection && !isSectionHeader) {
    const links = collectSectionLinks("edit-section-links-list");
    
    // Get existing links
    const { data: existingLinks } = await supabase
      .from("song_links")
      .select("*")
      .eq("set_song_id", setSongId);
    
    // Determine which to delete, update, and insert
    const existingIds = new Set(existingLinks?.map(l => l.id) || []);
    const newLinks = links.filter(l => !l.id);
    const updatedLinks = links.filter(l => l.id && existingIds.has(l.id));
    const deletedIds = Array.from(existingIds).filter(id => 
      !links.some(l => l.id === id)
    );
    
    // Delete removed links and their files
    if (deletedIds.length > 0) {
      // Get file paths of links to be deleted
      const linksToDelete = existingLinks?.filter(l => deletedIds.includes(l.id)) || [];
      for (const linkToDelete of linksToDelete) {
        if (linkToDelete.is_file_upload && linkToDelete.file_path) {
          await deleteFileFromSupabase(linkToDelete.file_path);
        }
      }
      
      await supabase
        .from("song_links")
        .delete()
        .in("id", deletedIds);
    }
    
    // Update existing links
    for (const link of updatedLinks) {
      const existingLink = existingLinks?.find(l => l.id === link.id);
      let filePath = link.file_path;
      let fileName = link.file_name;
      let fileType = link.file_type;
      
      // If it's a file upload with a new file, upload it
      if (link.is_file_upload && link.file) {
        // Delete old file if it exists
        if (existingLink?.is_file_upload && existingLink?.file_path) {
          await deleteFileFromSupabase(existingLink.file_path);
        }
        
        // Upload new file
        const uploadResult = await uploadFileToSupabase(link.file, null, setSongId, state.currentTeamId);
        if (!uploadResult.success) {
          toastError(`Failed to upload file: ${uploadResult.error}`);
          continue;
        }
        filePath = uploadResult.filePath;
        fileName = uploadResult.fileName;
        fileType = uploadResult.fileType;
      } else if (link.is_file_upload && !link.file && existingLink?.file_path) {
        // Keep existing file if no new file is selected
        filePath = existingLink.file_path;
        fileName = existingLink.file_name || link.file_name;
        fileType = existingLink.file_type || link.file_type;
      }
      
      await supabase
        .from("song_links")
        .update({
          title: link.title,
          url: link.is_file_upload ? null : link.url,
          file_path: link.is_file_upload ? filePath : null,
          file_name: link.is_file_upload ? fileName : null,
          file_type: link.is_file_upload ? fileType : null,
          is_file_upload: link.is_file_upload,
          key: link.key || null,
          display_order: link.display_order,
        })
        .eq("id", link.id);
    }
    
    // Insert new links
    if (newLinks.length > 0) {
      const linksToInsert = [];
      
      for (const link of newLinks) {
        let filePath = link.file_path;
        let fileName = link.file_name;
        let fileType = link.file_type;
        
        // If it's a file upload, upload the file first
        if (link.is_file_upload && link.file) {
          const uploadResult = await uploadFileToSupabase(link.file, null, setSongId, state.currentTeamId);
          if (!uploadResult.success) {
            toastError(`Failed to upload file: ${uploadResult.error}`);
            continue;
          }
          filePath = uploadResult.filePath;
          fileName = uploadResult.fileName;
          fileType = uploadResult.fileType;
        }
        
        linksToInsert.push({
          set_song_id: setSongId,
          song_id: null,
          title: link.title,
          url: link.is_file_upload ? null : link.url,
          file_path: link.is_file_upload ? filePath : null,
          file_name: link.is_file_upload ? fileName : null,
          file_type: link.is_file_upload ? fileType : null,
          is_file_upload: link.is_file_upload,
          key: link.key || null,
          display_order: link.display_order,
          team_id: state.currentTeamId,
        });
      }
      
      if (linksToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("song_links")
          .insert(linksToInsert);
        
        if (insertError) {
          console.error("Error inserting section links:", insertError);
          toastError("Some links could not be saved. Please check that the database migration has been run.");
        }
      }
    }
  }
  
  closeEditSetSongModal();
  await loadSets();
  
  // Refresh detail view if it's showing
  if (state.selectedSet && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    }
  }
}

function showDeleteConfirmModal(name, message, onConfirm, options = {}) {
  const modal = el("delete-confirm-modal");
  const title = el("delete-confirm-title");
  const messageEl = el("delete-confirm-message");
  const nameEl = el("delete-confirm-name");
  const input = el("delete-confirm-input");
  const confirmBtn = el("confirm-delete");
  const cancelBtn = el("cancel-delete-confirm");
  const closeBtn = el("close-delete-confirm-modal");
  
  if (!modal) return;
  
  const modalTitle = options.title || "Confirm Deletion";
  const buttonText = options.buttonText || "Delete";
  
  title.textContent = modalTitle;
  messageEl.textContent = message;
  nameEl.textContent = `'${name}'`;
  input.value = "";
  input.placeholder = name;
  confirmBtn.textContent = buttonText;
  confirmBtn.disabled = true;
  
  const checkMatch = () => {
    confirmBtn.disabled = input.value.trim() !== name.trim();
  };
  
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !confirmBtn.disabled) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cleanup();
    }
  };
  
  const cleanup = () => {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    input.removeEventListener("input", checkMatch);
    input.removeEventListener("keydown", handleKeyDown);
    input.value = "";
    confirmBtn.disabled = true;
  };
  
  const handleConfirm = () => {
    if (input.value.trim() === name.trim()) {
      cleanup();
      onConfirm();
    }
  };
  
  input.addEventListener("input", checkMatch);
  input.addEventListener("keydown", handleKeyDown);
  
  confirmBtn.onclick = handleConfirm;
  cancelBtn.onclick = cleanup;
  closeBtn.onclick = cleanup;
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  input.focus();
}

async function deleteSet(set) {
  if (!isManager()) return;
  
  showDeleteConfirmModal(
    set.title,
    `Deleting "${set.title}" will remove all associated information and assignments.`,
    async () => {
      const { error } = await supabase
        .from("sets")
        .delete()
        .eq("id", set.id)
        .eq("team_id", state.currentTeamId);
      
      if (error) {
        console.error(error);
        toastError("Unable to delete set. Check console.");
        return;
      }
      
      // Hide detail view if showing the deleted set
      if (state.selectedSet?.id === set.id) {
        hideSetDetail();
      }
      
      await loadSets();
    }
  );
}

async function deleteSong(songId) {
  if (!isManager()) return;
  
  const song = state.songs.find(s => s.id === songId);
  const songTitle = song?.title || "this song";
  
  showDeleteConfirmModal(
    songTitle,
    `Deleting "${songTitle}"? will remove it from all sets.`,
    async () => {
      const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", songId)
        .eq("team_id", state.currentTeamId);
      
      if (error) {
        console.error(error);
        toastError("Unable to delete song. Check console.");
        return;
      }
      
      // Close details modal if this song is open
      if (state.currentSongDetailsId === songId) {
        closeSongDetailsModal();
      }
      
      await loadSongs();
      
      // Update songs tab if it's currently visible
      if (!el("songs-tab")?.classList.contains("hidden")) {
        renderSongCatalog();
      }
      
      // Refresh set detail view if it's showing
      if (state.selectedSet) {
        await loadSets();
        const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
        if (updatedSet) {
          state.selectedSet = updatedSet;
          renderSetDetailSongs(updatedSet);
        }
      }
    }
  );
}

// Invite Member Functions
function openInviteModal(prefilledName = null) {
  if (!isManager()) return;
  const modal = el("invite-modal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  el("invite-form").reset();
  
  // Hide name field initially
  const nameLabel = el("invite-name-label");
  if (nameLabel) {
    nameLabel.classList.add("hidden");
  }
  const nameInput = el("invite-name");
  if (nameInput) {
    nameInput.removeAttribute("required");
  }
  
  if (prefilledName) {
    if (nameInput) nameInput.value = prefilledName;
  }
  el("invite-message").textContent = "";
  
  // Set up email check listener on blur
  const emailInput = el("invite-email");
  if (emailInput) {
    // Use a one-time blur listener that checks the email
    const blurHandler = async () => {
      const email = emailInput.value.trim();
      if (email) {
        await checkEmailForInvite(email);
      }
      emailInput.removeEventListener("blur", blurHandler);
    };
    emailInput.addEventListener("blur", blurHandler);
    
    // Also check on input with debounce
    let emailCheckTimeout;
    const inputHandler = async (e) => {
      clearTimeout(emailCheckTimeout);
      const email = e.target.value.trim().toLowerCase();
      
      if (!email || !email.includes("@")) {
        if (nameLabel) nameLabel.classList.add("hidden");
        if (nameInput) nameInput.removeAttribute("required");
        const messageEl = el("invite-message");
        if (messageEl) {
          messageEl.textContent = "";
          messageEl.classList.remove("error-text", "muted");
        }
        return;
      }
      
      emailCheckTimeout = setTimeout(async () => {
        await checkEmailForInvite(email);
      }, 500); // Debounce for 500ms
    };
    
    // Store handler so we can remove it later if needed
    emailInput.dataset.inviteEmailHandler = "true";
    emailInput.addEventListener("input", inputHandler);
  }
}

function closeInviteModal() {
  const modal = el("invite-modal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  el("invite-form").reset();
  el("invite-message").textContent = "";
  
  // Hide name field
  const nameLabel = el("invite-name-label");
  if (nameLabel) {
    nameLabel.classList.add("hidden");
  }
  const nameInput = el("invite-name");
  if (nameInput) {
    nameInput.removeAttribute("required");
  }
}

async function checkEmailForInvite(email) {
  if (!email || !email.includes("@")) return;
  
  const normalizedEmail = email.toLowerCase();
  const nameLabel = el("invite-name-label");
  const nameInput = el("invite-name");
  const messageEl = el("invite-message");
  
  // Check if user exists
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();
  
  if (existingProfileError && existingProfileError.code !== "PGRST116") {
    console.error("Error checking existing profile:", existingProfileError);
    return;
  }
  
  if (existingProfile) {
    // User exists - hide name field
    if (nameLabel) nameLabel.classList.add("hidden");
    if (nameInput) {
      nameInput.removeAttribute("required");
      nameInput.value = ""; // Clear name since we don't need it
    }
    if (messageEl) {
      messageEl.textContent = `${existingProfile.full_name || email} already has an account. They'll be added to the team.`;
      messageEl.classList.remove("error-text");
      messageEl.classList.add("muted");
    }
  } else {
    // User doesn't exist - show name field
    if (nameLabel) nameLabel.classList.remove("hidden");
    if (nameInput) nameInput.setAttribute("required", "required");
    if (messageEl) {
      messageEl.textContent = "";
      messageEl.classList.remove("error-text", "muted");
    }
  }
}

async function handleInviteSubmit(event) {
  event.preventDefault();
  if (!isManager()) return;
  
  const email = el("invite-email").value.trim();
  const nameInput = el("invite-name");
  const name = nameInput ? nameInput.value.trim() : "";
  const messageEl = el("invite-message");
  
  if (!email) {
    messageEl.textContent = "Please enter an email address.";
    messageEl.classList.add("error-text");
    messageEl.classList.remove("muted");
    return;
  }
  
  const normalizedEmail = email.toLowerCase();
  
  // Check if name is required (user doesn't have account)
  const nameLabel = el("invite-name-label");
  const nameIsVisible = nameLabel && !nameLabel.classList.contains("hidden");
  if (nameIsVisible && !name) {
    messageEl.textContent = "Please enter a name for the new user.";
    messageEl.classList.add("error-text");
    messageEl.classList.remove("muted");
    return;
  }

  // Prevent inviting someone who already has an account
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfileError && existingProfileError.code !== "PGRST116") {
    console.error("Error checking existing profile:", existingProfileError);
    messageEl.textContent = "Unable to check existing members. Please try again.";
    messageEl.classList.add("error-text");
    messageEl.classList.remove("muted");
    return;
  }

  // Check if user already exists
  if (existingProfile) {
    // Check if they're already in this team
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", existingProfile.id)
      .eq("team_id", state.currentTeamId)
      .maybeSingle();
    
    if (existingMember) {
      messageEl.textContent = `${email} is already a member of this team.`;
      messageEl.classList.add("error-text");
      messageEl.classList.remove("muted");
      return;
    }
    
    // User exists but not in this team - automatically add them
    messageEl.textContent = "Adding user to team...";
    messageEl.classList.remove("error-text");
    messageEl.classList.add("muted");
    
    // Create pending_invite record (for tracking) - no name needed for existing users
    await ensurePendingInviteRecord(normalizedEmail, null);
    
    // Add user to team_members directly
    const { error: addError } = await supabase
      .rpc('add_team_member', {
        p_team_id: state.currentTeamId,
        p_user_id: existingProfile.id,
        p_role: 'member',
        p_is_owner: false,
        p_can_manage: false
      });
    
    if (addError && (addError.code === '42883' || addError.message?.includes('function'))) {
      // Function doesn't exist, try direct insert
      const { error: directError } = await supabase
        .from("team_members")
        .insert({
          team_id: state.currentTeamId,
          user_id: existingProfile.id,
          role: 'member',
          is_owner: false,
          can_manage: false
        });
      
      if (directError) {
        console.error("Error adding user to team:", directError);
        messageEl.textContent = directError.message || "Unable to add user to team. Please try again.";
        messageEl.classList.add("error-text");
        messageEl.classList.remove("muted");
        return;
      }
    } else if (addError) {
      console.error("Error adding user to team:", addError);
      messageEl.textContent = addError.message || "Unable to add user to team. Please try again.";
      messageEl.classList.add("error-text");
      messageEl.classList.remove("muted");
      return;
    }
    
    // Success - user added to team
    await loadPeople();
    messageEl.textContent = `${email} has been added to the team! They'll see this team in their account.`;
    messageEl.classList.remove("error-text");
    messageEl.classList.add("muted");
    el("invite-form").reset();
    return;
  }

  messageEl.textContent = "Sending invite...";
  messageEl.classList.remove("error-text");
  messageEl.classList.add("muted");
  
  // Use signInWithOtp with shouldCreateUser to send invite
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: "https://michaeldors.com/cadence",
      data: {
        full_name: name || undefined,
      },
    },
  });
  
  if (error) {
    console.error("Invite error:", error);
    messageEl.textContent = error.message || "Unable to send invite. Please try again.";
    messageEl.classList.add("error-text");
    messageEl.classList.remove("muted");
    return;
  }
  
  await ensurePendingInviteRecord(normalizedEmail, name);
  await loadPeople();
  
  messageEl.textContent = `Invite sent to ${email}! They'll receive an email to create their account and join the team.`;
  messageEl.classList.remove("error-text");
  messageEl.classList.add("muted");
  el("invite-form").reset();
  
  // Optionally store the invite info for profile creation
  // We'll handle profile creation in fetchProfile when they first sign in
}


async function openLeaveTeamModal(teamId, teamName) {
  if (!teamId) return;
  
  const modal = el("leave-team-modal");
  const messageEl = el("leave-team-message");
  const confirmBtn = el("confirm-leave-team");
  
  if (!modal || !messageEl) return;
  
  // Store team info for confirmation
  modal.dataset.teamId = teamId;
  modal.dataset.teamName = teamName;
  
  // Check if user is the only owner
  const team = state.userTeams.find(t => t.id === teamId);
  if (team?.is_owner) {
    // Check if there are other owners
    const { data: owners } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("is_owner", true);
    
    if (owners && owners.length === 1) {
      messageEl.textContent = `You cannot leave "${teamName}" because you are the only owner. Please transfer ownership or delete the team instead.`;
      if (confirmBtn) confirmBtn.disabled = true;
    } else {
      messageEl.textContent = `Leave "${teamName}"? You can be re-invited later.`;
      if (confirmBtn) confirmBtn.disabled = false;
    }
  } else {
    messageEl.textContent = `Leave "${teamName}"? You can be re-invited later.`;
    if (confirmBtn) confirmBtn.disabled = false;
  }
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLeaveTeamModal() {
  const modal = el("leave-team-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    delete modal.dataset.teamId;
    delete modal.dataset.teamName;
  }
}

async function leaveTeam(teamId, teamName) {
  if (!teamId) return;
  
  // Check if user is the only owner
  const team = state.userTeams.find(t => t.id === teamId);
  if (team?.is_owner) {
    // Check if there are other owners
    const { data: owners } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("is_owner", true);
    
    if (owners && owners.length === 1) {
      // This should have been caught by the modal, but just in case
      return;
    }
  }
  
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", state.session.user.id);
  
  if (error) {
    console.error("Error leaving team:", error);
    toastError("Unable to leave team. Check console.");
    return;
  }
  
  // Remove from local state immediately
  state.userTeams = state.userTeams.filter(t => t.id !== teamId);
  
  // If this was the current team, switch to another or show empty state immediately
  if (teamId === state.currentTeamId) {
    if (state.userTeams.length > 0) {
      await switchTeam(state.userTeams[0].id);
    } else {
      // No teams left - show empty state immediately
      state.currentTeamId = null;
      state.sets = [];
      state.songs = [];
      state.people = [];
      showEmptyState();
    }
  } else {
    // Just refresh the switcher
    updateTeamSwitcher();
  }
  
  // Close modal
  closeLeaveTeamModal();
}

async function ensurePendingInviteRecord(email, fullName) {
  if (!email) return;
  const normalizedEmail = email.trim().toLowerCase();
  const payload = {
    email: normalizedEmail,
    full_name: fullName || null,
    created_by: state.profile?.id || null,
    team_id: state.currentTeamId || null,
  };
  const { error } = await supabase
    .from("pending_invites")
    .upsert(payload, { onConflict: "email" });
  if (error) {
    console.error("Error recording pending invite:", error);
  }
}

// Edit Person Functions
function openEditPersonModal(person) {
  if (!isManager() || !person) return;
  
  const modal = el("edit-person-modal");
  const form = el("edit-person-form");
  
  if (!modal || !form) return;
  
  el("edit-person-name").value = person.full_name || "";
  el("edit-person-email").value = person.email || "";
  el("edit-person-email").disabled = true; // Email is read-only
  
  form.dataset.personId = person.id;
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditPersonModal() {
  const modal = el("edit-person-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    el("edit-person-form")?.reset();
    delete el("edit-person-form")?.dataset.personId;
    const emailInput = el("edit-person-email");
    if (emailInput) emailInput.disabled = false;
  }
}

async function handleEditPersonSubmit(event) {
  event.preventDefault();
  if (!isManager()) return;
  
  const form = el("edit-person-form");
  const personId = form.dataset.personId;
  const fullName = el("edit-person-name").value.trim();
  
  if (!personId || !fullName) {
    toastError("Missing required information.");
    return;
  }
  
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", personId);
  
  if (error) {
    console.error(error);
    toastError("Unable to update member. Check console.");
    return;
  }
  
  closeEditPersonModal();
  await loadPeople();
}

async function deletePerson(person) {
  if (!isManager() || !person) return;
  
  if (person.id === state.profile.id) {
    toastError("You cannot remove yourself from the band.");
    return;
  }
  
  // Check if person is an owner - owners cannot be removed, they must transfer ownership first
  if (person.is_owner) {
    toastError("You cannot remove an owner from the team. The owner must transfer ownership first.");
    return;
  }
  
  const personName = person.full_name || person.email || "this person";
  
  showDeleteConfirmModal(
    personName,
    `Removing "${personName}" from the team will also remove all their assignments.`,
    async () => {
      console.log('🗑️ Removing person from team:', person.id, personName);
      
      // Step 1: Delete all song_assignments and set_assignments that reference this person by person_id
      console.log('  - Step 1: Deleting song assignments by person_id...');
      const { error: songAssignmentsError } = await supabase
        .from("song_assignments")
        .delete()
        .eq("person_id", person.id);
      
      if (songAssignmentsError) {
        console.error('❌ Error deleting song assignments by person_id:', songAssignmentsError);
        const errorMsg = songAssignmentsError.message || songAssignmentsError.code || 'Unknown error';
        toastError(`Unable to remove member song assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
        return;
      }
      
      console.log('  - Step 1b: Deleting set assignments by person_id...');
      const { error: setAssignmentsError } = await supabase
        .from("set_assignments")
        .delete()
        .eq("person_id", person.id);
      
      if (setAssignmentsError) {
        console.error('❌ Error deleting set assignments by person_id:', setAssignmentsError);
        const errorMsg = setAssignmentsError.message || setAssignmentsError.code || 'Unknown error';
        toastError(`Unable to remove member set assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
        return;
      }
      
      // Step 2: Find and delete pending_invite if it exists for this team
      const personEmail = person.email?.toLowerCase();
      if (personEmail) {
        console.log('  - Step 2: Checking for pending invite...');
        const { data: pendingInvite } = await supabase
          .from("pending_invites")
          .select("id")
          .eq("email", personEmail)
          .eq("team_id", state.currentTeamId)
          .maybeSingle();
        
        if (pendingInvite) {
          console.log('  - Step 2a: Deleting song assignments by pending_invite_id...');
          // Delete song assignments that reference this pending_invite
          const { error: pendingSongAssignmentsError } = await supabase
            .from("song_assignments")
            .delete()
            .eq("pending_invite_id", pendingInvite.id);
          
          if (pendingSongAssignmentsError) {
            console.error('❌ Error deleting song assignments by pending_invite_id:', pendingSongAssignmentsError);
            const errorMsg = pendingSongAssignmentsError.message || pendingSongAssignmentsError.code || 'Unknown error';
            toastError(`Unable to remove pending invite song assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
            return;
          }
          
          console.log('  - Step 2a2: Deleting set assignments by pending_invite_id...');
          // Delete set assignments that reference this pending_invite
          const { error: pendingSetAssignmentsError } = await supabase
            .from("set_assignments")
            .delete()
            .eq("pending_invite_id", pendingInvite.id);
          
          if (pendingSetAssignmentsError) {
            console.error('❌ Error deleting set assignments by pending_invite_id:', pendingSetAssignmentsError);
            const errorMsg = pendingSetAssignmentsError.message || pendingSetAssignmentsError.code || 'Unknown error';
            toastError(`Unable to remove pending invite set assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
            return;
          }
          
          console.log('  - Step 2b: Deleting pending_invite...');
          // Delete the pending_invite
          const { error: pendingError } = await supabase
            .from("pending_invites")
            .delete()
            .eq("id", pendingInvite.id);
          
          if (pendingError) {
            console.error('❌ Error deleting pending_invite:', pendingError);
            const errorMsg = pendingError.message || pendingError.code || 'Unknown error';
            toastError(`Unable to remove pending invite.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
            return;
          }
        }
      }
      
      // Step 3: Remove the person from the team by deleting their team_members entry
      // This is the correct approach - we're removing them from THIS team, not deleting their profile
      // They may be a member of other teams
      console.log('  - Step 3: Removing from team_members...');
      const { error: teamMemberError } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", state.currentTeamId)
        .eq("user_id", person.id);
      
      if (teamMemberError) {
        console.error('❌ Error removing from team_members:', teamMemberError);
        const errorMsg = teamMemberError.message || teamMemberError.code || 'Unknown error';
        toastError(`Unable to remove member from team.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
        return;
      }
      
      console.log('✅ Person removed from team successfully');
      
      // Reload people and sets (to refresh assignments)
      await Promise.all([loadPeople(), loadSets()]);
      
      // Refresh UI if on sets tab
      if (!el("sets-tab")?.classList.contains("hidden")) {
        renderSets();
      }
    }
  );
}

async function cancelPendingInvite(invite) {
  if (!isManager()) return;
  
  const inviteName = invite.full_name || invite.email || "this invite";
  
  showDeleteConfirmModal(
    inviteName,
    `Canceling the invite for "${inviteName}" will remove all their pending assignments.`,
    async () => {
      console.log('🚫 Canceling pending invite:', invite.id, inviteName);
      
      // Step 1: Delete all song_assignments and set_assignments that reference this pending_invite
      console.log('  - Step 1: Deleting song assignments by pending_invite_id...');
      const { error: songAssignmentsError } = await supabase
        .from("song_assignments")
        .delete()
        .eq("pending_invite_id", invite.id);
      
      if (songAssignmentsError) {
        console.error('❌ Error deleting song assignments by pending_invite_id:', songAssignmentsError);
        const errorMsg = songAssignmentsError.message || songAssignmentsError.code || 'Unknown error';
        toastError(`Unable to remove pending invite song assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
        return;
      }
      
      console.log('  - Step 1b: Deleting set assignments by pending_invite_id...');
      const { error: setAssignmentsError } = await supabase
        .from("set_assignments")
        .delete()
        .eq("pending_invite_id", invite.id);
      
      if (setAssignmentsError) {
        console.error('❌ Error deleting set assignments by pending_invite_id:', setAssignmentsError);
        const errorMsg = setAssignmentsError.message || setAssignmentsError.code || 'Unknown error';
        toastError(`Unable to remove pending invite set assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
        return;
      }
      
      // Step 2: Delete the pending_invite
      console.log('  - Step 2: Deleting pending_invite...');
      const { error: inviteError } = await supabase
        .from("pending_invites")
        .delete()
        .eq("id", invite.id);
      
      if (inviteError) {
        console.error('❌ Error deleting pending_invite:', inviteError);
        const errorMsg = inviteError.message || inviteError.code || 'Unknown error';
        toastError(`Unable to cancel invite.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.\n\nYou may need to add DELETE policies for:\n- pending_invites table (for users with can_manage = true)\n- song_assignments table (for users with can_manage = true)`);
        return;
      }
      
      console.log('✅ Pending invite canceled successfully');
      
      // Reload people and sets (to refresh assignments)
      await Promise.all([loadPeople(), loadSets()]);
      
      // Refresh UI if on sets tab
      if (!el("sets-tab")?.classList.contains("hidden")) {
        renderSets();
      }
    }
  );
}

// Song Catalog Management
function openSongCatalogModal() {
  if (!isManager()) return;
  const modal = el("song-catalog-modal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderSongCatalog();
}

function closeSongCatalogModal() {
  const modal = el("song-catalog-modal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function renderSongCatalog() {
  const list = el("songs-catalog-list");
  if (!list) return;
  
  const searchInput = el("songs-tab-search");
  const searchTermRaw = searchInput ? searchInput.value.trim() : "";
  const searchTerm = searchTermRaw.toLowerCase();
  
  list.innerHTML = "";
  
  if (!state.songs || state.songs.length === 0) {
    list.innerHTML = '<p class="muted">No songs yet. Create your first song!</p>';
    return;
  }
  
  // Filter songs based on search term
  let filteredSongs = state.songs;
  if (searchTerm) {
    const allMatches = state.songs.filter((song) => {
      const titleMatch = (song.title || "").toLowerCase().includes(searchTerm);
      const bpmMatch = song.bpm ? String(song.bpm).includes(searchTerm) : false;
      const keyList = [
        song.song_key || "",
        ...(song.song_keys || []).map(k => k.key || "")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const keyMatch = keyList.includes(searchTerm);
      const timeMatch = (song.time_signature || "").toLowerCase().includes(searchTerm);
      const durationMatch = song.duration_seconds ? formatDuration(song.duration_seconds).toLowerCase().includes(searchTerm) : false;
      return titleMatch || bpmMatch || keyMatch || timeMatch || durationMatch;
    });
    
    // Prioritize: title matches first, then metadata matches
    const titleMatches = allMatches.filter((song) => 
      (song.title || "").toLowerCase().includes(searchTerm)
    );
    const metadataMatches = allMatches.filter((song) => 
      !(song.title || "").toLowerCase().includes(searchTerm)
    );
    
    filteredSongs = [...titleMatches, ...metadataMatches];
  }
  
  if (filteredSongs.length === 0) {
    list.innerHTML = '<p class="muted">No songs match your search.</p>';
    return;
  }
  
  filteredSongs.forEach((song) => {
    const div = document.createElement("div");
    div.className = "card set-song-card";
    
    // Highlight search term in title and metadata (use raw search term for highlighting)
    const highlightedTitle = searchTermRaw ? highlightMatch(song.title || "", searchTermRaw) : escapeHtml(song.title || "");
    const highlightedBpm = song.bpm ? (searchTerm && String(song.bpm).includes(searchTerm) ? `<span>BPM: ${highlightMatch(String(song.bpm), searchTermRaw)}</span>` : `<span>BPM: ${song.bpm}</span>`) : '';
    // Only use keys from the song itself (song_keys relationship), remove duplicates
    const keysSet = new Set((song.song_keys || []).map(k => k.key).filter(Boolean));
    const keys = Array.from(keysSet).join(", ");
    const highlightedKey = keys ? (searchTerm && keys.toLowerCase().includes(searchTerm.toLowerCase()) ? `<span>Key: ${highlightMatch(keys, searchTermRaw)}</span>` : `<span>Key: ${keys}</span>`) : '';
    const highlightedTime = song.time_signature ? (searchTerm && song.time_signature.toLowerCase().includes(searchTerm) ? `<span>Time: ${highlightMatch(song.time_signature, searchTermRaw)}</span>` : `<span>Time: ${escapeHtml(song.time_signature)}</span>`) : '';
    const durationStr = song.duration_seconds ? formatDuration(song.duration_seconds) : '';
    const highlightedDuration = durationStr ? (searchTerm && durationStr.toLowerCase().includes(searchTerm) ? `<span>Duration: ${highlightMatch(durationStr, searchTermRaw)}</span>` : `<span>Duration: ${durationStr}</span>`) : '';
    
    div.innerHTML = `
      <div class="set-song-header song-card-header">
        <div class="set-song-info">
          <h4 class="song-title" style="margin: 0 0 0.5rem 0;">${highlightedTitle}</h4>
          <div class="song-meta-text">
            ${highlightedBpm}
            ${highlightedKey}
            ${highlightedTime}
            ${highlightedDuration}
          </div>
        </div>
        <div class="set-song-actions song-card-actions">
          <button class="btn small secondary view-song-details-catalog-btn" data-song-id="${song.id}">View Details</button>
          ${isManager() ? `
          <button class="btn small secondary edit-song-btn" data-song-id="${song.id}">Edit</button>
          <button class="btn small ghost delete-song-btn" data-song-id="${song.id}">Delete</button>
          ` : ''}
        </div>
      </div>
    `;
  
    const viewDetailsBtn = div.querySelector(".view-song-details-catalog-btn");
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener("click", () => {
        openSongDetailsModal(song);
      });
    }
    
    const editBtn = div.querySelector(".edit-song-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        openSongEditModal(song.id);
      });
    }
    
    const deleteBtn = div.querySelector(".delete-song-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        deleteSong(song.id);
      });
    }
    
    list.appendChild(div);
  });
}

async function openSongEditModal(songId = null) {
  if (!isManager()) return;
  const modal = el("song-edit-modal");
  const title = el("song-edit-modal-title");
  const form = el("song-edit-form");
  
  // Check if song modal is already open (for stacking)
  const songModalOpen = !el("song-modal").classList.contains("hidden");
  
  if (songId) {
    const song = state.songs.find(s => s.id === songId);
    if (song) {
      title.textContent = "Edit Song";
      el("song-edit-title").value = song.title || "";
      el("song-edit-bpm").value = song.bpm || "";
      el("song-edit-time-signature").value = song.time_signature || "";
      el("song-edit-duration").value = song.duration_seconds ? formatDuration(song.duration_seconds) : "";
      el("song-edit-description").value = song.description || "";
      form.dataset.songId = songId;
      
      // Load song keys and links
      const { data: songData } = await supabase
        .from("songs")
        .select(`
          *,
          song_keys (
            id,
            key
          ),
          song_links (
            id,
            title,
            url,
            key,
            display_order
          )
        `)
        .eq("id", songId)
        .single();
      
      if (songData) {
        renderSongKeys(songData.song_keys || []);
        renderSongLinks(songData.song_links || []);
      } else {
        renderSongKeys([]);
        renderSongLinks([]);
      }
    }
  } else {
    title.textContent = "New Song";
    form.reset();
    delete form.dataset.songId;
    renderSongKeys([]);
    renderSongLinks([]);
  }
  
  modal.classList.remove("hidden");
  // Only set body overflow if song modal isn't already open
  if (!songModalOpen) {
    document.body.style.overflow = "hidden";
  }
}

function closeSongEditModal() {
  const modal = el("song-edit-modal");
  modal.classList.add("hidden");
  
  // Check if song modal is still open
  const songModalOpen = !el("song-modal").classList.contains("hidden");
  
  // Only reset body overflow if no other modals are open
  if (!songModalOpen) {
    document.body.style.overflow = "";
  }
  
  el("song-edit-form").reset();
  delete el("song-edit-form").dataset.songId;
  el("song-links-list").innerHTML = "";
  el("song-keys-list").innerHTML = "";
  
  // Reset creatingSongFromModal if cancelled (not saved)
  // This will be set to false in handleSongEditSubmit if saved successfully
  if (state.creatingSongFromModal) {
    state.creatingSongFromModal = false;
  }
}

async function openSongDetailsModal(song, selectedKey = null) {
  if (!song) return;
  
  const modal = el("song-details-modal");
  const content = el("song-details-content");
  const title = el("song-details-title");
  
  if (!modal || !content) return;
  
  // Track which song is open
  state.currentSongDetailsId = song.id;
  
  title.textContent = song.title || "Song Details";
  
  // Fetch song with keys and links
  let songWithLinks = song;
  if (!song.song_links || !song.song_keys) {
    const { data } = await supabase
      .from("songs")
      .select(`
        *,
        song_keys (
          id,
          key
        ),
        song_links (
          id,
          title,
          url,
          key,
          display_order,
          file_path,
          file_name,
          file_type,
          is_file_upload
        )
      `)
      .eq("id", song.id)
      .single();
    
    if (data) {
      songWithLinks = data;
    }
  }
  
  // Ensure links are ordered by display_order for consistent rendering
  if (songWithLinks && Array.isArray(songWithLinks.song_links)) {
    songWithLinks.song_links = [...songWithLinks.song_links].sort((a, b) => {
      const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
      const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
      if (ao !== bo) return ao - bo;
      const at = (a?.title || "").toLowerCase();
      const bt = (b?.title || "").toLowerCase();
      return at.localeCompare(bt);
    });
  }
  
  // Organize links by key
  const generalLinks = (songWithLinks.song_links || []).filter(link => !link.key);
  const selectedKeyLinks = selectedKey 
    ? (songWithLinks.song_links || []).filter(link => link.key === selectedKey)
    : [];
  const otherKeysLinks = selectedKey
    ? (songWithLinks.song_links || []).filter(link => link.key && link.key !== selectedKey)
    : (songWithLinks.song_links || []).filter(link => link.key);
  
  // Group other keys links by key
  const linksByKey = {};
  otherKeysLinks.forEach(link => {
    if (!linksByKey[link.key]) {
      linksByKey[link.key] = [];
    }
    linksByKey[link.key].push(link);
  });
  
  const hasLinks = (songWithLinks.song_links || []).length > 0;
  const hasKeys = (songWithLinks.song_keys || []).length > 0;
  
  // Render all song information in an expanded view
    content.innerHTML = `
      <div class="song-details-section">
        <h2 class="song-details-title">${escapeHtml(songWithLinks.title || "Untitled")}</h2>
        
        <div class="song-details-meta">
          ${songWithLinks.bpm ? `<div class="detail-item">
            <span class="detail-label">BPM</span>
            <span class="detail-value">${songWithLinks.bpm}</span>
          </div>` : ''}
          ${hasKeys ? `<div class="detail-item">
            <span class="detail-label">Keys</span>
            <span class="detail-value">${(songWithLinks.song_keys || []).map(k => escapeHtml(k.key)).join(", ")}</span>
          </div>` : ''}
          ${selectedKey ? `<div class="detail-item">
            <span class="detail-label">Selected Key</span>
            <span class="detail-value">${escapeHtml(selectedKey)}</span>
          </div>` : ''}
          ${songWithLinks.time_signature ? `<div class="detail-item">
            <span class="detail-label">Time Signature</span>
            <span class="detail-value">${escapeHtml(songWithLinks.time_signature)}</span>
          </div>` : ''}
          ${songWithLinks.duration_seconds ? `<div class="detail-item">
            <span class="detail-label">Duration</span>
            <span class="detail-value">${formatDuration(songWithLinks.duration_seconds)}</span>
          </div>` : ''}
        </div>
        
        ${songWithLinks.bpm ? `
        <div class="song-click-track">
          <div class="song-click-track-info">
            <p class="song-click-track-title"><i class="fa-solid fa-drum"></i> Click Track</p>
            <p class="song-click-track-description">Set to ${songWithLinks.bpm} BPM</p>
          </div>
          <button class="btn primary click-track-btn" data-bpm="${songWithLinks.bpm}" title="Click Track">
            ${state.metronome.isPlaying && state.metronome.bpm === songWithLinks.bpm 
              ? `<i class="fa-solid fa-pause"></i> Stop` 
              : `<i class="fa-solid fa-play"></i> Click`}
          </button>
        </div>
        ` : ''}
        
        ${songWithLinks.description ? `
        <div class="song-details-section">
          <h3 class="section-title">Description</h3>
          <p class="song-details-description">${escapeHtml(songWithLinks.description)}</p>
        </div>
        ` : ''}
        
        ${hasLinks ? `
        <div class="song-details-section">
          <h3 class="section-title" style="margin-top:1.25rem;">Resources & Links</h3>
          <div class="song-details-links"></div>
        </div>
        ` : ''}
      </div>
    `;
  
  // Render links organized by key
    if (hasLinks) {
      const linksContainer = content.querySelector(".song-details-links");
      if (linksContainer) {
        // Render general links
        if (generalLinks.length > 0) {
          const generalSection = document.createElement("div");
          generalSection.style.marginBottom = "1.5rem";
          const generalTitle = document.createElement("h4");
          generalTitle.className = "section-subtitle";
          generalTitle.textContent = "General";
          generalTitle.style.marginBottom = "0.5rem";
          generalSection.appendChild(generalTitle);
          const generalLinksContainer = document.createElement("div");
          renderSongLinksDisplay(generalLinks, generalLinksContainer);
          generalSection.appendChild(generalLinksContainer);
          linksContainer.appendChild(generalSection);
        }
        
        // Render selected key links
        if (selectedKey && selectedKeyLinks.length > 0) {
          const selectedSection = document.createElement("div");
          selectedSection.style.marginBottom = "1.5rem";
          const selectedTitle = document.createElement("h4");
          selectedTitle.className = "section-subtitle";
          selectedTitle.textContent = `Key: ${escapeHtml(selectedKey)}`;
          selectedTitle.style.marginBottom = "0.5rem";
          selectedSection.appendChild(selectedTitle);
          const selectedLinksContainer = document.createElement("div");
          renderSongLinksDisplay(selectedKeyLinks, selectedLinksContainer);
          selectedSection.appendChild(selectedLinksContainer);
          linksContainer.appendChild(selectedSection);
        }
        
        // Render other keys links
        if (Object.keys(linksByKey).length > 0) {
          const otherKeysSection = document.createElement("div");
          const otherKeysHeader = document.createElement("div");
          otherKeysHeader.style.display = "flex";
          otherKeysHeader.style.alignItems = "center";
          otherKeysHeader.style.gap = "0.5rem";
          otherKeysHeader.style.cursor = "pointer";
          otherKeysHeader.style.marginBottom = "0.5rem";
          
          const otherKeysTitle = document.createElement("h4");
          otherKeysTitle.className = "section-subtitle";
          otherKeysTitle.textContent = "Other Keys";
          otherKeysTitle.style.margin = "0";
          
          const toggleIcon = document.createElement("i");
          toggleIcon.className = "fa-solid fa-chevron-down";
          toggleIcon.style.transition = "transform 0.2s";
          
          otherKeysHeader.appendChild(otherKeysTitle);
          otherKeysHeader.appendChild(toggleIcon);
          
          const otherKeysContent = document.createElement("div");
          otherKeysContent.style.display = selectedKey ? "none" : "block";
          if (selectedKey) {
            toggleIcon.style.transform = "rotate(-90deg)";
          }
          
          // Render links for each key
          Object.keys(linksByKey).sort().forEach(key => {
            const keySection = document.createElement("div");
            keySection.style.marginBottom = "1rem";
            const keyTitle = document.createElement("h5");
            keyTitle.className = "section-subtitle";
            keyTitle.textContent = `Key: ${escapeHtml(key)}`;
            keyTitle.style.marginBottom = "0.5rem";
            keyTitle.style.fontSize = "0.9rem";
            keySection.appendChild(keyTitle);
            const keyLinksContainer = document.createElement("div");
            renderSongLinksDisplay(linksByKey[key], keyLinksContainer);
            keySection.appendChild(keyLinksContainer);
            otherKeysContent.appendChild(keySection);
          });
          
          otherKeysHeader.addEventListener("click", () => {
            const isHidden = otherKeysContent.style.display === "none";
            otherKeysContent.style.display = isHidden ? "block" : "none";
            toggleIcon.style.transform = isHidden ? "rotate(0deg)" : "rotate(-90deg)";
          });
          
          otherKeysSection.appendChild(otherKeysHeader);
          otherKeysSection.appendChild(otherKeysContent);
          linksContainer.appendChild(otherKeysSection);
        }
      }
    }
    
    const modalClickTrackBtn = content.querySelector(".song-click-track .click-track-btn");
    if (modalClickTrackBtn) {
      modalClickTrackBtn.addEventListener("click", () => {
        const bpm = parseInt(modalClickTrackBtn.dataset.bpm, 10);
        toggleMetronome(bpm);
        updateClickTrackButtons();
      });
    }
    
    updateClickTrackButtons();
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  // Close on outside click
  const handleOutsideClick = (e) => {
    if (e.target === modal) {
      closeSongDetailsModal();
      modal.removeEventListener("click", handleOutsideClick);
    }
  };
  modal.addEventListener("click", handleOutsideClick);
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeSongDetailsModal();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function closeSongDetailsModal() {
  const modal = el("song-details-modal");
  if (modal) {
    // Stop all audio players in the modal
    const audioPlayers = modal.querySelectorAll("audio");
    audioPlayers.forEach(audio => {
      audio.pause();
      audio.currentTime = 0; // Reset to beginning
    });
    
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    state.currentSongDetailsId = null;
  }
}

async function openSectionDetailsModal(setSong) {
  if (!setSong) return;
  
  const modal = el("song-details-modal");
  const content = el("song-details-content");
  const title = el("song-details-title");
  
  if (!modal || !content) return;
  
  title.textContent = setSong.title || "Section Details";
  
  // Fetch section with links and assignments
  let sectionWithData = setSong;
  if (!setSong.song_links || !setSong.song_assignments) {
    const { data } = await supabase
      .from("set_songs")
      .select(`
        *,
        song_links (
          id,
          title,
          url,
          key,
          display_order,
          file_path,
          file_name,
          file_type,
          is_file_upload
        ),
        song_assignments (
          id,
          person_id,
          person_name,
          person_email,
          pending_invite_id,
          role,
          status,
          person:person_id (
            id,
            full_name
          ),
          pending_invite:pending_invite_id (
            id,
            full_name,
            email
          )
        )
      `)
      .eq("id", setSong.id)
      .single();
    
    if (data) {
      sectionWithData = data;
    }
  }
  
  // Ensure links are ordered by display_order
  if (sectionWithData && Array.isArray(sectionWithData.song_links)) {
    sectionWithData.song_links = [...sectionWithData.song_links].sort((a, b) => {
      const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
      const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
      if (ao !== bo) return ao - bo;
      const at = (a?.title || "").toLowerCase();
      const bt = (b?.title || "").toLowerCase();
      return at.localeCompare(bt);
    });
  }
  
  const hasLinks = (sectionWithData.song_links || []).length > 0;
  const hasAssignments = (sectionWithData.song_assignments || []).length > 0;
  const plannedDurationSeconds = getSetSongDurationSeconds(sectionWithData);
  const durationLabel = plannedDurationSeconds !== undefined && plannedDurationSeconds !== null
    ? formatDuration(plannedDurationSeconds)
    : null;
  
  // Render all section information
  content.innerHTML = `
    <div class="song-details-section">
      <h2 class="song-details-title">${escapeHtml(sectionWithData.title || "Untitled Section")}</h2>
      
      <div class="song-details-meta">
        ${durationLabel ? `<div class="detail-item">
          <span class="detail-label">Duration</span>
          <span class="detail-value">${durationLabel}</span>
        </div>` : ''}
      </div>
      
      ${sectionWithData.description ? `
      <div class="song-details-section">
        <h3 class="section-title">Description</h3>
        <p class="song-details-description">${escapeHtml(sectionWithData.description)}</p>
      </div>
      ` : ''}
      
      ${sectionWithData.notes ? `
      <div class="song-details-section">
        <h3 class="section-title">Notes</h3>
        <p class="song-details-description">${escapeHtml(sectionWithData.notes)}</p>
      </div>
      ` : ''}
      
      ${hasAssignments ? `
      <div class="song-details-section">
        <h3 class="section-title">Assignments</h3>
        <div class="song-details-assignments"></div>
      </div>
      ` : ''}
      
      ${hasLinks ? `
      <div class="song-details-section">
        <h3 class="section-title" style="margin-top:1.25rem;">Resources & Links</h3>
        <div class="song-details-links"></div>
      </div>
      ` : ''}
    </div>
  `;
  
  // Render assignments
  if (hasAssignments) {
    const assignmentsContainer = content.querySelector(".song-details-assignments");
    if (assignmentsContainer) {
      sectionWithData.song_assignments.forEach((assignment) => {
        const assignmentDiv = document.createElement("div");
        assignmentDiv.style.marginBottom = "0.75rem";
        assignmentDiv.style.padding = "0.75rem";
        assignmentDiv.style.border = "1px solid var(--border-color)";
        assignmentDiv.style.borderRadius = "0.5rem";
        
        const role = document.createElement("div");
        role.style.fontWeight = "600";
        role.style.marginBottom = "0.25rem";
        role.textContent = assignment.role || "Unassigned";
        
        const person = document.createElement("div");
        person.style.color = "var(--text-secondary)";
        if (assignment.person) {
          person.textContent = assignment.person.full_name || "Unknown";
        } else if (assignment.pending_invite) {
          person.textContent = `${assignment.pending_invite.full_name || assignment.pending_invite.email || "Unknown"} (Pending)`;
        } else if (assignment.person_name) {
          person.textContent = assignment.person_name;
        } else {
          person.textContent = "Unassigned";
        }
        
        assignmentDiv.appendChild(role);
        assignmentDiv.appendChild(person);
        assignmentsContainer.appendChild(assignmentDiv);
      });
    }
  }
  
  // Render links
  if (hasLinks) {
    const linksContainer = content.querySelector(".song-details-links");
    if (linksContainer) {
      const generalLinks = (sectionWithData.song_links || []).filter(link => !link.key);
      if (generalLinks.length > 0) {
        const generalSection = document.createElement("div");
        generalSection.style.marginBottom = "1.5rem";
        const generalTitle = document.createElement("h4");
        generalTitle.className = "section-subtitle";
        generalTitle.textContent = "General";
        generalTitle.style.marginBottom = "0.5rem";
        generalSection.appendChild(generalTitle);
        const generalLinksContainer = document.createElement("div");
        renderSongLinksDisplay(generalLinks, generalLinksContainer);
        generalSection.appendChild(generalLinksContainer);
        linksContainer.appendChild(generalSection);
      }
    }
  }
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  // Close on outside click
  const handleOutsideClick = (e) => {
    if (e.target === modal) {
      closeSongDetailsModal();
      modal.removeEventListener("click", handleOutsideClick);
    }
  };
  modal.addEventListener("click", handleOutsideClick);
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeSongDetailsModal();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function updateLinkSections() {
  // Re-render links when keys change to show new key sections
  const links = collectSongLinks();
  renderSongLinks(links);
}

function renderSongKeys(keys) {
  const container = el("song-keys-list");
  if (!container) return;
  
  container.innerHTML = "";
  
  keys.forEach((keyItem, index) => {
    const div = document.createElement("div");
    div.className = "song-key-row";
    div.dataset.keyId = keyItem.id || `new-${index}`;
    div.innerHTML = `
      <input type="text" class="song-key-input" placeholder="C, Dm, G, etc" value="${escapeHtml(keyItem.key || '')}" required />
      ${keyItem.id ? `<input type="hidden" class="song-key-id" value="${keyItem.id}" />` : ''}
      <button type="button" class="btn small ghost remove-song-key">Remove</button>
    `;
    
    const removeBtn = div.querySelector(".remove-song-key");
    removeBtn.addEventListener("click", () => {
      container.removeChild(div);
      updateLinkSections();
    });
    
    const keyInput = div.querySelector(".song-key-input");
    // Use a debounced input handler to avoid too many re-renders
    let inputTimeout;
    keyInput.addEventListener("input", () => {
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        updateLinkSections();
      }, 300);
    });
    
    // Also update on blur (when user finishes typing)
    keyInput.addEventListener("blur", () => {
      clearTimeout(inputTimeout);
      updateLinkSections();
    });
    
    container.appendChild(div);
  });
  
  updateLinkSections();
}

function addSongKeyInput() {
  const container = el("song-keys-list");
  if (!container) return;
  
  const div = document.createElement("div");
  div.className = "song-key-row";
  div.dataset.keyId = `new-${Date.now()}`;
  div.innerHTML = `
    <input type="text" class="song-key-input" placeholder="C, Dm, G, etc" required />
    <button type="button" class="btn small ghost remove-song-key">Remove</button>
  `;
  
  const removeBtn = div.querySelector(".remove-song-key");
  removeBtn.addEventListener("click", () => {
    container.removeChild(div);
    updateLinkSections();
  });
  
  const keyInput = div.querySelector(".song-key-input");
  // Use a debounced input handler to avoid too many re-renders
  let inputTimeout;
  keyInput.addEventListener("input", () => {
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
      updateLinkSections();
    }, 300);
  });
  
  // Also update on blur (when user finishes typing)
  keyInput.addEventListener("blur", () => {
    clearTimeout(inputTimeout);
    updateLinkSections();
  });
  
  container.appendChild(div);
  keyInput.focus();
  // Update immediately when adding a new key
  updateLinkSections();
}

function collectSongKeys() {
  const container = el("song-keys-list");
  if (!container) return [];
  
  const rows = Array.from(container.querySelectorAll(".song-key-row"));
  const keys = [];
  
  rows.forEach((row) => {
    const keyInput = row.querySelector(".song-key-input");
    const idInput = row.querySelector(".song-key-id");
    
    const key = keyInput?.value.trim();
    const id = idInput?.value;
    
    if (key) {
      keys.push({
        id: id || null,
        key: key,
      });
    }
  });
  
  return keys;
}

// ============================================================================
// Supabase Storage File Upload Functions
// ============================================================================
// NOTE: Before using file uploads, create a Supabase Storage bucket:
// 1. Go to Supabase Dashboard > Storage
// 2. Create a new bucket named "song-resources"
// 3. Set it to private (not public)
// 4. Configure policies:
//    - INSERT: Users can upload to their team's folder
//    - SELECT: Team members can read files from their team's folders
//    - DELETE: Managers can delete files, users can delete their own uploads

const STORAGE_BUCKET = 'song-resources';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

// Validate file size (20MB limit)
function validateFileSize(file) {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 20MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }
  return { valid: true };
}

// Get MIME type from file
function getFileType(file) {
  return file.type || 'application/octet-stream';
}

// Generate file path for Supabase Storage
function generateFilePath(teamId, songId, setSongId, fileName) {
  const uuid = crypto.randomUUID();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const extension = fileName.split('.').pop();
  const uniqueFileName = `${uuid}-${timestamp}.${extension}`;
  
  if (songId) {
    return `${teamId}/songs/${songId}/${uniqueFileName}`;
  } else if (setSongId) {
    return `${teamId}/sections/${setSongId}/${uniqueFileName}`;
  }
  throw new Error('Either songId or setSongId must be provided');
}

// Upload file to Supabase Storage
async function uploadFileToSupabase(file, songId, setSongId, teamId) {
  try {
    // Validate file size
    const validation = validateFileSize(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Generate file path
    const filePath = generateFilePath(teamId, songId, setSongId, file.name);
    
    // Upload file
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('File upload error:', error);
      return { success: false, error: error.message };
    }
    
    return {
      success: true,
      filePath: data.path,
      fileName: file.name,
      fileType: getFileType(file)
    };
  } catch (error) {
    console.error('File upload exception:', error);
    return { success: false, error: error.message || 'Failed to upload file' };
  }
}

// Delete file from Supabase Storage
async function deleteFileFromSupabase(filePath) {
  if (!filePath) return { success: true };
  
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);
    
    if (error) {
      console.error('File deletion error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error('File deletion exception:', error);
    return { success: false, error: error.message || 'Failed to delete file' };
  }
}

// Get signed URL for file access (valid for 1 hour)
async function getFileUrl(filePath) {
  if (!filePath) {
    console.error('getFileUrl called with null/undefined filePath');
    return null;
  }
  
  try {
    console.log('Generating signed URL for:', filePath);
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Error creating signed URL:', error);
      console.error('File path was:', filePath);
      return null;
    }
    
    if (!data || !data.signedUrl) {
      console.error('No signed URL returned from Supabase');
      return null;
    }
    
    console.log('Successfully generated signed URL');
    return data.signedUrl;
  } catch (error) {
    console.error('Exception creating signed URL:', error);
    return null;
  }
}

// Format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Check if a file is an audio file
function isAudioFile(fileType, fileName) {
  if (!fileType && !fileName) return false;
  
  const audioMimeTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
    'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac',
    'audio/flac', 'audio/x-flac', 'audio/opus'
  ];
  
  if (fileType) {
    const lowerType = fileType.toLowerCase();
    if (audioMimeTypes.some(type => lowerType.includes(type) || lowerType === type)) {
      return true;
    }
  }
  
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const audioExtensions = ['mp3', 'm4a', 'wav', 'ogg', 'webm', 'aac', 'flac', 'opus'];
    return audioExtensions.includes(ext);
  }
  
  return false;
}

// ============================================================================
// Song Links Functions
// ============================================================================

function renderSongLinks(links) {
  const container = el("song-links-list");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Ensure stable ordering (DB fetch does not order by display_order)
  const sortedLinks = (Array.isArray(links) ? [...links] : []).sort((a, b) => {
    const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
    const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
    if (ao !== bo) return ao - bo;
    const at = (a?.title || "").toLowerCase();
    const bt = (b?.title || "").toLowerCase();
    return at.localeCompare(bt);
  });
  
  // Get available keys
  const keys = collectSongKeys();
  
  // Group links by key
  const generalLinks = sortedLinks.filter(link => !link.key);
  const linksByKey = {};
  sortedLinks.forEach(link => {
    if (link.key) {
      if (!linksByKey[link.key]) {
        linksByKey[link.key] = [];
      }
      linksByKey[link.key].push(link);
    }
  });
  
  // Render General Links section
  const generalSection = document.createElement("div");
  generalSection.className = "song-links-section";
  generalSection.dataset.key = "";
  const generalHeader = document.createElement("div");
  generalHeader.className = "song-links-section-header";
  generalHeader.innerHTML = `
    <h4>General Links</h4>
    <div style="display: flex; gap: 0.5rem;">
      <button type="button" class="btn small secondary add-link-to-section" data-key="">Add Link</button>
      <button type="button" class="btn small secondary add-file-upload-to-section" data-key="">Upload</button>
    </div>
  `;
  generalSection.appendChild(generalHeader);
  const generalLinksContainer = document.createElement("div");
  generalLinksContainer.className = "song-links-section-content";
  generalLinks.forEach((link, index) => {
    const linkRow = createLinkRow(link, index, "");
    generalLinksContainer.appendChild(linkRow);
    if (isManager()) setupLinkDragAndDrop(linkRow, generalLinksContainer);
  });
  generalSection.appendChild(generalLinksContainer);
  container.appendChild(generalSection);
  
  // Render section for each key
  keys.forEach(keyItem => {
    const key = keyItem.key;
    const keyLinks = linksByKey[key] || [];
    
    const keySection = document.createElement("div");
    keySection.className = "song-links-section";
    keySection.dataset.key = key;
    const keyHeader = document.createElement("div");
    keyHeader.className = "song-links-section-header";
    keyHeader.innerHTML = `
      <h4>Key: ${escapeHtml(key)}</h4>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn small secondary add-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
      </div>
    `;
    keySection.appendChild(keyHeader);
    const keyLinksContainer = document.createElement("div");
    keyLinksContainer.className = "song-links-section-content";
    keyLinks.forEach((link, index) => {
      const linkRow = createLinkRow(link, index, key);
      keyLinksContainer.appendChild(linkRow);
      if (isManager()) setupLinkDragAndDrop(linkRow, keyLinksContainer);
    });
    keySection.appendChild(keyLinksContainer);
    container.appendChild(keySection);
  });
  
  // Add event listeners for "Add Link" buttons
  container.querySelectorAll(".add-link-to-section").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key || "";
      addSongLinkToSection(key);
    });
  });
  
  // Add event listeners for "Upload" buttons
  container.querySelectorAll(".add-file-upload-to-section").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key || "";
      addFileUploadToSection(key);
    });
  });
  
  // Normalize data-display-order across all sections after render
  updateAllLinkOrderInDom();
}

function createLinkRow(link, index, key) {
  const div = document.createElement("div");
  div.className = "song-link-row draggable-item";
  // Match song/section reorder behavior: only draggable when grabbed by handle
  div.draggable = false;
  div.dataset.linkId = link.id || `new-${Date.now()}-${index}`;
  div.dataset.displayOrder = link.display_order || index;
  div.dataset.key = key;
  div.dataset.isFileUpload = link.is_file_upload ? 'true' : 'false';
  
  const isFileUpload = link.is_file_upload || false;
  
  if (isFileUpload) {
    // File upload row
    div.innerHTML = `
      ${isManager() ? '<div class="drag-handle" title="Drag to reorder">⋮⋮</div>' : ''}
      <label>
        Title
        <input type="text" class="song-link-title-input" placeholder="File name" value="${escapeHtml(link.title || link.file_name || '')}" required />
      </label>
      <label style="flex: 1; min-width: 200px;">
        File
        <div class="file-upload-display">
          ${link.file_name ? `
            <div class="file-info">
              <span class="file-name">${escapeHtml(link.file_name)}</span>
              ${link.file_type ? `<span class="file-type">${escapeHtml(link.file_type)}</span>` : ''}
            </div>
          ` : `
            <input type="file" class="song-link-file-input" accept="*/*" />
            <div class="file-upload-status"></div>
          `}
        </div>
      </label>
      ${link.id ? `<input type="hidden" class="song-link-id" value="${link.id}" />` : ''}
      ${link.file_path ? `<input type="hidden" class="song-link-file-path" value="${escapeHtml(link.file_path)}" />` : ''}
      ${link.file_name ? `<input type="hidden" class="song-link-file-name" value="${escapeHtml(link.file_name)}" />` : ''}
      ${link.file_type ? `<input type="hidden" class="song-link-file-type" value="${escapeHtml(link.file_type)}" />` : ''}
      <input type="hidden" class="song-link-is-file-upload" value="true" />
      <input type="hidden" class="song-link-key" value="${escapeHtml(key)}" />
      <button type="button" class="btn small ghost remove-song-link">Remove</button>
    `;
    
    // Add file input change handler if it's a new file upload
    const fileInput = div.querySelector(".song-link-file-input");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          const statusDiv = div.querySelector(".file-upload-status");
          statusDiv.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
          statusDiv.style.color = "var(--text-secondary)";
          
          // Validate file size
          const validation = validateFileSize(file);
          if (!validation.valid) {
            statusDiv.textContent = validation.error;
            statusDiv.style.color = "var(--error-color)";
            e.target.value = "";
            return;
          }
          
          // Update file name input
          const titleInput = div.querySelector(".song-link-title-input");
          if (titleInput && !titleInput.value) {
            titleInput.value = file.name;
          }
        }
      });
    }
  } else {
    // URL link row
    div.innerHTML = `
      ${isManager() ? '<div class="drag-handle" title="Drag to reorder">⋮⋮</div>' : ''}
      <label>
        Title
        <input type="text" class="song-link-title-input" placeholder="Recording" value="${escapeHtml(link.title || '')}" required />
      </label>
      <label>
        URL
        <input type="url" class="song-link-url-input" placeholder="https://..." value="${escapeHtml(link.url || '')}" required />
      </label>
      ${link.id ? `<input type="hidden" class="song-link-id" value="${link.id}" />` : ''}
      <input type="hidden" class="song-link-is-file-upload" value="false" />
      <input type="hidden" class="song-link-key" value="${escapeHtml(key)}" />
      <button type="button" class="btn small ghost remove-song-link">Remove</button>
    `;
  }
  
  div.querySelector(".remove-song-link").addEventListener("click", async () => {
    // If it's a file upload, delete the file from storage
    if (isFileUpload) {
      // Get file_path from hidden input (in case link object doesn't have it)
      const filePathInput = div.querySelector(".song-link-file-path");
      const filePath = filePathInput?.value || link.file_path;
      if (filePath) {
        console.log('Deleting file from storage:', filePath);
        const result = await deleteFileFromSupabase(filePath);
        if (!result.success) {
          console.error('Failed to delete file:', result.error);
          toastError(`Failed to delete file: ${result.error}`);
        }
      }
    }
    
    const section = div.closest(".song-links-section");
    const sectionContent = section?.querySelector(".song-links-section-content");
    if (sectionContent) {
      sectionContent.removeChild(div);
      updateAllLinkOrderInDom();
    }
  });
  
  return div;
}

function addSongLinkInput() {
  // Add to general section by default
  addSongLinkToSection("");
}

function addSongLinkToSection(key) {
  const container = el("song-links-list");
  if (!container) return;
  
  // Find the section for this key
  let section = container.querySelector(`[data-key="${key}"]`);
  if (!section) {
    // If section doesn't exist, create it
    section = document.createElement("div");
    section.className = "song-links-section";
    section.dataset.key = key;
    const sectionHeader = document.createElement("div");
    sectionHeader.className = "song-links-section-header";
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Links";
    sectionHeader.innerHTML = `
      <h4>${sectionTitle}</h4>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn small secondary add-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
      </div>
    `;
    section.appendChild(sectionHeader);
    const sectionContent = document.createElement("div");
    sectionContent.className = "song-links-section-content";
    section.appendChild(sectionContent);
    
    // Insert after general section or at the end
    const generalSection = container.querySelector('[data-key=""]');
    if (generalSection && !key) {
      container.insertBefore(section, generalSection);
    } else if (generalSection) {
      generalSection.insertAdjacentElement("afterend", section);
    } else {
      container.appendChild(section);
    }
    
    // Add event listeners for the new buttons
    sectionHeader.querySelector(".add-link-to-section").addEventListener("click", () => {
      addSongLinkToSection(key);
    });
    sectionHeader.querySelector(".add-file-upload-to-section").addEventListener("click", () => {
      addFileUploadToSection(key);
    });
  }
  
  const sectionContent = section.querySelector(".song-links-section-content");
  if (!sectionContent) return;
  
  const existingItems = sectionContent.querySelectorAll(".song-link-row");
  const nextOrder = existingItems.length;
  
  const linkRow = createLinkRow({ id: null, title: "", url: "", key: key, display_order: nextOrder, is_file_upload: false }, nextOrder, key);
  sectionContent.appendChild(linkRow);
  updateLinkOrder(sectionContent);
}

function addFileUploadToSection(key) {
  const container = el("song-links-list");
  if (!container) return;
  
  // Find the section for this key
  let section = container.querySelector(`[data-key="${key}"]`);
  if (!section) {
    // If section doesn't exist, create it
    section = document.createElement("div");
    section.className = "song-links-section";
    section.dataset.key = key;
    const sectionHeader = document.createElement("div");
    sectionHeader.className = "song-links-section-header";
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Links";
    sectionHeader.innerHTML = `
      <h4>${sectionTitle}</h4>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn small secondary add-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
      </div>
    `;
    section.appendChild(sectionHeader);
    const sectionContent = document.createElement("div");
    sectionContent.className = "song-links-section-content";
    section.appendChild(sectionContent);
    
    // Insert after general section or at the end
    const generalSection = container.querySelector('[data-key=""]');
    if (generalSection && !key) {
      container.insertBefore(section, generalSection);
    } else if (generalSection) {
      generalSection.insertAdjacentElement("afterend", section);
    } else {
      container.appendChild(section);
    }
    
    // Add event listeners for the new buttons
    sectionHeader.querySelector(".add-link-to-section").addEventListener("click", () => {
      addSongLinkToSection(key);
    });
    sectionHeader.querySelector(".add-file-upload-to-section").addEventListener("click", () => {
      addFileUploadToSection(key);
    });
  }
  
  const sectionContent = section.querySelector(".song-links-section-content");
  if (!sectionContent) return;
  
  const existingItems = sectionContent.querySelectorAll(".song-link-row");
  const nextOrder = existingItems.length;
  
  const linkRow = createLinkRow({ 
    id: null, 
    title: "", 
    url: null, 
    file_path: null,
    file_name: null,
    file_type: null,
    key: key, 
    display_order: nextOrder, 
    is_file_upload: true 
  }, nextOrder, key);
  sectionContent.appendChild(linkRow);
  updateLinkOrder(sectionContent);
}

function collectSongLinks() {
  const container = el("song-links-list");
  if (!container) return [];
  
  const links = [];
  let globalOrder = 0;
  
  // Collect links from all sections, maintaining section order
  const sections = Array.from(container.querySelectorAll(".song-links-section"));
  sections.forEach(section => {
    const sectionContent = section.querySelector(".song-links-section-content");
    if (!sectionContent) return;
    
    const rows = Array.from(sectionContent.querySelectorAll(".song-link-row"));
    rows.forEach((row) => {
      const titleInput = row.querySelector(".song-link-title-input");
      const urlInput = row.querySelector(".song-link-url-input");
      const fileInput = row.querySelector(".song-link-file-input");
      const keyInput = row.querySelector(".song-link-key");
      const idInput = row.querySelector(".song-link-id");
      const isFileUploadInput = row.querySelector(".song-link-is-file-upload");
      const filePathInput = row.querySelector(".song-link-file-path");
      const fileNameInput = row.querySelector(".song-link-file-name");
      const fileTypeInput = row.querySelector(".song-link-file-type");
      
      const title = titleInput?.value.trim();
      const key = keyInput?.value || null;
      const id = idInput?.value;
      const isFileUpload = isFileUploadInput?.value === 'true';
      
      if (isFileUpload) {
        // File upload - check if file is selected or already uploaded
        const file = fileInput?.files[0];
        const existingFilePath = filePathInput?.value;
        const existingFileName = fileNameInput?.value;
        const existingFileType = fileTypeInput?.value;
        
        console.log("Collecting file upload link:", {
          title,
          hasFile: !!file,
          file: file ? { name: file.name, size: file.size } : null,
          existingFilePath,
          existingFileName,
          existingFileType
        });
        
        // For file uploads, we need either:
        // 1. A title AND a file selected (new upload)
        // 2. A title AND an existing file path (existing upload)
        // 3. Just a file selected (we'll use the file name as title)
        if (file || existingFilePath) {
          // Use file name as title if title is empty
          const finalTitle = title || (file ? file.name : existingFileName) || 'Untitled';
          
          links.push({
            id: id || null,
            title: finalTitle,
            url: null,
            file_path: existingFilePath || null, // Will be set after upload
            file_name: existingFileName || (file ? file.name : null),
            file_type: existingFileType || (file ? getFileType(file) : null),
            is_file_upload: true,
            file: file || null, // Store file object for upload
            key: key || null,
            display_order: globalOrder++,
          });
        } else if (title) {
          // If there's a title but no file, still save it (file might be uploaded separately)
          // But this shouldn't happen in normal flow
          console.warn("File upload link has title but no file:", { title, row: row });
        } else {
          console.warn("File upload link skipped - no file and no title");
        }
      } else {
        // URL link
        const url = urlInput?.value.trim();
        if (title && url) {
          links.push({
            id: id || null,
            title,
            url,
            file_path: null,
            file_name: null,
            file_type: null,
            is_file_upload: false,
            key: key || null,
            display_order: globalOrder++,
          });
        }
      }
    });
  });
  
  return links;
}

// Section Links Functions (similar to song links but for set sections)
function renderSectionLinks(links, containerId = "section-links-list") {
  const container = el(containerId);
  if (!container) return;
  
  container.innerHTML = "";
  
  // Ensure stable ordering
  const sortedLinks = (Array.isArray(links) ? [...links] : []).sort((a, b) => {
    const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
    const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
    if (ao !== bo) return ao - bo;
    const at = (a?.title || "").toLowerCase();
    const bt = (b?.title || "").toLowerCase();
    return at.localeCompare(bt);
  });
  
  // Render General Links section (sections don't have keys)
  const generalSection = document.createElement("div");
  generalSection.className = "song-links-section";
  generalSection.dataset.key = "";
  const generalHeader = document.createElement("div");
  generalHeader.className = "song-links-section-header";
  generalHeader.innerHTML = `
    <h4>General Links</h4>
    <div style="display: flex; gap: 0.5rem;">
      <button type="button" class="btn small secondary add-section-link-to-section" data-key="">Add Link</button>
      <button type="button" class="btn small secondary add-section-file-upload-to-section" data-key="">Upload</button>
    </div>
  `;
  generalSection.appendChild(generalHeader);
  const generalLinksContainer = document.createElement("div");
  generalLinksContainer.className = "song-links-section-content";
  sortedLinks.forEach((link, index) => {
    const linkRow = createSectionLinkRow(link, index, "");
    generalLinksContainer.appendChild(linkRow);
    if (isManager()) setupLinkDragAndDrop(linkRow, generalLinksContainer);
  });
  generalSection.appendChild(generalLinksContainer);
  container.appendChild(generalSection);
  
  // Add event listeners for buttons
  generalHeader.querySelector(".add-section-link-to-section").addEventListener("click", () => {
    addSectionLinkToSection("", containerId);
  });
  generalHeader.querySelector(".add-section-file-upload-to-section").addEventListener("click", () => {
    addSectionFileUploadToSection("", containerId);
  });
  
  // Normalize data-display-order
  updateAllSectionLinkOrderInDom(containerId);
}

function createSectionLinkRow(link, index, key) {
  const div = document.createElement("div");
  div.className = "song-link-row draggable-item";
  div.draggable = false;
  div.dataset.linkId = link.id || `new-${Date.now()}-${index}`;
  div.dataset.displayOrder = link.display_order || index;
  div.dataset.key = key;
  div.dataset.isFileUpload = link.is_file_upload ? 'true' : 'false';
  
  const isFileUpload = link.is_file_upload || false;
  
  if (isFileUpload) {
    // File upload row
    div.innerHTML = `
      ${isManager() ? '<div class="drag-handle" title="Drag to reorder">⋮⋮</div>' : ''}
      <label>
        Title
        <input type="text" class="section-link-title-input" placeholder="File name" value="${escapeHtml(link.title || link.file_name || '')}" required />
      </label>
      <label style="flex: 1; min-width: 200px;">
        File
        <div class="file-upload-display">
          ${link.file_name ? `
            <div class="file-info">
              <span class="file-name">${escapeHtml(link.file_name)}</span>
              ${link.file_type ? `<span class="file-type">${escapeHtml(link.file_type)}</span>` : ''}
            </div>
          ` : `
            <input type="file" class="section-link-file-input" accept="*/*" />
            <div class="file-upload-status"></div>
          `}
        </div>
      </label>
      ${link.id ? `<input type="hidden" class="section-link-id" value="${link.id}" />` : ''}
      ${link.file_path ? `<input type="hidden" class="section-link-file-path" value="${escapeHtml(link.file_path)}" />` : ''}
      ${link.file_name ? `<input type="hidden" class="section-link-file-name" value="${escapeHtml(link.file_name)}" />` : ''}
      ${link.file_type ? `<input type="hidden" class="section-link-file-type" value="${escapeHtml(link.file_type)}" />` : ''}
      <input type="hidden" class="section-link-is-file-upload" value="true" />
      <input type="hidden" class="section-link-key" value="${escapeHtml(key)}" />
      <button type="button" class="btn small ghost remove-section-link">Remove</button>
    `;
    
    // Add file input change handler if it's a new file upload
    const fileInput = div.querySelector(".section-link-file-input");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          const statusDiv = div.querySelector(".file-upload-status");
          statusDiv.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
          statusDiv.style.color = "var(--text-secondary)";
          
          // Validate file size
          const validation = validateFileSize(file);
          if (!validation.valid) {
            statusDiv.textContent = validation.error;
            statusDiv.style.color = "var(--error-color)";
            e.target.value = "";
            return;
          }
          
          // Update file name input
          const titleInput = div.querySelector(".section-link-title-input");
          if (titleInput && !titleInput.value) {
            titleInput.value = file.name;
          }
        }
      });
    }
  } else {
    // URL link row
    div.innerHTML = `
      ${isManager() ? '<div class="drag-handle" title="Drag to reorder">⋮⋮</div>' : ''}
      <label>
        Title
        <input type="text" class="section-link-title-input" placeholder="Recording" value="${escapeHtml(link.title || '')}" required />
      </label>
      <label>
        URL
        <input type="url" class="section-link-url-input" placeholder="https://..." value="${escapeHtml(link.url || '')}" required />
      </label>
      ${link.id ? `<input type="hidden" class="section-link-id" value="${link.id}" />` : ''}
      <input type="hidden" class="section-link-is-file-upload" value="false" />
      <input type="hidden" class="section-link-key" value="${escapeHtml(key)}" />
      <button type="button" class="btn small ghost remove-section-link">Remove</button>
    `;
  }
  
  div.querySelector(".remove-section-link").addEventListener("click", async () => {
    // If it's a file upload, delete the file from storage
    if (isFileUpload) {
      // Get file_path from hidden input (in case link object doesn't have it)
      const filePathInput = div.querySelector(".section-link-file-path");
      const filePath = filePathInput?.value || link.file_path;
      if (filePath) {
        console.log('Deleting file from storage:', filePath);
        const result = await deleteFileFromSupabase(filePath);
        if (!result.success) {
          console.error('Failed to delete file:', result.error);
          toastError(`Failed to delete file: ${result.error}`);
        }
      }
    }
    
    const section = div.closest(".song-links-section");
    const sectionContent = section?.querySelector(".song-links-section-content");
    if (sectionContent) {
      sectionContent.removeChild(div);
      updateAllSectionLinkOrderInDom(div.closest('[id*="links-list"]')?.id || "section-links-list");
    }
  });
  
  return div;
}

function addSectionLinkToSection(key, containerId = "section-links-list") {
  const container = el(containerId);
  if (!container) return;
  
  // Find the section for this key
  let section = container.querySelector(`[data-key="${key}"]`);
  if (!section) {
    // If section doesn't exist, create it
    section = document.createElement("div");
    section.className = "song-links-section";
    section.dataset.key = key;
    const sectionHeader = document.createElement("div");
    sectionHeader.className = "song-links-section-header";
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Links";
    sectionHeader.innerHTML = `
      <h4>${sectionTitle}</h4>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn small secondary add-section-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-section-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
      </div>
    `;
    section.appendChild(sectionHeader);
    const sectionContent = document.createElement("div");
    sectionContent.className = "song-links-section-content";
    section.appendChild(sectionContent);
    
    // Insert after general section or at the end
    const generalSection = container.querySelector('[data-key=""]');
    if (generalSection && !key) {
      container.insertBefore(section, generalSection);
    } else if (generalSection) {
      generalSection.insertAdjacentElement("afterend", section);
    } else {
      container.appendChild(section);
    }
    
    // Add event listeners for the new buttons
    sectionHeader.querySelector(".add-section-link-to-section").addEventListener("click", () => {
      addSectionLinkToSection(key, containerId);
    });
    sectionHeader.querySelector(".add-section-file-upload-to-section").addEventListener("click", () => {
      addSectionFileUploadToSection(key, containerId);
    });
  }
  
  const sectionContent = section.querySelector(".song-links-section-content");
  if (!sectionContent) return;
  
  const existingItems = sectionContent.querySelectorAll(".song-link-row");
  const nextOrder = existingItems.length;
  
  const linkRow = createSectionLinkRow({ id: null, title: "", url: "", key: key, display_order: nextOrder, is_file_upload: false }, nextOrder, key);
  sectionContent.appendChild(linkRow);
  updateSectionLinkOrder(sectionContent, containerId);
}

function addSectionFileUploadToSection(key, containerId = "section-links-list") {
  const container = el(containerId);
  if (!container) return;
  
  // Find the section for this key
  let section = container.querySelector(`[data-key="${key}"]`);
  if (!section) {
    // If section doesn't exist, create it
    section = document.createElement("div");
    section.className = "song-links-section";
    section.dataset.key = key;
    const sectionHeader = document.createElement("div");
    sectionHeader.className = "song-links-section-header";
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Links";
    sectionHeader.innerHTML = `
      <h4>${sectionTitle}</h4>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn small secondary add-section-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-section-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
      </div>
    `;
    section.appendChild(sectionHeader);
    const sectionContent = document.createElement("div");
    sectionContent.className = "song-links-section-content";
    section.appendChild(sectionContent);
    
    // Insert after general section or at the end
    const generalSection = container.querySelector('[data-key=""]');
    if (generalSection && !key) {
      container.insertBefore(section, generalSection);
    } else if (generalSection) {
      generalSection.insertAdjacentElement("afterend", section);
    } else {
      container.appendChild(section);
    }
    
    // Add event listeners for the new buttons
    sectionHeader.querySelector(".add-section-link-to-section").addEventListener("click", () => {
      addSectionLinkToSection(key, containerId);
    });
    sectionHeader.querySelector(".add-section-file-upload-to-section").addEventListener("click", () => {
      addSectionFileUploadToSection(key, containerId);
    });
  }
  
  const sectionContent = section.querySelector(".song-links-section-content");
  if (!sectionContent) return;
  
  const existingItems = sectionContent.querySelectorAll(".song-link-row");
  const nextOrder = existingItems.length;
  
  const linkRow = createSectionLinkRow({ 
    id: null, 
    title: "", 
    url: null, 
    file_path: null,
    file_name: null,
    file_type: null,
    key: key, 
    display_order: nextOrder, 
    is_file_upload: true 
  }, nextOrder, key);
  sectionContent.appendChild(linkRow);
  updateSectionLinkOrder(sectionContent, containerId);
}

function updateSectionLinkOrder(container, containerId) {
  const items = Array.from(container.querySelectorAll(".song-link-row.draggable-item"));
  items.forEach((item, index) => {
    item.dataset.displayOrder = index;
  });
  updateAllSectionLinkOrderInDom(containerId);
}

function updateAllSectionLinkOrderInDom(containerId = "section-links-list") {
  const linksRoot = el(containerId);
  if (!linksRoot) return;
  let globalOrder = 0;
  const sections = Array.from(linksRoot.querySelectorAll(".song-links-section"));
  sections.forEach(section => {
    const sectionContent = section.querySelector(".song-links-section-content");
    if (!sectionContent) return;
    const items = Array.from(sectionContent.querySelectorAll(".song-link-row.draggable-item"));
    items.forEach((item) => {
      item.dataset.displayOrder = String(globalOrder++);
    });
  });
}

function collectSectionLinks(containerId = "section-links-list") {
  const container = el(containerId);
  if (!container) return [];

  const links = [];
  let globalOrder = 0;

  // Collect links from all sections
  const sections = Array.from(container.querySelectorAll(".song-links-section"));
  sections.forEach(section => {
    const sectionContent = section.querySelector(".song-links-section-content");
    if (!sectionContent) return;

    const rows = Array.from(sectionContent.querySelectorAll(".song-link-row"));
    rows.forEach((row) => {
      const titleInput = row.querySelector(".section-link-title-input");
      const urlInput = row.querySelector(".section-link-url-input");
      const fileInput = row.querySelector(".section-link-file-input");
      const keyInput = row.querySelector(".section-link-key");
      const idInput = row.querySelector(".section-link-id");
      const isFileUploadInput = row.querySelector(".section-link-is-file-upload");
      const filePathInput = row.querySelector(".section-link-file-path");
      const fileNameInput = row.querySelector(".section-link-file-name");
      const fileTypeInput = row.querySelector(".section-link-file-type");

      const title = titleInput?.value.trim();
      const key = keyInput?.value || null;
      const id = idInput?.value;
      const isFileUpload = isFileUploadInput?.value === 'true';

      if (isFileUpload) {
        // File upload - check if file is selected or already uploaded
        const file = fileInput?.files[0];
        const existingFilePath = filePathInput?.value;
        const existingFileName = fileNameInput?.value;
        const existingFileType = fileTypeInput?.value;

        if (title && (file || existingFilePath)) {
          links.push({
            id: id || null,
            title,
            url: null,
            file_path: existingFilePath || null, // Will be set after upload
            file_name: existingFileName || (file ? file.name : null),
            file_type: existingFileType || (file ? getFileType(file) : null),
            is_file_upload: true,
            file: file || null, // Store file object for upload
            key: key || null,
            display_order: globalOrder++,
          });
        }
      } else {
        // URL link
        const url = urlInput?.value.trim();
        if (title && url) {
          links.push({
            id: id || null,
            title,
            url,
            file_path: null,
            file_name: null,
            file_type: null,
            is_file_upload: false,
            key: key || null,
            display_order: globalOrder++,
          });
        }
      }
    });
  });

  return links;
}

async function handleSongEditSubmit(event) {
  event.preventDefault();
  const form = el("song-edit-form");
  const songId = form.dataset.songId;
  const title = el("song-edit-title").value.trim();
  const bpm = el("song-edit-bpm").value ? parseInt(el("song-edit-bpm").value) : null;
  const timeSignature = el("song-edit-time-signature").value.trim() || null;
  const duration = parseDuration(el("song-edit-duration").value);
  const description = el("song-edit-description").value.trim() || null;
  
  if (!title) {
    toastError("Title is required.");
    return;
  }
  
  // Preserve set detail view state before any operations
  // If creating from song modal, we MUST preserve the set (song modal can only be opened from set detail)
  const wasSetDetailOpen = state.selectedSet && !el("set-detail").classList.contains("hidden");
  const preservedSelectedSetId = state.selectedSet?.id;
  const preservedSelectedSet = state.selectedSet ? { ...state.selectedSet } : null; // Deep copy to preserve full object
  const isCreatingFromModal = state.creatingSongFromModal && !songId;
  
  const songData = {
    title,
    bpm,
    time_signature: timeSignature,
    duration_seconds: duration,
    description,
    created_by: state.session.user.id,
    team_id: state.currentTeamId,
  };
  
  let response;
  if (songId) {
    // Update existing song
    response = await supabase
      .from("songs")
      .update(songData)
      .eq("id", songId)
      .select()
      .single();
  } else {
    // Create new song
    response = await supabase
      .from("songs")
      .insert(songData)
      .select()
      .single();
  }
  
  if (response.error) {
    console.error(response.error);
    toastError("Unable to save song. Check console.");
    return;
  }
  
  const finalSongId = response.data.id;
  const keys = collectSongKeys();
  const links = collectSongLinks();
  
  console.log("Collected links for save:", links);
  console.log("Final song ID:", finalSongId);
  
  // Handle song keys
  // Get existing keys
  const { data: existingKeys } = await supabase
    .from("song_keys")
    .select("*")
    .eq("song_id", finalSongId);
  
  // Determine which to delete, update, and insert
  const existingKeyIds = new Set(existingKeys?.map(k => k.id) || []);
  const newKeys = keys.filter(k => !k.id);
  const updatedKeys = keys.filter(k => k.id && existingKeyIds.has(k.id));
  const deletedKeyIds = Array.from(existingKeyIds).filter(id => 
    !keys.some(k => k.id === id)
  );
  
  // Delete removed keys
  if (deletedKeyIds.length > 0) {
    await supabase
      .from("song_keys")
      .delete()
      .in("id", deletedKeyIds);
  }
  
  // Update existing keys
  for (const keyItem of updatedKeys) {
    await supabase
      .from("song_keys")
      .update({
        key: keyItem.key,
      })
      .eq("id", keyItem.id);
  }
  
  // Insert new keys
  if (newKeys.length > 0) {
    await supabase
      .from("song_keys")
      .insert(
        newKeys.map(keyItem => ({
          song_id: finalSongId,
          key: keyItem.key,
          team_id: state.currentTeamId,
        }))
      );
  }
  
  // Handle song links
  // Get existing links
  const { data: existingLinks } = await supabase
    .from("song_links")
    .select("*")
    .eq("song_id", finalSongId);
  
  // Determine which to delete, update, and insert
  const existingIds = new Set(existingLinks?.map(l => l.id) || []);
  const newLinks = links.filter(l => !l.id);
  const updatedLinks = links.filter(l => l.id && existingIds.has(l.id));
  const deletedIds = Array.from(existingIds).filter(id => 
    !links.some(l => l.id === id)
  );
  
  // Delete removed links and their files
  if (deletedIds.length > 0) {
    // Get file paths of links to be deleted
    const linksToDelete = existingLinks?.filter(l => deletedIds.includes(l.id)) || [];
    for (const linkToDelete of linksToDelete) {
      if (linkToDelete.is_file_upload && linkToDelete.file_path) {
        await deleteFileFromSupabase(linkToDelete.file_path);
      }
    }
    
    await supabase
      .from("song_links")
      .delete()
      .in("id", deletedIds);
  }
  
  // Update existing links
  for (const link of updatedLinks) {
    const existingLink = existingLinks?.find(l => l.id === link.id);
    let filePath = link.file_path;
    let fileName = link.file_name;
    let fileType = link.file_type;
    
    // If it's a file upload with a new file, upload it
    if (link.is_file_upload && link.file) {
      // Delete old file if it exists
      if (existingLink?.is_file_upload && existingLink?.file_path) {
        await deleteFileFromSupabase(existingLink.file_path);
      }
      
      // Upload new file
      const uploadResult = await uploadFileToSupabase(link.file, finalSongId, null, state.currentTeamId);
      if (!uploadResult.success) {
        toastError(`Failed to upload file: ${uploadResult.error}`);
        continue;
      }
      filePath = uploadResult.filePath;
      fileName = uploadResult.fileName;
      fileType = uploadResult.fileType;
    } else if (link.is_file_upload && !link.file && existingLink?.file_path) {
      // Keep existing file if no new file is selected
      filePath = existingLink.file_path;
      fileName = existingLink.file_name || link.file_name;
      fileType = existingLink.file_type || link.file_type;
    }
    
    await supabase
      .from("song_links")
      .update({
        title: link.title,
        url: link.is_file_upload ? null : link.url,
        file_path: link.is_file_upload ? filePath : null,
        file_name: link.is_file_upload ? fileName : null,
        file_type: link.is_file_upload ? fileType : null,
        is_file_upload: link.is_file_upload,
        key: link.key || null,
        display_order: link.display_order,
      })
      .eq("id", link.id);
  }
  
  // Insert new links
  if (newLinks.length > 0) {
    const linksToInsert = [];
    
    for (const link of newLinks) {
      let filePath = link.file_path;
      let fileName = link.file_name;
      let fileType = link.file_type;
      
      // If it's a file upload, upload the file first
      if (link.is_file_upload && link.file) {
        console.log("Uploading file for new link:", link.file.name);
        const uploadResult = await uploadFileToSupabase(link.file, finalSongId, null, state.currentTeamId);
        if (!uploadResult.success) {
          console.error("File upload failed:", uploadResult.error);
          toastError(`Failed to upload file: ${uploadResult.error}`);
          continue;
        }
        console.log("File uploaded successfully:", uploadResult);
        filePath = uploadResult.filePath;
        fileName = uploadResult.fileName;
        fileType = uploadResult.fileType;
      } else if (link.is_file_upload && !link.file) {
        console.warn("File upload link has no file selected:", link);
        // Still allow saving if there's a title, the file might be uploaded separately
      }
      
      linksToInsert.push({
        song_id: finalSongId,
        title: link.title,
        url: link.is_file_upload ? null : link.url,
        file_path: link.is_file_upload ? filePath : null,
        file_name: link.is_file_upload ? fileName : null,
        file_type: link.is_file_upload ? fileType : null,
        is_file_upload: link.is_file_upload,
        key: link.key || null,
        display_order: link.display_order,
        team_id: state.currentTeamId,
      });
    }
    
    if (linksToInsert.length > 0) {
      const { data: insertedLinks, error: insertError } = await supabase
        .from("song_links")
        .insert(linksToInsert)
        .select();
      
      if (insertError) {
        console.error("Error inserting song links:", insertError);
        console.error("Links that failed to insert:", linksToInsert);
        toastError(`Failed to save some links: ${insertError.message}`);
        
        // Clean up uploaded files if database insert failed
        for (const link of linksToInsert) {
          if (link.is_file_upload && link.file_path) {
            console.log("Cleaning up uploaded file due to insert failure:", link.file_path);
            await deleteFileFromSupabase(link.file_path);
          }
        }
      } else {
        console.log("Successfully inserted song links:", insertedLinks);
      }
    }
  }
  
  // Reload songs and update catalog
  await loadSongs();
  
  // Update songs tab if it's currently visible
  if (!el("songs-tab")?.classList.contains("hidden")) {
    renderSongCatalog();
  }
  
  // If details modal is open for this song, refresh it
  // Only do this if we're NOT creating from the song modal (to avoid closing set details)
  if (state.currentSongDetailsId === finalSongId && !state.creatingSongFromModal) {
    const updatedSong = state.songs.find(s => s.id === finalSongId);
    if (updatedSong) {
      // Fetch full song data with links
      const { data } = await supabase
        .from("songs")
        .select(`
          *,
          song_links (
            id,
            title,
            url,
            file_path,
            file_name,
            file_type,
            is_file_upload
          )
        `)
        .eq("id", finalSongId)
        .single();
      
      if (data) {
        await openSongDetailsModal(data);
      }
    }
  }
  
  closeSongEditModal();
  
  // If we were creating from the song modal, DO NOT call loadSets() 
  // Just refresh the song modal and keep the set detail view open
  if (isCreatingFromModal && preservedSelectedSetId) {
    state.creatingSongFromModal = false;
    
    // CRITICAL: Restore state.selectedSet IMMEDIATELY and ensure view stays open
    if (preservedSelectedSet) {
      state.selectedSet = preservedSelectedSet;
      // Make absolutely sure the set detail view is visible
      const dashboard = el("dashboard");
      const detailView = el("set-detail");
      if (dashboard && detailView) {
        dashboard.classList.add("hidden");
        detailView.classList.remove("hidden");
      }
      // Refresh the songs list in the set detail view
      renderSetDetailSongs(preservedSelectedSet);
    }
    
    // Refresh the song modal options and select the new song
    await populateSongOptions();
    if (songDropdown) {
      songDropdown.setValue(response.data.id);
    }
  } else {
    state.creatingSongFromModal = false;
    
    // Restore set detail view if it was open before
    if (wasSetDetailOpen && preservedSelectedSetId) {
      // Restore state immediately
      if (preservedSelectedSet) {
        state.selectedSet = preservedSelectedSet;
        // Make absolutely sure the set detail view is visible
        const dashboard = el("dashboard");
        const detailView = el("set-detail");
        if (dashboard && detailView) {
          dashboard.classList.add("hidden");
          detailView.classList.remove("hidden");
        }
      }
      
      // Only load sets if we need fresh data, but preserve the view
      await loadSets();
      const updatedSet = state.sets.find(s => s.id === preservedSelectedSetId);
      if (updatedSet) {
        state.selectedSet = updatedSet;
        // Ensure set detail view is visible and restored
        showSetDetail(updatedSet);
      } else if (preservedSelectedSet) {
        state.selectedSet = preservedSelectedSet;
        showSetDetail(preservedSelectedSet);
      }
    } else if (state.selectedSet) {
      // Refresh set detail view if it's showing this song
      await loadSets();
      const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
      if (updatedSet) {
        state.selectedSet = updatedSet;
        renderSetDetailSongs(updatedSet);
      }
    }
    
    // If song select is open, refresh it
    if (!el("song-modal").classList.contains("hidden")) {
      await populateSongOptions();
      // Select the newly created song
      if (!songId && songDropdown) {
        songDropdown.setValue(response.data.id);
      }
    }
  }
}

function formatDuration(seconds) {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseDuration(durationStr) {
  if (!durationStr || !durationStr.trim()) return null;
  
  const trimmed = durationStr.trim();
  
  // Handle MM:SS format
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(secs) && secs >= 0 && secs < 60 && mins >= 0) {
      return mins * 60 + secs;
    }
  }
  
  // Handle just minutes (e.g., "3" or "3:")
  if (parts.length === 1 || (parts.length === 2 && parts[1] === "")) {
    const mins = parseInt(parts[0], 10);
    if (!isNaN(mins) && mins >= 0) {
      return mins * 60;
    }
  }
  
  // Fallback: try to parse as just a number (seconds) for backwards compatibility
  const asNumber = parseInt(trimmed, 10);
  if (!isNaN(asNumber) && asNumber >= 0) {
    return asNumber;
  }
  
  return null;
}

function formatLongDuration(seconds) {
  if (!seconds) return "0m";
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts = [];
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (minutes || hours) {
    const minuteStr = hours ? minutes.toString().padStart(2, "0") : minutes.toString();
    parts.push(`${minuteStr}m`);
  }
  if (secs && !hours) {
    parts.push(`${secs}s`);
  }
  return parts.join(" ");
}

function getSetSongDurationSeconds(setSong) {
  if (!setSong) return null;
  if (setSong.planned_duration_seconds !== undefined && setSong.planned_duration_seconds !== null) {
    return setSong.planned_duration_seconds;
  }
  if (setSong.song_id && setSong.song?.duration_seconds) {
    return setSong.song.duration_seconds;
  }
  return null;
}

function calculateServiceLengthSeconds(set) {
  if (!set?.set_songs || set.set_songs.length === 0) return 0;
  return set.set_songs.reduce((total, setSong) => {
    const duration = getSetSongDurationSeconds(setSong);
    return total + (duration || 0);
  }, 0);
}

function updateServiceLengthDisplay(set) {
  const footer = el("service-length-footer");
  const valueEl = el("service-length-value");
  if (!footer || !valueEl) return;
  const totalSeconds = calculateServiceLengthSeconds(set);
  if (totalSeconds > 0) {
    valueEl.textContent = formatLongDuration(totalSeconds);
    footer.classList.remove("hidden");
  } else {
    valueEl.textContent = "";
    footer.classList.add("hidden");
  }
}

function renderSetPrintPreview(set) {
  const container = el("print-set-content");
  if (!container || !set) return;

  const sortedSetSongs = (set.set_songs || []).slice().sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
  const totalSeconds = calculateServiceLengthSeconds(set);
  const date = parseLocalDate(set.scheduled_date);
  const dateLabel = date ? date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) : "";
  const assignmentMode = getSetAssignmentMode(set);

  const formatAssignmentName = (assignment) =>
    assignment.person?.full_name ||
    assignment.pending_invite?.full_name ||
    assignment.person_name ||
    assignment.person_email ||
    assignment.pending_invite?.email ||
    "Unknown";

  const setAssignments = assignmentMode === "per_set" ? (set.set_assignments || []) : [];
  const setAssignmentsByRole = setAssignments.reduce((acc, assignment) => {
    const role = assignment.role || "Unassigned";
    if (!acc[role]) acc[role] = [];
    acc[role].push(formatAssignmentName(assignment));
    return acc;
  }, {});

  const setAssignmentsHtml = setAssignments.length
    ? `
      <div class="print-assignments-inline">
        ${Object.keys(setAssignmentsByRole).sort().map(role => `
          <span class="print-assignment-role">${escapeHtml(role)}:</span>
          <span class="print-assignment-names">${escapeHtml(setAssignmentsByRole[role].join(", "))}</span>
        `).join(' • ')}
      </div>
    `
    : "";

  const rowsHtml = sortedSetSongs.map((setSong, index) => {
    const tagInfo = isTag(setSong) ? parseTagDescription(setSong) : null;
    const isSection = !setSong.song_id && !tagInfo;
    const isSectionHeader = isSection &&
      !setSong.description &&
      !setSong.notes &&
      (!setSong.song_assignments || setSong.song_assignments.length === 0);

    const displayKey = setSong.key || (setSong.song?.song_keys && setSong.song.song_keys.length > 0
      ? setSong.song.song_keys.map(k => k.key).join(", ")
      : "");
    const bpm = setSong.song?.bpm ? `${setSong.song.bpm}` : "";
    const lengthSeconds = getSetSongDurationSeconds(setSong);
    const lengthLabel = (lengthSeconds !== null && lengthSeconds !== undefined && lengthSeconds !== 0)
      ? formatDuration(lengthSeconds)
      : "";

    let title = setSong.song?.title ?? setSong.title ?? "Untitled";
    if (tagInfo) {
      const partName = resolveTagPartName(tagInfo.tagType, tagInfo.customValue) || setSong.title || "Tag";
      title = `${setSong.song?.title ?? "Untitled"} — ${partName}`;
    } else if (isSection) {
      title = setSong.title || "Section";
    }

    const notesParts = [];
    if (setSong.notes) notesParts.push(setSong.notes);
    if (isSection && setSong.description) notesParts.push(setSong.description);

    let assignmentSummary = "";
    if (assignmentMode === "per_song" && setSong.song_assignments?.length) {
      const byRole = setSong.song_assignments.reduce((acc, assignment) => {
        const role = assignment.role || "Unassigned";
        if (!acc[role]) acc[role] = [];
        acc[role].push(formatAssignmentName(assignment));
        return acc;
      }, {});
      assignmentSummary = Object.keys(byRole).sort().map(role => `${role}: ${byRole[role].join(", ")}`).join(" • ");
    }

    const rowClass = isSectionHeader ? ' class="print-section-row"' : "";
    
    // For sections, merge Key and BPM columns into Notes (colspan=3 covers Key+BPM+Notes)
    if (isSection) {
      return `
        <tr${rowClass}>
          <td>${index + 1}</td>
          <td>
            ${escapeHtml(title)}
          </td>
          <td>${escapeHtml(lengthLabel)}</td>
          <td colspan="3">${notesParts.map(part => `<div class="print-notes">${escapeHtml(part)}</div>`).join("")}</td>
        </tr>
        ${assignmentSummary ? `
          <tr class="print-assignment-subrow">
            <td></td>
            <td colspan="5">${escapeHtml(assignmentSummary)}</td>
          </tr>
        ` : ""}
      `;
    }
    
    // For songs/tags, show all columns
    return `
      <tr${rowClass}>
        <td>${index + 1}</td>
        <td>
          ${escapeHtml(title)}
        </td>
        <td>${escapeHtml(lengthLabel)}</td>
        <td>${escapeHtml(displayKey || "")}</td>
        <td>${escapeHtml(bpm)}</td>
        <td>${notesParts.map(part => `<div class="print-notes">${escapeHtml(part)}</div>`).join("")}</td>
      </tr>
      ${assignmentSummary ? `
        <tr class="print-assignment-subrow">
          <td></td>
          <td colspan="5">${escapeHtml(assignmentSummary)}</td>
        </tr>
      ` : ""}
    `;
  }).join("") || `
      <tr>
        <td colspan="6" style="text-align: center; padding: 1rem; color: #6b7280;">
          No items in this set yet.
        </td>
      </tr>
    `;

  container.innerHTML = `
    <div class="print-set-header">
      <div>
        <p class="print-set-meta">Service</p>
        <h1 class="print-set-title">${escapeHtml(set.title || "Untitled Set")}</h1>
        ${dateLabel ? `<p class="print-set-meta">${escapeHtml(dateLabel)}</p>` : ""}
        ${set.description ? `<p class="print-set-meta">${escapeHtml(set.description)}</p>` : ""}
      </div>
      <div class="print-summary">
        <div class="print-summary-item">Total Length: ${totalSeconds ? formatLongDuration(totalSeconds) : "—"}</div>
        ${set.team_name ? `<div class="print-summary-item">Team: ${escapeHtml(set.team_name)}</div>` : ""}
      </div>
      ${assignmentMode === "per_set" ? setAssignmentsHtml : ""}
    </div>
    <table class="print-set-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>Length</th>
          <th>Key</th>
          <th>BPM</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div class="print-total">Overall Length: ${totalSeconds ? formatLongDuration(totalSeconds) : "—"}</div>
  `;
}

function openPrintSet(set) {
  const wrapper = el("print-set-container");
  if (!wrapper || !set) return;

  renderSetPrintPreview(set);
  // Keep it visually hidden on screen; print styles will reveal it
  wrapper.setAttribute("aria-hidden", "false");

  const afterPrint = () => {
    wrapper.setAttribute("aria-hidden", "true");
    window.removeEventListener("afterprint", afterPrint);
  };
  window.addEventListener("afterprint", afterPrint);

  // Small delay to ensure DOM is updated before print dialog
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });

  // Fallback in case afterprint doesn't fire
  setTimeout(afterPrint, 3000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function highlightMatch(text, searchTerm) {
  if (!searchTerm || !text) return escapeHtml(text);
  
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const searchIndex = lowerText.indexOf(lowerSearch);
  
  if (searchIndex === -1) return escapeHtml(text);
  
  const beforeMatch = text.substring(0, searchIndex);
  const match = text.substring(searchIndex, searchIndex + searchTerm.length);
  const afterMatch = text.substring(searchIndex + searchTerm.length);
  
  return `${escapeHtml(beforeMatch)}<span style="color: var(--accent-color);">${escapeHtml(match)}</span>${escapeHtml(afterMatch)}`;
}

function getFaviconUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    // Use Google's favicon service as a fallback
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch (e) {
    return null;
  }
}

async function renderSongLinksDisplay(links, container) {
  if (!links || links.length === 0) return;

  const linksContainer = document.createElement("div");
  linksContainer.style.marginTop = "1rem";
  linksContainer.style.display = "flex";
  linksContainer.style.flexDirection = "column";
  linksContainer.style.gap = "0.5rem";

  for (const link of links) {
    const linkEl = document.createElement("a");
    linkEl.className = "song-link-display";

    if (link.is_file_upload && link.file_path) {
      console.log('Rendering file upload link:', {
        title: link.title,
        file_path: link.file_path,
        file_name: link.file_name,
        is_file_upload: link.is_file_upload
      });
      
      // Check if it's an audio file
      const isAudio = isAudioFile(link.file_type, link.file_name);
      
      // File upload - get signed URL
      const fileUrl = await getFileUrl(link.file_path);
      
      if (isAudio && fileUrl) {
        // Create audio player instead of download link
        const audioContainer = document.createElement("div");
        audioContainer.className = "song-link-display audio-player-container";
        audioContainer.style.display = "flex";
        audioContainer.style.alignItems = "center";
        audioContainer.style.gap = "0.75rem";
        audioContainer.style.padding = "0.75rem";
        audioContainer.style.background = "var(--bg-secondary)";
        audioContainer.style.borderRadius = "0.5rem";
        audioContainer.style.border = "1px solid var(--border-color)";
        
        // Audio icon
        const audioIcon = document.createElement("div");
        audioIcon.className = "song-link-favicon";
        audioIcon.innerHTML = '<i class="fa-solid fa-music" style="font-size: 1.2rem; color: var(--accent-color);"></i>';
        
        const content = document.createElement("div");
        content.className = "song-link-content";
        content.style.flex = "1";
        content.style.minWidth = "0";
        
        const title = document.createElement("div");
        title.className = "song-link-title";
        title.textContent = link.title;
        
        // Audio player
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = fileUrl;
        audio.style.width = "100%";
        audio.style.marginTop = "0.5rem";
        audio.preload = "metadata";
        
        content.appendChild(title);
        content.appendChild(audio);
        
        audioContainer.appendChild(audioIcon);
        audioContainer.appendChild(content);
        
        linksContainer.appendChild(audioContainer);
        continue; // Skip the link creation for audio files
      }
      
      // For non-audio files, create download link
      if (fileUrl) {
        linkEl.href = fileUrl;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";
        linkEl.download = link.file_name || link.title;
        linkEl.style.cursor = "pointer";
      } else {
        // Don't make it clickable if URL generation failed
        linkEl.href = "#";
        linkEl.onclick = (e) => {
          e.preventDefault();
          toastError("Unable to load file. Please try again later.");
          return false;
        };
        linkEl.style.cursor = "not-allowed";
        linkEl.style.opacity = "0.6";
        linkEl.title = "File unavailable";
      }
      
      // File icon
      const fileIcon = document.createElement("div");
      fileIcon.className = "song-link-favicon";
      fileIcon.innerHTML = '<i class="fa-solid fa-file" style="font-size: 1.2rem; color: var(--text-secondary);"></i>';
      
      const content = document.createElement("div");
      content.className = "song-link-content";
      
      const title = document.createElement("div");
      title.className = "song-link-title";
      title.textContent = link.title;
      
      const fileInfo = document.createElement("div");
      fileInfo.className = "song-link-url";
      fileInfo.textContent = link.file_name || "File";
      if (link.file_type) {
        fileInfo.textContent += ` (${link.file_type})`;
      }
      
      content.appendChild(title);
      content.appendChild(fileInfo);
      
      linkEl.appendChild(fileIcon);
      linkEl.appendChild(content);
    } else {
      // URL link
      linkEl.href = link.url;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      
      const favicon = document.createElement("img");
      favicon.className = "song-link-favicon";
      favicon.src = getFaviconUrl(link.url);
      favicon.alt = "";
      favicon.onerror = () => {
        favicon.style.display = "none";
      };
      
      const content = document.createElement("div");
      content.className = "song-link-content";
      
      const title = document.createElement("div");
      title.className = "song-link-title";
      title.textContent = link.title;
      
      const url = document.createElement("div");
      url.className = "song-link-url";
      url.textContent = link.url;
      
      content.appendChild(title);
      content.appendChild(url);
      
      linkEl.appendChild(favicon);
      linkEl.appendChild(content);
    }

    linksContainer.appendChild(linkEl);
  }

  container.appendChild(linksContainer);
}

// Parse date string as local date (not UTC) to avoid timezone issues
function parseLocalDate(dateString) {
  if (!dateString) return null;
  // Date strings from inputs are in YYYY-MM-DD format
  const parts = dateString.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  // Fallback to regular Date parsing
  return new Date(dateString);
}

// Metronome/Click Track Functions
function createClickSound(audioContext) {
  const now = audioContext.currentTime;
  const duration = 0.008; // Very short for sharp attack
  
  // Create white noise for percussive character
  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Fill with white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  // Use a bandpass filter to emphasize mid-range frequencies (snare-like)
  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2000, now); // Center around 2kHz for that "crack"
  filter.Q.setValueAtTime(2, now); // Narrower Q for more focused sound
  
  // Create a very sharp envelope for percussive attack
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.6, now + 0.0005); // Very quick attack
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Quick decay
  
  // Add a mid-range frequency component for body (like a drumstick click)
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(1200, now); // Higher frequency for cut-through
  oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.003); // Quick drop to body
  
  const oscGain = audioContext.createGain();
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(0.3, now + 0.0005); // Sharp attack
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
  
  oscillator.connect(oscGain);
  oscGain.connect(audioContext.destination);
  
  // Play filtered white noise (the "snap" part)
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start(now);
  oscillator.stop(now + duration);
  source.start(now);
  source.stop(now + duration);
}

function startMetronome(bpm) {
  if (!bpm || bpm <= 0) {
    toastError("Song needs a BPM to play click track.");
    return;
  }
  
  // Stop any existing metronome
  stopMetronome();
  
  // Initialize audio context if needed
  if (!state.metronome.audioContext) {
    state.metronome.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  const audioContext = state.metronome.audioContext;
  
  // Calculate interval in milliseconds (60 seconds / BPM * 1000)
  const intervalMs = (60 / bpm) * 1000;
  
  // Play first click immediately
  createClickSound(audioContext);
  
  // Set up interval for subsequent clicks
  state.metronome.intervalId = setInterval(() => {
    if (state.metronome.isPlaying) {
      createClickSound(audioContext);
    }
  }, intervalMs);
  
  state.metronome.isPlaying = true;
  state.metronome.bpm = bpm;
}

function stopMetronome() {
  if (state.metronome.intervalId) {
    clearInterval(state.metronome.intervalId);
    state.metronome.intervalId = null;
  }
  state.metronome.isPlaying = false;
  state.metronome.bpm = null;
  updateClickTrackButtons();
}

function toggleMetronome(bpm) {
  if (state.metronome.isPlaying && state.metronome.bpm === bpm) {
    stopMetronome();
    return false;
  } else {
    startMetronome(bpm);
    return true;
  }
}

function updateClickTrackButtons() {
  document.querySelectorAll(".click-track-btn").forEach(btn => {
    const bpm = parseInt(btn.dataset.bpm, 10);
    if (state.metronome.isPlaying && state.metronome.bpm === bpm) {
      btn.innerHTML = '<i class="fa-solid fa-pause"></i> Stop';
      btn.classList.add("active");
    } else {
      btn.innerHTML = '<i class="fa-solid fa-play"></i> Click';
      btn.classList.remove("active");
    }
  });
}

// Custom Searchable Dropdown Component
function createSearchableDropdown(options, placeholder = "Search...", selectedValue = null, onInvite = null) {
  const container = document.createElement("div");
  container.className = "searchable-dropdown";

  const normalizedOptions = (options || []).map((option) => {
    // Build search text including metadata
    const searchParts = [option.label];
    
    // Add email for users
    if (option.meta?.email) {
      searchParts.push(option.meta.email);
    }
    
    // Add song metadata
    if (option.meta?.bpm) {
      searchParts.push(String(option.meta.bpm));
    }
    if (option.meta?.key) {
      searchParts.push(option.meta.key);
    }
    if (option.meta?.timeSignature) {
      searchParts.push(option.meta.timeSignature);
    }
    if (option.meta?.duration) {
      searchParts.push(option.meta.duration);
    }
    
    return {
      ...option,
      searchText: searchParts.filter(Boolean).join(" ").toLowerCase(),
    };
  });

  const input = document.createElement("input");
  input.type = "text";
  input.className = "searchable-dropdown-input";
  input.placeholder = placeholder;
  input.setAttribute("readonly", "");

  const optionsList = document.createElement("div");
  optionsList.className = "searchable-dropdown-options";

  let selectedOption = null;
  let highlightedIndex = -1;
  let filteredOptions = normalizedOptions;

  // Find selected option
  if (selectedValue) {
    selectedOption = normalizedOptions.find((opt) => opt.value === selectedValue) || null;
    if (selectedOption) {
      input.value = selectedOption.meta?.isPending
        ? `${selectedOption.label} (Pending)`
        : selectedOption.label;
      input.classList.remove("placeholder");
    } else {
      input.classList.add("placeholder");
    }
  } else {
    input.classList.add("placeholder");
  }


  function renderOptions() {
    optionsList.innerHTML = "";
    const searchTerm = input.value.trim();

    if (filteredOptions.length === 0) {
      if (onInvite && searchTerm) {
        const inviteOption = document.createElement("div");
        inviteOption.className = "searchable-dropdown-option invite-option";
        inviteOption.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.2rem;">+</span>
            <span>Invite "${escapeHtml(searchTerm)}"</span>
          </div>
        `;
        inviteOption.addEventListener("click", (e) => {
          e.stopPropagation();
          optionsList.classList.remove("open");
          input.setAttribute("readonly", "");
          onInvite(searchTerm);
        });
        optionsList.appendChild(inviteOption);
      } else {
        const noResults = document.createElement("div");
        noResults.className = "searchable-dropdown-option no-results";
        noResults.textContent = onInvite ? "Type a name to invite someone" : "No results found";
        optionsList.appendChild(noResults);
      }
      return;
    }

    filteredOptions.forEach((option, index) => {
      const optionEl = document.createElement("div");
      optionEl.className = "searchable-dropdown-option";
      if (selectedOption?.value === option.value) {
        optionEl.classList.add("selected");
      }
      
      const highlightedLabel = searchTerm ? highlightMatch(option.label, searchTerm) : escapeHtml(option.label);
      
      // Build metadata display with highlighting
      let metadataHtml = "";
      
      // For users: show email with highlighting
      if (option.meta?.email) {
        const highlightedEmail = searchTerm && option.meta.email.toLowerCase().includes(searchTerm.toLowerCase())
          ? highlightMatch(option.meta.email, searchTerm)
          : escapeHtml(option.meta.email);
        metadataHtml = `<div class="searchable-option-subtext">${highlightedEmail}</div>`;
      }
      
      // For songs: show metadata with highlighting
      if (option.meta?.bpm || option.meta?.key || option.meta?.timeSignature || option.meta?.duration) {
        const metaParts = [];
        if (option.meta.bpm) {
          const bpmStr = String(option.meta.bpm);
          const highlightedBpm = searchTerm && bpmStr.includes(searchTerm)
            ? highlightMatch(bpmStr, searchTerm)
            : escapeHtml(bpmStr);
          metaParts.push(`BPM: ${highlightedBpm}`);
        }
        if (option.meta.key) {
          const highlightedKey = searchTerm && option.meta.key.toLowerCase().includes(searchTerm.toLowerCase())
            ? highlightMatch(option.meta.key, searchTerm)
            : escapeHtml(option.meta.key);
          metaParts.push(`Key: ${highlightedKey}`);
        }
        if (option.meta.timeSignature) {
          const highlightedTime = searchTerm && option.meta.timeSignature.toLowerCase().includes(searchTerm.toLowerCase())
            ? highlightMatch(option.meta.timeSignature, searchTerm)
            : escapeHtml(option.meta.timeSignature);
          metaParts.push(`Time: ${highlightedTime}`);
        }
        if (option.meta.duration) {
          const highlightedDuration = searchTerm && option.meta.duration.includes(searchTerm)
            ? highlightMatch(option.meta.duration, searchTerm)
            : escapeHtml(option.meta.duration);
          metaParts.push(`Duration: ${highlightedDuration}`);
        }
        if (metaParts.length > 0) {
          metadataHtml = `<div class="searchable-option-subtext">${metaParts.join(" • ")}</div>`;
        }
      }
      
      // Add weeks since last performed indicator for songs
      let weeksIndicator = "";
      if (option.meta?.weeksSinceLastPerformed !== null && option.meta?.weeksSinceLastPerformed !== undefined) {
        weeksIndicator = `<span class="searchable-option-weeks" style="margin-left: auto; color: var(--text-muted); font-size: 0.85rem;">${option.meta.weeksSinceLastPerformed}w</span>`;
      }
      
      optionEl.innerHTML = `
        <div class="searchable-option-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
            <span class="searchable-option-label">${highlightedLabel}</span>
            ${option.meta?.isPending ? '<span class="searchable-option-tag">(Pending)</span>' : ''}
          </div>
          ${weeksIndicator}
        </div>
        ${metadataHtml}
      `;
      optionEl.dataset.value = option.value;

      optionEl.addEventListener("click", () => {
        selectOption(option);
      });

      optionsList.appendChild(optionEl);
    });
  }

  function selectOption(option) {
    selectedOption = option;
    input.value = option.meta?.isPending ? `${option.label} (Pending)` : option.label;
    input.classList.remove("placeholder");
    optionsList.classList.remove("open");
    highlightedIndex = -1;

    const event = new CustomEvent("change", {
      detail: { value: option.value, option },
    });
    container.dispatchEvent(event);
  }

  function filterOptions(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      filteredOptions = normalizedOptions;
    } else {
      // Filter and prioritize: title/name matches first, then metadata/email matches
      const allMatches = normalizedOptions.filter((opt) =>
        opt.searchText.includes(term)
      );
      
      // Separate into priority groups
      const primaryMatches = allMatches.filter((opt) => {
        const labelLower = (opt.label || "").toLowerCase();
        return labelLower.includes(term);
      });
      
      const secondaryMatches = allMatches.filter((opt) => {
        const labelLower = (opt.label || "").toLowerCase();
        return !labelLower.includes(term);
      });
      
      // Combine: primary first, then secondary
      filteredOptions = [...primaryMatches, ...secondaryMatches];
    }
    highlightedIndex = -1;
    renderOptions();
  }

  function highlightOption(index) {
    const optionEls = optionsList.querySelectorAll(".searchable-dropdown-option:not(.no-results):not(.invite-option)");
    const inviteOption = optionsList.querySelector(".invite-option");
    if (inviteOption) inviteOption.classList.remove("highlighted");
    optionEls.forEach((el, i) => {
      el.classList.toggle("highlighted", i === index);
    });
    highlightedIndex = index;
  }

  input.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsList.classList.toggle("open");
    if (optionsList.classList.contains("open")) {
      input.removeAttribute("readonly");
      input.focus();
      filterOptions(input.value);
    }
  });

  input.addEventListener("input", (e) => {
    filterOptions(e.target.value);
    if (!optionsList.classList.contains("open")) {
      optionsList.classList.add("open");
    }
  });

  input.addEventListener("keydown", (e) => {
    const optionEls = optionsList.querySelectorAll(".searchable-dropdown-option:not(.no-results)");
    const inviteOption = optionsList.querySelector(".invite-option");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (optionEls.length > 0) {
        highlightedIndex = Math.min(highlightedIndex + 1, optionEls.length - 1);
        highlightOption(highlightedIndex);
        optionEls[highlightedIndex]?.scrollIntoView({ block: "nearest" });
      } else if (inviteOption && highlightedIndex === -1) {
        inviteOption.classList.add("highlighted");
        highlightedIndex = -2;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (highlightedIndex === -2 && inviteOption) {
        inviteOption.classList.remove("highlighted");
        highlightedIndex = -1;
      } else if (optionEls.length > 0) {
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        if (highlightedIndex >= 0) {
          highlightOption(highlightedIndex);
          optionEls[highlightedIndex]?.scrollIntoView({ block: "nearest" });
        } else {
          optionEls.forEach((el) => el.classList.remove("highlighted"));
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex === -2 && inviteOption && onInvite) {
        optionsList.classList.remove("open");
        input.setAttribute("readonly", "");
        onInvite(input.value.trim());
      } else if (highlightedIndex >= 0 && optionEls[highlightedIndex]) {
        const value = optionEls[highlightedIndex].dataset.value;
        const option = filteredOptions.find((opt) => opt.value === value);
        if (option) selectOption(option);
      } else if (filteredOptions.length === 1) {
        selectOption(filteredOptions[0]);
      } else if (filteredOptions.length === 0 && inviteOption && onInvite && input.value.trim()) {
        optionsList.classList.remove("open");
        input.setAttribute("readonly", "");
        onInvite(input.value.trim());
      }
    } else if (e.key === "Escape") {
      optionsList.classList.remove("open");
      input.setAttribute("readonly", "");
      if (selectedOption) {
        input.value = selectedOption.meta?.isPending
          ? `${selectedOption.label} (Pending)`
          : selectedOption.label;
      } else {
        input.value = "";
        input.classList.add("placeholder");
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      optionsList.classList.remove("open");
      input.setAttribute("readonly", "");
      if (selectedOption) {
        input.value = selectedOption.meta?.isPending
          ? `${selectedOption.label} (Pending)`
          : selectedOption.label;
      } else {
        input.value = "";
        input.classList.add("placeholder");
      }
    }
  });

  renderOptions();

  container.appendChild(input);
  container.appendChild(optionsList);

  container.getValue = () => selectedOption?.value || null;
  container.setValue = (value) => {
    if (value === "" || value === null || value === undefined) {
      // Reset to no selection
      selectedOption = null;
      input.value = "";
      input.classList.add("placeholder");
      renderOptions();
    } else {
      const option = normalizedOptions.find((opt) => opt.value === value);
      if (option) {
        selectOption(option);
      }
    }
  };
  container.getSelectedOption = () => selectedOption;

  return container;
}

// Create a simple non-searchable dropdown (looks like searchable but shows all options)
function createSimpleDropdown(options, placeholder = "Select...", selectedValue = null) {
  const container = document.createElement("div");
  container.className = "searchable-dropdown";

  const normalizedOptions = options || [];

  const input = document.createElement("input");
  input.type = "text";
  input.className = "searchable-dropdown-input";
  input.placeholder = placeholder;
  input.setAttribute("readonly", "");

  const optionsList = document.createElement("div");
  optionsList.className = "searchable-dropdown-options";

  let selectedOption = null;

  // Find selected option
  if (selectedValue) {
    selectedOption = normalizedOptions.find((opt) => opt.value === selectedValue) || null;
    if (selectedOption) {
      input.value = selectedOption.label;
      input.classList.remove("placeholder");
    } else {
      input.classList.add("placeholder");
    }
  } else {
    input.classList.add("placeholder");
  }

  function renderOptions() {
    optionsList.innerHTML = "";
    
    if (normalizedOptions.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "searchable-dropdown-option no-results";
      noResults.textContent = "No options available";
      optionsList.appendChild(noResults);
      return;
    }

    normalizedOptions.forEach((option) => {
      const optionEl = document.createElement("div");
      optionEl.className = "searchable-dropdown-option";
      if (selectedOption && option.value === selectedOption.value) {
        optionEl.classList.add("selected");
      }
      
      optionEl.innerHTML = `
        <div class="searchable-option-row" style="display: flex; align-items: center; width: 100%;">
          <span class="searchable-option-label">${option.label}</span>
        </div>
      `;
      optionEl.dataset.value = option.value;

      optionEl.addEventListener("click", () => {
        selectOption(option);
      });

      optionsList.appendChild(optionEl);
    });
  }

  function selectOption(option) {
    selectedOption = option;
    input.value = option.label;
    input.classList.remove("placeholder");
    optionsList.classList.remove("open");
    
    const event = new CustomEvent("change", {
      detail: { value: option.value, option },
    });
    container.dispatchEvent(event);
  }

  // Toggle dropdown on input click
  input.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsList.classList.toggle("open");
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      optionsList.classList.remove("open");
    }
  });

  renderOptions();

  container.appendChild(input);
  container.appendChild(optionsList);

  container.getValue = () => selectedOption?.value || null;
  container.setValue = (value) => {
    if (value === "" || value === null || value === undefined) {
      selectedOption = null;
      input.value = "";
      input.classList.add("placeholder");
      renderOptions();
    } else {
      const option = normalizedOptions.find((opt) => opt.value === value);
      if (option) {
        selectOption(option);
      }
    }
  };
  container.getSelectedOption = () => selectedOption;

  return container;
}

// Diagnostic function to test team access
async function testTeamAccess() {
  console.log('🔍 Testing team access...');
  console.log('  - Current profile:', state.profile);
  console.log('  - team_id:', state.profile?.team_id);
  
  if (!state.profile?.team_id) {
    console.error('❌ No team_id in profile!');
    return;
  }
  
  // Test songs query
  console.log('  - Testing songs query...');
  const { data: songsData, error: songsError } = await supabase
    .from("songs")
    .select("id, title, team_id")
    .eq("team_id", state.currentTeamId)
    .limit(5);
  
  console.log('  - Songs query result:');
  console.log('    - Error:', songsError?.code || 'none', songsError?.message || '');
  console.log('    - Count:', songsData?.length || 0);
  if (songsData && songsData.length > 0) {
    console.log('    - Sample:', songsData[0]);
  }
  
  // Test sets query
  console.log('  - Testing sets query...');
  const { data: setsData, error: setsError } = await supabase
    .from("sets")
    .select("id, title, team_id")
    .eq("team_id", state.currentTeamId)
    .limit(5);
  
  console.log('  - Sets query result:');
  console.log('    - Error:', setsError?.code || 'none', setsError?.message || '');
  console.log('    - Count:', setsData?.length || 0);
  if (setsData && setsData.length > 0) {
    console.log('    - Sample:', setsData[0]);
  }
  
  // Test profile query
  console.log('  - Testing profile query...');
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, team_id")
    .eq("id", state.session.user.id)
    .single();
  
  console.log('  - Profile query result:');
  console.log('    - Error:', profileError?.code || 'none', profileError?.message || '');
  console.log('    - Profile:', profileData);
}

// Make it available globally for debugging
window.testTeamAccess = testTeamAccess;

// Team Management Functions

function openEditAccountModal() {
  const modal = el("edit-account-modal");
  const input = el("edit-account-name-input");
  
  if (!modal || !input) return;
  
  const currentName = state.profile?.full_name || "";
  input.value = currentName;
  input.select();
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditAccountModal() {
  const modal = el("edit-account-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    const form = el("edit-account-form");
    if (form) form.reset();
  }
}

async function handleEditAccountSubmit(e) {
  e.preventDefault();
  
  const modal = el("edit-account-modal");
  const input = el("edit-account-name-input");
  
  if (!input || !state.profile) return;
  
  const currentName = state.profile.full_name || "";
  const newName = input.value.trim();
  
  if (!newName) {
    toastError("Name cannot be empty.");
    return;
  }
  
  if (newName === currentName) {
    // No change, just close modal
    closeEditAccountModal();
    return;
  }
  
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: newName })
    .eq("id", state.session.user.id);
  
  if (error) {
    console.error("Error updating account name:", error);
    toastError("Unable to update account name. Check console.");
    return;
  }
  
  // Update local state
  state.profile.full_name = newName;
  
  // Update UI
  const userNameEl = el("user-name");
  if (userNameEl) {
    userNameEl.textContent = newName;
  }
  
  // Refresh people list to show updated name
  await loadPeople();
  
  // Close modal
  closeEditAccountModal();
  
  // Close account menu
  el("account-menu")?.classList.add("hidden");
}

async function deleteAccount() {
  if (!state.profile || !state.session?.user) return;
  
  // Close edit account modal first
  closeEditAccountModal();
  
  const accountName = state.profile.full_name || state.profile.email || "your account";
  const message = `Are you sure? This will permanently delete your account, all your teams (if you're the only owner), and all associated data. This cannot be undone.`;
  
  showDeleteConfirmModal(
    accountName,
    message,
    async () => {
      // Delete the profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", state.session.user.id);
      
      if (profileError) {
        console.error("Error deleting profile:", profileError);
        toastError("Unable to delete account. Check console.");
        return;
      }
      
      // Sign out the user
      await supabase.auth.signOut();
      
      // Reset state
      resetState();
      
      // Show auth gate
      showAuthGate();
    }
  );
}

let teamAssignmentModeSelectedValue = null;

function openTeamSettingsModal() {
  if (!isOwner()) return;
  
  const modal = el("team-settings-modal");
  const nameInput = el("team-settings-name-input");
  const assignmentModeContainer = el("team-assignment-mode-container");
  
  if (!modal || !nameInput || !assignmentModeContainer) return;
  
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const currentTeamName = currentTeam?.name || "";
  nameInput.value = currentTeamName;
  
  // Reset selected value
  teamAssignmentModeSelectedValue = state.teamAssignmentMode || 'per_set';
  
  // Create simple non-searchable dropdown (looks like searchable but shows both options)
  assignmentModeContainer.innerHTML = "";
  const currentMode = state.teamAssignmentMode || 'per_set';
  const options = [
    { value: 'per_set', label: 'Per Set' },
    { value: 'per_song', label: 'Per Song' }
  ];
  teamAssignmentModeDropdown = createSimpleDropdown(options, "Select assignment mode...", currentMode);
  
  // Listen for changes
  teamAssignmentModeDropdown.addEventListener("change", (e) => {
    teamAssignmentModeSelectedValue = e.detail.value;
  });
  
  assignmentModeContainer.appendChild(teamAssignmentModeDropdown);
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeTeamSettingsModal() {
  const modal = el("team-settings-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

async function handleTeamSettingsSubmit(e) {
  e.preventDefault();
  
  if (!isOwner()) return;
  
  const modal = el("team-settings-modal");
  const nameInput = el("team-settings-name-input");
  
  if (!nameInput || !teamAssignmentModeDropdown) return;
  
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const currentTeamName = currentTeam?.name || "Team";
  const newName = nameInput.value.trim();
  
  // Get value from dropdown
  const newAssignmentMode = teamAssignmentModeDropdown.getValue() || teamAssignmentModeSelectedValue || state.teamAssignmentMode || 'per_set';
  
  if (!newName) {
    toastError("Team name cannot be empty.");
    return;
  }
  
  const updates = {};
  let hasChanges = false;
  
  if (newName !== currentTeamName) {
    updates.name = newName;
    hasChanges = true;
  }
  
  if (newAssignmentMode !== state.teamAssignmentMode) {
    updates.assignment_mode = newAssignmentMode;
    hasChanges = true;
  }
  
  if (!hasChanges) {
    // No changes, just close modal
    closeTeamSettingsModal();
    return;
  }
  
  const { error } = await supabase
    .from("teams")
    .update(updates)
    .eq("id", state.currentTeamId);
  
  if (error) {
    console.error("Error updating team settings:", error);
    toastError("Unable to save team settings. Check console.");
    return;
  }
  
  // Update local state
  if (currentTeam) {
    if (updates.name) {
      currentTeam.name = updates.name;
    }
  }
  if (state.profile?.team && updates.name) {
    state.profile.team.name = updates.name;
  }
  
  if (updates.assignment_mode) {
    state.teamAssignmentMode = updates.assignment_mode;
  }
  
  // Update team name displays
  const teamNameDisplay = el("team-name-display");
  if (teamNameDisplay && updates.name) {
    teamNameDisplay.textContent = updates.name;
  }
  
  // Refresh team switcher to show updated name
  updateTeamSwitcher();
  
  // Reload sets to reflect assignment mode changes
  await loadSets();
  
  // Update checkbox in set modal if it's open
  const setModal = el("set-modal");
  if (setModal && !setModal.classList.contains("hidden") && state.selectedSet) {
    const overrideCheckbox = el("set-override-assignment-mode");
    const overrideText = el("set-override-assignment-mode-text");
    
    if (overrideCheckbox && overrideText) {
      // Refresh selectedSet from latest loaded sets
      const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
      if (updatedSet) {
        state.selectedSet = updatedSet;
      }
      const set = state.selectedSet;
      
      // Get the effective mode (what the set is actually using)
      const effectiveMode = getSetAssignmentMode(set);
      const teamMode = state.teamAssignmentMode || 'per_set';
      
      // Check if set has an explicit override
      const overrideMode = set?.assignment_mode_override;
      const hasExplicitOverride = overrideMode !== null && overrideMode !== undefined;
      
      // Checkbox should be checked ONLY if we're actually overriding the team mode
      // 1) Explicit override exists and differs from team mode
      // 2) No explicit override but effective mode differs from team mode (legacy sets)
      overrideCheckbox.checked =
        (hasExplicitOverride && overrideMode !== teamMode) ||
        (!hasExplicitOverride && effectiveMode !== teamMode);
      
      // Update the text based on new team mode
      if (teamMode === 'per_set') {
        overrideText.textContent = 'Use per-song assignments';
      } else {
        overrideText.textContent = 'Use per-set assignments';
      }
    }
  }
  
  // Refresh detail view if it's showing
  if (state.selectedSet && !el("set-detail").classList.contains("hidden")) {
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      showSetDetail(updatedSet);
    }
  }
  
  // Close modal
  closeTeamSettingsModal();
}

async function deleteTeam() {
  if (!isOwner()) return;
  
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  if (!currentTeam) {
    console.error("Current team not found in userTeams");
    toastError("Unable to find team. Please refresh the page.");
    return;
  }
  
  const teamId = currentTeam.id;
  const teamName = currentTeam.name || "this team";
  
  // CRITICAL SAFETY CHECK: Verify the user is actually the owner of this specific team
  const { data: teamData, error: verifyError } = await supabase
    .from("teams")
    .select("id, name, owner_id")
    .eq("id", teamId)
    .eq("owner_id", state.session.user.id)
    .single();
  
  if (verifyError || !teamData) {
    console.error("Error verifying team ownership:", verifyError);
    toastError("Unable to verify team ownership. You may not be the owner of this team.");
    return;
  }
  
  // Double-check the team ID matches
  if (teamData.id !== teamId) {
    console.error("Team ID mismatch during verification");
    toastError("Team verification failed. Please refresh the page.");
    return;
  }
  
  const message = `Are you sure? This will permanently delete all sets, songs, assignments, and team members for "${teamName}". It cannot be undone. Your account will not be deleted.`;
  
  showDeleteConfirmModal(
    teamName,
    message,
    async () => {
      // TRIPLE CHECK: Verify ownership again right before deletion
      const { data: finalVerify, error: finalVerifyError } = await supabase
        .from("teams")
        .select("id, owner_id")
        .eq("id", teamId)
        .eq("owner_id", state.session.user.id)
        .single();
      
      if (finalVerifyError || !finalVerify || finalVerify.id !== teamId) {
        console.error("Final verification failed before deletion:", finalVerifyError);
        toastError("Team ownership verification failed. Deletion cancelled for safety.");
        return;
      }
      
      // Delete with explicit team ID and owner verification
      // First, verify the team still exists and we own it
      const { data: preDeleteCheck } = await supabase
        .from("teams")
        .select("id")
        .eq("id", teamId)
        .eq("owner_id", state.session.user.id)
        .single();
      
      if (!preDeleteCheck) {
        toastError("Team ownership verification failed. Deletion cancelled for safety.");
        return;
      }
      
      // CRITICAL: Verify teamId is valid and not empty
      if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
        console.error("CRITICAL: Invalid teamId for deletion:", teamId);
        toastError("ERROR: Invalid team ID. Deletion cancelled for safety.");
        return;
      }
      
      console.log(`🗑️ Attempting to delete team with ID: ${teamId}`);
      
      // CRITICAL: Get count of teams BEFORE deletion to verify only one is deleted
      const { data: teamsBeforeDelete, error: countError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("owner_id", state.session.user.id);
      
      if (countError) {
        console.error("Error counting teams before deletion:", countError);
        toastError("Unable to verify team count. Deletion cancelled for safety.");
        return;
      }
      
      const teamsCountBefore = teamsBeforeDelete?.length || 0;
      console.log(`🔍 Teams before deletion: ${teamsCountBefore}`, teamsBeforeDelete?.map(t => ({ id: t.id, name: t.name })));
      
      // Verify the team we're about to delete is in the list
      const teamToDelete = teamsBeforeDelete?.find(t => t.id === teamId);
      if (!teamToDelete) {
        console.error("CRITICAL: Team to delete not found in user's teams!");
        console.error("  - teamId:", teamId);
        console.error("  - User's teams:", teamsBeforeDelete?.map(t => t.id));
        toastError("ERROR: Team not found in your teams. Deletion cancelled for safety.");
        return;
      }
      
      console.log(`✅ Verified team to delete: ${teamToDelete.name} (${teamId})`);
      
      // CRITICAL: Double-check that we're only deleting ONE team by verifying the exact team exists
      const { data: exactTeamCheck, error: exactCheckError } = await supabase
        .from("teams")
        .select("id, name, owner_id")
        .eq("id", teamId)
        .eq("owner_id", state.session.user.id)
        .single();
      
      if (exactCheckError || !exactTeamCheck) {
        console.error("CRITICAL: Cannot verify exact team before deletion:", exactCheckError);
        toastError("ERROR: Cannot verify team before deletion. Operation cancelled for safety.");
        return;
      }
      
      if (exactTeamCheck.id !== teamId) {
        console.error("CRITICAL: Team ID mismatch in final check!");
        toastError("ERROR: Team verification failed. Operation cancelled for safety.");
        return;
      }
      
      console.log(`✅ Final verification passed. Deleting team: ${exactTeamCheck.name} (${teamId})`);
      
      // Perform the deletion using RPC function - simple direct delete
      const { data: deleteResult, error } = await supabase
        .rpc('delete_team_direct', { p_team_id: teamId });
      
      if (error) {
        console.error("Error deleting team:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        toastError("Unable to delete team. Check console.");
        return;
      }
      
      // Check if the RPC function succeeded
      if (!deleteResult || !deleteResult.success) {
        const errorMsg = deleteResult?.error || 'Unknown error';
        console.error("🚨 Team deletion failed:", errorMsg);
        toastError(`Unable to delete team: ${errorMsg}`);
        return;
      }
      
      // Success - team was deleted
      console.log(`✅ Team deleted successfully:`, deleteResult.deleted_team);
      
      // Refresh user teams (removes deleted team)
      await fetchUserTeams();
      
      // If user has other teams, switch to the first one
      if (state.userTeams.length > 0) {
        await switchTeam(state.userTeams[0].id);
      } else {
        // No teams left - show empty state
        state.currentTeamId = null;
        state.sets = [];
        state.songs = [];
        state.people = [];
        refreshActiveTab();
        showApp();
      }
    }
  );
}

function openCreateTeamModal() {
  const modal = el("create-team-modal");
  const input = el("create-team-input");
  const message = el("create-team-message");
  const submitBtn = modal?.querySelector('button[type="submit"]');
  
  if (!modal || !input) return;
  
  input.value = "";
  if (message) {
    message.textContent = "";
    message.classList.remove("error-text");
  }
  
  // Reset submit button state
  if (submitBtn) {
    submitBtn.disabled = false;
  }
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  input.focus();
}

async function handleCreateTeamSubmit(e) {
  e.preventDefault();
  
  const modal = el("create-team-modal");
  const input = el("create-team-input");
  const message = el("create-team-message");
  const submitBtn = modal?.querySelector('button[type="submit"]');
  
  if (!input) return;
  
  const teamName = input.value.trim();
  
  if (!teamName) {
    if (message) {
      message.textContent = "Team name cannot be empty.";
      message.classList.add("error-text");
    }
    return;
  }
  
  // Disable submit button
  if (submitBtn) submitBtn.disabled = true;
  if (message) {
    message.textContent = "Creating team...";
    message.classList.remove("error-text");
  }
  
  try {
    // Create the team (same logic as signup)
    let teamData;
    let teamError;
    
    // Try using the function first (works even without session)
    const { data: teamId, error: teamFunctionError } = await supabase
      .rpc('create_team_for_user', {
        p_team_name: teamName,
        p_owner_id: state.session.user.id
      });
    
    // If function doesn't exist or fails, fall back to direct insert
    if (teamFunctionError && (teamFunctionError.code === '42883' || teamFunctionError.message?.includes('function'))) {
      console.log('Function not available, trying direct insert...');
      const { data: directTeamData, error: directTeamError } = await supabase
        .from("teams")
        .insert({
          name: teamName,
          owner_id: state.session.user.id
        })
        .select()
        .single();
      
      teamData = directTeamData;
      teamError = directTeamError;
    } else if (teamFunctionError) {
      // Function exists but returned an error
      teamError = teamFunctionError;
    } else if (teamId) {
      // Function succeeded - construct team data from what we know
      teamData = {
        id: teamId,
        name: teamName,
        owner_id: state.session.user.id
      };
    } else {
      teamError = new Error('Team creation function returned no ID');
    }
    
    if (teamError) {
      console.error('Team creation error:', teamError);
      if (message) {
        message.textContent = teamError.message || "Unable to create team. Please try again.";
        message.classList.add("error-text");
      }
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    
    if (!teamData || !teamData.id) {
      console.error('Team creation failed: No team data returned');
      if (message) {
        message.textContent = "Team creation failed. Please try again.";
        message.classList.add("error-text");
      }
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    
    // Add user to team_members as owner (same pattern as signup)
    // Try using RPC function first, fallback to direct insert
    const { data: memberId, error: teamMemberFunctionError } = await supabase
      .rpc('add_team_member', {
        p_team_id: teamData.id,
        p_user_id: state.session.user.id,
        p_role: 'owner',
        p_is_owner: true,
        p_can_manage: true
      });
    
    let teamMemberError = teamMemberFunctionError;
    
    // If function doesn't exist, fall back to direct insert
    if (teamMemberFunctionError && (teamMemberFunctionError.code === '42883' || teamMemberFunctionError.message?.includes('function'))) {
      console.log('Add team member function not available, trying direct insert...');
      const { error: directMemberError } = await supabase
        .from("team_members")
        .insert({
          team_id: teamData.id,
          user_id: state.session.user.id,
          role: 'owner',
          is_owner: true,
          can_manage: true
        });
      
      teamMemberError = directMemberError;
    }
    
    if (teamMemberError) {
      console.error("Error adding user to team_members:", teamMemberError);
      // Clean up: delete the team
      await supabase.from("teams").delete().eq("id", teamData.id);
      if (message) {
        message.textContent = "Team created but failed to add you as member. Please try again.";
        message.classList.add("error-text");
      }
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    
    // Update profile.team_id to the new team (as default)
    // Use RPC function like signup does
    const { error: updateProfileFunctionError } = await supabase
      .rpc('update_profile_team_id', {
        p_user_id: state.session.user.id,
        p_team_id: teamData.id
      });
    
    let updateProfileError = updateProfileFunctionError;
    
    // If function doesn't exist, fall back to direct update
    // IMPORTANT: Explicitly preserve full_name to prevent it from being reset to email
    if (updateProfileFunctionError && (updateProfileFunctionError.code === '42883' || updateProfileFunctionError.message?.includes('function'))) {
      console.log('Update function not available, trying direct update...');
      const updateData = { team_id: teamData.id };
      
      // Preserve full_name if it exists (prevent reset to email)
      if (state.profile?.full_name) {
        updateData.full_name = state.profile.full_name;
      }
      
      const { error: directUpdateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", state.session.user.id);
      
      updateProfileError = directUpdateError;
    }
    
    if (updateProfileError) {
      console.error("Error updating profile team_id:", updateProfileError);
      // Not critical, continue anyway
    }
    
    // Refresh user teams and switch to the new team
    await fetchUserTeams();
    await switchTeam(teamData.id);
    
    // Re-enable submit button before closing modal
    if (submitBtn) submitBtn.disabled = false;
    
    // Close modal
    modal?.classList.add("hidden");
    document.body.style.overflow = "";
    input.value = "";
    
    if (message) {
      message.textContent = "";
    }
    
  } catch (err) {
    console.error("Unexpected error creating team:", err);
    if (message) {
      message.textContent = "An unexpected error occurred. Please try again.";
      message.classList.add("error-text");
    }
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function promoteToManager(personId) {
  if (!isOwner()) return;
  
  if (personId === state.profile.id) {
    toastError("You are already the team owner.");
    return;
  }
  
  // Update team_members table (multi-team support)
  const { error } = await supabase
    .from("team_members")
    .update({ 
      can_manage: true,
      role: 'manager'
    })
    .eq("team_id", state.currentTeamId)
    .eq("user_id", personId);
  
  if (error) {
    console.error("Error promoting to manager:", error);
    toastError("Unable to promote user. Check console.");
    return;
  }
  
  // Also update profiles for backward compatibility (if team_id matches)
  await supabase
    .from("profiles")
    .update({ can_manage: true })
    .eq("id", personId)
    .eq("team_id", state.currentTeamId);
  
  // Refresh all state to reflect changes
  await fetchUserTeams();
  await fetchProfile();
  await loadPeople();
  
  toastSuccess("User promoted to manager.");
}

async function demoteFromManager(personId) {
  if (!isOwner()) return;
  
  if (personId === state.profile.id) {
    toastError("You cannot demote yourself. Transfer ownership first.");
    return;
  }
  
  // Update team_members table (multi-team support)
  const { error } = await supabase
    .from("team_members")
    .update({ 
      can_manage: false,
      role: 'member'
    })
    .eq("team_id", state.currentTeamId)
    .eq("user_id", personId);
  
  if (error) {
    console.error("Error demoting manager:", error);
    toastError("Unable to demote user. Check console.");
    return;
  }
  
  // Also update profiles for backward compatibility (if team_id matches)
  await supabase
    .from("profiles")
    .update({ can_manage: false })
    .eq("id", personId)
    .eq("team_id", state.currentTeamId);
  
  // Refresh all state to reflect changes
  await fetchUserTeams();
  await fetchProfile();
  await loadPeople();
  
  toastSuccess("User demoted from manager.");
}

async function transferOwnership(person) {
  console.log('🔄 transferOwnership() called');
  console.log('  - Current owner ID:', state.profile.id);
  console.log('  - New owner ID:', person.id);
  console.log('  - Team ID:', state.currentTeamId);
  
  if (!isOwner()) {
    console.log('  - ❌ User is not owner, aborting');
    return;
  }
  
  if (person.id === state.profile.id) {
    toastError("You are already the team owner.");
    return;
  }
  
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const teamName = currentTeam?.name || state.profile?.team?.name || "this team";
  const message = `Transfer ownership of "${teamName}" to ${person.full_name || person.email}? This will make them the team owner and you will become a manager.`;
  
  showDeleteConfirmModal(
    teamName,
    message,
    async () => {
      console.log('✅ Transfer confirmed, starting ownership transfer...');
      
      // First, check current state before transfer
      console.log('📊 Checking current state before transfer...');
      const { data: beforeState } = await supabase
        .from("team_members")
        .select("user_id, is_owner, can_manage, role")
        .eq("team_id", state.currentTeamId)
        .in("user_id", [state.profile.id, person.id]);
      console.log('  - Before state:', beforeState);
      
      const { data: teamBefore } = await supabase
        .from("teams")
        .select("id, owner_id")
        .eq("id", state.currentTeamId)
        .single();
      console.log('  - Team before:', teamBefore);
      console.log('  - Expected owner_id (state.profile.id):', state.profile.id);
      console.log('  - Actual owner_id in DB:', teamBefore?.owner_id);
      console.log('  - Match:', teamBefore?.owner_id === state.profile.id);
      
      // Use RPC function to transfer ownership atomically
      // This avoids trigger conflicts and ensures the transfer happens in a single transaction
      console.log('🔧 Attempting RPC function transfer...');
      const { data: result, error: rpcError } = await supabase
        .rpc('transfer_team_ownership', {
          p_team_id: state.currentTeamId,
          p_current_owner_id: state.profile.id,
          p_new_owner_id: person.id
        });
      
      console.log('  - RPC result:', result);
      console.log('  - RPC error:', rpcError);
      
      // Check if RPC function doesn't exist or if it failed
      const shouldUseManual = 
        (rpcError && (rpcError.code === '42883' || rpcError.message?.includes('function'))) ||
        (result && !result.success);
      
      if (shouldUseManual) {
        if (result && !result.success) {
          console.log('⚠️ RPC function returned error:', result.error);
          console.log('⚠️ Falling back to manual transfer...');
        } else {
          console.log('⚠️ RPC function not available, using manual transfer...');
        }
        
        // Manual transfer fallback
        // IMPORTANT: Promote new owner FIRST, then demote old owner
        // This ensures the old owner can still update team_members because they're still an owner
        // Then update teams.owner_id last
        
        // Step 1: Promote new owner FIRST (old owner is still owner, so RLS allows this)
        console.log('📝 Step 1: Promoting new owner...');
        console.log('  - Checking if new owner exists in team_members...');
        const { data: newOwnerBefore } = await supabase
          .from("team_members")
          .select("user_id, is_owner, can_manage, role")
          .eq("team_id", state.currentTeamId)
          .eq("user_id", person.id)
          .single();
        console.log('  - New owner before update:', newOwnerBefore);
        
        if (!newOwnerBefore) {
          console.error("❌ New owner not found in team_members!");
          toastError("New owner is not a member of this team. Transfer cancelled.");
          return;
        }
        
        // Check if there are any other owners that might block the constraint
        console.log('  - Checking for other owners in team...');
        const { data: otherOwners } = await supabase
          .from("team_members")
          .select("user_id, is_owner")
          .eq("team_id", state.currentTeamId)
          .eq("is_owner", true);
        console.log('  - Other owners found:', otherOwners);
        
        console.log('  - Attempting to update new owner to is_owner=true...');
        const { data: newOwnerUpdateData, error: newOwnerError } = await supabase
          .from("team_members")
          .update({ 
            is_owner: true,
            can_manage: true,
            role: 'owner'
          })
          .eq("team_id", state.currentTeamId)
          .eq("user_id", person.id)
          .select();
        
        console.log('  - New owner update result:', newOwnerUpdateData);
        console.log('  - New owner update error:', newOwnerError);
        console.log('  - Rows updated:', newOwnerUpdateData?.length || 0);
        
        if (newOwnerError) {
          console.error("❌ Error updating new owner:", newOwnerError);
          console.error("  - Error code:", newOwnerError.code);
          console.error("  - Error message:", newOwnerError.message);
          console.error("  - Error details:", newOwnerError.details);
          console.error("  - Error hint:", newOwnerError.hint);
          toastError(`Unable to transfer ownership: ${newOwnerError.message || 'Unknown error'}. Check console for details.`);
          return;
        }
        
        if (!newOwnerUpdateData || newOwnerUpdateData.length === 0) {
          console.error("❌ Update returned 0 rows - no rows were updated!");
          console.error("  - This might be due to RLS policy blocking the update");
          console.error("  - Current user might not be recognized as owner");
          console.error("  - Checking current state of all team members...");
          const { data: allMembers } = await supabase
            .from("team_members")
            .select("user_id, is_owner, can_manage, role")
            .eq("team_id", state.currentTeamId);
          console.error("  - All team members:", allMembers);
          
          // Check teams.owner_id vs team_members.is_owner
          const { data: teamCheck } = await supabase
            .from("teams")
            .select("id, owner_id")
            .eq("id", state.currentTeamId)
            .single();
          console.error("  - teams.owner_id:", teamCheck?.owner_id);
          console.error("  - Current user ID:", state.profile.id);
          console.error("  - Match:", teamCheck?.owner_id === state.profile.id);
          
          toastError("Failed to promote new owner. The RLS policy might be blocking the update. Check console for details.");
          return;
        }
        
        // Verify new owner was promoted
        const { data: verifyNewOwner } = await supabase
          .from("team_members")
          .select("user_id, is_owner, can_manage, role")
          .eq("team_id", state.currentTeamId)
          .eq("user_id", person.id)
          .single();
        console.log('  - New owner after promotion:', verifyNewOwner);
        
        if (verifyNewOwner?.is_owner !== true) {
          console.error("❌ New owner was not properly promoted:", verifyNewOwner);
          console.error("  - Expected is_owner: true");
          console.error("  - Actual is_owner:", verifyNewOwner?.is_owner);
          toastError("Failed to promote new owner. Transfer cancelled.");
          return;
        }
        
        // Step 2: Demote old owner (new owner is now owner, so they can do it, OR old owner can still do it)
        console.log('📝 Step 2: Demoting old owner...');
        const { data: oldOwnerUpdateData, error: oldOwnerError } = await supabase
          .from("team_members")
          .update({ 
            is_owner: false,
            can_manage: true,
            role: 'manager'
          })
          .eq("team_id", state.currentTeamId)
          .eq("user_id", state.profile.id)
          .select();
        
        console.log('  - Old owner update result:', oldOwnerUpdateData);
        console.log('  - Old owner update error:', oldOwnerError);
        
        if (oldOwnerError) {
          console.error("❌ Error updating old owner:", oldOwnerError);
          // Revert new owner promotion
          await supabase
            .from("team_members")
            .update({ is_owner: false, can_manage: person.can_manage || false, role: person.role || 'member' })
            .eq("team_id", state.currentTeamId)
            .eq("user_id", person.id);
          toastError(`Unable to transfer ownership: ${oldOwnerError.message || 'Unknown error'}. Check console.`);
          return;
        }
        
        // Verify old owner was demoted
        const { data: verifyOldOwner } = await supabase
          .from("team_members")
          .select("user_id, is_owner, can_manage, role")
          .eq("team_id", state.currentTeamId)
          .eq("user_id", state.profile.id)
          .single();
        console.log('  - Old owner after demotion:', verifyOldOwner);
        
        if (verifyOldOwner?.is_owner !== false) {
          console.error("❌ Old owner was not properly demoted:", verifyOldOwner);
          // Revert new owner promotion
          await supabase
            .from("team_members")
            .update({ is_owner: false, can_manage: person.can_manage || false, role: person.role || 'member' })
            .eq("team_id", state.currentTeamId)
            .eq("user_id", person.id);
          toastError("Failed to demote old owner. Transfer cancelled.");
          return;
        }
        
        // Step 3: Update profiles for backward compatibility
        // Note: profiles table might have team_id set to a different team or null
        // So we update without the team_id filter to ensure it works
        console.log('📝 Step 3: Updating profiles...');
        console.log('  - Updating old owner profile (id:', state.profile.id, ')');
        const { data: profileOldData, error: profileOldError } = await supabase
          .from("profiles")
          .update({ is_owner: false, can_manage: true })
          .eq("id", state.profile.id)
          .select();
        console.log('  - Old profile update result:', profileOldData);
        console.log('  - Old profile update error:', profileOldError);
        console.log('  - Rows updated:', profileOldData?.length || 0);
        
        // Also try with team_id filter in case it's set
        if (state.currentTeamId) {
          const { error: profileOldError2 } = await supabase
            .from("profiles")
            .update({ is_owner: false, can_manage: true })
            .eq("id", state.profile.id)
            .eq("team_id", state.currentTeamId);
          if (!profileOldError2) {
            console.log('  - Also updated old profile with team_id filter');
          }
        }
        
        console.log('  - Updating new owner profile (id:', person.id, ')');
        const { data: profileNewData, error: profileNewError } = await supabase
          .from("profiles")
          .update({ is_owner: true, can_manage: true })
          .eq("id", person.id)
          .select();
        console.log('  - New profile update result:', profileNewData);
        console.log('  - New profile update error:', profileNewError);
        console.log('  - Rows updated:', profileNewData?.length || 0);
        
        // Also try with team_id filter in case it's set
        if (state.currentTeamId) {
          const { error: profileNewError2 } = await supabase
            .from("profiles")
            .update({ is_owner: true, can_manage: true })
            .eq("id", person.id)
            .eq("team_id", state.currentTeamId);
          if (!profileNewError2) {
            console.log('  - Also updated new profile with team_id filter');
          }
        }
        
        // Step 4: Update team's owner_id LAST (after both team_members updates)
        // NOTE: The trigger sync_team_owner_id should automatically update teams.owner_id
        // when team_members.is_owner changes, but we update it explicitly to ensure it's correct
        // and to handle cases where the trigger might not fire
        console.log('📝 Step 4: Updating team owner_id...');
        console.log('  - Updating team', state.currentTeamId, 'to owner', person.id);
        
        // CRITICAL: Verify that team_members was actually updated before updating teams.owner_id
        // This prevents the broken state where teams.owner_id is updated but team_members isn't
        const { data: finalCheck } = await supabase
          .from("team_members")
          .select("user_id, is_owner")
          .eq("team_id", state.currentTeamId)
          .in("user_id", [state.profile.id, person.id]);
        
        console.log('  - Final check of team_members:', finalCheck);
        
        const newOwnerInMembers = finalCheck?.find(m => m.user_id === person.id);
        const oldOwnerInMembers = finalCheck?.find(m => m.user_id === state.profile.id);
        
        if (!newOwnerInMembers || newOwnerInMembers.is_owner !== true) {
          console.error("❌ CRITICAL: New owner is not marked as owner in team_members!");
          console.error("  - New owner data:", newOwnerInMembers);
          console.error("  - Cannot update teams.owner_id - team_members update failed");
          console.error("  - This would create a broken state where teams.owner_id doesn't match team_members");
          
          // Try to revert old owner back to owner to prevent broken state
          console.log('  - Attempting to revert old owner to prevent broken state...');
          await supabase
            .from("team_members")
            .update({ is_owner: true, can_manage: true, role: 'owner' })
            .eq("team_id", state.currentTeamId)
            .eq("user_id", state.profile.id);
          
          toastError("Failed to update team_members. The RLS policy might be blocking the update. Transfer cancelled. Check console.");
          return;
        }
        
        if (oldOwnerInMembers && oldOwnerInMembers.is_owner !== false) {
          console.error("❌ CRITICAL: Old owner is still marked as owner in team_members!");
          console.error("  - Old owner data:", oldOwnerInMembers);
          console.error("  - Cannot update teams.owner_id - team_members update incomplete");
          
          // Revert new owner promotion
          console.log('  - Reverting new owner promotion...');
          await supabase
            .from("team_members")
            .update({ is_owner: false, can_manage: person.can_manage || false, role: person.role || 'member' })
            .eq("team_id", state.currentTeamId)
            .eq("user_id", person.id);
          
          toastError("Failed to demote old owner. Transfer cancelled. Check console.");
          return;
        }
        
        const { data: teamUpdateData, error: teamError } = await supabase
          .from("teams")
          .update({ owner_id: person.id })
          .eq("id", state.currentTeamId)
          .select();
        
        console.log('  - Team update result:', teamUpdateData);
        console.log('  - Team update error:', teamError);
        console.log('  - Rows updated:', teamUpdateData?.length || 0);
        
        if (teamError) {
          console.error("❌ Error updating team owner_id:", teamError);
          // Try to revert team_members changes
          await supabase
            .from("team_members")
            .update({ is_owner: true, can_manage: true, role: 'owner' })
            .eq("team_id", state.currentTeamId)
            .eq("user_id", state.profile.id);
          await supabase
            .from("team_members")
            .update({ is_owner: false, can_manage: person.can_manage || false, role: person.role || 'member' })
            .eq("team_id", state.currentTeamId)
            .eq("user_id", person.id);
          toastError(`Unable to transfer ownership: ${teamError.message || 'Unknown error'}. Changes reverted. Check console.`);
          return;
        }
        
        // Verify team was updated
        const { data: verifyTeam } = await supabase
          .from("teams")
          .select("id, owner_id")
          .eq("id", state.currentTeamId)
          .single();
        console.log('  - Team after update:', verifyTeam);
        
        // Final verification: ensure teams.owner_id matches team_members.is_owner
        if (verifyTeam?.owner_id !== person.id) {
          console.error("❌ CRITICAL: teams.owner_id does not match new owner!");
          console.error("  - Expected owner_id:", person.id);
          console.error("  - Actual owner_id:", verifyTeam?.owner_id);
          toastError("Transfer incomplete: teams.owner_id was not updated correctly. Check console.");
          return;
        }
      } else if (rpcError && !(rpcError.code === '42883' || rpcError.message?.includes('function'))) {
        // RPC function exists but returned a real error (not "function doesn't exist")
        console.error("❌ Error transferring ownership via RPC:", rpcError);
        const errorMsg = rpcError.message || 'Unknown error';
        toastError(`Unable to transfer ownership: ${errorMsg}. Check console.`);
        return;
      } else if (result && result.success) {
        // RPC function succeeded
        console.log('✅ RPC function succeeded:', result);
      } else {
        // This shouldn't happen, but just in case
        console.error("❌ Unexpected RPC result:", result, rpcError);
        toastError('Unexpected error during ownership transfer. Check console.');
        return;
      }
      
      // Verify final state after all operations
      console.log('📊 Checking final state after transfer...');
      const { data: afterState } = await supabase
        .from("team_members")
        .select("user_id, is_owner, can_manage, role")
        .eq("team_id", state.currentTeamId)
        .in("user_id", [state.profile.id, person.id]);
      console.log('  - After state:', afterState);
      
      const { data: teamAfter } = await supabase
        .from("teams")
        .select("id, owner_id")
        .eq("id", state.currentTeamId)
        .single();
      console.log('  - Team after:', teamAfter);
      
      // Step 5: Refresh all state
      console.log('🔄 Refreshing state...');
      // Add a small delay to ensure database has fully updated
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchUserTeams();
      await fetchProfile();
      // Force reload people to ensure fresh data
      await loadPeople();
      // Reload people again after a brief delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadPeople();
      
      // Check state after refresh
      console.log('📊 State after refresh:');
      console.log('  - Current user isOwner():', isOwner());
      console.log('  - Current user profile:', state.profile);
      const currentTeamAfter = state.userTeams.find(t => t.id === state.currentTeamId);
      console.log('  - Current team:', currentTeamAfter);
      
      // Refresh UI - showApp() updates owner-only UI elements like delete team button
      updateTeamSwitcher();
      refreshActiveTab();
      showApp();
      
      toastSuccess("Ownership transferred successfully. You are now a manager.");
    },
    {
      title: "Transfer Ownership",
      buttonText: "Transfer"
    }
  );
}

init();

