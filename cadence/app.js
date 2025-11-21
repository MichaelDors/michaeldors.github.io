import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const SUPABASE_URL = "https://pvqrxkbyjhgomwqwkedw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cXJ4a2J5amhnb213cXdrZWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg1NTQsImV4cCI6MjA3ODEwNDU1NH0.FWrCZOExwjhfihh7nSZFR2FkIhcJjVyDo0GdDaGKg1g";

if (SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
  console.warn("Update SUPABASE_URL and SUPABASE_ANON_KEY before deploying.");
}

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
  isMemberView: false, // Track if manager is viewing as member
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
const logoutBtn = el("btn-logout");
const userInfo = el("user-info");
const userName = el("user-name");
const createSetBtn = el("btn-create-set");
const setsList = el("sets-list");
const yourSetsList = el("your-sets-list");
const setModal = el("set-modal");
const songModal = el("song-modal");
const authForm = el("auth-form");
const loginEmailInput = el("login-email");
const loginPasswordInput = el("login-password");
const authMessage = el("auth-message");
const authSubmitBtn = el("auth-submit-btn");
// No manual signup allowed - users must be invited
let isSignUpMode = false; // Always false, kept for compatibility but never used

// Helper function to check if user has manager permissions
// Returns false if in member view mode, even if user is a manager
function isManager() {
  return state.profile?.can_manage && !state.isMemberView;
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
    
    // Skip normal flow if we're in password setup mode and no session
    if (state.isPasswordSetup && !session) {
      console.log('  - Password setup mode, skipping normal auth flow');
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
      
      // Load data in background (non-blocking)
      Promise.all([loadSongs(), loadSets(), loadPeople()]).then(() => {
        console.log('  - Data loading complete');
        // Refresh the active tab to show newly loaded data
        refreshActiveTab();
      }).catch(err => {
        console.error('  - Error loading data:', err);
      });
      
      // Fetch profile in background with timeout
      const profileTimeout = setTimeout(() => {
        console.log('  - ⚠️ Profile fetch timeout, keeping temporary profile');
        isProcessingSession = false;
      }, 2000); // 2 second timeout
      
      fetchProfile().then(() => {
        clearTimeout(profileTimeout);
        console.log('  - Profile fetch complete, state.profile:', state.profile);
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
    Promise.all([loadSongs(), loadSets(), loadPeople()]).then(() => {
      console.log('✅ Data loading complete');
      // Refresh the active tab to show newly loaded data
      refreshActiveTab();
    }).catch(err => {
      console.error('❌ Error loading data:', err);
    });
    
    // Fetch profile in background with timeout
    const profileTimeout = setTimeout(() => {
      console.log('  - ⚠️ Profile fetch timeout, keeping temporary profile');
      isProcessingSession = false;
    }, 2000); // 2 second timeout
    
    fetchProfile().then(() => {
      clearTimeout(profileTimeout);
      console.log('✅ Profile fetch complete, state.profile:', state.profile);
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
    // Don't clear it yet if we're showing password setup
    if (!state.isPasswordSetup) {
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
  
  authForm?.addEventListener("submit", handleAuth);
  // No signup functionality - users must be invited by a manager
  logoutBtn?.addEventListener("click", () => supabase.auth.signOut());
  
  // Password setup form
  const passwordSetupForm = el("password-setup-form");
  passwordSetupForm?.addEventListener("submit", handlePasswordSetup);
  createSetBtn?.addEventListener("click", () => openSetModal());
  el("btn-invite-member")?.addEventListener("click", () => openInviteModal());
  
  // Member view toggle
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
  el("btn-edit-set-detail")?.addEventListener("click", () => {
    if (state.selectedSet) {
      // Preserve the set before hiding detail view (which clears state.selectedSet)
      const setToEdit = state.selectedSet;
      openSetModal(setToEdit);
      hideSetDetail();
      // Restore state.selectedSet after opening modal (since openSetModal sets it)
      state.selectedSet = setToEdit;
    }
  });
  el("btn-delete-set-detail")?.addEventListener("click", () => {
    if (state.selectedSet) {
      deleteSet(state.selectedSet);
      hideSetDetail();
    }
  });
  el("close-set-modal")?.addEventListener("click", () => closeSetModal());
  el("cancel-set")?.addEventListener("click", () => closeSetModal());
  el("set-form")?.addEventListener("submit", handleSetSubmit);
  el("btn-add-service-time")?.addEventListener("click", () => addServiceTimeRow());
  el("btn-add-rehearsal-time")?.addEventListener("click", () => addRehearsalTimeRow());
  el("btn-add-song")?.addEventListener("click", () => openSongModal());
  el("close-song-modal")?.addEventListener("click", () => closeSongModal());
  el("cancel-song")?.addEventListener("click", () => closeSongModal());
  el("song-form")?.addEventListener("submit", handleAddSongToSet);
  el("create-song-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    state.creatingSongFromModal = true;
    // Don't close the song modal, just open the edit modal on top
    openSongEditModal();
  });
  el("btn-add-assignment")?.addEventListener("click", addAssignmentInput);
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
  el("btn-add-song-link")?.addEventListener("click", () => addSongLinkInput());
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
  
  if (authGate) authGate.classList.remove("hidden");
  if (dashboard) dashboard.classList.add("hidden");
  if (userInfo) userInfo.classList.add("hidden");
  if (createSetBtn) createSetBtn.classList.add("hidden");
  setAuthMessage("");
  isSignUpMode = false;
  updateAuthUI();
  
  console.log('  - authGate hidden class removed:', !authGate?.classList.contains('hidden'));
  console.log('  - dashboard hidden class added:', dashboard?.classList.contains('hidden'));
}

function showPasswordSetupGate() {
  console.log('🔐 showPasswordSetupGate() called');
  
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
  
  // Force hide auth gate, password setup gate, and show dashboard
  authGateEl.classList.add("hidden");
  if (passwordSetupGateEl) passwordSetupGateEl.classList.add("hidden");
  dashboardEl.classList.remove("hidden");
  
  // Ensure set detail view is hidden when showing dashboard
  hideSetDetail();
  
  // Restore the saved tab, defaulting to "sets" if none is saved
  const savedTab = localStorage.getItem('cadence-active-tab') || 'sets';
  switchTab(savedTab);
  
  if (userInfoEl) {
    userInfoEl.classList.remove("hidden");
  }
  
  if (userNameEl) {
    userNameEl.textContent = state.profile?.full_name ?? "Signed In";
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

function resetState() {
  state.profile = null;
  state.sets = [];
  state.songs = [];
  state.people = [];
  state.pendingInvites = [];
  state.selectedSet = null;
  state.currentSetSongs = [];
  setsList.innerHTML = "";
}

// toggleAuthMode removed - no manual signup allowed
// Users must be invited by a manager

function updateAuthUI() {
  // Always show login mode - no manual signup allowed
  // Users must be invited by a manager
  const heading = authGate?.querySelector("h2");
  const description = authGate?.querySelector("p:first-of-type");
  
  if (heading) heading.textContent = "Login";
  if (description) description.textContent = "Sign in with your email and password.";
  if (authSubmitBtn) authSubmitBtn.textContent = "Sign in";
  
  // Remove any signup toggle if it exists
  const toggleSignup = el("toggle-signup");
  const toggleParagraph = toggleSignup?.parentElement;
  if (toggleParagraph && toggleSignup) {
    toggleParagraph.style.display = "none";
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
  setAuthMessage("Signing in…");

  // No manual signup allowed - only login
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
    setAuthMessage(error.message || "Unable to sign in. Please check your credentials.", true);
    toggleAuthButton(false);
  } else {
    // Fallback - onAuthStateChange should handle this
    setAuthMessage("");
    authForm?.reset();
    toggleAuthButton(false);
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
  setPasswordSetupMessage("Setting up your account...");
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
      setPasswordSetupMessage("Invalid invite link. Please request a new invite.", true);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    
    console.log('✅ Session found, updating password for user:', session.user.email);
    
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
    
    // Create profile and migrate pending invites with timeout
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
  
  // Find the pending invite
  const { data: pendingInvite, error: inviteError } = await supabase
    .from("pending_invites")
    .select("*")
    .eq("email", userEmail)
    .maybeSingle();
  
  if (inviteError && inviteError.code !== "PGRST116") {
    console.error('❌ Error finding pending invite:', inviteError);
  }
  
  const fullName = pendingInvite?.full_name || user.user_metadata?.full_name || userEmail;
  
  // Create the profile
  const { data: newProfile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      full_name: fullName,
      email: userEmail,
    })
    .select()
    .single();
  
  if (profileError) {
    console.error('❌ Error creating profile:', profileError);
    // Profile might already exist, try to update it
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        email: userEmail,
      })
      .eq("id", user.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      return;
    }
    
    console.log('✅ Profile updated:', updatedProfile);
    state.profile = updatedProfile;
  } else {
    console.log('✅ Profile created:', newProfile);
    state.profile = newProfile;
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
    
    // Wrap query in timeout to prevent hanging
    const queryPromise = supabase
      .from("profiles")
      .select("*")
      .eq("id", state.session.user.id)
      .single();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Profile query timeout after 2 seconds')), 2000)
    );
    
    let data, error;
    try {
      const result = await Promise.race([queryPromise, timeoutPromise]);
      data = result.data;
      error = result.error;
    } catch (timeoutErr) {
      console.error('  - ⚠️ Query timed out:', timeoutErr.message);
      throw timeoutErr;
    }

    console.log('  - Query completed. Error:', error?.code || 'none');
    console.log('  - Data:', data ? 'found' : 'not found');

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
      const insertPromise = supabase
        .from("profiles")
        .insert({
          id: state.session.user.id,
          full_name: state.session.user.user_metadata.full_name || state.session.user.email || "New User",
          email: state.session.user.email || null,
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
      console.log('  - ✅ Profile found:', data);
      console.log('  - can_manage:', data.can_manage);
    }
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

async function loadSongs() {
  const { data, error } = await supabase
    .from("songs")
    .select(`
      *,
      song_links (
        id,
        title,
        url
      )
    `)
    .order("title");
  if (error) {
    console.error(error);
    return;
  }
  state.songs = data;
}

async function loadSets() {
  // Try to load with service/rehearsal times first
  let { data, error } = await supabase
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
      set_songs (
        id,
        sequence_order,
        notes,
        song:song_id (
          id, title, bpm, song_key, time_signature, duration_seconds, description,
          song_links (
            id,
            title,
            url
          )
        ),
        song_assignments (
          id,
          person_id,
          person_name,
          person_email,
          pending_invite_id,
          role,
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
    .order("scheduled_date", { ascending: true });

  // If error is due to missing tables (service_times or rehearsal_times), fall back to query without them
  if (error && (error.message?.includes("service_times") || error.message?.includes("rehearsal_times") || error.code === "PGRST116" || error.code === "42P01")) {
    console.warn("service_times or rehearsal_times tables not found, loading sets without them:", error.message);
    const fallbackResult = await supabase
      .from("sets")
      .select(
        `
        *,
        set_songs (
          id,
          sequence_order,
          notes,
          song:song_id (
            id, title, bpm, song_key, time_signature, duration_seconds, description,
            song_links (
              id,
              title,
              url
            )
          ),
          song_assignments (
            id,
            person_id,
            person_name,
            person_email,
            pending_invite_id,
            role,
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
      .order("scheduled_date", { ascending: true });
    
    if (fallbackResult.error) {
      console.error("Error loading sets:", fallbackResult.error);
      state.sets = [];
      renderSets();
      return;
    }
    
    data = fallbackResult.data;
    // Add empty arrays for service_times and rehearsal_times if they don't exist
    if (data) {
      data = data.map(set => ({
        ...set,
        service_times: [],
        rehearsal_times: []
      }));
    }
  } else if (error) {
    console.error("Error loading sets:", error);
    state.sets = [];
    renderSets();
    return;
  }

  state.sets = data ?? [];
  renderSets();
}

function isUserAssignedToSet(set, userId) {
  if (!userId || !set.set_songs) return false;
  
  // Check if user is assigned to any song in this set
  return set.set_songs.some(setSong => 
    setSong.song_assignments?.some(assignment => 
      assignment.person_id === userId
    )
  );
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

  // Render "Your Sets" section
  if (yourSetsList) {
    if (yourSets.length === 0) {
      yourSetsList.innerHTML = `<p class="muted">You're not assigned to any sets yet.</p>`;
    } else {
      yourSets.forEach((set) => {
        renderSetCard(set, yourSetsList);
      });
    }
  }

  // Render "All Sets" section
  if (allSets.length === 0) {
    setsList.innerHTML = `<p class="muted">No sets scheduled yet.</p>`;
  } else {
    allSets.forEach((set) => {
      renderSetCard(set, setsList);
    });
  }
}

function switchTab(tabName) {
  // Hide set detail view when switching tabs
  hideSetDetail();
  
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
  const [
    { data: profiles, error: profilesError },
    { data: pendingInvites, error: pendingError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("full_name"),
    supabase
      .from("pending_invites")
      .select("*")
      .is("resolved_at", null)
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  if (profilesError) {
    console.error("Error loading people:", profilesError);
    return;
  }

  if (pendingError) {
    console.error("Error loading pending invites:", pendingError);
  }

  state.people = profiles || [];
  state.pendingInvites = pendingInvites || [];
  renderPeople();
}

function renderPeople() {
  const peopleList = el("people-list");
  if (!peopleList) return;
  
  const searchInput = el("people-tab-search");
  const isManagerCheck = isManager();
  const searchTermRaw = searchInput ? searchInput.value.trim() : "";
  const searchTerm = searchTermRaw.toLowerCase();
  
  peopleList.innerHTML = "";
  
  // Add invite card for managers (always show, not affected by search)
  if (isManager()) {
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
                ${person.can_manage ? '<span class="person-role">Manager</span>' : '<span class="person-role">Member</span>'}
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0;">
              <button class="btn small secondary edit-person-btn" data-person-id="${person.id}">Edit</button>
              <button class="btn small ghost delete-person-btn" data-person-id="${person.id}">Remove</button>
            </div>
          </div>
        `;
        
        const editBtn = div.querySelector(".edit-person-btn");
        if (editBtn) {
          editBtn.addEventListener("click", () => openEditPersonModal(person));
        }
        
        const deleteBtn = div.querySelector(".delete-person-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", () => deletePerson(person));
        }
      } else {
        // Regular user view: just show name and role
        const highlightedName = searchTermRaw ? highlightMatch(person.full_name || "", searchTermRaw) : escapeHtml(person.full_name || "");
        div.innerHTML = `
          <h3 class="person-name">${highlightedName}</h3>
          ${person.can_manage ? '<span class="person-role">Manager</span>' : '<span class="person-role">Member</span>'}
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
  const timesTab = el("set-detail-tab-times");
  
  if (!songsTab || !timesTab) {
    console.error("Tab content elements not found", { songsTab, timesTab });
    return;
  }
  
  if (tabName === "songs") {
    songsTab.classList.remove("hidden");
    timesTab.classList.add("hidden");
  } else if (tabName === "times") {
    songsTab.classList.add("hidden");
    timesTab.classList.remove("hidden");
  }
}

function showSetDetail(set) {
  state.selectedSet = set;
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
  
  // Show/hide edit/delete buttons for managers
  const editBtn = el("btn-edit-set-detail");
  const deleteBtn = el("btn-delete-set-detail");
  if (isManager()) {
    editBtn.classList.remove("hidden");
    deleteBtn.classList.remove("hidden");
  } else {
    editBtn.classList.add("hidden");
    deleteBtn.classList.add("hidden");
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
  
  // Ensure songs tab is visible initially
  const songsTab = el("set-detail-tab-songs");
  const timesTab = el("set-detail-tab-times");
  if (songsTab) songsTab.classList.remove("hidden");
  if (timesTab) timesTab.classList.add("hidden");
  
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
  
  // Render existing songs
  if (set.set_songs?.length) {
      set.set_songs
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .forEach((setSong, index) => {
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
        
        songNode.querySelector(".song-title").textContent =
          setSong.song?.title ?? "Untitled";
        songNode.querySelector(".song-meta").textContent = [
          setSong.song?.song_key,
          setSong.song?.time_signature,
          setSong.song?.bpm ? `${setSong.song.bpm} BPM` : null,
          setSong.song?.duration_seconds ? formatDuration(setSong.song.duration_seconds) : null,
        ]
          .filter(Boolean)
          .join(" • ");
        songNode.querySelector(".song-notes").textContent =
          setSong.notes || "";

        const assignmentsWrap = songNode.querySelector(".assignments");
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
            const isPending = Boolean(assignment.pending_invite_id);
            const personName =
              assignment.person?.full_name ||
              assignment.pending_invite?.full_name ||
              assignment.person_name ||
              assignment.person_email ||
              assignment.pending_invite?.email ||
              "Unknown";
            if (personEl) {
              personEl.textContent = personName;
              if (isPending) {
                const pendingTag = document.createElement("span");
                pendingTag.className = "pending-inline-tag";
                pendingTag.textContent = " (Pending)";
                personEl.appendChild(pendingTag);
              }
            }
            const pillRoot = pill.querySelector(".assignment-pill");
            if (isPending && pillRoot) {
              pillRoot.classList.add("pending");
            }
            assignmentsWrap.appendChild(pill);
          });
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
              const songTitle = setSong.song?.title || "this song";
              showDeleteConfirmModal(
                songTitle,
                `Remove "${songTitle}" from this set?`,
                async () => {
                  await removeSongFromSet(setSong.id, set.id);
                }
              );
            });
          }
        }
        
        // Add view details button
        const viewDetailsBtn = songNode.querySelector(".view-song-details-btn");
        if (viewDetailsBtn && setSong.song) {
          viewDetailsBtn.dataset.songId = setSong.song.id;
          viewDetailsBtn.addEventListener("click", () => {
            openSongDetailsModal(setSong.song);
          });
        }

        songsList.appendChild(songNode);
      });
    
    // Setup drag and drop for songs (managers only)
    if (isManager()) {
      setupSongDragAndDrop(songsList);
    }
  }
  
  // Add "Add Song" card at the end for managers
  if (isManager()) {
    const addCard = document.createElement("div");
    addCard.className = "card set-song-card add-song-card";
    addCard.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; cursor: pointer; min-height: 150px;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">+</div>
        <h4 style="margin: 0; color: var(--text-primary);">Add Song</h4>
      </div>
    `;
    addCard.addEventListener("click", () => {
      if (state.selectedSet) {
        openSongModal();
      }
    });
    songsList.appendChild(addCard);
  } else if (!set.set_songs?.length) {
    songsList.innerHTML = '<p class="muted">No songs added to this set yet.</p>';
  }
}

function hideSetDetail() {
  const dashboard = el("dashboard");
  const detailView = el("set-detail");
  
  dashboard.classList.remove("hidden");
  detailView.classList.add("hidden");
  state.selectedSet = null;
}

// Drag and Drop Functions
function setupSongDragAndDrop(container) {
  const items = container.querySelectorAll(".set-song-card.draggable-item");
  
  items.forEach((item) => {
    // Only allow dragging from the drag handle
    const dragHandle = item.querySelector(".drag-handle");
    if (dragHandle) {
      dragHandle.addEventListener("mousedown", (e) => {
        item.draggable = true;
      });
    }
    
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.dataset.setSongId);
      item.classList.add("dragging");
      // Hide the dragging element visually but keep it in the DOM for positioning
      item.style.opacity = "0.5";
    });
    
    item.addEventListener("dragend", (e) => {
      item.classList.remove("dragging");
      item.style.opacity = "";
      item.draggable = false;
      // Remove any drag-over classes
      container.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
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
      
      const afterElement = getDragAfterElement(container, e.clientY, dragging);
      
      // Remove drag-over from all items
      container.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
      
      if (afterElement == null) {
        // Check if we should append before the "Add Song" card
        const addCard = container.querySelector(".add-song-card");
        if (addCard && addCard.previousSibling !== dragging) {
          container.insertBefore(dragging, addCard);
          // Add indicator before add card
          const indicator = document.createElement("div");
          indicator.className = "drop-indicator";
          container.insertBefore(indicator, addCard);
        } else if (!addCard) {
          container.appendChild(dragging);
          // Add indicator at the end
          const indicator = document.createElement("div");
          indicator.className = "drop-indicator";
          container.appendChild(indicator);
        }
      } else {
        container.insertBefore(dragging, afterElement);
        // Add indicator before afterElement
        const indicator = document.createElement("div");
        indicator.className = "drop-indicator";
        container.insertBefore(indicator, afterElement);
      }
    });
    
    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedId = e.dataTransfer.getData("text/plain");
      const draggedItem = container.querySelector(`[data-set-song-id="${draggedId}"]`);
      
      if (!draggedItem) return;
      
      // Remove indicators
      container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
      
      // Get new order (exclude add-song-card)
      const items = Array.from(container.querySelectorAll(".set-song-card.draggable-item"));
      const newOrder = items.map((el, index) => ({
        id: el.dataset.setSongId,
        sequence_order: index
      }));
      
      // Update all sequence orders
      await updateSongOrder(newOrder);
    });
  });
  
  // Also handle dragover on the container itself (for dropping at the end)
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = container.querySelector(".dragging");
    if (!dragging) return;
    
    const addCard = container.querySelector(".add-song-card");
    const draggableItems = container.querySelectorAll(".set-song-card.draggable-item:not(.dragging)");
    const lastItem = draggableItems[draggableItems.length - 1];
    
    if (lastItem && e.clientY > lastItem.getBoundingClientRect().bottom) {
      // Remove existing indicators
      container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
      
      if (addCard && dragging.nextSibling !== addCard) {
        container.insertBefore(dragging, addCard);
        // Add indicator before add card
        const indicator = document.createElement("div");
        indicator.className = "drop-indicator";
        container.insertBefore(indicator, addCard);
      } else if (!addCard) {
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
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedItem = container.querySelector(`[data-set-song-id="${draggedId}"]`);
    
    if (!draggedItem) return;
    
    // Remove indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    
    // Get new order (exclude add-song-card)
    const items = Array.from(container.querySelectorAll(".set-song-card.draggable-item"));
    const newOrder = items.map((el, index) => ({
      id: el.dataset.setSongId,
      sequence_order: index
    }));
    
    // Update all sequence orders
    await updateSongOrder(newOrder);
  });
}

function getDragAfterElement(container, y, dragging) {
  const draggableElements = [...container.querySelectorAll(".set-song-card.draggable-item:not(.dragging)")];
  
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

async function updateSongOrder(orderedItems) {
  if (!state.selectedSet) return;
  
  // Update all sequence orders in parallel
  const updates = orderedItems.map(({ id, sequence_order }) =>
    supabase
      .from("set_songs")
      .update({ sequence_order })
      .eq("id", id)
  );
  
  await Promise.all(updates);
  
  // Reload sets to get updated order
  await loadSets();
  const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
  if (updatedSet) {
    state.selectedSet = updatedSet;
    renderSetDetailSongs(updatedSet);
  }
}

function setupLinkDragAndDrop(item, container) {
  // Only allow dragging from the drag handle
  const dragHandle = item.querySelector(".drag-handle");
  if (dragHandle) {
    dragHandle.addEventListener("mousedown", (e) => {
      item.draggable = true;
    });
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
    // Update the order in the DOM
    updateLinkOrder(container);
    // Save the order to the database immediately
    await saveLinkOrder(container);
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
      
      // Update the order in the DOM
      updateLinkOrder(container);
      // Save the order to the database immediately
      await saveLinkOrder(container);
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

async function saveLinkOrder(container) {
  const form = el("song-edit-form");
  const songId = form?.dataset.songId;
  
  // Only save if we're editing an existing song
  if (!songId) return;
  
  // Get current order from DOM
  const items = Array.from(container.querySelectorAll(".song-link-row.draggable-item"));
  const orderedLinks = [];
  
  items.forEach((item, index) => {
    const idInput = item.querySelector(".song-link-id");
    const linkId = idInput?.value;
    
    // Only update existing links (skip new links that haven't been saved yet)
    if (linkId) {
      orderedLinks.push({
        id: linkId,
        display_order: index
      });
    }
  });
  
  // Update display_order for all existing links
  if (orderedLinks.length > 0) {
    const updates = orderedLinks.map(({ id, display_order }) =>
      supabase
        .from("song_links")
        .update({ display_order })
        .eq("id", id)
    );
    
    await Promise.all(updates);
  }
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
  
  // Clear and populate service times
  const serviceTimesList = el("service-times-list");
  serviceTimesList.innerHTML = "";
  if (set?.service_times && set.service_times.length > 0) {
    set.service_times.forEach((st) => {
      addServiceTimeRow(st.service_time, st.id);
    });
  }
  
  // Clear and populate rehearsal times
  const rehearsalTimesList = el("rehearsal-times-list");
  rehearsalTimesList.innerHTML = "";
  if (set?.rehearsal_times && set.rehearsal_times.length > 0) {
    set.rehearsal_times.forEach((rt) => {
      addRehearsalTimeRow(rt.rehearsal_date, rt.rehearsal_time, rt.id);
    });
  }
}

function closeSetModal() {
  setModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("set-form").reset();
  el("service-times-list").innerHTML = "";
  el("rehearsal-times-list").innerHTML = "";
  state.selectedSet = null;
  state.currentSetSongs = [];
}

function addServiceTimeRow(time = "", id = null) {
  const container = el("service-times-list");
  const row = document.createElement("div");
  row.className = "service-time-row";
  row.style.display = "flex";
  row.style.gap = "0.75rem";
  row.style.alignItems = "flex-end";
  row.dataset.tempId = id || `temp-${Date.now()}-${Math.random()}`;
  
  const timeInput = document.createElement("input");
  timeInput.type = "time";
  // Convert "HH:MM:SS" to "HH:MM" if needed for time input
  const timeValue = time ? time.substring(0, 5) : "";
  timeInput.value = timeValue;
  timeInput.required = false;
  timeInput.style.flex = "1";
  
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn ghost small";
  removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  removeBtn.addEventListener("click", () => row.remove());
  
  row.appendChild(timeInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function addRehearsalTimeRow(date = "", time = "", id = null) {
  const container = el("rehearsal-times-list");
  const row = document.createElement("div");
  row.className = "rehearsal-time-row";
  row.style.display = "flex";
  row.style.gap = "0.75rem";
  row.style.alignItems = "flex-end";
  row.dataset.tempId = id || `temp-${Date.now()}-${Math.random()}`;
  
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
  
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn ghost small";
  removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  removeBtn.addEventListener("click", () => row.remove());
  
  row.appendChild(dateInput);
  row.appendChild(timeInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
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
  };

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
      .select()
      .single();
  } else {
    response = await supabase.from("sets").insert(payload).select().single();
  }

  if (response.error) {
    alert("Unable to save set. Check console.");
    console.error(response.error);
    return;
  }

  const finalSetId = response.data.id;

  // Handle service times
  const serviceTimeRows = el("service-times-list").querySelectorAll(".service-time-row");
  const serviceTimes = Array.from(serviceTimeRows)
    .map(row => {
      const input = row.querySelector('input[type="time"]');
      return input?.value || null;
    })
    .filter(time => time);

  // Delete existing service times for this set
  if (isEditing) {
    await supabase
      .from("service_times")
      .delete()
      .eq("set_id", finalSetId);
  }

  // Insert new service times
  if (serviceTimes.length > 0) {
    const { error: serviceError } = await supabase
      .from("service_times")
      .insert(serviceTimes.map(time => ({
        set_id: finalSetId,
        service_time: time
      })));

    if (serviceError) {
      console.error("Error saving service times:", serviceError);
    }
  }

  // Handle rehearsal times
  const rehearsalTimeRows = el("rehearsal-times-list").querySelectorAll(".rehearsal-time-row");
  const rehearsalTimes = Array.from(rehearsalTimeRows)
    .map(row => {
      const dateInput = row.querySelector('input[type="date"]');
      const timeInput = row.querySelector('input[type="time"]');
      if (dateInput?.value && timeInput?.value) {
        return {
          date: dateInput.value,
          time: timeInput.value
        };
      }
      return null;
    })
    .filter(rt => rt);

  // Delete existing rehearsal times for this set
  if (isEditing) {
    await supabase
      .from("rehearsal_times")
      .delete()
      .eq("set_id", finalSetId);
  }

  // Insert new rehearsal times
  if (rehearsalTimes.length > 0) {
    const { error: rehearsalError } = await supabase
      .from("rehearsal_times")
      .insert(rehearsalTimes.map(rt => ({
        set_id: finalSetId,
        rehearsal_date: rt.date,
        rehearsal_time: rt.time
      })));

    if (rehearsalError) {
      console.error("Error saving rehearsal times:", rehearsalError);
    }
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
    alert("Unable to remove song from set.");
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
            setSong.song?.song_key,
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
  populateImportAssignmentsDropdown("import-assignments-container", null);
  el("assignments-list").innerHTML = "";
}

function closeSongModal() {
  songModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("song-form").reset();
  el("assignments-list").innerHTML = "";
  el("import-assignments-container").innerHTML = "";
  importAssignmentsDropdown = null;
}

let songDropdown = null;

async function populateSongOptions() {
  const container = el("song-select-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Get weeks since last performance for each song
  const weeksSinceMap = await getWeeksSinceLastPerformance();
  
  const options = state.songs.map(song => ({
    value: song.id,
    label: song.title,
    meta: {
      bpm: song.bpm,
      key: song.song_key,
      timeSignature: song.time_signature,
      duration: song.duration_seconds ? formatDuration(song.duration_seconds) : null,
      weeksSinceLastPerformed: weeksSinceMap.get(song.id) || null,
    }
  }));
  
  songDropdown = createSearchableDropdown(options, "Select a song...");
  container.appendChild(songDropdown);
}

async function getWeeksSinceLastPerformance() {
  const weeksMap = new Map();
  
  if (!state.songs || state.songs.length === 0) {
    return weeksMap;
  }
  
  const songIds = state.songs.map(s => s.id);
  
  // Query to find the most recent set date for each song
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
  
  // Group by song_id and get the most recent date (only past dates)
  const songToDateMap = new Map();
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of day
  
  if (data) {
    data.forEach(item => {
      const songId = item.song_id;
      // Handle both object and array responses from Supabase
      const setData = Array.isArray(item.set) ? item.set[0] : item.set;
      const scheduledDate = setData?.scheduled_date;
      
      if (scheduledDate) {
        const dateValue = new Date(scheduledDate);
        dateValue.setHours(0, 0, 0, 0);
        
        // Only consider dates in the past
        if (dateValue <= now) {
          const existingDate = songToDateMap.get(songId);
          if (!existingDate || dateValue > new Date(existingDate)) {
            songToDateMap.set(songId, scheduledDate);
          }
        }
      }
    });
  }
  
  // Calculate weeks since for each song
  songToDateMap.forEach((lastDate, songId) => {
    const date = new Date(lastDate);
    date.setHours(0, 0, 0, 0); // Normalize to start of day
    const diffTime = now - date;
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    if (diffWeeks >= 0) {
      weeksMap.set(songId, diffWeeks);
    }
  });
  
  return weeksMap;
}

async function handleAddSongToSet(event) {
  event.preventDefault();
  const songId = songDropdown?.getValue();
  if (!songId) {
    alert("Please select a song.");
    return;
  }
  const notes = el("song-notes").value;
  const assignments = collectAssignments();

  // Calculate sequence_order from the current set's songs
  const currentSequenceOrder = state.selectedSet.set_songs?.length || 0;

  const { data: setSong, error } = await supabase
    .from("set_songs")
    .insert({
      set_id: state.selectedSet.id,
      song_id: songId,
      notes,
      sequence_order: currentSequenceOrder,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Unable to add song.");
    return;
  }

  if (assignments.length) {
    const { error: assignmentError } = await supabase
      .from("song_assignments")
      .insert(
        assignments.map((assignment) => ({
          role: assignment.role,
          person_id: assignment.person_id || null,
          pending_invite_id: assignment.pending_invite_id || null,
          person_name: assignment.person_name || null,
          person_email: assignment.person_email || null,
          set_song_id: setSong.id,
        }))
      );
    if (assignmentError) {
      console.error(assignmentError);
      alert("Assignments partially failed.");
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

function collectAssignments() {
  const roles = Array.from(document.querySelectorAll(".assignment-role-input"));
  const personContainers = Array.from(
    document.querySelectorAll(".assignment-person-container")
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
function openEditSetSongModal(setSong) {
  if (!isManager() || !setSong) return;
  
  const modal = el("edit-set-song-modal");
  const form = el("edit-set-song-form");
  const notesInput = el("edit-set-song-notes");
  const assignmentsList = el("edit-assignments-list");
  
  // Store the set song ID and song ID for saving/editing
  form.dataset.setSongId = setSong.id;
  form.dataset.songId = setSong.song_id || setSong.song?.id || null;
  
  // Populate notes
  notesInput.value = setSong.notes || "";
  
  // Clear and populate assignments
  assignmentsList.innerHTML = "";
  if (setSong.song_assignments && setSong.song_assignments.length > 0) {
    setSong.song_assignments.forEach((assignment) => {
      addEditAssignmentInput(assignment);
    });
  }
  
  // Populate import dropdown, excluding current song
  populateImportAssignmentsDropdown("import-edit-assignments-container", setSong.id);
  
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
  
  const options = setSongs.map(setSong => ({
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
    alert("Selected song has no assignments to import.");
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
    alert("Selected song has no assignments to import.");
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
  
  if (!setSongId) {
    alert("Missing set song ID.");
    return;
  }
  
  const notes = el("edit-set-song-notes").value.trim();
  const assignments = collectEditAssignments();
  
  // Update notes
  const { error: updateError } = await supabase
    .from("set_songs")
    .update({ notes })
    .eq("id", setSongId);
  
  if (updateError) {
    console.error(updateError);
    alert("Unable to update song notes.");
    return;
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
        }))
      );
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

function showDeleteConfirmModal(name, message, onConfirm) {
  const modal = el("delete-confirm-modal");
  const title = el("delete-confirm-title");
  const messageEl = el("delete-confirm-message");
  const nameEl = el("delete-confirm-name");
  const input = el("delete-confirm-input");
  const confirmBtn = el("confirm-delete");
  const cancelBtn = el("cancel-delete-confirm");
  const closeBtn = el("close-delete-confirm-modal");
  
  if (!modal) return;
  
  title.textContent = "Confirm Deletion";
  messageEl.textContent = message;
  nameEl.textContent = `'${name}'`;
  input.value = "";
  input.placeholder = name;
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
        .eq("id", set.id);
      
      if (error) {
        console.error(error);
        alert("Unable to delete set. Check console.");
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
        .eq("id", songId);
      
      if (error) {
        console.error(error);
        alert("Unable to delete song. Check console.");
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
  if (prefilledName) {
    el("invite-name").value = prefilledName;
  }
  el("invite-message").textContent = "";
}

function closeInviteModal() {
  const modal = el("invite-modal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  el("invite-form").reset();
  el("invite-message").textContent = "";
}

async function handleInviteSubmit(event) {
  event.preventDefault();
  if (!isManager()) return;
  
  const email = el("invite-email").value.trim();
  const name = el("invite-name").value.trim();
  const messageEl = el("invite-message");
  
  if (!email) {
    messageEl.textContent = "Please enter an email address.";
    messageEl.classList.add("error-text");
    messageEl.classList.remove("muted");
    return;
  }
  
  const normalizedEmail = email.toLowerCase();

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

  if (existingProfile) {
    messageEl.textContent = `${email} is already a member.`;
    messageEl.classList.add("error-text");
    messageEl.classList.remove("muted");
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
  
  messageEl.textContent = `Invite sent to ${email}! They'll receive an email with a sign-in link. You'll see them listed as pending until they complete signup.`;
  messageEl.classList.remove("error-text");
  messageEl.classList.add("muted");
  el("invite-form").reset();
  
  // Optionally store the invite info for profile creation
  // We'll handle profile creation in fetchProfile when they first sign in
}

async function ensurePendingInviteRecord(email, fullName) {
  if (!email) return;
  const normalizedEmail = email.trim().toLowerCase();
  const payload = {
    email: normalizedEmail,
    full_name: fullName || null,
    created_by: state.profile?.id || null,
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
    alert("Missing required information.");
    return;
  }
  
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", personId);
  
  if (error) {
    console.error(error);
    alert("Unable to update member. Check console.");
    return;
  }
  
  closeEditPersonModal();
  await loadPeople();
}

async function deletePerson(person) {
  if (!isManager() || !person) return;
  
  if (person.id === state.profile.id) {
    alert("You cannot remove yourself from the band.");
    return;
  }
  
  const personName = person.full_name || person.email || "this person";
  
  showDeleteConfirmModal(
    personName,
    `Removing "${personName}" from the team will also remove all their assignments.`,
    async () => {
      console.log('🗑️ Deleting person:', person.id, personName);
      
      // Step 1: Delete all song_assignments that reference this person by person_id
      console.log('  - Step 1: Deleting song assignments by person_id...');
      const { error: assignmentsError } = await supabase
        .from("song_assignments")
        .delete()
        .eq("person_id", person.id);
      
      if (assignmentsError) {
        console.error('❌ Error deleting assignments by person_id:', assignmentsError);
        const errorMsg = assignmentsError.message || assignmentsError.code || 'Unknown error';
        alert(`Unable to remove member assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
        return;
      }
      
      // Step 2: Find and delete pending_invite if it exists
      const personEmail = person.email?.toLowerCase();
      if (personEmail) {
        console.log('  - Step 2: Checking for pending invite...');
        const { data: pendingInvite } = await supabase
          .from("pending_invites")
          .select("id")
          .eq("email", personEmail)
          .maybeSingle();
        
        if (pendingInvite) {
          console.log('  - Step 2a: Deleting song assignments by pending_invite_id...');
          // Delete assignments that reference this pending_invite
          const { error: pendingAssignmentsError } = await supabase
            .from("song_assignments")
            .delete()
            .eq("pending_invite_id", pendingInvite.id);
          
          if (pendingAssignmentsError) {
            console.error('❌ Error deleting assignments by pending_invite_id:', pendingAssignmentsError);
            const errorMsg = pendingAssignmentsError.message || pendingAssignmentsError.code || 'Unknown error';
            alert(`Unable to remove pending invite assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
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
            alert(`Unable to remove pending invite.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
            return;
          }
        }
      }
      
      // Step 3: Delete the profile (this should be safe now that all dependencies are gone)
      console.log('  - Step 3: Deleting profile...');
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", person.id);
      
      if (profileError) {
        console.error('❌ Error deleting profile:', profileError);
        const errorMsg = profileError.message || profileError.code || 'Unknown error';
        alert(`Unable to remove member.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.\n\nYou may need to add DELETE policies for:\n- profiles table (for users with can_manage = true)\n- pending_invites table (for users with can_manage = true)\n- song_assignments table (for users with can_manage = true)`);
        return;
      }
      
      console.log('✅ Person deleted successfully');
      
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
      
      // Step 1: Delete all song_assignments that reference this pending_invite
      console.log('  - Step 1: Deleting song assignments by pending_invite_id...');
      const { error: assignmentsError } = await supabase
        .from("song_assignments")
        .delete()
        .eq("pending_invite_id", invite.id);
      
      if (assignmentsError) {
        console.error('❌ Error deleting assignments by pending_invite_id:', assignmentsError);
        const errorMsg = assignmentsError.message || assignmentsError.code || 'Unknown error';
        alert(`Unable to remove pending invite assignments.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.`);
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
        alert(`Unable to cancel invite.\n\nError: ${errorMsg}\n\nCheck console for details. This might be an RLS policy issue.\n\nYou may need to add DELETE policies for:\n- pending_invites table (for users with can_manage = true)\n- song_assignments table (for users with can_manage = true)`);
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
      const keyMatch = (song.song_key || "").toLowerCase().includes(searchTerm);
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
    const highlightedKey = song.song_key ? (searchTerm && song.song_key.toLowerCase().includes(searchTerm) ? `<span>Key: ${highlightMatch(song.song_key, searchTermRaw)}</span>` : `<span>Key: ${song.song_key}</span>`) : '';
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

function openSongEditModal(songId = null) {
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
      el("song-edit-key").value = song.song_key || "";
      el("song-edit-time-signature").value = song.time_signature || "";
      el("song-edit-duration").value = song.duration_seconds ? formatDuration(song.duration_seconds) : "";
      el("song-edit-description").value = song.description || "";
      form.dataset.songId = songId;
      renderSongLinks(song.song_links || []);
    }
  } else {
    title.textContent = "New Song";
    form.reset();
    delete form.dataset.songId;
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
  
  // Reset creatingSongFromModal if cancelled (not saved)
  // This will be set to false in handleSongEditSubmit if saved successfully
  if (state.creatingSongFromModal) {
    state.creatingSongFromModal = false;
  }
}

async function openSongDetailsModal(song) {
  if (!song) return;
  
  const modal = el("song-details-modal");
  const content = el("song-details-content");
  const title = el("song-details-title");
  
  if (!modal || !content) return;
  
  // Track which song is open
  state.currentSongDetailsId = song.id;
  
  title.textContent = song.title || "Song Details";
  
  // If song_links aren't loaded, fetch them
  let songWithLinks = song;
  if (!song.song_links) {
    const { data } = await supabase
      .from("songs")
      .select(`
        *,
        song_links (
          id,
          title,
          url,
          display_order
        )
      `)
      .eq("id", song.id)
      .single();
    
    if (data) {
      songWithLinks = data;
    }
  }
  
  // Render all song information in an expanded view
    content.innerHTML = `
      <div class="song-details-section">
        <h2 class="song-details-title">${escapeHtml(songWithLinks.title || "Untitled")}</h2>
        
        <div class="song-details-meta">
          ${songWithLinks.bpm ? `<div class="detail-item">
            <span class="detail-label">BPM</span>
            <span class="detail-value">${songWithLinks.bpm}</span>
          </div>` : ''}
          ${songWithLinks.song_key ? `<div class="detail-item">
            <span class="detail-label">Key</span>
            <span class="detail-value">${escapeHtml(songWithLinks.song_key)}</span>
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
        
        ${songWithLinks.song_links && songWithLinks.song_links.length > 0 ? `
        <div class="song-details-section">
          <h3 class="section-title" style="margin-top:1.25rem;">Resources & Links</h3>
          <div class="song-details-links"></div>
        </div>
        ` : ''}
      </div>
    `;
  
  // Render links if they exist
    if (songWithLinks.song_links && songWithLinks.song_links.length > 0) {
      const linksContainer = content.querySelector(".song-details-links");
      if (linksContainer) {
        renderSongLinksDisplay(songWithLinks.song_links, linksContainer);
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
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    state.currentSongDetailsId = null;
  }
}

function renderSongLinks(links) {
  const container = el("song-links-list");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Sort by display_order
  const sortedLinks = [...links].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  
  sortedLinks.forEach((link, index) => {
    const div = document.createElement("div");
    div.className = "song-link-row draggable-item";
    div.draggable = isManager() || false;
    div.dataset.linkId = link.id || `new-${index}`;
    div.dataset.displayOrder = link.display_order || index;
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
      <button type="button" class="btn small ghost remove-song-link">Remove</button>
    `;
    
    div.querySelector(".remove-song-link").addEventListener("click", () => {
      container.removeChild(div);
    });
    
    // Setup drag and drop for links
    if (isManager()) {
      setupLinkDragAndDrop(div, container);
    }
    
    container.appendChild(div);
  });
}

function addSongLinkInput() {
  const container = el("song-links-list");
  if (!container) return;
  
  const existingItems = container.querySelectorAll(".song-link-row");
  const nextOrder = existingItems.length;
  
  const div = document.createElement("div");
  div.className = "song-link-row draggable-item";
  div.draggable = state.profile?.can_manage || false;
  div.dataset.linkId = `new-${Date.now()}`;
  div.dataset.displayOrder = nextOrder;
  div.innerHTML = `
    ${state.profile?.can_manage ? '<div class="drag-handle" title="Drag to reorder">⋮⋮</div>' : ''}
    <label>
      Title
      <input type="text" class="song-link-title-input" placeholder="Recording" required />
    </label>
    <label>
      URL
      <input type="url" class="song-link-url-input" placeholder="https://..." required />
    </label>
    <button type="button" class="btn small ghost remove-song-link">Remove</button>
  `;
  
  div.querySelector(".remove-song-link").addEventListener("click", () => {
    container.removeChild(div);
    updateLinkOrder(container);
  });
  
  // Setup drag and drop for new link
  if (isManager()) {
    setupLinkDragAndDrop(div, container);
  }
  
  container.appendChild(div);
}

function collectSongLinks() {
  const container = el("song-links-list");
  if (!container) return [];
  
  // Get rows in DOM order (the order they appear visually after reordering)
  const rows = Array.from(container.querySelectorAll(".song-link-row"));
  const links = [];
  
  rows.forEach((row, index) => {
    const titleInput = row.querySelector(".song-link-title-input");
    const urlInput = row.querySelector(".song-link-url-input");
    const idInput = row.querySelector(".song-link-id");
    
    const title = titleInput?.value.trim();
    const url = urlInput?.value.trim();
    const id = idInput?.value;
    
    // Use the index (DOM position) as the display_order
    // This ensures the order matches what the user sees after dragging
    if (title && url) {
      links.push({
        id: id || null,
        title,
        url,
        display_order: index,
      });
    }
  });
  
  return links;
}

async function handleSongEditSubmit(event) {
  event.preventDefault();
  const form = el("song-edit-form");
  const songId = form.dataset.songId;
  const title = el("song-edit-title").value.trim();
  const bpm = el("song-edit-bpm").value ? parseInt(el("song-edit-bpm").value) : null;
  const songKey = el("song-edit-key").value.trim() || null;
  const timeSignature = el("song-edit-time-signature").value.trim() || null;
  const duration = parseDuration(el("song-edit-duration").value);
  const description = el("song-edit-description").value.trim() || null;
  
  if (!title) {
    alert("Title is required.");
    return;
  }
  
  const songData = {
    title,
    bpm,
    song_key: songKey,
    time_signature: timeSignature,
    duration_seconds: duration,
    description,
    created_by: state.session.user.id,
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
    alert("Unable to save song. Check console.");
    return;
  }
  
  const finalSongId = response.data.id;
  const links = collectSongLinks();
  
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
  
  // Delete removed links
  if (deletedIds.length > 0) {
    await supabase
      .from("song_links")
      .delete()
      .in("id", deletedIds);
  }
  
  // Update existing links
  for (const link of updatedLinks) {
    await supabase
      .from("song_links")
      .update({
        title: link.title,
        url: link.url,
        display_order: link.display_order,
      })
      .eq("id", link.id);
  }
  
  // Insert new links
  if (newLinks.length > 0) {
    await supabase
      .from("song_links")
      .insert(
        newLinks.map(link => ({
          song_id: finalSongId,
          title: link.title,
          url: link.url,
          display_order: link.display_order,
        }))
      );
  }
  
  // Reload songs and update catalog
  await loadSongs();
  
  // Update songs tab if it's currently visible
  if (!el("songs-tab")?.classList.contains("hidden")) {
    renderSongCatalog();
  }
  
  // If details modal is open for this song, refresh it
  if (state.currentSongDetailsId === finalSongId) {
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
            url
          )
        `)
        .eq("id", finalSongId)
        .single();
      
      if (data) {
        await openSongDetailsModal(data);
      }
    }
  }
  
  // Refresh set detail view if it's showing this song
  if (state.selectedSet) {
    await loadSets();
    const updatedSet = state.sets.find(s => s.id === state.selectedSet.id);
    if (updatedSet) {
      state.selectedSet = updatedSet;
      renderSetDetailSongs(updatedSet);
    }
  }
  
  closeSongEditModal();
  
  // If we were creating from the song modal, keep it open and select the new song
  if (state.creatingSongFromModal && !songId) {
    state.creatingSongFromModal = false;
    // Song modal should still be open, just refresh the options and select the new song
    await populateSongOptions();
    if (songDropdown) {
      songDropdown.setValue(response.data.id);
    }
  } else {
    state.creatingSongFromModal = false;
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

function renderSongLinksDisplay(links, container) {
  if (!links || links.length === 0) return;
  
  const linksContainer = document.createElement("div");
  linksContainer.style.marginTop = "1rem";
  linksContainer.style.display = "flex";
  linksContainer.style.flexDirection = "column";
  linksContainer.style.gap = "0.5rem";
  
  links.forEach(link => {
    const linkEl = document.createElement("a");
    linkEl.href = link.url;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.className = "song-link-display";
    
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
    
    linksContainer.appendChild(linkEl);
  });
  
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
    alert("Song needs a BPM to play click track.");
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

init();

