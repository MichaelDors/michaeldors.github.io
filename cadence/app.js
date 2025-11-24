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
  currentTeamId: null, // Current team the user is viewing/working with
  userTeams: [], // Array of all teams the user is a member of
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
const sectionModal = el("section-modal");
const authForm = el("auth-form");
const loginEmailInput = el("login-email");
const loginPasswordInput = el("login-password");
const authMessage = el("auth-message");
const authSubmitBtn = el("auth-submit-btn");
// Team leader signup mode - allows team leaders to create teams
let isSignUpMode = false;

// Helper function to check if user has manager permissions
// Returns false if in member view mode, even if user is a manager
// Returns true for both owners and managers
function isManager() {
  return state.profile?.can_manage && !state.isMemberView;
}

// Helper function to check if user is team owner
// Returns false if in member view mode, even if user is an owner
function isOwner() {
  return state.profile?.is_owner && !state.isMemberView;
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
  
  // Toggle signup mode for team leaders
  const toggleSignupBtn = el("toggle-signup");
  toggleSignupBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    updateAuthUI();
  });
  
  // Team management buttons (owners only)
  el("btn-rename-team")?.addEventListener("click", () => openRenameTeamModal());
  el("btn-delete-team")?.addEventListener("click", () => deleteTeam());
  
  // Rename team modal
  el("rename-team-form")?.addEventListener("submit", handleRenameTeamSubmit);
  el("cancel-rename-team")?.addEventListener("click", () => {
    el("rename-team-modal")?.classList.add("hidden");
    document.body.style.overflow = "";
  });
  el("close-rename-team-modal")?.addEventListener("click", () => {
    el("rename-team-modal")?.classList.add("hidden");
    document.body.style.overflow = "";
  });
  
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
  el("close-section-modal")?.addEventListener("click", () => closeSectionModal());
  el("cancel-section")?.addEventListener("click", () => closeSectionModal());
  el("song-form")?.addEventListener("submit", handleAddSongToSet);
  el("section-form")?.addEventListener("submit", handleAddSectionToSet);
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
  
  // Update team switcher
  updateTeamSwitcher();
  
  // Update team name in People tab
  const teamNameDisplay = el("team-name-display");
  const teamInfoSection = el("team-info-section");
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  if (teamNameDisplay && currentTeam) {
    teamNameDisplay.textContent = currentTeam.name;
    if (teamInfoSection) teamInfoSection.classList.remove("hidden");
  } else if (teamInfoSection) {
    teamInfoSection.classList.add("hidden");
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
  
  // Show/hide team management buttons for owners only (in People tab)
  const teamManagementEl = el("team-management");
  if (isOwner()) {
    if (teamManagementEl) teamManagementEl.classList.remove("hidden");
  } else {
    if (teamManagementEl) teamManagementEl.classList.add("hidden");
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
    if (description) description.textContent = "Create a new team and become the team owner.";
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
    if (updateProfileFunctionError && (updateProfileFunctionError.code === '42883' || updateProfileFunctionError.message?.includes('function'))) {
      console.log('Update function not available, trying direct update...');
      const { error: directUpdateError } = await supabase
        .from("profiles")
        .update({ team_id: teamData.id })
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
  const teamId = pendingInvite?.team_id || null;
  
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
    // Profile might already exist, try to update it
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        email: userEmail,
        team_id: teamId || undefined, // Only update if team_id exists
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
  
  // Add user to team_members if they have a team_id
  if (teamId) {
    console.log('👥 Adding user to team_members for team:', teamId);
    
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
    // IMPORTANT: Select team_id explicitly to ensure it's available
    const queryPromise = supabase
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
  
  // Update profile.team_id (for backward compatibility and default team)
  if (state.profile) {
    const { error } = await supabase
      .from("profiles")
      .update({ team_id: teamId })
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
      
      // Leave team button (always show, but will be disabled if only owner)
      const leaveBtn = document.createElement("button");
      leaveBtn.className = "btn ghost small";
      leaveBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      leaveBtn.style.cssText = "padding: 0.25rem 0.5rem; min-width: auto; opacity: 0.6;";
      leaveBtn.title = "Leave team";
      leaveBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await leaveTeam(team.id, team.name);
      });
      teamItem.appendChild(leaveBtn);
      
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
    .eq("team_id", state.currentTeamId)
    .order("title");
  
  if (error) {
    console.error('❌ Error loading songs:', error);
    console.error('  - Error code:', error.code);
    console.error('  - Error message:', error.message);
    console.error('  - Error details:', JSON.stringify(error, null, 2));
    console.error('  - Query was for team_id:', state.profile.team_id);
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
        title,
        description,
        song_id,
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
    .eq("team_id", state.currentTeamId)
    .order("scheduled_date", { ascending: true });

  // If error is due to missing tables (service_times or rehearsal_times), fall back to query without them
  if (error && (error.message?.includes("service_times") || error.message?.includes("rehearsal_times") || error.code === "PGRST116" || error.code === "42P01")) {
    console.warn("service_times or rehearsal_times tables not found, loading sets without them:", error.message);
    console.log('  - Falling back to query without service/rehearsal times...');
    const fallbackResult = await supabase
      .from("sets")
      .select(
        `
        *,
        set_songs (
          id,
          sequence_order,
          notes,
          title,
          description,
          song_id,
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
      .eq("team_id", state.currentTeamId)
      .order("scheduled_date", { ascending: true });
    
    console.log('  - Fallback query result - error:', fallbackResult.error?.code || 'none');
    console.log('  - Fallback query result - data count:', fallbackResult.data?.length || 0);
    
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
  if (container === yourSetsList && currentUserId && set.set_songs) {
    // Collect all assignments for the current user, sorted by setlist order
    const userAssignments = [];
    // Sort set_songs by sequence_order to maintain setlist order
    const sortedSetSongs = [...set.set_songs].sort((a, b) => {
      const orderA = a.sequence_order ?? 0;
      const orderB = b.sequence_order ?? 0;
      return orderA - orderB;
    });
    
    sortedSetSongs.forEach(setSong => {
      if (setSong.song_assignments) {
        setSong.song_assignments.forEach(assignment => {
          if (assignment.person_id === currentUserId) {
            // Get title: from song if it's a song, from title field if it's a section
            const songTitle = setSong.song_id 
              ? (setSong.song?.title || "Unknown Song")
              : (setSong.title || "Unknown Section");
            userAssignments.push({
              songTitle,
              role: assignment.role,
              sequenceOrder: setSong.sequence_order ?? 0
            });
          }
        });
      }
    });

    if (userAssignments.length > 0) {
      const rolesWrapper = document.createElement("div");
      rolesWrapper.className = "user-roles-wrapper";
      userRolesContainer.appendChild(rolesWrapper);
      
      // Create all pills and append them
      const pills = [];
      userAssignments.forEach((assignment) => {
        const pill = document.createElement("span");
        pill.className = "assignment-pill user-role-pill";
        pill.textContent = `${assignment.songTitle} - ${assignment.role}`;
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
  
  // Query team_members and join with profiles to get all team members
  const [
    { data: teamMembers, error: teamMembersError },
    { data: pendingInvites, error: pendingError },
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select(`
        id,
        role,
        is_owner,
        can_manage,
        joined_at,
        profile:user_id (
          id,
          full_name,
          email,
          team_id,
          created_at
        )
      `)
      .eq("team_id", state.currentTeamId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("pending_invites")
      .select("*")
      .eq("team_id", state.currentTeamId)
      .is("resolved_at", null)
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

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
    
    state.people = profiles || [];
    state.pendingInvites = pendingInvites || [];
    renderPeople();
    return;
  }

  if (pendingError) {
    console.error("❌ Error loading pending invites:", pendingError);
    console.error("  - Error details:", JSON.stringify(pendingError, null, 2));
  }

  // Transform team_members data to match expected format
  const profiles = (teamMembers || [])
    .map(tm => {
      const profile = tm.profile;
      if (!profile) return null;
      
      return {
        ...profile,
        role: tm.role,
        is_owner: tm.is_owner,
        can_manage: tm.can_manage,
        team_member_id: tm.id,
        joined_at: tm.joined_at
      };
    })
    .filter(p => p !== null)
    .sort((a, b) => {
      // Sort by full_name
      const nameA = (a.full_name || "").toLowerCase();
      const nameB = (b.full_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  console.log('  - ✅ People loaded:', profiles?.length || 0, 'profiles,', pendingInvites?.length || 0, 'pending invites');
  state.people = profiles || [];
  state.pendingInvites = pendingInvites || [];
  renderPeople();
}

function renderPeople() {
  const peopleList = el("people-list");
  if (!peopleList) return;
  
  // Update team name display when rendering people
  const teamNameDisplay = el("team-name-display");
  const teamInfoSection = el("team-info-section");
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  if (teamNameDisplay && currentTeam) {
    teamNameDisplay.textContent = currentTeam.name;
    if (teamInfoSection) teamInfoSection.classList.remove("hidden");
  } else if (teamInfoSection) {
    teamInfoSection.classList.add("hidden");
  }
  
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
  const viewAsMemberDetailBtn = el("btn-view-as-member-detail");
  
  if (isManager()) {
    editBtn.classList.remove("hidden");
    deleteBtn.classList.remove("hidden");
  } else {
    editBtn.classList.add("hidden");
    deleteBtn.classList.add("hidden");
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
  // Reset drag setup flag since we're re-rendering
  delete songsList.dataset.dragSetup;
  
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
        
        // Check if this is a section (no song_id) or a song
        const isSection = !setSong.song_id;
        
        if (isSection) {
          // Render as section
          songNode.querySelector(".song-title").textContent = setSong.title || "Untitled Section";
          songNode.querySelector(".song-meta").textContent = setSong.description || "";
          songNode.querySelector(".song-notes").textContent = setSong.notes || "";
          // Hide "View Details" button for sections
          const viewDetailsBtn = songNode.querySelector(".view-song-details-btn");
          if (viewDetailsBtn) {
            viewDetailsBtn.style.display = "none";
          }
        } else {
          // Render as song
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
        }

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
  // Store handlers on the container so we can remove them later
  if (container._songDragHandlers) {
    // Remove old listeners
    container.removeEventListener("dragover", container._songDragHandlers.containerDragOver);
    container.removeEventListener("drop", container._songDragHandlers.containerDrop);
  }
  
  const items = container.querySelectorAll(".set-song-card.draggable-item");
  
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
      container.insertBefore(dragging, afterElement);
      const indicator = document.createElement("div");
      indicator.className = "drop-indicator";
      container.insertBefore(indicator, afterElement);
    }
  };
  
  const handleDrop = async function(e) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedItem = container.querySelector(`[data-set-song-id="${draggedId}"]`);
    
    if (!draggedItem) return;
    
    // Remove indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    
    // Calculate where the item should be dropped based on current mouse position
    const afterElement = getDragAfterElement(container, e.clientY, draggedItem);
    const addCard = container.querySelector(".add-song-card");
    
    // Move the dragged item to its final position
    if (afterElement == null) {
      // Drop at the end
      if (addCard) {
        container.insertBefore(draggedItem, addCard);
      } else {
        container.appendChild(draggedItem);
      }
    } else {
      container.insertBefore(draggedItem, afterElement);
    }
    
    // Clean up dragging state
    draggedItem.classList.remove("dragging");
    draggedItem.style.opacity = "";
    draggedItem.draggable = false;
    
    // Get the final DOM order
    const allItems = Array.from(container.children);
    const items = allItems
      .filter(el => el.classList.contains("set-song-card") && el.classList.contains("draggable-item"))
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
    
    console.log("handleDrop - items to update:", items);
    await updateSongOrder(items);
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
    const draggableItems = container.querySelectorAll(".set-song-card.draggable-item:not(.dragging)");
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
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedItem = container.querySelector(`[data-set-song-id="${draggedId}"]`);
    
    if (!draggedItem) return;
    
    // Remove indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
    
    // Calculate where the item should be dropped based on current mouse position
    const addCard = container.querySelector(".add-song-card");
    const draggableItems = container.querySelectorAll(".set-song-card.draggable-item:not(.dragging)");
    const lastItem = draggableItems[draggableItems.length - 1];
    
    // Move the dragged item to its final position
    if (lastItem && e.clientY > lastItem.getBoundingClientRect().bottom) {
      // Drop at the end
      if (addCard) {
        container.insertBefore(draggedItem, addCard);
      } else {
        container.appendChild(draggedItem);
      }
    } else if (lastItem) {
      // Drop after the last item
      container.insertBefore(draggedItem, lastItem.nextSibling);
    }
    
    // Clean up dragging state
    draggedItem.classList.remove("dragging");
    draggedItem.style.opacity = "";
    draggedItem.draggable = false;
    
    // Get the final DOM order
    const allItems = Array.from(container.children);
    const items = allItems
      .filter(el => el.classList.contains("set-song-card") && el.classList.contains("draggable-item"))
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
      return;
    }
    
    console.log("handleContainerDrop - items to update:", items);
    await updateSongOrder(items);
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
  if (!state.selectedSet) {
    console.warn("No selected set, cannot update song order");
    return;
  }
  
  if (!isManager()) {
    console.warn("Only managers can reorder songs");
    alert("Only managers can reorder songs.");
    return;
  }
  
  console.log("Updating song order:", orderedItems);
  console.log("Selected set ID:", state.selectedSet.id);
  
  // Verify all set_song IDs belong to the selected set
  const validSetSongIds = new Set((state.selectedSet.set_songs || []).map(ss => String(ss.id)));
  const invalidItems = orderedItems.filter(item => !validSetSongIds.has(String(item.id)));
  
  if (invalidItems.length > 0) {
    console.error("Some items don't belong to the selected set:", invalidItems);
    alert("Some songs don't belong to this set. Please refresh and try again.");
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
    alert(`Failed to reorder songs:\n${errorMessages}\n\nCheck the console for more details.`);
    return;
  }
  
  console.log("Phase 2: Setting all songs to their final sequence_order values...");
  // Phase 2: Set all to their final values
  for (const { id, sequence_order } of orderedItems) {
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
    } else if (!data || data.length === 0) {
      console.error(`No set_song found with id ${songId} in set ${state.selectedSet.id}`);
      errors.push({ id: songId, sequence_order: orderValue, error: { message: "Song not found in this set" }, phase: "final" });
    } else {
      console.log(`Successfully updated set_song ${songId} to sequence_order ${orderValue}`, data);
    }
  }
  
  if (errors.length > 0) {
    console.error("Some updates failed:", errors);
    const errorMessages = errors.map(e => `Song ${e.id} (order ${e.sequence_order}): ${e.error?.message || JSON.stringify(e.error)}`).join("\n");
    console.error("Error details:", errorMessages);
    alert(`Some songs could not be reordered:\n${errorMessages}\n\nCheck the console for more details.`);
    return;
  }
  
  console.log("All updates successful, reloading sets...");
  
  // Reload sets to get updated order
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
    team_id: state.currentTeamId,
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
      .eq("team_id", state.currentTeamId)
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
        service_time: time,
        team_id: state.profile.team_id
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
        rehearsal_time: rt.time,
        team_id: state.profile.team_id
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

async function openSectionModal() {
  if (!isManager() || !state.selectedSet) return;
  sectionModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  el("section-assignments-list").innerHTML = "";
}

function closeSectionModal() {
  sectionModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("section-form").reset();
  el("section-assignments-list").innerHTML = "";
  el("import-section-assignments-container").innerHTML = "";
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
      team_id: state.currentTeamId,
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
          team_id: state.currentTeamId,
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

async function handleAddSectionToSet(event) {
  event.preventDefault();
  const title = el("section-title").value.trim();
  if (!title) {
    alert("Please enter a section title.");
    return;
  }
  const description = el("section-description").value.trim();
  const notes = el("section-notes").value.trim();
  const assignments = collectAssignments("section-assignments-list");

  // Calculate sequence_order from the current set's songs/sections
  const currentSequenceOrder = state.selectedSet.set_songs?.length || 0;

  const { data: setSong, error } = await supabase
    .from("set_songs")
    .insert({
      set_id: state.selectedSet.id,
      song_id: null, // Sections don't have a song_id
      title: title,
      description: description || null,
      notes: notes || null,
      sequence_order: currentSequenceOrder,
      team_id: state.currentTeamId,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Unable to add section.");
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
          team_id: state.currentTeamId,
        }))
      );
    if (assignmentError) {
      console.error(assignmentError);
      alert("Assignments partially failed.");
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
function openEditSetSongModal(setSong) {
  if (!isManager() || !setSong) return;
  
  const modal = el("edit-set-song-modal");
  const form = el("edit-set-song-form");
  const notesInput = el("edit-set-song-notes");
  const assignmentsList = el("edit-assignments-list");
  const isSection = !setSong.song_id;
  
  // Store the set song ID and song ID for saving/editing
  form.dataset.setSongId = setSong.id;
  form.dataset.songId = setSong.song_id || setSong.song?.id || null;
  form.dataset.isSection = isSection ? "true" : "false";
  
  // Update modal title
  const titleEl = el("edit-set-item-title");
  if (titleEl) {
    titleEl.textContent = isSection ? "Edit Section in Set" : "Edit Song in Set";
  }
  
  // Show/hide section fields and song edit button
  const sectionFields = el("edit-section-fields");
  const editSongBtn = el("btn-edit-song-from-set");
  if (sectionFields) {
    if (isSection) {
      sectionFields.classList.remove("hidden");
      el("edit-section-title").value = setSong.title || "";
      el("edit-section-description").value = setSong.description || "";
    } else {
      sectionFields.classList.add("hidden");
    }
  }
  if (editSongBtn) {
    editSongBtn.classList.toggle("hidden", isSection);
  }
  
  // Populate notes
  notesInput.value = setSong.notes || "";
  
  // Clear and populate assignments
  assignmentsList.innerHTML = "";
  if (setSong.song_assignments && setSong.song_assignments.length > 0) {
    setSong.song_assignments.forEach((assignment) => {
      addEditAssignmentInput(assignment);
    });
  }
  
  // Populate import dropdown, excluding current song/section
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
  const isSection = form.dataset.isSection === "true";
  
  if (!setSongId) {
    alert("Missing set song ID.");
    return;
  }
  
  const notes = el("edit-set-song-notes").value.trim();
  const assignments = collectEditAssignments();
  
  // Build update object
  const updateData = { notes: notes || null };
  
  // If it's a section, also update title and description
  if (isSection) {
    const title = el("edit-section-title").value.trim();
    const description = el("edit-section-description").value.trim();
    if (!title) {
      alert("Section title is required.");
      return;
    }
    updateData.title = title;
    updateData.description = description || null;
  }
  
  // Update set_song
  const { error: updateError } = await supabase
    .from("set_songs")
    .update(updateData)
    .eq("id", setSongId);
  
  if (updateError) {
    console.error(updateError);
    alert(`Unable to update ${isSection ? 'section' : 'song'} notes.`);
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
          team_id: state.currentTeamId,
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
        .eq("id", set.id)
        .eq("team_id", state.currentTeamId);
      
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
        .eq("id", songId)
        .eq("team_id", state.currentTeamId);
      
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
      alert("You cannot leave this team because you are the only owner. Please transfer ownership or delete the team instead.");
      return;
    }
  }
  
  const confirmed = confirm(`Leave "${teamName}"? You can be re-invited later.`);
  if (!confirmed) return;
  
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", state.session.user.id);
  
  if (error) {
    console.error("Error leaving team:", error);
    alert("Unable to leave team. Check console.");
    return;
  }
  
  // Refresh user teams
  await fetchUserTeams();
  
  // If this was the current team, switch to another or show empty state
  if (teamId === state.currentTeamId) {
    if (state.userTeams.length > 0) {
      await switchTeam(state.userTeams[0].id);
    } else {
      state.currentTeamId = null;
      state.sets = [];
      state.songs = [];
      state.people = [];
      refreshActiveTab();
      showApp();
    }
  } else {
    // Just refresh the switcher
    updateTeamSwitcher();
  }
  
  // Close menu
  el("account-menu")?.classList.add("hidden");
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
  
  // Preserve set detail view state before any operations
  // If creating from song modal, we MUST preserve the set (song modal can only be opened from set detail)
  const wasSetDetailOpen = state.selectedSet && !el("set-detail").classList.contains("hidden");
  const preservedSelectedSetId = state.selectedSet?.id;
  const preservedSelectedSet = state.selectedSet ? { ...state.selectedSet } : null; // Deep copy to preserve full object
  const isCreatingFromModal = state.creatingSongFromModal && !songId;
  
  const songData = {
    title,
    bpm,
    song_key: songKey,
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
          team_id: state.currentTeamId,
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

function openRenameTeamModal() {
  if (!isOwner()) return;
  
  const modal = el("rename-team-modal");
  const input = el("rename-team-input");
  
  if (!modal || !input) return;
  
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const currentTeamName = currentTeam?.name || "";
  input.value = currentTeamName;
  input.select();
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

async function handleRenameTeamSubmit(e) {
  e.preventDefault();
  
  if (!isOwner()) return;
  
  const modal = el("rename-team-modal");
  const input = el("rename-team-input");
  
  if (!input) return;
  
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const currentTeamName = currentTeam?.name || "Team";
  const newName = input.value.trim();
  
  if (!newName) {
    alert("Team name cannot be empty.");
    return;
  }
  
  if (newName === currentTeamName) {
    // No change, just close modal
    modal?.classList.add("hidden");
    document.body.style.overflow = "";
    return;
  }
  
  const { error } = await supabase
    .from("teams")
    .update({ name: newName })
    .eq("id", state.currentTeamId);
  
  if (error) {
    console.error("Error renaming team:", error);
    alert("Unable to rename team. Check console.");
    return;
  }
  
  // Update local state
  if (currentTeam) {
    currentTeam.name = newName;
  }
  if (state.profile?.team) {
    state.profile.team.name = newName;
  }
  
  // Update team name displays
  const teamNameDisplay = el("team-name-display");
  if (teamNameDisplay) {
    teamNameDisplay.textContent = newName;
  }
  
  // Refresh team switcher to show updated name
  updateTeamSwitcher();
  
  // Close modal
  modal?.classList.add("hidden");
  document.body.style.overflow = "";
}

async function deleteTeam() {
  if (!isOwner()) return;
  
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const teamName = currentTeam?.name || "this team";
  const message = `Are you sure? This will permanently delete all sets, songs, assignments, and team members for "${teamName}". It cannot be undone. Your account will not be deleted.`;
  
  showDeleteConfirmModal(
    teamName,
    message,
    async () => {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", state.currentTeamId);
      
      if (error) {
        console.error("Error deleting team:", error);
        alert("Unable to delete team. Check console.");
        return;
      }
      
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
  
  if (!modal || !input) return;
  
  input.value = "";
  if (message) {
    message.textContent = "";
    message.classList.remove("error-text");
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
    if (updateProfileFunctionError && (updateProfileFunctionError.code === '42883' || updateProfileFunctionError.message?.includes('function'))) {
      console.log('Update function not available, trying direct update...');
      const { error: directUpdateError } = await supabase
        .from("profiles")
        .update({ team_id: teamData.id })
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
    alert("You are already the team owner.");
    return;
  }
  
  const { error } = await supabase
    .from("profiles")
    .update({ can_manage: true })
    .eq("id", personId)
    .eq("team_id", state.currentTeamId);
  
  if (error) {
    console.error("Error promoting to manager:", error);
    alert("Unable to promote user. Check console.");
    return;
  }
  
  await loadPeople();
  alert("User promoted to manager.");
}

async function demoteFromManager(personId) {
  if (!isOwner()) return;
  
  if (personId === state.profile.id) {
    alert("You cannot demote yourself. Transfer ownership first.");
    return;
  }
  
  const { error } = await supabase
    .from("profiles")
    .update({ can_manage: false })
    .eq("id", personId)
    .eq("team_id", state.currentTeamId);
  
  if (error) {
    console.error("Error demoting manager:", error);
    alert("Unable to demote user. Check console.");
    return;
  }
  
  await loadPeople();
  alert("User demoted from manager.");
}

async function transferOwnership(person) {
  if (!isOwner()) return;
  
  if (person.id === state.profile.id) {
    alert("You are already the team owner.");
    return;
  }
  
  const teamName = state.profile?.team?.name || "this team";
  const message = `Transfer ownership of "${teamName}" to ${person.full_name || person.email}? This will make them the team owner and you will become a manager.`;
  
  showDeleteConfirmModal(
    teamName,
    message,
    async () => {
      // Update the new owner: set is_owner=true and can_manage=true
      const { error: newOwnerError } = await supabase
        .from("profiles")
        .update({ is_owner: true, can_manage: true })
        .eq("id", person.id)
        .eq("team_id", state.currentTeamId);
      
      if (newOwnerError) {
        console.error("Error updating new owner:", newOwnerError);
        alert("Unable to transfer ownership. Check console.");
        return;
      }
      
      // Update the old owner: set is_owner=false, keep can_manage=true
      const { error: oldOwnerError } = await supabase
        .from("profiles")
        .update({ is_owner: false, can_manage: true })
        .eq("id", state.profile.id)
        .eq("team_id", state.currentTeamId);
      
      if (oldOwnerError) {
        console.error("Error updating old owner:", oldOwnerError);
        alert("Unable to transfer ownership. Check console.");
        return;
      }
      
      // Update the team's owner_id
      const { error: teamError } = await supabase
        .from("teams")
        .update({ owner_id: person.id })
        .eq("id", state.profile.team_id);
      
      if (teamError) {
        console.error("Error updating team owner_id:", teamError);
        alert("Unable to transfer ownership. Check console.");
        return;
      }
      
      // Sign out and redirect to login (since they're no longer the owner)
      await supabase.auth.signOut();
      window.location.reload();
    }
  );
}

init();

