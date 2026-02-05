import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FastAverageColor } from "https://esm.sh/fast-average-color@9.4.0";

const SUPABASE_URL = "https://pvqrxkbyjhgomwqwkedw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cXJ4a2J5amhnb213cXdrZWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg1NTQsImV4cCI6MjA3ODEwNDU1NH0.FWrCZOExwjhfihh7nSZFR2FkIhcJjVyDo0GdDaGKg1g";

// Check for access_token in URL BEFORE creating Supabase client
// This way we can intercept it before detectSessionInUrl processes it
// IMPORTANT: This must run synchronously at module load time, before Supabase client is created
(function () {
  const urlHash = window.location.hash;
  const hashParams = new URLSearchParams(urlHash.substring(1));
  window.__hasAccessToken = hashParams.get('access_token');
  window.__isRecovery = hashParams.get('type') === 'recovery';
  window.__isInviteLink = window.__hasAccessToken && !window.__isRecovery;

  // Initialize theme early (basic accent color support only for pre-init)
  // Full robust application happens in initTheme() later
  const ACCENT_COLORS_INIT = {
    green: "#00996d",
    blue: "#009db1ff",
    red: "#ff3d4d",
    yellow: "#ffc800ff",
    purple: "#be54ffff",
    cadencedefault: "#ff7b51"
  };

  let match = document.cookie.match(new RegExp('(^| )theme_preference=([^;]+)'));
  let colorName = match ? match[2] : null;

  if (!colorName) {
    // Fallback to old cookie
    match = document.cookie.match(new RegExp('(^| )theme_accent=([^;]+)'));
    colorName = match ? match[2] : null;
  }

  if (colorName) {
    const hex = ACCENT_COLORS_INIT[colorName];
    if (hex) {
      document.documentElement.style.setProperty("--accent-color", hex);
    }
  }

  // We can't easily modify DOM here because it might not be ready, 
  // but initAccentColor will handle the visibility toggle later.

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

// Initialize FastAverageColor
const fac = new FastAverageColor();

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
  isLoadingSets: true,
  isLoadingSongs: true,
  isLoadingPeople: true,
  isLoadingProfile: true,
  songs: [],
  people: [],
  pendingInvites: [],
  pendingRequests: [],
  selectedSet: null,
  currentSetSongs: [],
  creatingSongFromModal: false,
  expandedSets: new Set(),
  currentSongDetailsId: null, // Track which song is open in details modal
  // iTunes indexing refresh (only used while songs are awaiting background iTunes metadata indexing)
  itunesIndexRefresh: {
    isRunning: false,
    timeoutId: null,
    attempts: 0,
    inFlight: false,
    teamId: null,
  },
  isPasswordSetup: isInviteLink, // Set flag immediately if this is an invite link
  isPasswordReset: isRecovery, // Set flag immediately if this is a password reset link
  isMemberView: false, // Track if manager is viewing as member
  currentTeamId: null, // Current team the user is viewing/working with
  userTeams: [], // Array of all teams the user is a member of
  teamAssignmentMode: 'per_set', // Team-wide assignment mode (default: per_set)
  metronome: {
    isPlaying: false,
    bpm: null,
    // intervalId: null, // No longer using setInterval for timing
    schedulerId: null, // NEW: For requestAnimationFrame or setTimeout scheduler
    audioContext: null,

    // NEW: Precise timing and accent support variables
    nextNoteTime: 0.0,
    startTime: 0.0,
    noteIndex: 0,
    beatInBar: 0,
    beatsPerBar: 4,
    secondsPerBeat: 0,
    scheduleAheadTime: 0.1, // Schedule 100ms ahead
    lookahead: 25.0, // Check every 25ms
    timeSignature: { // Default to 4/4
      numerator: 4,
      denominator: 4
    },
    clickBuffers: null,
    clickBufferSampleRate: 0,
    outputGain: null
  },
  mfa: {
    setupFactorId: null,
    setupSecret: null,
    qrCode: null,
    tempFactorId: null
  },
  lottieAnimations: {},
  songSortOption: "relevancy", // Default sort: relevancy, newest, oldest, alphabetical
  // PostHog analytics tracking state
  analytics: {
    sessionStartTime: null,
    currentPage: null,
    pageStartTime: null,
    timeTrackingIntervals: {}, // Track intervals for each page/modal
    sessionId: null
  },
  chordCharts: {
    // songId -> { loadedAt: number, charts: any[] }
    cache: new Map(),
    // Active modal context
    active: null, // { mode: 'viewer'|'editor', songId, scope, songKey, readOnly, chart, songTitle }
    editorCursor: { lineIndex: 0, charIndex: 0 },
    drag: null, // internal drag state
  },
  // AI Chat State
  isAiChatOpen: false,
  aiChatMessages: [], // { id, role, content, type: 'text'|'card', cardData? }
  isAiTyping: false,
  aiChatReplyContext: null, // { role, text }
  aiChatSelection: null, // { messageIndex, role, text }
  // AI Chat State
  isAiChatOpen: false,
  aiChatMessages: [], // { id, role, content, type: 'text'|'card', cardData? }
  isAiTyping: false,
  aiChatReplyContext: null, // { role, text }
  aiChatSelection: null // { messageIndex, role, text }
};

// PostHog tracking helper - safely tracks events even if PostHog isn't loaded yet
function trackPostHogEvent(eventName, properties = {}) {
  if (typeof window === 'undefined') {
    console.warn('PostHog: window not available');
    return false;
  }

  // Check if PostHog is available and has capture method
  const posthog = window.posthog;
  const hasPostHog = !!posthog;
  const hasCapture = posthog && typeof posthog.capture === 'function';

  // Try to capture immediately if PostHog is ready
  if (hasPostHog && hasCapture) {
    try {
      posthog.capture(eventName, properties);
      return true;
    } catch (e) {
      console.error('❌ PostHog capture error:', e);
      return false;
    }
  }

  // If PostHog isn't ready, queue the event
  if (!window._posthogQueue) {
    window._posthogQueue = [];
  }
  window._posthogQueue.push({ eventName, properties });

  return false;
}

// Flush queued PostHog events
function flushPostHogQueue() {
  if (typeof window !== 'undefined' && window._posthogQueue && window._posthogQueue.length > 0) {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      console.log('📊 PostHog: Flushing', window._posthogQueue.length, 'queued events');
      window._posthogQueue.forEach(({ eventName, properties }) => {
        try {
          window.posthog.capture(eventName, properties);
        } catch (e) {
          console.warn('PostHog capture error:', e);
        }
      });
      window._posthogQueue = [];
    }
  }
}

// Make flushPostHogQueue globally available
if (typeof window !== 'undefined') {
  window.flushPostHogQueue = flushPostHogQueue;
}

// Monitor for PostHog to become ready
if (typeof window !== 'undefined') {
  // Check periodically if PostHog loaded
  const checkPostHogReady = setInterval(() => {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      clearInterval(checkPostHogReady);
      flushPostHogQueue();
    }
  }, 100);

  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkPostHogReady), 10000);
}

// ============================================================================
// PostHog Analytics Tracking System
// ============================================================================

// Track time spent on pages/tabs/modals
function startPageTimeTracking(pageName, properties = {}) {
  if (!pageName) return;

  // Stop tracking previous page if exists
  stopPageTimeTracking();

  const startTime = Date.now();
  state.analytics.currentPage = pageName;
  state.analytics.pageStartTime = startTime;

  // Track page view
  trackPostHogEvent('page_viewed', {
    page: pageName,
    ...properties
  });

  // Set up visibility change handler to pause/resume tracking
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page hidden - pause tracking
      if (state.analytics.pageStartTime) {
        const timeSpent = Date.now() - state.analytics.pageStartTime;
        if (timeSpent > 0) {
          // Store partial time
          if (!state.analytics.timeTrackingIntervals[pageName]) {
            state.analytics.timeTrackingIntervals[pageName] = 0;
          }
          state.analytics.timeTrackingIntervals[pageName] += timeSpent;
        }
        state.analytics.pageStartTime = null;
      }
    } else {
      // Page visible - resume tracking
      if (state.analytics.currentPage === pageName) {
        state.analytics.pageStartTime = Date.now();
      }
    }
  };

  // Store handler for cleanup
  state.analytics.visibilityHandler = handleVisibilityChange;
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopPageTimeTracking() {
  if (!state.analytics.currentPage || !state.analytics.pageStartTime) return;

  const pageName = state.analytics.currentPage;
  const timeSpent = Date.now() - state.analytics.pageStartTime;

  // Add to accumulated time
  if (!state.analytics.timeTrackingIntervals[pageName]) {
    state.analytics.timeTrackingIntervals[pageName] = 0;
  }
  state.analytics.timeTrackingIntervals[pageName] += timeSpent;

  // Send time spent event
  const totalTime = state.analytics.timeTrackingIntervals[pageName];
  trackPostHogEvent('time_on_page', {
    page: pageName,
    time_seconds: Math.round(totalTime / 1000),
    time_ms: totalTime
  });

  // Clean up
  if (state.analytics.visibilityHandler) {
    document.removeEventListener('visibilitychange', state.analytics.visibilityHandler);
    state.analytics.visibilityHandler = null;
  }

  state.analytics.currentPage = null;
  state.analytics.pageStartTime = null;
}

// Track session start
function trackSessionStart() {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  state.analytics.sessionId = sessionId;
  state.analytics.sessionStartTime = Date.now();

  trackPostHogEvent('session_started', {
    session_id: sessionId,
    team_id: state.currentTeamId,
    user_id: state.session?.user?.id
  });

  // Track session end on page unload
  window.addEventListener('beforeunload', trackSessionEnd);
}

// Track session end
function trackSessionEnd() {
  if (!state.analytics.sessionStartTime) return;

  const sessionDuration = Date.now() - state.analytics.sessionStartTime;

  // Stop any active page tracking
  stopPageTimeTracking();

  trackPostHogEvent('session_ended', {
    session_id: state.analytics.sessionId,
    duration_seconds: Math.round(sessionDuration / 1000),
    duration_ms: sessionDuration,
    team_id: state.currentTeamId,
    user_id: state.session?.user?.id
  });

  // Use sendBeacon for reliable delivery on page unload
  if (navigator.sendBeacon && window.posthog) {
    try {
      const event = {
        event: 'session_ended',
        properties: {
          session_id: state.analytics.sessionId,
          duration_seconds: Math.round(sessionDuration / 1000),
          duration_ms: sessionDuration,
          team_id: state.currentTeamId,
          user_id: state.session?.user?.id
        }
      };
      // PostHog uses /batch/ endpoint, but sendBeacon needs full URL
      const url = 'https://us.i.posthog.com/batch/';
      const data = JSON.stringify([event]);
      navigator.sendBeacon(url, data);
    } catch (e) {
      console.warn('Failed to send session_end via sendBeacon:', e);
    }
  }
}

// Calculate and send aggregate metrics from Supabase data
async function sendAggregateMetrics() {
  if (!state.currentTeamId || !state.session?.user?.id) return;

  try {
    // Get all sets for current team (use left join for optional relations)
    const { data: sets, error: setsError } = await supabase
      .from('sets')
      .select(`
        id,
        is_published,
        service_times(id),
        rehearsal_times(id),
        set_songs(id),
        set_assignments(id),
        set_time_alerts(id)
      `)
      .eq('team_id', state.currentTeamId);

    if (setsError) {
      console.warn('Error fetching sets for aggregate metrics:', setsError);
      return;
    }

    // Get all songs for current team
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('id, song_keys(id)')
      .eq('team_id', state.currentTeamId);

    if (songsError) {
      console.warn('Error fetching songs for aggregate metrics:', songsError);
      return;
    }

    // Get all users with pinned sets for this team
    // First get all set IDs for this team, then check pinned_sets
    const setIds = sets?.map(s => s.id) || [];
    let uniquePinnedUsers = 0;
    if (setIds.length > 0) {
      const { data: pinnedSets, error: pinnedError } = await supabase
        .from('pinned_sets')
        .select('user_id, set_id')
        .in('set_id', setIds);

      if (!pinnedError && pinnedSets) {
        uniquePinnedUsers = new Set(pinnedSets.map(p => p.user_id)).size;
      }
    }

    // Calculate metrics
    const totalSets = sets?.length || 0;
    const setsWithServiceTime = sets?.filter(s => s.service_times && s.service_times.length > 0).length || 0;
    const setsWithRehearsals = sets?.filter(s => s.rehearsal_times && s.rehearsal_times.length > 0).length || 0;
    const publishedSets = sets?.filter(s => s.is_published).length || 0;

    const totalSongs = songs?.length || 0;
    const totalKeys = songs?.reduce((sum, s) => sum + (s.song_keys?.length || 0), 0) || 0;

    const totalUsers = state.people?.length || 0;

    // Calculate averages
    const avgSongsPerSet = totalSets > 0
      ? sets.reduce((sum, s) => sum + (s.set_songs?.length || 0), 0) / totalSets
      : 0;

    const avgRehearsalsPerSet = totalSets > 0
      ? sets.reduce((sum, s) => sum + (s.rehearsal_times?.length || 0), 0) / totalSets
      : 0;

    // For assignments, we need to get song assignments from set_songs
    // This is complex, so let's get a simpler count
    const totalSetAssignments = sets?.reduce((sum, s) => sum + (s.set_assignments?.length || 0), 0) || 0;
    const avgAssignmentsPerSet = totalSets > 0 ? totalSetAssignments / totalSets : 0;

    const avgAlertsPerSet = totalSets > 0
      ? sets.reduce((sum, s) => sum + (s.set_time_alerts?.length || 0), 0) / totalSets
      : 0;

    // Send aggregate metrics as a single event
    trackPostHogEvent('team_aggregate_metrics', {
      team_id: state.currentTeamId,
      total_sets: totalSets,
      published_sets: publishedSets,
      sets_with_service_time: setsWithServiceTime,
      sets_with_service_time_pct: totalSets > 0 ? parseFloat((setsWithServiceTime / totalSets * 100).toFixed(2)) : 0,
      sets_with_rehearsals: setsWithRehearsals,
      sets_with_rehearsals_pct: totalSets > 0 ? parseFloat((setsWithRehearsals / totalSets * 100).toFixed(2)) : 0,
      users_with_pinned_sets: uniquePinnedUsers,
      users_with_pinned_sets_pct: totalUsers > 0 ? parseFloat((uniquePinnedUsers / totalUsers * 100).toFixed(2)) : 0,
      avg_songs_per_set: parseFloat(avgSongsPerSet.toFixed(2)),
      avg_rehearsals_per_set: parseFloat(avgRehearsalsPerSet.toFixed(2)),
      avg_assignments_per_set: parseFloat(avgAssignmentsPerSet.toFixed(2)),
      avg_alerts_per_set: parseFloat(avgAlertsPerSet.toFixed(2)),
      total_songs: totalSongs,
      avg_keys_per_song: totalSongs > 0 ? parseFloat((totalKeys / totalSongs).toFixed(2)) : 0
    });

  } catch (error) {
    console.error('Error calculating aggregate metrics:', error);
  }
}

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
  // Don't show error if tab is in background (prevents false positives from throttling)
  if (document.hidden) {
    console.warn('⚠️ Suppressing database error overlay because tab is hidden');
    return;
  }

  const overlay = el('database-error-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    // Prevent body scroll when overlay is shown
    document.body.style.overflow = 'hidden';
  }
}

// Helper to close modal with animation
function closeModalWithAnimation(modalElement, onHidden) {
  if (!modalElement) return;

  // Stop tracking time on modal if it was being tracked
  const modalId = modalElement.id;
  if (modalId && state.analytics.currentPage?.startsWith('modal_')) {
    stopPageTimeTracking();
  }

  // Add closing class to trigger exit animation
  modalElement.classList.add('closing');

  // Wait for animation to finish (match CSS duration ~250ms)
  setTimeout(() => {
    modalElement.classList.remove('closing');
    modalElement.classList.add('hidden');
    document.body.style.overflow = '';

    // Execute callback for state cleanup/form reset
    if (onHidden) {
      onHidden();
    }
  }, 250); // Slightly longer than 0.2s to be safe
}

function resetModalScroll(modalElement) {
  if (!modalElement) return;

  // Reset overlay scroll (if used) and content scroll (primary)
  modalElement.scrollTop = 0;
  modalElement.scrollLeft = 0;

  const content = modalElement.querySelector('.modal-content');
  if (content) {
    content.scrollTop = 0;
    content.scrollLeft = 0;
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

// Quick health check to see if DB is actually down or just slow
async function checkDatabaseHealth() {
  try {
    // 5 second timeout for health check
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), 5000)
    );

    // Simple lightweight query
    const pingPromise = supabase.from('profiles').select('id').limit(1).maybeSingle();

    await Promise.race([pingPromise, timeoutPromise]);
    return true; // Connection is good
  } catch (e) {
    return false; // Connection failed
  }
}

// Wrapper function to handle Supabase operations with database error detection
async function safeSupabaseOperation(operation, options = {}) {
  const {
    showErrorOnFailure = true,
    retryOnError = false,
    maxRetries = 0,
    timeout = 45000 // Increased default timeout to 45s to reduce false positives
  } = options;

  try {
    // Wrap operation in timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeout)
    );

    const result = await Promise.race([operation(), timeoutPromise]);

    // If we got here, operation succeeded - hide error overlay
    // If we got here, operation succeeded - hide error overlay
    if (result?.error && isDatabaseUnresponsive(result.error)) {
      let isActuallyUnresponsive = true;

      // Check if it's a false positive
      if (showErrorOnFailure) {
        const isHealthy = await checkDatabaseHealth();
        if (isHealthy) {
          isActuallyUnresponsive = false;
          console.warn('Database health check passed despite error result. Suppressing unresponsive popup.', result.error);
        }
      }

      if (showErrorOnFailure && isActuallyUnresponsive) {
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
      let isActuallyUnresponsive = true;

      // Check if it's a false positive
      if (showErrorOnFailure) {
        const isHealthy = await checkDatabaseHealth();
        if (isHealthy) {
          isActuallyUnresponsive = false;
          console.warn('Database health check passed despite exception. Suppressing unresponsive popup.', error);
        }
      }

      if (showErrorOnFailure && isActuallyUnresponsive) {
        showDatabaseError();
      }

      // Return error in Supabase format for consistency
      return {
        data: null,
        error: {
          message: error.message || 'Database is unresponsive',
          code: isActuallyUnresponsive ? (error.code || 'DATABASE_UNRESPONSIVE') : 'TIMEOUT_BUT_RESPONSIVE'
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

/* Helper to safely check MFA with timeout */
// App Data Caching System
const APP_CACHE_PREFIX = 'cadence_app_data_';

function saveAppDataToCache(session) {
  if (!session?.user?.id) return;
  try {
    const cacheData = {
      profile: state.profile,
      sets: state.sets,
      songs: state.songs,
      people: state.people,
      userTeams: state.userTeams,
      currentTeamId: state.currentTeamId,
      pendingRequests: state.pendingRequests,
      timestamp: Date.now()
    };
    localStorage.setItem(APP_CACHE_PREFIX + session.user.id, JSON.stringify(cacheData));
    console.log('💾 App data cached to localStorage');
  } catch (e) {
    console.warn('Failed to cache app data', e);
  }
}

function loadAppDataFromCache(session) {
  if (!session?.user?.id) return false;
  try {
    const cached = localStorage.getItem(APP_CACHE_PREFIX + session.user.id);
    if (!cached) return false;
    const data = JSON.parse(cached);

    // Populate state
    state.profile = data.profile;
    state.sets = data.sets || [];

    // Deduplicate songs by ID (keep first occurrence) before storing in state
    const seenSongIds = new Set();
    const uniqueSongsFromCache = (data.songs || []).filter(song => {
      if (seenSongIds.has(song.id)) {
        return false;
      }
      seenSongIds.add(song.id);
      return true;
    });
    state.songs = uniqueSongsFromCache;

    state.people = data.people || [];
    state.userTeams = (data.userTeams || []).map(t => ({
      ...t,
      ai_enabled: t.ai_enabled || false
    }));
    state.currentTeamId = data.currentTeamId;
    state.pendingRequests = data.pendingRequests || [];
    state.session = session; // Ensure session is set

    // Important: Reset loading flags so UI renders content instead of spinners
    state.isLoadingSets = false;
    state.isLoadingSongs = false;
    state.isLoadingPeople = false;
    state.isLoadingProfile = false;

    console.log('📂 App data loaded from cache');
    return true;
  } catch (e) {
    console.warn('Failed to load app data from cache', e);
    return false;
  }
}

/* Helper to safely check MFA with timeout */
async function checkMfaRequirements(session) {
  if (!supabase.auth.mfa) return false;

  try {
    console.log("🔒 Checking MFA status...");
    const cacheKey = `cadence_mfa_factors_${session.user.id}`;

    // 0. PRIORITY OPTIMIZATION: Check Cached App Data FIRST
    // The user wants instant load. If we have data, we show it and check MFA in background.
    const hasCachedAppData = loadAppDataFromCache(session);
    if (hasCachedAppData) {
      console.log("⏩ Optimistic MFA check: Cached app data found. Allowing access while verifying in background.");
      // Verification in background to catch any security changes
      checkMfaInBackground(session, cacheKey);
      return false; // Allow access immediately (Fail Open for UI speed)
    }

    // 1. Check AAL (Fast, local check)
    // If user is already AAL2 verified, we don't need to check factors
    let aalResult = null;
    try {
      console.log("  - Checking AAL...");
      // Add timeout to AAL check
      const aalTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("AAL check timed out")), 2000));
      const { data: aal, error: aalError } = await Promise.race([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        aalTimeout
      ]);

      if (!aalError && aal.currentLevel === 'aal2') {
        console.log("✅ User is already MFA verified (AAL2). Skipping factor check.");
        return false;
      }
      aalResult = aal; // Store result
    } catch (aalErr) {
      console.warn("  - AAL check failed or timed out:", aalErr);
      console.log("⚠️ AAL check timed out. Failing OPEN to prevent lockout.");
      return false;
    }

    // 2. OPTIMIZATION: Check '0 factors' Cache for Non-MFA users
    // If we confidently know the user has 0 verified factors, skip network call
    const cachedCount = localStorage.getItem(cacheKey);

    if (cachedCount === '0') {
      console.log("⏩ Optimistic MFA check: Cache says 0 factors. Allowing access while verifying in background.");
      checkMfaInBackground(session, cacheKey);
      return false; // Allow access immediately
    }

    // 3. Network Check (Slower, fallback)
    console.log("  - Verification required (no cached app data or MFA potentially active). Verifying...");
    return await verifyMfaAndCache(session, cacheKey);

  } catch (err) {
    console.warn("⚠️ MFA Check skipped/failed (Fail Open):", err);
    return false; // Fail open
  }
}

// Background verification for optimistic checks
function checkMfaInBackground(session, cacheKey) {
  console.log("🔄 Starting background MFA check...");
  verifyMfaAndCache(session, cacheKey).then(isRequired => {
    if (isRequired) {
      console.warn("🔒 Background MFA check found requirement! Locking UI.");

      // If we optimistically let them in but they actually need MFA, lock them out now
      if (!authGate || authGate.classList.contains("hidden")) {
        // Only show if we aren't already dealing with auth
        showAuthGate();
        setAuthMessage("Security check failed. Two-factor authentication required.", false);
        openMfaChallengeModal({
          onSuccess: () => {
            // MFA passed, hide gate and refresh data
            // We don't need to full reload because data is likely already there/fetching
            const dashboard = el("dashboard");
            const authGate = el("auth-gate");
            if (dashboard) dashboard.classList.remove("hidden");
            if (authGate) authGate.classList.add("hidden");
            updateMfaStatusUI();
          }
        });
      }
    } else {
      console.log("✅ Background MFA check passed (consistency confirmed).");
    }
  }).catch(err => {
    console.error("Background MFA check error:", err);
  });
}

// Core verification logic with caching
async function verifyMfaAndCache(session, cacheKey) {
  console.log("  - verifyMfaAndCache called");
  try {
    // Use a simple race with a manually created promise for timeout
    const timeoutMs = 4000;
    const result = await new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("MFA listFactors timed out"));
      }, timeoutMs);

      try {
        const response = await supabase.auth.mfa.listFactors();
        clearTimeout(timer);
        resolve(response);
      } catch (innerErr) {
        clearTimeout(timer);
        reject(innerErr);
      }
    });

    const { data: factorsData, error: factorsError } = result;

    if (factorsError) throw factorsError;

    // Count verified TOTP factors
    const totpFactors = factorsData?.all?.filter(f => f.factor_type === 'totp' && f.status === 'verified') || [];
    console.log(`  - Factors found: ${totpFactors.length}`);

    // Update cache
    localStorage.setItem(cacheKey, totpFactors.length.toString());

    if (totpFactors.length > 0) {
      // Re-check AAL to be sure
      const { data: aalCheck } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalCheck && aalCheck.currentLevel !== 'aal2') {
        console.log("  - MFA required (Factors exist, AAL < 2)");
        return true; // MFA REQUIRED
      }
    }

    console.log("  - MFA not required");
    return false;
  } catch (e) {
    console.warn("  - Error/Timeout in verifyMfaAndCache:", e);
    // Fail open on error
    return false;
  }
}

// Setup observers to ensure animations replay correctly on re-open
function setupModalObservers() {
  const modals = document.querySelectorAll('.modal');

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' &&
        mutation.attributeName === 'class' &&
        mutation.oldValue &&
        mutation.oldValue.includes('hidden') &&
        !mutation.target.classList.contains('hidden')) {

        // Modal just became visible
        // Force animation restart if it doesn't happen automatically
        const target = mutation.target;

        // Slightly delay to ensure browser acknowledges visible state
        requestAnimationFrame(() => {
          target.style.animation = 'none';
          target.offsetHeight; /* force reflow */
          target.style.animation = '';

          const content = target.querySelector('.modal-content');
          if (content) {
            content.style.animation = 'none';
            content.offsetHeight; /* force reflow */
            content.style.animation = '';
          }

          // Always reset scroll when a modal opens
          resetModalScroll(target);
        });
      }
    });
  });

  modals.forEach(modal => {
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true
    });
  });
}

function initTabAnimations() {
  if (typeof lottie === 'undefined') {
    console.warn('Lottie not loaded');
    return;
  }

  // Star Ticket.json for sets
  // Check if element exists before loading
  if (document.getElementById('anim-sets')) {
    state.lottieAnimations.sets = lottie.loadAnimation({
      container: document.getElementById('anim-sets'),
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: 'Star Ticket.json'
    });
  }

  // Song slide.json for songs
  if (document.getElementById('anim-songs')) {
    state.lottieAnimations.songs = lottie.loadAnimation({
      container: document.getElementById('anim-songs'),
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: 'Song slide.json'
    });
  }

  // 2 users ai.json for team/people
  if (document.getElementById('anim-people')) {
    state.lottieAnimations.people = lottie.loadAnimation({
      container: document.getElementById('anim-people'),
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: '2 users ai.json'
    });
  }
}

async function init() {
  // Initialize color picker visibility logic
  initTheme();

  // Initialize tab animations
  initTabAnimations();

  // Setup modal animation listeners
  setupModalObservers();

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

    // Ignore TOKEN_REFRESHED if we already have a session and app is loaded
    if (event === 'TOKEN_REFRESHED' && state.session) {
      console.log('  - Token refreshed, skipping full reload');
      return;
    }

    // AUTH LOADING STATE OPTIMIZATION
    // Immediately show spinner if we have a session to improve perceived performance
    if (session) {
      const authGateInner = document.getElementById('auth-gate');
      const spinner = document.getElementById('auth-loading-spinner');
      if (authGateInner && spinner) {
        // Hide the login form but keep the auth gate visible (the card)
        const loginForm = authGateInner.querySelector('#login-form-container');
        if (loginForm) loginForm.classList.add('hidden');

        // Show the spinner
        spinner.classList.remove('hidden');

        // Ensure the auth gate card itself is visible
        authGateInner.classList.remove('hidden');
      }
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
      console.log('  - Session exists. Verifying MFA before loading app...');
      isProcessingSession = true;

      try {
        // MFA CHECK (Blocking)
        const mfaRequired = await checkMfaRequirements(session);

        if (mfaRequired) {
          console.log("🔒 MFA Enforced - Blocking access");
          showAuthGate();
          setAuthMessage("Two-factor authentication required.", false);

          openMfaChallengeModal({
            onSuccess: () => {
              isProcessingSession = false;
              // Now safe to load app
              loadDataAndShowApp(session);
            }
          });
          // Do NOT load app or data yet
          return;
        }

        console.log("✅ MFA Check passed. Loading application...");
        isProcessingSession = false;
        loadDataAndShowApp(session);

      } catch (err) {
        console.error("Critical Auth/MFA Error:", err);
        isProcessingSession = false;
        // Fallback to allowed to prevent lockout if just an API error? 
        // Or fail closed for security? Fails closed here (auth gate stays).
        setAuthMessage("Authentication verification failed. Please try again.", true);
      }
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
  // Check for existing session first with timeout
  console.log('🔍 Checking for existing session...');
  let session = null;

  try {
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Session check timeout')), 3000)
    );

    // Race to prevent hanging
    const result = await Promise.race([getSessionPromise, timeoutPromise]);
    session = result?.data?.session || null;

    if (result.error) {
      console.error('❌ Session error from getSession:', result.error);
    }
  } catch (err) {
    console.warn('⚠️ Session check failed or timed out:', err);
    // Proceed as if no session; if one exists, onAuthStateChange or subsequent refreshes will catch it
  }

  initialSessionChecked = true;

  console.log('📋 Initial session check result:', session ? '✅ Found session' : '❌ No session');

  // Only process if we have a session and haven't already processed it via onAuthStateChange
  if (session && !isProcessingSession) {
    console.log('✅ Session found in init. Verifying MFA/Cache...');
    state.session = session;
    isProcessingSession = true;

    try {
      // MFA CHECK (Blocking or Background)
      // This uses the same logic as onAuthStateChange, enabling cache utilization
      const mfaRequired = await checkMfaRequirements(session);

      if (mfaRequired) {
        console.log("🔒 MFA Enforced (Init) - Blocking access");
        showAuthGate();
        setAuthMessage("Two-factor authentication required.", false);

        openMfaChallengeModal({
          onSuccess: () => {
            isProcessingSession = false;
            // Now safe to load app
            loadDataAndShowApp(session);
          }
        });
      } else {
        // MFA Check passed (or running in background)
        console.log("✅ MFA Check passed/backgrounded (Init). Loading application...");
        isProcessingSession = false;
        loadDataAndShowApp(session);
      }
    } catch (err) {
      console.error("Critical Auth/MFA Error in Init:", err);
      isProcessingSession = false;
      showAuthGate();
      setAuthMessage("Authentication check failed. Please refresh.", true);
    }
  } else if (!session) {
    console.log('❌ No session in init, calling showAuthGate()');
    showAuthGate();
  } else {
    // Session exists but isProcessingSession is true?
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

  // Auto-recovery from background throttling
  // This handles the case where the user leaves the tab, background throttling causes a timeout/error,
  // and then when they come back, we want to immediately check if the DB is actually fine.
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      const overlay = el('database-error-overlay');
      // If overlay is showing when user comes back
      if (overlay && !overlay.classList.contains('hidden')) {
        console.log('👀 Tab focused checking DB health to potentially dismiss overlay...');
        const isHealthy = await checkDatabaseHealth();
        if (isHealthy) {
          console.log('✅ DB is healthy, dismissing stale overlay');
          hideDatabaseError();
        }
      }
    }
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

  // Secret Trigger management (Account Menu Button)
  let accountEditClickCount = 0;
  let accountEditClickTimer = null;

  el("btn-account-menu")?.addEventListener("click", (e) => {
    // Don't prevent default, we want the menu to open normally
    // e.preventDefault(); 

    accountEditClickCount++;

    if (accountEditClickTimer) clearTimeout(accountEditClickTimer);

    if (accountEditClickCount >= 5) {
      // Trigger secret menu
      accountEditClickCount = 0;
      const picker = el("hidden-color-picker");
      if (picker) {
        picker.classList.remove("hidden");
        // Save unlocked state
        document.cookie = "theme_picker_enabled=true; path=/; max-age=31536000"; // 1 year

        // PostHog: Track theme Easter egg discovery
        trackPostHogEvent('theme_easter_egg_discovered', {
          team_id: state.currentTeamId
        });
      }
      return;
    }

    // Reset counter if too slow
    accountEditClickTimer = setTimeout(() => {
      accountEditClickCount = 0;
    }, 400); // 400ms window
  });

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
  el("btn-reset-password")?.addEventListener("click", () => handleAccountPasswordReset());


  // Helper to toggle dropdowns with exit animation
  function toggleDropdown(element) {
    if (!element) return;
    if (element.classList.contains("hidden")) {
      element.classList.remove("hidden");
    } else {
      element.classList.add("animate-out");
      setTimeout(() => {
        element.classList.add("hidden");
        element.classList.remove("animate-out");
      }, 250); // Matches CSS animation duration
    }
  }

  // Account switcher
  const accountMenuBtn = el("btn-account-menu");
  const accountMenu = el("account-menu");
  accountMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown(accountMenu);
  });

  // Close account menu when clicking outside
  document.addEventListener("click", (e) => {
    // Helper to close a dropdown if click is outside
    const closeDropdownIfOutside = (menu, btn) => {
      if (menu && !menu.classList.contains("hidden") && !menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
        toggleDropdown(menu);
      }
    };

    closeDropdownIfOutside(accountMenu, accountMenuBtn);
    closeDropdownIfOutside(el("header-add-dropdown-menu"), el("btn-header-add-toggle"));
    closeDropdownIfOutside(el("mobile-header-add-dropdown-menu"), el("btn-mobile-header-add-toggle"));

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
    toggleDropdown(el("account-menu"));
    setTimeout(() => openCreateTeamModal(), 100);
  });

  // Empty state create team button
  el("btn-create-team-empty")?.addEventListener("click", () => {
    openCreateTeamModal();
  });

  el("btn-logout-menu")?.addEventListener("click", () => {
    // Track session end before logout
    trackSessionEnd();

    // Clear theme usage cookies
    document.cookie = 'theme_preference=; path=/; max-age=0';
    document.cookie = 'theme_picker_enabled=; path=/; max-age=0';
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
  let isSongSearchTransitioning = false;
  el("songs-tab-search")?.addEventListener("input", () => {
    // Use View Transitions API if available, but safeguard against rapid invalid state errors
    if (document.startViewTransition && !isSongSearchTransitioning) {
      isSongSearchTransitioning = true;
      try {
        const transition = document.startViewTransition(() => {
          renderSongCatalog(false);
        });
        transition.finished.finally(() => {
          isSongSearchTransitioning = false;
        });
      } catch (e) {
        // Fallback if transition fails start
        console.warn("View transition failed:", e);
        isSongSearchTransitioning = false;
        renderSongCatalog(false);
      }
    } else {
      renderSongCatalog(false);
    }
  });

  // Songs tab sort dropdown toggle
  el("btn-songs-sort-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown(el("songs-sort-dropdown-menu"));
  });

  // Songs tab sort dropdown items
  const updateSortSelection = () => {
    document.querySelectorAll("#songs-sort-dropdown-menu .header-dropdown-item").forEach(item => {
      if (item.dataset.sort === (state.songSortOption || "relevancy")) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });
  };

  document.querySelectorAll("#songs-sort-dropdown-menu .header-dropdown-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const sortOption = item.dataset.sort;
      state.songSortOption = sortOption;

      // Update label
      const labelMap = {
        relevancy: "Relevancy",
        newest: "Newest",
        oldest: "Oldest",
        alphabetical: "Alphabetical"
      };
      const labelEl = el("songs-sort-label");
      if (labelEl) {
        labelEl.textContent = `Sort: ${labelMap[sortOption]}`;
      }

      // Update selection visual
      updateSortSelection();

      // Close dropdown
      const menu = el("songs-sort-dropdown-menu");
      if (menu) {
        menu.classList.add("hidden");
        menu.classList.remove("animate-out");
      }

      // Re-render songs
      renderSongCatalog(false);
    });
  });

  // Initialize selection visual
  updateSortSelection();

  // Close sort dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const container = el("songs-sort-dropdown-container");
    const menu = el("songs-sort-dropdown-menu");
    if (container && menu && !container.contains(e.target) && !menu.classList.contains("hidden")) {
      menu.classList.add("hidden");
      menu.classList.remove("animate-out");
    }
  });

  // Initialize sort label
  const updateSortLabel = () => {
    const labelMap = {
      relevancy: "Relevancy",
      newest: "Newest",
      oldest: "Oldest",
      alphabetical: "Alphabetical"
    };
    const labelEl = el("songs-sort-label");
    if (labelEl) {
      labelEl.textContent = `Sort: ${labelMap[state.songSortOption || "relevancy"]}`;
    }
  };
  updateSortLabel();

  // People tab search
  let isPeopleSearchTransitioning = false;
  el("people-tab-search")?.addEventListener("input", () => {
    if (document.startViewTransition && !isPeopleSearchTransitioning) {
      isPeopleSearchTransitioning = true;
      try {
        const transition = document.startViewTransition(() => {
          renderPeople(false);
        });
        transition.finished.finally(() => {
          isPeopleSearchTransitioning = false;
        });
      } catch (e) {
        console.warn("View transition failed:", e);
        isPeopleSearchTransitioning = false;
        renderPeople(false);
      }
    } else {
      renderPeople(false);
    }
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
  el("btn-publish-set-detail")?.addEventListener("click", async () => {
    if (state.selectedSet && isManager()) {
      startPublishCountdown(state.selectedSet);
    }
  });

  // Header dropdown toggle (desktop)
  el("btn-header-add-toggle")?.addEventListener("click", (e) => {
    // Extra safety: if user isn't a manager (or is in member view), do nothing
    if (!isManager()) return;
    e.stopPropagation();
    toggleDropdown(el("header-add-dropdown-menu"));
  });

  // Mobile header dropdown toggle
  el("btn-mobile-header-add-toggle")?.addEventListener("click", (e) => {
    // Extra safety: if user isn't a manager (or is in member view), do nothing
    if (!isManager()) return;
    e.stopPropagation();
    const dropdownMenu = el("mobile-header-add-dropdown-menu");
    const button = e.currentTarget;

    // Use toggleDropdown for consistent animation
    if (dropdownMenu && button) {
      if (dropdownMenu.classList.contains("hidden")) {
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
          if (leftPosition < 0) {
            leftPosition = 0;
          }

          dropdownMenu.style.left = `${leftPosition}px`;
        }

        toggleDropdown(dropdownMenu);
      } else {
        toggleDropdown(dropdownMenu);
      }
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
  el("btn-publish-set")?.addEventListener("click", handlePublishSet);
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
  el("close-person-details-modal")?.addEventListener("click", () => {
    closePersonDetailsModal();
  });
  // Close person details when clicking backdrop
  el("person-details-modal")?.addEventListener("click", (e) => {
    if (e.target === el("person-details-modal")) {
      closePersonDetailsModal();
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
  el("delete-song-from-edit-modal")?.addEventListener("click", () => {
    const deleteBtn = el("delete-song-from-edit-modal");
    const songId = deleteBtn?.dataset.songId;
    if (songId) {
      closeSongEditModal();
      deleteSong(songId);
    }
  });
  el("song-edit-form")?.addEventListener("submit", handleSongEditSubmit);
  el("btn-add-song-key")?.addEventListener("click", () => addSongKeyInput());
  // Charts are rendered as rows in the resources list; keep generated rows in sync with key edits
  el("song-keys-list")?.addEventListener("input", () => {
    const form = el("song-edit-form");
    const songId = form?.dataset?.songId || null;
    if (!songId) return;
    fetchSongCharts(songId, { useCache: false }).then(charts => {
      injectSongChartsIntoSongLinksList({
        songId,
        songTitle: el("song-edit-title")?.value?.trim?.() || "",
        charts,
        keys: collectSongKeys().map(k => k?.key).filter(Boolean),
      });
    }).catch(() => { });
  });
  el("close-song-details-modal")?.addEventListener("click", () => closeSongDetailsModal());

  // Chord chart viewer/editor
  el("close-chart-viewer")?.addEventListener("click", () => closeChordChartViewer());
  el("close-chart-editor")?.addEventListener("click", () => closeChordChartEditor());
  el("btn-chart-viewer-edit")?.addEventListener("click", () => {
    const active = state.chordCharts.active;
    if (active && active.songId && (isManager() || isOwner())) {
      closeChordChartViewer();
      // Ensure we pass the key and other details correctly
      openChordChartEditor({
        songId: active.songId,
        songKey: active.songKey,
        scope: active.scope,
        existingChart: active.chart,
        songTitle: active.songTitle
      });
    }
  });

  el("btn-chart-viewer-export")?.addEventListener("click", () => openPrintChartFromActive());
  el("btn-chart-editor-export")?.addEventListener("click", () => openPrintChartFromActive());
  el("chart-viewer-modal")?.addEventListener("click", (e) => {
    if (e.target === el("chart-viewer-modal")) closeChordChartViewer();
  });
  el("chart-editor-modal")?.addEventListener("click", (e) => {
    if (e.target === el("chart-editor-modal")) closeChordChartEditor();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const viewer = el("chart-viewer-modal");
    const editor = el("chart-editor-modal");
    if (viewer && !viewer.classList.contains("hidden")) closeChordChartViewer();
    if (editor && !editor.classList.contains("hidden")) closeChordChartEditor();
  });

  // Keep the PDF pages fitted as viewport changes
  window.addEventListener("resize", () => {
    const viewerWrap = el("chart-viewer-page");
    if (viewerWrap && !el("chart-viewer-modal")?.classList.contains("hidden")) {
      fitAllChartPagesToContainer(viewerWrap);
    }
    const editorWrap = el("chart-editor-page");
    if (editorWrap && !el("chart-editor-modal")?.classList.contains("hidden")) {
      fitAllChartPagesToContainer(editorWrap);
    }
  });
  el("btn-chart-editor-format")?.addEventListener("click", () => {
    const active = state.chordCharts.active;
    if (!active || active.mode !== "editor") return;
    const lyricsInput = el("chart-lyrics-input");
    if (!lyricsInput) return;
    // Best-effort formatting: normalize newlines and trim trailing whitespace
    const oldLines = active.chart.doc.lyricsLines || [];
    const normalized = normalizeLyricsLinesFromText(lyricsInput.value);
    lyricsInput.value = normalized.join("\n");
    active.chart.doc.lyricsLines = normalized;

    // Adjust placements to match new line indices
    if (oldLines.length !== normalized.length || !oldLines.every((line, idx) => line === normalized[idx])) {
      active.chart.doc.placements = adjustPlacementsForLyricsChange(
        oldLines,
        normalized,
        active.chart.doc.placements || []
      );
    }

    const wrapEl = el("chart-editor-page");
    if (wrapEl) {
      renderChartDocIntoPage(wrapEl, active.chart.doc, {
        songTitle: active.songTitle || active.chart.doc.title || "Chord Chart",
        subtitle: active.scope === "key" ? `Key: ${active.songKey}` : (active.chart.chartType === "number" ? "Number chart" : "Chord chart"),
        layout: active.chart.layout,
        readOnly: false,
      });
      wireChordChartEditorInteractions();
      requestAnimationFrame(() => fitAllChartPagesToContainer(wrapEl));
    }
  });
  el("btn-chart-editor-save")?.addEventListener("click", async () => {
    const active = state.chordCharts.active;
    if (!active || active.mode !== "editor") return;
    const lyricsInput = el("chart-lyrics-input");
    if (lyricsInput) {
      active.chart.doc.lyricsLines = normalizeLyricsLinesFromText(lyricsInput.value);
    }

    try {
      // Enforce: only one general number chart per song
      if (active.scope === "general" && (active.chart.chartType || "chord") === "number") {
        const charts = await fetchSongCharts(active.songId, { useCache: false });
        const otherNumber = (charts || []).find(c =>
          c.scope === "general" &&
          c.chart_type === "number" &&
          String(c.id) !== String(active.chart.id || "")
        );
        if (otherNumber) {
          toastError("Only one Number Chart is allowed in General resources.");
          return;
        }
      }
      const saved = await saveSongChart({
        id: active.chart.id,
        songId: active.songId,
        scope: active.scope,
        chartType: active.scope === "key" ? "chord" : (active.chart.chartType || "chord"),
        layout: active.chart.layout || active.chart.doc?.settings?.layout || "one_column",
        songKey: active.scope === "key" ? normalizeKeyLabel(active.songKey) : null,
        doc: active.chart.doc,
      });
      active.chart.id = saved.id;
      toastSuccess("Chord chart saved.");
      trackPostHogEvent("chart_saved", {
        team_id: state.currentTeamId,
        song_id: active.songId,
        scope: active.scope,
        song_key: active.songKey || null,
        chart_type: saved.chart_type,
      });

      // If song edit modal is open, refresh chart rows in the resources list
      const songEditOpen = !!el("song-edit-modal") && !el("song-edit-modal").classList.contains("hidden");
      if (songEditOpen) {
        const charts = await fetchSongCharts(active.songId, { useCache: false });
        injectSongChartsIntoSongLinksList({
          songId: active.songId,
          songTitle: el("song-edit-title")?.value?.trim?.() || active.songTitle || "",
          charts,
          keys: collectSongKeys().map(k => k?.key).filter(Boolean),
        });
      }
    } catch (err) {
      console.error("Failed to save chart:", err);
      toastError("Failed to save chord chart. Check console.");
    }
  });

  el("btn-chart-insert")?.addEventListener("click", () => {
    const active = state.chordCharts.active;
    if (!active || active.mode !== "editor") return;
    const input = el("chart-insert-value");
    const wrapEl = el("chart-editor-page");
    if (!input || !wrapEl) return;
    const value = input.value.trim();
    if (!value) return;

    const kind = active.chart.chartType === "number" ? "number" : "chord";
    const lyricsLines = active.chart.doc.lyricsLines || [];
    const placements = active.chart.doc.placements || [];
    const charWidth = measureMonoCharWidthPx();

    // Find a good position: use cursor if valid, otherwise find first visible line with space
    let lineIndex = state.chordCharts.editorCursor?.lineIndex ?? 0;
    let charIndex = state.chordCharts.editorCursor?.charIndex ?? 0;

    // If cursor is out of bounds or on a section header, find a better position
    if (lineIndex >= lyricsLines.length) {
      lineIndex = Math.max(0, lyricsLines.length - 1);
      charIndex = 0;
    }

    const lineText = lyricsLines[lineIndex] || "";
    // Check if this is a section header
    if (lineText.trim().match(/^\[([^\]]+)\]$/)) {
      // Skip section headers, find next regular line
      for (let i = lineIndex + 1; i < lyricsLines.length; i++) {
        if (!lyricsLines[i].trim().match(/^\[([^\]]+)\]$/)) {
          lineIndex = i;
          charIndex = 0;
          break;
        }
      }
    }

    // Find a position that doesn't overlap with existing chords on this line
    const linePlacements = placements.filter(p => p.lineIndex === lineIndex);
    const estimatedChordWidth = (value.length + 2) * charWidth; // rough estimate

    // Try to find a gap or position at the end
    let foundPosition = false;
    for (let testCharIndex = 0; testCharIndex < (lineText.length || 20); testCharIndex += 2) {
      const testLeft = testCharIndex * charWidth;
      const overlaps = linePlacements.some(p => {
        const pLeft = (p.charIndex || 0) * charWidth;
        const pRight = pLeft + estimatedChordWidth;
        const testRight = testLeft + estimatedChordWidth;
        return (testLeft < pRight && testRight > pLeft);
      });

      if (!overlaps) {
        charIndex = testCharIndex;
        foundPosition = true;
        break;
      }
    }

    // If no gap found, place at end of line
    if (!foundPosition) {
      charIndex = Math.max(0, (lineText.length || 0) * charWidth / charWidth);
    }

    const placement = {
      id: genPlacementId(),
      lineIndex,
      charIndex,
      kind,
      value,
    };

    if (!Array.isArray(active.chart.doc.placements)) active.chart.doc.placements = [];
    active.chart.doc.placements.push(placement);
    input.value = "";

    // Update cursor to the new position
    state.chordCharts.editorCursor = { lineIndex, charIndex };

    renderChartDocIntoPage(wrapEl, active.chart.doc, {
      songTitle: active.songTitle || active.chart.doc.title || "Chord Chart",
      subtitle: active.scope === "key" ? `Key: ${active.songKey}` : (active.chart.chartType === "number" ? "Number chart" : "Chord chart"),
      layout: active.chart.layout,
      readOnly: false,
    });
    wireChordChartEditorInteractions();
    requestAnimationFrame(() => fitAllChartPagesToContainer(wrapEl));
  });

  el("chart-insert-value")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el("btn-chart-insert")?.click();
    }
  });

  el("chart-lyrics-input")?.addEventListener("input", () => {
    const active = state.chordCharts.active;
    if (!active || active.mode !== "editor") return;
    const lyricsInput = el("chart-lyrics-input");
    const wrapEl = el("chart-editor-page");
    if (!lyricsInput || !wrapEl) return;

    const oldLines = active.chart.doc.lyricsLines || [];
    const newLines = normalizeLyricsLinesFromText(lyricsInput.value);
    active.chart.doc.lyricsLines = newLines;

    // Adjust placements to match new line indices
    if (oldLines.length !== newLines.length || !oldLines.every((line, idx) => line === newLines[idx])) {
      active.chart.doc.placements = adjustPlacementsForLyricsChange(
        oldLines,
        newLines,
        active.chart.doc.placements || []
      );
    }

    renderChartDocIntoPage(wrapEl, active.chart.doc, {
      songTitle: active.songTitle || active.chart.doc.title || "Chord Chart",
      subtitle: active.scope === "key" ? `Key: ${active.songKey}` : (active.chart.chartType === "number" ? "Number chart" : "Chord chart"),
      layout: active.chart.layout,
      readOnly: false,
    });
    wireChordChartEditorInteractions();
    requestAnimationFrame(() => fitAllChartPagesToContainer(wrapEl));
  });

  el("chart-editor-layout")?.addEventListener("change", () => {
    const active = state.chordCharts.active;
    if (!active || active.mode !== "editor") return;
    const sel = el("chart-editor-layout");
    const wrapEl = el("chart-editor-page");
    if (!sel || !wrapEl) return;
    active.chart.layout = sel.value || "one_column";
    if (!active.chart.doc.settings) active.chart.doc.settings = {};
    active.chart.doc.settings.layout = active.chart.layout;
    renderChartDocIntoPage(wrapEl, active.chart.doc, {
      songTitle: active.songTitle || active.chart.doc.title || "Chord Chart",
      subtitle: active.scope === "key" ? `Key: ${active.songKey}` : (active.chart.chartType === "number" ? "Number chart" : "Chord chart"),
      layout: active.chart.layout,
      readOnly: false,
    });
    wireChordChartEditorInteractions();
    requestAnimationFrame(() => fitAllChartPagesToContainer(wrapEl));
  });

  el("chart-editor-type")?.addEventListener("change", () => {
    const active = state.chordCharts.active;
    if (!active || active.mode !== "editor") return;
    if (active.scope === "key") return; // key charts are chord-only
    const sel = el("chart-editor-type");
    const wrapEl = el("chart-editor-page");
    if (!sel || !wrapEl) return;
    active.chart.chartType = sel.value || "chord";

    // Update insert input placeholder based on chart type
    const insertInput = el("chart-insert-value");
    if (insertInput) {
      insertInput.placeholder = active.chart.chartType === "number"
        ? "1, 4, 6m, b7, #4dim, 5sus..."
        : "C, Dm7, F#m, Bb, Gsus4...";
    }

    // Update placement kind labels best-effort (keep values)
    const kind = active.chart.chartType === "number" ? "number" : "chord";
    (active.chart.doc.placements || []).forEach(p => { p.kind = kind; });
    renderChartDocIntoPage(wrapEl, active.chart.doc, {
      songTitle: active.songTitle || active.chart.doc.title || "Chord Chart",
      subtitle: active.chart.chartType === "number" ? "Number chart" : "Chord chart",
      layout: active.chart.layout,
      readOnly: false,
    });
    wireChordChartEditorInteractions();
    requestAnimationFrame(() => fitAllChartPagesToContainer(wrapEl));
  });

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

  // Check logic removed (was causing ReferenceError)

  // Better check: If we have a session but empty teams list, render empty state.
  // BUT we render showApp() immediately in init() with a temp profile before fetching teams.
  // So we need to know if we've ostensibly *finished* fetching teams.
  // Let's rely on state.userTeams being populated OR definitive failure.

  // Simplified: Only show empty state if we have a profile AND we have explicitly confirmed 0 teams
  // We can track a flag "areTeamsLoaded" or similar.
  // For now, let's just avoid showing empty state if profile is temporary (can_manage=false default) and we are just starting.
  // Actually, fetchProfile updates state.userTeams.

  if (state.profile && state.userTeams.length === 0 && !state.isLoadingProfile) {
    showEmptyState();
    return;
  } else if (!state.currentTeamId && state.userTeams.length > 0) {
    // Has teams but none selected? Should auto-select instructions elsewhere?
    // Usually fetchProfile or init handles selecting the first team.
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

  // Update profile picture in header
  updateUserProfilePicture();

  // Update team switcher
  updateTeamSwitcher();

  // Update team name header above tabs
  const teamNameDisplay = el("team-name-display");
  const teamNameHeader = el("team-name-header");
  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);

  // LOGIC CHANGE: Prioritize showing data if we have it, even if "loading" flag is true
  if (teamNameDisplay && currentTeam) {
    teamNameDisplay.textContent = currentTeam.name;
    if (teamNameHeader) {
      teamNameHeader.classList.remove("hidden");
    }
  } else if (state.isLoadingProfile) {
    if (teamNameHeader) teamNameHeader.classList.remove("hidden");
    if (teamNameDisplay) teamNameDisplay.innerHTML = '<div class="skeleton-header-title"></div>';
  } else if (teamNameHeader) {
    teamNameHeader.classList.add("hidden");
  }

  // Show/hide manager buttons based on actual manager status (not member view)

  const memberViewBanner = el("member-view-banner");



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

  // Update profile picture in header
  updateUserProfilePicture();

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

      // MFA CHECK
      const mfaRequired = await checkMfaRequirements(signInData.session);

      if (mfaRequired) {
        setAuthMessage("Two-factor authentication required.");
        openMfaChallengeModal({
          onSuccess: () => loadDataAndShowApp(signInData.session)
        });
        toggleAuthButton(false);
        return;
      }

      loadDataAndShowApp(signInData.session);
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


async function loadDataAndShowApp(session) {
  console.log("🚀 loadDataAndShowApp() called", session?.user?.email);
  console.log('✅ Proceeding with authenticated session');

  // Update state immediately
  state.session = session;

  // NEW: Try to render content immediately from cache if we have data
  // (checkMfaRequirements likely loaded it, but we handle the showApp call here)
  if (state.sets.length > 0 || loadAppDataFromCache(session)) {
    console.log('⚡️ Rendering cached interface');

    // Explicitly render the cached data so it appears immediately
    // Ideally we'd only render the active tab, but fast enough to do all
    renderSets();
    // Await renderSongCatalog to ensure deduplication completes before continuing
    await renderSongCatalog();
    renderPeople();

    showApp();

    // Check for unindexed songs (server-side indexing)
    checkUnindexedSongs();
  }

  try {
    await fetchProfile();
    console.log('  - Profile fetched');

    await Promise.all([loadSongs(), loadSets(), loadPeople()]);
    console.log('  - Data loaded');

    // Save fresh data to cache
    saveAppDataToCache(session);

    // Check for unindexed songs (server-side indexing)
    checkUnindexedSongs();

    // Pre-check MFA status so the modal UI is fresh
    updateMfaStatusUI();

    // Ensure app is shown (if not already showed by cache)
    showApp();
    setAuthMessage("");

    if (typeof authForm !== 'undefined') authForm?.reset();
    toggleAuthButton(false);

    // Track session start
    trackSessionStart();

    // Start tracking time on initial tab
    const savedTab = localStorage.getItem('cadence-active-tab') || 'sets';
    const pageNameMap = {
      'sets': 'Sets',
      'songs': 'Songs',
      'people': 'People'
    };
    if (pageNameMap[savedTab]) {
      startPageTimeTracking(pageNameMap[savedTab], { team_id: state.currentTeamId });
    }

    // Send initial aggregate metrics
    sendAggregateMetrics();

  } catch (err) {
    console.error("Error loading app data:", err);
    // If we have cached data displayed, just show a toast or small error
    if (state.sets.length > 0) {
      toastError("Could not sync latest changes. You are viewing cached data.");
    } else {
      setAuthMessage("Error loading data. Please refresh.", true);
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

  // Ensure spinner is hidden
  const spinner = document.getElementById('auth-loading-spinner');
  if (spinner) spinner.classList.add("hidden");

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
    // IMPORTANT: Do NOT overwrite full_name if it's already set to something custom
    // Only update full_name if:
    // 1. The current profile name is just the email (user hasn't set a name yet)
    // 2. The current profile name is missing/null
    // 3. We have a better name from a pending invite

    // Check if current name looks like a custom name (not an email)
    const currentNameIsEmail = existingProfile.full_name && existingProfile.full_name.includes('@');
    const hasCustomName = existingProfile.full_name && !currentNameIsEmail;

    // Determine the name to use
    let nameToUse = existingProfile.full_name;

    if (!hasCustomName) {
      // If no custom name, we can try to improve it
      if (fullName && !fullName.includes('@')) {
        // We have a real name from invite or metadata
        nameToUse = fullName;
      } else if (existingProfile.full_name) {
        // Keep existing (even if email) if we don't have better
        nameToUse = existingProfile.full_name;
      } else {
        // Fallback
        nameToUse = fullName;
      }
    }

    const updateData = {
      // Only update name if we decided to change it
      full_name: nameToUse,
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
          profile_picture_path,
          created_at,
          team:team_id (
            id,
            name,
            owner_id,
            daily_reminder_time,
            timezone,
            ai_enabled
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

    // Update profile picture in header after profile is loaded
    updateUserProfilePicture();

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
    let { data: teamMembers, error } = await supabase
      .from("team_members")
      .select(`
        team_id,
        role,
        is_owner,
        can_manage,
        team:team_id (
          id,
          name,
          owner_id,
          assignment_mode,
          daily_reminder_time,
          timezone,
          require_publish,
          itunes_indexing_enabled,
          ai_enabled
        )
      `)
      .eq("user_id", state.session.user.id)
      .order("joined_at", { ascending: true });

    // Backward compatibility if migrations haven't been applied yet
    if (error && error.message?.includes("itunes_indexing_enabled")) {
      console.warn('Team iTunes indexing column may not exist yet, retrying without it');
      const retry = await supabase
        .from("team_members")
        .select(`
          team_id,
          role,
          is_owner,
          can_manage,
          team:team_id (
            id,
            name,
            owner_id,
            assignment_mode,
            daily_reminder_time,
            timezone,
            require_publish,
            ai_enabled
          )
        `)
        .eq("user_id", state.session.user.id)
        .order("joined_at", { ascending: true });
      teamMembers = retry.data;
      error = retry.error;
    }

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
      assignment_mode: tm.team?.assignment_mode,
      daily_reminder_time: tm.team?.daily_reminder_time,
      timezone: tm.team?.timezone,
      require_publish: tm.team?.require_publish !== false, // Default to true
      itunes_indexing_enabled: tm.team?.itunes_indexing_enabled !== false, // Default to true
      ai_enabled: tm.team?.ai_enabled || false,
    }));

    console.log('  - ✅ Found', state.userTeams.length, 'teams');
    console.log('  - Teams Data:', JSON.stringify(state.userTeams, null, 2));

    // PostHog: Track number of teams per user
    if (state.userTeams.length > 0) {
      trackPostHogEvent('user_teams_count', {
        team_count: state.userTeams.length,
        team_ids: state.userTeams.map(t => t.id)
      });
    }

    // Auto-detect and save timezone if missing for owned/managed teams
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneUpdates = [];

    for (const team of state.userTeams) {
      if (!team.timezone && (team.is_owner || team.can_manage)) {
        console.log(`  - 🌍 Auto-detecting timezone for team ${team.name}: ${detectedTimezone}`);

        // Update local state immediately
        team.timezone = detectedTimezone;

        // Queue update to database
        timezoneUpdates.push(
          supabase
            .from('teams')
            .update({ timezone: detectedTimezone })
            .eq('id', team.id)
            .then(({ error }) => {
              if (error) console.error(`  - ❌ Failed to auto-save timezone for team ${team.name}:`, error);
              else console.log(`  - ✅ Auto-saved timezone for team ${team.name}`);
            })
        );
      }
    }

    // Let updates run in background
    if (timezoneUpdates.length > 0) {
      Promise.all(timezoneUpdates);
    }

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
  // Only show loading spinner if we don't have cached data visible
  if (state.songs.length === 0) {
    state.isLoadingSongs = true;
    await renderSongCatalog();
  }

  console.log('  - state.currentTeamId:', state.currentTeamId);

  if (!state.currentTeamId) {
    console.warn('⚠️ No currentTeamId, cannot load songs');
    state.songs = [];
    state.isLoadingSongs = false;
    await renderSongCatalog();
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
        song_resources (
          id,
          team_id,
          type,
          title,
          url,
          file_path,
          file_name,
          file_type,
          key,
          display_order,
          chart_content,
          created_at
        )
      `)
      // Include iTunes metadata fields in the query
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
    state.isLoadingSongs = false;
    await renderSongCatalog();
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

  // Deduplicate songs by ID (keep first occurrence) before storing in state
  const seenIds = new Set();
  const uniqueSongs = (data || []).filter(song => {
    if (seenIds.has(song.id)) {
      return false;
    }
    seenIds.add(song.id);
    return true;
  });

  state.songs = uniqueSongs;
  state.isLoadingSongs = false;
  await renderSongCatalog(false);

  // Check for unindexed songs after loading
  checkUnindexedSongs();
}

async function loadSets() {
  console.log('📋 loadSets() called');
  // Only show loading spinner if we don't have cached data visible
  if (state.sets.length === 0) {
    state.isLoadingSets = true;
    renderSets();
  }

  console.log('  - state.currentTeamId:', state.currentTeamId);

  if (!state.currentTeamId) {
    console.warn('⚠️ No currentTeamId, cannot load sets');
    state.sets = [];
    state.isLoadingSets = false;
    renderSets();
    return;
  }

  console.log('  - Loading sets for team_id:', state.currentTeamId);
  console.log('  - Testing sets query...');

  // Load team settings (assignment mode and require_publish)
  let teamRequirePublish = true; // Default to true
  try {
    const { data: teamData } = await supabase
      .from("teams")
      .select("assignment_mode, require_publish")
      .eq("id", state.currentTeamId)
      .single();

    if (teamData?.assignment_mode) {
      state.teamAssignmentMode = teamData.assignment_mode;
    } else {
      // Default to per_set if not set
      state.teamAssignmentMode = 'per_set';
    }

    // Get require_publish setting (default to true if not set)
    teamRequirePublish = teamData?.require_publish !== false;

    // Update local team data
    const stateTeam = state.userTeams.find(t => t.id === state.currentTeamId);
    if (stateTeam) {
      stateTeam.require_publish = teamRequirePublish;
    }
  } catch (err) {
    // If columns don't exist yet, use defaults
    console.warn('Team settings columns may not exist yet, using defaults');
    state.teamAssignmentMode = 'per_set';
    teamRequirePublish = true;
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
          album_art_small_url,
          album_art_large_url,
          itunes_metadata,
          itunes_indexed_at,
          song_keys (
            id,
            key
          ),
            song_resources (
              id,
              team_id,
              type,
              title,
              url,
              file_path,
              file_name,
              file_type,
              key,
              display_order,
              chart_content,
              created_at
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

  // Filter sets based on publishing requirements
  // Owners and managers can see all sets (published and unpublished)
  // Other users can only see published sets if require_publish is enabled
  const canSeeUnpublished = isOwner() || isManager();
  if (data && !canSeeUnpublished && teamRequirePublish) {
    data = data.filter(set => set.is_published === true);
    console.log('  - Filtered to published sets only:', data.length, 'sets');
  }

  state.sets = data ?? [];

  // Load pinned sets for the current user, scoped to the current team.
  // IMPORTANT: Do NOT merge cross-team pinned sets into state.sets.
  if (state.profile?.id) {
    try {
      const { data: pinnedData, error: pinnedError } = await supabase
        .from("pinned_sets")
        .select(`
          set_id,
          set:set_id (
            team_id,
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
                song_resources (
                  id,
                  team_id,
                  type,
                  title,
                  url,
                  file_path,
                  file_name,
                  file_type,
                  key,
                  display_order,
                  chart_content,
                  created_at
                )
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
          )
        `)
        .eq("user_id", state.profile.id);

      if (!pinnedError && pinnedData) {
        // Only consider pins for the active team.
        const pinnedSetIdsForTeam = new Set(
          pinnedData
            .map(item => item.set)
            .filter(set => set !== null && set.team_id == state.currentTeamId)
            .map(set => set.id)
        );

        // Mark pins on sets that are actually in this team's list.
        // Also clear stale pin flags when switching teams.
        state.sets.forEach(set => {
          set.is_pinned = pinnedSetIdsForTeam.has(set.id);
        });

        console.log('  - ✅ Pinned sets loaded (team-scoped):', pinnedSetIdsForTeam.size, 'sets');
      } else if (pinnedError && pinnedError.code !== 'PGRST116' && pinnedError.code !== '42P01') {
        console.warn('  - ⚠️ Error loading pinned sets (table may not exist yet):', pinnedError.message);
      }
    } catch (err) {
      console.warn('  - ⚠️ Error loading pinned sets:', err);
    }
  }

  state.isLoadingSets = false;
  renderSets(true);

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

  // Optimistic render from cache if available
  if (state.pendingRequests && state.pendingRequests.length > 0) {
    renderPendingRequests(state.pendingRequests);
  }

  // Get pending set assignments
  // NOTE: Some deployments may not have created_at on these tables/embeds.
  // We try to fetch created_at for response-time analytics, but gracefully fall back if PostgREST rejects the select.
  let pendingSetAssignments = null;
  {
    // First attempt: include assignment.created_at (but NOT set.created_at)
    let res = await supabase
      .from("set_assignments")
      .select(`
        id,
        role,
        set_id,
        created_at,
        set:set_id (
          id,
          title,
          scheduled_date
        )
      `)
      .eq("person_id", currentUserId)
      .eq("status", "pending");

    if (res.error) {
      // Fallback: drop created_at
      const fallback = await supabase
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

      if (fallback.error) {
        console.warn("Error fetching pending set assignments:", fallback.error);
      } else {
        pendingSetAssignments = fallback.data;
      }
    } else {
      pendingSetAssignments = res.data;
    }
  }

  // Get pending song assignments grouped by set
  let pendingSongAssignments = null;
  {
    // First attempt: include assignment.created_at (but NOT embedded set.created_at)
    let res = await supabase
      .from("song_assignments")
      .select(`
        id,
        role,
        set_song_id,
        created_at,
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

    if (res.error) {
      // Fallback: drop created_at
      const fallback = await supabase
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

      if (fallback.error) {
        console.warn("Error fetching pending song assignments:", fallback.error);
      } else {
        pendingSongAssignments = fallback.data;
      }
    } else {
      pendingSongAssignments = res.data;
    }
  }

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
        role: assignment.role,
        created_at: assignment.created_at || assignment.set?.created_at
      });
    });
  }

  // Add song-level pending requests (one per set)
  Object.keys(songAssignmentsBySet).forEach(setId => {
    const { set, assignments } = songAssignmentsBySet[setId];
    // Get earliest created_at from assignments
    const earliestCreated = assignments.reduce((earliest, a) => {
      const createdAt = a.created_at || a.set_song?.set?.created_at;
      if (!earliest || (createdAt && new Date(createdAt) < new Date(earliest))) {
        return createdAt;
      }
      return earliest;
    }, null);

    pendingRequests.push({
      type: 'song',
      assignmentIds: assignments.map(a => a.id),
      setId: setId,
      set: set,
      roles: [...new Set(assignments.map(a => a.role))],
      assignmentCount: assignments.length,
      created_at: earliestCreated || set?.created_at
    });
  });

  state.pendingRequests = pendingRequests;
  saveAppDataToCache(state.session);
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

  const wasHidden = section.classList.contains("hidden");
  section.classList.remove("hidden");

  // Animate header text if showing for the first time
  if (wasHidden) {
    const headerTitle = section.querySelector(".section-header h2");
    const headerP = section.querySelector(".section-header p");

    if (headerTitle) {
      headerTitle.classList.remove("ripple-item");
      void headerTitle.offsetWidth;
      headerTitle.classList.add("ripple-item");
      headerTitle.style.animationDelay = "0s";
    }

    if (headerP) {
      headerP.classList.remove("ripple-item");
      void headerP.offsetWidth;
      headerP.classList.add("ripple-item");
      headerP.style.animationDelay = "0.05s";
    }
  }

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

  requests.forEach((request, index) => {
    const item = document.createElement("div");
    item.className = "pending-request-item ripple-item";
    item.style.animationDelay = `${(index * 0.05) + 0.1}s`;
    item.style.cursor = "pointer";
    item.onclick = () => {
      // Find the full set object from state to ensure we have all details (songs, times, etc.)
      const fullSet = state.sets.find(s => s.id === (request.setId || request.set?.id));
      if (fullSet) {
        showSetDetail(fullSet);
      } else if (request.set) {
        // Fallback to partial set data if full set not found
        showSetDetail(request.set);
      }
    };

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
    acceptBtn.onclick = (e) => {
      e.stopPropagation();
      handleAcceptRequest(request);
    };

    const declineBtn = document.createElement("button");
    declineBtn.className = "btn ghost small";
    declineBtn.innerHTML = '<i class="fa-solid fa-x"></i> Decline';
    declineBtn.onclick = (e) => {
      e.stopPropagation();
      handleDeclineRequest(request);
    };

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

  // Track time from assignment creation to acceptance
  const assignmentCreatedAt = request.created_at || request.set?.created_at;
  let timeToAccept = null;
  if (assignmentCreatedAt) {
    timeToAccept = Math.round((Date.now() - new Date(assignmentCreatedAt).getTime()) / 1000); // seconds
  }

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

    // Track assignment accepted
    trackPostHogEvent('assignment_accepted', {
      assignment_type: request.type,
      set_id: request.setId || request.set?.id,
      team_id: state.currentTeamId,
      time_to_accept_seconds: timeToAccept,
      assignment_count: request.type === 'song' ? request.assignmentCount : 1
    });

    // Update aggregate metrics
    sendAggregateMetrics();

    await loadSets(); // Reload to refresh UI
    await loadPendingRequests(); // Refresh pending requests list
  } catch (error) {
    console.error("Error accepting request:", error);
    toastError("Unable to accept assignment. Please try again.");
  }
}

// Handle declining an assignment request
async function handleDeclineRequest(request) {
  // Track time from assignment creation to decline
  const assignmentCreatedAt = request.created_at || request.set?.created_at;
  let timeToDecline = null;
  if (assignmentCreatedAt) {
    timeToDecline = Math.round((Date.now() - new Date(assignmentCreatedAt).getTime()) / 1000); // seconds
  }

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

    // Track assignment declined
    trackPostHogEvent('assignment_declined', {
      assignment_type: request.type,
      set_id: request.setId || request.set?.id,
      team_id: state.currentTeamId,
      time_to_decline_seconds: timeToDecline,
      assignment_count: request.type === 'song' ? request.assignmentCount : 1
    });

    // Update aggregate metrics
    sendAggregateMetrics();

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
  // New elements
  const avatarEl = el("assignment-details-avatar");
  const emailEl = el("assignment-details-email");
  const stampContainer = el("assignment-details-status-stamp");

  const roleEl = el("assignment-details-role");
  const songEl = el("assignment-details-song");
  const songContainer = el("assignment-details-song-container");

  const actionsEl = el("assignment-details-actions");
  const closeBtn = el("close-assignment-details-modal");

  if (!modal) return;

  // Determine assignment type: if songTitle exists, it's a song assignment
  const assignmentType = assignment.songTitle ? 'song' : 'set';
  const currentUserId = state.profile?.id;
  const currentSet = state.selectedSet;

  // Populate person info
  const fullName = assignment.personName || "Unknown";
  if (personEl) personEl.textContent = fullName;

  if (emailEl) {
    emailEl.textContent = assignment.personEmail || "";
    emailEl.style.display = assignment.personEmail ? "block" : "none";
  }

  // Populate avatar with profile picture or initials
  if (avatarEl) {
    // Try to get profile picture from person data
    // First, we need to fetch the person's profile to get their picture
    let personProfilePicturePath = null;

    // If we have person_id, fetch their profile
    if (assignment.personId) {
      const { data: personProfile } = await supabase
        .from("profiles")
        .select("profile_picture_path")
        .eq("id", assignment.personId)
        .maybeSingle();

      if (personProfile?.profile_picture_path) {
        personProfilePicturePath = personProfile.profile_picture_path;
      }
    }

    // Try to display profile picture
    if (personProfilePicturePath) {
      const pictureUrl = await getFileUrl(personProfilePicturePath, PROFILE_PICTURES_BUCKET);
      if (pictureUrl) {
        avatarEl.innerHTML = `<img src="${pictureUrl}" alt="${fullName}" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        // Fallback to initials
        displayProfilePictureInitials(avatarEl, fullName);
      }
    } else {
      // No profile picture, show initials
      displayProfilePictureInitials(avatarEl, fullName);
    }
  }

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
              title,
              album_art_small_url,
              album_art_large_url,
              itunes_metadata,
              itunes_indexed_at
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
    }
    if (songContainer) songContainer.style.display = "none";
  }

  // Show/hide song field based on assignment type (do this after populating)
  if (assignmentType === 'set') {
    if (songContainer) songContainer.style.display = "none";
  } else {
    if (songContainer) songContainer.style.display = "";
  }

  // Create status stamp with random variation
  if (stampContainer) {
    stampContainer.innerHTML = "";
    const stamp = document.createElement("div");
    const status = assignment.status || 'pending';
    stamp.className = `passport-stamp ${status}`;
    stamp.textContent = status;

    // Add random variation to look like a real stamp
    const randomRotate = Math.floor(Math.random() * 25) - 20; // -20 to 5 deg
    const randomScale = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
    const randomX = Math.floor(Math.random() * 10) - 5; // -5 to 5px
    const randomY = Math.floor(Math.random() * 6) - 3; // -3 to 3px

    stamp.style.transform = `rotate(${randomRotate}deg) scale(${randomScale}) translate(${randomX}px, ${randomY}px)`;

    stampContainer.appendChild(stamp);
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

// Open person details modal
async function openPersonDetailsModal(person) {
  // Only managers and owners can view person details
  if (!isManager() && !isOwner()) {
    return;
  }

  const modal = el("person-details-modal");
  if (!modal || !person) return;

  const avatarEl = el("person-details-avatar");
  const nameEl = el("person-details-name");
  const emailEl = el("person-details-email");
  const acceptedCountEl = el("stat-accepted-count");
  const acceptedPercentEl = el("stat-accepted-percent");
  const declinedCountEl = el("stat-declined-count");
  const declinedPercentEl = el("stat-declined-percent");
  const pendingCountEl = el("stat-pending-count");
  const pendingPercentEl = el("stat-pending-percent");
  const pastSetsEl = el("person-details-past-sets");
  const futureSetsEl = el("person-details-future-sets");

  // Show modal and set loading state
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Initialize statistics to 0 while loading
  if (acceptedCountEl) acceptedCountEl.textContent = "0";
  if (declinedCountEl) declinedCountEl.textContent = "0";
  if (pendingCountEl) pendingCountEl.textContent = "0";
  if (acceptedPercentEl) acceptedPercentEl.textContent = "0%";
  if (declinedPercentEl) declinedPercentEl.textContent = "0%";
  if (pendingPercentEl) pendingPercentEl.textContent = "0%";

  // Set basic info
  const fullName = person.full_name || "Unknown";
  if (nameEl) nameEl.textContent = fullName;
  if (emailEl) {
    if (person.email) {
      emailEl.innerHTML = `<a href="mailto:${escapeHtml(person.email)}" style="color: inherit; text-decoration: none;">${escapeHtml(person.email)}</a>`;
      emailEl.style.display = "block";
    } else {
      emailEl.style.display = "none";
    }
  }

  // Load profile picture
  if (avatarEl) {
    let profilePicturePath = null;
    if (person.id) {
      const { data: personProfile } = await supabase
        .from("profiles")
        .select("profile_picture_path")
        .eq("id", person.id)
        .maybeSingle();

      if (personProfile?.profile_picture_path) {
        profilePicturePath = personProfile.profile_picture_path;
      }
    }

    if (profilePicturePath) {
      const pictureUrl = await getFileUrl(profilePicturePath, PROFILE_PICTURES_BUCKET);
      if (pictureUrl) {
        avatarEl.innerHTML = `<img src="${pictureUrl}" alt="${fullName}" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        displayProfilePictureWithGradient(avatarEl, fullName);
      }
    } else {
      displayProfilePictureWithGradient(avatarEl, fullName);
    }
  }

  // Fetch assignment statistics
  const personId = person.id;
  if (!personId) {
    if (pastSetsEl) pastSetsEl.innerHTML = '<p class="muted">No data available.</p>';
    if (futureSetsEl) futureSetsEl.innerHTML = '<p class="muted">No data available.</p>';
    // Statistics are already set to 0 above
    return;
  }

  // Get all assignments for this person in the current team
  const [setAssignmentsResult, songAssignmentsResult] = await Promise.all([
    supabase
      .from("set_assignments")
      .select(`
        id,
        status,
        set_id,
        set:set_id (
          id,
          title,
          scheduled_date,
          team_id
        )
      `)
      .eq("person_id", personId),
    supabase
      .from("song_assignments")
      .select(`
        id,
        status,
        set_song_id,
        set_song:set_song_id (
          id,
          set_id,
          set:set_id (
            id,
            title,
            scheduled_date,
            team_id
          )
        )
      `)
      .eq("person_id", personId)
  ]);

  // Filter assignments to current team only
  const currentTeamId = state.currentTeamId;
  const setAssignments = (setAssignmentsResult.data || []).filter(a =>
    a.set?.team_id === currentTeamId
  );
  const songAssignments = (songAssignmentsResult.data || []).filter(a =>
    a.set_song?.set?.team_id === currentTeamId
  );

  // Count assignments by status
  const allAssignments = [
    ...setAssignments.map(a => ({ status: a.status || 'pending', set: a.set })),
    ...songAssignments.map(a => ({ status: a.status || 'pending', set: a.set_song?.set }))
  ];

  const accepted = allAssignments.filter(a => a.status === 'accepted').length;
  const declined = allAssignments.filter(a => a.status === 'declined').length;
  const pending = allAssignments.filter(a => a.status === 'pending').length;
  const total = allAssignments.length;

  // Update statistics
  if (acceptedCountEl) acceptedCountEl.textContent = accepted;
  if (declinedCountEl) declinedCountEl.textContent = declined;
  if (pendingCountEl) pendingCountEl.textContent = pending;

  const acceptedPercent = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const declinedPercent = total > 0 ? Math.round((declined / total) * 100) : 0;
  const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 0;

  if (acceptedPercentEl) acceptedPercentEl.textContent = `${acceptedPercent}%`;
  if (declinedPercentEl) declinedPercentEl.textContent = `${declinedPercent}%`;
  if (pendingPercentEl) pendingPercentEl.textContent = `${pendingPercent}%`;

  // Render pie chart
  renderPieChart(accepted, declined, pending, total);

  // Get unique sets from assignments
  const setMap = new Map();
  setAssignments.forEach(a => {
    if (a.set) setMap.set(a.set.id, a.set);
  });
  songAssignments.forEach(a => {
    if (a.set_song?.set) setMap.set(a.set_song.set.id, a.set_song.set);
  });

  const allSets = Array.from(setMap.values());
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Separate past and future sets
  const pastSets = allSets.filter(set => {
    if (!set.scheduled_date) return false;
    const setDate = new Date(set.scheduled_date);
    setDate.setHours(0, 0, 0, 0);
    return setDate < now;
  }).sort((a, b) => {
    const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
    const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
    return dateB - dateA; // Most recent first
  });

  const futureSets = allSets.filter(set => {
    if (!set.scheduled_date) return true; // Treat sets without dates as future
    const setDate = new Date(set.scheduled_date);
    setDate.setHours(0, 0, 0, 0);
    return setDate >= now;
  }).sort((a, b) => {
    const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
    const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
    return dateA - dateB; // Earliest first
  });

  // Render past sets
  if (pastSetsEl) {
    if (pastSets.length === 0) {
      pastSetsEl.innerHTML = '<p class="muted">No past sets.</p>';
    } else {
      pastSetsEl.innerHTML = '';
      pastSets.forEach(set => {
        const date = set.scheduled_date ? new Date(set.scheduled_date).toLocaleDateString() : 'No date';
        const relativeTime = set.scheduled_date ? formatRelativeTime(set.scheduled_date) : 'No date';
        const setItem = document.createElement('div');
        setItem.className = 'person-set-item';
        setItem.style.cursor = 'pointer';
        setItem.innerHTML = `
          <div class="person-set-title">${escapeHtml(set.title || 'Untitled Set')}</div>
          <div class="person-set-meta">
            <div class="person-set-date muted">${date}</div>
            <div class="person-set-relative muted">${relativeTime}</div>
          </div>
        `;
        setItem.addEventListener('click', () => {
          // Find the full set object from state.sets
          const fullSet = state.sets.find(s => s.id === set.id);
          if (fullSet) {
            // Close the person details modal
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            // Navigate to the set
            showSetDetail(fullSet);
          } else {
            // If set not in state, try to load it
            // For now, just show an error or reload sets
            toastError('Set not found. Please refresh and try again.');
          }
        });
        pastSetsEl.appendChild(setItem);
      });
    }
  }

  // Render future sets
  if (futureSetsEl) {
    if (futureSets.length === 0) {
      futureSetsEl.innerHTML = '<p class="muted">No upcoming sets.</p>';
    } else {
      futureSetsEl.innerHTML = '';
      futureSets.forEach(set => {
        const date = set.scheduled_date ? new Date(set.scheduled_date).toLocaleDateString() : 'No date';
        const relativeTime = set.scheduled_date ? formatRelativeTime(set.scheduled_date) : 'No date';
        const setItem = document.createElement('div');
        setItem.className = 'person-set-item';
        setItem.style.cursor = 'pointer';
        setItem.innerHTML = `
          <div class="person-set-title">${escapeHtml(set.title || 'Untitled Set')}</div>
          <div class="person-set-meta">
            <div class="person-set-date muted">${date}</div>
            <div class="person-set-relative muted">${relativeTime}</div>
          </div>
        `;
        setItem.addEventListener('click', () => {
          // Find the full set object from state.sets
          const fullSet = state.sets.find(s => s.id === set.id);
          if (fullSet) {
            // Close the person details modal
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            // Navigate to the set
            showSetDetail(fullSet);
          } else {
            // If set not in state, try to load it
            // For now, just show an error or reload sets
            toastError('Set not found. Please refresh and try again.');
          }
        });
        futureSetsEl.appendChild(setItem);
      });
    }
  }
}

// Close + reset person details modal so it doesn't persist
function closePersonDetailsModal() {
  const modal = el("person-details-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  document.body.style.overflow = "";
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

function renderSetCard(set, container, index = 0, animate = true, baseDelay = 0) {
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
  if (animate) {
    card.classList.add("ripple-item");
    card.style.animationDelay = `${(index * 0.07) + baseDelay}s`;
  }
  const editBtn = node.querySelector(".edit-set-btn");
  const deleteBtn = node.querySelector(".delete-set-btn");
  const pinBtn = node.querySelector(".pin-set-btn");

  // Update pin button state
  if (pinBtn) {
    const isPinned = set.is_pinned === true;
    const icon = pinBtn.querySelector("i");
    if (icon) {
      if (isPinned) {
        icon.classList.remove("fa-solid", "fa-thumbtack");
        icon.classList.add("fa-solid", "fa-thumbtack-slash");
        pinBtn.title = "Unpin set";
        pinBtn.classList.add("pinned");
      } else {
        icon.classList.remove("fa-solid", "fa-thumbtack-slash");
        icon.classList.add("fa-solid", "fa-thumbtack");
        pinBtn.title = "Pin set";
        pinBtn.classList.remove("pinned");
      }
    }
    pinBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await togglePinSet(set, pinBtn);
    });
  }

  // Make card clickable to view details
  card.addEventListener("click", (e) => {
    // Don't trigger if clicking edit/delete/pin buttons
    if (e.target === editBtn || e.target === deleteBtn || e.target === pinBtn ||
      editBtn?.contains(e.target) || deleteBtn?.contains(e.target) || pinBtn?.contains(e.target)) {
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

/* Skeleton Loading Helpers */
function getSkeletonLoader(count = 3, type = 'card') {
  let html = '';
  for (let i = 0; i < count; i++) {
    if (type === 'card') {
      html += `
        <div class="skeleton-card">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text-short"></div>
        </div>
      `;
    } else if (type === 'row') {
      html += `
        <div class="card set-song-card" style="pointer-events: none;">
          <div class="set-song-header song-card-header">
            <div class="set-song-info" style="width: 100%;">
              <div class="skeleton skeleton-title" style="margin-bottom: 0.5rem; height: 1.25rem;"></div>
              <div class="skeleton skeleton-text" style="width: 40%;"></div>
            </div>
          </div>
        </div>
      `;
    } else if (type === 'person') {
      html += `
        <div class="card person-card" style="pointer-events: none;">
          <div style="width: 100%;">
            <div class="skeleton skeleton-title" style="margin-bottom: 0.5rem; height: 1.5rem; width: 50%;"></div>
            <div class="skeleton skeleton-text" style="width: 70%; margin-bottom: 0.75rem;"></div>
            <div class="skeleton skeleton-text-short text-small" style="width: 25%; height: 1.25rem; border-radius: 999px;"></div>
          </div>
        </div>
      `;
    }
  }
  return html;
}

function renderSets(animate = true) {
  setsList.innerHTML = "";
  if (yourSetsList) yourSetsList.innerHTML = "";

  if (state.isLoadingSets && state.sets.length === 0) {
    setsList.innerHTML = getSkeletonLoader(3, 'card');
    if (yourSetsList) yourSetsList.innerHTML = getSkeletonLoader(1, 'card');
    return;
  }

  if (!state.sets.length) {
    setsList.innerHTML = `<p class="muted">No sets scheduled yet.</p>`;
    if (yourSetsList) {
      yourSetsList.innerHTML = `<p class="muted">You haven't been assigned to or pinned any sets yet.</p>`;
    }
    return;
  }

  const currentUserId = state.profile?.id;
  const yourSets = [];
  const allSets = [];

  // Separate sets into "your sets" and "all sets"
  state.sets.forEach((set) => {
    const isAssigned = currentUserId && isUserAssignedToSet(set, currentUserId);
    const isPinned = set.is_pinned === true;

    // Include in "Your Sets" if assigned OR pinned
    if (isAssigned || isPinned) {
      yourSets.push(set);
    }
    allSets.push(set);
  });

  // Sort "Your Sets" to show pinned sets first, then by scheduled_date
  yourSets.sort((a, b) => {
    const aPinned = a.is_pinned === true ? 1 : 0;
    const bPinned = b.is_pinned === true ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned; // Pinned sets first
    }
    // Then sort by scheduled_date
    const aDate = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
    const bDate = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
    return aDate - bDate;
  });

  // Calculate base delay if pending requests are present (or will be)
  // Pending requests animate with 0.05s stagger + 0.1s initial delay
  let baseDelay = 0;
  if (state.pendingRequests && state.pendingRequests.length > 0) {
    baseDelay = 0.1 + (state.pendingRequests.length * 0.05);
  }

  // Render "All Sets" section FIRST so we have reference cards for width measurement
  if (allSets.length === 0) {
    setsList.innerHTML = `<p class="muted">No sets scheduled yet.</p>`;
  } else {
    allSets.forEach((set, index) => {
      // Offset the index by yourSets.length so the ripple continues from the top section
      // If yourSets is empty, index starts at 0.
      renderSetCard(set, setsList, index + (yourSets ? yourSets.length : 0), animate, baseDelay);
    });
  }

  // Render "Your Sets" section AFTER "All Sets" so we can use them as reference
  if (yourSetsList) {
    if (yourSets.length === 0) {
      yourSetsList.innerHTML = `<p class="muted">You haven't been assigned to or pinned any sets yet.</p>`;
    } else {
      yourSets.forEach((set, index) => {
        renderSetCard(set, yourSetsList, index, animate, baseDelay);
      });
    }
  }

  // Recalculate assignment pills after rendering (with delay to ensure layout is complete)
  setTimeout(() => {
    recalculateAllAssignmentPills();
  }, 100);
}

function switchTab(tabName) {
  // Stop tracking time on previous tab
  stopPageTimeTracking();

  // Save the current tab to localStorage
  localStorage.setItem('cadence-active-tab', tabName);

  // Always hide set details when switching tabs - set details should only be visible when explicitly viewing a set
  hideSetDetail();

  // Track tab switch
  trackPostHogEvent('tab_switched', {
    tab: tabName,
    team_id: state.currentTeamId
  });

  // Start tracking time on new tab
  startPageTimeTracking(tabName, { team_id: state.currentTeamId });

  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Play animation for active tab and reset others
  if (state.lottieAnimations) {
    Object.keys(state.lottieAnimations).forEach(key => {
      if (state.lottieAnimations[key]) {
        if (key === tabName) {
          // Reset to 0 and play
          state.lottieAnimations[key].goToAndPlay(0, true);
        } else {
          // Stop (resets to 0 usually in stop mode if passing true/frame, or just pause)
          // goToAndStop(0) resets to beginning
          state.lottieAnimations[key].goToAndStop(0, true);
        }
      }
    });
  }

  // Handle specific tab logic BEFORE showing/hiding content
  if (tabName === "people") {
    // If we have cached people, render them immediately to avoid "flash" of empty content
    // and provide instant feedback. loadPeople will still run to update data if needed.
    if (state.people && state.people.length > 0) {
      // Data exists, so we don't clear. Just re-render to trigger animation if desired,
      // or we could opt NOT to re-render if we don't want to re-animate staled data.
      // But user wants animation. So let's re-render.
      // To ensure animation plays, we might need to reset it?
      // Actually previous issue was DOUBLE animation.
      // If we render immediately here, subsequent `loadPeople` might trigger another render.

      // Let's TRY rendering here.
      renderPeople();
    } else {
      // No data, clear to be safe
      const peopleList = el("people-list");
      if (peopleList) peopleList.innerHTML = "";
    }
  }

  // Show/hide tab content
  el("sets-tab").classList.toggle("hidden", tabName !== "sets");
  el("songs-tab").classList.toggle("hidden", tabName !== "songs");
  el("people-tab").classList.toggle("hidden", tabName !== "people");

  // Map tab names to page names for tracking
  const pageNameMap = {
    'sets': 'Sets',
    'songs': 'Songs',
    'people': 'People'
  };

  // Start tracking time on new tab (will stop previous tab automatically)
  if (pageNameMap[tabName]) {
    startPageTimeTracking(pageNameMap[tabName], { team_id: state.currentTeamId });
  }

  // Load data if switching to tabs
  if (tabName === "songs") {
    renderSongCatalog();
  } else if (tabName === "people") {
    // Only fetch if we don't have data, OR if we want to background refresh.
    // To prevent double animation/jank, maybe we only fetch if we don't have data?
    // Or we fetch silently?
    // Current loadPeople calls renderPeople at the end.
    // If we already rendered above, this will render AGAIN.
    // Let's modify loadPeople behavior or just call it if we need it.

    // For now, let's just NOT call loadPeople if we have data, assuming data is fresh enough for this session.
    // This matches Sets/Songs behavior (they don't auto-refresh on tab switch usually).
    if (!state.people || state.people.length === 0) {
      loadPeople();
    }
  } else if (tabName === "sets") {
    // Recalculate assignment pills when switching to sets tab
    // Use a small delay to ensure the tab is visible and layout is complete
    setTimeout(() => {
      recalculateAllAssignmentPills();
    }, 100);
  }
}

function refreshActiveTab(animate = true) {
  // Get the currently active tab
  const activeTabBtn = document.querySelector(".tab-btn.active");
  if (!activeTabBtn) return;

  const activeTab = activeTabBtn.dataset.tab;

  // Re-render the active tab content
  if (activeTab === "sets") {
    renderSets(animate);
  } else if (activeTab === "songs") {
    renderSongCatalog(animate);
  } else if (activeTab === "people") {
    // Just render from state - don't force a reload, which causes double animation
    // if a load is already in progress or just completed.
    // If we need to force reload, we should call loadPeople() explicitly elsewhere.
    renderPeople(animate);
  }

  // If set detail view is open, refresh it too
  const setDetailView = el("set-detail");
  if (setDetailView && !setDetailView.classList.contains("hidden") && state.selectedSet) {
    renderSetDetailSongs(state.selectedSet);
  }
}

async function loadPeople() {
  console.log('👥 loadPeople() called');
  // Only show loading spinner if we don't have cached data visible
  if (state.people.length === 0) {
    state.isLoadingPeople = true;
    renderPeople();
  }
  console.log('  - state.currentTeamId:', state.currentTeamId);

  if (!state.currentTeamId) {
    console.warn('⚠️ No currentTeamId, cannot load people');
    state.people = [];
    state.pendingInvites = [];
    state.isLoadingPeople = false;
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
  state.isLoadingPeople = false;
  state.pendingInvites = filteredPendingInvites;
  renderPeople(false);
}

function renderPeople(animate = true) {
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

  if (state.isLoadingPeople && state.people.length === 0) {
    peopleList.innerHTML = getSkeletonLoader(6, 'person');
    return;
  }

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
    filteredPeople.forEach((person, index) => {
      const div = document.createElement("div");
      div.className = "card person-card";

      if (animate) {
        div.classList.add("ripple-item");
        div.style.animationDelay = `${index * 0.05}s`;
      }

      // Make person card clickable to show details
      div.style.cursor = "pointer";
      div.addEventListener("click", (e) => {
        // Don't open modal if clicking on interactive elements
        if (e.target.closest(".person-menu-btn") ||
          e.target.closest(".person-menu") ||
          e.target.closest("button") ||
          e.target.closest("a")) {
          return;
        }
        openPersonDetailsModal(person);
      });

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
                <div class="person-menu hidden" data-person-id="${person.id}" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; padding: 0.5rem; min-width: 180px; z-index: 1000;">
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
    filteredPending.forEach((invite, i) => {
      const index = filteredPeople.length + i;
      const div = document.createElement("div");
      div.className = "card person-card pending-person-card";

      if (animate) {
        div.classList.add("ripple-item");
        div.style.animationDelay = `${index * 0.05}s`;
      }
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
            personEmail: assignment.person?.email || assignment.pending_invite?.email || assignment.person_email || "",
            personId: assignment.person_id || assignment.person?.id || null,
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

const BADGE_SHAPES = [
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.4 L 51.7 1.4 L 52.5 2.8 L 53.2 4.5 L 53.8 6.2 L 54.5 7.5 L 55.1 8.2 L 55.9 8.3 L 56.7 7.8 L 57.6 6.7 L 58.7 5.3 L 59.8 3.8 L 60.9 2.6 L 62.0 1.8 L 62.9 1.7 L 63.7 2.3 L 64.2 3.5 L 64.6 5.1 L 64.8 6.9 L 65.0 8.7 L 65.3 10.1 L 65.8 11.0 L 66.4 11.3 L 67.4 10.9 L 68.6 10.1 L 70.0 9.0 L 71.4 7.9 L 72.9 7.0 L 74.1 6.6 L 75.0 6.7 L 75.6 7.4 L 75.8 8.7 L 75.7 10.4 L 75.5 12.2 L 75.2 14.0 L 75.1 15.4 L 75.3 16.4 L 75.9 16.8 L 76.9 16.8 L 78.3 16.3 L 79.9 15.6 L 81.6 14.9 L 83.2 14.4 L 84.5 14.3 L 85.4 14.6 L 85.7 15.5 L 85.6 16.8 L 85.1 18.4 L 84.4 20.1 L 83.7 21.7 L 83.2 23.1 L 83.2 24.1 L 83.6 24.7 L 84.6 24.9 L 86.0 24.8 L 87.8 24.5 L 89.6 24.3 L 91.3 24.2 L 92.6 24.4 L 93.3 25.0 L 93.4 25.9 L 93.0 27.1 L 92.1 28.6 L 91.0 30.0 L 89.9 31.4 L 89.1 32.6 L 88.7 33.6 L 89.0 34.2 L 89.9 34.7 L 91.3 35.0 L 93.1 35.2 L 94.9 35.4 L 96.5 35.8 L 97.7 36.3 L 98.3 37.1 L 98.2 38.0 L 97.4 39.1 L 96.2 40.2 L 94.7 41.3 L 93.3 42.4 L 92.2 43.3 L 91.7 44.1 L 91.8 44.9 L 92.5 45.5 L 93.8 46.2 L 95.5 46.8 L 97.2 47.5 L 98.6 48.3 L 99.6 49.1 L 100.0 50.0 L 99.6 50.9 L 98.6 51.7 L 97.2 52.5 L 95.5 53.2 L 93.8 53.8 L 92.5 54.5 L 91.8 55.1 L 91.7 55.9 L 92.2 56.7 L 93.3 57.6 L 94.7 58.7 L 96.2 59.8 L 97.4 60.9 L 98.2 62.0 L 98.3 62.9 L 97.7 63.7 L 96.5 64.2 L 94.9 64.6 L 93.1 64.8 L 91.3 65.0 L 89.9 65.3 L 89.0 65.8 L 88.7 66.4 L 89.1 67.4 L 89.9 68.6 L 91.0 70.0 L 92.1 71.4 L 93.0 72.9 L 93.4 74.1 L 93.3 75.0 L 92.6 75.6 L 91.3 75.8 L 89.6 75.7 L 87.8 75.5 L 86.0 75.2 L 84.6 75.1 L 83.6 75.3 L 83.2 75.9 L 83.2 76.9 L 83.7 78.3 L 84.4 79.9 L 85.1 81.6 L 85.6 83.2 L 85.7 84.5 L 85.4 85.4 L 84.5 85.7 L 83.2 85.6 L 81.6 85.1 L 79.9 84.4 L 78.3 83.7 L 76.9 83.2 L 75.9 83.2 L 75.3 83.6 L 75.1 84.6 L 75.2 86.0 L 75.5 87.8 L 75.7 89.6 L 75.8 91.3 L 75.6 92.6 L 75.0 93.3 L 74.1 93.4 L 72.9 93.0 L 71.4 92.1 L 70.0 91.0 L 68.6 89.9 L 67.4 89.1 L 66.4 88.7 L 65.8 89.0 L 65.3 89.9 L 65.0 91.3 L 64.8 93.1 L 64.6 94.9 L 64.2 96.5 L 63.7 97.7 L 62.9 98.3 L 62.0 98.2 L 60.9 97.4 L 59.8 96.2 L 58.7 94.7 L 57.6 93.3 L 56.7 92.2 L 55.9 91.7 L 55.1 91.8 L 54.5 92.5 L 53.8 93.8 L 53.2 95.5 L 52.5 97.2 L 51.7 98.6 L 50.9 99.6 L 50.0 100.0 L 49.1 99.6 L 48.3 98.6 L 47.5 97.2 L 46.8 95.5 L 46.2 93.8 L 45.5 92.5 L 44.9 91.8 L 44.1 91.7 L 43.3 92.2 L 42.4 93.3 L 41.3 94.7 L 40.2 96.2 L 39.1 97.4 L 38.0 98.2 L 37.1 98.3 L 36.3 97.7 L 35.8 96.5 L 35.4 94.9 L 35.2 93.1 L 35.0 91.3 L 34.7 89.9 L 34.2 89.0 L 33.6 88.7 L 32.6 89.1 L 31.4 89.9 L 30.0 91.0 L 28.6 92.1 L 27.1 93.0 L 25.9 93.4 L 25.0 93.3 L 24.4 92.6 L 24.2 91.3 L 24.3 89.6 L 24.5 87.8 L 24.8 86.0 L 24.9 84.6 L 24.7 83.6 L 24.1 83.2 L 23.1 83.2 L 21.7 83.7 L 20.1 84.4 L 18.4 85.1 L 16.8 85.6 L 15.5 85.7 L 14.6 85.4 L 14.3 84.5 L 14.4 83.2 L 14.9 81.6 L 15.6 79.9 L 16.3 78.3 L 16.8 76.9 L 16.8 75.9 L 16.4 75.3 L 15.4 75.1 L 14.0 75.2 L 12.2 75.5 L 10.4 75.7 L 8.7 75.8 L 7.4 75.6 L 6.7 75.0 L 6.6 74.1 L 7.0 72.9 L 7.9 71.4 L 9.0 70.0 L 10.1 68.6 L 10.9 67.4 L 11.3 66.4 L 11.0 65.8 L 10.1 65.3 L 8.7 65.0 L 6.9 64.8 L 5.1 64.6 L 3.5 64.2 L 2.3 63.7 L 1.7 62.9 L 1.8 62.0 L 2.6 60.9 L 3.8 59.8 L 5.3 58.7 L 6.7 57.6 L 7.8 56.7 L 8.3 55.9 L 8.2 55.1 L 7.5 54.5 L 6.2 53.8 L 4.5 53.2 L 2.8 52.5 L 1.4 51.7 L 0.4 50.9 L 0.0 50.0 L 0.4 49.1 L 1.4 48.3 L 2.8 47.5 L 4.5 46.8 L 6.2 46.2 L 7.5 45.5 L 8.2 44.9 L 8.3 44.1 L 7.8 43.3 L 6.7 42.4 L 5.3 41.3 L 3.8 40.2 L 2.6 39.1 L 1.8 38.0 L 1.7 37.1 L 2.3 36.3 L 3.5 35.8 L 5.1 35.4 L 6.9 35.2 L 8.7 35.0 L 10.1 34.7 L 11.0 34.2 L 11.3 33.6 L 10.9 32.6 L 10.1 31.4 L 9.0 30.0 L 7.9 28.6 L 7.0 27.1 L 6.6 25.9 L 6.7 25.0 L 7.4 24.4 L 8.7 24.2 L 10.4 24.3 L 12.2 24.5 L 14.0 24.8 L 15.4 24.9 L 16.4 24.7 L 16.8 24.1 L 16.8 23.1 L 16.3 21.7 L 15.6 20.1 L 14.9 18.4 L 14.4 16.8 L 14.3 15.5 L 14.6 14.6 L 15.5 14.3 L 16.8 14.4 L 18.4 14.9 L 20.1 15.6 L 21.7 16.3 L 23.1 16.8 L 24.1 16.8 L 24.7 16.4 L 24.9 15.4 L 24.8 14.0 L 24.5 12.2 L 24.3 10.4 L 24.2 8.7 L 24.4 7.4 L 25.0 6.7 L 25.9 6.6 L 27.1 7.0 L 28.6 7.9 L 30.0 9.0 L 31.4 10.1 L 32.6 10.9 L 33.6 11.3 L 34.2 11.0 L 34.7 10.1 L 35.0 8.7 L 35.2 6.9 L 35.4 5.1 L 35.8 3.5 L 36.3 2.3 L 37.1 1.7 L 38.0 1.8 L 39.1 2.6 L 40.2 3.8 L 41.3 5.3 L 42.4 6.7 L 43.3 7.8 L 44.1 8.3 L 44.9 8.2 L 45.5 7.5 L 46.2 6.2 L 46.8 4.5 L 47.5 2.8 L 48.3 1.4 L 49.1 0.4 L 50.0 0.0 Z" /></svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.2 L 51.7 1.0 L 52.5 2.1 L 53.3 3.4 L 53.9 4.9 L 54.6 6.2 L 55.2 7.4 L 55.9 8.2 L 56.6 8.5 L 57.3 8.4 L 58.2 7.9 L 59.1 7.0 L 60.2 5.9 L 61.3 4.7 L 62.4 3.6 L 63.5 2.8 L 64.5 2.4 L 65.5 2.4 L 66.2 3.0 L 66.8 3.9 L 67.2 5.2 L 67.5 6.7 L 67.7 8.3 L 67.9 9.8 L 68.1 11.1 L 68.5 12.0 L 69.1 12.6 L 69.8 12.7 L 70.8 12.4 L 72.0 11.9 L 73.3 11.2 L 74.7 10.4 L 76.1 9.7 L 77.4 9.3 L 78.5 9.2 L 79.4 9.5 L 79.9 10.3 L 80.2 11.3 L 80.2 12.7 L 80.0 14.2 L 79.7 15.8 L 79.4 17.3 L 79.3 18.6 L 79.3 19.6 L 79.7 20.3 L 80.4 20.7 L 81.4 20.7 L 82.7 20.6 L 84.2 20.3 L 85.8 20.0 L 87.3 19.8 L 88.7 19.8 L 89.7 20.1 L 90.5 20.6 L 90.8 21.5 L 90.7 22.6 L 90.3 23.9 L 89.6 25.3 L 88.8 26.7 L 88.1 28.0 L 87.6 29.2 L 87.3 30.2 L 87.4 30.9 L 88.0 31.5 L 88.9 31.9 L 90.2 32.1 L 91.7 32.3 L 93.3 32.5 L 94.8 32.8 L 96.1 33.2 L 97.0 33.8 L 97.6 34.5 L 97.6 35.5 L 97.2 36.5 L 96.4 37.6 L 95.3 38.7 L 94.1 39.8 L 93.0 40.9 L 92.1 41.8 L 91.6 42.7 L 91.5 43.4 L 91.8 44.1 L 92.6 44.8 L 93.8 45.4 L 95.1 46.1 L 96.6 46.7 L 97.9 47.5 L 99.0 48.3 L 99.8 49.1 L 100.0 50.0 L 99.8 50.9 L 99.0 51.7 L 97.9 52.5 L 96.6 53.3 L 95.1 53.9 L 93.8 54.6 L 92.6 55.2 L 91.8 55.9 L 91.5 56.6 L 91.6 57.3 L 92.1 58.2 L 93.0 59.1 L 94.1 60.2 L 95.3 61.3 L 96.4 62.4 L 97.2 63.5 L 97.6 64.5 L 97.6 65.5 L 97.0 66.2 L 96.1 66.8 L 94.8 67.2 L 93.3 67.5 L 91.7 67.7 L 90.2 67.9 L 88.9 68.1 L 88.0 68.5 L 87.4 69.1 L 87.3 69.8 L 87.6 70.8 L 88.1 72.0 L 88.8 73.3 L 89.6 74.7 L 90.3 76.1 L 90.7 77.4 L 90.8 78.5 L 90.5 79.4 L 89.7 79.9 L 88.7 80.2 L 87.3 80.2 L 85.8 80.0 L 84.2 79.7 L 82.7 79.4 L 81.4 79.3 L 80.4 79.3 L 79.7 79.7 L 79.3 80.4 L 79.3 81.4 L 79.4 82.7 L 79.7 84.2 L 80.0 85.8 L 80.2 87.3 L 80.2 88.7 L 79.9 89.7 L 79.4 90.5 L 78.5 90.8 L 77.4 90.7 L 76.1 90.3 L 74.7 89.6 L 73.3 88.8 L 72.0 88.1 L 70.8 87.6 L 69.8 87.3 L 69.1 87.4 L 68.5 88.0 L 68.1 88.9 L 67.9 90.2 L 67.7 91.7 L 67.5 93.3 L 67.2 94.8 L 66.8 96.1 L 66.2 97.0 L 65.5 97.6 L 64.5 97.6 L 63.5 97.2 L 62.4 96.4 L 61.3 95.3 L 60.2 94.1 L 59.1 93.0 L 58.2 92.1 L 57.3 91.6 L 56.6 91.5 L 55.9 91.8 L 55.2 92.6 L 54.6 93.8 L 53.9 95.1 L 53.3 96.6 L 52.5 97.9 L 51.7 99.0 L 50.9 99.8 L 50.0 100.0 L 49.1 99.8 L 48.3 99.0 L 47.5 97.9 L 46.7 96.6 L 46.1 95.1 L 45.4 93.8 L 44.8 92.6 L 44.1 91.8 L 43.4 91.5 L 42.7 91.6 L 41.8 92.1 L 40.9 93.0 L 39.8 94.1 L 38.7 95.3 L 37.6 96.4 L 36.5 97.2 L 35.5 97.6 L 34.5 97.6 L 33.8 97.0 L 33.2 96.1 L 32.8 94.8 L 32.5 93.3 L 32.3 91.7 L 32.1 90.2 L 31.9 88.9 L 31.5 88.0 L 30.9 87.4 L 30.2 87.3 L 29.2 87.6 L 28.0 88.1 L 26.7 88.8 L 25.3 89.6 L 23.9 90.3 L 22.6 90.7 L 21.5 90.8 L 20.6 90.5 L 20.1 89.7 L 19.8 88.7 L 19.8 87.3 L 20.0 85.8 L 20.3 84.2 L 20.6 82.7 L 20.7 81.4 L 20.7 80.4 L 20.3 79.7 L 19.6 79.3 L 18.6 79.3 L 17.3 79.4 L 15.8 79.7 L 14.2 80.0 L 12.7 80.2 L 11.3 80.2 L 10.3 79.9 L 9.5 79.4 L 9.2 78.5 L 9.3 77.4 L 9.7 76.1 L 10.4 74.7 L 11.2 73.3 L 11.9 72.0 L 12.4 70.8 L 12.7 69.8 L 12.6 69.1 L 12.0 68.5 L 11.1 68.1 L 9.8 67.9 L 8.3 67.7 L 6.7 67.5 L 5.2 67.2 L 3.9 66.8 L 3.0 66.2 L 2.4 65.5 L 2.4 64.5 L 2.8 63.5 L 3.6 62.4 L 4.7 61.3 L 5.9 60.2 L 7.0 59.1 L 7.9 58.2 L 8.4 57.3 L 8.5 56.6 L 8.2 55.9 L 7.4 55.2 L 6.2 54.6 L 4.9 53.9 L 3.4 53.3 L 2.1 52.5 L 1.0 51.7 L 0.2 50.9 L 0.0 50.0 L 0.2 49.1 L 1.0 48.3 L 2.1 47.5 L 3.4 46.7 L 4.9 46.1 L 6.2 45.4 L 7.4 44.8 L 8.2 44.1 L 8.5 43.4 L 8.4 42.7 L 7.9 41.8 L 7.0 40.9 L 5.9 39.8 L 4.7 38.7 L 3.6 37.6 L 2.8 36.5 L 2.4 35.5 L 2.4 34.5 L 3.0 33.8 L 3.9 33.2 L 5.2 32.8 L 6.7 32.5 L 8.3 32.3 L 9.8 32.1 L 11.1 31.9 L 12.0 31.5 L 12.6 30.9 L 12.7 30.2 L 12.4 29.2 L 11.9 28.0 L 11.2 26.7 L 10.4 25.3 L 9.7 23.9 L 9.3 22.6 L 9.2 21.5 L 9.5 20.6 L 10.3 20.1 L 11.3 19.8 L 12.7 19.8 L 14.2 20.0 L 15.8 20.3 L 17.3 20.6 L 18.6 20.7 L 19.6 20.7 L 20.3 20.3 L 20.7 19.6 L 20.7 18.6 L 20.6 17.3 L 20.3 15.8 L 20.0 14.2 L 19.8 12.7 L 19.8 11.3 L 20.1 10.3 L 20.6 9.5 L 21.5 9.2 L 22.6 9.3 L 23.9 9.7 L 25.3 10.4 L 26.7 11.2 L 28.0 11.9 L 29.2 12.4 L 30.2 12.7 L 30.9 12.6 L 31.5 12.0 L 31.9 11.1 L 32.1 9.8 L 32.3 8.3 L 32.5 6.7 L 32.8 5.2 L 33.2 3.9 L 33.8 3.0 L 34.5 2.4 L 35.5 2.4 L 36.5 2.8 L 37.6 3.6 L 38.7 4.7 L 39.8 5.9 L 40.9 7.0 L 41.8 7.9 L 42.7 8.4 L 43.4 8.5 L 44.1 8.2 L 44.8 7.4 L 45.4 6.2 L 46.1 4.9 L 46.7 3.4 L 47.5 2.1 L 48.3 1.0 L 49.1 0.2 L 50.0 0.0 Z" /></svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.2 L 51.7 0.6 L 52.5 1.4 L 53.3 2.4 L 54.1 3.5 L 54.8 4.7 L 55.4 5.8 L 56.1 6.9 L 56.7 7.8 L 57.3 8.4 L 58.0 8.8 L 58.8 8.8 L 59.6 8.6 L 60.4 8.2 L 61.4 7.5 L 62.4 6.7 L 63.5 5.9 L 64.6 5.1 L 65.7 4.4 L 66.8 3.9 L 67.8 3.6 L 68.7 3.7 L 69.5 4.0 L 70.2 4.6 L 70.7 5.5 L 71.1 6.6 L 71.4 7.9 L 71.7 9.3 L 71.8 10.6 L 72.0 11.9 L 72.2 13.0 L 72.5 14.0 L 72.9 14.7 L 73.5 15.2 L 74.2 15.4 L 75.1 15.4 L 76.2 15.2 L 77.4 14.9 L 78.7 14.6 L 80.0 14.2 L 81.3 14.0 L 82.6 13.8 L 83.7 13.9 L 84.6 14.1 L 85.4 14.6 L 85.9 15.4 L 86.1 16.3 L 86.2 17.4 L 86.0 18.7 L 85.8 20.0 L 85.4 21.3 L 85.1 22.6 L 84.8 23.8 L 84.6 24.9 L 84.6 25.8 L 84.8 26.5 L 85.3 27.1 L 86.0 27.5 L 87.0 27.8 L 88.1 28.0 L 89.4 28.2 L 90.7 28.3 L 92.1 28.6 L 93.4 28.9 L 94.5 29.3 L 95.4 29.8 L 96.0 30.5 L 96.3 31.3 L 96.4 32.2 L 96.1 33.2 L 95.6 34.3 L 94.9 35.4 L 94.1 36.5 L 93.3 37.6 L 92.5 38.6 L 91.8 39.6 L 91.4 40.4 L 91.2 41.2 L 91.2 42.0 L 91.6 42.7 L 92.2 43.3 L 93.1 43.9 L 94.2 44.6 L 95.3 45.2 L 96.5 45.9 L 97.6 46.7 L 98.6 47.5 L 99.4 48.3 L 99.8 49.1 L 100.0 50.0 L 99.8 50.9 L 99.4 51.7 L 98.6 52.5 L 97.6 53.3 L 96.5 54.1 L 95.3 54.8 L 94.2 55.4 L 93.1 56.1 L 92.2 56.7 L 91.6 57.3 L 91.2 58.0 L 91.2 58.8 L 91.4 59.6 L 91.8 60.4 L 92.5 61.4 L 93.3 62.4 L 94.1 63.5 L 94.9 64.6 L 95.6 65.7 L 96.1 66.8 L 96.4 67.8 L 96.3 68.7 L 96.0 69.5 L 95.4 70.2 L 94.5 70.7 L 93.4 71.1 L 92.1 71.4 L 90.7 71.7 L 89.4 71.8 L 88.1 72.0 L 87.0 72.2 L 86.0 72.5 L 85.3 72.9 L 84.8 73.5 L 84.6 74.2 L 84.6 75.1 L 84.8 76.2 L 85.1 77.4 L 85.4 78.7 L 85.8 80.0 L 86.0 81.3 L 86.2 82.6 L 86.1 83.7 L 85.9 84.6 L 85.4 85.4 L 84.6 85.9 L 83.7 86.1 L 82.6 86.2 L 81.3 86.0 L 80.0 85.8 L 78.7 85.4 L 77.4 85.1 L 76.2 84.8 L 75.1 84.6 L 74.2 84.6 L 73.5 84.8 L 72.9 85.3 L 72.5 86.0 L 72.2 87.0 L 72.0 88.1 L 71.8 89.4 L 71.7 90.7 L 71.4 92.1 L 71.1 93.4 L 70.7 94.5 L 70.2 95.4 L 69.5 96.0 L 68.7 96.3 L 67.8 96.4 L 66.8 96.1 L 65.7 95.6 L 64.6 94.9 L 63.5 94.1 L 62.4 93.3 L 61.4 92.5 L 60.4 91.8 L 59.6 91.4 L 58.8 91.2 L 58.0 91.2 L 57.3 91.6 L 56.7 92.2 L 56.1 93.1 L 55.4 94.2 L 54.8 95.3 L 54.1 96.5 L 53.3 97.6 L 52.5 98.6 L 51.7 99.4 L 50.9 99.8 L 50.0 100.0 L 49.1 99.8 L 48.3 99.4 L 47.5 98.6 L 46.7 97.6 L 45.9 96.5 L 45.2 95.3 L 44.6 94.2 L 43.9 93.1 L 43.3 92.2 L 42.7 91.6 L 42.0 91.2 L 41.2 91.2 L 40.4 91.4 L 39.6 91.8 L 38.6 92.5 L 37.6 93.3 L 36.5 94.1 L 35.4 94.9 L 34.3 95.6 L 33.2 96.1 L 32.2 96.4 L 31.3 96.3 L 30.5 96.0 L 29.8 95.4 L 29.3 94.5 L 28.9 93.4 L 28.6 92.1 L 28.3 90.7 L 28.2 89.4 L 28.0 88.1 L 27.8 87.0 L 27.5 86.0 L 27.1 85.3 L 26.5 84.8 L 25.8 84.6 L 24.9 84.6 L 23.8 84.8 L 22.6 85.1 L 21.3 85.4 L 20.0 85.8 L 18.7 86.0 L 17.4 86.2 L 16.3 86.1 L 15.4 85.9 L 14.6 85.4 L 14.1 84.6 L 13.9 83.7 L 13.8 82.6 L 14.0 81.3 L 14.2 80.0 L 14.6 78.7 L 14.9 77.4 L 15.2 76.2 L 15.4 75.1 L 15.4 74.2 L 15.2 73.5 L 14.7 72.9 L 14.0 72.5 L 13.0 72.2 L 11.9 72.0 L 10.6 71.8 L 9.3 71.7 L 7.9 71.4 L 6.6 71.1 L 5.5 70.7 L 4.6 70.2 L 4.0 69.5 L 3.7 68.7 L 3.6 67.8 L 3.9 66.8 L 4.4 65.7 L 5.1 64.6 L 5.9 63.5 L 6.7 62.4 L 7.5 61.4 L 8.2 60.4 L 8.6 59.6 L 8.8 58.8 L 8.8 58.0 L 8.4 57.3 L 7.8 56.7 L 6.9 56.1 L 5.8 55.4 L 4.7 54.8 L 3.5 54.1 L 2.4 53.3 L 1.4 52.5 L 0.6 51.7 L 0.2 50.9 L 0.0 50.0 L 0.2 49.1 L 0.6 48.3 L 1.4 47.5 L 2.4 46.7 L 3.5 45.9 L 4.7 45.2 L 5.8 44.6 L 6.9 43.9 L 7.8 43.3 L 8.4 42.7 L 8.8 42.0 L 8.8 41.2 L 8.6 40.4 L 8.2 39.6 L 7.5 38.6 L 6.7 37.6 L 5.9 36.5 L 5.1 35.4 L 4.4 34.3 L 3.9 33.2 L 3.6 32.2 L 3.7 31.3 L 4.0 30.5 L 4.6 29.8 L 5.5 29.3 L 6.6 28.9 L 7.9 28.6 L 9.3 28.3 L 10.6 28.2 L 11.9 28.0 L 13.0 27.8 L 14.0 27.5 L 14.7 27.1 L 15.2 26.5 L 15.4 25.8 L 15.4 24.9 L 15.2 23.8 L 14.9 22.6 L 14.6 21.3 L 14.2 20.0 L 14.0 18.7 L 13.8 17.4 L 13.9 16.3 L 14.1 15.4 L 14.6 14.6 L 15.4 14.1 L 16.3 13.9 L 17.4 13.8 L 18.7 14.0 L 20.0 14.2 L 21.3 14.6 L 22.6 14.9 L 23.8 15.2 L 24.9 15.4 L 25.8 15.4 L 26.5 15.2 L 27.1 14.7 L 27.5 14.0 L 27.8 13.0 L 28.0 11.9 L 28.2 10.6 L 28.3 9.3 L 28.6 7.9 L 28.9 6.6 L 29.3 5.5 L 29.8 4.6 L 30.5 4.0 L 31.3 3.7 L 32.2 3.6 L 33.2 3.9 L 34.3 4.4 L 35.4 5.1 L 36.5 5.9 L 37.6 6.7 L 38.6 7.5 L 39.6 8.2 L 40.4 8.6 L 41.2 8.8 L 42.0 8.8 L 42.7 8.4 L 43.3 7.8 L 43.9 6.9 L 44.6 5.8 L 45.2 4.7 L 45.9 3.5 L 46.7 2.4 L 47.5 1.4 L 48.3 0.6 L 49.1 0.2 L 50.0 0.0 Z" /></svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.0 L 51.7 0.2 L 52.6 0.4 L 53.4 0.7 L 54.3 1.1 L 55.1 1.6 L 55.9 2.1 L 56.6 2.7 L 57.4 3.3 L 58.1 4.0 L 58.8 4.7 L 59.5 5.4 L 60.1 6.1 L 60.8 6.8 L 61.4 7.5 L 62.0 8.1 L 62.6 8.8 L 63.2 9.3 L 63.8 9.8 L 64.4 10.3 L 65.1 10.7 L 65.7 11.0 L 66.4 11.3 L 67.1 11.6 L 67.9 11.7 L 68.6 11.8 L 69.4 11.9 L 70.2 11.9 L 71.1 11.9 L 72.0 11.9 L 72.9 11.9 L 73.9 11.8 L 74.8 11.8 L 75.8 11.7 L 76.8 11.8 L 77.8 11.8 L 78.7 11.9 L 79.7 12.0 L 80.6 12.2 L 81.5 12.4 L 82.4 12.7 L 83.2 13.1 L 84.0 13.5 L 84.7 14.1 L 85.4 14.6 L 85.9 15.3 L 86.5 16.0 L 86.9 16.8 L 87.3 17.6 L 87.6 18.5 L 87.8 19.4 L 88.0 20.3 L 88.1 21.3 L 88.2 22.2 L 88.2 23.2 L 88.3 24.2 L 88.2 25.2 L 88.2 26.1 L 88.1 27.1 L 88.1 28.0 L 88.1 28.9 L 88.1 29.8 L 88.1 30.6 L 88.2 31.4 L 88.3 32.1 L 88.4 32.9 L 88.7 33.6 L 89.0 34.3 L 89.3 34.9 L 89.7 35.6 L 90.2 36.2 L 90.7 36.8 L 91.2 37.4 L 91.9 38.0 L 92.5 38.6 L 93.2 39.2 L 93.9 39.9 L 94.6 40.5 L 95.3 41.2 L 96.0 41.9 L 96.7 42.6 L 97.3 43.4 L 97.9 44.1 L 98.4 44.9 L 98.9 45.7 L 99.3 46.6 L 99.6 47.4 L 99.8 48.3 L 100.0 49.1 L 100.0 50.0 L 100.0 50.9 L 99.8 51.7 L 99.6 52.6 L 99.3 53.4 L 98.9 54.3 L 98.4 55.1 L 97.9 55.9 L 97.3 56.6 L 96.7 57.4 L 96.0 58.1 L 95.3 58.8 L 94.6 59.5 L 93.9 60.1 L 93.2 60.8 L 92.5 61.4 L 91.9 62.0 L 91.2 62.6 L 90.7 63.2 L 90.2 63.8 L 89.7 64.4 L 89.3 65.1 L 89.0 65.7 L 88.7 66.4 L 88.4 67.1 L 88.3 67.9 L 88.2 68.6 L 88.1 69.4 L 88.1 70.2 L 88.1 71.1 L 88.1 72.0 L 88.1 72.9 L 88.2 73.9 L 88.2 74.8 L 88.3 75.8 L 88.2 76.8 L 88.2 77.8 L 88.1 78.7 L 88.0 79.7 L 87.8 80.6 L 87.6 81.5 L 87.3 82.4 L 86.9 83.2 L 86.5 84.0 L 85.9 84.7 L 85.4 85.4 L 84.7 85.9 L 84.0 86.5 L 83.2 86.9 L 82.4 87.3 L 81.5 87.6 L 80.6 87.8 L 79.7 88.0 L 78.7 88.1 L 77.8 88.2 L 76.8 88.2 L 75.8 88.3 L 74.8 88.2 L 73.9 88.2 L 72.9 88.1 L 72.0 88.1 L 71.1 88.1 L 70.2 88.1 L 69.4 88.1 L 68.6 88.2 L 67.9 88.3 L 67.1 88.4 L 66.4 88.7 L 65.7 89.0 L 65.1 89.3 L 64.4 89.7 L 63.8 90.2 L 63.2 90.7 L 62.6 91.2 L 62.0 91.9 L 61.4 92.5 L 60.8 93.2 L 60.1 93.9 L 59.5 94.6 L 58.8 95.3 L 58.1 96.0 L 57.4 96.7 L 56.6 97.3 L 55.9 97.9 L 55.1 98.4 L 54.3 98.9 L 53.4 99.3 L 52.6 99.6 L 51.7 99.8 L 50.9 100.0 L 50.0 100.0 L 49.1 100.0 L 48.3 99.8 L 47.4 99.6 L 46.6 99.3 L 45.7 98.9 L 44.9 98.4 L 44.1 97.9 L 43.4 97.3 L 42.6 96.7 L 41.9 96.0 L 41.2 95.3 L 40.5 94.6 L 39.9 93.9 L 39.2 93.2 L 38.6 92.5 L 38.0 91.9 L 37.4 91.2 L 36.8 90.7 L 36.2 90.2 L 35.6 89.7 L 34.9 89.3 L 34.3 89.0 L 33.6 88.7 L 32.9 88.4 L 32.1 88.3 L 31.4 88.2 L 30.6 88.1 L 29.8 88.1 L 28.9 88.1 L 28.0 88.1 L 27.1 88.1 L 26.1 88.2 L 25.2 88.2 L 24.2 88.3 L 23.2 88.2 L 22.2 88.2 L 21.3 88.1 L 20.3 88.0 L 19.4 87.8 L 18.5 87.6 L 17.6 87.3 L 16.8 86.9 L 16.0 86.5 L 15.3 85.9 L 14.6 85.4 L 14.1 84.7 L 13.5 84.0 L 13.1 83.2 L 12.7 82.4 L 12.4 81.5 L 12.2 80.6 L 12.0 79.7 L 11.9 78.7 L 11.8 77.8 L 11.8 76.8 L 11.7 75.8 L 11.8 74.8 L 11.8 73.9 L 11.9 72.9 L 11.9 72.0 L 11.9 71.1 L 11.9 70.2 L 11.9 69.4 L 11.8 68.6 L 11.7 67.9 L 11.6 67.1 L 11.3 66.4 L 11.0 65.7 L 10.7 65.1 L 10.3 64.4 L 9.8 63.8 L 9.3 63.2 L 8.8 62.6 L 8.1 62.0 L 7.5 61.4 L 6.8 60.8 L 6.1 60.1 L 5.4 59.5 L 4.7 58.8 L 4.0 58.1 L 3.3 57.4 L 2.7 56.6 L 2.1 55.9 L 1.6 55.1 L 1.1 54.3 L 0.7 53.4 L 0.4 52.6 L 0.2 51.7 L 0.0 50.9 L 0.0 50.0 L 0.0 49.1 L 0.2 48.3 L 0.4 47.4 L 0.7 46.6 L 1.1 45.7 L 1.6 44.9 L 2.1 44.1 L 2.7 43.4 L 3.3 42.6 L 4.0 41.9 L 4.7 41.2 L 5.4 40.5 L 6.1 39.9 L 6.8 39.2 L 7.5 38.6 L 8.1 38.0 L 8.8 37.4 L 9.3 36.8 L 9.8 36.2 L 10.3 35.6 L 10.7 34.9 L 11.0 34.3 L 11.3 33.6 L 11.6 32.9 L 11.7 32.1 L 11.8 31.4 L 11.9 30.6 L 11.9 29.8 L 11.9 28.9 L 11.9 28.0 L 11.9 27.1 L 11.8 26.1 L 11.8 25.2 L 11.7 24.2 L 11.8 23.2 L 11.8 22.2 L 11.9 21.3 L 12.0 20.3 L 12.2 19.4 L 12.4 18.5 L 12.7 17.6 L 13.1 16.8 L 13.5 16.0 L 14.1 15.3 L 14.6 14.6 L 15.3 14.1 L 16.0 13.5 L 16.8 13.1 L 17.6 12.7 L 18.5 12.4 L 19.4 12.2 L 20.3 12.0 L 21.3 11.9 L 22.2 11.8 L 23.2 11.8 L 24.2 11.7 L 25.2 11.8 L 26.1 11.8 L 27.1 11.9 L 28.0 11.9 L 28.9 11.9 L 29.8 11.9 L 30.6 11.9 L 31.4 11.8 L 32.1 11.7 L 32.9 11.6 L 33.6 11.3 L 34.3 11.0 L 34.9 10.7 L 35.6 10.3 L 36.2 9.8 L 36.8 9.3 L 37.4 8.8 L 38.0 8.1 L 38.6 7.5 L 39.2 6.8 L 39.9 6.1 L 40.5 5.4 L 41.2 4.7 L 41.9 4.0 L 42.6 3.3 L 43.4 2.7 L 44.1 2.1 L 44.9 1.6 L 45.7 1.1 L 46.6 0.7 L 47.4 0.4 L 48.3 0.2 L 49.1 0.0 L 50.0 0.0 Z" /></svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.0 L 51.7 0.1 L 52.6 0.3 L 53.5 0.5 L 54.3 0.7 L 55.1 1.0 L 56.0 1.4 L 56.8 1.8 L 57.6 2.2 L 58.3 2.7 L 59.1 3.2 L 59.8 3.8 L 60.5 4.4 L 61.2 5.0 L 61.9 5.6 L 62.6 6.2 L 63.2 6.8 L 63.8 7.4 L 64.4 8.0 L 65.0 8.7 L 65.6 9.3 L 66.2 9.8 L 66.8 10.4 L 67.4 10.9 L 68.0 11.4 L 68.6 11.9 L 69.2 12.4 L 69.8 12.8 L 70.4 13.2 L 71.0 13.6 L 71.6 14.0 L 72.3 14.3 L 73.0 14.6 L 73.7 14.9 L 74.4 15.2 L 75.1 15.4 L 75.9 15.6 L 76.7 15.9 L 77.5 16.1 L 78.3 16.3 L 79.1 16.5 L 80.0 16.7 L 80.8 17.0 L 81.7 17.2 L 82.5 17.5 L 83.4 17.8 L 84.3 18.1 L 85.1 18.4 L 85.9 18.8 L 86.8 19.1 L 87.6 19.6 L 88.4 20.0 L 89.1 20.5 L 89.8 21.1 L 90.5 21.6 L 91.2 22.2 L 91.8 22.9 L 92.3 23.6 L 92.8 24.3 L 93.3 25.0 L 93.7 25.8 L 94.1 26.6 L 94.4 27.4 L 94.6 28.2 L 94.8 29.1 L 95.0 30.0 L 95.1 30.9 L 95.1 31.8 L 95.1 32.7 L 95.1 33.6 L 95.0 34.5 L 94.9 35.4 L 94.8 36.3 L 94.6 37.2 L 94.4 38.1 L 94.2 39.0 L 94.0 39.8 L 93.8 40.7 L 93.6 41.5 L 93.3 42.4 L 93.1 43.2 L 92.9 44.0 L 92.7 44.8 L 92.5 45.5 L 92.4 46.3 L 92.2 47.0 L 92.1 47.8 L 92.1 48.5 L 92.0 49.3 L 92.0 50.0 L 92.0 50.7 L 92.1 51.5 L 92.1 52.2 L 92.2 53.0 L 92.4 53.7 L 92.5 54.5 L 92.7 55.2 L 92.9 56.0 L 93.1 56.8 L 93.3 57.6 L 93.6 58.5 L 93.8 59.3 L 94.0 60.2 L 94.2 61.0 L 94.4 61.9 L 94.6 62.8 L 94.8 63.7 L 94.9 64.6 L 95.0 65.5 L 95.1 66.4 L 95.1 67.3 L 95.1 68.2 L 95.1 69.1 L 95.0 70.0 L 94.8 70.9 L 94.6 71.8 L 94.4 72.6 L 94.1 73.4 L 93.7 74.2 L 93.3 75.0 L 92.8 75.7 L 92.3 76.4 L 91.8 77.1 L 91.2 77.8 L 90.5 78.4 L 89.8 78.9 L 89.1 79.5 L 88.4 80.0 L 87.6 80.4 L 86.8 80.9 L 85.9 81.2 L 85.1 81.6 L 84.3 81.9 L 83.4 82.2 L 82.5 82.5 L 81.7 82.8 L 80.8 83.0 L 80.0 83.3 L 79.1 83.5 L 78.3 83.7 L 77.5 83.9 L 76.7 84.1 L 75.9 84.4 L 75.1 84.6 L 74.4 84.8 L 73.7 85.1 L 73.0 85.4 L 72.3 85.7 L 71.6 86.0 L 71.0 86.4 L 70.4 86.8 L 69.8 87.2 L 69.2 87.6 L 68.6 88.1 L 68.0 88.6 L 67.4 89.1 L 66.8 89.6 L 66.2 90.2 L 65.6 90.7 L 65.0 91.3 L 64.4 92.0 L 63.8 92.6 L 63.2 93.2 L 62.6 93.8 L 61.9 94.4 L 61.2 95.0 L 60.5 95.6 L 59.8 96.2 L 59.1 96.8 L 58.3 97.3 L 57.6 97.8 L 56.8 98.2 L 56.0 98.6 L 55.1 99.0 L 54.3 99.3 L 53.5 99.5 L 52.6 99.7 L 51.7 99.9 L 50.9 100.0 L 50.0 100.0 L 49.1 100.0 L 48.3 99.9 L 47.4 99.7 L 46.5 99.5 L 45.7 99.3 L 44.9 99.0 L 44.0 98.6 L 43.2 98.2 L 42.4 97.8 L 41.7 97.3 L 40.9 96.8 L 40.2 96.2 L 39.5 95.6 L 38.8 95.0 L 38.1 94.4 L 37.4 93.8 L 36.8 93.2 L 36.2 92.6 L 35.6 92.0 L 35.0 91.3 L 34.4 90.7 L 33.8 90.2 L 33.2 89.6 L 32.6 89.1 L 32.0 88.6 L 31.4 88.1 L 30.8 87.6 L 30.2 87.2 L 29.6 86.8 L 29.0 86.4 L 28.4 86.0 L 27.7 85.7 L 27.0 85.4 L 26.3 85.1 L 25.6 84.8 L 24.9 84.6 L 24.1 84.4 L 23.3 84.1 L 22.5 83.9 L 21.7 83.7 L 20.9 83.5 L 20.0 83.3 L 19.2 83.0 L 18.3 82.8 L 17.5 82.5 L 16.6 82.2 L 15.7 81.9 L 14.9 81.6 L 14.1 81.2 L 13.2 80.9 L 12.4 80.4 L 11.6 80.0 L 10.9 79.5 L 10.2 78.9 L 9.5 78.4 L 8.8 77.8 L 8.2 77.1 L 7.7 76.4 L 7.2 75.7 L 6.7 75.0 L 6.3 74.2 L 5.9 73.4 L 5.6 72.6 L 5.4 71.8 L 5.2 70.9 L 5.0 70.0 L 4.9 69.1 L 4.9 68.2 L 4.9 67.3 L 4.9 66.4 L 5.0 65.5 L 5.1 64.6 L 5.2 63.7 L 5.4 62.8 L 5.6 61.9 L 5.8 61.0 L 6.0 60.2 L 6.2 59.3 L 6.4 58.5 L 6.7 57.6 L 6.9 56.8 L 7.1 56.0 L 7.3 55.2 L 7.5 54.5 L 7.6 53.7 L 7.8 53.0 L 7.9 52.2 L 7.9 51.5 L 8.0 50.7 L 8.0 50.0 L 8.0 49.3 L 7.9 48.5 L 7.9 47.8 L 7.8 47.0 L 7.6 46.3 L 7.5 45.5 L 7.3 44.8 L 7.1 44.0 L 6.9 43.2 L 6.7 42.4 L 6.4 41.5 L 6.2 40.7 L 6.0 39.8 L 5.8 39.0 L 5.6 38.1 L 5.4 37.2 L 5.2 36.3 L 5.1 35.4 L 5.0 34.5 L 4.9 33.6 L 4.9 32.7 L 4.9 31.8 L 4.9 30.9 L 5.0 30.0 L 5.2 29.1 L 5.4 28.2 L 5.6 27.4 L 5.9 26.6 L 6.3 25.8 L 6.7 25.0 L 7.2 24.3 L 7.7 23.6 L 8.2 22.9 L 8.8 22.2 L 9.5 21.6 L 10.2 21.1 L 10.9 20.5 L 11.6 20.0 L 12.4 19.6 L 13.2 19.1 L 14.1 18.8 L 14.9 18.4 L 15.7 18.1 L 16.6 17.8 L 17.5 17.5 L 18.3 17.2 L 19.2 17.0 L 20.0 16.7 L 20.9 16.5 L 21.7 16.3 L 22.5 16.1 L 23.3 15.9 L 24.1 15.6 L 24.9 15.4 L 25.6 15.2 L 26.3 14.9 L 27.0 14.6 L 27.7 14.3 L 28.4 14.0 L 29.0 13.6 L 29.6 13.2 L 30.2 12.8 L 30.8 12.4 L 31.4 11.9 L 32.0 11.4 L 32.6 10.9 L 33.2 10.4 L 33.8 9.8 L 34.4 9.3 L 35.0 8.7 L 35.6 8.0 L 36.2 7.4 L 36.8 6.8 L 37.4 6.2 L 38.1 5.6 L 38.8 5.0 L 39.5 4.4 L 40.2 3.8 L 40.9 3.2 L 41.7 2.7 L 42.4 2.2 L 43.2 1.8 L 44.0 1.4 L 44.9 1.0 L 45.7 0.7 L 46.5 0.5 L 47.4 0.3 L 48.3 0.1 L 49.1 0.0 L 50.0 0.0 Z" /></svg>`
];
// Helpers for playful badge randomization
const BADGE_COLORS = [
  '#ff7b51', // Original Orange
  '#00b8b8ff', // Teal/Green
  '#c574e5ff', // Purple
  '#409b6dff', // Yellow/Gold
  '#f73d66ff', // Pink
  '#6495daff'  // Blue
];

function stringToHash(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function getBadgeRotation() {
  // True random angle between -22 and 22 for every view
  let deg = Math.floor(Math.random() * 45) - 22;

  // Ensure it's not too close to 0 (perceived as "default" rather than random)
  // If result is between -5 and 5, push it out further
  if (Math.abs(deg) < 5) {
    deg += (deg >= 0 ? 10 : -10);
  }

  return deg;
}


function getBadgeColor(seedStr) {
  const hash = stringToHash(seedStr);
  const index = Math.abs(hash) % BADGE_COLORS.length;
  return BADGE_COLORS[index];
}

function getBadgeShape(seedStr) {
  const hash = stringToHash(seedStr);
  const index = Math.abs(hash) % BADGE_SHAPES.length;
  return BADGE_SHAPES[index];
}

function retriggerAnimation(element, animationClass) {
  element.classList.remove(animationClass);
  void element.offsetWidth; // Trigger reflow
  element.classList.add(animationClass);
}

function getDaysUntil(dateString) {
  if (!dateString) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dateString.split('-');
  const target = new Date(parts[0], parts[1] - 1, parts[2]);

  if (isNaN(target.getTime())) return -1;

  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function updateAiChatFab(set) {
  const detailView = el("set-detail");
  if (!detailView) return;

  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const aiEnabled = currentTeam?.ai_enabled;
  let fab = el("ai-chat-fab");

  if (!aiEnabled || !set) {
    if (fab) fab.remove();
    return;
  }

  if (!fab) {
    fab = document.createElement("button");
    fab.id = "ai-chat-fab";
    fab.className = "ai-chat-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "AI Assistant");
    fab.title = "AI Assistant";
    fab.innerHTML = `
      <span class="ai-chat-fab__mesh"></span>
      <span class="ai-chat-fab__icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
    `;
    detailView.appendChild(fab);
  }

  fab.onclick = () => {
    if (state.selectedSet) {
      toggleAiChat(state.selectedSet);
    }
  };
}

function showSetDetail(set) {
  // Stop tracking time on previous page
  stopPageTimeTracking();

  state.selectedSet = set;
  // Save selected set ID to localStorage so it persists across page reloads
  if (set?.id) {
    localStorage.setItem('cadence-selected-set-id', set.id.toString());
  }
  const dashboard = el("dashboard");
  const detailView = el("set-detail");

  dashboard.classList.add("hidden");
  detailView.classList.remove("hidden");

  // Track set detail view
  trackPostHogEvent('set_viewed', {
    set_id: set.id,
    team_id: state.currentTeamId,
    is_published: set.is_published || false
  });

  // Start tracking time on set detail page
  startPageTimeTracking('set_detail', {
    set_id: set.id,
    team_id: state.currentTeamId
  });

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

  // Update countdown badge
  const countdownBadge = el("set-countdown-badge");
  if (countdownBadge) {
    const daysUntil = getDaysUntil(set.scheduled_date);
    if (daysUntil >= 0) {
      countdownBadge.classList.remove("hidden");

      // Calculate playful random values
      const seed = String(set.id || "0") + String(set.scheduled_date || "");
      let rotation = getBadgeRotation();
      const color = getBadgeColor(seed);
      const shape = getBadgeShape(seed + "shape");

      // Apply styles
      countdownBadge.style.setProperty("--current-rotation", `${rotation}deg`);
      // Override the accent color for this specific element
      countdownBadge.style.setProperty("--accent-color", color);




      // Re-create node to reset animations and listeners cleanly
      const newBadge = countdownBadge.cloneNode(false);
      countdownBadge.parentNode.replaceChild(newBadge, countdownBadge);

      // Use the new reference
      const finalBadge = newBadge;

      const label = daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "DAY" : "DAYS";
      finalBadge.innerHTML = `
        ${shape}
        <div class="countdown-content">
          ${daysUntil > 0 ? `<div class="countdown-number">${daysUntil}</div>` : ''}
          <div class="countdown-label" style="${daysUntil === 0 ? 'font-size: 1.1rem; font-weight: 800;' : ''}">${label}</div>
        </div>
      `;

      finalBadge.onclick = () => {
        retriggerAnimation(finalBadge, "animate-pop-in");
      };

      // Initial animation
      finalBadge.classList.add("animate-pop-in");

    } else {
      countdownBadge.classList.add("hidden");
    }
  }



  // Show/hide edit/delete buttons for managers
  const editBtn = el("btn-edit-set-detail");
  const deleteBtn = el("btn-delete-set-detail");
  const viewAsMemberDetailBtn = el("btn-view-as-member-detail");
  const publishBtn = el("btn-publish-set-detail");
  const pinBtn = el("btn-pin-set-detail");
  const headerAddDropdown = el("header-add-dropdown-container");
  const mobileHeaderAddDropdown = el("mobile-header-add-dropdown-container");

  // Show/hide management buttons based on isManager()
  const isMgr = isManager();

  if (editBtn) editBtn.classList.toggle("hidden", !isMgr);
  if (deleteBtn) deleteBtn.classList.toggle("hidden", !isMgr);

  // Setup pin button
  if (pinBtn) {
    const isPinned = set.is_pinned === true;
    const icon = pinBtn.querySelector("i");

    // Update initial button state
    if (icon) {
      if (isPinned) {
        icon.classList.remove("fa-regular", "fa-thumbtack");
        icon.classList.add("fa-solid", "fa-thumbtack");
        pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack-slash"></i>\n                Unpin';
        pinBtn.classList.add("pinned");
      } else {
        icon.classList.remove("fa-solid", "fa-thumbtack");
        icon.classList.add("fa-regular", "fa-thumbtack");
        pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>\n                Pin';
        pinBtn.classList.remove("pinned");
      }
    }

    // Remove existing event listeners by cloning the button
    const newPinBtn = pinBtn.cloneNode(true);
    pinBtn.parentNode.replaceChild(newPinBtn, pinBtn);
    const finalPinBtn = el("btn-pin-set-detail");
    finalPinBtn.addEventListener("click", async () => {
      await togglePinSet(set, finalPinBtn);
      // Update the button text after toggling
      const updatedIsPinned = set.is_pinned === true;
      if (updatedIsPinned) {
        finalPinBtn.innerHTML = '<i class="fa-solid fa-thumbtack-slash"></i>\n                Unpin';
        finalPinBtn.classList.add("pinned");
      } else {
        finalPinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>\n                Pin';
        finalPinBtn.classList.remove("pinned");
      }
    });
  }

  // Show/hide publish button - only show for managers when set is unpublished and team requires publishing
  if (publishBtn) {
    const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
    const teamRequiresPublish = currentTeam?.require_publish !== false;
    const isPublished = set.is_published === true;

    // Show publish button if: user is manager, set is unpublished, and team requires publishing
    const shouldShowPublish = isMgr && !isPublished && teamRequiresPublish;
    publishBtn.classList.toggle("hidden", !shouldShowPublish);
  }

  // Always toggle both desktop and mobile add containers together
  if (headerAddDropdown) headerAddDropdown.classList.toggle("hidden", !isMgr);
  if (mobileHeaderAddDropdown) mobileHeaderAddDropdown.classList.toggle("hidden", !isMgr);

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

  // AI Chat Floating Button
  updateAiChatFab(set);

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

  // Check for and render pending requests (assignments) for this set
  renderSetDetailPendingRequests(set);
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
          headerWrapper.classList.add("ripple-item");
          headerWrapper.style.animationDelay = `${index * 0.03}s`;
          headerWrapper.draggable = false; // Will be set to true when dragging from handle

          // Add drag handle for managers (positioned on the left)
          const hasDragHandle = isManager();
          if (hasDragHandle) {
            const dragHandle = document.createElement("div");
            dragHandle.className = "drag-handle";
            dragHandle.style.cssText = "position: absolute; left: 0.5rem; top: 50%; transform: translateY(-50%); cursor: grab; color: var(--text-muted); font-size: 1.2rem; line-height: 1; padding: 0.5rem; display: flex; align-items: center; justify-content: center; transition: color 0.2s ease; flex-shrink: 0; z-index: 1;";
            dragHandle.textContent = "⋮⋮";
            dragHandle.title = "Drag to reorder";
            dragHandle.addEventListener("mousedown", function (e) {
              headerWrapper.draggable = true;
            });
            dragHandle.addEventListener("selectstart", function (e) {
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
        card.classList.add("ripple-item");
        card.style.animationDelay = `${index * 0.03}s`;

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
          const sectionResources = setSong.song_resources || [];
          const sectionLinks = sectionResources.filter(r => r.type === 'link' || r.type === 'file');

          if (sectionLinks.length > 0) {
            // Sort links by display_order
            const sortedLinks = [...sectionLinks].sort((a, b) => {
              const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
              const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
              return ao - bo;
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
                      audio.crossOrigin = "anonymous";
                      audio.src = fileUrl;
                      audio.style.width = "100%";
                      audio.style.marginTop = "0.5rem";
                      audio.preload = "metadata";

                      content.appendChild(title);
                      try {
                        const transposeControls = buildAudioTransposeControls(audio, { baseKey: link.key || link.song_key || link.songKey });
                        if (transposeControls) content.appendChild(transposeControls);
                      } catch (err) {
                        console.error("Failed to build transpose controls:", err);
                      }
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
                    personEmail: assignment.person?.email || assignment.pending_invite?.email || assignment.person_email || "",
                    personId: assignment.person_id || assignment.person?.id || null,
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
            openSongDetailsModal(setSong.song, setSong.key || null, setSong);
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
  // Stop tracking time on set detail
  stopPageTimeTracking();

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
  const handleDragStart = function (e) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", this.dataset.setSongId);
    this.classList.add("dragging");
    this.style.opacity = "0.5";
  };

  const handleDragEnd = function (e) {
    this.classList.remove("dragging");
    this.style.opacity = "";
    this.draggable = false;
    container.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
  };

  const handleDragOver = function (e) {
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

  const handleDrop = async function (e) {
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
      dragHandle.addEventListener("mousedown", function (e) {
        item.draggable = true;
      });
      // Prevent text selection on the drag handle
      dragHandle.addEventListener("selectstart", function (e) {
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
  const handleContainerDragOver = function (e) {
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

  const handleContainerDrop = async function (e) {
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
    return false;
  }

  if (!isManager()) {
    console.warn("Only managers can reorder songs");
    toastError("Only managers can reorder songs.");
    return false;
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
    return false;
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
    return false;
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
    return false;
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

  return true;
}

function setupLinkDragAndDrop(item, container) {
  // Clean up existing handlers if they exist
  if (item._linkDragHandlers) {
    const dragHandle = item.querySelector(".drag-handle");
    if (dragHandle && item._linkDragHandlers.dragHandleMousedown) {
      dragHandle.removeEventListener("mousedown", item._linkDragHandlers.dragHandleMousedown);
      dragHandle.removeEventListener("selectstart", item._linkDragHandlers.dragHandleSelectstart);
    }
    if (item._linkDragHandlers.selectstart) {
      item.removeEventListener("selectstart", item._linkDragHandlers.selectstart);
    }
    if (item._linkDragHandlers.dragstart) {
      item.removeEventListener("dragstart", item._linkDragHandlers.dragstart);
    }
    if (item._linkDragHandlers.dragend) {
      item.removeEventListener("dragend", item._linkDragHandlers.dragend);
    }
    if (item._linkDragHandlers.dragover) {
      item.removeEventListener("dragover", item._linkDragHandlers.dragover);
    }
    if (item._linkDragHandlers.drop) {
      item.removeEventListener("drop", item._linkDragHandlers.drop);
    }
  }

  // Only allow dragging from the drag handle
  const dragHandle = item.querySelector(".drag-handle");
  const dragHandleMousedown = (e) => {
    item.draggable = true;
  };
  const dragHandleSelectstart = (e) => {
    e.preventDefault();
  };

  if (dragHandle) {
    dragHandle.addEventListener("mousedown", dragHandleMousedown);
    // Prevent text selection on the drag handle
    dragHandle.addEventListener("selectstart", dragHandleSelectstart);
    dragHandle.style.userSelect = "none";
  }

  const handleSelectStart = (e) => {
    // Prevent text selection during drag operations
    if (item.classList.contains("dragging")) {
      e.preventDefault();
      return false;
    }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.linkId);
    item.classList.add("dragging");
    item.style.opacity = "0.5";
    // Prevent text selection during drag
    item.style.userSelect = "none";
    item.style.webkitUserSelect = "none";
    item.style.mozUserSelect = "none";
    item.style.msUserSelect = "none";
    // Also prevent selection on all child elements
    item.querySelectorAll("*").forEach(el => {
      el.style.userSelect = "none";
      el.style.webkitUserSelect = "none";
      el.style.mozUserSelect = "none";
      el.style.msUserSelect = "none";
    });
  };

  const handleDragEnd = (e) => {
    item.classList.remove("dragging");
    item.style.opacity = "";
    item.style.userSelect = "";
    item.draggable = false;
    // Restore text selection on all child elements
    item.querySelectorAll("*").forEach(el => {
      el.style.userSelect = "";
    });
    // Remove all drop indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
  };

  const handleDragOver = (e) => {
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
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Update the order in the DOM (global across all link sections)
    updateAllLinkOrderInDom();
    // Save the order to the database immediately (like song/section reorder)
    await saveAllResourceOrder();
    // Remove indicators
    container.querySelectorAll(".drop-indicator").forEach(el => el.remove());
  };

  // Prevent text selection on the entire item during drag
  item.addEventListener("selectstart", handleSelectStart);
  item.addEventListener("dragstart", handleDragStart);
  item.addEventListener("dragend", handleDragEnd);
  item.addEventListener("dragover", handleDragOver);
  item.addEventListener("drop", handleDrop);

  // Store handlers for cleanup
  item._linkDragHandlers = {
    dragHandleMousedown,
    dragHandleSelectstart,
    selectstart: handleSelectStart,
    dragstart: handleDragStart,
    dragend: handleDragEnd,
    dragover: handleDragOver,
    drop: handleDrop
  };

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
      await saveAllResourceOrder();
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

// Deprecated functions removed


function getOrderedExistingResourcesFromDom() {
  const linksRoot = el("song-links-list");
  if (!linksRoot) return [];
  const orderedResources = [];
  let globalOrder = 0;
  const sections = Array.from(linksRoot.querySelectorAll(".song-links-section"));
  sections.forEach(section => {
    const sectionContent = section.querySelector(".song-links-section-content");
    if (!sectionContent) return;
    const items = Array.from(sectionContent.querySelectorAll(".song-link-row.draggable-item"));
    items.forEach((item) => {
      // Skip readonly/generated chart rows (they don't have database IDs and shouldn't be reordered)
      const isReadonlyChart = item.classList.contains("song-chart-row") &&
        (item.classList.contains("readonly") || item.querySelector(".view-generated-chart"));
      if (isReadonlyChart) {
        return; // Don't include in ordering, don't increment order
      }

      const resourceId = item.dataset.resourceId || item.dataset.linkId || item.dataset.chartId; // Fallbacks for safety

      // Only include valid IDs (non-empty strings) and increment order for each item
      if (resourceId && resourceId !== '' && !resourceId.startsWith('new-')) {
        // If it starts with 'chart-', strip prefix if it was added (but we store raw ID in dataset.resourceId usually)
        // Check if resourceId is UUID
        orderedResources.push({ id: resourceId, display_order: globalOrder });
        globalOrder += 1;
      }
    });
  });
  return orderedResources;
}

// Deprecated individual reorder functions
async function reorderSongLinks(orderedLinks, songId) { console.warn("reorderSongLinks deprecated"); }
async function reorderSongCharts(orderedCharts, songId) { console.warn("reorderSongCharts deprecated"); }

async function saveAllResourceOrder() {
  const form = el("song-edit-form");
  const songId = form?.dataset.songId;
  if (!songId) return;
  const orderedResources = getOrderedExistingResourcesFromDom();

  if (orderedResources.length > 0) {
    await reorderSongResources(orderedResources, songId);
  }
}

async function reorderSongResources(orderedResources, songId) {
  if (!songId) return;

  const errors = [];
  const tempBase = -2000000;

  // Phase 1: Move ALL to temporary values to avoid unique constraint collisions
  const phase1 = orderedResources.map(async ({ id }, idx) => {
    const tempValue = tempBase - idx;
    const { error } = await supabase
      .from(SONG_RESOURCES_TABLE)
      .update({ display_order: tempValue })
      .eq("id", id)
      .eq("song_id", songId)
      .eq("team_id", state.currentTeamId);
    if (error) errors.push({ phase: "temporary", id, error });
  });

  await Promise.all(phase1);

  if (errors.length > 0) {
    console.error("Failed to set temporary display_order values:", errors);
    toastError("Failed to reorder resources. Check console for details.");
    return;
  }

  // Phase 2: Set final display_order values
  const phase2 = orderedResources.map(async ({ id, display_order }) => {
    const { error } = await supabase
      .from(SONG_RESOURCES_TABLE)
      .update({ display_order })
      .eq("id", id)
      .eq("song_id", songId)
      .eq("team_id", state.currentTeamId);
    if (error) errors.push({ phase: "final", id, display_order, error });
  });

  await Promise.all(phase2);

  // Invalidate chart cache to ensure new order is reflected in view mode
  if (state.chordCharts && state.chordCharts.cache) {
    state.chordCharts.cache.delete(songId);
  }

  if (errors.length > 0) {
    console.error("Failed to set final display_order values:", errors);
    toastError("Some resources could not be reordered. Check console for details.");
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
  const prevSelectedSetId = state.selectedSet?.id ?? null;
  state.selectedSet = set;
  setModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  el("set-modal-title").textContent = set ? "Edit Set" : "New Set";

  // PostHog: Track modal open
  trackPostHogEvent('modal_opened', {
    modal_type: set ? 'edit_set' : 'new_set',
    team_id: state.currentTeamId
  });

  // Start tracking time on modal
  startPageTimeTracking('modal_edit_set', {
    modal_type: set ? 'edit_set' : 'new_set',
    set_id: set?.id,
    team_id: state.currentTeamId
  });
  el("set-title").value = set?.title ?? "";
  // Normalize scheduled_date to YYYY-MM-DD for <input type="date">.
  // Supabase may return a timestamp/ISO string (e.g. 2026-01-18T00:00:00Z) which the date input won't accept.
  const rawScheduledDate = set?.scheduled_date ?? "";
  const normalizedScheduledDate =
    rawScheduledDate instanceof Date
      ? rawScheduledDate.toISOString().slice(0, 10)
      : (rawScheduledDate ? String(rawScheduledDate).slice(0, 10) : "");
  el("set-date").value = normalizedScheduledDate;
  el("set-description").value = set?.description ?? "";

  // Show assignment mode section only for managers
  const assignmentModeSection = el("set-assignment-mode-section");
  if (assignmentModeSection) {
    assignmentModeSection.classList.remove("hidden");
  }

  // Show publish section only when editing an existing set
  // Reset pending changes when opening modal for a new set or different set
  // Also reset if opening for the same set (to start fresh)
  if (!set) {
    state.pendingSetChanges = null;
  } else if (prevSelectedSetId && set.id !== prevSelectedSetId) {
    state.pendingSetChanges = null;
  } else {
    // For the same set, preserve pending changes (user might want to continue editing)
    // But we'll reset it if they close without saving
  }

  const publishSection = el("set-publish-section");
  const publishBtn = el("btn-publish-set");
  const publishBtnText = el("btn-publish-set-text");
  const publishStatus = el("set-publish-status");

  if (publishSection && publishBtn && publishBtnText && publishStatus) {
    if (set) {
      // Show publish section for existing sets
      publishSection.classList.remove("hidden");

      // Check if team requires publishing
      const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
      const teamRequiresPublish = currentTeam?.require_publish !== false;

      if (teamRequiresPublish) {
        // Check if there's a pending change, otherwise use current status
        const pendingPublishStatus = state.pendingSetChanges?.is_published;
        const isPublished = pendingPublishStatus !== undefined
          ? pendingPublishStatus
          : (set.is_published === true);

        if (isPublished) {
          const statusText = pendingPublishStatus !== undefined
            ? "This set will be published when you save."
            : "This set is published and visible to all team members.";
          publishStatus.textContent = statusText;
          publishBtnText.textContent = "Unpublish";
          const icon = publishBtn.querySelector("i");
          if (icon) {
            icon.className = "fa-solid fa-eye-slash";
          }
          publishBtn.classList.remove("secondary");
          publishBtn.classList.add("ghost");
        } else {
          const statusText = pendingPublishStatus !== undefined
            ? "This set will be unpublished when you save."
            : "This set is unpublished and only visible to owners and managers.";
          publishStatus.textContent = statusText;
          publishBtnText.textContent = "Publish";
          const icon = publishBtn.querySelector("i");
          if (icon) {
            icon.className = "fa-solid fa-eye";
          }
          publishBtn.classList.remove("ghost");
          publishBtn.classList.add("secondary");
        }
      } else {
        // Team doesn't require publishing, hide the section
        publishSection.classList.add("hidden");
      }
    } else {
      // Hide publish section for new sets (they start unpublished)
      publishSection.classList.add("hidden");
    }
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

  // Focus on first input field for keyboard navigation
  const titleInput = el("set-title");
  if (titleInput) {
    setTimeout(() => titleInput.focus(), 100);
  }
}

function closeSetModal() {
  closeModalWithAnimation(setModal, () => {
    el("set-form").reset();

    // Reset pending changes when closing modal without saving
    state.pendingSetChanges = null;

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
  });
}

async function openTimesModal() {
  if (!isManager() || !state.selectedSet) return;
  const set = state.selectedSet;
  const timesModal = el("times-modal");
  timesModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Prepare in-memory map of existing time alerts
  state.setTimeAlerts = { service: {}, rehearsal: {} };

  // Update alert info text with dynamic time from team settings
  const alertInfoEl = el("times-modal-alert-info");
  if (alertInfoEl) {
    const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
    let timeDisplay = "8am"; // Default

    if (currentTeam && currentTeam.daily_reminder_time) {
      try {
        const [hours, minutes] = currentTeam.daily_reminder_time.split(':');
        const h = parseInt(hours, 10);
        const m = parseInt(minutes, 10);
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        const mStr = m > 0 ? `:${m.toString().padStart(2, '0')}` : '';
        timeDisplay = `${h12}${mStr}${ampm}`;
      } catch (e) {
        console.error("Error formatting time", e);
      }
    }

    alertInfoEl.innerHTML = `You can set up to 3 alerts per set, and alerts are sent at <strong>${timeDisplay}</strong> on the scheduled date. <a href="#" id="link-change-alert-time" style="color: var(--accent-color); text-decoration: underline;">Change time</a>`;

    // Add click listener purely for this modal session
    // Using setTimeout to ensure the innerHTML render is complete? No, distinct element creation is safer but innerHTML is easier for text mix.
    // We'll attach the listener comfortably.
    const link = alertInfoEl.querySelector("#link-change-alert-time");
    if (link) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        closeTimesModal();
        openTeamSettingsModal();
      });
    }
  }

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
  closeModalWithAnimation(timesModal, () => {
    el("times-form").reset();
    el("service-times-list").innerHTML = "";
    el("rehearsal-times-list").innerHTML = "";
  });
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
  closeModalWithAnimation(modal, () => {
    el("set-assignments-form").reset();
    el("set-assignments-list").innerHTML = "";
  });
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

// Send notifications for all assignments when a set is published
async function sendNotificationsForPublishedSet(setId, teamId) {
  if (!setId || !teamId) return;

  try {
    // Fetch the set to get assignment mode
    const { data: set, error: setError } = await supabase
      .from("sets")
      .select("id, assignment_mode, assignment_mode_override")
      .eq("id", setId)
      .single();

    if (setError || !set) {
      console.error("Error fetching set for notifications:", setError);
      return;
    }

    // Determine assignment mode
    const assignmentMode = set.assignment_mode_override || set.assignment_mode || 'per_set';

    if (assignmentMode === 'per_set') {
      // Get all set-level assignments
      const { data: setAssignments, error: assignmentsError } = await supabase
        .from("set_assignments")
        .select("person_id, pending_invite_id, person_email")
        .eq("set_id", setId);

      if (assignmentsError) {
        console.error("Error fetching set assignments for notifications:", assignmentsError);
        return;
      }

      if (setAssignments && setAssignments.length > 0) {
        // Build recipients list
        const recipients = setAssignments
          .map((assignment) => {
            const key = getAssignmentIdentityKeyFromDbRow(assignment);
            if (!key) return null;
            return {
              key,
              person_id: assignment.person_id || null,
              pending_invite_id: assignment.pending_invite_id || null,
              person_email: assignment.person_email || null,
            };
          })
          .filter(Boolean);

        if (recipients.length > 0) {
          console.log(`📧 Sending notifications for ${recipients.length} set-level assignments on publish`);
          await notifyAssignmentEmails(setId, teamId, recipients, "per_set");
        }
      }
    } else {
      // per_song mode - get all song-level assignments
      const { data: songAssignments, error: songAssignmentsError } = await supabase
        .from("song_assignments")
        .select(`
          person_id,
          pending_invite_id,
          person_email,
          set_song:set_song_id ( set_id )
        `)
        .eq("set_song.set_id", setId);

      if (songAssignmentsError) {
        console.error("Error fetching song assignments for notifications:", songAssignmentsError);
        return;
      }

      if (songAssignments && songAssignments.length > 0) {
        // Build recipients list (deduplicate by identity key)
        const recipientMap = new Map();
        songAssignments.forEach((assignment) => {
          const key = getAssignmentIdentityKeyFromDbRow(assignment);
          if (!key) return;
          if (!recipientMap.has(key)) {
            recipientMap.set(key, {
              key,
              person_id: assignment.person_id || null,
              pending_invite_id: assignment.pending_invite_id || null,
              person_email: assignment.person_email || null,
            });
          }
        });

        const recipients = Array.from(recipientMap.values());
        if (recipients.length > 0) {
          console.log(`📧 Sending notifications for ${recipients.length} song-level assignments on publish`);
          await notifyAssignmentEmails(setId, teamId, recipients, "per_song");
        }
      }
    }
  } catch (error) {
    console.error("Error sending notifications for published set:", error);
    // Don't block the publish flow on notification errors
  }
}

// Fire-and-forget wrapper for sending assignment notification emails via Supabase Edge Function
// Note: The edge function will verify the set is published before sending
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
          } else if (data?.summary?.sent) {
            // PostHog: Track emails sent per day per team
            trackPostHogEvent('emails_sent', {
              team_id: teamId,
              email_count: data.summary.sent,
              set_id: setId,
              mode: mode
            });
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
  row.style.flexDirection = "column";
  row.style.gap = "0.75rem";
  row.style.alignItems = "stretch";
  row.dataset.tempId = id || `temp-${Date.now()}-${Math.random()}`;

  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.gap = "0.75rem";
  topRow.style.alignItems = "center";

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

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn ghost small solo-icon-btn";
  removeBtn.innerHTML = '<i class="fa-solid fa-trash solo-icon-btn"></i>';
  removeBtn.addEventListener("click", () => row.remove());

  topRow.appendChild(timeInput);
  topRow.appendChild(removeBtn);

  row.appendChild(topRow);
  row.appendChild(alertsRow);
  container.appendChild(row);

  if (alertOffsets && alertOffsets.length > 0) {
    applySelectedTimeAlertsToRow(row, alertOffsets);
  }
}

function addRehearsalTimeRow(date = "", time = "", id = null, alertOffsets = []) {
  const container = el("rehearsal-times-list");
  const row = document.createElement("div");
  row.className = "rehearsal-time-row";
  row.style.flexDirection = "column";
  row.style.gap = "0.75rem";
  row.style.alignItems = "stretch";
  row.dataset.tempId = id || `temp-${Date.now()}-${Math.random()}`;

  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.gap = "0.75rem";
  topRow.style.alignItems = "center";

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

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn ghost small solo-icon-btn";
  removeBtn.innerHTML = '<i class="fa-solid fa-trash solo-icon-btn"></i>';
  removeBtn.addEventListener("click", () => row.remove());

  topRow.appendChild(dateInput);
  topRow.appendChild(timeInput);
  topRow.appendChild(removeBtn);

  row.appendChild(topRow);
  row.appendChild(alertsRow);
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

  // Capture this once so it's available throughout the function (including analytics)
  const overrideCheckbox = el("set-override-assignment-mode");

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
    // New sets start as unpublished (default is false, but be explicit)
    payload.is_published = false;
  }

  // Apply pending publish status change if set
  if (state.pendingSetChanges?.is_published !== undefined) {
    payload.is_published = state.pendingSetChanges.is_published;
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

  // PostHog: Track modal conversion
  trackPostHogEvent('modal_converted', {
    modal_type: isEditing ? 'edit_set' : 'new_set',
    team_id: state.currentTeamId,
    set_id: isEditing ? editingSetId : response.data.id
  });

  // Track set unpublished if it was unpublished
  if (isEditing && state.pendingSetChanges?.is_published === false && response.data.is_published === false) {
    trackPostHogEvent('set_unpublished', {
      set_id: editingSetId,
      team_id: state.currentTeamId
    });
  }

  // Track assignment mode if set was created/edited
  if (newAssignmentMode) {
    trackPostHogEvent('assignment_mode_used', {
      mode: newAssignmentMode,
      team_id: state.currentTeamId,
      set_id: isEditing ? editingSetId : response.data.id,
      is_override: overrideCheckbox?.checked || false
    });
  }

  // Update aggregate metrics after set creation/update (debounced)
  setTimeout(() => sendAggregateMetrics(), 1000);

  const finalSetId = response.data.id;

  // Send notifications if set was just published
  if (state.pendingSetChanges?.is_published === true && response.data.is_published === true) {
    await sendNotificationsForPublishedSet(finalSetId, state.currentTeamId);
  }

  // Clear pending changes
  state.pendingSetChanges = null;

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

// Track publish countdown state
let publishCountdownTimer = null;
let publishCountdownInterval = null;
let beforeUnloadHandler = null;

function startPublishCountdown(set) {
  if (!isManager() || !set) return;

  // Cancel any existing countdown first
  cancelPublishCountdown();

  const publishBtn = el("btn-publish-set-detail");
  if (!publishBtn || !publishBtn.parentNode) {
    console.error("Publish button not found or has no parent");
    return;
  }

  let timeRemaining = 3;
  const totalTime = 3;

  // Update button to show countdown state
  publishBtn.classList.add("publish-countdown-active");
  publishBtn.classList.remove("hidden");
  publishBtn.disabled = false; // Keep enabled so it's clickable for cancel

  // Create progress bar element
  const progressBar = document.createElement("div");
  progressBar.className = "publish-progress-bar";

  // Build button structure
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-clock";

  // Create text container
  const textContainer = document.createElement("span");
  textContainer.className = "publish-countdown-text";
  textContainer.textContent = `Cancel... (${timeRemaining})`;

  // Clear and rebuild button content
  publishBtn.innerHTML = '';
  publishBtn.appendChild(icon);
  publishBtn.appendChild(textContainer);
  publishBtn.appendChild(progressBar);

  // Force a reflow to ensure button updates
  publishBtn.offsetHeight;

  // Store reference to textContainer for updates
  const updateText = () => {
    const btn = el("btn-publish-set-detail");
    if (btn) {
      const textEl = btn.querySelector(".publish-countdown-text");
      if (textEl) {
        textEl.textContent = `Cancel... (${timeRemaining})`;
      }
    }
  };

  // Make the whole button cancelable by clicking it
  const cancelHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();
    cancelPublishCountdown();
  };

  // Remove any existing handlers by cloning
  const newBtn = publishBtn.cloneNode(false);
  newBtn.className = publishBtn.className;
  newBtn.id = publishBtn.id;
  newBtn.innerHTML = '';
  newBtn.classList.add("publish-countdown-active");
  newBtn.classList.remove("hidden");
  newBtn.disabled = false;

  const newIcon = document.createElement("i");
  newIcon.className = "fa-solid fa-clock";
  const newTextContainer = document.createElement("span");
  newTextContainer.className = "publish-countdown-text";
  newTextContainer.textContent = `Cancel... (${timeRemaining})`;
  const newProgressBar = document.createElement("div");
  newProgressBar.className = "publish-progress-bar";

  newBtn.appendChild(newIcon);
  newBtn.appendChild(newTextContainer);
  newBtn.appendChild(newProgressBar);

  // Replace button
  publishBtn.parentNode.replaceChild(newBtn, publishBtn);

  // Add cancel handler
  newBtn.addEventListener("click", cancelHandler);

  // Add beforeunload handler
  beforeUnloadHandler = (e) => {
    e.preventDefault();
    e.returnValue = "You have a set publication in progress. Are you sure you want to leave?";
    return e.returnValue;
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);

  // Start countdown animation - subtle fill from left
  newProgressBar.style.width = "0%";
  newProgressBar.style.transition = `width ${totalTime}s ease-out`;

  // Force reflow to start animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newProgressBar.style.width = "100%";
    });
  });

  // Update countdown text
  publishCountdownInterval = setInterval(() => {
    timeRemaining--;
    if (timeRemaining > 0) {
      // Update text using fresh reference
      const btn = el("btn-publish-set-detail");
      if (btn) {
        const textEl = btn.querySelector(".publish-countdown-text");
        if (textEl) {
          textEl.textContent = `Cancel... (${timeRemaining})`;
        }
      }
    } else {
      // Countdown complete
      clearInterval(publishCountdownInterval);
      publishCountdownInterval = null;
    }
  }, 1000);

  // Complete countdown after 3 seconds
  publishCountdownTimer = setTimeout(async () => {
    clearTimeout(publishCountdownTimer);
    publishCountdownTimer = null;
    await completePublishCountdown(set);
  }, totalTime * 1000);
}

function cancelPublishCountdown() {
  const publishBtn = el("btn-publish-set-detail");

  if (publishCountdownTimer) {
    clearTimeout(publishCountdownTimer);
    publishCountdownTimer = null;
  }

  if (publishCountdownInterval) {
    clearInterval(publishCountdownInterval);
    publishCountdownInterval = null;
  }

  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    beforeUnloadHandler = null;
  }

  if (publishBtn && publishBtn.parentNode) {
    // Remove all event listeners by cloning and replacing
    const newBtn = publishBtn.cloneNode(false);
    newBtn.className = publishBtn.className;
    newBtn.id = publishBtn.id;
    publishBtn.parentNode.replaceChild(newBtn, publishBtn);

    // Restore button state
    newBtn.classList.remove("publish-countdown-active");
    newBtn.disabled = false;
    newBtn.classList.remove("hidden");

    // Restore original button content
    newBtn.innerHTML = '<i class="fa-solid fa-eye"></i> Publish';

    // Re-attach original handler
    newBtn.addEventListener("click", async () => {
      if (state.selectedSet && isManager()) {
        startPublishCountdown(state.selectedSet);
      }
    });
  }
}

async function completePublishCountdown(set) {
  // Clean up countdown UI
  cancelPublishCountdown();

  // Actually publish the set
  await publishSetFromDetail(set);
}

async function publishSetFromDetail(set) {
  if (!isManager() || !set) return;

  // Update the set's published status to true
  const { error } = await supabase
    .from("sets")
    .update({ is_published: true })
    .eq("id", set.id)
    .eq("team_id", state.currentTeamId);

  if (error) {
    console.error("Error publishing set:", error);
    toastError("Unable to publish set. Check console.");
    return;
  }

  // Update local state
  set.is_published = true;

  // Update state.sets
  const setInState = state.sets.find(s => s.id === set.id);
  if (setInState) {
    setInState.is_published = true;
  }

  // Send notifications for all assignments when set is published
  await sendNotificationsForPublishedSet(set.id, state.currentTeamId);

  // Track set published
  trackPostHogEvent('set_published', {
    set_id: set.id,
    team_id: state.currentTeamId
  });

  // Update aggregate metrics (debounced)
  setTimeout(() => sendAggregateMetrics(), 1000);

  toastSuccess("Set published successfully.");

  // Reload sets to reflect the change
  await loadSets();

  // Refresh detail view
  const updatedSet = state.sets.find(s => s.id === set.id);
  if (updatedSet) {
    showSetDetail(updatedSet);
  }
}

function handlePublishSet(event) {
  event.preventDefault();
  if (!isManager() || !state.selectedSet) return;

  const set = state.selectedSet;
  // Check pending changes first, then current status
  const currentPublishedStatus = state.pendingSetChanges?.is_published !== undefined
    ? state.pendingSetChanges.is_published
    : (set.is_published === true);
  const newPublishedStatus = !currentPublishedStatus;

  // Store the desired publish status in state (will be applied on save)
  if (!state.pendingSetChanges) {
    state.pendingSetChanges = {};
  }
  state.pendingSetChanges.is_published = newPublishedStatus;

  // Update the UI in the modal to reflect the pending change
  const publishBtn = el("btn-publish-set");
  const publishBtnText = el("btn-publish-set-text");
  const publishStatus = el("set-publish-status");

  if (publishBtn && publishBtnText && publishStatus) {
    if (newPublishedStatus) {
      publishStatus.textContent = "This set will be published when you save.";
      publishBtnText.textContent = "Unpublish";
      // Update icon
      const icon = publishBtn.querySelector("i");
      if (icon) {
        icon.className = "fa-solid fa-eye-slash";
      }
      publishBtn.classList.remove("secondary");
      publishBtn.classList.add("ghost");
    } else {
      publishStatus.textContent = "This set will be unpublished when you save.";
      publishBtnText.textContent = "Publish";
      // Update icon
      const icon = publishBtn.querySelector("i");
      if (icon) {
        icon.className = "fa-solid fa-eye";
      }
      publishBtn.classList.remove("ghost");
      publishBtn.classList.add("secondary");
    }
  }
}

async function loadSetSongs(setId) {
  const { data, error } = await supabase
    .from("set_songs")
    .select(
      `
      *,
      song:song_id (
        *,
        song_keys (*),
        song_resources (*)
      ),
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

  // Focus on first input field for keyboard navigation
  const keyInput = el("song-key-select");
  if (keyInput) {
    setTimeout(() => keyInput.focus(), 100);
  }
}

function closeSongModal() {
  closeModalWithAnimation(songModal, () => {
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
  });
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

async function populateTagSongOptions() {
  const container = el("tag-song-select-container");
  if (!container) return;
  container.innerHTML = "";

  // Get weeks offset to nearest scheduled performance (past or future) for each song
  const weeksSinceMap = await getWeeksSinceLastPerformance();

  // Deduplicate songs by ID (keep first occurrence)
  const seenIds = new Set();
  const uniqueSongs = state.songs.filter(song => {
    if (seenIds.has(song.id)) {
      return false;
    }
    seenIds.add(song.id);
    return true;
  });

  const options = uniqueSongs.map(song => ({
    value: song.id,
    label: song.title,
    meta: {
      bpm: song.bpm,
      key: (song.song_keys || []).map(k => k.key).join(", "),
      timeSignature: song.time_signature,
      duration: song.duration_seconds ? formatDuration(song.duration_seconds) : null,
      weeksSinceLastPerformed: weeksSinceMap.get(song.id)?.diffWeeks ?? null,
    }
  }));

  // Sort by most recently scheduled using the weeks value
  // Upcoming (0, +1, +2, ...) sorted lowest to highest
  // Past (-1, -2, -3, ...) sorted lowest to highest (most recent past first)
  // Unscheduled (null) at the bottom
  options.sort((a, b) => {
    const numA = a.meta.weeksSinceLastPerformed;
    const numB = b.meta.weeksSinceLastPerformed;

    // Both have scheduled dates
    if (numA !== null && numB !== null) {
      // Both upcoming (>= 0): sort ascending (0, 1, 2, 3...)
      if (numA >= 0 && numB >= 0) {
        return numA - numB;
      }
      // Both past (< 0): sort ascending (-1, -2, -3...) which means most recent past first
      if (numA < 0 && numB < 0) {
        return numA - numB;
      }
      // One upcoming, one past: upcoming comes first
      if (numA >= 0 && numB < 0) return -1;
      if (numA < 0 && numB >= 0) return 1;
    }

    // One has date, one doesn't: dated comes first
    if (numA !== null && numB === null) return -1;
    if (numA === null && numB !== null) return 1;

    // Neither has date: sort by title
    return a.label.localeCompare(b.label);
  });

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

  // Focus on first input field for keyboard navigation
  // Try to focus on custom input if visible, otherwise focus will go to first dropdown
  setTimeout(() => {
    const customInputEl = el("tag-custom-input");
    const customLabel = el("tag-custom-label");
    if (customInputEl && customLabel && !customLabel.classList.contains("hidden")) {
      customInputEl.focus();
    } else {
      // Focus on first visible input - try the song select dropdown input
      const songSelectContainer = el("tag-song-select-container");
      const firstInput = songSelectContainer?.querySelector("input");
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, 100);
}

function closeTagModal() {
  const modal = el("tag-modal");
  closeModalWithAnimation(modal, () => {
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
  });
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

  // Focus on first input field for keyboard navigation
  const titleInput = el("section-title");
  if (titleInput) {
    setTimeout(() => titleInput.focus(), 100);
  }
}

function closeSectionModal() {
  closeModalWithAnimation(sectionModal, () => {
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
  });
}

async function openSectionHeaderModal() {
  if (!isManager() || !state.selectedSet) return;
  if (sectionHeaderModal) {
    sectionHeaderModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Focus on first input field for keyboard navigation
    const titleInput = el("section-header-title");
    if (titleInput) {
      setTimeout(() => titleInput.focus(), 100);
    }
  }
}

function closeSectionHeaderModal() {
  if (sectionHeaderModal) {
    closeModalWithAnimation(sectionHeaderModal, () => {
      el("section-header-form")?.reset();
    });
  }
}

function closeHeaderDropdown() {
  const dropdownMenu = el("header-add-dropdown-menu");
  const mobileDropdownMenu = el("mobile-header-add-dropdown-menu");

  const closeWithAnim = (element) => {
    if (element && !element.classList.contains("hidden")) {
      element.classList.add("animate-out");
      setTimeout(() => {
        element.classList.add("hidden");
        element.classList.remove("animate-out");
      }, 250);
    }
  };

  closeWithAnim(dropdownMenu);
  closeWithAnim(mobileDropdownMenu);
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

  // Deduplicate songs by ID (keep first occurrence)
  const seenIds = new Set();
  const uniqueSongs = state.songs.filter(song => {
    if (seenIds.has(song.id)) {
      return false;
    }
    seenIds.add(song.id);
    return true;
  });

  const options = uniqueSongs.map(song => ({
    value: song.id,
    label: song.title,
    meta: {
      bpm: song.bpm,
      key: (song.song_keys || []).map(k => k.key).join(", "),
      timeSignature: song.time_signature,
      duration: song.duration_seconds ? formatDuration(song.duration_seconds) : null,
      durationSeconds: song.duration_seconds || null,
      weeksSinceLastPerformed: weeksSinceMap.get(song.id)?.diffWeeks ?? null,
    }
  }));

  // Sort by most recently scheduled using the weeks value
  // Upcoming (0, +1, +2, ...) sorted lowest to highest
  // Past (-1, -2, -3, ...) sorted lowest to highest (most recent past first)
  // Unscheduled (null) at the bottom
  options.sort((a, b) => {
    const numA = a.meta.weeksSinceLastPerformed;
    const numB = b.meta.weeksSinceLastPerformed;

    // Both have scheduled dates
    if (numA !== null && numB !== null) {
      // Both upcoming (>= 0): sort ascending (0, 1, 2, 3...)
      if (numA >= 0 && numB >= 0) {
        return numA - numB;
      }
      // Both past (< 0): sort ascending (-1, -2, -3...) which means most recent past first
      if (numA < 0 && numB < 0) {
        return numA - numB;
      }
      // One upcoming, one past: upcoming comes first
      if (numA >= 0 && numB < 0) return -1;
      if (numA < 0 && numB >= 0) return 1;
    }

    // One has date, one doesn't: dated comes first
    if (numA !== null && numB === null) return -1;
    if (numA === null && numB !== null) return 1;

    // Neither has date: sort by title
    return a.label.localeCompare(b.label);
  });

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

async function getWeeksSinceLastPerformance(songsToUse = null) {
  const weeksMap = new Map();

  // Use provided songs list, or fall back to state.songs
  // Deduplicate to ensure we don't query for duplicate IDs
  const songs = songsToUse || state.songs;
  if (!songs || songs.length === 0) {
    return weeksMap;
  }

  // Deduplicate by ID before querying
  const seenIds = new Set();
  const uniqueSongs = songs.filter(song => {
    if (!song || !song.id) return false;
    if (seenIds.has(song.id)) {
      return false;
    }
    seenIds.add(song.id);
    return true;
  });

  const songIds = uniqueSongs.map(s => s.id);

  // Query to find all set dates for each song
  const { data, error } = await supabase
    .from("set_songs")
    .select(`
      song_id,
      set:set_id (
        id,
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

        // Prefer keeping the set object reference for the link
        if (dateValue >= now) {
          if (!entry.next || dateValue < entry.next.date) {
            entry.next = { date: dateValue, setId: setData.id };
          }
        } else {
          if (!entry.last || dateValue > entry.last.date) {
            entry.last = { date: dateValue, setId: setData.id };
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
      const diffWeeks = Math.round((entry.next.date.getTime() - now.getTime()) / weekMs);
      const label = diffWeeks > 0 ? `+${diffWeeks}w` : "This week";
      // Use +Xw format as requested (user mentioned + or - count) - actually user said "+ or - recency / upcoming weeks count", e.g. -2w
      // Previous code used +1, +2. I will use +1w, -2w for clarity in the badge, or keep compact +1, -2.
      // The implementation plan proposed keeping label simple but I'll add 'w' for the badge if needed.
      // Actually, let's stick to the numbers for label for now, or just rely on diffWeeks.
      // Wait, renderSongList previously used label. I should check if I should update label format.
      // "a badge that only shows in the relevancy sorting mode for the + or - recency / upcoming weeks count"
      // I'll construct the label here to be display-ready.
      const displayLabel = diffWeeks === 0 ? "This week" : (diffWeeks > 0 ? `+${diffWeeks}w` : `${diffWeeks}w`);

      weeksMap.set(songId, {
        diffWeeks,
        label: displayLabel,
        setId: entry.next.setId,
        type: 'future'
      });
    } else if (entry.last) {
      const diffWeeks = Math.round((now.getTime() - entry.last.date.getTime()) / weekMs);
      // diffWeeks is positive here (weeks ago).
      // We want negative number for sorting logic relative to future? 
      // Wait, original logic:
      // entry.next: diffWeeks > 0 ? `+${diffWeeks}` : "0"
      // entry.last: diffWeeks > 0 ? `-${diffWeeks}` : "0" (weeks ago)

      // I should preserve the signed integer for sorting.
      // For Label: "-2w"

      const weeksAgo = diffWeeks;
      const signedWeeks = -weeksAgo;

      weeksMap.set(songId, {
        diffWeeks: signedWeeks,
        label: weeksAgo === 0 ? "This week" : `-${weeksAgo}w`,
        setId: entry.last.setId,
        type: 'past'
      });
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
      .from(SONG_RESOURCES_TABLE)
      .insert(
        links.map(link => ({
          set_song_id: setSong.id,
          song_id: null,
          title: link.title,
          url: link.url,
          key: link.key || null,
          display_order: link.display_order,
          team_id: state.currentTeamId,
          type: 'link' // Section links are always type='link' (unless we support files? collectSectionLinks doesn't handle files yet maybe?)
          // Wait, collectSectionLinks collects text inputs. Usually plain links.
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
    // Fetch section resources
    const { data: sectionLinksData } = await supabase
      .from(SONG_RESOURCES_TABLE)
      .select("*")
      .eq("set_song_id", setSong.id)
      .order("display_order", { ascending: true });

    // Filter mainly links/files (just in case charts got in there)
    const filteredSectionLinks = (sectionLinksData || []).filter(r => r.type === 'link' || r.type === 'file');
    renderSectionLinks(filteredSectionLinks, "edit-section-links-list");
  } else if (editSectionLinksContainer) {
    editSectionLinksContainer.classList.add("hidden");
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Focus on first visible input field for keyboard navigation
  setTimeout(() => {
    // Try section title first (if visible)
    const sectionTitle = el("edit-section-title");
    if (sectionTitle && sectionFields && !sectionFields.classList.contains("hidden")) {
      sectionTitle.focus();
      return;
    }
    // Try key input (if visible)
    const keyInputEl = el("edit-set-song-key");
    if (keyInputEl && keyLabel && !keyLabel.classList.contains("hidden")) {
      keyInputEl.focus();
      return;
    }
    // Try duration input (if visible)
    if (durationInput && durationLabel && !durationLabel.classList.contains("hidden")) {
      durationInput.focus();
      return;
    }
    // Fallback to notes
    if (notesInput && notesInput.closest("label") && !notesInput.closest("label").classList.contains("hidden")) {
      notesInput.focus();
    }
  }, 100);
}

function closeEditSetSongModal() {
  const modal = el("edit-set-song-modal");
  closeModalWithAnimation(modal, () => {
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
  });
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
    const existingAssignmentById = new Map(
      (existingAssignments || []).map((assignment) => [String(assignment.id), assignment])
    );

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
      const existingAssignment = existingAssignmentById.get(String(assignment.id));
      const existingIdentity = getAssignmentIdentityKeyFromDbRow(existingAssignment);
      const newIdentity = getAssignmentIdentityKeyFromFormAssignment(assignment);
      const shouldPreserveStatus =
        existingIdentity && newIdentity && existingIdentity === newIdentity;
      const statusToUse = shouldPreserveStatus
        ? (existingAssignment?.status || 'pending')
        : 'pending';

      await supabase
        .from("song_assignments")
        .update({
          role: assignment.role,
          person_id: assignment.person_id || null,
          pending_invite_id: assignment.pending_invite_id || null,
          person_name: assignment.person_name || null,
          person_email: assignment.person_email || null,
          // Preserve existing status when identity is unchanged; reset to pending if person changed
          status: statusToUse,
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

    // Get existing resources for this section
    const { data: existingResources } = await supabase
      .from(SONG_RESOURCES_TABLE)
      .select("*")
      .eq("set_song_id", setSongId);

    // Determine which to delete, update, and insert
    // Considering only links/files
    const existingLinks = (existingResources || []).filter(r => r.type === 'link' || r.type === 'file');

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
        .from(SONG_RESOURCES_TABLE)
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
        .from(SONG_RESOURCES_TABLE)
        .update({
          title: link.title,
          url: link.is_file_upload ? null : link.url,
          file_path: link.is_file_upload ? filePath : null,
          file_name: link.is_file_upload ? fileName : null,
          file_type: link.is_file_upload ? fileType : null,
          // type: 'link' or 'file'?
          /* Wait, existingLink has type. If we switch from link to file upload?
             Logic above sets filePath/fileName.
             If link.is_file_upload, type should be 'file'. Else 'link'.
          */
          type: link.is_file_upload ? 'file' : 'link',
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
          team_id: state.currentTeamId,
          type: link.is_file_upload ? 'file' : 'link',
          title: link.title,
          url: link.is_file_upload ? null : link.url,
          file_path: link.is_file_upload ? filePath : null,
          file_name: link.is_file_upload ? fileName : null,
          file_type: link.is_file_upload ? fileType : null,
          is_file_upload: link.is_file_upload, // Note: new table doesn't have is_file_upload column, remove it?
          // We use type='file'/'link'. remove is_file_upload from insert.
          key: link.key || null,
          display_order: link.display_order,
        });
      }

      if (linksToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from(SONG_RESOURCES_TABLE)
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

async function togglePinSet(set, pinBtn) {
  if (!state.profile?.id) {
    toastError("You must be logged in to pin sets");
    return;
  }

  const isPinned = set.is_pinned === true;
  const icon = pinBtn.querySelector("i");

  try {
    if (isPinned) {
      // Unpin: delete from pinned_sets
      const { error } = await supabase
        .from("pinned_sets")
        .delete()
        .eq("user_id", state.profile.id)
        .eq("set_id", set.id);

      if (error) {
        console.error("Error unpinning set:", error);
        toastError("Unable to unpin set. Please try again.");
        return;
      }

      // Update local state
      set.is_pinned = false;
      if (icon) {
        icon.classList.remove("fa-solid", "fa-thumbtack");
        icon.classList.add("fa-regular", "fa-thumbtack");
        pinBtn.title = "Pin set";
        pinBtn.classList.remove("pinned");
      }

      // Track unpin
      trackPostHogEvent('set_unpinned', {
        set_id: set.id,
        team_id: state.currentTeamId
      });

      toastSuccess("Set unpinned");
    } else {
      // Pin: insert into pinned_sets
      const { error } = await supabase
        .from("pinned_sets")
        .insert({
          user_id: state.profile.id,
          set_id: set.id
        });

      if (error) {
        // Handle 409 Conflict (set already pinned) as success
        if (error.code === '409' || error.code === '23505') {
          console.warn("Set was already pinned (409 Conflict), treating as success.");
          // Fall through to success handling
        } else {
          console.error("Error pinning set:", error);
          // If error is due to table not existing, show a helpful message
          if (error.code === 'PGRST116' || error.code === '42P01') {
            toastError("Pinning feature is not available yet. Please run the database migration.");
          } else {
            toastError("Unable to pin set. Please try again.");
          }
          return;
        }
      }

      // Update local state
      set.is_pinned = true;
      if (icon) {
        icon.classList.remove("fa-regular", "fa-thumbtack");
        icon.classList.add("fa-solid", "fa-thumbtack");
        pinBtn.title = "Unpin set";
        pinBtn.classList.add("pinned");
      }

      // Track pin
      trackPostHogEvent('set_pinned', {
        set_id: set.id,
        team_id: state.currentTeamId
      });

      // Update aggregate metrics
      setTimeout(() => sendAggregateMetrics(), 1000);

      toastSuccess("Set pinned");
    }

    // Reload sets to update the "Your Sets" section
    await loadSets();
  } catch (err) {
    console.error("Error toggling pin:", err);
    toastError("An error occurred. Please try again.");
  }
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
      // Delete album art override file if it exists
      if (song?.album_art_override_path) {
        await deleteFileFromSupabase(song.album_art_override_path);
      }

      // Delete all song resource files
      if (song?.song_resources) {
        for (const res of song.song_resources) {
          if (res.type === 'file' && res.file_path) {
            await deleteFileFromSupabase(res.file_path);
          }
        }
      }

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

      // Close edit modal if it's open for this song
      const editModal = el("song-edit-modal");
      const editForm = el("song-edit-form");
      if (editModal && !editModal.classList.contains("hidden") && editForm?.dataset.songId === String(songId)) {
        closeSongEditModal();
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

  // PostHog: Track modal open
  trackPostHogEvent('modal_opened', {
    modal_type: 'add_person_to_team',
    team_id: state.currentTeamId
  });

  // Start tracking time on modal
  startPageTimeTracking('modal_add_person', {
    team_id: state.currentTeamId
  });

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
  closeModalWithAnimation(modal, () => {
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
  });
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

    // PostHog: Track person added (preexisting account)
    trackPostHogEvent('person_added_to_team', {
      team_id: state.currentTeamId,
      user_type: 'preexisting_account',
      person_id: existingProfile.id
    });

    // PostHog: Track modal conversion
    trackPostHogEvent('modal_converted', {
      modal_type: 'add_person_to_team',
      team_id: state.currentTeamId,
      user_type: 'preexisting_account'
    });

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

  // PostHog: Track person added (invite)
  trackPostHogEvent('person_added_to_team', {
    team_id: state.currentTeamId,
    user_type: 'invite',
    email: normalizedEmail
  });

  // PostHog: Track modal conversion
  trackPostHogEvent('modal_converted', {
    modal_type: 'add_person_to_team',
    team_id: state.currentTeamId,
    user_type: 'invite'
  });

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
    closeModalWithAnimation(modal, () => {
      delete modal.dataset.teamId;
      delete modal.dataset.teamName;
    });
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

  // Focus on first input field for keyboard navigation
  const nameInput = el("edit-person-name");
  if (nameInput) {
    setTimeout(() => nameInput.focus(), 100);
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditPersonModal() {
  const modal = el("edit-person-modal");
  if (modal) {
    closeModalWithAnimation(modal, () => {
      el("edit-person-form")?.reset();
      delete el("edit-person-form")?.dataset.personId;
      const emailInput = el("edit-person-email");
      if (emailInput) emailInput.disabled = false;
    });
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
  closeModalWithAnimation(modal);
}

// Async search for content within resources (PDFs)
let activeResourceSearchTerm = null;
let resourceSearchTimeout = null;
let activeResourceSearchAbortController = null; // For cancelling in-flight searches
let currentSearchId = 0; // Incrementing ID to track which search is current

async function searchSongResources(searchTerm, existingResults) {
  const list = el("songs-catalog-list");
  if (!list) return;

  // Cancel any in-flight search immediately
  if (activeResourceSearchAbortController) {
    activeResourceSearchAbortController.abort();
    activeResourceSearchAbortController = null;
  }

  // Increment search ID to invalidate any previous searches
  currentSearchId++;
  const thisSearchId = currentSearchId;

  // Create new abort controller for this search
  const abortController = new AbortController();
  activeResourceSearchAbortController = abortController;

  // Update active search term IMMEDIATELY to prevent race conditions
  const currentSearchTerm = searchTerm;
  activeResourceSearchTerm = currentSearchTerm;

  console.log(`🔍 Starting search #${thisSearchId} for: "${searchTerm}"`);

  // Clear any existing loading indicators from previous searches
  const existingLoadingIndicator = el("resource-search-loading");
  if (existingLoadingIndicator) {
    existingLoadingIndicator.remove();
  }

  console.log(`🔍 Starting resource search for: "${searchTerm}"`);

  // Helper to check if search was aborted or superseded
  const checkAborted = () => {
    if (abortController.signal.aborted ||
      activeResourceSearchTerm !== currentSearchTerm ||
      currentSearchId !== thisSearchId) {
      throw new Error('Search aborted');
    }
  };

  // Create or reuse loading indicator
  let loadingIndicator = el("resource-search-loading");
  if (!loadingIndicator) {
    loadingIndicator = document.createElement("div");
    loadingIndicator.id = "resource-search-loading";
    loadingIndicator.className = "resource-search-loading";
    loadingIndicator.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Searching metadata and files...';
    list.appendChild(loadingIndicator);
  } else {
    // Move to bottom
    list.appendChild(loadingIndicator);
    loadingIndicator.classList.remove("hidden");
  }

  // Parse iTunes metadata filters from search term
  const itunesMetadata = parseItunesMetadataQuery(searchTerm);
  const hasItunesFilters = Object.keys(itunesMetadata.filters).length > 0;
  const searchTextForResources = itunesMetadata.text || searchTerm;

  // Filter songs to check:
  // 1. Not already in existingResults
  // 2. Have any links (since we check titles or PDFs)
  const existingIds = new Set(existingResults.map(s => s.id));
  const candidateSongs = state.songs.filter(song => {
    if (existingIds.has(song.id)) return false;
    const resources = song.song_resources || [];
    return resources.length > 0;
  });

  console.log(`🔍 Deep search: Checking ${candidateSongs.length} candidate songs for "${searchTerm}"`);

  // Track songs that matched via iTunes metadata search
  const itunesMatchedSongIds = new Set();

  // Track songs already added to prevent duplicates when typing fast
  const addedSongIds = new Set();

  // Helper to check if song is already in the list
  const isSongAlreadyAdded = (songId) => {
    // Check if already tracked in this search session
    if (addedSongIds.has(songId)) return true;

    // Check if already in the DOM
    const existingCard = Array.from(list.children).find(child => {
      const viewBtn = child.querySelector(`[data-song-id="${songId}"]`);
      return viewBtn !== null;
    });

    if (existingCard) {
      addedSongIds.add(songId);
      return true;
    }

    return false;
  };

  // Process songs in chunks to avoid blocking UI too much
  for (const song of candidateSongs) {
    // Stop if search was aborted or term changed
    try {
      checkAborted();
    } catch (e) {
      console.log('🛑 Deep search aborted: search cancelled');
      return;
    }

    // Early duplicate check - before doing any async work
    if (isSongAlreadyAdded(song.id)) {
      continue; // Skip to next song
    }

    let matchFound = false;
    let resourceMatchContext = "";
    let itunesMatchContext = "";
    let isLinkTitleMatch = false;

    const resources = song.song_resources || [];

    // 1. Check Link Titles (charts, files, links)
    for (const res of resources) {
      if ((res.title || "").toLowerCase().includes(searchTextForResources.toLowerCase())) {
        matchFound = true;
        isLinkTitleMatch = true;
        resourceMatchContext = `${res.type === 'chart' ? 'Chart' : 'Link'}: ${highlightMatch(res.title, searchTextForResources)}`;
        break;
      }
    }

    // 2. Check PDF Content (if no title match yet)
    if (!matchFound) {
      const pdfLinks = resources.filter(res =>
        (res.type === 'file' && res.file_type === 'application/pdf') ||
        (res.url?.toLowerCase().endsWith('.pdf') && res.type === 'link')
      );

      for (const link of pdfLinks) {
        if (matchFound) break;

        try {
          const text = await extractTextFromPdf(link.url);
          if (text && text.toLowerCase().includes(searchTextForResources.toLowerCase())) {
            matchFound = true;
            // Find a snippet for context
            const index = text.toLowerCase().indexOf(searchTextForResources.toLowerCase());
            const start = Math.max(0, index - 20);
            const end = Math.min(text.length, index + searchTextForResources.length + 20);
            resourceMatchContext = "..." + highlightMatch(text.substring(start, end), searchTextForResources) + "...";
          }
        } catch (err) {
          console.warn(`⚠️ Failed to parse PDF for song ${song.title}:`, err);
        }
      }
    }

    // 3. Check iTunes Metadata (always check if we have iTunes filters or search text, even if resource match found)
    if ((hasItunesFilters || searchTextForResources)) {
      // Stop if search was aborted
      try {
        checkAborted();
      } catch (e) {
        console.log('🛑 iTunes check aborted: search cancelled');
        return;
      }

      try {
        // Get iTunes metadata from database (or fall back to API if not indexed)
        const itunesItem = await getItunesMetadataForSong(song);

        if (itunesItem) {
          // Check if this result matches our search filters (if any)
          let matchesFilters = true;

          if (itunesMetadata.filters.genre) {
            const genreMatch = (itunesItem.primaryGenreName || '').toLowerCase().includes(itunesMetadata.filters.genre.toLowerCase()) ||
              (itunesItem.genres || []).some(g => g.toLowerCase().includes(itunesMetadata.filters.genre.toLowerCase()));
            if (!genreMatch) matchesFilters = false;
          }

          if (itunesMetadata.filters.album && matchesFilters) {
            const albumMatch = (itunesItem.collectionName || '').toLowerCase().includes(itunesMetadata.filters.album.toLowerCase());
            if (!albumMatch) matchesFilters = false;
          }

          if (itunesMetadata.filters.artist && matchesFilters) {
            const artistMatch = (itunesItem.artistName || '').toLowerCase().includes(itunesMetadata.filters.artist.toLowerCase());
            if (!artistMatch) matchesFilters = false;
          }

          if (itunesMetadata.filters.releaseDate && matchesFilters) {
            const targetYear = itunesMetadata.filters.releaseDate.split('-')[0];
            if (itunesItem.releaseDate) {
              const itemYear = new Date(itunesItem.releaseDate).getFullYear().toString();
              const dateMatch = itunesItem.releaseDate.startsWith(itunesMetadata.filters.releaseDate) || itemYear === targetYear;
              if (!dateMatch) matchesFilters = false;
            } else {
              matchesFilters = false;
            }
          }

          // Also check if search text matches (if no specific filters)
          // Always check if iTunes actually matches, regardless of whether we have a resource match
          if (matchesFilters && (!hasItunesFilters || searchTextForResources)) {
            // If we have filters, they've already been checked above
            // If we only have search text, check if it matches any metadata field
            // Always check this, even if we already have a resource match
            if (!hasItunesFilters && searchTextForResources) {
              const searchLower = searchTextForResources.toLowerCase();
              const matchesText =
                (itunesItem.trackName || '').toLowerCase().includes(searchLower) ||
                (itunesItem.artistName || '').toLowerCase().includes(searchLower) ||
                (itunesItem.collectionName || '').toLowerCase().includes(searchLower) ||
                (itunesItem.primaryGenreName || '').toLowerCase().includes(searchLower);
              if (!matchesText) matchesFilters = false;
            }
          }

          // Only show iTunes metadata if iTunes actually matched
          if (matchesFilters) {
            // Mark as iTunes match
            itunesMatchedSongIds.add(song.id);

            // Build iTunes match context
            const contextParts = [];
            if (itunesItem.artistName) {
              contextParts.push(`Artist: ${highlightMatch(itunesItem.artistName, itunesMetadata.filters.artist || searchTextForResources)}`);
            }
            if (itunesItem.collectionName) {
              contextParts.push(`Album: ${highlightMatch(itunesItem.collectionName, itunesMetadata.filters.album || searchTextForResources)}`);
            }
            if (itunesItem.primaryGenreName) {
              contextParts.push(`Genre: ${highlightMatch(itunesItem.primaryGenreName, itunesMetadata.filters.genre || searchTextForResources)}`);
            }
            if (itunesItem.releaseDate) {
              const releaseDate = new Date(itunesItem.releaseDate).getFullYear();
              contextParts.push(`Released: ${releaseDate}`);
            }

            itunesMatchContext = contextParts.length > 0
              ? `iTunes: ${contextParts.join(', ')}`
              : 'iTunes metadata match';

            // If no resource match yet, mark as found
            if (!matchFound) {
              matchFound = true;
            }
            // Note: we keep resourceMatchContext and itunesMatchContext separate for better rendering
          }
        }
      } catch (err) {
        console.warn(`⚠️ Failed to search iTunes metadata for song ${song.title}:`, err);
      }
    }

    // Display match if found (from PDFs, links, or iTunes)
    if (matchFound) {
      // Final check: verify this search is still current before adding to DOM
      if (currentSearchId !== thisSearchId ||
        activeResourceSearchTerm !== currentSearchTerm ||
        abortController.signal.aborted) {
        console.log(`🛑 Skipping match display - search #${thisSearchId} is no longer current (current: #${currentSearchId})`);
        continue; // Skip this song, continue to next
      }

      // Double-check for duplicates (in case async operations completed in parallel)
      if (isSongAlreadyAdded(song.id)) {
        console.log(`⏭️ Skipping duplicate song: ${song.title} (${song.id})`);
        continue; // Skip to next song
      }

      // Mark as added BEFORE adding to DOM to prevent race conditions
      addedSongIds.add(song.id);

      // Remove "No songs match" message if it exists
      const noSongsMsg = Array.from(list.children).find(child => child.tagName === 'P' && child.textContent.includes("No songs match"));
      if (noSongsMsg) {
        noSongsMsg.remove();
      }

      // Append song card
      const div = document.createElement("div");
      div.className = "card set-song-card fade-in";

      // Highlight search term in title (even though it didn't match title, we show it)
      const highlightedTitle = escapeHtml(song.title || "");
      const highlightedBpm = song.bpm ? `<span>BPM: ${song.bpm}</span>` : '';
      const keysSet = new Set((song.song_keys || []).map(k => k.key).filter(Boolean));
      const keys = Array.from(keysSet).join(", ");
      const highlightedKey = keys ? `<span>Key: ${keys}</span>` : '';
      const highlightedTime = song.time_signature ? `<span>Time: ${escapeHtml(song.time_signature)}</span>` : '';
      const durationStr = song.duration_seconds ? formatDuration(song.duration_seconds) : '';
      const highlightedDuration = durationStr ? `<span>Duration: ${durationStr}</span>` : '';

      const isItunesMatch = itunesMatchedSongIds.has(song.id);
      // Check if there's a resource match (link title or PDF content)
      const hasResourceMatch = isLinkTitleMatch || !!resourceMatchContext;

      // Determine badge - prioritize resource matches, but show both if applicable
      let badgeIcon, badgeText;
      if (isLinkTitleMatch) {
        badgeIcon = 'fa-link';
        badgeText = isItunesMatch ? 'Link & iTunes Match' : 'Link Match';
      } else if (hasResourceMatch) {
        badgeIcon = 'fa-file-pdf';
        badgeText = isItunesMatch ? 'Content & iTunes Match' : 'Content Match';
      } else if (isItunesMatch) {
        badgeIcon = 'fa-music';
        badgeText = 'iTunes Match';
      } else {
        badgeIcon = 'fa-file-pdf';
        badgeText = 'Match';
      }

      // Build match context HTML - separate sections for resource and iTunes matches
      let matchContextHtml = '';
      if (hasResourceMatch && isItunesMatch) {
        // Both matches - show in separate sections
        matchContextHtml = `
          <div class="song-match-context">
            <small class="muted">${resourceMatchContext}</small>
          </div>
          <div class="song-match-context" style="margin-top: 0.5rem;">
            <small class="muted">${itunesMatchContext}</small>
          </div>
        `;
      } else if (hasResourceMatch) {
        // Only resource match
        matchContextHtml = `
          <div class="song-match-context">
            <small class="muted">${resourceMatchContext}</small>
          </div>
        `;
      } else if (isItunesMatch) {
        // Only iTunes match
        matchContextHtml = `
          <div class="song-match-context">
            <small class="muted">${itunesMatchContext}</small>
          </div>
        `;
      }

      div.innerHTML = `
        <div class="set-song-header song-card-header">
          <div class="set-song-info">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <h4 class="song-title" style="margin: 0;">${highlightedTitle}</h4>
              <span class="badge-resource-match"><i class="fa-solid ${badgeIcon}"></i> ${badgeText}</span>
            </div>
            <div class="song-meta-text">
              ${highlightedBpm}
              ${highlightedKey}
              ${highlightedTime}
              ${highlightedDuration}
            </div>
            ${matchContextHtml}
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

      // Attach event listeners
      const viewDetailsBtn = div.querySelector(".view-song-details-catalog-btn");
      if (viewDetailsBtn) {
        viewDetailsBtn.addEventListener("click", () => {
          openSongDetailsModal(song);
        });
      }

      const editBtn = div.querySelector(".edit-song-btn");
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          console.log('Edit button clicked for song:', song.id);
          openSongEditModal(song.id);
        });
      }

      const deleteBtn = div.querySelector(".delete-song-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          deleteSong(song.id);
        });
      }

      // Insert before loading indicator
      list.insertBefore(div, loadingIndicator);
    }
  }

  // Also search iTunes metadata for songs (both with and without links)
  // For each song, get iTunes metadata by song title, then filter by search term
  // Always run iTunes search if we have search text
  // Double-check this search is still current before starting iTunes search
  if (activeResourceSearchTerm === currentSearchTerm &&
    currentSearchId === thisSearchId &&
    searchTextForResources &&
    searchTextForResources.trim()) {
    console.log(`🎵 Starting iTunes metadata search (#${thisSearchId}) for: "${searchTextForResources}"`);
    // Get all songs that haven't been matched yet (both with and without links)
    const unmatchedSongs = state.songs.filter(song => {
      if (existingIds.has(song.id)) return false;
      if (itunesMatchedSongIds.has(song.id)) return false;
      if (addedSongIds.has(song.id)) return false;
      return song.title; // Only songs with titles
    });

    console.log(`🎵 Checking iTunes metadata for ${unmatchedSongs.length} unmatched songs with search: "${searchTextForResources}"`);

    // For each unmatched song, get iTunes metadata by song title, then filter by search term
    for (const song of unmatchedSongs) {
      // Stop if search was aborted
      try {
        checkAborted();
      } catch (e) {
        console.log('🛑 iTunes metadata search aborted: search cancelled');
        break;
      }

      try {
        // Get iTunes metadata from database (or fall back to API if not indexed)
        const itunesItem = await getItunesMetadataForSong(song);

        if (itunesItem) {
          // Now filter by search term - check if search text matches iTunes metadata
          let matchesSearch = false;

          // Check explicit filters first
          if (hasItunesFilters) {
            let matchesFilters = true;

            if (itunesMetadata.filters.genre) {
              const genreMatch = (itunesItem.primaryGenreName || '').toLowerCase().includes(itunesMetadata.filters.genre.toLowerCase()) ||
                (itunesItem.genres || []).some(g => g.toLowerCase().includes(itunesMetadata.filters.genre.toLowerCase()));
              if (!genreMatch) matchesFilters = false;
            }

            if (itunesMetadata.filters.album && matchesFilters) {
              const albumMatch = (itunesItem.collectionName || '').toLowerCase().includes(itunesMetadata.filters.album.toLowerCase());
              if (!albumMatch) matchesFilters = false;
            }

            if (itunesMetadata.filters.artist && matchesFilters) {
              const artistMatch = (itunesItem.artistName || '').toLowerCase().includes(itunesMetadata.filters.artist.toLowerCase());
              if (!artistMatch) matchesFilters = false;
            }

            if (itunesMetadata.filters.releaseDate && matchesFilters) {
              const targetYear = itunesMetadata.filters.releaseDate.split('-')[0];
              if (itunesItem.releaseDate) {
                const itemYear = new Date(itunesItem.releaseDate).getFullYear().toString();
                const dateMatch = itunesItem.releaseDate.startsWith(itunesMetadata.filters.releaseDate) || itemYear === targetYear;
                if (!dateMatch) matchesFilters = false;
              } else {
                matchesFilters = false;
              }
            }

            matchesSearch = matchesFilters;
          }

          // If no explicit filters, check if search text matches any metadata field
          // This is the key: we search iTunes by song title, then filter by checking if
          // the user's search term matches the album, artist, genre, etc. from iTunes metadata
          if (!hasItunesFilters && searchTextForResources) {
            const searchLower = searchTextForResources.toLowerCase().trim();
            const albumName = (itunesItem.collectionName || '').toLowerCase();
            const artistName = (itunesItem.artistName || '').toLowerCase();
            const genreName = (itunesItem.primaryGenreName || '').toLowerCase();
            const trackName = (itunesItem.trackName || '').toLowerCase();

            // Check if search text matches album name (most common case - searching for album)
            // Also check artist and genre
            matchesSearch =
              albumName.includes(searchLower) ||
              artistName.includes(searchLower) ||
              genreName.includes(searchLower) ||
              trackName.includes(searchLower);

            console.log(`🎵 Checking "${song.title}": album="${albumName}", search="${searchLower}", match=${matchesSearch}`);
          }

          if (matchesSearch) {
            // Mark as iTunes match
            itunesMatchedSongIds.add(song.id);

            // Build match context
            const contextParts = [];
            if (itunesItem.artistName) {
              contextParts.push(`Artist: ${highlightMatch(itunesItem.artistName, itunesMetadata.filters.artist || searchTextForResources)}`);
            }
            if (itunesItem.collectionName) {
              contextParts.push(`Album: ${highlightMatch(itunesItem.collectionName, itunesMetadata.filters.album || searchTextForResources)}`);
            }
            if (itunesItem.primaryGenreName) {
              contextParts.push(`Genre: ${highlightMatch(itunesItem.primaryGenreName, itunesMetadata.filters.genre || searchTextForResources)}`);
            }
            if (itunesItem.releaseDate) {
              const releaseDate = new Date(itunesItem.releaseDate).getFullYear();
              contextParts.push(`Released: ${releaseDate}`);
            }

            const matchContext = contextParts.length > 0
              ? `iTunes: ${contextParts.join(', ')}`
              : 'iTunes metadata match';

            // Final check: verify this search is still current before adding to DOM
            // This prevents old searches from adding results even if they complete late
            if (currentSearchId !== thisSearchId ||
              activeResourceSearchTerm !== currentSearchTerm ||
              abortController.signal.aborted) {
              console.log(`🛑 Skipping song addition - search #${thisSearchId} is no longer current (current: #${currentSearchId})`);
              break;
            }

            // Check for duplicates
            if (isSongAlreadyAdded(song.id)) {
              console.log(`⏭️ Skipping duplicate song (iTunes match): ${song.title} (${song.id})`);
              continue;
            }

            // Mark as added BEFORE adding to DOM to prevent race conditions
            addedSongIds.add(song.id);

            // Remove "No songs match" message if it exists
            const noSongsMsg = Array.from(list.children).find(child => child.tagName === 'P' && child.textContent.includes("No songs match"));
            if (noSongsMsg) {
              noSongsMsg.remove();
            }

            // Create and append song card
            const div = document.createElement("div");
            div.className = "card set-song-card fade-in";

            const highlightedTitle = escapeHtml(song.title || "");
            const highlightedBpm = song.bpm ? `<span>BPM: ${song.bpm}</span>` : '';
            const keysSet = new Set((song.song_keys || []).map(k => k.key).filter(Boolean));
            const keys = Array.from(keysSet).join(", ");
            const highlightedKey = keys ? `<span>Key: ${keys}</span>` : '';
            const highlightedTime = song.time_signature ? `<span>Time: ${escapeHtml(song.time_signature)}</span>` : '';
            const durationStr = song.duration_seconds ? formatDuration(song.duration_seconds) : '';
            const highlightedDuration = durationStr ? `<span>Duration: ${durationStr}</span>` : '';

            div.innerHTML = `
              <div class="set-song-header song-card-header">
                <div class="set-song-info">
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <h4 class="song-title" style="margin: 0;">${highlightedTitle}</h4>
                    <span class="badge-resource-match"><i class="fa-solid fa-music"></i> iTunes Match</span>
                  </div>
                  <div class="song-meta-text">
                    ${highlightedBpm}
                    ${highlightedKey}
                    ${highlightedTime}
                    ${highlightedDuration}
                  </div>
                  <div class="song-match-context">
                    <small class="muted">${matchContext}</small>
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

            // Attach event listeners
            const viewDetailsBtn = div.querySelector(".view-song-details-catalog-btn");
            if (viewDetailsBtn) {
              viewDetailsBtn.addEventListener("click", () => {
                openSongDetailsModal(song);
              });
            }

            const editBtn = div.querySelector(".edit-song-btn");
            if (editBtn) {
              editBtn.addEventListener("click", () => {
                console.log('Edit button clicked for song:', song.id);
                openSongEditModal(song.id);
              });
            }

            const deleteBtn = div.querySelector(".delete-song-btn");
            if (deleteBtn) {
              deleteBtn.addEventListener("click", () => {
                deleteSong(song.id);
              });
            }

            // Insert before loading indicator
            list.insertBefore(div, loadingIndicator);
          }
        }
      } catch (err) {
        console.warn(`⚠️ Failed to check iTunes metadata for song ${song.title}:`, err);
      }
    }
  }

  // Hide loading indicator when done
  if (activeResourceSearchTerm === currentSearchTerm) {
    if (loadingIndicator) loadingIndicator.classList.add("hidden");
  }
}

// Helper to extract text from PDF URL
async function extractTextFromPdf(url) {
  try {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    let fullText = "";

    // Limit pages to avoid performance issues (e.g., first 5 pages)
    const maxPages = Math.min(pdf.numPages, 5);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ");
      fullText += pageText + " ";
    }
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return "";
  }
}

// Advanced Search Parsing and Filtering
function parseSearchQuery(query) {
  const filters = {};

  // Regex for extracting key:value pairs
  // Matches: word: followed by non-space characters or quoted string
  const regex = /(\w+):(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;

  let match;
  while ((match = regex.exec(query)) !== null) {
    const key = match[1].toLowerCase();
    const value = (match[2] || match[3] || match[4] || "").toLowerCase();

    // Map keys to standard filter names
    switch (key) {
      case 'key':
        filters.key = value;
        break;
      case 'time':
      case 'ts':
      case 'signature':
      case 'timesignature':
        filters.time_signature = value;
        break;
      case 'bpm':
        filters.bpm = value;
        break;
      case 'duration':
      case 'length':
        filters.duration = value;
        break;

    }
  }

  // Remove the matches from the text to get residual search terms
  const text = query.replace(regex, "").replace(/\s+/g, " ").trim();

  return { filters, text };
}

function filterSongs(songs, queryRaw) {
  if (!queryRaw) return songs;

  const { filters, text } = parseSearchQuery(queryRaw);
  const textLower = text.toLowerCase();

  return songs.filter(song => {
    // 1. Check Filters
    if (filters.key) {
      // Collect all keys for the song (main key + song_keys array)
      const songKeys = new Set();
      if (song.song_key) songKeys.add(song.song_key.toLowerCase());
      if (song.song_keys && Array.isArray(song.song_keys)) {
        song.song_keys.forEach(k => {
          if (k.key) songKeys.add(k.key.toLowerCase());
        });
      }

      // Check if any of the song's keys match the filter
      if (!songKeys.has(filters.key)) return false;
    }

    if (filters.time_signature) {
      if (!song.time_signature || song.time_signature.toLowerCase() !== filters.time_signature) return false;
    }

    if (filters.bpm) {
      // String comparison for BPM
      if (!song.bpm || String(song.bpm) !== filters.bpm) return false;
    }

    if (filters.duration) {
      // Fuzzy match on formatted string
      const dStr = song.duration_seconds ? formatDuration(song.duration_seconds) : "";
      if (!dStr.includes(filters.duration)) return false;
    }



    // 2. Check Text (if any residual text)
    if (textLower) {
      const titleMatch = (song.title || "").toLowerCase().includes(textLower);

      // Also match metadata if no specific filter forced it out, 
      // BUT typical behavior for "key:C text" is "key IS C AND text matches title/meta"
      // So we continue to check other fields for the text portion

      const bpmMatch = song.bpm ? String(song.bpm).includes(textLower) : false;
      const keyList = [
        song.song_key || "",
        ...(song.song_keys || []).map(k => k.key || "")
      ].filter(Boolean).join(" ").toLowerCase();
      const keyMatch = keyList.includes(textLower);

      const timeMatch = (song.time_signature || "").toLowerCase().includes(textLower);
      const durationMatch = song.duration_seconds ? formatDuration(song.duration_seconds).toLowerCase().includes(textLower) : false;

      return titleMatch || bpmMatch || keyMatch || timeMatch || durationMatch;
    }

    return true;
  });
}

// Track the latest scan request to prevent race conditions
let currentSongRenderId = 0;

async function renderSongCatalog(animate = true) {
  const list = el("songs-catalog-list");
  if (!list) return;

  // Increment render ID and capture it - MUST be at the top to invalidate previous async runs
  const thisRenderId = ++currentSongRenderId;

  // Deduplicate state.songs by ID first (keep first occurrence) to ensure no duplicates
  // Do this IMMEDIATELY and update state to prevent race conditions
  const seenSongIds = new Set();
  const deduplicatedSongs = (state.songs || []).filter(song => {
    if (!song || !song.id) return false; // Filter out invalid entries
    if (seenSongIds.has(song.id)) {
      return false;
    }
    seenSongIds.add(song.id);
    return true;
  });

  // Update state immediately with deduplicated songs
  state.songs = deduplicatedSongs;

  // Create a snapshot of songs to work with (prevents race conditions during async operations)
  const songsSnapshot = [...deduplicatedSongs];

  const searchInput = el("songs-tab-search");
  const searchTermRaw = searchInput ? searchInput.value.trim() : "";

  // Parse for highlighting purposes (we only highlight the residual text, OR the specific fielded values if we wanted to get fancy)
  // For now, let's keep highlighting simple: highlight the residual text matches.
  // OR, we can continue to highlight everything if it matches the raw string, but that might be confusing with filters.
  // Let's parse it to get the 'text' part for general highlighting.
  const { text: searchTerm } = parseSearchQuery(searchTermRaw);
  const searchTermLower = searchTerm.toLowerCase();

  // Cancel any active async search immediately
  activeResourceSearchTerm = searchTerm; // Use parsed text for resource search? Or whole query? 
  // If user types "key:C love", we probably only want to async search for "love".
  // If user only types "key:C", search term is empty, we shouldn't async search for empty string.

  list.innerHTML = "";

  if (state.isLoadingSongs && songsSnapshot.length === 0) {
    list.innerHTML = getSkeletonLoader(4, 'row');
    return;
  }

  if (!songsSnapshot || songsSnapshot.length === 0) {
    list.innerHTML = '<p class="muted">No songs yet. Create your first song!</p>';
    return;
  }

  // Filter songs using new Logic - use snapshot to prevent race conditions
  let filteredSongs = filterSongs(songsSnapshot, searchTermRaw);

  if (filteredSongs.length === 0) {
    list.innerHTML = '<p class="muted">No songs match your search.</p>';
    // Only search resources if there is an actual text term remaining
    if (searchTerm) {
      searchSongResources(searchTerm, []);
    }
    return;
  }

  // Deduplicate songs by ID (keep first occurrence)
  const seenIds = new Set();
  filteredSongs = filteredSongs.filter(song => {
    if (seenIds.has(song.id)) {
      return false;
    }
    seenIds.add(song.id);
    return true;
  });

  // Sort based on selected option
  const sortOption = state.songSortOption || "relevancy";
  let weeksSinceMap = null;

  if (sortOption === "relevancy") {
    // Get weeks since last performance map
    // Pass the deduplicated snapshot to ensure we don't query for duplicates
    weeksSinceMap = await getWeeksSinceLastPerformance(filteredSongs);

    // If a newer render has started, abort this one
    if (thisRenderId !== currentSongRenderId) {
      console.log(`🚫 renderSongCatalog aborted (stale: ${thisRenderId} vs ${currentSongRenderId})`);
      return;
    }

    // 1. Identify "New" songs (created within last 5 days)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const newSongs = [];
    const otherSongs = [];

    filteredSongs.forEach(song => {
      const createdAt = song.created_at ? new Date(song.created_at) : new Date(0);
      if (createdAt > fiveDaysAgo) {
        newSongs.push(song);
      } else {
        otherSongs.push(song);
      }
    });

    // 2. Sort "New" songs by created_at descending (newest first)
    newSongs.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    // 3. Extract top 3 "New" songs to boost
    const boostedSongs = newSongs.slice(0, 3);
    const remainingNewSongs = newSongs.slice(3);

    // Add remaining new songs back to otherSongs for standard sorting
    otherSongs.push(...remainingNewSongs);

    // 4. Sort otherSongs by most recently scheduled using the weeks value
    otherSongs.sort((a, b) => {
      const infoA = weeksSinceMap.get(a.id);
      const infoB = weeksSinceMap.get(b.id);

      const numA = infoA ? infoA.diffWeeks : null;
      const numB = infoB ? infoB.diffWeeks : null;

      // Both have scheduled dates
      if (numA !== null && numB !== null) {
        // Both upcoming (>= 0): sort ascending (0, 1, 2, 3...)
        if (numA >= 0 && numB >= 0) {
          return numA - numB;
        }
        // Both past (< 0): sort ascending (-1, -2, -3...) which means most recent past first
        if (numA < 0 && numB < 0) {
          return numA - numB;
        }
        // One upcoming, one past: upcoming comes first
        if (numA >= 0 && numB < 0) return -1;
        if (numA < 0 && numB >= 0) return 1;
      }

      // One has date, one doesn't: dated comes first
      if (numA !== null && numB === null) return -1;
      if (numA === null && numB !== null) return 1;

      // Neither has date: sort by title
      return (a.title || "").localeCompare(b.title || "");
    });

    // 5. Concatenate: Boosted New Songs + Sorted Other Songs
    filteredSongs = [...boostedSongs, ...otherSongs];
  } else if (sortOption === "newest") {
    // Sort by created_at descending (newest first)
    filteredSongs.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } else if (sortOption === "oldest") {
    // Sort by created_at ascending (oldest first)
    filteredSongs.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  } else if (sortOption === "alphabetical") {
    // Sort alphabetically by title
    filteredSongs.sort((a, b) => {
      return (a.title || "").localeCompare(b.title || "");
    });
  }

  filteredSongs.forEach((song, index) => {
    const div = document.createElement("div");
    div.className = "card set-song-card";

    if (animate) {
      div.classList.add("ripple-item");
      div.style.animationDelay = `${index * 0.03}s`;
    }

    // Highlight search term in title and metadata (use residual search term for highlighting)
    const highlightedTitle = searchTerm ? highlightMatch(song.title || "", searchTerm) : escapeHtml(song.title || "");

    // For specific fields, only highlight if the residual text matches them (standard behavior)
    // We COULD highlight them if the filter matched them (e.g. key:C highlights C), but that requires more complex logic.
    // Sticking to standard highlighting of the residual text.

    const bpmStr = String(song.bpm || "");
    let highlightedBpm = "";
    if (bpmStr) {
      highlightedBpm = searchTerm && bpmStr.includes(searchTerm) ? `<span>BPM: ${highlightMatch(bpmStr, searchTerm)}</span>` : `<span>BPM: ${bpmStr}</span>`;
    } else if (song.suggested_bpm) {
      highlightedBpm = `<span style="color: var(--text-muted); font-style: italic;" title="Suggested BPM">BPM: ${song.suggested_bpm}</span>`;
    }

    // Only use keys from the song itself (song_keys relationship), remove duplicates
    const keysSet = new Set((song.song_keys || []).map(k => k.key).filter(Boolean));
    const keys = Array.from(keysSet).join(", ");
    let highlightedKey = "";
    if (keys) {
      highlightedKey = searchTerm && keys.toLowerCase().includes(searchTermLower) ? `<span>Key: ${highlightMatch(keys, searchTerm)}</span>` : `<span>Key: ${keys}</span>`;
    } else if (song.suggested_song_key) {
      highlightedKey = `<span style="color: var(--text-muted); font-style: italic;" title="Suggested Key">Key: ${song.suggested_song_key}</span>`;
    }

    const timeStr = song.time_signature || "";
    let highlightedTime = "";
    if (timeStr) {
      highlightedTime = searchTerm && timeStr.toLowerCase().includes(searchTermLower) ? `<span>Time: ${highlightMatch(timeStr, searchTerm)}</span>` : `<span>Time: ${escapeHtml(timeStr)}</span>`;
    } else if (song.suggested_time_signature) {
      highlightedTime = `<span style="color: var(--text-muted); font-style: italic;" title="Suggested Time Signature">Time: ${song.suggested_time_signature}</span>`;
    }

    const durationStr = song.duration_seconds ? formatDuration(song.duration_seconds) : '';
    let highlightedDuration = "";
    if (durationStr) {
      highlightedDuration = searchTerm && durationStr.toLowerCase().includes(searchTermLower) ? `<span>Duration: ${highlightMatch(durationStr, searchTerm)}</span>` : `<span>Duration: ${durationStr}</span>`;
    } else if (song.suggested_duration) {
      const suggDur = formatDuration(song.suggested_duration);
      highlightedDuration = `<span style="color: var(--text-muted); font-style: italic;" title="Suggested Duration">Duration: ${suggDur}</span>`;
    }

    div.innerHTML = `
      <div class="set-song-header song-card-header">
        <div class="set-song-info">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <h4 class="song-title" style="margin: 0;">${highlightedTitle}</h4>
            ${(() => {
        // Check if song is "New" (created within last 5 days)
        const createdAt = song.created_at ? new Date(song.created_at) : new Date(0);
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        let html = '';
        if (createdAt > fiveDaysAgo) {
          html += `<span class="badge-new" style="background-color: var(--accent-color); color: var(--bg-primary); padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; letter-spacing: 0.5px; margin-right: 6px;">NEW</span>`;
        }

        if (sortOption === 'relevancy' && weeksSinceMap) {
          const info = weeksSinceMap.get(song.id);
          if (info && info.label) {
            html += `<span class="badge-relevancy" data-set-id="${info.setId || ''}" style="cursor: pointer; background-color: var(--bg-tertiary); color: var(--text-main); padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; letter-spacing: 0.5px;" title="Click to view set">${info.label}</span>`;
          }
        }
        return html;
      })()}
          </div>
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
        </div >
      </div >
  `;

    const viewDetailsBtn = div.querySelector(".view-song-details-catalog-btn");
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener("click", () => {
        openSongDetailsModal(song);
      });
    }

    const relevancyBadge = div.querySelector(".badge-relevancy");
    if (relevancyBadge) {
      relevancyBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const setId = relevancyBadge.dataset.setId;
        if (setId) {
          const set = state.sets.find(s => String(s.id) === String(setId));
          if (set) {
            showSetDetail(set);
          }
        }
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

  // Trigger async search for content (debounced)
  // Clear any pending search to prevent duplicate results when typing fast
  if (resourceSearchTimeout) {
    clearTimeout(resourceSearchTimeout);
    resourceSearchTimeout = null;
  }

  // Cancel any active search immediately
  if (activeResourceSearchAbortController) {
    activeResourceSearchAbortController.abort();
    activeResourceSearchAbortController = null;
  }

  // Also cancel any active search by updating the active term
  // This prevents old searches from completing and adding results
  activeResourceSearchTerm = null;

  if (searchTerm) {
    resourceSearchTimeout = setTimeout(() => {
      // Double-check this is still the current search term before starting
      const searchInput = el("songs-tab-search");
      const currentSearch = searchInput ? searchInput.value.trim() : "";
      if (currentSearch === searchTerm && currentSearch.length > 0) {
        console.log(`⏱️ Debounce complete, starting search for: "${searchTerm}"`);
        searchSongResources(searchTerm, filteredSongs);
      } else {
        console.log(`⏭️ Skipping search - term changed: "${searchTerm}" -> "${currentSearch}"`);
      }
    }, 1000); // Increased to 1000ms (1 second) to wait longer when typing fast
  }
}

async function openSongEditModal(songId = null) {
  if (!isManager()) return;
  const modal = el("song-edit-modal");
  const title = el("song-edit-modal-title");
  const form = el("song-edit-form");

  // Check if song modal is already open (for stacking)
  const songModalOpen = !el("song-modal").classList.contains("hidden");

  // Show modal immediately to ensure responsiveness
  modal.classList.remove("hidden");

  // Reset attribution visibility
  const attributionEl = el('getsongbpm-attribution');
  if (attributionEl) attributionEl.style.display = 'none';

  // PostHog: Track modal open
  trackPostHogEvent('modal_opened', {
    modal_type: songId ? 'edit_song' : 'new_song',
    team_id: state.currentTeamId
  });

  // Start tracking time on modal
  startPageTimeTracking('modal_edit_song', {
    modal_type: songId ? 'edit_song' : 'new_song',
    song_id: songId,
    team_id: state.currentTeamId
  });
  // Only set body overflow if song modal isn't already open
  if (!songModalOpen) {
    document.body.style.overflow = "hidden";
  }

  // Show/hide delete button based on whether we're editing or creating
  const deleteBtn = el("delete-song-from-edit-modal");
  if (deleteBtn) {
    deleteBtn.style.display = songId ? "block" : "none";
    if (songId) {
      deleteBtn.dataset.songId = songId;
    } else {
      deleteBtn.removeAttribute("data-song-id");
    }
  }


  if (songId) {
    title.textContent = "Edit Song";
    form.dataset.songId = songId;

    // Helper to setup suggestion UI
    const setupSuggestion = (inputId, value, suggestedValue, label) => {
      const input = el(inputId);
      if (!input) return;

      // Clear previous suggestion state
      input.classList.remove("suggestion-placeholder");
      input.placeholder = ""; // Reset to default or empty
      const parent = input.parentElement;
      const existingHint = parent.querySelector(".suggestion-hint");
      if (existingHint) existingHint.remove();

      // Remove old event listeners (requires cloning node or named functions, simple clone is easiest to clear listeners)
      // However, cloning breaks references if other code holds them. 
      // Better: just overwrite onfocus/onblur if simple, or use a cleanup approach.
      // For now, we'll manually handle the logic.

      if (!value && suggestedValue) {
        input.placeholder = `${suggestedValue} (Suggested)`;
        input.classList.add("suggestion-placeholder");

        const hint = document.createElement("div");
        hint.className = "suggestion-hint";
        hint.textContent = `Suggested: ${suggestedValue}`;
        hint.style.cursor = "pointer";
        hint.onclick = () => {
          input.value = suggestedValue;
          input.classList.remove("suggestion-placeholder");
          hint.remove();
        };
        parent.appendChild(hint);

        // Auto-fill on input (optional, or just keep placeholder behavior)
        input.onfocus = () => {
          if (!input.value) {
            // We could auto-fill, or just let them type. 
            // Let's NOT auto-fill on focus, but let them click the hint or type.
            // actually, let's auto-fill if they start typing? No.
          }
        };
      } else {
        input.value = value || "";
      }
    };

    // Try to pre-populate from state if available
    const song = state.songs ? state.songs.find(s => s.id === songId) : null;

    const populateForm = (songData) => {
      el("song-edit-title").value = songData.title || "";
      el("song-edit-description").value = songData.description || "";

      setupSuggestion("song-edit-bpm", songData.bpm, songData.suggested_bpm, "BPM");
      setupSuggestion("song-edit-time-signature", songData.time_signature, songData.suggested_time_signature, "Time Sig");

      // Duration handling
      const durationFormatted = songData.duration_seconds ? formatDuration(songData.duration_seconds) : "";
      const suggestedDurationFormatted = songData.suggested_duration ? formatDuration(songData.suggested_duration) : "";
      setupSuggestion("song-edit-duration", durationFormatted, suggestedDurationFormatted, "Duration");

      // Key handling is tricky because it might be a Select or custom UI.
      // Based on index.html, it seems keys are managed separately in this modal (renderSongKeys).
      // So we probably don't have a single "Key" input to suggest on. 
      // We might want to add a "Suggested Key: C" badge near the key adder.

      const keySection = el("song-keys-list")?.parentElement; // Assuming structure
      const existingKeyHint = keySection?.querySelector(".suggestion-hint");
      if (existingKeyHint) existingKeyHint.remove();

      if ((!songData.song_keys || songData.song_keys.length === 0) && songData.suggested_song_key) {
        // Add a hint to add the suggested key
        if (keySection) {
          const hint = document.createElement("div");
          hint.className = "suggestion-hint";
          hint.textContent = `Suggested Key: ${songData.suggested_song_key} (Click to add)`;
          hint.style.cursor = "pointer";
          hint.style.textAlign = "left";
          hint.style.justifyContent = "flex-start";
          hint.onclick = async () => {
            // Logic to add key
            // This implies calling an API to add the key or adding to a pending list.
            // Since specific key adding logic involves IDs, we might just autofill the "Add Key" input if it exists?
            // Or we just rely on visual hint.
            // For now, let's just show the hint.
          };
          keySection.appendChild(hint);
        }
      }

      // Attribution logic
      const attributionEl = el('getsongbpm-attribution');
      if (attributionEl) {
        if (songData.suggested_song_key || songData.suggested_time_signature) {
          attributionEl.style.display = 'block';
        } else {
          attributionEl.style.display = 'none';
        }
      }
    };

    if (song) {
      populateForm(song);
    } else {
      // Reset fields if waiting for data to avoid confusion
      form.reset();
    }

    // Always load fresh song data (keys and links)
    try {
      const { data: songData } = await supabase
        .from("songs")
        .select(`
    *,
    song_keys(
      id,
      key
    ),
    song_resources(
      id,
      team_id,
      type,
      title,
      url,
      file_path,
      file_name,
      file_type,
      key,
      display_order,
      chart_content,
      created_at
    )
      `)
        .eq("id", songId)
        .single();

      if (songData) {
        // Update form with fresh data
        populateForm(songData);

        renderSongKeys(songData.song_keys || []);
        renderSongLinks(songData.song_resources || []);

        // Inject charts into the resources list (inline, reorderable rows)
        try {
          const charts = await fetchSongCharts(songId, { useCache: false });
          injectSongChartsIntoSongLinksList({
            songId,
            songTitle: songData.title || "",
            charts,
            keys: (songData.song_keys || []).map(k => k?.key).filter(Boolean),
          });
        } catch (e) {
          // Non-blocking
        }
      } else {
        if (!song) {
          renderSongKeys([]);
          renderSongLinks([]);
        }
      }
    } catch (err) {
      console.error("Error fetching song details for edit:", err);
      // Fallback: if we had local state, we're good. If not, user sees empty/partial form.
      if (!song) {
        renderSongKeys([]);
        renderSongLinks([]);
      }
    }
  } else {
    title.textContent = "New Song";
    form.reset();
    // Clear suggested placeholders
    ["song-edit-bpm", "song-edit-time-signature", "song-edit-duration"].forEach(id => {
      const input = el(id);
      if (input) {
        input.classList.remove("suggestion-placeholder");
        input.placeholder = "";
        const hint = input.parentElement?.querySelector(".suggestion-hint");
        if (hint) hint.remove();
      }
    });

    delete form.dataset.songId;
    renderSongKeys([]);
    renderSongLinks([]);
    // Hide delete button for new songs
    if (deleteBtn) {
      deleteBtn.style.display = "none";
    }
  }

  // Focus on first input field for keyboard navigation
  const titleInput = el("song-edit-title");
  if (titleInput) {
    setTimeout(() => titleInput.focus(), 100);
  }
}

function closeSongEditModal() {
  const modal = el("song-edit-modal");

  // Custom close animation handling for this modal because of nested behavior
  closeModalWithAnimation(modal, () => {
    // Check if song modal is still open (was behind this one)
    const songModalOpen = !el("song-modal").classList.contains("hidden");

    // Only reset body overflow if no other modals are open
    if (songModalOpen) {
      // Re-disable overflow because it was cleared by closeModalWithAnimation
      document.body.style.overflow = "hidden";
    }

    el("song-edit-form").reset();
    delete el("song-edit-form").dataset.songId;
    el("song-links-list").innerHTML = "";
    el("song-keys-list").innerHTML = "";

    // Reset creatingSongFromModal if cancelled (not saved)
    if (state.creatingSongFromModal) {
      state.creatingSongFromModal = false;
    }
  });
}

/**
 * Extract dominant vibrant color from an image, filtering out black/white/grey
 * @param {HTMLImageElement} img - The image element
 * @returns {Promise<string|null>} - Hex color string or null if no vibrant color found
 */
/**
 * Sample a region of an image and get its average color
 */
function sampleImageRegion(img, x, y, width, height) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  };
}

async function extractVibrantColor(img) {
  try {
    // Wait for image to be fully loaded
    if (!img.complete || img.naturalWidth === 0) {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
    }

    const width = img.naturalWidth;
    const height = img.naturalHeight;

    // Sample multiple regions of the image to find vibrant colors
    // Include edge regions to catch borders, and center regions for main content
    const borderThickness = Math.max(5, Math.min(width, height) * 0.05); // At least 5px, or 5% of image
    const sampleSize = Math.min(width, height) * 0.2;
    const regions = [
      // Edge/border regions (important for catching border colors like purple)
      // Top edge
      { x: 0, y: 0, w: width, h: borderThickness, isEdge: true },
      // Bottom edge
      { x: 0, y: height - borderThickness, w: width, h: borderThickness, isEdge: true },
      // Left edge
      { x: 0, y: 0, w: borderThickness, h: height, isEdge: true },
      // Right edge
      { x: width - borderThickness, y: 0, w: borderThickness, h: height, isEdge: true },
      // Corner regions (often have borders)
      { x: 0, y: 0, w: sampleSize, h: sampleSize, isEdge: true },
      { x: width - sampleSize, y: 0, w: sampleSize, h: sampleSize, isEdge: true },
      { x: 0, y: height - sampleSize, w: sampleSize, h: sampleSize, isEdge: true },
      { x: width - sampleSize, y: height - sampleSize, w: sampleSize, h: sampleSize, isEdge: true },
      // Center region (main content)
      { x: width * 0.3, y: height * 0.3, w: width * 0.4, h: height * 0.4, isEdge: false },
      // Quadrants
      { x: width * 0.1, y: height * 0.1, w: width * 0.3, h: height * 0.3, isEdge: false },
      { x: width * 0.6, y: height * 0.1, w: width * 0.3, h: height * 0.3, isEdge: false },
      { x: width * 0.1, y: height * 0.6, w: width * 0.3, h: height * 0.3, isEdge: false },
      { x: width * 0.6, y: height * 0.6, w: width * 0.3, h: height * 0.3, isEdge: false },
    ];

    const allColors = [];

    // Sample each region
    for (const region of regions) {
      try {
        const rgb = sampleImageRegion(img, Math.round(region.x), Math.round(region.y), Math.round(region.w), Math.round(region.h));
        const r = rgb.r;
        const g = rgb.g;
        const b = rgb.b;

        // Calculate brightness and saturation
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;

        const hex = `#${[r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('')}`;

        allColors.push({ hex, r, g, b, brightness, saturation, isEdge: region.isEdge });
      } catch (err) {
        // Skip this region if sampling fails
        continue;
      }
    }

    // Filter and score colors
    let bestColor = null;
    let bestScore = 0;

    for (const color of allColors) {
      // Strictly filter out beiges, greys, blacks, and whites
      const isGrey = Math.abs(color.r - color.g) < 15 && Math.abs(color.g - color.b) < 15 && Math.abs(color.r - color.b) < 15;
      const isBlack = color.brightness < 40;
      const isWhite = color.brightness > 220;
      const isBeige = color.brightness > 180 && color.saturation < 0.15;

      if (isGrey || isBlack || isWhite || isBeige) {
        continue;
      }

      // Require minimum saturation
      if (color.saturation < 0.15) {
        continue;
      }

      // Score heavily favors saturation
      // Give bonus to edge samples (borders are often on edges)
      const edgeBonus = color.isEdge ? 0.15 : 0;
      const brightnessScore = Math.min(color.brightness / 255, 1);
      const brightnessPenalty = color.brightness > 200 ? 0.3 : 1;
      const score = color.saturation * 0.85 + (brightnessScore * brightnessPenalty) * 0.1 + edgeBonus;

      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    }

    // Debug logging
    console.log('Sampled colors from regions:', allColors);
    if (bestColor) {
      console.log('Selected color:', bestColor.hex, 'Saturation:', bestColor.saturation, 'Score:', bestScore);
    } else if (allColors.length > 0) {
      // Fallback: use most saturated color
      const fallbackColor = allColors
        .filter(c => {
          const isGrey = Math.abs(c.r - c.g) < 15 && Math.abs(c.g - c.b) < 15 && Math.abs(c.r - c.b) < 15;
          const isBlack = c.brightness < 40;
          const isWhite = c.brightness > 220;
          const isBeige = c.brightness > 180 && c.saturation < 0.15;
          return !isGrey && !isBlack && !isWhite && !isBeige;
        })
        .sort((a, b) => b.saturation - a.saturation)[0];

      if (fallbackColor) {
        console.log('Using fallback color (most saturated):', fallbackColor.hex, 'Saturation:', fallbackColor.saturation);
        return fallbackColor.hex;
      }
    }

    return bestColor ? bestColor.hex : null;
  } catch (error) {
    console.warn('Error extracting color from album art:', error);
    return null;
  }
}

/**
 * Helper to load an image and return its URL (or blob URL if fetched)
 * @param {string} url - The URL to load
 * @returns {Promise<string|null>} - The URL if successful, null otherwise
 */
const loadImageWithFallback = async (url) => {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

// Track which songs are currently loading album art to prevent duplicate calls
const loadingAlbumArt = new Set();

/**
 * Display album art in the song details modal
 * @param {HTMLElement} content - The modal content element
 * @param {Object} albumArtData - Album art data with small, large, and isOverride properties
 * @param {Object} song - The song object
 */
async function displayAlbumArt(content, albumArtData, song) {
  if (!albumArtData) {
    console.warn('⚠️ displayAlbumArt called with no albumArtData for song:', song?.id);
    return;
  }

  const placeholder = content.querySelector("#song-album-art-placeholder");
  const img = content.querySelector("#song-album-art-img");
  const noImage = content.querySelector("#song-album-art-no-image");
  if (!placeholder || !img) {
    console.warn('⚠️ displayAlbumArt: placeholder or img not found');
    return;
  }

  // Prevent duplicate loading for the same song
  const songId = song?.id;
  if (songId && loadingAlbumArt.has(songId)) {
    console.log('⏭️ Skipping duplicate album art load for song:', songId);
    return;
  }

  if (songId) {
    loadingAlbumArt.add(songId);
  }

  console.log('🎨 displayAlbumArt called for song:', songId, 'has small:', !!albumArtData.small, 'has large:', !!albumArtData.large);

  // Ensure container is visible and hide "no image" placeholder when we have an albumArtData attempt
  placeholder.style.display = "flex";
  if (noImage) noImage.classList.add("hidden");
  placeholder.dataset.collapseToken = "";
  placeholder.classList.remove("album-art-collapsed", "album-art-loaded");
  placeholder.classList.add("album-art-loading");
  // Hide the image while loading so we don't flash stale content
  img.style.display = "none";

  // Function to extract and apply color
  const applyColorToShadow = async () => {
    try {
      const vibrantColor = await extractVibrantColor(img);
      if (vibrantColor) {
        // Convert hex to rgba for shadow with opacity
        const r = parseInt(vibrantColor.slice(1, 3), 16);
        const g = parseInt(vibrantColor.slice(3, 5), 16);
        const b = parseInt(vibrantColor.slice(5, 7), 16);

        // Get opacity from CSS variables (changes automatically with theme)
        const root = document.documentElement;
        const mainOpacity = getComputedStyle(root).getPropertyValue('--album-art-shadow-opacity-main').trim() || '0.35';
        const secondaryOpacity = getComputedStyle(root).getPropertyValue('--album-art-shadow-opacity-secondary').trim() || '0.25';

        // Use a more vibrant shadow with the extracted color
        img.style.boxShadow = `0 12px 80px rgba(${r}, ${g}, ${b}, ${mainOpacity}), 0 6px 80px rgba(${r}, ${g}, ${b}, ${secondaryOpacity})`;
        console.log('Applied vibrant color shadow:', vibrantColor);
      } else {
        console.log('No vibrant color found, using default shadow');
      }
    } catch (err) {
      console.warn('Error applying color to shadow:', err);
    }
  };

  // Progressive loading: load small image first, then swap to large when ready
  const loadProgressiveImage = async () => {
    const done = () => {
      // Remove from loading set when done
      if (songId) {
        loadingAlbumArt.delete(songId);
      }
    };

    // Set referrerPolicy to ensure image loads on mobile browsers
    img.referrerPolicy = 'no-referrer-when-downgrade';
    // Enable CORS for color extraction
    img.crossOrigin = "anonymous";

    // Simple helper to handle loading
    const startLoading = (url) => {
      img.src = url;
      img.style.display = "";
    };

    // Handle load/error events
    const onLoad = async () => {
      try {
        placeholder.classList.add("album-art-loaded");
        placeholder.classList.remove("album-art-loading");
        await applyColorToShadow();
      } catch (err) {
        console.warn("Error applying album art shadow color:", err);
      } finally {
        // If we have a large image and we currently loaded the small one, swap it
        // Check if we are currently displaying the small image and have a different large one
        if (albumArtData.large && albumArtData.large !== albumArtData.small && img.src === albumArtData.small) {
          // We could preload large image here if we want, but letting browser handle it is fine
          // preventing explicit double-load logic for simplicity unless user complaints about blips
          // Actually, standard progressive enhancement: once small is loaded, switch src to large
          const largeImg = new Image();
          largeImg.crossOrigin = "anonymous";
          largeImg.onload = () => {
            img.src = albumArtData.large;
            // Re-apply color in case it differs slightly or to ensure sync
            applyColorToShadow();
          };
          largeImg.src = albumArtData.large;
        }
        done();
      }
    };

    const onError = (e) => {
      console.warn('Failed to load album art image:', e);
      const canUpload = placeholder?.dataset?.canUpload === "1";
      if (canUpload) {
        showSongAlbumArtNoImagePlaceholder(content);
      } else {
        collapseSongAlbumArt(content);
      }
      done();
    };

    // Attach listeners
    img.onload = onLoad;
    img.onerror = onError;

    // Start loading
    if (albumArtData.small) {
      startLoading(albumArtData.small);
    } else if (albumArtData.large) {
      startLoading(albumArtData.large);
    } else {
      onError(new Error("No album art URL provided"));
    }
  };

  loadProgressiveImage();

  // Add 3D tilt effect on hover (desktop only)
  if (window.matchMedia('(hover: hover)').matches) {
    setupAlbumArtTilt(placeholder);
  }

  // Add click handler to open full-screen modal
  const openAlbumArtModal = (e) => {
    // Don't open modal if clicking on overlay controls (upload/remove buttons)
    if (e && e.target) {
      const overlayControls = placeholder.querySelector("#album-art-overlay-controls");
      if (overlayControls && overlayControls.contains(e.target)) {
        return;
      }
      // Also check if clicking directly on a button or label
      if (e.target.closest('button') || e.target.closest('label') || e.target.closest('input')) {
        return;
      }
    }

    if (!img.src) return;

    const modal = el("album-art-modal");
    const modalImg = el("album-art-modal-img");
    const closeBtn = el("close-album-art-modal");

    if (!modal || !modalImg) return;

    // Reset any previously set dimensions
    modalImg.style.width = '';
    modalImg.style.height = '';

    // Use the album art data that was passed to this function
    // For override, use the override URL; for iTunes, use large version
    if (albumArtData.isOverride) {
      // For override, use the override URL
      modalImg.src = albumArtData.small; // override uses same URL for small and large
    } else {
      // For iTunes, prefer large version
      modalImg.src = img.src; // Start with current for instant display

      // Function to capture and lock the displayed size
      const lockImageSize = () => {
        // Use requestAnimationFrame to ensure the image has been rendered
        requestAnimationFrame(() => {
          if (modalImg.offsetWidth > 0 && modalImg.offsetHeight > 0) {
            // Capture the actual rendered size
            const renderedWidth = modalImg.offsetWidth;
            const renderedHeight = modalImg.offsetHeight;

            // Set explicit dimensions to maintain size when high-res image loads
            modalImg.style.width = `${renderedWidth}px`;
            modalImg.style.height = `${renderedHeight}px`;
            console.log('🔒 Locked image size:', renderedWidth, 'x', renderedHeight);
          }
        });
      };

      // Capture size once the initial image loads and is displayed
      if (modalImg.complete && modalImg.naturalWidth > 0) {
        // Image already loaded, wait a frame for rendering
        lockImageSize();
      } else {
        modalImg.addEventListener('load', lockImageSize, { once: true });
      }

      if (albumArtData.large && albumArtData.large !== albumArtData.small) {
        // Load large image when modal opens (especially important on mobile where we skip preload)
        console.log('🖼️ Modal opened, loading large image:', albumArtData.large.substring(0, 50));
        loadImageWithFallback(albumArtData.large).then(largeBlobUrl => {
          if (largeBlobUrl) {
            // Ensure we have locked dimensions before swapping
            if (!modalImg.style.width && modalImg.offsetWidth > 0) {
              modalImg.style.width = `${modalImg.offsetWidth}px`;
              modalImg.style.height = `${modalImg.offsetHeight}px`;
            }

            // Swap to high-res image while maintaining the locked size
            modalImg.src = largeBlobUrl;
            console.log('✅ Large image loaded in modal');
          } else {
            console.log('Failed to load high-res image in modal, using current');
          }
        }).catch(error => {
          console.warn('Error loading large image in modal:', error);
        });
      }
    }

    modalImg.alt = img.alt || "Album art";

    // Show modal
    modal.classList.remove("hidden");

    // Close handlers
    let isClosing = false;
    const closeModal = () => {
      if (isClosing) return;
      isClosing = true;

      modal.classList.add("closing");
      setTimeout(() => {
        modal.classList.add("hidden");
        modal.classList.remove("closing");
        isClosing = false;
      }, 300);
    };

    // Close button handler
    const closeBtnHandler = () => {
      closeModal();
      closeBtn.removeEventListener("click", closeBtnHandler);
      backdrop.removeEventListener("click", backdropClickHandler);
      document.removeEventListener("keydown", handleEsc);
    };

    // Close on backdrop click
    const backdrop = modal.querySelector(".album-art-modal-backdrop");
    const backdropClickHandler = (e) => {
      if (e.target === backdrop) {
        closeModal();
        closeBtn.removeEventListener("click", closeBtnHandler);
        backdrop.removeEventListener("click", backdropClickHandler);
        document.removeEventListener("keydown", handleEsc);
      }
    };

    // Close on ESC key
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeBtn.removeEventListener("click", closeBtnHandler);
        backdrop.removeEventListener("click", backdropClickHandler);
        document.removeEventListener("keydown", handleEsc);
      }
    };

    // Attach all event listeners
    closeBtn.addEventListener("click", closeBtnHandler);
    backdrop.addEventListener("click", backdropClickHandler);
    document.addEventListener("keydown", handleEsc);
  };

  // Add click handler to container (handles both image and skeleton/background)
  // Only open modal if clicking on the image/container itself, not on buttons
  placeholder.style.cursor = "pointer";
  img.style.cursor = "pointer";

  const handleAlbumArtClick = (e) => {
    // Check if click is on overlay controls or interactive elements
    const overlayControls = placeholder.querySelector("#album-art-overlay-controls");
    if (overlayControls && (overlayControls.contains(e.target) || e.target === overlayControls)) {
      return;
    }
    // Check if click is on a button, label, or input
    if (e.target.closest('button') || e.target.closest('label') || e.target.closest('input')) {
      return;
    }

    console.log('🖼️ Album art clicked, opening modal');
    openAlbumArtModal(e);
  };

  placeholder.addEventListener("click", handleAlbumArtClick);
}

/**
 * Remove album art override for a song
 * @param {string} songId - The song ID
 * @param {string} filePath - The file path to delete
 */
async function removeAlbumArtOverride(songId, filePath) {
  if (!filePath) return;

  try {
    // Delete file from storage
    await deleteFileFromSupabase(filePath);

    // Update song to remove override path
    const { error } = await supabase
      .from("songs")
      .update({ album_art_override_path: null })
      .eq("id", songId);

    if (error) {
      console.error("Error removing album art override:", error);
      toastError("Failed to remove album art. Check console.");
      return;
    }

    toastSuccess("Album art override removed.");
  } catch (error) {
    console.error("Error removing album art override:", error);
    toastError("Failed to remove album art. Check console.");
  }
}

/**
 * Setup 3D tilt effect for album art on hover (desktop only)
 * @param {HTMLElement} container - The album art container element
 */
function setupAlbumArtTilt(container) {
  const img = container.querySelector('.song-album-art');
  if (!img) return;

  let rafId = null;

  container.addEventListener('mousemove', (e) => {
    // Use requestAnimationFrame for smoother animation
    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / centerY * -10; // Max 10 degrees
      const rotateY = (x - centerX) / centerX * 10; // Max 10 degrees

      // Apply transform to container so pseudo-elements move with it
      container.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    });
  });

  container.addEventListener('mouseleave', () => {
    if (rafId) cancelAnimationFrame(rafId);
    container.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
  });
}

/**
 * Get album art for a song - checks override first, then falls back to iTunes API
 * @param {Object} song - The song object with album_art_override_path
 * @param {string} songTitle - The title of the song (for iTunes fallback)
 * @returns {Promise<{small: string, large: string, isOverride: boolean}|null>} - URLs of the album art images, or null if not found
 */
async function getAlbumArt(song, songTitle, options = {}) {
  console.log('🎵 getAlbumArt called for song:', song?.id, 'title:', songTitle);

  // Check for override first
  if (song?.album_art_override_path) {
    console.log('🎵 Has override path:', song.album_art_override_path);
    try {
      const url = await getFileUrl(song.album_art_override_path);
      if (url) {
        console.log('🎵 Override URL loaded successfully');
        // For uploaded images, use the same URL for both small and large
        return { small: url, large: url, isOverride: true };
      } else {
        console.warn('🎵 Override URL is null');
      }
    } catch (error) {
      console.warn('Error loading album art override:', error);
      // Fall through to database/iTunes
    }
  }

  // Check database for indexed iTunes album art
  if (song?.album_art_small_url && song?.album_art_large_url) {
    console.log('🎵 Using database-stored iTunes album art');
    return {
      small: song.album_art_small_url,
      large: song.album_art_large_url,
      isOverride: false
    };
  }

  // If iTunes is unavailable for this song in this context (per-song disabled or team-wide disabled),
  // do not keep trying to fetch client-side album art.
  if (song?.itunes_fetch_disabled || options?.disableItunesFallback) {
    console.log('🎵 iTunes fetch disabled for this song; skipping iTunes API fallback');
    return null;
  }

  // Fall back to iTunes API (for songs not yet indexed)
  if (songTitle) {
    console.log('🎵 No database art found, fetching from iTunes API...');
    const itunesArt = await fetchAlbumArt(songTitle);
    if (itunesArt) {
      console.log('🎵 iTunes API returned art:', itunesArt.small ? 'has small' : 'no small', itunesArt.large ? 'has large' : 'no large');
      return { ...itunesArt, isOverride: false };
    } else {
      console.warn('🎵 iTunes API returned no art');
    }
  }

  console.warn('🎵 getAlbumArt returning null - no art found');
  return null;
}

// Cache for loaded images to avoid duplicate edge function calls
// Only stores successful results - failures are not cached to allow retries


// Cache for iTunes metadata by song title
// This ensures we always use the same iTunes result that provided the album art
// Key: song title (lowercase), Value: full iTunes result object
const itunesMetadataCache = new Map();

// Server-side iTunes indexing - client just checks for unindexed songs
// No client-side indexing queue needed anymore

// When waiting on iTunes metadata, poll for updates (songs index ~every minute)
const ITUNES_INDEX_REFRESH_INTERVAL_MS = 20000; // 20s
const ITUNES_INDEX_REFRESH_MAX_CHECKS = 4; // 4 checks max (no infinite polling)

function stopItunesIndexRefreshPolling(resetAttempts = true) {
  const poll = state.itunesIndexRefresh;
  if (!poll) return;

  poll.isRunning = false;
  poll.inFlight = false;
  poll.teamId = null;

  if (poll.timeoutId) {
    window.clearTimeout(poll.timeoutId);
    poll.timeoutId = null;
  }

  if (resetAttempts) {
    poll.attempts = 0;
  }
}

function scheduleNextItunesIndexRefresh() {
  const poll = state.itunesIndexRefresh;
  if (!poll?.isRunning) return;

  // Team changed; stop (caller may restart for new team)
  if (poll.teamId && poll.teamId !== state.currentTeamId) {
    stopItunesIndexRefreshPolling(false);
    return;
  }

  if (poll.attempts >= ITUNES_INDEX_REFRESH_MAX_CHECKS) {
    // Give up quietly; indicator stays until next manual reload or loadSongs()
    stopItunesIndexRefreshPolling(false);
    return;
  }

  if (poll.timeoutId) {
    window.clearTimeout(poll.timeoutId);
    poll.timeoutId = null;
  }

  poll.timeoutId = window.setTimeout(async () => {
    await runItunesIndexRefreshOnce();
    scheduleNextItunesIndexRefresh();
  }, ITUNES_INDEX_REFRESH_INTERVAL_MS);
}

function startItunesIndexRefreshPolling() {
  const poll = state.itunesIndexRefresh;
  if (!poll) return;
  if (!state.currentTeamId) return;

  // Already polling for this team
  if (poll.isRunning && poll.teamId === state.currentTeamId) return;

  // Restart cleanly
  stopItunesIndexRefreshPolling(true);
  poll.isRunning = true;
  poll.teamId = state.currentTeamId;
  poll.attempts = 0;
  poll.inFlight = false;

  scheduleNextItunesIndexRefresh();
}

function handleItunesIndexRefreshPolling(unindexedCount) {
  if (unindexedCount > 0) {
    // If team changed, restart for current team
    if (state.itunesIndexRefresh?.isRunning && state.itunesIndexRefresh.teamId !== state.currentTeamId) {
      stopItunesIndexRefreshPolling(true);
    }
    startItunesIndexRefreshPolling();
  } else {
    stopItunesIndexRefreshPolling(true);
  }
}

async function runItunesIndexRefreshOnce() {
  const poll = state.itunesIndexRefresh;
  if (!poll?.isRunning) return;
  if (!state.currentTeamId) return;

  const currentTeam = state.userTeams?.find?.(t => t.id === state.currentTeamId);
  if (currentTeam?.itunes_indexing_enabled === false) {
    // Team has disabled iTunes indexing; don't poll.
    updateIndexingUI(0);
    stopItunesIndexRefreshPolling(true);
    return;
  }

  if (poll.teamId && poll.teamId !== state.currentTeamId) {
    stopItunesIndexRefreshPolling(false);
    return;
  }
  if (poll.inFlight) return;
  if (poll.attempts >= ITUNES_INDEX_REFRESH_MAX_CHECKS) {
    stopItunesIndexRefreshPolling(false);
    return;
  }

  // Only run if we’re still waiting on iTunes metadata (unindexed songs exist)
  const waitingSongs = (state.songs || []).filter(song =>
    song?.title &&
    song.title.trim() &&
    !song.itunes_indexed_at &&
    !song.itunes_fetch_disabled
  );
  if (waitingSongs.length === 0) {
    updateIndexingUI(0);
    stopItunesIndexRefreshPolling(true);
    return;
  }

  poll.inFlight = true;
  poll.attempts += 1;

  try {
    const waitingIds = waitingSongs.map(s => s.id).filter(Boolean);
    if (waitingIds.length === 0) return;

    const { data, error } = await safeSupabaseOperation(async () => {
      return await supabase
        .from("songs")
        .select("id, itunes_indexed_at, itunes_metadata, album_art_small_url, album_art_large_url, itunes_fetch_disabled, itunes_fetch_failure_count")
        .eq("team_id", state.currentTeamId)
        .in("id", waitingIds);
    });

    if (error) {
      console.warn('⚠️ iTunes indexing refresh poll failed:', error);
      return;
    }

    const rows = data || [];
    const byId = new Map(rows.map(r => [r.id, r]));
    const fields = ["itunes_indexed_at", "itunes_metadata", "album_art_small_url", "album_art_large_url", "itunes_fetch_disabled", "itunes_fetch_failure_count"];

    let didChange = false;

    // Merge updates into existing in-memory songs (do NOT add new songs)
    state.songs = (state.songs || []).map(song => {
      const upd = byId.get(song?.id);
      if (!upd) return song;

      let changed = false;
      const next = { ...song };
      for (const f of fields) {
        if (upd[f] !== undefined && upd[f] !== song[f]) {
          next[f] = upd[f];
          changed = true;
        }
      }
      if (changed) didChange = true;
      return changed ? next : song;
    });

    // Also merge into set song nested references if present (so set detail view can update without reload)
    if (Array.isArray(state.sets) && state.sets.length > 0) {
      state.sets = state.sets.map(set => {
        if (!set || !Array.isArray(set.set_songs)) return set;
        let setChanged = false;
        const nextSetSongs = set.set_songs.map(setSong => {
          const songObj = setSong?.song;
          const upd = songObj?.id ? byId.get(songObj.id) : null;
          if (!upd) return setSong;

          let changed = false;
          const nextSong = { ...songObj };
          for (const f of fields) {
            if (upd[f] !== undefined && upd[f] !== songObj[f]) {
              nextSong[f] = upd[f];
              changed = true;
            }
          }
          if (!changed) return setSong;
          setChanged = true;
          didChange = true;
          return { ...setSong, song: nextSong };
        });
        return setChanged ? { ...set, set_songs: nextSetSongs } : set;
      });

      if (state.selectedSet?.id) {
        const updatedSelected = state.sets.find(s => s?.id === state.selectedSet.id);
        if (updatedSelected) {
          state.selectedSet = updatedSelected;
        }
      }
    }

    // Update indexing UI & polling gate based on latest state
    checkUnindexedSongs();

    // Re-render visible views only if we actually got new metadata/art
    if (didChange) {
      if (!el("songs-tab")?.classList.contains("hidden")) {
        await renderSongCatalog(false);
      }
      if (state.selectedSet) {
        try {
          renderSetDetailSongs(state.selectedSet);
        } catch (e) {
          // Non-fatal if set detail view isn't active
        }
      }
      // If song details is open for a song we're polling, refresh its album art too.
      await refreshOpenSongDetailsAlbumArtFromIndexRefresh(byId);
    }
  } finally {
    poll.inFlight = false;
  }
}

// Check for unindexed songs and update UI
function checkUnindexedSongs() {
  if (!state.songs || state.songs.length === 0) {
    updateIndexingUI(0);
    handleItunesIndexRefreshPolling(0);
    return;
  }

  const currentTeam = state.userTeams?.find?.(t => t.id === state.currentTeamId);
  if (currentTeam?.itunes_indexing_enabled === false) {
    updateIndexingUI(0);
    handleItunesIndexRefreshPolling(0);
    return;
  }

  // Count songs that don't have itunes_indexed_at timestamp
  const unindexedCount = state.songs.filter(song => {
    return song.title && song.title.trim() && !song.itunes_indexed_at && !song.itunes_fetch_disabled;
  }).length;

  updateIndexingUI(unindexedCount);
  handleItunesIndexRefreshPolling(unindexedCount);
}

// Simple UI update for server-side indexing status
function updateIndexingUI(unindexedCount) {
  const indicator = el('itunes-indexing-indicator');
  if (!indicator) return;

  const statusEl = indicator.querySelector('.indexing-status');
  const progressBar = indicator.querySelector('.indexing-progress-bar');

  // Hide progress bar (server-side indexing is slower, no real-time progress)
  if (progressBar) {
    progressBar.style.display = 'none';
  }

  // Hide indicator if all songs are indexed
  if (unindexedCount === 0) {
    indicator.classList.add('hidden');
    return;
  }

  // Show simple message
  indicator.classList.remove('hidden');
  if (statusEl) {
    statusEl.textContent = 'Some song metadata is still indexing';
  }
}

// Rate limiting for mobile edge function calls
// Debounce edge function calls on mobile to wait until user is done typing
const mobileEdgeFunctionQueue = new Map(); // Key: function identifier, Value: { timeout, promise, resolve, reject, latestParams }
const MOBILE_DEBOUNCE_DELAY = 1500; // Wait 1.5 seconds after user stops typing before calling edge function

/**
 * Debounced edge function invoker for mobile devices
 * Waits until user stops typing before making the call
 * @param {string} functionName - The edge function name
 * @param {string} cacheKey - Unique key for this specific call (e.g., song title)
 * @param {Object} params - Parameters to pass to the edge function
 * @param {boolean} skipDebounce - If true, skip debouncing (for resource search)
 * @returns {Promise} - Promise that resolves with the edge function result
 */
async function invokeEdgeFunctionDebounced(functionName, cacheKey, params, skipDebounce = false) {
  const isMobile = isMobileDevice();

  // On desktop or if debouncing is skipped, call directly
  if (!isMobile || skipDebounce) {
    return await supabase.functions.invoke(functionName, { body: params });
  }

  // On mobile, use debouncing
  const queueKey = `${functionName}:${cacheKey}`;

  // Clear existing timeout if any
  if (mobileEdgeFunctionQueue.has(queueKey)) {
    const existing = mobileEdgeFunctionQueue.get(queueKey);
    clearTimeout(existing.timeout);
    // Reject the old promise
    if (existing.reject) {
      existing.reject(new Error('Debounced: superseded by newer call'));
    }
  }

  // Create new promise
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Set up timeout
  const timeout = setTimeout(async () => {
    try {
      console.log(`📱 Mobile: Calling edge function ${functionName} after debounce for:`, cacheKey);
      const result = await supabase.functions.invoke(functionName, { body: params });
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      mobileEdgeFunctionQueue.delete(queueKey);
    }
  }, MOBILE_DEBOUNCE_DELAY);

  // Store in queue
  mobileEdgeFunctionQueue.set(queueKey, { timeout, promise, resolve, reject, latestParams: params });

  return promise;
}

/**
 * Detect if the current device is mobile
 * @returns {boolean} - True if mobile device
 */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
}



/**
 * Convert various date formats to ISO8601 format
 * Supports: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, YYYY/MM/DD, YYYY, MM-DD-YYYY, etc.
 * @param {string} dateStr - Date string in various formats
 * @returns {string|null} - ISO8601 formatted date (YYYY-MM-DD) or null if invalid
 */
function convertDateToISO8601(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Already in ISO8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(trimmed)) {
    return trimmed.split('T')[0]; // Return just the date part
  }

  // Try parsing as Date object (handles many formats)
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try manual parsing for common formats
  // MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, part1, part2, year] = slashMatch;
    // Heuristic: if first part > 12, it's likely DD/MM/YYYY
    if (parseInt(part1) > 12) {
      return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    } else {
      // Assume MM/DD/YYYY
      return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
    }
  }

  // MM-DD-YYYY
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY only
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`; // Default to January 1st
  }

  // YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parse search query for iTunes metadata filters
 * Extracts genre:, album:, artist:, date:, releaseDate: from search query
 * @param {string} query - The search query
 * @returns {{filters: Object, text: string}} - Parsed filters and remaining text
 */
function parseItunesMetadataQuery(query) {
  const filters = {};

  // Regex for extracting key:value pairs (supports quoted strings)
  const regex = /(\w+):(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;

  let match;
  while ((match = regex.exec(query)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2] || match[3] || match[4] || "";

    switch (key) {
      case 'genre':
        filters.genre = value;
        break;
      case 'album':
        filters.album = value;
        break;
      case 'artist':
        filters.artist = value;
        break;
      case 'date':
      case 'releasedate':
      case 'release':
        const isoDate = convertDateToISO8601(value);
        if (isoDate) {
          filters.releaseDate = isoDate;
        }
        break;
    }
  }

  // Remove the matches from the text to get residual search terms
  const text = query.replace(regex, "").replace(/\s+/g, " ").trim();

  return { filters, text };
}

/**
 * Get iTunes metadata for a specific song (uses cached result from album art fetch when available)
 * This ensures metadata always matches the album art, regardless of search terms
 * @param {string} songTitle - The title of the song
 * @returns {Promise<Object|null>} - iTunes result object with metadata, or null if not found
 */
/**
 * Get iTunes metadata for a song - checks database first, then falls back to API
 * @param {string|Object} songOrTitle - Either a song object (with itunes_metadata) or song title string
 * @returns {Promise<Object|null>} - iTunes result object with metadata, or null if not found
 */
async function getItunesMetadataForSong(songOrTitle) {
  // If passed a song object, use its database-stored metadata
  if (songOrTitle && typeof songOrTitle === 'object' && songOrTitle.itunes_metadata) {
    console.log('🎵 Using database-stored iTunes metadata for song:', songOrTitle.id);
    return songOrTitle.itunes_metadata;
  }

  // Extract song title
  const songTitle = typeof songOrTitle === 'object' ? songOrTitle?.title : songOrTitle;
  if (!songTitle || !songTitle.trim()) {
    return null;
  }

  // If we have a song object but no metadata, check if it's been indexed
  if (typeof songOrTitle === 'object' && songOrTitle.itunes_indexed_at) {
    // Song has been indexed but no metadata - means iTunes had no data
    console.log('🎵 Song has been indexed but no iTunes metadata available');
    return null;
  }

  // Fall back to fetching from iTunes API (for songs not yet indexed)
  // This should rarely happen now that we have server-side indexing
  console.log('🎵 No database metadata, fetching from iTunes API (song not yet indexed):', songTitle);
  const isMobile = isMobileDevice();

  try {
    if (isMobile) {
      // Use debounced edge function for mobile
      const { data, error } = await invokeEdgeFunctionDebounced(
        'fetch-album-art',
        songTitle.toLowerCase().trim(),
        {
          searchQuery: songTitle.trim(),
          metadataSearch: true,
          exactMatch: true
        },
        false
      );

      if (error) {
        console.error('❌ Edge function error for iTunes metadata:', error);
        return null;
      }

      if (data?.success && data?.results && data.results.length > 0) {
        return data.results[0];
      }
    } else {
      // Direct API call for desktop
      const searchQuery = encodeURIComponent(songTitle.trim());
      const apiUrl = `https://itunes.apple.com/search?term=${searchQuery}&media=music&limit=1`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        console.warn('iTunes API request failed:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      if (data?.results && data.results.length > 0) {
        return data.results[0];
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting iTunes metadata for song:', error);
    return null;
  }
}

/**
 * Search iTunes API with metadata filters (genre, album, artist, release date)
 * Used for general searches with filters, not for matching specific songs
 * @param {Object} params - Search parameters
 * @param {string} params.term - General search term (song title)
 * @param {string} [params.genre] - Genre filter
 * @param {string} [params.album] - Album filter
 * @param {string} [params.artist] - Artist filter
 * @param {string} [params.releaseDate] - Release date in ISO8601 format (YYYY-MM-DD)
 * @returns {Promise<Array>} - Array of iTunes results
 */
async function searchItunesMetadata(params) {
  const { term, genre, album, artist, releaseDate } = params;

  // Build search query - combine all terms
  const searchTerms = [];
  if (term) searchTerms.push(term);
  if (artist) searchTerms.push(artist);
  if (album) searchTerms.push(album);
  if (genre) searchTerms.push(genre);

  const searchQuery = searchTerms.join(' ');

  if (!searchQuery.trim()) {
    console.warn('🎵 searchItunesMetadata: no search terms provided');
    return [];
  }

  const isMobile = isMobileDevice();
  let results = [];

  try {
    if (isMobile) {
      // Use debounced edge function for mobile
      const cacheKey = `${searchQuery.trim()}:${genre || ''}:${album || ''}:${artist || ''}:${releaseDate || ''}`;
      const { data, error } = await invokeEdgeFunctionDebounced(
        'fetch-album-art',
        cacheKey,
        {
          searchQuery: searchQuery.trim(),
          metadataSearch: true,
          genre,
          album,
          artist,
          releaseDate
        },
        false // Use debouncing for general searches
      );

      if (error) {
        console.error('❌ Edge function error for iTunes metadata search:', error);
        return [];
      }

      if (data?.success && data?.results) {
        results = data.results;
      }
    } else {
      // Direct API call for desktop
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      const apiUrl = `https://itunes.apple.com/search?term=${encodedQuery}&media=music&limit=50`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        console.warn('iTunes API request failed:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      results = data?.results || [];
    }

    // Filter results by metadata if provided
    let filteredResults = results;

    if (genre) {
      filteredResults = filteredResults.filter(item =>
        (item.primaryGenreName || '').toLowerCase().includes(genre.toLowerCase()) ||
        (item.genres || []).some(g => g.toLowerCase().includes(genre.toLowerCase()))
      );
    }

    if (album) {
      filteredResults = filteredResults.filter(item =>
        (item.collectionName || '').toLowerCase().includes(album.toLowerCase())
      );
    }

    if (artist) {
      filteredResults = filteredResults.filter(item =>
        (item.artistName || '').toLowerCase().includes(artist.toLowerCase())
      );
    }

    if (releaseDate) {
      // Filter by release date (allow matches within the same year for flexibility)
      const targetYear = releaseDate.split('-')[0];
      filteredResults = filteredResults.filter(item => {
        if (!item.releaseDate) return false;
        const itemDate = new Date(item.releaseDate);
        const itemYear = itemDate.getFullYear().toString();
        // Match exact date or same year
        return item.releaseDate.startsWith(releaseDate) || itemYear === targetYear;
      });
    }

    return filteredResults;
  } catch (error) {
    console.error('❌ Error searching iTunes metadata:', error);
    return [];
  }
}

/**
 * Search iTunes API via edge function (for mobile CORS bypass) or direct (for desktop)
 * @param {string} songTitle - The title of the song
 * @returns {Promise<{small: string, large: string}|null>} - URLs of the album art images, or null if not found
 */
async function searchItunesViaEdgeFunction(songTitle) {
  try {
    console.log('🌐 Searching iTunes via edge function:', songTitle);

    const functionCacheKey = songTitle.toLowerCase().trim();
    const { data, error } = await invokeEdgeFunctionDebounced(
      'fetch-album-art',
      functionCacheKey,
      {
        searchQuery: songTitle.trim(),
        metadataSearch: true,
        exactMatch: true // Get full result so we can cache it
      },
      false // Use debouncing for album art fetches
    );

    if (error) {
      console.error('❌ Edge function error for iTunes search:', error);
      return null;
    }

    // Cache the iTunes result if we got it back (either in results array or result object)
    if (data?.success) {
      if (data?.results && data.results.length > 0) {
        itunesMetadataCache.set(metadataCacheKey, data.results[0]);
        saveItunesCacheToStorage();
        console.log('🎵 Cached iTunes metadata from edge function (results array) for:', metadataCacheKey);
      } else if (data?.result) {
        // Edge function returns result object when exactMatch is true
        itunesMetadataCache.set(metadataCacheKey, data.result);
        saveItunesCacheToStorage();
        console.log('🎵 Cached iTunes metadata from edge function (result object) for:', metadataCacheKey);
      }
    }

    if (data?.success && data?.small && data?.large) {
      console.log('✅ iTunes search via edge function succeeded');
      return { small: data.small, large: data.large };
    }

    console.warn('⚠️ Edge function returned no artwork');
    return null;
  } catch (error) {
    console.error('❌ Error calling edge function for iTunes search:', error);
    return null;
  }
}

/**
 * Fetch album art for a song using iTunes Search API (free, no API key required)
 * @param {string} songTitle - The title of the song
 * @returns {Promise<{small: string, large: string}|null>} - URLs of the album art images (small and large), or null if not found
 */
async function fetchAlbumArt(songTitle) {
  if (!songTitle || !songTitle.trim()) {
    console.warn('🎵 fetchAlbumArt: empty songTitle');
    return null;
  }

  const isMobile = isMobileDevice();

  // On mobile, use edge function to bypass CORS
  if (isMobile) {
    console.log('📱 Mobile: using edge function for iTunes search');
    const result = await searchItunesViaEdgeFunction(songTitle);
    if (result) return result;
    // If edge function fails, try direct as fallback
    console.log('📱 Edge function failed, trying direct iTunes API as fallback');
  }

  // On desktop or as fallback on mobile, try direct fetch
  try {
    // iTunes Search API - completely free, no API key needed
    const searchQuery = encodeURIComponent(songTitle.trim());
    const apiUrl = `https://itunes.apple.com/search?term=${searchQuery}&media=music&limit=1`;

    console.log('🎵 Calling iTunes API directly:', apiUrl);

    // Add Accept header to ensure proper content negotiation
    // Note: User-Agent cannot be set in fetch (forbidden header), but Accept helps
    // ensure the API returns JSON properly on all browsers including mobile
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // Add mode and credentials to ensure CORS works on mobile browsers
      mode: 'cors',
      credentials: 'omit'
    });

    console.log('🎵 iTunes API response status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      console.warn('iTunes API request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('🎵 iTunes API data:', data?.results?.length || 0, 'results');

    // Extract album art URL from iTunes response
    if (data?.results?.[0]?.artworkUrl100) {
      // Cache the full iTunes result for this song title so we can use it for metadata later
      // This ensures metadata always matches the album art
      const cacheKey = songTitle.toLowerCase().trim();
      if (data.results[0]) {
        itunesMetadataCache.set(cacheKey, data.results[0]);
        saveItunesCacheToStorage();
        console.log('🎵 Cached iTunes metadata for:', cacheKey);
      }

      // iTunes provides artworkUrl100 (100x100), artworkUrl60 (60x60), etc.
      // Return both medium (600x600) for fast initial load and large (10000x10000) for high quality
      const smallUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
      const largeUrl = data.results[0].artworkUrl100.replace('100x100', '3000x3000');
      console.log('🎵 Found artwork URLs - small:', smallUrl.substring(0, 50), 'large:', largeUrl.substring(0, 50));
      return { small: smallUrl, large: largeUrl };
    } else {
      console.warn('🎵 No artworkUrl100 in iTunes response');
    }

    return null;
  } catch (error) {
    // Enhanced error logging to help debug mobile issues
    console.error('❌ Error fetching album art:', error);
    console.error('❌ Error name:', error.name, 'message:', error.message);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.warn('Network error - this may be a CORS or connectivity issue on mobile');
    }
    return null;
  }
}

async function openSongDetailsModal(song, selectedKey = null, setSongContext = null) {
  if (!song) return;

  const modal = el("song-details-modal");
  const content = el("song-details-content");
  const title = el("song-details-title");

  if (!modal || !content) return;

  // Track which song is open
  state.currentSongDetailsId = song.id;

  title.textContent = "Song Details";

  // Fetch song with keys and resources
  let songWithResources = song;
  if (!song.song_resources || !song.song_keys) {
    const { data } = await supabase
      .from("songs")
      .select(`
  *,
  song_keys(
    id,
    key
  ),
  song_resources(
    id,
    team_id,
    type,
    title,
    url,
    file_path,
    file_name,
    file_type,
    key,
    display_order,
    chart_content,
    created_at
  )
    `)
      .eq("id", song.id)
      .single();

    if (data) {
      songWithResources = data;
    }
  }

  // Ensure resources are ordered by display_order
  if (songWithResources && Array.isArray(songWithResources.song_resources)) {
    songWithResources.song_resources = [...songWithResources.song_resources].sort((a, b) => {
      const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
      const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
      return ao - bo;
    });
  }

  // Split resources into links/files and charts
  const allResources = songWithResources.song_resources || [];

  // Backwards compatibility for rendering: treat 'link' and 'file' as links
  const links = allResources.filter(r => r.type === 'link' || r.type === 'file');

  // Organize links by key
  const generalLinks = links.filter(link => !link.key);
  const selectedKeyLinks = selectedKey
    ? links.filter(link => link.key === selectedKey)
    : [];
  const otherKeysLinks = selectedKey
    ? links.filter(link => link.key && link.key !== selectedKey)
    : links.filter(link => link.key);

  // Group other keys links by key
  const linksByKey = {};
  otherKeysLinks.forEach(link => {
    if (!linksByKey[link.key]) {
      linksByKey[link.key] = [];
    }
    linksByKey[link.key].push(link);
  });

  const hasLinks = links.length > 0;
  const hasKeys = (songWithResources.song_keys || []).length > 0;
  const keysArray = songWithResources.song_keys || [];
  const singleKey = keysArray.length === 1 ? keysArray[0].key : null;
  const isSingleKeyMatch = singleKey && selectedKey && singleKey === selectedKey;

  // Charts from resources
  // Extract chart objects from resources using the adapter logic inline or just use the resource properties
  // The 'chart_content' contains the doc, chart_type etc.
  const allGeneralCharts = allResources
    .filter(r => r.type === 'chart' && (!r.key || r.key === '')) // General scope (no key)
    .map(r => ({ ...r.chart_content, id: r.id, display_order: r.display_order, song_key: null, scope: 'general' }))
    .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

  const generalChart = allGeneralCharts.find(c => c.chart_type === "number") || allGeneralCharts[0] || null;
  const generalChordCharts = allGeneralCharts.filter(c => c.chart_type === "chord");

  const keyCharts = allResources
    .filter(r => r.type === 'chart' && r.key) // Key scope
    .map(r => ({ ...r.chart_content, id: r.id, display_order: r.display_order, song_key: r.key, scope: 'key' }));

  const keyChartByKey = new Map(keyCharts.map(c => [normalizeKeyLabel(c.song_key), c]));
  const hasGeneratedKeyCharts = !!(generalChart && generalChart.chart_type === "number" && hasKeys);
  const hasAnyCharts = !!(allGeneralCharts.length > 0 || keyCharts.length > 0 || hasGeneratedKeyCharts);
  const hasResources = hasLinks || hasAnyCharts;
  const itunesFetchDisabled = !!songWithResources.itunes_fetch_disabled;
  const teamItunesDisabled = (state.userTeams?.find?.(t => t.id === state.currentTeamId)?.itunes_indexing_enabled === false);
  const itunesUnavailable = itunesFetchDisabled || teamItunesDisabled;
  const canUploadAlbumArt = isManager() && (!!songWithResources.itunes_indexed_at || itunesUnavailable || !!songWithResources.album_art_override_path);
  const isWaitingOnItunesIndex =
    !!songWithResources?.title &&
    songWithResources.title.trim() &&
    !songWithResources.itunes_indexed_at &&
    !songWithResources.itunes_fetch_disabled &&
    !teamItunesDisabled;

  // Ref to song with resources for templates
  // Ref to song with resources for templates
  const songWithLinks = songWithResources; // Keep variable name for minimal diff in template sections

  // Render all song information in an expanded view
  content.innerHTML = `
  <div class="song-details-section">
        <div class="song-details-header-wrapper">
          <div id="song-album-art-placeholder" class="song-album-art-container" data-can-upload="${canUploadAlbumArt ? '1' : '0'}" style="display:none;">
            <div class="album-art-skeleton skeleton" aria-hidden="true"></div>
            <img id="song-album-art-img" src="" alt="Album art for ${escapeHtml(songWithLinks.title || 'song')}" class="song-album-art" style="display:none;" />
            <div id="song-album-art-no-image" class="song-album-art-no-image hidden">No image</div>
            ${canUploadAlbumArt ? `
            <div class="album-art-overlay-controls" id="album-art-overlay-controls" style="position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.5rem; opacity: 0; transition: opacity 0.2s;">
              <label for="album-art-upload-input" class="btn small secondary" style="cursor: pointer; margin: 0; padding: 0.4rem 0.6rem;" title="Upload album art">
                <i class="fa-solid fa-upload"></i>
              </label>
              ${songWithLinks.album_art_override_path ? `
              <button type="button" class="btn small ghost" id="remove-album-art-btn" style="margin: 0; padding: 0.4rem 0.6rem;" title="Remove custom album art">
                <i class="fa-solid fa-trash"></i>
              </button>
              ` : ''}
            </div>
            <input type="file" id="album-art-upload-input" accept="image/*" style="display: none;">
            ` : ''}
          </div>
          <div class="song-details-header-content">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem;">
              <h2 class="song-details-title" style="margin: 0; flex: 1;">${escapeHtml(songWithLinks.title || "Untitled")}</h2>
              ${isManager() ? `
              <div class="header-dropdown-container" id="song-details-edit-dropdown">
                <button class="btn small secondary" type="button" id="btn-song-details-edit-toggle">
                  <i class="fa-solid fa-pencil"></i> Edit <i class="fa-solid fa-chevron-down" style="margin-left: 0.5rem; font-size: 0.75rem;"></i>
                </button>
                <div class="header-dropdown-menu hidden" style="right: 0; left: auto;">
                  <button type="button" class="header-dropdown-item" id="btn-song-details-edit-global">
                    <i class="fa-solid fa-music"></i>
                    <span>Edit Song Details</span>
                  </button>
                  ${setSongContext ? `
                  <button type="button" class="header-dropdown-item" id="btn-song-details-edit-set">
                    <i class="fa-solid fa-list-ul"></i>
                    <span>Edit Song in Set</span>
                  </button>
                  ` : ''}
                  ${songWithResources.album_art_override_path ? `
                  <div class="header-dropdown-divider"></div>
                  <button type="button" class="header-dropdown-item" id="btn-song-details-reset-album-art">
                    <i class="fa-solid fa-image"></i>
                    <span>Reset Album Art</span>
                  </button>
                  ` : ''}
                </div>
              </div>
              ` : ''}
            </div>
            ${itunesFetchDisabled ? `<div class="song-itunes-warning"><i class="fa-brands fa-itunes-note"></i> Some additional metadata for this song could not be found</div>` : ''}
            <div class="song-details-meta">
          ${songWithResources.bpm || songWithResources.suggested_bpm ? `<div class="detail-item">
            <span class="detail-label">BPM</span>
            <span class="detail-value">${songWithResources.bpm || `<span style="color: var(--text-muted); font-style: italic;" title="Suggested">${songWithResources.suggested_bpm}</span>`}</span>
          </div>` : ''}
          ${isSingleKeyMatch ? `<div class="detail-item">
            <span class="detail-label">Key</span>
            <span class="detail-value">${escapeHtml(selectedKey)}</span>
          </div>` : ''}
          ${hasKeys && !isSingleKeyMatch ? `<div class="detail-item">
            <span class="detail-label">Keys</span>
            <span class="detail-value">${keysArray.map(k => escapeHtml(k.key)).join(", ")}</span>
          </div>` : ''}
          ${(!hasKeys && songWithResources.suggested_song_key) ? `<div class="detail-item">
            <span class="detail-label">Key</span>
            <span class="detail-value" style="color: var(--text-muted); font-style: italic;" title="Suggested">${escapeHtml(songWithResources.suggested_song_key)}</span>
          </div>` : ''}
          ${selectedKey && !isSingleKeyMatch ? `<div class="detail-item">
            <span class="detail-label">Selected Key</span>
            <span class="detail-value">${escapeHtml(selectedKey)}</span>
          </div>` : ''}
          ${songWithResources.time_signature || songWithResources.suggested_time_signature ? `<div class="detail-item">
            <span class="detail-label">Time Signature</span>
            <span class="detail-value">${escapeHtml(songWithResources.time_signature) || `<span style="color: var(--text-muted); font-style: italic;" title="Suggested">${escapeHtml(songWithResources.suggested_time_signature)}</span>`}</span>
          </div>` : ''}
          ${songWithResources.duration_seconds || songWithResources.suggested_duration ? `<div class="detail-item">
            <span class="detail-label">Duration</span>
            <span class="detail-value">${songWithResources.duration_seconds ? formatDuration(songWithResources.duration_seconds) : `<span style="color: var(--text-muted); font-style: italic;" title="Suggested">${formatDuration(songWithResources.suggested_duration)}</span>`}</span>
          </div>` : ''}
            </div>
          </div>
        </div>
        
        ${(songWithResources.bpm || songWithResources.suggested_bpm) ? `
        <div class="song-click-track">
          <div class="song-click-track-info">
            <p class="song-click-track-title"><i class="fa-solid fa-drum"></i> Click Track</p>
            <p class="song-click-track-description">Set to ${songWithResources.bpm || songWithResources.suggested_bpm} BPM</p>
          </div>
          <button class="btn primary click-track-btn" data-bpm="${songWithResources.bpm || songWithResources.suggested_bpm}" title="Click Track">
            ${state.metronome.isPlaying && state.metronome.bpm === (songWithResources.bpm || songWithResources.suggested_bpm)
        ? `<i class="fa-solid fa-pause"></i> Stop`
        : `<i class="fa-solid fa-play"></i> Click`}
          </button>
        </div>
        ` : ''
    }
        
        ${songWithResources.description ? `
        <div class="song-details-section">
          <h3 class="section-title">Description</h3>
          <p class="song-details-description">${escapeHtml(songWithResources.description)}</p>
        </div>
        ` : ''
    }
        
       ${(songWithResources.suggested_song_key || songWithResources.suggested_time_signature) ? `
        <div style="text-align: right; margin-top: 0.5rem; font-size: 0.7rem; color: var(--text-muted);">
           Some data provided by <a href="https://getsongbpm.com" target="_blank" rel="noopener noreferrer" style="color: inherit;">GetSongBPM</a>
        </div>
       ` : ''}

        ${hasResources ? `
        <div class="resources-section-wrapper">
          <div class="resources-wave-divider">
            <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <defs>
                <clipPath id="clip-solid">
                  <rect x="0" y="0" width="900" height="120" />
                </clipPath>
                <clipPath id="clip-dashed">
                  <rect x="900" y="0" width="300" height="120" />
                </clipPath>
              </defs>
              <path d="M0,60 Q50,20 100,60 T200,60 T300,60 T400,60 T500,60 T600,60 T700,60 T800,60 T900,60 T1000,60 T1100,60 T1200,60 V120 H0 Z" class="shape-fill"></path>
              <path d="M0,60 Q50,20 100,60 T200,60 T300,60 T400,60 T500,60 T600,60 T700,60 T800,60 T900,60 T1000,60 T1100,60 T1200,60" class="wave-border-solid" fill="none" vector-effect="non-scaling-stroke" clip-path="url(#clip-solid)"></path>
              <path d="M0,60 Q50,20 100,60 T200,60 T300,60 T400,60 T500,60 T600,60 T700,60 T800,60 T900,60 T1000,60 T1100,60 T1200,60" class="wave-border-dashed" fill="none" vector-effect="non-scaling-stroke" clip-path="url(#clip-dashed)"></path>
            </svg>
          </div>
          <div class="resources-content-area">
            <div class="song-details-section">
              <h1 class="section-title" style="margin-top:0.5rem; font-size:2rem;">Resources & Links</h1>
              <div class="song-details-links"></div>
            </div>
          </div>
        </div>
        ` : ''
    }
      </div>
  `;

  // Render links organized by key
  if (hasResources) {
    const linksContainer = content.querySelector(".song-details-links");
    if (linksContainer) {
      // Render general links
      if (generalLinks.length > 0 || allGeneralCharts.length > 0) {
        const generalSection = document.createElement("div");
        generalSection.style.marginBottom = "1.5rem";
        const generalTitle = document.createElement("h4");
        generalTitle.className = "section-subtitle";
        generalTitle.textContent = "General";
        generalTitle.style.marginBottom = "0.5rem";
        generalSection.appendChild(generalTitle);
        const generalLinksContainer = document.createElement("div");
        const generalChartItems = [];
        // Add all general charts (number + chord charts) in display_order
        allGeneralCharts.forEach(chart => {
          generalChartItems.push({
            __resourceType: "chart",
            title: chart.chart_type === "number" ? "Number Chart" : "Chord Chart",
            subtitle: chart.chart_type === "number" ? "General • Number chart" : "General • Chord chart",
            songId: songWithLinks.id,
            songTitle: songWithLinks.title || "",
            scope: "general",
            songKey: null,
            chartType: chart.chart_type,
            layout: chart.layout,
            doc: chart.doc,
            readOnly: false,
            display_order: chart.display_order ?? Number.POSITIVE_INFINITY,
          });
        });

        // Debug: log what we have before sorting
        console.log("Before sorting - Charts:", generalChartItems.map(c => ({ title: c.title, display_order: c.display_order })));
        console.log("Before sorting - Links:", generalLinks.map(l => ({ title: l.title, display_order: l.display_order, id: l.id })));
        // Merge charts and links, then sort by display_order to maintain correct interleaved order
        // Ensure display_order is a number (handle null, undefined, or string values)
        const allGeneralResources = [...generalChartItems, ...generalLinks].sort((a, b) => {
          const ao = typeof a?.display_order === 'number' ? a.display_order : (a?.display_order != null ? Number(a.display_order) : Number.POSITIVE_INFINITY);
          const bo = typeof b?.display_order === 'number' ? b.display_order : (b?.display_order != null ? Number(b.display_order) : Number.POSITIVE_INFINITY);

          // Debug logging
          if (ao === Number.POSITIVE_INFINITY || bo === Number.POSITIVE_INFINITY || isNaN(ao) || isNaN(bo)) {
            console.log("Sorting resources:", {
              a: { type: a.__resourceType || 'link', title: a.title, display_order: a.display_order, ao },
              b: { type: b.__resourceType || 'link', title: b.title, display_order: b.display_order, bo }
            });
          }

          if (ao !== bo) return ao - bo;
          // If display_order is the same, sort by type (charts first, then links)
          if (a.__resourceType === 'chart' && b.__resourceType !== 'chart') return -1;
          if (a.__resourceType !== 'chart' && b.__resourceType === 'chart') return 1;
          // If both are same type, sort by title
          const at = (a?.title || "").toLowerCase();
          const bt = (b?.title || "").toLowerCase();
          return at.localeCompare(bt);
        });

        // Debug: log final order
        console.log("General resources final order:", allGeneralResources.map(r => ({
          type: r.__resourceType || 'link',
          title: r.title,
          display_order: r.display_order
        })));
        renderSongLinksDisplay(allGeneralResources, generalLinksContainer);
        generalSection.appendChild(generalLinksContainer);
        linksContainer.appendChild(generalSection);
      }

      // Render selected key links
      if (selectedKey && (selectedKeyLinks.length > 0 || keyChartByKey.has(normalizeKeyLabel(selectedKey)) || (generalChart && generalChart.chart_type === "number"))) {
        const selectedSection = document.createElement("div");
        selectedSection.style.marginBottom = "1.5rem";
        const selectedTitle = document.createElement("h4");
        selectedTitle.className = "section-subtitle";
        selectedTitle.textContent = `Key: ${escapeHtml(selectedKey)} `;
        selectedTitle.style.marginBottom = "0.5rem";
        selectedSection.appendChild(selectedTitle);
        const selectedLinksContainer = document.createElement("div");
        const selectedChartItems = [];
        const existingKeyChart = keyChartByKey.get(normalizeKeyLabel(selectedKey));
        if (existingKeyChart) {
          selectedChartItems.push({
            __resourceType: "chart",
            title: "Chord Chart",
            subtitle: `Key: ${selectedKey}`,
            songId: songWithLinks.id,
            songTitle: songWithLinks.title || "",
            scope: "key",
            songKey: selectedKey,
            chartType: "chord",
            layout: existingKeyChart.layout,
            doc: existingKeyChart.doc,
            readOnly: false,
            display_order: existingKeyChart.display_order ?? Number.POSITIVE_INFINITY,
          });
        } else if (generalChart && generalChart.chart_type === "number") {
          // Validate key before generating
          if (parseKeyToPitchClass(selectedKey)) {
            selectedChartItems.push({
              __resourceType: "chart",
              title: "Chord Chart",
              subtitle: `Key: ${selectedKey}`,
              songId: songWithLinks.id,
              songTitle: songWithLinks.title || "",
              scope: "key",
              songKey: selectedKey,
              layout: generalChart.layout || "one_column",
              readOnly: true,
              generatedFromNumber: true,
              sourceDoc: generalChart.doc,
              targetKey: selectedKey,
              display_order: Number.POSITIVE_INFINITY, // Generated charts go to end
            });
          }
        }
        // Merge charts and links, then sort by display_order to maintain correct interleaved order
        // Ensure display_order is a number (handle null, undefined, or string values)
        const allSelectedResources = [...selectedChartItems, ...selectedKeyLinks].sort((a, b) => {
          const ao = typeof a?.display_order === 'number' ? a.display_order : (a?.display_order != null ? Number(a.display_order) : Number.POSITIVE_INFINITY);
          const bo = typeof b?.display_order === 'number' ? b.display_order : (b?.display_order != null ? Number(b.display_order) : Number.POSITIVE_INFINITY);
          if (ao !== bo) return ao - bo;
          // If display_order is the same, sort by type (charts first, then links)
          if (a.__resourceType === 'chart' && b.__resourceType !== 'chart') return -1;
          if (a.__resourceType !== 'chart' && b.__resourceType === 'chart') return 1;
          // If both are same type, sort by title
          const at = (a?.title || "").toLowerCase();
          const bt = (b?.title || "").toLowerCase();
          return at.localeCompare(bt);
        });
        renderSongLinksDisplay(allSelectedResources, selectedLinksContainer);
        selectedSection.appendChild(selectedLinksContainer);
        linksContainer.appendChild(selectedSection);
      }

      // Render other keys links
      const shouldShowOtherKeys =
        Object.keys(linksByKey).length > 0 ||
        (hasKeys && (keyCharts.length > 0 || (generalChart && generalChart.chart_type === "number")));

      if (shouldShowOtherKeys) {
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

        // Render links/charts for each key
        const keysToRender = new Set();
        Object.keys(linksByKey).forEach(k => keysToRender.add(k));
        (keysArray || []).forEach(kObj => {
          const k = normalizeKeyLabel(kObj?.key);
          if (k) keysToRender.add(k);
        });

        // Include keys from existing key charts even if song keys were removed/renamed
        keyChartByKey.forEach((_chart, k) => {
          const kk = normalizeKeyLabel(k);
          if (kk) keysToRender.add(kk);
        });

        Array.from(keysToRender).sort().forEach(key => {
          const keySection = document.createElement("div");
          keySection.style.marginBottom = "1rem";
          const keyTitle = document.createElement("h5");
          keyTitle.className = "section-subtitle";
          keyTitle.textContent = `Key: ${escapeHtml(key)} `;
          keyTitle.style.marginBottom = "0.5rem";
          keyTitle.style.fontSize = "0.9rem";
          keySection.appendChild(keyTitle);
          const keyLinksContainer = document.createElement("div");
          const keyLinks = linksByKey[key] || [];
          const keyChartItems = [];
          const existingKeyChart = keyChartByKey.get(normalizeKeyLabel(key));
          if (existingKeyChart) {
            keyChartItems.push({
              __resourceType: "chart",
              title: "Chord Chart",
              subtitle: `Key: ${key}`,
              songId: songWithLinks.id,
              songTitle: songWithLinks.title || "",
              scope: "key",
              songKey: key,
              chartType: "chord",
              layout: existingKeyChart.layout,
              doc: existingKeyChart.doc,
              readOnly: false,
              display_order: existingKeyChart.display_order ?? Number.POSITIVE_INFINITY,
            });
          } else if (generalChart && generalChart.chart_type === "number") {
            // Validate key before generating
            if (parseKeyToPitchClass(key)) {
              keyChartItems.push({
                __resourceType: "chart",
                title: "Chord Chart",
                subtitle: `Key: ${key}`,
                songId: songWithLinks.id,
                songTitle: songWithLinks.title || "",
                scope: "key",
                songKey: key,
                layout: generalChart.layout || "one_column",
                readOnly: true,
                generatedFromNumber: true,
                sourceDoc: generalChart.doc,
                targetKey: key,
                display_order: Number.POSITIVE_INFINITY, // Generated charts go to end
              });
            }
          }
          // Merge charts and links, then sort by display_order to maintain correct interleaved order
          // Ensure display_order is a number (handle null, undefined, or string values)
          const combined = [...keyChartItems, ...(Array.isArray(keyLinks) ? keyLinks : [])].sort((a, b) => {
            const ao = typeof a?.display_order === 'number' ? a.display_order : (a?.display_order != null ? Number(a.display_order) : Number.POSITIVE_INFINITY);
            const bo = typeof b?.display_order === 'number' ? b.display_order : (b?.display_order != null ? Number(b.display_order) : Number.POSITIVE_INFINITY);
            if (ao !== bo) return ao - bo;
            // If display_order is the same, sort by type (charts first, then links)
            if (a.__resourceType === 'chart' && b.__resourceType !== 'chart') return -1;
            if (a.__resourceType !== 'chart' && b.__resourceType === 'chart') return 1;
            // If both are same type, sort by title
            const at = (a?.title || "").toLowerCase();
            const bt = (b?.title || "").toLowerCase();
            return at.localeCompare(bt);
          });
          if (combined.length > 0) {
            renderSongLinksDisplay(combined, keyLinksContainer);
          }
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

  // Album art overlay controls are shown/hidden via CSS :hover.
  // Here we only prevent clicks on controls from opening the full-screen modal.
  const albumArtContainer = content.querySelector("#song-album-art-placeholder");
  const overlayControls = content.querySelector("#album-art-overlay-controls");
  if (albumArtContainer && overlayControls && isManager()) {
    // Stop event propagation on overlay controls to prevent opening modal
    overlayControls.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Also stop propagation on buttons and labels within overlay
    const buttons = overlayControls.querySelectorAll("button, label");
    buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    });
  }

  // Album art is handled asynchronously below (loading → loaded or collapse/no-image).

  // Setup album art upload handler
  const uploadInput = content.querySelector("#album-art-upload-input");
  if (uploadInput && isManager()) {
    uploadInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toastError("Please select an image file.");
        e.target.value = '';
        return;
      }

      // Validate file size
      const validation = validateFileSize(file);
      if (!validation.valid) {
        toastError(validation.error);
        e.target.value = '';
        return;
      }

      try {
        // Delete old override if it exists
        if (songWithLinks.album_art_override_path) {
          await deleteFileFromSupabase(songWithLinks.album_art_override_path);
        }

        // Upload new file (album art)
        const uploadResult = await uploadFileToSupabase(file, songWithLinks.id, null, state.currentTeamId, true);
        if (!uploadResult.success) {
          toastError(`Failed to upload album art: ${uploadResult.error}`);
          e.target.value = '';
          return;
        }

        // Update song with new override path
        const { error: updateError } = await supabase
          .from("songs")
          .update({ album_art_override_path: uploadResult.filePath })
          .eq("id", songWithLinks.id);

        if (updateError) {
          console.error("Error updating album art override:", updateError);
          toastError("Failed to save album art. Check console.");
          // Try to delete the uploaded file
          await deleteFileFromSupabase(uploadResult.filePath);
          e.target.value = '';
          return;
        }

        // Update local song data
        songWithLinks.album_art_override_path = uploadResult.filePath;

        // Reload album art
        const albumArtData = await getAlbumArt(songWithLinks, songWithLinks.title, { disableItunesFallback: teamItunesDisabled });
        if (albumArtData) {
          displayAlbumArt(content, albumArtData, songWithLinks);
        }

        // Update remove button visibility
        const removeBtn = content.querySelector("#remove-album-art-btn");
        if (removeBtn) {
          removeBtn.style.display = "block";
        } else {
          // Add remove button if it doesn't exist
          const overlayControls = content.querySelector("#album-art-overlay-controls");
          if (overlayControls) {
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "btn small ghost";
            removeBtn.id = "remove-album-art-btn";
            removeBtn.style.cssText = "margin: 0; padding: 0.4rem 0.6rem;";
            removeBtn.title = "Remove custom album art";
            removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            removeBtn.addEventListener("click", async () => {
              await removeAlbumArtOverride(songWithLinks.id, songWithLinks.album_art_override_path);
              songWithLinks.album_art_override_path = null;
              removeBtn.remove();
              // Reload album art from iTunes
              const albumArtData = await getAlbumArt(songWithLinks, songWithLinks.title, { disableItunesFallback: teamItunesDisabled });
              if (albumArtData) {
                displayAlbumArt(content, albumArtData, songWithLinks);
              } else if (canUploadAlbumArt) {
                showSongAlbumArtNoImagePlaceholder(content);
              } else {
                collapseSongAlbumArt(content);
              }
            });
            overlayControls.appendChild(removeBtn);
          }
        }

        toastSuccess("Album art uploaded successfully!");
        e.target.value = '';
      } catch (error) {
        console.error("Error uploading album art:", error);
        toastError("Failed to upload album art. Check console.");
        e.target.value = '';
      }
    });
  }

  // Setup remove album art button
  const removeBtn = content.querySelector("#remove-album-art-btn");
  if (removeBtn && isManager()) {
    removeBtn.addEventListener("click", async () => {
      await removeAlbumArtOverride(songWithLinks.id, songWithLinks.album_art_override_path);
      songWithLinks.album_art_override_path = null;
      removeBtn.remove();
      // Reload album art from iTunes
      const albumArtData = await getAlbumArt(songWithLinks, songWithLinks.title, { disableItunesFallback: teamItunesDisabled });
      if (albumArtData) {
        displayAlbumArt(content, albumArtData, songWithLinks);
      } else if (canUploadAlbumArt) {
        showSongAlbumArtNoImagePlaceholder(content);
      } else {
        collapseSongAlbumArt(content);
      }
    });
  }

  // Fetch and display album art asynchronously (don't block modal opening)
  showSongAlbumArtLoadingPlaceholder(content);
  getAlbumArt(songWithLinks, songWithLinks.title, { disableItunesFallback: teamItunesDisabled || isWaitingOnItunesIndex }).then(albumArtData => {
    if (albumArtData) {
      displayAlbumArt(content, albumArtData, songWithLinks);
    } else if (canUploadAlbumArt) {
      showSongAlbumArtNoImagePlaceholder(content);
    } else if (isWaitingOnItunesIndex) {
      // Keep shimmer visible while server-side iTunes indexing is pending.
      showSongAlbumArtLoadingPlaceholder(content);
    } else {
      collapseSongAlbumArt(content);
    }
  }).catch(err => {
    console.warn('Failed to load album art:', err);
    if (canUploadAlbumArt) {
      showSongAlbumArtNoImagePlaceholder(content);
    } else if (isWaitingOnItunesIndex) {
      showSongAlbumArtLoadingPlaceholder(content);
    } else {
      collapseSongAlbumArt(content);
    }
  });

  // Logic for Edit Dropdown
  const dropdownContainer = content.querySelector("#song-details-edit-dropdown");
  if (dropdownContainer) {
    const toggleBtn = dropdownContainer.querySelector("#btn-song-details-edit-toggle");
    const menu = dropdownContainer.querySelector(".header-dropdown-menu");
    const globalEditBtn = menu.querySelector("#btn-song-details-edit-global");
    const setEditBtn = menu.querySelector("#btn-song-details-edit-set");
    const resetAlbumArtBtn = menu.querySelector("#btn-song-details-reset-album-art");

    // Toggle Menu
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!dropdownContainer.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });

    // Global Edit Action
    if (globalEditBtn) {
      globalEditBtn.addEventListener("click", () => {
        closeSongDetailsModal();
        openSongEditModal(song.id);
      });
    }

    // Set Edit Action
    if (setEditBtn && setSongContext) {
      setEditBtn.addEventListener("click", () => {
        closeSongDetailsModal();
        openEditSetSongModal(setSongContext);
      });
    }

    // Reset Album Art Action
    if (resetAlbumArtBtn && songWithLinks.album_art_override_path) {
      resetAlbumArtBtn.addEventListener("click", async () => {
        menu.classList.add("hidden");
        await removeAlbumArtOverride(songWithLinks.id, songWithLinks.album_art_override_path);
        songWithLinks.album_art_override_path = null;

        // Update remove button in overlay
        const overlayRemoveBtn = content.querySelector("#remove-album-art-btn");
        if (overlayRemoveBtn) {
          overlayRemoveBtn.remove();
        }

        // Update dropdown menu - remove reset option
        resetAlbumArtBtn.remove();

        // Reload album art from iTunes
        const albumArtData = await getAlbumArt(songWithLinks, songWithLinks.title, { disableItunesFallback: teamItunesDisabled });
        if (albumArtData) {
          displayAlbumArt(content, albumArtData, songWithLinks);
        } else if (canUploadAlbumArt) {
          showSongAlbumArtNoImagePlaceholder(content);
        } else {
          collapseSongAlbumArt(content);
        }
      });
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

  // Attribution logic
  if (songWithLinks.suggested_song_key || songWithLinks.suggested_time_signature) {
    const attribution = document.createElement("p");
    attribution.className = "muted small-text";
    attribution.style.textAlign = "right";
    attribution.style.marginTop = "2rem";
    attribution.style.marginBottom = "0.5rem";
    attribution.style.fontSize = "0.7rem";
    attribution.innerHTML = 'Some data provided by <a href="https://getsongbpm.com" target="_blank" rel="noopener noreferrer" style="color: inherit;">GetSongBPM</a>';

    // Append to the section if possible to keep padding correct
    const section = content.querySelector(".song-details-section");
    if (section) {
      section.appendChild(attribution);
    } else {
      content.appendChild(attribution);
    }
  }

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
    // Stop all audio players in the modal BEFORE animation starts (optional, but cleaner)
    const audioPlayers = modal.querySelectorAll("audio");
    audioPlayers.forEach(audio => {
      audio.pause();
      audio.currentTime = 0; // Reset to beginning
    });

    closeModalWithAnimation(modal, () => {
      state.currentSongDetailsId = null;
    });
  }
}

function showSongAlbumArtLoadingPlaceholder(content) {
  const container = content?.querySelector?.("#song-album-art-placeholder");
  const imgEl = content?.querySelector?.("#song-album-art-img");
  const noImageEl = content?.querySelector?.("#song-album-art-no-image");
  if (!container) return;

  container.style.display = "flex";
  container.dataset.collapseToken = "";
  container.classList.remove("album-art-collapsed", "album-art-loaded");
  container.classList.add("album-art-loading");

  if (imgEl) imgEl.style.display = "none";
  if (noImageEl) noImageEl.classList.add("hidden");
}

function collapseSongAlbumArt(content) {
  const container = content?.querySelector?.("#song-album-art-placeholder");
  const imgEl = content?.querySelector?.("#song-album-art-img");
  const noImageEl = content?.querySelector?.("#song-album-art-no-image");
  if (!container) return;

  // Ensure it's in the layout so the collapse can animate.
  container.style.display = "flex";
  container.classList.remove("album-art-loading", "album-art-loaded");
  container.classList.add("album-art-collapsed");

  if (imgEl) imgEl.style.display = "none";
  if (noImageEl) noImageEl.classList.add("hidden");

  const token = String(Date.now());
  container.dataset.collapseToken = token;
  setTimeout(() => {
    if (container.dataset.collapseToken === token && container.classList.contains("album-art-collapsed")) {
      container.style.display = "none";
    }
  }, 380);
}

async function refreshOpenSongDetailsAlbumArtFromIndexRefresh(updatedRowsById) {
  const songId = state.currentSongDetailsId;
  if (!songId) return;

  const modal = el("song-details-modal");
  const content = el("song-details-content");
  if (!modal || !content) return;
  if (modal.classList.contains("hidden")) return;

  const baseSong = (state.songs || []).find(s => s?.id === songId);
  const upd = updatedRowsById?.get?.(songId);
  const songForArt = baseSong ? { ...baseSong, ...(upd || {}) } : (upd || null);
  if (!songForArt) return;

  const teamItunesDisabled = (state.userTeams?.find?.(t => t.id === state.currentTeamId)?.itunes_indexing_enabled === false);
  const isWaitingOnItunesIndex =
    !!songForArt?.title &&
    songForArt.title.trim() &&
    !songForArt.itunes_indexed_at &&
    !songForArt.itunes_fetch_disabled &&
    !teamItunesDisabled;

  // If we're still waiting, keep the shimmer visible between refreshes.
  if (isWaitingOnItunesIndex) {
    showSongAlbumArtLoadingPlaceholder(content);
  }

  const canUploadAlbumArt = !!content.querySelector("#album-art-overlay-controls");
  const albumArtData = await getAlbumArt(songForArt, songForArt.title, { disableItunesFallback: teamItunesDisabled || isWaitingOnItunesIndex });
  if (albumArtData) {
    displayAlbumArt(content, albumArtData, songForArt);
  } else if (canUploadAlbumArt) {
    showSongAlbumArtNoImagePlaceholder(content);
  } else if (!isWaitingOnItunesIndex) {
    collapseSongAlbumArt(content);
  } else {
    showSongAlbumArtLoadingPlaceholder(content);
  }
}

function showSongAlbumArtNoImagePlaceholder(content) {
  const container = content?.querySelector?.("#song-album-art-placeholder");
  const imgEl = content?.querySelector?.("#song-album-art-img");
  const noImageEl = content?.querySelector?.("#song-album-art-no-image");
  if (container) {
    container.style.display = "flex";
    container.dataset.collapseToken = "";
    container.classList.remove("album-art-loading", "album-art-loaded", "album-art-collapsed");
  }
  if (imgEl) imgEl.style.display = "none";
  if (noImageEl) noImageEl.classList.remove("hidden");
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
  if (!setSong.song_resources || !setSong.song_assignments) {
    const { data } = await supabase
      .from("set_songs")
      .select(`
  *,
  song_resources(
    id,
    team_id,
    type,
    title,
    url,
    file_path,
    file_name,
    file_type,
    key,
    display_order
  ),
  song_assignments(
    id,
    person_id,
    person_name,
    person_email,
    pending_invite_id,
    role,
    status,
    person: person_id(
      id,
      full_name
    ),
    pending_invite: pending_invite_id(
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

  // Ensure resources are ordered by display_order
  if (sectionWithData && Array.isArray(sectionWithData.song_resources)) {
    sectionWithData.song_resources = [...sectionWithData.song_resources].sort((a, b) => {
      const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
      const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
      return ao - bo;
    });
  }

  // Filter for links/files only (conceptually section details might just show basic links unless we want charts too?)
  // For now, let's treat resources as links if they are not charts, or just show all?
  // Existing logic filtered song_links.
  // Let's filter song_resources for type='link' or 'file'.
  // Charts might be interesting to show too, but let's stick to links for now to match behavior.
  const allResources = sectionWithData.song_resources || [];
  const links = allResources.filter(r => r.type === 'link' || r.type === 'file');

  const hasLinks = links.length > 0;
  const hasAssignments = (sectionWithData.song_assignments || []).length > 0;
  const plannedDurationSeconds = getSetSongDurationSeconds(sectionWithData);
  const durationLabel = plannedDurationSeconds !== undefined && plannedDurationSeconds !== null
    ? formatDuration(plannedDurationSeconds)
    : null;

  // Keep variable name for compatibility with rendering logic below
  sectionWithData.song_links = links;

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
      ` : ''
    }
      
      ${sectionWithData.notes ? `
      <div class="song-details-section">
        <h3 class="section-title">Notes</h3>
        <p class="song-details-description">${escapeHtml(sectionWithData.notes)}</p>
      </div>
      ` : ''
    }
      
      ${hasAssignments ? `
      <div class="song-details-section">
        <h3 class="section-title">Assignments</h3>
        <div class="song-details-assignments"></div>
      </div>
      ` : ''
    }
      
      ${hasLinks ? `
      <div class="song-details-section">
        <h3 class="section-title" style="margin-top:1.25rem;">Resources & Links</h3>
        <div class="song-details-links"></div>
      </div>
      ` : ''
    }
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
  const resources = collectSongResources();
  renderSongLinks(resources); // TODO: Rename to renderSongResources
}

function renderSongKeys(keys) {
  const container = el("song-keys-list");
  if (!container) return;

  container.innerHTML = "";

  keys.forEach((keyItem, index) => {
    const div = document.createElement("div");
    div.className = "song-key-row";
    div.dataset.keyId = keyItem.id || `new- ${index} `;
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
const PROFILE_PICTURES_BUCKET = 'profile-pictures';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

// Validate file size (20MB limit)
function validateFileSize(file) {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 20MB limit.Current size: ${(file.size / 1024 / 1024).toFixed(2)} MB`
    };
  }
  return { valid: true };
}

// Get MIME type from file
function getFileType(file) {
  return file.type || 'application/octet-stream';
}

// Generate file path for Supabase Storage
function generateFilePath(teamId, songId, setSongId, fileName, isAlbumArt = false) {
  const uuid = crypto.randomUUID();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const extension = fileName.split('.').pop();
  const uniqueFileName = `${uuid}-${timestamp}.${extension}`;

  if (songId) {
    if (isAlbumArt) {
      return `${teamId}/songs/${songId}/album-art/${uniqueFileName}`;
    }
    return `${teamId}/songs/${songId}/${uniqueFileName}`;
  } else if (setSongId) {
    return `${teamId}/sections/${setSongId}/${uniqueFileName}`;
  }
  throw new Error('Either songId or setSongId must be provided');
}

// Generate file path for profile pictures (user-specific, not team-specific)
function generateProfilePicturePath(userId, fileName) {
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();
  const extension = fileName.split('.').pop();
  const uniqueFileName = `${uuid}-${timestamp}.${extension}`;
  // User-specific path structure
  return `profiles/${userId}/${uniqueFileName}`;
}

// Upload profile picture to Supabase Storage
async function uploadProfilePicture(file, userId) {
  try {
    // Validate file size (max 5MB for profile pictures)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { success: false, error: 'Profile picture must be less than 5MB' };
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }

    // Generate file path (user-specific)
    const filePath = generateProfilePicturePath(userId, file.name);

    // Upload file to dedicated profile pictures bucket
    const { data, error } = await supabase.storage
      .from(PROFILE_PICTURES_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Profile picture upload error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      filePath: data.path
    };
  } catch (error) {
    console.error('Profile picture upload exception:', error);
    return { success: false, error: error.message || 'Failed to upload profile picture' };
  }
}

// Upload file to Supabase Storage
async function uploadFileToSupabase(file, songId, setSongId, teamId, isAlbumArt = false) {
  try {
    // Validate file size
    const validation = validateFileSize(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate file path
    const filePath = generateFilePath(teamId, songId, setSongId, file.name, isAlbumArt);

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
async function getFileUrl(filePath, bucket = STORAGE_BUCKET) {
  if (!filePath) {
    console.error('getFileUrl called with null/undefined filePath');
    return null;
  }

  try {
    console.log('Generating signed URL for:', filePath, 'from bucket:', bucket);
    const { data, error } = await supabase.storage
      .from(bucket)
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

const AUDIO_TRANSPOSE_LIMITS = { min: -12, max: 12 };
const AUDIO_PITCH_SHIFT_WORKLET_URL = "https://cdn.jsdelivr.net/npm/@soundtouchjs/audio-worklet@0.2.1/dist/soundtouch-worklet.js";
const audioPitchShiftRegistry = new WeakMap();
let audioPitchShiftContext = null;
let audioPitchShiftModulePromise = null;

function supportsAudioPitchShift() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return !!AudioContextClass && typeof AudioWorkletNode !== "undefined";
}

function normalizeKeyToken(keyStr) {
  const raw = String(keyStr || "").trim();
  if (!raw) return null;
  const hasMinorWord = /\bminor\b/i.test(raw) || /\bmin\b/i.test(raw);
  const match = raw.match(/([A-Ga-g])([#b]?)(m(?!aj))?/);
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const accidental = match[2] || "";
  const isMinor = !!match[3] || hasMinorWord;
  return `${letter}${accidental}${isMinor ? "m" : ""}`;
}

function getTransposedKeyInfo(baseKey, semitones) {
  const token = normalizeKeyToken(baseKey);
  if (!token) return null;
  const parsed = parseKeyToPitchClass(token);
  if (!parsed) return null;
  const baseName = `${pitchClassToNoteName(parsed.pc, parsed.preferFlats)}${parsed.isMinor ? "m" : ""}`;
  const targetPc = (parsed.pc + semitones + 120) % 12;
  const targetName = `${pitchClassToNoteName(targetPc, parsed.preferFlats)}${parsed.isMinor ? "m" : ""}`;
  return { base: baseName, transposed: targetName };
}

async function ensureSoundTouchForAudio(audioEl) {
  if (!supportsAudioPitchShift() || !audioEl) return null;

  const existing = audioPitchShiftRegistry.get(audioEl);
  if (existing?.ready) return existing;
  if (existing?.initializing) return existing.initializing;

  const initPromise = (async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioPitchShiftContext) {
      audioPitchShiftContext = new AudioContextClass();
    }

    if (!audioPitchShiftModulePromise) {
      audioPitchShiftModulePromise = audioPitchShiftContext.audioWorklet
        .addModule(AUDIO_PITCH_SHIFT_WORKLET_URL)
        .catch(err => {
          audioPitchShiftModulePromise = null;
          throw err;
        });
    }

    await audioPitchShiftModulePromise;

    const soundtouchNode = new AudioWorkletNode(audioPitchShiftContext, "soundtouch-processor");
    const sourceNode = audioPitchShiftContext.createMediaElementSource(audioEl);
    sourceNode.connect(soundtouchNode);
    soundtouchNode.connect(audioPitchShiftContext.destination);

    const params = soundtouchNode.parameters;
    if (params?.get("tempo")) params.get("tempo").value = 1;
    if (params?.get("rate")) params.get("rate").value = 1;
    if (params?.get("pitchSemitones")) params.get("pitchSemitones").value = 0;

    if (audioPitchShiftContext.state === "suspended") {
      try {
        await audioPitchShiftContext.resume();
      } catch (err) {
        console.warn("AudioContext resume blocked:", err);
      }
    }

    const readyEntry = {
      audioContext: audioPitchShiftContext,
      soundtouchNode,
      sourceNode,
      ready: true,
    };
    audioPitchShiftRegistry.set(audioEl, readyEntry);
    return readyEntry;
  })().catch(err => {
    audioPitchShiftRegistry.delete(audioEl);
    throw err;
  });

  audioPitchShiftRegistry.set(audioEl, { initializing: initPromise, ready: false });
  return initPromise;
}

function buildAudioTransposeControls(audioEl, { baseKey } = {}) {
  if (!audioEl) return null;

  const controls = document.createElement("div");
  controls.className = "audio-transpose-controls";

  const label = document.createElement("span");
  label.className = "audio-transpose-label";
  label.textContent = "Transpose";

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "audio-transpose-button";
  downBtn.textContent = "-";
  downBtn.setAttribute("aria-label", "Transpose down one semitone");

  const value = document.createElement("span");
  value.className = "audio-transpose-value";
  value.title = "Click to reset";

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "audio-transpose-button";
  upBtn.textContent = "+";
  upBtn.setAttribute("aria-label", "Transpose up one semitone");

  controls.appendChild(label);
  controls.appendChild(downBtn);
  controls.appendChild(value);
  controls.appendChild(upBtn);

  let currentSemitones = 0;
  let initFailed = false;
  const supportsPitchShift = supportsAudioPitchShift();

  const buildValueLabel = () => {
    const baseLabel = currentSemitones === 0
      ? "0"
      : (currentSemitones > 0 ? `+${currentSemitones}` : `${currentSemitones}`);

    if (!baseKey) return baseLabel;

    const keyInfo = getTransposedKeyInfo(baseKey, currentSemitones);
    if (!keyInfo) return baseLabel;

    const displayKey = currentSemitones === 0 ? keyInfo.base : keyInfo.transposed;
    return `${baseLabel} (${displayKey})`;
  };

  const applyPitchShift = () => {
    if (!supportsPitchShift || initFailed) return;
    const semitonesToApply = currentSemitones;

    void ensureSoundTouchForAudio(audioEl)
      .then(entry => {
        if (!entry?.soundtouchNode) return;
        const params = entry.soundtouchNode.parameters;
        const pitchParam = params?.get("pitchSemitones");
        if (pitchParam) pitchParam.value = semitonesToApply;
        const tempoParam = params?.get("tempo");
        if (tempoParam) tempoParam.value = 1;
        const rateParam = params?.get("rate");
        if (rateParam) rateParam.value = 1;
      })
      .catch(err => {
        initFailed = true;
        console.error("Failed to initialize pitch shifting:", err);
        downBtn.disabled = true;
        upBtn.disabled = true;
        value.textContent = "N/A";
        value.title = "Pitch shift unavailable";
      });
  };

  const update = (apply = false) => {
    value.textContent = buildValueLabel();
    downBtn.disabled = currentSemitones <= AUDIO_TRANSPOSE_LIMITS.min;
    upBtn.disabled = currentSemitones >= AUDIO_TRANSPOSE_LIMITS.max;
    if (apply) applyPitchShift();
  };

  downBtn.addEventListener("click", () => {
    if (currentSemitones <= AUDIO_TRANSPOSE_LIMITS.min) return;
    currentSemitones -= 1;
    update(true);
  });

  upBtn.addEventListener("click", () => {
    if (currentSemitones >= AUDIO_TRANSPOSE_LIMITS.max) return;
    currentSemitones += 1;
    update(true);
  });

  value.addEventListener("click", () => {
    if (currentSemitones === 0) return;
    currentSemitones = 0;
    update(true);
  });

  if (!supportsPitchShift) {
    value.textContent = "N/A";
    value.title = "Pitch shift not supported in this browser";
    downBtn.disabled = true;
    upBtn.disabled = true;
    return controls;
  }

  audioEl.playbackRate = 1;
  audioEl.defaultPlaybackRate = 1;

  audioEl.addEventListener(
    "play",
    () => {
      applyPitchShift();
    },
    { once: true }
  );

  update(false);
  return controls;
}

// ============================================================================
// Song Links Functions
// ============================================================================

// Renamed logic (conceptually renderSongResources) but keeping name for compatibility for now
function renderSongLinks(resources) {
  const container = el("song-links-list");
  if (!container) return;

  container.innerHTML = "";

  // Ensure stable ordering by display_order
  const sortedResources = (Array.isArray(resources) ? [...resources] : []).sort((a, b) => {
    const ao = (a?.display_order ?? Number.POSITIVE_INFINITY);
    const bo = (b?.display_order ?? Number.POSITIVE_INFINITY);
    return ao - bo;
  });

  // Group by key
  const resourcesByKey = {};
  const generalResources = [];

  sortedResources.forEach(res => {
    const key = res.key || ""; // Treat null/undefined key as empty string (General)
    if (!key) {
      generalResources.push(res);
    } else {
      if (!resourcesByKey[key]) resourcesByKey[key] = [];
      resourcesByKey[key].push(res);
    }
  });

  // Get available keys
  const keys = collectSongKeys();
  const keyIdMap = new Map();
  keys.forEach(k => {
    if (k.key) keyIdMap.set(k.key, k.id);
  });

  // Add any keys that have resources but aren't in the song's keys list
  // LOGIC REMOVED: We want resources to disappear if the key is removed.
  /*
  const existingKeyNames = new Set(keys.map(k => k.key));
  Object.keys(resourcesByKey).forEach(resKey => {
    if (!existingKeyNames.has(resKey)) {
      keys.push({ id: null, key: resKey });
    }
  });
  */

  // Auto-generate virtual charts for keys if they don't exist
  // Check for General Number Chart (handle both nested and flattened structure)
  const generalNumberChart = generalResources.find(r => r.type === 'chart' && (r.chart_content?.chart_type === 'number' || r.chart_type === 'number'));
  // Check for General Chord Chart
  const generalChordChart = generalResources.find(r => r.type === 'chart' && (r.chart_content?.chart_type === 'chord' || r.chart_type === 'chord'));

  keys.forEach(keyItem => {
    const k = keyItem.key;
    if (!k) return;

    // Ensure array exists
    if (!resourcesByKey[k]) resourcesByKey[k] = [];

    // Check if we already have a chart
    const hasChart = resourcesByKey[k].some(r => r.type === 'chart');
    if (hasChart) return;

    if (generalNumberChart) {
      // Auto-generate "View Generated" tile derived from Number chart
      // Validate key first
      if (parseKeyToPitchClass(k)) {
        const sourceDoc = generalNumberChart.chart_content?.doc || generalNumberChart.doc;
        resourcesByKey[k].unshift({
          id: null, // Virtual
          type: 'chart',
          display_order: -1, // Put at top
          key: k,
          generated: true,
          numberSourceDoc: sourceDoc,
          targetKey: k,
          // Minimal content needed for renderer
          chart_content: { chart_type: 'chord', scope: 'key', songKey: k, doc: null } // Renderer doesn't strictly need doc here if generated=true handled by buildChartRow
        });
      }
    } else if (generalChordChart) {
      // Auto-generate "Draft" chord chart (start with copy of general)
      // When user clicks Edit, they will edit this copy.
      // Saving it will create a real chart resource.
      const sourceDoc = generalChordChart.chart_content?.doc || generalChordChart.doc;
      const docClone = sourceDoc ? JSON.parse(JSON.stringify(sourceDoc)) : {};
      resourcesByKey[k].unshift({
        id: null,
        type: 'chart',
        display_order: -1,
        key: k,
        generated: false, // It's a draft, so editable
        chart_content: {
          chart_type: 'chord',
          scope: 'key',
          songKey: k,
          doc: docClone
        }
      });
    }
  });

  // Render General section
  renderResourceSection(container, "", generalResources, null);

  // Render section for each key
  keys.forEach(keyItem => {
    renderResourceSection(container, keyItem.key, resourcesByKey[keyItem.key] || [], keyItem.id);
  });

  // Add event listeners (same as before)
  container.querySelectorAll(".add-link-to-section").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key || "";
      addSongLinkToSection(key);
    });
  });

  container.querySelectorAll(".add-file-upload-to-section").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key || "";
      addFileUploadToSection(key);
    });
  });

  container.querySelectorAll(".create-chart-to-section").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key || "";
      const form = el("song-edit-form");
      const songId = form?.dataset?.songId || null;
      const songTitle = el("song-edit-title")?.value?.trim?.() || "";
      if (!songId) {
        toastInfo("Save the song first to create charts.");
        return;
      }
      openChordChartEditor({
        songId,
        songTitle,
        scope: key ? "key" : "general",
        songKey: key || null,
        existingChart: null,
      });
    });
  });

  // Normalize data-display-order across all sections after render
  updateAllLinkOrderInDom();
}

function renderResourceSection(container, key, resources, keyId = null) {
  const section = document.createElement("div");
  section.className = "song-links-section";
  section.dataset.key = key;
  if (keyId) section.dataset.keyId = keyId;

  const header = document.createElement("div");
  // ... (rest of function)
  header.className = "song-links-section-header";
  header.innerHTML = `
      <h4>${key ? `Key: ${escapeHtml(key)}` : "General Resources"}</h4>
      <div class="song-links-section-actions">
        <button type="button" class="btn small secondary add-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
        <button type="button" class="btn small secondary create-chart-to-section" data-key="${escapeHtml(key)}">Create Chart</button>
      </div>
    `;
  section.appendChild(header);

  const content = document.createElement("div");
  content.className = "song-links-section-content";

  resources.forEach((res, index) => {
    let row;
    if (res.type === 'chart') {
      // Adapt resource to chart object structure for buildChartRow
      const chartObj = {
        id: res.id,
        title: res.title,
        key: res.key, // resource key
        song_key: res.key, // chart expectations
        type: 'chart', // CRITICAL: Ensure type is preserved for collectSongResources
        chart_type: res.chart_content?.chart_type || res.chart_type || 'chord',
        scope: res.chart_content?.scope || res.scope || (res.key ? 'key' : 'general'),
        layout: res.chart_content?.layout || res.layout || 'one_column',
        display_order: res.display_order,
        doc: res.chart_content?.doc || res.doc,
        // Persist auto-generation state
        generated: res.generated,
        numberSourceDoc: res.numberSourceDoc,
        targetKey: res.targetKey
      };
      // Need songId/songTitle context. We can get it from the form
      const form = el("song-edit-form");
      const songId = form?.dataset?.songId;
      const songTitle = el("song-edit-title")?.value?.trim?.() || "";

      row = buildChartRow(chartObj, {
        songId,
        songTitle,
        generated: res.generated,
        numberSourceDoc: res.numberSourceDoc,
        targetKey: res.targetKey || res.key
      });
      // We need to make sure buildChartRow sets the right dataset attributes for our new unified system
      row.dataset.resourceType = 'chart';
    } else {
      // Link or File
      // Adapt to what createLinkRow expects
      const linkObj = {
        ...res,
        is_file_upload: res.type === 'file'
      };
      row = createLinkRow(linkObj, index, key);
      row.dataset.resourceType = res.type;
    }

    if (row) {
      row.dataset.resourceId = res.id;
      row.dataset.displayOrder = res.display_order;
      row.dataset.key = key;
      content.appendChild(row);
      if (isManager()) setupLinkDragAndDrop(row, content);
    }
  });

  section.appendChild(content);
  container.appendChild(section);
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
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Resources";
    sectionHeader.innerHTML = `
      <h4>${sectionTitle}</h4>
      <div class="song-links-section-actions">
        <button type="button" class="btn small secondary add-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
        <button type="button" class="btn small secondary create-chart-to-section" data-key="${escapeHtml(key)}">Create Chart</button>
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
  if (isManager()) setupLinkDragAndDrop(linkRow, sectionContent);
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
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Resources";
    sectionHeader.innerHTML = `
      <h4>${sectionTitle}</h4>
      <div class="song-links-section-actions">
        <button type="button" class="btn small secondary add-link-to-section" data-key="${escapeHtml(key)}">Add Link</button>
        <button type="button" class="btn small secondary add-file-upload-to-section" data-key="${escapeHtml(key)}">Upload</button>
        <button type="button" class="btn small secondary create-chart-to-section" data-key="${escapeHtml(key)}">Create Chart</button>
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
  if (isManager()) setupLinkDragAndDrop(linkRow, sectionContent);
  updateLinkOrder(sectionContent);
}

// Replaces collectSongLinks
function collectSongResources() {
  const container = el("song-links-list");
  if (!container) return [];

  const resources = [];
  let globalOrder = 0;

  // Collect from all sections
  const sections = Array.from(container.querySelectorAll(".song-links-section"));
  sections.forEach(section => {
    const sectionContent = section.querySelector(".song-links-section-content");
    if (!sectionContent) return;

    // Iterate ALL rows (links and charts)
    const rows = Array.from(sectionContent.querySelectorAll(".song-link-row"));
    rows.forEach((row) => {
      // Determine type
      // Check for chart class or dataset
      const isChart = row.classList.contains("song-chart-row") || row.dataset.resourceType === 'chart';

      if (isChart) {
        // Retrieve the full resource object if we stored it (prevent data loss)
        if (row.chartResource) {
          const res = row.chartResource;
          res.type = 'chart'; // Ensure type is present
          // Update key and order based on current DOM position
          // If section has a keyId, look up the current value from the inputs
          const keyId = row.closest('.song-links-section')?.dataset?.keyId;
          let currentKey = row.dataset.key; // Fallback to what was on the row/section

          if (keyId) {
            // Find the input with this keyId (if it still exists)
            const keyInputDesc = document.querySelector(`.song-key-row[data-key-id="${keyId}"] input.song-key-input`);
            if (keyInputDesc) {
              currentKey = keyInputDesc.value.trim();
            } else {
              // Input removed -> Key deleted.
              // Move resource to General (empty string)
              currentKey = "";
            }
          }
          else {
            // Fallback: check section dataset if row doesn't have it
            currentKey = row.closest('.song-links-section')?.dataset?.key || null;
          }

          // If it was a generated chart and it lost its key, discard it.
          if (res.generated && !currentKey) {
            return; // Skip this resource
          }

          res.key = currentKey || null;
          res.display_order = globalOrder++;
          resources.push(res);
        } else {
          // Fallback to scraping (legacy/safety)
          const chartId = row.querySelector(".song-chart-id")?.value?.trim() || row.dataset.chartId?.trim() || row.dataset.resourceId?.trim();
          if (chartId) {
            resources.push({
              id: chartId,
              type: 'chart',
              display_order: globalOrder++,
              key: row.dataset.key || null,
              chart_content: { chart_type: 'chord', scope: 'general' } // Basic fallback
            });
          }
        }
      } else {
        // Link or File
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
        const key = keyInput?.value || row.dataset.key || null;
        const id = idInput?.value;
        const isFileUpload = isFileUploadInput?.value === 'true' || row.dataset.isFileUpload === 'true';

        if (isFileUpload) {
          const file = fileInput?.files[0];
          const existingFilePath = filePathInput?.value;
          const existingFileName = fileNameInput?.value;
          const existingFileType = fileTypeInput?.value;

          if (file || existingFilePath) {
            const finalTitle = title || (file ? file.name : existingFileName) || 'Untitled';
            resources.push({
              id: id || null,
              type: 'file',
              title: finalTitle,
              url: null,
              file_path: existingFilePath || null,
              file_name: existingFileName || (file ? file.name : null),
              file_type: existingFileType || (file ? getFileType(file) : null),
              file: file || null,
              key: key,
              display_order: globalOrder++
            });
          }
        } else {
          const url = urlInput?.value.trim();
          if (title && url) {
            resources.push({
              id: id || null,
              type: 'link',
              title,
              url,
              key: key,
              display_order: globalOrder++
            });
          }
        }
      }
    });
  });

  return resources;
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
    <h4>General Resources</h4>
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
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Resources";
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
  if (isManager()) setupLinkDragAndDrop(linkRow, sectionContent);
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
    const sectionTitle = key ? `Key: ${escapeHtml(key)}` : "General Resources";
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
  if (isManager()) setupLinkDragAndDrop(linkRow, sectionContent);
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
            type: 'file',
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
            type: 'link',
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

  // PostHog: Track modal conversion
  trackPostHogEvent('modal_converted', {
    modal_type: songId ? 'edit_song' : 'new_song',
    team_id: state.currentTeamId,
    song_id: songId || response.data.id
  });

  const finalSongId = response.data.id;
  const keys = collectSongKeys();
  const resources = collectSongResources();

  console.log("Collected resources for save:", resources);
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

  // Handle song resources (Unified)
  // Get existing resources
  const { data: existingResources } = await supabase
    .from(SONG_RESOURCES_TABLE)
    .select("*")
    .eq("song_id", finalSongId);

  const existingIds = new Set(existingResources?.map(r => r.id) || []);

  // Categorize
  const newResources = resources.filter(r => !r.id);
  const updatedResources = resources.filter(r => r.id && existingIds.has(r.id));
  const deletedIds = Array.from(existingIds).filter(id => !resources.some(r => r.id === id));

  // 1. Delete removed resources
  if (deletedIds.length > 0) {
    const resourcesToDelete = existingResources.filter(r => deletedIds.includes(r.id));
    // Delete files for deleted resources
    for (const res of resourcesToDelete) {
      if (res.type === 'file' && res.file_path) {
        await deleteFileFromSupabase(res.file_path);
      }
    }

    await supabase.from(SONG_RESOURCES_TABLE).delete().in("id", deletedIds);
  }

  // 2. Update existing resources
  for (const res of updatedResources) {
    const existing = existingResources.find(r => r.id === res.id);

    const updateData = {
      display_order: res.display_order,
      key: res.key || null
    };

    if (res.type === 'chart') {
      // Charts: only update order and key
    } else {
      // Links/Files: Update title, url, file info
      updateData.title = res.title;
      updateData.url = (res.type === 'file') ? null : res.url;

      let filePath = existing.file_path;
      let fileName = existing.file_name;
      let fileType = existing.file_type;

      // If it's a file upload with a new file, upload it
      if (res.type === 'file' && res.file) {
        // Delete old file if it exists
        if (existing.file_path) {
          await deleteFileFromSupabase(existing.file_path);
        }

        // Upload new file
        const uploadResult = await uploadFileToSupabase(res.file, finalSongId, null, state.currentTeamId);
        if (!uploadResult.success) {
          toastError(`Failed to upload file: ${uploadResult.error}`);
          continue;
        }
        filePath = uploadResult.filePath;
        fileName = uploadResult.fileName;
        fileType = uploadResult.fileType;
      }

      updateData.file_path = filePath;
      updateData.file_name = fileName;
      updateData.file_type = fileType;
    }

    await supabase.from(SONG_RESOURCES_TABLE).update(updateData).eq("id", res.id);
  }

  // 3. Insert new resources
  if (newResources.length > 0) {
    for (const res of newResources) {
      if (res.type === 'chart') {
        // Logic for new charts created in list??
        // Currently charts are created via modal which saves them immediately to song_charts (now song_resources).
        // So collecting "new" charts from DOM shouldn't happen unless we dragged a "new" chart?
        // But charts in DOM have IDs.
        // If we somehow have a chart without ID, skipping for safety.
        continue;
      }

      let filePath = null;
      let fileName = null;
      let fileType = null;

      if (res.type === 'file' && res.file) {
        const uploadResult = await uploadFileToSupabase(res.file, finalSongId, null, state.currentTeamId);
        if (!uploadResult.success) {
          toastError(`Failed to upload file: ${uploadResult.error}`);
          continue;
        }
        filePath = uploadResult.filePath;
        fileName = uploadResult.fileName;
        fileType = uploadResult.fileType;
      }

      await supabase.from(SONG_RESOURCES_TABLE).insert({
        song_id: finalSongId,
        team_id: state.currentTeamId,
        type: res.type,
        title: res.title,
        url: res.url,
        file_path: filePath,
        file_name: fileName || res.file_name,
        file_type: fileType || res.file_type,
        key: res.key || null,
        display_order: res.display_order
      });
    }
  }

  // Invalidate chart cache
  if (state.chordCharts && state.chordCharts.cache) {
    state.chordCharts.cache.delete(finalSongId);
  }
  // Continues execution...

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
          *,
          song_resources (
            id,
            team_id,
            type,
            title,
            url,
            file_path,
            file_name,
            file_type,
            key,
            display_order,
            chart_content,
            created_at
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
  const wrapper = el("print-set-container");
  let container = el("print-set-content");

  if (!wrapper) return;

  // Robustness check: recreate content div if it went missing
  if (!container) {
    container = document.createElement("div");
    container.id = "print-set-content";
    container.className = "print-set-content";
    wrapper.appendChild(container);
  }

  if (!set) return;

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

  // Ensure chart container is empty
  const chartWrapper = el("print-chart-container");
  if (chartWrapper) {
    const chartContent = el("print-chart-content");
    if (chartContent) chartContent.innerHTML = "";
    chartWrapper.setAttribute("aria-hidden", "true");
  }

  renderSetPrintPreview(set);
  // Keep it visually hidden on screen; print styles will reveal it
  wrapper.setAttribute("aria-hidden", "false");

  // Track print usage
  trackPostHogEvent('set_printed', {
    set_id: set.id,
    team_id: state.currentTeamId
  });

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



const THEMES = {
  // Simple accent color themes
  green: "#00996d",
  blue: "#009db1ff",
  red: "#ff3d4d",
  yellow: "#ffc800ff",
  purple: "#be54ffff",
  cadencedefault: "#ff7b51",

  // Complex themes
  classic: {
    "--accent-color": "#dcff51",
    "--accent-light": "color-mix(in srgb, var(--accent-color) 20%, black)",
    "--accent-lighter": "color-mix(in srgb, var(--accent-color) 10%, black)",
    "--bg-primary": "#0a0a0a",
    "--bg-secondary": "#1a1a1a",
    "--bg-tertiary": "#252525",
    "--bg-card": "#151515",
    "--bg-card-hover": "#2a2a2a",
    "--text-primary": "#ffffff",
    "--text-secondary": "#e5e5e5",
    "--text-muted": "#a0a0a0",
    "--border-color": "rgba(255, 255, 255, 0.08)",
    "--border-light": "rgba(255, 255, 255, 0.12)",
    "--border-accent": "rgba(220, 255, 81, 0.3)",

    "--glass-bg": "rgba(30, 30, 30, 0.1)",
    "--glass-border": "rgba(255, 255, 255, 0.1)",
    "--glass-shadow": "0 4px 20px rgba(0, 0, 0, 0.4)",
    "--glass-backdrop": "blur(12px)",
    "--songlink-shadow": "inset 0 1.54px 0 rgba(255, 255, 255, 0.059), inset 0 0 18px rgba(255, 255, 255, 0.063)",

    "--chart-accepted-color": "#dcff51",
    "--chart-declined-color": "rgb(255, 96, 33)",
    "--chart-pending-color": "rgb(255, 180, 59)"
  },

  ocean: {
    "--accent-color": "#00e5ff",
    "--bg-primary": "#191b1fff", // Slate 900
    "--bg-secondary": "#21252bff", // Slate 800
    "--bg-tertiary": "#343b46ff", // Slate 700 (Input background)
    "--bg-card": "#1a1f27ff", // Slate 700
    "--text-primary": "#f8fafc", // Slate 50
    "--text-secondary": "#cbd5e1", // Slate 300
    "--text-muted": "#94a3b8", // Slate 400
    "--border-color": "#475569", // Slate 600
    "--secondary-btn-bg": "#213756ff", // Slate 600
    "--secondary-btn-bg-hover": "#1a3e71ff", // Slate 500
    // Force Dark Glass
    "--glass-bg": "rgba(30, 30, 30, 0.1)",
    "--glass-border": "rgba(255, 255, 255, 0.1)",
    "--glass-shadow": "0 4px 20px rgba(0, 0, 0, 0.4)",
    "--glass-backdrop": "blur(12px)",
    "--songlink-shadow": "inset 0 1.54px 0 rgba(255, 255, 255, 0.059), inset 0 0 18px rgba(255, 255, 255, 0.063)",

    "--chart-accepted-color": "rgb(16, 185, 171)",
    "--chart-declined-color": "rgb(239, 111, 68)",
    "--chart-pending-color": "rgb(255, 239, 59)"
  },

  sunset: {
    "--accent-color": "#ff684aff", // Orange 400
    "--bg-primary": "#241434ff", // Deep Dusk
    "--bg-secondary": "#2f2133ff", // Dusk Light
    "--bg-tertiary": "#1a162bff", // Dusk Lighter (Input background)
    "--bg-card": "#180e26ff", // Dusk Lighter
    "--text-primary": "#ffdbcaff", // Rose 50
    "--text-secondary": "#dec0ffff", // Purple 200
    "--text-muted": "#a78bfa", // Purple 400
    "--border-color": "#2d123cff",
    "--secondary-btn-bg": "#ff377dff",
    "--secondary-btn-bg-hover": "#ff659bff",
    // Force Dark Glass
    "--glass-bg": "rgba(30, 30, 30, 0.1)",
    "--glass-border": "rgba(255, 255, 255, 0.1)",
    "--glass-shadow": "0 4px 20px rgba(0, 0, 0, 0.4)",
    "--glass-backdrop": "blur(12px)",
    "--songlink-shadow": "inset 0 1.54px 0 rgba(255, 255, 255, 0.059), inset 0 0 18px rgba(255, 255, 255, 0.063)",

    "--chart-accepted-color": "rgb(147, 255, 97)",
    "--chart-declined-color": "rgb(255, 33, 136)",
    "--chart-pending-color": "rgb(255, 190, 59)"
  },

  forest: {
    "--accent-color": "#008a57ff", // Emerald 400
    "--bg-primary": "#ffeccfff", // Deep Woods
    "--bg-secondary": "#ffebc9ff", // Woods Light
    "--bg-tertiary": "#9cd7a6ff", // Woods Lighter (Input background)
    "--bg-card": "#ffebc9ff", // Woods Lighter
    "--text-primary": "#1f1714ff", // Emerald 50
    "--text-secondary": "#6e4026ff", // Emerald 200
    "--text-muted": "#4d675dff", // Emerald 300
    "--border-color": "#6b502fff",
    "--secondary-btn-bg": "#b18065ff",
    "--secondary-btn-bg-hover": "#cc9d86ff",
    // Force Dark Glass
    "--glass-bg": "rgba(30, 30, 30, 0.1)",
    "--glass-border": "rgba(255, 255, 255, 0.1)",
    "--glass-shadow": "0 4px 20px rgba(0, 0, 0, 0.4)",
    "--glass-backdrop": "blur(12px)",
    "--songlink-shadow": "inset 0 1.54px 0 rgba(255, 255, 255, 0.059), inset 0 0 18px rgba(255, 255, 255, 0.063)",

    "--chart-accepted-color": "rgb(64, 171, 15)",
    "--chart-declined-color": "rgb(255, 96, 33)",
    "--chart-pending-color": "rgb(255, 219, 59)"

  },

  midnight: {
    "--accent-color": "#818cf8", // Indigo 400
    "--bg-primary": "#020617", // Slate 950 (almost black)
    "--bg-secondary": "#0f172a", // Slate 900
    "--bg-tertiary": "#1e293b", // Slate 800 (Input background)
    "--bg-card": "#1e293b", // Slate 800
    "--text-primary": "#e2e8f0", // Slate 200
    "--text-secondary": "#94a3b8", // Slate 400
    "--text-muted": "#64748b", // Slate 500
    "--border-color": "#334155", // Slate 700
    "--secondary-btn-bg": "#334155", // Slate 700
    "--secondary-btn-bg-hover": "#475569", // Slate 600
    // Force Dark Glass
    "--glass-bg": "rgba(30, 30, 30, 0.1)",
    "--glass-border": "rgba(255, 255, 255, 0.1)",
    "--glass-shadow": "0 4px 20px rgba(0, 0, 0, 0.4)",
    "--glass-backdrop": "blur(12px)",
    "--songlink-shadow": "inset 0 1.54px 0 rgba(255, 255, 255, 0.059), inset 0 0 18px rgba(255, 255, 255, 0.063)"

  }
};

let lastAppliedThemeKeys = [];

function setTheme(themeName) {
  const root = document.documentElement;
  const themeData = THEMES[themeName];

  if (!themeData) return;

  // Cleanup previous theme properties
  // (We remove ALL properties set by the previous theme to ensure a clean slate,
  // preventing "leakage" where a complex theme leaves variables behind when switching to a simple one)
  lastAppliedThemeKeys.forEach(key => root.style.removeProperty(key));
  lastAppliedThemeKeys = [];

  // Apply new theme
  if (typeof themeData === 'string') {
    // Simple accent color shorthand
    root.style.setProperty("--accent-color", themeData);
    lastAppliedThemeKeys.push("--accent-color");
    document.body.classList.remove('force-dark-mode');
  } else if (typeof themeData === 'object') {
    // Robust theme object
    Object.entries(themeData).forEach(([key, value]) => {
      root.style.setProperty(key, value);
      lastAppliedThemeKeys.push(key);
    });
    document.body.classList.add('force-dark-mode');
  }

  // Persist choice
  document.cookie = `theme_preference=${themeName}; path=/; max-age=31536000`; // 1 year
}

function initTheme() {
  // Restore theme preference
  // Check new cookie name
  let match = document.cookie.match(new RegExp('(^| )theme_preference=([^;]+)'));
  if (match) {
    setTheme(match[2]);
  } else {
    // Migration: Check old cookie name for backward compatibility
    match = document.cookie.match(new RegExp('(^| )theme_accent=([^;]+)'));
    if (match) {
      setTheme(match[2]);
    }
  }

  // Restore picker visibility
  if (document.cookie.match(new RegExp('(^| )theme_picker_enabled=true'))) {
    const picker = document.getElementById("hidden-color-picker");
    if (picker) {
      picker.classList.remove("hidden");
    }
  }
}

// Make globally available
window.setTheme = setTheme;
window.initTheme = initTheme;



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
    // Chord chart resource tiles (inline with links/resources)
    if (link && link.__resourceType === 'chart') {
      const tile = document.createElement("a");
      tile.className = "song-link-display";
      tile.href = "#";
      tile.style.cursor = "pointer";
      tile.style.backgroundImage = `radial-gradient(circle at 70% 120%, color-mix(in srgb, var(--accent-color), transparent 85%) 0%, transparent 70%)`;

      const icon = document.createElement("div");
      icon.className = "song-link-favicon";
      icon.innerHTML = '<i class="fa-solid fa-music" style="font-size: 1.2rem; color: var(--accent-color);"></i>';

      const content = document.createElement("div");
      content.className = "song-link-content";

      const title = document.createElement("div");
      title.className = "song-link-title";
      title.textContent = link.title || "Chord Chart";

      const subtitle = document.createElement("div");
      subtitle.className = "song-link-url";
      subtitle.textContent = (link.subtitle || "View") + (link.readOnly ? " • Read-only (auto-generated)" : "");

      content.appendChild(title);
      content.appendChild(subtitle);

      tile.appendChild(icon);
      tile.appendChild(content);

      tile.addEventListener("click", (e) => {
        e.preventDefault();
        try {
          openChordChartViewerFromResource(link);
        } catch (err) {
          console.error("Failed to open chart viewer:", err);
          toastError("Unable to open chord chart. Check console.");
        }
      });

      linksContainer.appendChild(tile);
      continue;
    }

    const linkEl = document.createElement("a");
    linkEl.className = "song-link-display";

    if ((link.is_file_upload || link.type === 'file') && link.file_path) {
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
        audio.crossOrigin = "anonymous";
        audio.src = fileUrl;
        audio.style.width = "100%";
        audio.style.marginTop = "0.5rem";
        audio.preload = "metadata";

        content.appendChild(title);
        try {
          const transposeControls = buildAudioTransposeControls(audio, { baseKey: link.key || link.song_key || link.songKey });
          if (transposeControls) content.appendChild(transposeControls);
        } catch (err) {
          console.error("Failed to build transpose controls:", err);
        }
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
      favicon.alt = "";

      favicon.onerror = () => {
        favicon.style.display = "none";
      };

      // Set src for the visible icon (no crossOrigin, ensures it loads)
      // Google's service is great for display but blocks CORS (can't extract color)
      const faviconUrl = getFaviconUrl(link.url);
      favicon.src = faviconUrl;

      // Hardcoded brand colors for common domains to bypass CORS issues
      const getBrandColor = (urlStr) => {
        try {
          const hostname = new URL(urlStr).hostname.toLowerCase();
          if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return '#fc0032';
          if (hostname.includes('spotify.com')) return '#1ED760';
          if (hostname.includes('planningcenteronline.com')) return '#4ea033';
          if (hostname.includes('multitracks.com')) return '#51c5ffff';
          if (hostname.includes('praisecharts.com')) return 'rgb(255, 21, 12)';
          if (hostname.includes('songselect.ccli.com')) return '#00a3e0';
          if (hostname.includes('loopcommunity.com')) return 'rgb(0, 183, 217)';
          if (hostname.includes('dropbox.com')) return '#0061fe';
          if (hostname.includes('drive.google.com')) return '#F4B400';
          if (hostname.includes('ultimate-guitar.com')) return 'rgb(255, 215, 6)';
          if (hostname.includes('docs.google.com')) return '#4285f4';
          return null;
        } catch (e) { return null; }
      };

      const brandColor = getBrandColor(link.url);

      const applyColor = (hex) => {
        // Clear solid colors to allow default theme (light/dark) to show
        linkEl.style.backgroundColor = '';
        linkEl.style.color = '';

        // Apply subtle gradient blob
        // Using color-mix to ensure opacity works regardless of input format (hex6, hex8, etc)
        const gradientColor = `color-mix(in srgb, ${hex}, transparent 85%)`;
        linkEl.style.backgroundImage = `radial-gradient(circle at 70% 120%, ${gradientColor} 0%, transparent 70%)`;

        // Subtle border tint

        // Reset text colors to defaults
        const title = linkEl.querySelector('.song-link-title');
        if (title) title.style.color = '';
        const urlDiv = linkEl.querySelector('.song-link-url');
        if (urlDiv) {
          urlDiv.style.color = '';
          urlDiv.style.opacity = '';
        }
        // Remove shadow as it clashes with the subtle blob look
        linkEl.style.boxShadow = '';
      };

      // Construct DOM elements first
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

      if (brandColor) {
        applyColor(brandColor);
      } else {
        // Fallback: Try color extraction (best effort)
        const colorImg = new Image();
        colorImg.crossOrigin = "Anonymous";
        try {
          // Try Google V2 as fallback source
          colorImg.src = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(link.url)}&size=64`;
        } catch (e) {
          colorImg.src = faviconUrl;
        }

        colorImg.onload = () => {
          try {
            const color = fac.getColor(colorImg);
            applyColor(color.hex);
          } catch (e) {
            // Silent fail
          }
        };
      }
    }

    linksContainer.appendChild(linkEl);
  }

  container.appendChild(linksContainer);
}

// ============================================================================
// Chord charts (DB-backed, rendered inline as resources)
// ============================================================================

const SONG_CHARTS_TABLE = "song_charts";
const SONG_RESOURCES_TABLE = "song_resources";

async function fetchSongResources(songId) {
  if (!songId) return [];
  try {
    const { data, error } = await supabase
      .from(SONG_RESOURCES_TABLE)
      .select("*")
      .eq("song_id", songId)
      .eq("team_id", state.currentTeamId)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("fetchSongResources failed:", err);
    return [];
  }
}

function chartDisplayLabel(chart) {
  if (!chart) return "Chart";
  if (chart.chart_type === "number") return "Number Chart";
  return "Chord Chart";
}

function chartScopeLabel(chart) {
  if (!chart) return "";
  if (chart.scope === "key" && chart.song_key) return `Key: ${chart.song_key}`;
  return "General";
}

function buildChartRow(chart, { songId, songTitle, readOnly = false, generated = false, numberSourceDoc = null, targetKey = null } = {}) {
  const div = document.createElement("div");
  div.className = `song-link-row song-chart-row ${readOnly ? "readonly" : ""} draggable-item`;
  div.draggable = false;
  div.dataset.linkId = chart?.id ? `chart-${chart.id}` : `chart-new-${Date.now()}`;
  if (chart?.id) div.dataset.chartId = chart.id;

  const label = generated ? "Generated Chord Chart" : chartDisplayLabel(chart);
  const subtitle = generated
    ? `Key: ${targetKey} • Auto-generated (read-only)`
    : `${chartScopeLabel(chart)} • ${chart.chart_type === "number" ? "Number chart" : "Chord chart"}`;

  const canDrag = isManager() && !readOnly && !generated;

  div.innerHTML = `
    ${canDrag ? '<div class="drag-handle" title="Drag to reorder">⋮⋮</div>' : ''}
    <div style="display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;">
      <div class="song-link-favicon" aria-hidden="true">
        <i class="fa-solid fa-music" style="font-size: 1.1rem; color: var(--accent-color);"></i>
      </div>
      <div class="song-link-content" style="min-width:0;">
        <div class="song-link-title">${escapeHtml(label)}</div>
        <div class="song-link-url">${escapeHtml(subtitle)}</div>
      </div>
    </div>
    ${chart?.id ? `<input type="hidden" class="song-chart-id" value="${escapeHtml(chart.id)}" />` : ""}
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <button type="button" class="btn small secondary ${generated ? "view-generated-chart" : "edit-song-chart"}" ${readOnly && !generated ? "disabled" : ""}>
        ${generated ? "View" : "Edit"}
      </button>
      ${(!generated && !readOnly) ? `<button type="button" class="btn small ghost remove-song-chart">Delete</button>` : ""}
    </div>
  `;

  // Attach the full chart object to the element so we can recover it during collectSongResources
  div.chartResource = chart;

  if (canDrag) {
    div.classList.add("draggable-item");
  } else {
    div.classList.remove("draggable-item");
  }

  // Wire buttons
  const editBtn = div.querySelector(".edit-song-chart");
  if (editBtn && chart?.id) {
    editBtn.addEventListener("click", async () => {
      openChordChartEditor({
        songId,
        songTitle,
        scope: chart.scope,
        songKey: chart.song_key || null,
        existingChart: chart,
        forceType: chart.chart_type,
      });
    });
  }

  const viewBtn = div.querySelector(".view-generated-chart");
  if (viewBtn && generated && numberSourceDoc && targetKey) {
    viewBtn.addEventListener("click", () => {
      openChordChartViewerFromResource({
        __resourceType: "chart",
        title: "Chord Chart",
        subtitle: `Key: ${targetKey} • Auto-generated (read-only)`,
        songId,
        songTitle,
        scope: "key",
        songKey: targetKey,
        layout: chart?.layout || "one_column",
        readOnly: true,
        generatedFromNumber: true,
        sourceDoc: numberSourceDoc,
        targetKey: targetKey,
      });
    });
  }

  const deleteBtn = div.querySelector(".remove-song-chart");
  if (deleteBtn && chart?.id) {
    deleteBtn.addEventListener("click", async () => {
      const ok = confirm("Delete this chart? This cannot be undone.");
      if (!ok) return;
      try {
        const { error } = await supabase
          .from(SONG_CHARTS_TABLE)
          .delete()
          .eq("id", chart.id)
          .eq("song_id", songId);
        if (error) throw error;
        toastSuccess("Chart deleted.");
        // Refresh chart rows without disturbing link edits
        const charts = await fetchSongCharts(songId, { useCache: false });
        injectSongChartsIntoSongLinksList({
          songId,
          songTitle,
          charts,
          keys: collectSongKeys().map(k => k?.key).filter(Boolean),
        });
      } catch (err) {
        console.error("Failed to delete chart:", err);
        toastError("Failed to delete chart. Check console.");
      }
    });
  }

  return div;
}

// Deprecated: injectSongChartsIntoSongLinksList is no longer needed 
// as charts are now handled as standard resources within renderSongLinks.
function injectSongChartsIntoSongLinksList({ songId, songTitle, charts, keys }) {
  console.log("injectSongChartsIntoSongLinksList is deprecated/noop in new resource model");
}

function normalizeKeyLabel(key) {
  return (key || "").trim();
}

function createEmptyChartDoc(songTitle = "") {
  return {
    version: 1,
    title: songTitle || "",
    lyricsLines: [""],
    placements: [],
    settings: {
      layout: "one_column", // one_column | two_column
      fontSize: 14,
      lineHeight: 1.4,
    },
  };
}

function normalizeLyricsLinesFromText(text) {
  const raw = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").map(l => l.replace(/\s+$/g, "")); // trim right
  return lines.length ? lines : [""];
}

function adjustPlacementsForLyricsChange(oldLines, newLines, placements) {
  if (!Array.isArray(placements) || !Array.isArray(oldLines) || !Array.isArray(newLines)) {
    return placements || [];
  }

  // If lines are identical, no adjustment needed
  if (oldLines.length === newLines.length && oldLines.every((line, idx) => line === newLines[idx])) {
    return placements;
  }

  // Create a mapping: try to match old lines to new lines by content
  // This helps preserve placements when lines are added/removed
  const adjustedPlacements = [];
  const newLineToIndexMap = new Map();
  newLines.forEach((line, idx) => {
    const key = line.trim();
    if (!newLineToIndexMap.has(key)) {
      newLineToIndexMap.set(key, []);
    }
    newLineToIndexMap.get(key).push(idx);
  });

  placements.forEach(placement => {
    const oldLineIndex = Number(placement.lineIndex) || 0;

    // If placement is out of bounds, remove it
    if (oldLineIndex >= newLines.length) {
      return; // Skip this placement
    }

    // Try to find the same line content in the new lyrics
    const oldLine = oldLines[oldLineIndex] || "";
    const oldLineKey = oldLine.trim();
    const matchingIndices = newLineToIndexMap.get(oldLineKey) || [];

    if (matchingIndices.length > 0) {
      // Find the closest matching index (prefer same position, then nearest)
      let bestIndex = matchingIndices[0];
      let bestDistance = Math.abs(bestIndex - oldLineIndex);
      for (const idx of matchingIndices) {
        const distance = Math.abs(idx - oldLineIndex);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = idx;
        }
      }

      adjustedPlacements.push({
        ...placement,
        lineIndex: bestIndex,
      });
    } else if (oldLineIndex < newLines.length) {
      // Line content changed but index is still valid - keep placement at same index
      adjustedPlacements.push({
        ...placement,
        lineIndex: oldLineIndex,
      });
    }
  });

  return adjustedPlacements;
}

function genPlacementId() {
  return `pl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampInt(n, min, max) {
  const v = Number.isFinite(n) ? Math.round(n) : min;
  return Math.max(min, Math.min(max, v));
}

function chooseTwoColumnSplit(lines) {
  if (!Array.isArray(lines) || lines.length < 6) return { left: lines, right: [] };
  const mid = Math.floor(lines.length / 2);
  // Prefer splitting at a blank line near the midpoint
  let best = mid;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = Math.max(0, mid - 6); i <= Math.min(lines.length - 1, mid + 6); i++) {
    if ((lines[i] || "").trim() === "") {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
  }
  const left = lines.slice(0, best);
  const right = lines.slice(best);
  return { left, right };
}

function measureMonoCharWidthPx(fontSizePx = 14) {
  const probe = document.createElement("span");
  probe.style.visibility = "hidden";
  probe.style.position = "fixed";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";
  probe.style.whiteSpace = "pre";
  probe.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  probe.style.fontSize = `${fontSizePx}px`;
  probe.textContent = "MMMMMMMMMM";
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width / 10;
  probe.remove();
  return width || 8;
}

function fitChartPageToContainer(wrapEl, outerEl, pageEl) {
  if (!wrapEl || !outerEl || !pageEl) return;
  // Reset transform to measure the true page size
  pageEl.style.transform = "";
  pageEl.style.transformOrigin = "";
  outerEl.style.width = "";
  outerEl.style.height = "";

  const wrapRect = wrapEl.getBoundingClientRect();
  const pageRect = pageEl.getBoundingClientRect();

  // Account for padding in wrapEl (0.5rem on all sides)
  const wrapPadding = 16; // 0.5rem = 8px, but we have padding on both sides
  const availableW = Math.max(1, wrapRect.width - wrapPadding);
  const availableH = Math.max(1, wrapRect.height);

  const baseW = Math.max(1, pageRect.width);
  const baseH = Math.max(1, pageRect.height);

  // Scale to fit both dimensions, ensuring we never exceed available space
  const scaleW = availableW / baseW;
  const scaleH = availableH / baseH;
  const scale = Math.max(0.1, Math.min(1, scaleW, scaleH));

  outerEl.dataset.scale = String(scale);

  // Use an outer box with scaled dimensions so the layout matches the scaled page (no "scroll box" feel).
  outerEl.style.width = `${baseW * scale}px`;
  outerEl.style.height = `${baseH * scale}px`;
  outerEl.style.margin = "0 auto";

  pageEl.style.transformOrigin = "top left";
  pageEl.style.transform = `scale(${scale})`;
}

function fitAllChartPagesToContainer(wrapEl) {
  if (!wrapEl) return;
  const outerEls = wrapEl.querySelectorAll(".chart-page-outer");
  outerEls.forEach(outerEl => {
    const pageEl = outerEl.querySelector(".chart-page");
    if (pageEl) fitChartPageToContainer(wrapEl, outerEl, pageEl);
  });
}

function renderChartDocIntoPage(targetEl, doc, options = {}) {
  if (!targetEl) return;
  const songTitle = options.songTitle || doc?.title || "Chord Chart";
  const subtitle = options.subtitle || "";
  const layout = options.layout || doc?.settings?.layout || "one_column";
  const readOnly = !!options.readOnly;

  const lyricsLines = Array.isArray(doc?.lyricsLines) ? doc.lyricsLines : [""];
  const placements = Array.isArray(doc?.placements) ? doc.placements : [];

  const bodyLines = lyricsLines;
  const columns = layout === "two_column" ? 2 : 1;
  const charWidth = measureMonoCharWidthPx();

  // Calculate available space for content
  // Page: 11in = 1056px at 96dpi
  // Padding: 0.55in top + 0.6in bottom = 1.15in = ~110px
  // Header: ~108px (title + margin)
  // Available height: 1056 - 110 - 108 = ~838px
  // Line height: ~20px (14px font * 1.4 line-height)
  // Account for line padding (0.12rem top/bottom = ~3px per line)
  // Conservative estimate: ~20 lines per column to ensure no overflow
  const ESTIMATED_LINES_PER_COLUMN = 20;

  const makeLineHtml = (lineText, absoluteLineIndex) => {
    // Check if this is a section header: [SectionName]
    const sectionHeaderMatch = String(lineText || "").trim().match(/^\[([^\]]+)\]$/);
    if (sectionHeaderMatch) {
      const sectionName = sectionHeaderMatch[1];
      return `
        <div class="chart-section-header" data-line-index="${absoluteLineIndex}">
          ${escapeHtml(sectionName)}
        </div>
      `;
    }

    // Regular line with chords
    const linePlacements = placements.filter(p => p && p.lineIndex === absoluteLineIndex);
    const chordLayer = linePlacements.map(p => {
      const leftPx = (Number(p.charIndex) || 0) * charWidth;
      const cls = `chart-placement${readOnly ? " readonly" : ""}`;
      return `<div class="${cls}" data-placement-id="${escapeHtml(String(p.id || ""))}" style="left:${leftPx}px;">${escapeHtml(String(p.value || ""))}</div>`;
    }).join("");

    return `
      <div class="chart-line" data-line-index="${absoluteLineIndex}">
        <div class="chart-chord-layer">${chordLayer}</div>
        <div class="chart-lyrics-layer">${escapeHtml(lineText ?? "")}</div>
      </div>
    `;
  };

  // Split content across pages, filling columns left-to-right
  const pages = [];

  if (columns === 1) {
    // One column: simple pagination down the page
    const totalLines = bodyLines.length;
    const pagesNeeded = Math.max(1, Math.ceil(totalLines / ESTIMATED_LINES_PER_COLUMN));

    for (let pageIdx = 0; pageIdx < pagesNeeded; pageIdx++) {
      const startLine = pageIdx * ESTIMATED_LINES_PER_COLUMN;
      const endLine = Math.min(startLine + ESTIMATED_LINES_PER_COLUMN, totalLines);
      const pageLines = bodyLines.slice(startLine, endLine);
      const leftHtml = pageLines.map((line, idx) => makeLineHtml(line, startLine + idx)).join("");

      const headerHtml = pageIdx === 0
        ? `
          <div class="chart-page-header">
            <h1 class="chart-page-title">${escapeHtml(songTitle)}</h1>
            ${subtitle ? `<p class="chart-page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
          </div>
        `
        : `<div class="chart-page-header"><h1 class="chart-page-title">${escapeHtml(songTitle)}</h1></div>`;

      pages.push(`
        <div class="chart-page">
          ${headerHtml}
          <div class="chart-page-body">
            <div class="chart-columns ${layout}">
              <div class="chart-col chart-col-left">${leftHtml}</div>
            </div>
          </div>
        </div>
      `);
    }
  } else {
    // Two columns: flow continuously left-right-left-right across pages
    // Each page: left column gets first N lines, right column gets next N lines
    // Then next page continues from where we left off
    const totalLines = bodyLines.length;
    const linesPerPage = 2 * ESTIMATED_LINES_PER_COLUMN; // Each page has 2 columns
    const totalPages = Math.max(1, Math.ceil(totalLines / linesPerPage));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageStartLine = pageIdx * linesPerPage;

      // Left column: first ESTIMATED_LINES_PER_COLUMN lines of this page
      const leftStart = pageStartLine;
      const leftEnd = Math.min(leftStart + ESTIMATED_LINES_PER_COLUMN, totalLines);
      const leftPageLines = bodyLines.slice(leftStart, leftEnd);
      const leftHtml = leftPageLines.map((line, idx) => makeLineHtml(line, leftStart + idx)).join("");

      // Right column: next ESTIMATED_LINES_PER_COLUMN lines of this page
      const rightStart = leftEnd;
      const rightEnd = Math.min(rightStart + ESTIMATED_LINES_PER_COLUMN, totalLines);
      const rightPageLines = bodyLines.slice(rightStart, rightEnd);
      const rightHtml = rightPageLines.map((line, idx) => makeLineHtml(line, rightStart + idx)).join("");

      const headerHtml = pageIdx === 0
        ? `
          <div class="chart-page-header">
            <h1 class="chart-page-title">${escapeHtml(songTitle)}</h1>
            ${subtitle ? `<p class="chart-page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
          </div>
        `
        : `<div class="chart-page-header"><h1 class="chart-page-title">${escapeHtml(songTitle)}</h1></div>`;

      pages.push(`
        <div class="chart-page">
          ${headerHtml}
          <div class="chart-page-body">
            <div class="chart-columns ${layout}">
              <div class="chart-col chart-col-left">${leftHtml}</div>
              <div class="chart-col chart-col-right">${rightHtml}</div>
            </div>
          </div>
        </div>
      `);
    }
  }

  // If targetEl is inside a wrapper (viewer/editor), render pages into wrapper; otherwise render for print
  const isWrapper = targetEl.classList.contains("chart-page-wrap");
  if (isWrapper) {
    targetEl.innerHTML = pages.map((pageHtml, idx) => `<div class="chart-page-outer" data-page-index="${idx}">${pageHtml}</div>`).join("");
  } else {
    // Print container: render pages directly (print CSS handles page breaks)
    targetEl.innerHTML = pages.map((pageHtml, idx) => `<div class="chart-page-outer" data-page-index="${idx}">${pageHtml}</div>`).join("");
  }
}

// Adapter function: Fetches resources -> Maps to old chart object structure
async function fetchSongCharts(songId, { useCache = true } = {}) {
  const resources = await fetchSongResources(songId);
  return resources
    .filter(r => r.type === 'chart' && r.chart_content)
    .map(r => ({
      id: r.id,
      song_id: r.song_id,
      team_id: r.team_id,
      title: r.title,
      // Map flattened chart content back to top-level properties
      chart_type: r.chart_content.chart_type,
      scope: r.chart_content.scope,
      song_key: r.key, // Map key
      layout: r.chart_content.layout,
      doc: r.chart_content.doc,
      display_order: r.display_order,
      created_at: r.created_at
    }));
}

async function saveSongChart({
  id = null,
  songId,
  scope,
  chartType,
  layout,
  songKey = null,
  doc,
}) {
  if (!songId) throw new Error("Missing songId");
  if (!scope) throw new Error("Missing scope");
  if (!chartType) throw new Error("Missing chartType");
  if (!layout) throw new Error("Missing layout");
  if (!doc) throw new Error("Missing doc");

  // Adapter: Map old chart object structure to new song_resources payload
  const chartContent = {
    chart_type: chartType,
    scope,
    layout,
    doc
  };

  const payload = {
    team_id: state.currentTeamId,
    song_id: songId,
    type: 'chart',
    title: doc.title || (scope === 'key' ? `Key: ${songKey}` : "Common Chart"),
    key: songKey || null,
    chart_content: chartContent,
    updated_at: new Date().toISOString(),
  };

  if (!id) {
    payload.created_by = state.session?.user?.id || null;
    // Get max display order to append? Or let DB default?
    // DB default is 0. We might want to append.
    // fetchSongResources might be expensive. For now let's set 0 or use a quick query if needed.
    // Or just default 0 and let user reorder.
  }

  const query = id
    ? supabase.from(SONG_RESOURCES_TABLE).update(payload).eq("id", id).select().single()
    : supabase.from(SONG_RESOURCES_TABLE).insert(payload).select().single();

  const { data, error } = await query;
  if (error) throw error;

  // Refresh cache
  if (state.chordCharts && state.chordCharts.cache) {
    state.chordCharts.cache.delete(songId);
  }

  // Return adapted object
  return {
    id: data.id,
    song_id: data.song_id,
    team_id: data.team_id,
    title: data.title,
    chart_type: data.chart_content.chart_type,
    scope: data.chart_content.scope,
    song_key: data.key,
    layout: data.chart_content.layout,
    doc: data.chart_content.doc,
    display_order: data.display_order,
    created_at: data.created_at
  };
}

function parseKeyToPitchClass(keyStr) {
  const k = (keyStr || "").trim();
  if (!k) return null;
  // Basic forms: C, C#, Db, Am, F#m, Bb
  const m = k.match(/^([A-Ga-g])([#b]?)(m)?$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2] || "";
  const isMinor = !!m[3];

  const bases = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  if (bases[letter] === undefined) return null;

  const base = bases[letter];
  let pc = base;
  if (accidental === "#") pc += 1;
  if (accidental === "b") pc -= 1;
  pc = (pc + 12) % 12;
  return { pc, isMinor, preferFlats: accidental === "b" || ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"].includes(letter + accidental) };
}

function pitchClassToNoteName(pc, preferFlats) {
  const sharps = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flats = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const list = preferFlats ? flats : sharps;
  return list[(pc + 12) % 12];
}

function parseNashvilleNumberToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return null;
  // Support: b7, #4dim, 6m7, 5sus, 1/3, b7/1
  const parts = raw.split("/");
  const head = parts[0];
  const bass = parts[1] || null;

  const m = head.match(/^([b#]?)([1-7])(.+)?$/);
  if (!m) return { raw };
  const acc = m[1] || "";
  const degree = parseInt(m[2], 10);
  const tail = m[3] || "";

  // Heuristic quality parsing
  const tailLower = tail.toLowerCase();
  const quality =
    tailLower.includes("dim") ? "dim" :
      tailLower.includes("aug") ? "aug" :
        (tailLower.startsWith("m") && !tailLower.startsWith("maj")) ? "m" :
          (tailLower.includes("sus") ? "sus" : "");
  const explicitMinor = tailLower.startsWith("m") && !tailLower.startsWith("maj");

  return {
    raw,
    degree,
    accidental: acc, // b | # | ''
    tail,
    quality,
    explicitMinor,
    bass: bass ? parseNashvilleNumberToken(bass) : null,
  };
}

function nashvilleNumberToChord(token, targetKey) {
  const k = parseKeyToPitchClass(targetKey);
  if (!k) return String(token || "").trim();

  // "Minor as 1" behavior:
  // If key is minor (e.g. Am), 1 = Am.
  // Use Natural Minor Scale intervals: W H W W H W W -> [0, 2, 3, 5, 7, 8, 10]
  // Diatonic minor chords: 1m, 2dim, 3(Maj), 4m, 5m, 6(Maj), 7(Maj)
  // (Note: NNS often treats 5 as Major in minor keys for V7, but strictly diatonic natural minor is vm.
  //  However, standard "Minor as 1" usually implies natural minor intervals.
  //  User can write "5" for Major V or "5m" for minor v.
  //  We will set default qualities to match natural minor.)

  const tonicPc = k.pc; // Use the actual key root (e.g. A for Am), not relative major
  const preferFlats = k.preferFlats;
  const parsed = parseNashvilleNumberToken(token);
  if (!parsed || !parsed.degree) return String(token || "").trim();

  let scaleOffsets;
  let diatonicQualityByDegree;

  if (k.isMinor) {
    // Natural Minor: 1, 2, b3, 4, 5, b6, b7
    scaleOffsets = [0, 2, 3, 5, 7, 8, 10];
    diatonicQualityByDegree = { 1: "m", 2: "dim", 3: "", 4: "m", 5: "m", 6: "", 7: "" };
  } else {
    // Major
    scaleOffsets = [0, 2, 4, 5, 7, 9, 11];
    diatonicQualityByDegree = { 1: "", 2: "m", 3: "m", 4: "", 5: "", 6: "m", 7: "dim" };
  }

  const baseOffset = scaleOffsets[parsed.degree - 1] ?? 0;
  const accOffset = parsed.accidental === "b" ? -1 : (parsed.accidental === "#" ? 1 : 0);
  const rootPc = (tonicPc + baseOffset + accOffset + 120) % 12;
  const rootName = pitchClassToNoteName(rootPc, preferFlats);

  let quality = "";
  if (parsed.quality === "dim") quality = "dim";
  else if (parsed.quality === "aug") quality = "aug";
  else if (parsed.quality === "sus") quality = "sus";
  else if (parsed.explicitMinor) quality = "m";
  else quality = diatonicQualityByDegree[parsed.degree] || "";

  // Preserve tail extensions (minus the quality token when possible)
  let ext = parsed.tail || "";
  // Strip leading quality markers to avoid duplication (best effort)
  ext = ext.replace(/^dim/i, "").replace(/^aug/i, "");
  if (quality === "m") {
    ext = ext.replace(/^m(?!aj)/i, "");
  }

  const chord = `${rootName}${quality}${ext}`;
  if (parsed.bass && parsed.bass.degree) {
    const bassChord = nashvilleNumberToChord(parsed.bass.raw, targetKey);
    // bassChord may include quality/ext; keep just the note name before any letters/symbols
    const bassNote = bassChord.match(/^([A-G][b#]?)/)?.[1] || bassChord;
    return `${chord}/${bassNote}`;
  }
  return chord;
}

function generateChordDocFromNumberDoc(numberDoc, targetKey, { songTitle = "", layout = "one_column" } = {}) {
  const base = numberDoc || createEmptyChartDoc(songTitle);
  const lyricsLines = Array.isArray(base.lyricsLines) ? base.lyricsLines : [""];
  const placements = Array.isArray(base.placements) ? base.placements : [];

  const convertedPlacements = placements.map(p => {
    const value = String(p?.value || "").trim();
    const chordValue = nashvilleNumberToChord(value, targetKey);
    return {
      id: p?.id || genPlacementId(),
      lineIndex: p?.lineIndex ?? 0,
      charIndex: p?.charIndex ?? 0,
      kind: "chord",
      value: chordValue,
    };
  });

  return {
    ...base,
    title: songTitle || base.title || "",
    lyricsLines,
    placements: convertedPlacements,
    settings: {
      ...(base.settings || {}),
      layout: layout || base?.settings?.layout || "one_column",
    }
  };
}

function openChordChartViewerFromResource(resource) {
  const modal = el("chart-viewer-modal");
  const titleEl = el("chart-viewer-title");
  const subtitleEl = el("chart-viewer-subtitle");
  const wrapEl = el("chart-viewer-page");
  const editBtn = el("btn-chart-viewer-edit");
  if (!modal || !wrapEl) return;

  const songTitle = resource.songTitle || resource.song_title || resource._songTitle || "";
  const subtitle = resource.subtitle || "";
  let doc = resource.doc || null;
  let readOnly = !!resource.readOnly;

  // Generated-from-number charts: build chord doc on demand
  if (resource.generatedFromNumber && resource.sourceDoc && resource.targetKey) {
    doc = generateChordDocFromNumberDoc(resource.sourceDoc, resource.targetKey, {
      songTitle: songTitle,
      layout: resource.layout || resource.sourceDoc?.settings?.layout || "one_column",
    });
    readOnly = true;
  }

  if (!doc) {
    toastError("Chord chart is missing data.");
    return;
  }

  if (titleEl) titleEl.textContent = resource.title || "Chord Chart";
  if (subtitleEl) subtitleEl.textContent = subtitle + (readOnly ? " • Read-only (auto-generated)" : "");

  if (editBtn) {
    if (isManager() || isOwner()) {
      editBtn.classList.remove("hidden");
    } else {
      editBtn.classList.add("hidden");
    }
  }

  state.chordCharts.active = {
    mode: "viewer",
    songId: resource.songId || null,
    scope: resource.scope || null,
    songKey: resource.songKey || resource.targetKey || null,
    readOnly,
    chart: { ...resource, doc },
    songTitle,
  };

  // Build pages inside wrapper (renderChartDocIntoPage handles pagination)
  wrapEl.innerHTML = "";
  renderChartDocIntoPage(wrapEl, doc, {
    songTitle: songTitle || doc.title || "Chord Chart",
    subtitle,
    layout: resource.layout || doc?.settings?.layout,
    readOnly: true,
  });

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    fitAllChartPagesToContainer(wrapEl);
  });
}

function closeChordChartViewer() {
  const modal = el("chart-viewer-modal");
  if (!modal) return;
  closeModalWithAnimation(modal, () => {
    modal.setAttribute("aria-hidden", "true");
    if (state.chordCharts.active?.mode === "viewer") state.chordCharts.active = null;
    // Preserve scroll lock if another modal is still open behind this one
    const songDetailsModal = el("song-details-modal");
    const songEditModal = el("song-edit-modal");
    const songDetailsOpen = !!songDetailsModal && !songDetailsModal.classList.contains("hidden");
    const songEditOpen = !!songEditModal && !songEditModal.classList.contains("hidden");
    if (songDetailsOpen || songEditOpen) {
      document.body.style.overflow = "hidden";
    }
  });
}

function closeChordChartEditor() {
  const modal = el("chart-editor-modal");
  if (!modal) return;
  closeModalWithAnimation(modal, () => {
    modal.setAttribute("aria-hidden", "true");
    if (state.chordCharts.active?.mode === "editor") state.chordCharts.active = null;
    // Preserve scroll lock if another modal is still open behind this one
    const songDetailsModal = el("song-details-modal");
    const songEditModal = el("song-edit-modal");
    const songDetailsOpen = !!songDetailsModal && !songDetailsModal.classList.contains("hidden");
    const songEditOpen = !!songEditModal && !songEditModal.classList.contains("hidden");
    if (songDetailsOpen || songEditOpen) {
      document.body.style.overflow = "hidden";
    }
  });
}

function renderChartToPrintContainer({ songTitle, subtitle, doc, layout }) {
  const wrapper = el("print-chart-container");
  let content = el("print-chart-content");

  if (!wrapper) return false;

  // Robustness check: recreate content div if it went missing
  if (!content) {
    content = document.createElement("div");
    content.id = "print-chart-content";
    content.className = "print-chart-content";
    wrapper.appendChild(content);
  }

  // Ensure the set print container won't show during chart printing
  const setWrapper = el("print-set-container");
  if (setWrapper) {
    const setContent = el("print-set-content");
    if (setContent) setContent.innerHTML = "";
    setWrapper.setAttribute("aria-hidden", "true");
  }

  // renderChartDocIntoPage handles pagination and renders pages directly into content
  content.innerHTML = "";
  renderChartDocIntoPage(content, doc, { songTitle, subtitle, layout, readOnly: true });
  wrapper.setAttribute("aria-hidden", "false");
  return true;
}

function openPrintChartFromActive() {
  const active = state.chordCharts.active;
  if (!active?.chart?.doc) return;

  const wrapper = el("print-chart-container");
  if (!wrapper) return;

  const ok = renderChartToPrintContainer({
    songTitle: active.songTitle || active.chart?.doc?.title || "Chord Chart",
    subtitle: active.chart?.subtitle || "",
    doc: active.chart.doc,
    layout: active.chart.layout || active.chart?.doc?.settings?.layout || "one_column",
  });
  if (!ok) return;

  const afterPrint = () => {
    wrapper.setAttribute("aria-hidden", "true");
    window.removeEventListener("afterprint", afterPrint);
  };
  window.addEventListener("afterprint", afterPrint);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });

  setTimeout(afterPrint, 3000);
}

function openChordChartEditor({ songId, songTitle, scope, songKey = null, existingChart = null, forceType = null }) {
  const modal = el("chart-editor-modal");
  const wrapEl = el("chart-editor-page");
  const subtitleEl = el("chart-editor-subtitle");
  const titleEl = el("chart-editor-title");
  const lyricsInput = el("chart-lyrics-input");
  const typeSelect = el("chart-editor-type");
  const layoutSelect = el("chart-editor-layout");

  if (!modal || !wrapEl || !lyricsInput || !typeSelect || !layoutSelect) return;

  const isKeyScope = scope === "key";
  const doc = existingChart?.doc || createEmptyChartDoc(songTitle || "");
  const chartType = forceType || existingChart?.chart_type || (isKeyScope ? "chord" : "chord");
  const layout = existingChart?.layout || doc?.settings?.layout || "one_column";

  state.chordCharts.active = {
    mode: "editor",
    songId,
    scope,
    songKey,
    readOnly: false,
    chart: {
      id: existingChart?.id || null,
      title: existingChart?.title || (isKeyScope ? `Key: ${songKey}` : "General"),
      scope,
      songKey,
      chartType,
      layout,
      doc: (typeof structuredClone !== "undefined") ? structuredClone(doc) : JSON.parse(JSON.stringify(doc)),
    },
    songTitle: songTitle || "",
  };

  if (titleEl) titleEl.textContent = isKeyScope ? `Edit Chord Chart — ${songKey}` : "Edit Chart";
  if (subtitleEl) subtitleEl.textContent = isKeyScope ? "Key-specific chord chart" : "General chart";

  // Populate controls
  layoutSelect.value = layout;
  typeSelect.value = chartType;
  typeSelect.disabled = isKeyScope; // key-specific charts are chord-only
  typeSelect.parentElement?.classList?.toggle("hidden", isKeyScope);

  // Update insert input placeholder based on chart type
  const insertInput = el("chart-insert-value");
  if (insertInput) {
    insertInput.placeholder = chartType === "number"
      ? "1, 4, 6m, b7, #4dim, 5sus..."
      : "C, Dm7, F#m, Bb, Gsus4...";
  }

  lyricsInput.value = (state.chordCharts.active.chart.doc.lyricsLines || []).join("\n");

  // Initial render (renderChartDocIntoPage handles pagination)
  wrapEl.innerHTML = "";
  renderChartDocIntoPage(wrapEl, state.chordCharts.active.chart.doc, {
    songTitle: songTitle || state.chordCharts.active.chart.doc.title || "Chord Chart",
    subtitle: isKeyScope ? `Key: ${songKey}` : (chartType === "number" ? "Number chart" : "Chord chart"),
    layout,
    readOnly: false,
  });

  wireChordChartEditorInteractions();

  // --- LRCLIB Integration ---
  const searchInput = el("chart-lyrics-search-input");
  const searchBtn = el("btn-chart-lyrics-search");
  const resultsContainer = el("chart-lyrics-results");

  if (searchInput && searchBtn && resultsContainer) {
    // Clear previous state
    searchInput.value = "";
    resultsContainer.innerHTML = "";
    resultsContainer.classList.add("hidden");

    const performSearch = async () => {
      const q = searchInput.value.trim();
      console.log("[LRCLIB] Performing search for:", q);
      if (!q) return;

      searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      searchBtn.disabled = true;
      resultsContainer.classList.add("hidden");

      try {
        const results = await searchLyrics(q);
        console.log("[LRCLIB] API Results:", results);
        renderLyricResults(results);
      } catch (err) {
        console.error("Lyrics search failed:", err);
        toastError("Failed to search lyrics: " + err.message);
      } finally {
        searchBtn.textContent = "Search";
        searchBtn.disabled = false;
      }
    };

    searchBtn.onclick = performSearch;
    searchInput.onkeydown = (e) => {
      if (e.key === "Enter") performSearch();
    };

    // Helper: Search implementation
    async function searchLyrics(query) {
      console.log("[LRCLIB] Fetching from API...");
      // LRCLIB API: GET https://lrclib.net/api/search?q=...
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      console.log("[LRCLIB] Response status:", res.status);
      if (!res.ok) throw new Error("API Error: " + res.status);
      return await res.json();
    }

    // Helper: Render results
    function renderLyricResults(results) {
      console.log("[LRCLIB] Rendering results:", results?.length);
      resultsContainer.innerHTML = "";

      if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="muted small-text" style="padding:0.5rem; text-align:center;">No results found.</div>';
        resultsContainer.classList.remove("hidden");
        return;
      }

      let count = 0;
      results.forEach(track => {
        // Only show tracks that have lyrics
        if (!track.plainLyrics && !track.syncedLyrics) return;
        count++;

        const div = document.createElement("div");
        div.className = "chart-lyrics-result-item";
        div.style.padding = "0.5rem";
        div.style.borderBottom = "1px solid var(--border-color)";
        div.style.cursor = "pointer";
        div.innerHTML = `
          <div style="font-weight:500;">${escapeHtml(track.trackName)}</div>
          <div class="muted small-text">${escapeHtml(track.artistName)} • ${escapeHtml(track.albumName || "")}</div>
        `;

        div.onclick = () => {
          if (confirm(`Replace current lyrics with lyrics from "${track.trackName}"?`)) {
            const newLyrics = track.plainLyrics || track.syncedLyrics; // Fallback to synced if plain missing (though rare)

            // Populate textarea
            const lyricsInput = el("chart-lyrics-input");
            if (lyricsInput) {
              lyricsInput.value = newLyrics;
              // Trigger input event to update the chart preview
              lyricsInput.dispatchEvent(new Event("input"));
            }
            resultsContainer.classList.add("hidden");
            searchInput.value = "";
          }
        };

        resultsContainer.appendChild(div);
      });

      console.log("[LRCLIB] Rendered items:", count);
      if (count === 0) {
        resultsContainer.innerHTML = '<div class="muted small-text" style="padding:0.5rem; text-align:center;">No results found (with lyrics).</div>';
      }

      resultsContainer.classList.remove("hidden");
    }
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    fitAllChartPagesToContainer(wrapEl);
  });
}

// (Removed) refreshSongEditChartButtons: charts are edited/deleted from list rows now.

function wireChordChartEditorInteractions() {
  const wrapEl = el("chart-editor-page");
  if (!wrapEl) return;

  const active = state.chordCharts.active;
  if (!active || active.mode !== "editor") return;

  const charWidth = measureMonoCharWidthPx();

  // Process all pages
  const pageEls = wrapEl.querySelectorAll(".chart-page");
  pageEls.forEach(pageEl => {
    const outerEl = pageEl.closest(".chart-page-outer");
    if (!outerEl) return;
    const scale = parseFloat(outerEl.dataset.scale || "1") || 1;

    // Click to set cursor position (only on regular lines, not section headers)
    pageEl.querySelectorAll(".chart-line").forEach(lineEl => {
      lineEl.addEventListener("click", (e) => {
        const lineIndex = parseInt(lineEl.dataset.lineIndex, 10) || 0;
        const lyricsEl = lineEl.querySelector(".chart-lyrics-layer");
        const rect = (lyricsEl || lineEl).getBoundingClientRect();
        const xScaled = e.clientX - rect.left;
        const x = xScaled / scale;
        const charIndex = clampInt(x / charWidth, 0, 10_000);
        state.chordCharts.editorCursor = { lineIndex, charIndex };
      });
    });

    // Section headers are not clickable for cursor placement

    // Drag placements (pointer events) with double-tap to delete
    // Track taps for double-tap detection (shared across all placements on this page)
    const tapState = { lastTapTime: 0, lastTapId: null, dragTimeout: null };

    pageEl.querySelectorAll(".chart-placement").forEach(plEl => {
      plEl.addEventListener("pointerdown", (e) => {
        const placementId = plEl.dataset.placementId;
        if (!placementId) return;
        const doc = state.chordCharts.active?.chart?.doc;
        if (!doc) return;

        const currentPlacement = (doc.placements || []).find(p => String(p.id) === String(placementId));
        if (!currentPlacement) return;

        // Check for double-tap (within 300ms, same element)
        const now = Date.now();
        const timeSinceLastTap = now - tapState.lastTapTime;
        const isDoubleTap = timeSinceLastTap < 300 &&
          timeSinceLastTap > 0 &&
          tapState.lastTapId === placementId;

        // Clear any pending drag timeout
        if (tapState.dragTimeout) {
          clearTimeout(tapState.dragTimeout);
          tapState.dragTimeout = null;
        }

        if (isDoubleTap) {
          // Double-tap detected - delete the placement
          e.preventDefault();
          e.stopPropagation();

          // Reset tap tracking
          tapState.lastTapTime = 0;
          tapState.lastTapId = null;

          // Remove placement from document
          if (Array.isArray(doc.placements)) {
            doc.placements = doc.placements.filter(p => String(p.id) !== String(placementId));
          }

          // Re-render to update display
          const wrapEl2 = el("chart-editor-page");
          if (wrapEl2) {
            renderChartDocIntoPage(wrapEl2, doc, {
              songTitle: state.chordCharts.active.songTitle || doc.title || "Chord Chart",
              subtitle: state.chordCharts.active.scope === "key" ? `Key: ${state.chordCharts.active.songKey}` : (state.chordCharts.active.chart.chartType === "number" ? "Number chart" : "Chord chart"),
              layout: state.chordCharts.active.chart.layout || doc?.settings?.layout,
              readOnly: false,
            });
            wireChordChartEditorInteractions();
            requestAnimationFrame(() => fitAllChartPagesToContainer(wrapEl2));
          }
          return;
        }

        // Record this tap
        tapState.lastTapTime = now;
        tapState.lastTapId = placementId;

        // Track initial position for movement detection
        const startX = e.clientX;
        const startY = e.clientY;
        let hasMoved = false;
        let dragStarted = false;

        // Delay drag start to allow for double-tap detection
        tapState.dragTimeout = setTimeout(() => {
          if (dragStarted) return; // Already started or cancelled

          // Start drag tracking
          const startRect = plEl.getBoundingClientRect();
          state.chordCharts.drag = {
            placementId,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: startRect.left,
            startTop: startRect.top,
            currentLeftPx: parseFloat(plEl.style.left || "0") || 0,
            lineIndex: currentPlacement.lineIndex ?? 0,
          };
          plEl.classList.add("dragging");
          plEl.setPointerCapture(e.pointerId);
          dragStarted = true;
        }, 200); // 200ms delay to allow double-tap

        // Start drag immediately if user moves pointer (no delay for actual dragging)
        const onMove = (ev) => {
          // If we haven't started dragging yet, check if we should start now
          if (!dragStarted) {
            const moveDistance = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);
            if (moveDistance > 3) {
              // User is dragging - start immediately
              if (tapState.dragTimeout) {
                clearTimeout(tapState.dragTimeout);
                tapState.dragTimeout = null;
              }
              const startRect = plEl.getBoundingClientRect();
              state.chordCharts.drag = {
                placementId,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: startRect.left,
                startTop: startRect.top,
                currentLeftPx: parseFloat(plEl.style.left || "0") || 0,
                lineIndex: currentPlacement.lineIndex ?? 0,
              };
              plEl.classList.add("dragging");
              plEl.setPointerCapture(e.pointerId);
              dragStarted = true;
              hasMoved = true;
              // Cancel double-tap if we've moved
              tapState.lastTapTime = 0;
            } else {
              return; // Not enough movement yet, wait
            }
          }

          const drag = state.chordCharts.drag;
          if (!drag) return;

          const dxScaled = ev.clientX - drag.startX;
          const dx = dxScaled / scale;
          const newLeft = (parseFloat(plEl.style.left || "0") || 0) + dx;
          plEl.style.left = `${Math.max(0, newLeft)}px`;
          drag.startX = ev.clientX;

          // Snap between lines by moving element to the nearest line under pointer
          const elAt = document.elementFromPoint(ev.clientX, ev.clientY);
          const line = elAt?.closest?.(".chart-line");
          if (line && line.dataset?.lineIndex) {
            const newLineIndex = parseInt(line.dataset.lineIndex, 10) || 0;
            if (newLineIndex !== drag.lineIndex) {
              const newLayer = line.querySelector(".chart-chord-layer");
              if (newLayer) {
                // Calculate the correct left position relative to the new layer
                const lyricsEl = line.querySelector(".chart-lyrics-layer");
                const newLayerRect = (lyricsEl || line).getBoundingClientRect();
                const pointerX = ev.clientX;
                const relativeX = (pointerX - newLayerRect.left) / scale;
                const newCharIndex = clampInt(relativeX / charWidth, 0, 10_000);
                const newLeftPx = newCharIndex * charWidth;

                newLayer.appendChild(plEl);
                plEl.style.left = `${newLeftPx}px`;
                drag.lineIndex = newLineIndex;
                drag.currentLeftPx = newLeftPx;
              }
            } else {
              // Update position within the same line based on pointer position
              const lyricsEl = line.querySelector(".chart-lyrics-layer");
              const lineRect = (lyricsEl || line).getBoundingClientRect();
              const relativeX = (ev.clientX - lineRect.left) / scale;
              const newCharIndex = clampInt(relativeX / charWidth, 0, 10_000);
              const newLeftPx = newCharIndex * charWidth;
              plEl.style.left = `${newLeftPx}px`;
              drag.currentLeftPx = newLeftPx;
            }
          }
        };

        const onUp = (ev) => {
          // Clear drag timeout if it exists
          if (tapState.dragTimeout) {
            clearTimeout(tapState.dragTimeout);
            tapState.dragTimeout = null;
          }

          // If we never started dragging and didn't move, it was just a tap
          if (!dragStarted && !hasMoved) {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            return; // Just a tap, let double-tap detection handle it
          }

          const drag = state.chordCharts.drag;
          if (drag) {
            state.chordCharts.drag = null;
            plEl.classList.remove("dragging");
            plEl.releasePointerCapture(ev.pointerId);
          }
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);

          const doc2 = state.chordCharts.active?.chart?.doc;
          if (!doc2) return;
          const p = (doc2.placements || []).find(pp => String(pp.id) === String(placementId));
          if (!p) return;

          // Get the final position from the element's style (which was updated during drag)
          const leftPx = parseFloat(plEl.style.left || "0") || 0;
          p.charIndex = clampInt(leftPx / charWidth, 0, 10_000);
          p.lineIndex = drag?.lineIndex ?? p.lineIndex ?? 0;
          state.chordCharts.editorCursor = { lineIndex: p.lineIndex, charIndex: p.charIndex };

          // Re-render to snap to grid
          const wrapEl2 = el("chart-editor-page");
          if (wrapEl2) {
            renderChartDocIntoPage(wrapEl2, doc2, {
              songTitle: state.chordCharts.active.songTitle || doc2.title || "Chord Chart",
              subtitle: state.chordCharts.active.scope === "key" ? `Key: ${state.chordCharts.active.songKey}` : (state.chordCharts.active.chart.chartType === "number" ? "Number chart" : "Chord chart"),
              layout: state.chordCharts.active.chart.layout || doc2?.settings?.layout,
              readOnly: false,
            });
            wireChordChartEditorInteractions();
            requestAnimationFrame(() => fitAllChartPagesToContainer(wrapEl2));
          }
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      });
    });
  });
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

function computeBeatsPerBar(timeSignature) {
  const numerator = Number(timeSignature?.numerator) || 4;
  return numerator > 0 ? numerator : 4;
}

function buildClickBuffer(audioContext, {
  frequency,
  duration,
  decay,
  noiseAmount,
  toneMix,
  noiseDuration,
  impulseAmount,
  impulseSamples,
  highpassCoeff
}) {
  const sampleRate = audioContext.sampleRate;
  const length = Math.max(1, Math.round(sampleRate * duration));
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const noiseSamples = Math.max(1, Math.round(sampleRate * (noiseDuration || duration))); // short noise burst
  const impulseCount = Math.max(0, Math.round(impulseSamples || 0));
  const hpCoeff = typeof highpassCoeff === "number" ? highpassCoeff : 0.98;
  let prevNoise = 0;
  let max = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t / decay);
    let noise = 0;
    if (i < noiseSamples) {
      const rawNoise = Math.random() * 2 - 1;
      const hpNoise = rawNoise - prevNoise * hpCoeff;
      prevNoise = rawNoise;
      const fade = 1 - i / noiseSamples;
      noise = hpNoise * fade;
    }
    let sample = noise * noiseAmount * env;
    if (impulseCount > 0 && impulseAmount) {
      if (i < impulseCount) {
        const impulseEnv = 1 - i / impulseCount;
        sample += impulseAmount * impulseEnv;
      }
    }
    if (toneMix > 0 && frequency) {
      const tone =
        Math.sin(2 * Math.PI * frequency * t) +
        0.15 * Math.sin(2 * Math.PI * frequency * 2 * t);
      sample += tone * toneMix * env;
    }
    data[i] = sample;
    const abs = Math.abs(sample);
    if (abs > max) max = abs;
  }

  // Normalize to a safe headroom
  if (max > 0) {
    const scale = 0.9 / max;
    for (let i = 0; i < length; i++) {
      data[i] *= scale;
    }
  }

  return buffer;
}

function ensureMetronomeBuffers() {
  const metronome = state.metronome;
  const audioContext = metronome.audioContext;
  if (!audioContext) return;

  if (!metronome.outputGain) {
    metronome.outputGain = audioContext.createGain();
    metronome.outputGain.gain.value = 0.8;
    metronome.outputGain.connect(audioContext.destination);
  }

  if (!metronome.clickBuffers || metronome.clickBufferSampleRate !== audioContext.sampleRate) {
    metronome.clickBuffers = {
      accent: buildClickBuffer(audioContext, {
        frequency: 1200,
        duration: 0.026,
        decay: 0.008,
        noiseAmount: 1.2,
        toneMix: 0.12,
        noiseDuration: 0.0065,
        impulseAmount: 1.0,
        impulseSamples: 10,
        highpassCoeff: 0.985
      }),
      regular: buildClickBuffer(audioContext, {
        frequency: 950,
        duration: 0.024,
        decay: 0.007,
        noiseAmount: 1.15,
        toneMix: 0.08,
        noiseDuration: 0.006,
        impulseAmount: 0.8,
        impulseSamples: 8,
        highpassCoeff: 0.985
      })
    };
    metronome.clickBufferSampleRate = audioContext.sampleRate;
  }
}

// Precise scheduling engine
function scheduler() {
  const metronome = state.metronome;
  if (!metronome.audioContext || !metronome.secondsPerBeat) return;
  const now = metronome.audioContext.currentTime;

  // If we're behind, skip ahead to avoid "catch-up" bursts.
  if (metronome.nextNoteTime < now - metronome.scheduleAheadTime) {
    const beatsBehind = Math.floor((now - metronome.nextNoteTime) / metronome.secondsPerBeat);
    if (beatsBehind > 0) {
      metronome.noteIndex += beatsBehind;
      metronome.nextNoteTime = metronome.startTime + metronome.noteIndex * metronome.secondsPerBeat;
      const beatsPerBar = metronome.beatsPerBar || 4;
      metronome.beatInBar = (metronome.beatInBar + beatsBehind) % beatsPerBar;
    }
  }

  // while there are notes that will need to play before the next interval,
  // schedule them and advance the pointer.
  while (metronome.nextNoteTime < now + metronome.scheduleAheadTime) {
    scheduleNote(metronome.beatInBar, metronome.nextNoteTime);
    nextNote();
  }

  if (metronome.isPlaying) {
    metronome.schedulerId = window.setTimeout(scheduler, metronome.lookahead);
  }
}

function nextNote() {
  const metronome = state.metronome;
  if (!metronome.secondsPerBeat) return;

  metronome.noteIndex += 1;
  metronome.nextNoteTime = metronome.startTime + metronome.noteIndex * metronome.secondsPerBeat;

  const beatsPerBar = metronome.beatsPerBar || 4;
  metronome.beatInBar = (metronome.beatInBar + 1) % beatsPerBar;
}

function scheduleNote(beatInBar, time) {
  const metronome = state.metronome;
  // push the note on the queue, even if we're not playing.
  createClickSound(metronome.audioContext, time, beatInBar < 0.0001);
}

function createClickSound(audioContext, time, isAccent) {
  if (!audioContext) return;
  ensureMetronomeBuffers();

  const metronome = state.metronome;
  const buffers = metronome.clickBuffers;
  if (!buffers) return;

  const source = audioContext.createBufferSource();
  source.buffer = isAccent ? buffers.accent : buffers.regular;
  source.connect(metronome.outputGain || audioContext.destination);
  source.start(time);
  source.stop(time + source.buffer.duration + 0.01);
}

async function startMetronome(bpm, timeSignatureStr = '4/4') {
  if (!bpm || bpm <= 0) {
    toastError("Song needs a BPM to play click track.");
    return;
  }

  // Parse time signature (e.g., "4/4", "6/8", "3/4")
  let numerator = 4;
  let denominator = 4;

  if (timeSignatureStr) {
    const parts = timeSignatureStr.split('/').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      numerator = parts[0];
      denominator = parts[1];
    }
  }

  // Stop any existing metronome
  stopMetronome();

  try {
    // Initialize audio context if needed
    if (!state.metronome.audioContext) {
      state.metronome.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended (browser autoplay policy)
    if (state.metronome.audioContext.state === 'suspended') {
      await state.metronome.audioContext.resume();
    }

    // Reset scheduling state
    state.metronome.bpm = bpm;
    state.metronome.timeSignature = { numerator, denominator };
    state.metronome.secondsPerBeat = 60.0 / bpm;
    state.metronome.beatsPerBar = computeBeatsPerBar(state.metronome.timeSignature);
    state.metronome.beatInBar = 0;
    state.metronome.noteIndex = 0;
    state.metronome.startTime = state.metronome.audioContext.currentTime + 0.1; // Start slightly in future
    state.metronome.nextNoteTime = state.metronome.startTime;
    state.metronome.isPlaying = true;

    ensureMetronomeBuffers();

    // Start the scheduler loop
    scheduler();

    updateClickTrackButtons();

  } catch (error) {
    console.error('❌ Error starting metronome:', error);
    toastError("Could not start metronome. See console.");
  }
}

function stopMetronome() {
  state.metronome.isPlaying = false;
  state.metronome.bpm = null; // Clear active BPM to reset buttons
  state.metronome.secondsPerBeat = 0;
  state.metronome.noteIndex = 0;
  state.metronome.beatInBar = 0;
  if (state.metronome.schedulerId) {
    window.clearTimeout(state.metronome.schedulerId);
    state.metronome.schedulerId = null;
  }
  updateClickTrackButtons();
}

function toggleMetronome(bpm) {
  // If we are already playing this BPM, stop it.
  if (state.metronome.isPlaying && state.metronome.bpm === bpm) {
    stopMetronome();
    return false;
  } else {
    // We need to find the time signature for the current song or default to 4/4
    // Since we don't have the song object passed directly, we look it up from the currentSongDetailsId
    // or try to guess from the context if possible. 
    // However, the button creating this call might be in a song list or details view.
    // Ideally updateClickTrackButtons logic relies on state.metronome.bpm which is set in startMetronome.

    // Let's see if we can find the song this BPM belongs to.
    // If this is called from the song details modal, we use that song.
    let timeSignature = '4/4';

    if (state.currentSongDetailsId) {
      const song = state.songs.find(s => s.id === state.currentSongDetailsId);
      if (song && song.time_signature) {
        timeSignature = song.time_signature;
      }
    }

    // If current details view isn't open, we might be clicking it from a list row.
    // For now, defaulting to 4/4 if not in details view is a safe fallback, 
    // or we could assume the song that has this BPM. But multiple songs can have same BPM.
    // The previous implementation didn't handle this at all.
    // Improvement: We can try to look up a song with this BPM in the current view? 
    // No, that's ambiguous. 
    // Best effort: Use 4/4 default if not in details modal.

    startMetronome(bpm, timeSignature);
    return true;
  }
}

// Expose to window for HTML onclick handlers
window.toggleMetronome = toggleMetronome;
window.startMetronome = startMetronome;
window.stopMetronome = stopMetronome;

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

  // Load and display profile picture
  loadProfilePicturePreview();

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // PostHog: Track modal open
  trackPostHogEvent('modal_opened', {
    modal_type: 'edit_account',
    team_id: state.currentTeamId
  });

  // Start tracking time on modal
  startPageTimeTracking('modal_edit_account', {
    team_id: state.currentTeamId
  });

  // Update MFA UI
  updateMfaStatusUI();

  // Load Sessions
  fetchSessions();
}

// Load profile picture preview in account settings modal
async function loadProfilePicturePreview() {
  const previewEl = el("profile-picture-preview");
  const removeBtn = el("btn-remove-profile-picture");
  const uploadInput = el("profile-picture-upload");

  if (!previewEl) return;

  const profilePicturePath = state.profile?.profile_picture_path;

  if (profilePicturePath) {
    // Get signed URL for profile picture from profile pictures bucket
    const url = await getFileUrl(profilePicturePath, PROFILE_PICTURES_BUCKET);
    if (url) {
      previewEl.innerHTML = `<img src="${url}" alt="Profile picture" style="width: 100%; height: 100%; object-fit: cover;">`;
      if (removeBtn) removeBtn.style.display = "block";
    } else {
      // Fallback to initials
      displayProfilePictureInitials(previewEl, state.profile?.full_name);
      if (removeBtn) removeBtn.style.display = "none";
    }
  } else {
    // Display initials
    displayProfilePictureInitials(previewEl, state.profile?.full_name);
    if (removeBtn) removeBtn.style.display = "none";
  }

  // Setup upload handler
  if (uploadInput) {
    uploadInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (event) => {
        previewEl.innerHTML = `<img src="${event.target.result}" alt="Profile picture preview" style="width: 100%; height: 100%; object-fit: cover;">`;
        if (removeBtn) removeBtn.style.display = "block";
      };
      reader.readAsDataURL(file);
    };
  }

  // Setup remove handler
  if (removeBtn) {
    removeBtn.onclick = () => {
      previewEl.innerHTML = "";
      displayProfilePictureInitials(previewEl, state.profile?.full_name);
      if (uploadInput) uploadInput.value = "";
      removeBtn.style.display = "none";
      // Mark for removal
      previewEl.dataset.removePicture = "true";
    };
  }
}

// Display profile picture initials
function displayProfilePictureInitials(element, fullName) {
  if (!element || !fullName) {
    element.innerHTML = '<i class="fa-solid fa-user"></i>';
    return;
  }
  const initials = fullName
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  element.textContent = initials;

  // Adjust font size based on element size
  const size = element.offsetWidth || 64;
  if (size <= 64) {
    element.style.fontSize = "1.25rem";
  } else {
    element.style.fontSize = "2.5rem";
  }
}

// Display profile picture with gradient background based on name
function displayProfilePictureWithGradient(element, fullName) {
  if (!element || !fullName) {
    element.innerHTML = '<i class="fa-solid fa-user"></i>';
    return;
  }

  const initials = fullName
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Generate consistent colors based on name hash
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) {
    hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use the --accent-color CSS variable for a solid background
  element.style.background = 'var(--accent-color)';
  element.style.color = '#ffffff';
  element.textContent = initials;

  // Adjust font size based on element size
  const size = element.offsetWidth || 64;
  if (size <= 64) {
    element.style.fontSize = "1.25rem";
  } else {
    element.style.fontSize = "2.5rem";
  }
}

// Format relative time (e.g., "2 days ago", "in 3 days")
function formatRelativeTime(dateString) {
  if (!dateString) return 'No date';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays > 0) {
    if (diffDays < 7) {
      return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `in ${weeks} week${weeks !== 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `in ${months} month${months !== 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `in ${years} year${years !== 1 ? 's' : ''}`;
    }
  } else {
    const absDays = Math.abs(diffDays);
    if (absDays < 7) {
      return `${absDays} day${absDays !== 1 ? 's' : ''} ago`;
    } else if (absDays < 30) {
      const weeks = Math.floor(absDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else if (absDays < 365) {
      const months = Math.floor(absDays / 30);
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(absDays / 365);
      return `${years} year${years !== 1 ? 's' : ''} ago`;
    }
  }
}

// Render pie chart for assignment statistics
function renderPieChart(accepted, declined, pending, total) {
  const pieChartEl = el("pie-chart");
  const pieTotalEl = el("pie-total");
  const pieBackgroundEl = el("pie-background");

  if (!pieChartEl) {
    console.error('Pie chart element not found');
    return;
  }

  if (pieTotalEl) {
    pieTotalEl.textContent = total;
  }

  // Clear existing paths and circles (but keep the background circle)
  const existingPaths = pieChartEl.querySelectorAll('path');
  existingPaths.forEach(p => p.remove());
  const existingCircles = pieChartEl.querySelectorAll('circle:not(#pie-background)');
  existingCircles.forEach(c => c.remove());

  // Donut chart geometry (SVG viewBox is 0..100)
  const centerX = 50;
  const centerY = 50;
  const radius = 45;
  // Thickness ~17 (not super thin) with outer radius 45
  const holeRadius = 34;

  function addDonutHole() {
    // The hole circle sits on top of segments to "cut out" the center,
    // improving text contrast without changing segment math.
    const hole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hole.setAttribute('id', 'pie-hole');
    hole.setAttribute('cx', centerX);
    hole.setAttribute('cy', centerY);
    hole.setAttribute('r', holeRadius);
    hole.setAttribute('fill', 'var(--bg-card)');
    pieChartEl.appendChild(hole);
  }

  // If no assignments, show grey background
  if (total === 0) {
    if (pieBackgroundEl) {
      // Use a proper grey color that works in both light and dark mode
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const greyColor = isDark ? '#36393d' : '#d9d9d9'; // Medium grey for light mode, darker grey for dark mode
      pieBackgroundEl.style.fill = greyColor;
    }
    addDonutHole();
    return;
  }

  // If there are assignments, make background transparent so pie segments show
  if (pieBackgroundEl) {
    pieBackgroundEl.style.fill = 'transparent';
  }

  // Color scheme
  const colors = {
    accepted: getComputedStyle(document.documentElement).getPropertyValue('--chart-accepted-color').trim() || '#10b981', // green
    declined: getComputedStyle(document.documentElement).getPropertyValue('--chart-declined-color').trim() || '#ef4444', // red
    pending: getComputedStyle(document.documentElement).getPropertyValue('--chart-pending-color').trim() || '#f59e0b'  // amber
  };

  const data = [
    { value: accepted, color: colors.accepted, label: 'accepted' },
    { value: declined, color: colors.declined, label: 'declined' },
    { value: pending, color: colors.pending, label: 'pending' }
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return;
  }

  // Calculate angles starting from top (0 degrees, but SVG is rotated -90deg so this will appear at top)
  let currentAngle = 0;

  data.forEach((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (percentage / 100) * 360;

    // Handle full circle case
    if (angle >= 360) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', centerX);
      circle.setAttribute('cy', centerY);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', item.color);
      circle.setAttribute('class', `pie-segment pie-${item.label}`);
      circle.setAttribute('stroke', 'var(--bg-card)');
      circle.setAttribute('stroke-width', '2');
      pieChartEl.appendChild(circle);
      return;
    }

    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', item.color);
    path.setAttribute('class', `pie-segment pie-${item.label}`);
    path.setAttribute('stroke', 'var(--bg-card)');
    path.setAttribute('stroke-width', '2');

    pieChartEl.appendChild(path);

    currentAngle = endAngle;
  });

  // Cut out the center to make a donut chart.
  addDonutHole();
}

// Update user profile picture in header
async function updateUserProfilePicture() {
  const profilePictureEl = el("user-profile-picture");
  if (!profilePictureEl) return;

  const profilePicturePath = state.profile?.profile_picture_path;

  if (profilePicturePath) {
    // Get signed URL for profile picture from profile pictures bucket
    const url = await getFileUrl(profilePicturePath, PROFILE_PICTURES_BUCKET);
    if (url) {
      profilePictureEl.innerHTML = `<img src="${url}" alt="Profile picture" style="width: 100%; height: 100%; object-fit: cover;">`;
      return;
    }
  }

  // Fallback to initials or icon
  const fullName = state.profile?.full_name;
  if (fullName) {
    const initials = fullName
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    profilePictureEl.textContent = initials;
    profilePictureEl.style.fontSize = "1rem";
  } else {
    profilePictureEl.innerHTML = '<i class="fa-solid fa-user-circle" style="font-size: 1.5rem;"></i>';
  }
}

// Get profile picture URL for a user (by profile picture path)
async function getUserProfilePictureUrl(profilePicturePath, fullName) {
  if (profilePicturePath) {
    const url = await getFileUrl(profilePicturePath, PROFILE_PICTURES_BUCKET);
    if (url) return url;
  }
  return null; // Return null if no picture, caller will handle fallback
}

async function fetchSessions() {
  const listContainer = el("account-session-list");
  if (!listContainer) return;

  // Show skeleton loader (1 item for seamless feel)
  listContainer.innerHTML = Array(1).fill(0).map(() => `
    <div class="session-item" style="border: 1px solid var(--border-color);">
      <div class="session-info" style="width: 100%;">
        <div class="skeleton skeleton-avatar" style="width: 2.5rem; height: 2.5rem;"></div>
        <div class="session-details" style="width: 100%;">
          <div class="skeleton skeleton-text" style="width: 60%; margin-bottom: 0.5rem;"></div>
          <div class="skeleton skeleton-text" style="width: 40%;"></div>
        </div>
      </div>
    </div>
  `).join('');

  try {
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke('session-manager', {
      body: { action: 'get-sessions' }
    });

    if (error) throw error;

    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      listContainer.innerHTML = '<p class="muted small-text" style="text-align: center;">No active sessions found.</p>';
      return;
    }

    listContainer.innerHTML = ''; // Clear loading

    sessions.forEach((s, index) => {
      // Determine if this is the current session
      let isCurrent = false;
      if (session) {
        try {
          // Basic JWT decode to find session_id
          const base64Url = session.access_token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(jsonPayload);
          if (payload.session_id === s.id) {
            isCurrent = true;
          }
        } catch (e) {
          console.warn("Error decoding token for session check", e);
        }
      }

      const elItem = document.createElement('div');
      elItem.className = 'session-item ripple-item';
      // Stagger animation
      elItem.style.animationDelay = `${index * 0.05}s`;

      // Icon selection
      let iconClass = 'fa-desktop';
      if (s.device_type === 'mobile') iconClass = 'fa-mobile-screen-button';

      // Relative Time
      const lastActive = new Date(s.updated_at);
      const now = new Date();
      const diffMs = now - lastActive;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let timeString = 'Just now';
      if (diffDays > 0) timeString = `${diffDays}d ago`;
      else if (diffHours > 0) timeString = `${diffHours}h ago`;
      else if (diffMins > 0) timeString = `${diffMins}m ago`;

      elItem.innerHTML = `
        <div class="session-info">
          <div class="session-icon">
            <i class="fa-solid ${iconClass}"></i>
          </div>
          <div class="session-details">
            <h4>
              ${s.device_name}
              ${isCurrent ? '<span class="current-session-badge">This Device</span>' : ''}
            </h4>
            <p>Active ${timeString} • ${s.ip || 'Unknown IP'}</p>
          </div>
        </div>
        ${!isCurrent ? `
          <button class="btn small ghost btn-revoke-session" data-id="${s.id}" style="color: var(--error-color);">
            Log Out
          </button>
        ` : ''}
      `;

      // Bind event
      const revokeBtn = elItem.querySelector('.btn-revoke-session');
      if (revokeBtn) {
        revokeBtn.addEventListener('click', () => revokeSession(s.id));
      }

      listContainer.appendChild(elItem);
    });

  } catch (err) {
    console.error("Error fetching sessions:", err);
    listContainer.innerHTML = '<p class="error-text small-text" style="text-align: center;">Failed to load sessions.</p>';
  }
}

async function revokeSession(sessionId) {
  if (!confirm("Are you sure you want to log out of this session?")) return;

  // Optimistic UI updates could happen here, or show loading state on button
  // For now, simple toast

  try {
    const { error } = await supabase.functions.invoke('session-manager', {
      body: { action: 'revoke-session', sessionId }
    });

    if (error) throw error;

    toastSuccess("Session will be logged out shortly.");
    fetchSessions(); // Reload list

  } catch (err) {
    console.error("Error revoking session:", err);
    toastError("Failed to revoke session.");
  }
}

function closeEditAccountModal() {
  const modal = el("edit-account-modal");
  if (modal) {
    closeModalWithAnimation(modal, () => {
      const form = el("edit-account-form");
      if (form) form.reset();
      const previewEl = el("profile-picture-preview");
      if (previewEl) {
        delete previewEl.dataset.removePicture;
      }
    });
  }
}

async function handleEditAccountSubmit(e) {
  e.preventDefault();

  const modal = el("edit-account-modal");
  const input = el("edit-account-name-input");
  const uploadInput = el("profile-picture-upload");
  const previewEl = el("profile-picture-preview");

  if (!input || !state.profile) return;

  const currentName = state.profile.full_name || "";
  const newName = input.value.trim();

  if (!newName) {
    toastError("Name cannot be empty.");
    return;
  }

  let profilePicturePath = state.profile.profile_picture_path || null;
  let shouldRemovePicture = previewEl?.dataset.removePicture === "true";

  // Handle profile picture upload
  if (uploadInput?.files?.[0]) {
    const file = uploadInput.files[0];

    // Delete old picture if it exists
    if (profilePicturePath) {
      await deleteFileFromSupabase(profilePicturePath, PROFILE_PICTURES_BUCKET);
    }

    // Upload new picture
    const uploadResult = await uploadProfilePicture(file, state.session.user.id);
    if (!uploadResult.success) {
      toastError(`Failed to upload profile picture: ${uploadResult.error}`);
      return;
    }
    profilePicturePath = uploadResult.filePath;
  } else if (shouldRemovePicture && profilePicturePath) {
    // Remove profile picture
    await deleteFileFromSupabase(profilePicturePath, PROFILE_PICTURES_BUCKET);
    profilePicturePath = null;
  }

  // Check if anything changed
  const nameChanged = newName !== currentName;
  const pictureChanged = profilePicturePath !== (state.profile.profile_picture_path || null);

  if (!nameChanged && !pictureChanged) {
    // No change, just close modal
    closeEditAccountModal();
    return;
  }

  // Build update object
  const updateData = {};
  if (nameChanged) {
    updateData.full_name = newName;
  }
  if (pictureChanged) {
    updateData.profile_picture_path = profilePicturePath;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", state.session.user.id);

  if (error) {
    console.error("Error updating account:", error);
    toastError("Unable to update account. Check console.");
    return;
  }

  // PostHog: Track modal conversion
  trackPostHogEvent('modal_converted', {
    modal_type: 'edit_account',
    team_id: state.currentTeamId,
    name_changed: nameChanged,
    picture_changed: pictureChanged
  });

  // Also update auth metadata to keep it in sync
  if (nameChanged) {
    try {
      await supabase.auth.updateUser({
        data: { full_name: newName }
      });
    } catch (metadataError) {
      console.warn("Failed to update auth metadata:", metadataError);
      // Non-critical, continue
    }
  }

  // Update local state
  if (nameChanged) {
    state.profile.full_name = newName;
  }
  if (pictureChanged) {
    state.profile.profile_picture_path = profilePicturePath;
  }

  // Update UI
  if (nameChanged) {
    const userNameEl = el("user-name");
    if (userNameEl) {
      userNameEl.textContent = newName;
    }
  }

  // Update profile picture in header
  updateUserProfilePicture();

  // Refresh people list to show updated name/picture
  await loadPeople();

  // Close modal
  closeEditAccountModal();

  // Close account menu
  el("account-menu")?.classList.add("hidden");
}

async function handleAccountPasswordReset() {
  if (!state.session?.user?.email) {
    toastError("Unable to get your email address. Please try again.");
    return;
  }

  const email = state.session.user.email;
  const resetBtn = el("btn-reset-password");

  if (!resetBtn) return;

  // Disable button and show loading state
  const originalText = resetBtn.innerHTML;
  resetBtn.disabled = true;
  resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });

    if (error) {
      console.error('❌ Error sending password reset email:', error);
      toastError(error.message || "Failed to send password reset email. Please try again.");
      resetBtn.disabled = false;
      resetBtn.innerHTML = originalText;
      return;
    }

    console.log('✅ Password reset email sent successfully to:', email);
    toastSuccess("Password reset email sent! Please check your inbox and follow the instructions to reset your password.");

    // Re-enable button
    resetBtn.disabled = false;
    resetBtn.innerHTML = originalText;
  } catch (err) {
    console.error('❌ Unexpected error sending password reset email:', err);
    toastError("An unexpected error occurred. Please try again.");
    resetBtn.disabled = false;
    resetBtn.innerHTML = originalText;
  }
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
let teamAlertTimeSelectedValue = null;
let teamTimezoneSelectedValue = null;
let teamAlertTimeDropdown = null;
let teamTimezoneDropdown = null;

async function openTeamSettingsModal() {
  if (!isOwner()) return;

  const modal = el("team-settings-modal");
  const nameInput = el("team-settings-name-input");
  const assignmentModeContainer = el("team-assignment-mode-container");
  const alertTimeContainer = el("team-alert-time-container");
  const timezoneContainer = el("team-timezone-container");
  const requirePublishCheckbox = el("team-require-publish");
  const itunesIndexingEnabledCheckbox = el("team-itunes-indexing-enabled");

  if (!modal || !nameInput || !assignmentModeContainer) return;

  // Get local team data or default
  let teamData = state.userTeams.find(t => t.id === state.currentTeamId) || {
    name: '',
    assignment_mode: state.teamAssignmentMode || 'per_set',
    daily_reminder_time: '06:00:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    require_publish: true,
    itunes_indexing_enabled: true
  };

  const render = (data) => {
    // Name
    if (document.activeElement !== nameInput) {
      nameInput.value = data.name || "";
    }

    // Assignment Mode
    const currentMode = data.assignment_mode || state.teamAssignmentMode || 'per_set';
    teamAssignmentModeSelectedValue = currentMode;
    assignmentModeContainer.innerHTML = "";
    const modeOptions = [
      { value: 'per_set', label: 'Per Set' },
      { value: 'per_song', label: 'Per Song' }
    ];
    teamAssignmentModeDropdown = createSimpleDropdown(modeOptions, "Select assignment mode...", currentMode);
    teamAssignmentModeDropdown.addEventListener("change", (e) => {
      teamAssignmentModeSelectedValue = e.detail.value;
    });
    assignmentModeContainer.appendChild(teamAssignmentModeDropdown);

    // Alert Time
    if (alertTimeContainer) {
      alertTimeContainer.innerHTML = "";
      const savedTime = data.daily_reminder_time || "06:00:00";
      // Strip seconds if present for matching
      const [h, m] = savedTime.split(':');
      const timeValue = `${h}:${m}:00`; // Ensure HH:MM:00 format
      teamAlertTimeSelectedValue = timeValue;

      // Generate hours 00:00 - 23:00 with 12-hour labels
      const timeOptions = [];
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        const date = new Date(`2000-01-01T${hour}:00:00`);
        // Force 12-hour format
        const label = date.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
        timeOptions.push({ value: `${hour}:00:00`, label: label });
      }

      teamAlertTimeDropdown = createSimpleDropdown(timeOptions, "Select time...", timeValue);
      teamAlertTimeDropdown.addEventListener("change", (e) => {
        teamAlertTimeSelectedValue = e.detail.value;
      });
      alertTimeContainer.appendChild(teamAlertTimeDropdown);
    }

    // Timezone
    if (timezoneContainer) {
      timezoneContainer.innerHTML = "";
      const savedTimezone = data.timezone;
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const defaultTimezone = savedTimezone || detectedTimezone;
      teamTimezoneSelectedValue = defaultTimezone;

      const commonTimezones = [
        "UTC",
        "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "America/Honolulu",
        "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Zurich", "Europe/Madrid", "Europe/Rome", "Europe/Moscow",
        "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Asia/Dubai", "Asia/Kolkata",
        "Australia/Sydney", "Australia/Melbourne", "Australia/Perth",
        "Pacific/Auckland"
      ];
      if (!commonTimezones.includes(defaultTimezone)) {
        commonTimezones.push(defaultTimezone);
        commonTimezones.sort();
      }
      const timezoneOptions = commonTimezones.map(tz => ({ value: tz, label: tz.replace(/_/g, " ") }));
      teamTimezoneDropdown = createSimpleDropdown(timezoneOptions, "Select timezone...", defaultTimezone);
      teamTimezoneDropdown.addEventListener("change", (e) => {
        teamTimezoneSelectedValue = e.detail.value;
      });
      timezoneContainer.appendChild(teamTimezoneDropdown);
    }

    // Require Publish
    if (requirePublishCheckbox) {
      requirePublishCheckbox.checked = data.require_publish !== false; // Default to true if not set
    }

    // iTunes indexing enabled
    if (itunesIndexingEnabledCheckbox) {
      itunesIndexingEnabledCheckbox.checked = data.itunes_indexing_enabled !== false; // Default to true if not set
    }

    // AI Enabled
    const aiEnabledCheckbox = el("team-ai-enabled");
    if (aiEnabledCheckbox) {
      aiEnabledCheckbox.checked = data.ai_enabled || false;
    }
  };

  // Render immediately with local data
  console.log('Opening Team Settings with local data:', teamData);
  render(teamData);

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Fetch fresh data in background
  try {
    let { data: freshData, error } = await supabase
      .from("teams")
      .select("id, name, assignment_mode, daily_reminder_time, timezone, require_publish, itunes_indexing_enabled, ai_enabled")
      .eq("id", state.currentTeamId)
      .single();

    if (error) {
      // Backward compatibility if migrations haven't been applied yet
      if (error.message?.includes("itunes_indexing_enabled")) {
        console.warn('Team iTunes indexing column may not exist yet; retrying without it');
        const retry = await supabase
          .from("teams")
          .select("id, name, assignment_mode, daily_reminder_time, timezone, require_publish")
          .eq("id", state.currentTeamId)
          .single();
        freshData = retry.data;
        error = retry.error;
      }
      if (error) {
        console.error("Error refreshing team details:", error);
        return;
      }
    }

    if (freshData) {
      console.log('Fresh Team Data fetched:', freshData);

      // Check for changes before updating state (because state update mutates teamData if it's a reference)
      const requiresUpdate =
        (freshData.name !== teamData.name && document.activeElement !== nameInput) ||
        (freshData.assignment_mode !== teamData.assignment_mode) ||
        (freshData.daily_reminder_time !== teamData.daily_reminder_time) ||
        (freshData.timezone !== teamData.timezone) ||
        (freshData.require_publish !== teamData.require_publish) ||
        (freshData.itunes_indexing_enabled !== teamData.itunes_indexing_enabled) ||
        (freshData.ai_enabled !== teamData.ai_enabled);

      // Update local state
      const stateTeam = state.userTeams.find(t => t.id === state.currentTeamId);
      if (stateTeam) {
        Object.assign(stateTeam, freshData);
      }

      if (requiresUpdate && !modal.classList.contains("hidden")) {
        console.log('Refreshing UI with fresh data');
        render(freshData);
      }
    }
  } catch (err) {
    console.error("Unexpected error refreshing team data:", err);
  }
}

function closeTeamSettingsModal() {
  const modal = el("team-settings-modal");
  if (modal) {
    closeModalWithAnimation(modal);
  }
}

async function handleTeamSettingsSubmit(e) {
  e.preventDefault();

  if (!isOwner()) return;

  const modal = el("team-settings-modal");
  const nameInput = el("team-settings-name-input");
  const requirePublishCheckbox = el("team-require-publish");
  const itunesIndexingEnabledCheckbox = el("team-itunes-indexing-enabled");
  const aiEnabledCheckbox = el("team-ai-enabled");

  if (!nameInput || !teamAssignmentModeDropdown) return;

  const currentTeam = state.userTeams.find(t => t.id === state.currentTeamId);
  const currentTeamName = currentTeam?.name || "Team";
  const newName = nameInput.value.trim();

  // Get values
  const newAssignmentMode = teamAssignmentModeDropdown.getValue() || teamAssignmentModeSelectedValue || state.teamAssignmentMode || 'per_set';
  const newAlertTime = teamAlertTimeDropdown?.getValue() || teamAlertTimeSelectedValue;
  const newTimezone = teamTimezoneDropdown?.getValue() || teamTimezoneSelectedValue;
  const newRequirePublish = requirePublishCheckbox?.checked !== false; // Default to true
  const newItunesIndexingEnabled = itunesIndexingEnabledCheckbox?.checked !== false; // Default to true
  const newAiEnabled = aiEnabledCheckbox?.checked || false;

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

  if (newAlertTime && newAlertTime !== currentTeam?.daily_reminder_time) {
    updates.daily_reminder_time = newAlertTime;
    hasChanges = true;
  }

  if (newTimezone && newTimezone !== currentTeam?.timezone) {
    updates.timezone = newTimezone;
    hasChanges = true;
  }

  if (newRequirePublish !== (currentTeam?.require_publish !== false)) {
    updates.require_publish = newRequirePublish;
    hasChanges = true;
  }

  if (newItunesIndexingEnabled !== (currentTeam?.itunes_indexing_enabled !== false)) {
    updates.itunes_indexing_enabled = newItunesIndexingEnabled;
    hasChanges = true;
  }

  // Handle AI Enabled (New Column)
  if (newAiEnabled !== (currentTeam?.ai_enabled || false)) {
    updates.ai_enabled = newAiEnabled;
    hasChanges = true;
  }

  if (!hasChanges) {
    // No changes, just close modal
    closeTeamSettingsModal();
    return;
  }

  let { error } = await supabase
    .from("teams")
    .update(updates)
    .eq("id", state.currentTeamId);

  // Backward compatibility if migrations haven't been applied yet
  if (error && error.message?.includes("itunes_indexing_enabled") && updates.itunes_indexing_enabled !== undefined) {
    console.warn('teams.itunes_indexing_enabled column may not exist yet; retrying save without it');
    const { itunes_indexing_enabled, ...retryUpdates } = updates;
    const retry = await supabase
      .from("teams")
      .update(retryUpdates)
      .eq("id", state.currentTeamId);
    error = retry.error;
  }

  if (error) {
    console.error("Error updating team settings:", error);
    toastError("Unable to save team settings. Check console.");
    return;
  }

  // Update local state
  if (currentTeam) {
    if (updates.name) currentTeam.name = updates.name;
    if (updates.assignment_mode) currentTeam.assignment_mode = updates.assignment_mode;
    if (updates.daily_reminder_time) currentTeam.daily_reminder_time = updates.daily_reminder_time;
    if (updates.timezone) currentTeam.timezone = updates.timezone;
    if (updates.require_publish !== undefined) currentTeam.require_publish = updates.require_publish;
    if (updates.itunes_indexing_enabled !== undefined) currentTeam.itunes_indexing_enabled = updates.itunes_indexing_enabled;
    if (updates.ai_enabled !== undefined) currentTeam.ai_enabled = updates.ai_enabled;

    // Force update the current selected team ref in the list to trigger reactivity if any
    const teamIndex = state.userTeams.findIndex(t => t.id === state.currentTeamId);
    if (teamIndex !== -1) {
      state.userTeams[teamIndex] = { ...currentTeam };
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

  toastSuccess("Team settings saved successfully.");

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

      // Clean up album art override files before deleting team
      console.log('  - Cleaning up album art override files...');
      const { data: songs } = await supabase
        .from("songs")
        .select("album_art_override_path")
        .eq("team_id", teamId)
        .not("album_art_override_path", "is", null);

      if (songs && songs.length > 0) {
        for (const song of songs) {
          if (song.album_art_override_path) {
            await deleteFileFromSupabase(song.album_art_override_path);
          }
        }
        console.log(`  - Deleted ${songs.length} album art override file(s)`);
      }

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

/* -------------------------------------------------------------------------- */
/*                                MFA / TOTP Logic                            */
/* -------------------------------------------------------------------------- */

function setupMfaListeners() {
  el("btn-setup-totp")?.addEventListener("click", handleTotpSetup);
  el("close-totp-modal")?.addEventListener("click", cancelTotpSetup);
  el("btn-totp-cancel-intro")?.addEventListener("click", cancelTotpSetup);
  el("btn-totp-start")?.addEventListener("click", startTotpEnrollment);
  el("btn-totp-back-scan")?.addEventListener("click", () => updateTotpView("intro"));
  el("btn-totp-next-verify")?.addEventListener("click", () => updateTotpView("verify"));
  el("btn-copy-secret")?.addEventListener("click", copyTotpSecret);
  el("btn-totp-back-verify")?.addEventListener("click", () => updateTotpView("scan"));
  el("btn-totp-verify-enable")?.addEventListener("click", onTotpVerify);
  el("btn-totp-finish")?.addEventListener("click", onTotpFinish);

  // Login Challenge Listeners
  el("mfa-challenge-form")?.addEventListener("submit", handleMfaChallengeSubmit);
  el("close-mfa-modal")?.addEventListener("click", () => el("mfa-challenge-modal")?.classList.add("hidden"));
  el("btn-mfa-cancel")?.addEventListener("click", () => el("mfa-challenge-modal")?.classList.add("hidden"));

  // Management & Disable
  el("btn-manage-totp")?.addEventListener("click", promptDisableMfa);
  el("btn-cancel-disable-totp")?.addEventListener("click", () => el("totp-disable-modal")?.classList.add("hidden"));
  el("close-totp-disable-modal")?.addEventListener("click", () => el("totp-disable-modal")?.classList.add("hidden"));
  el("btn-confirm-disable-totp")?.addEventListener("click", () => {
    el("totp-disable-modal")?.classList.add("hidden");
    openMfaChallengeModal({
      onSuccess: disableMfa
    });
  });
}

async function updateMfaStatusUI() {
  const badge = el("mfa-status-badge");
  const setupBtn = el("btn-setup-totp");
  const manageBtn = el("btn-manage-totp");

  if (!badge || !setupBtn || !manageBtn) return;

  try {
    // 1. Force Refresh Session to see latest 'verified' status
    await supabase.auth.refreshSession();

    // Check factors
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.warn("Error listing factors:", error.message);
      // alert("Error listing factors: " + error.message);
      badge.classList.add("hidden");
      setupBtn.classList.remove("hidden");
      manageBtn.classList.add("hidden");
      return;
    }

    const factors = data?.all || [];
    const totpFactor = factors.find(f => f.factor_type === 'totp' && f.status === 'verified');

    if (totpFactor) {
      badge.classList.remove("hidden");
      setupBtn.classList.add("hidden");
      manageBtn.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
      setupBtn.classList.remove("hidden");
      manageBtn.classList.add("hidden");
    }
  } catch (e) {
    console.warn("MFA UI update crash prevented:", e);
  }
}

async function handleTotpSetup() {
  // Reset wizards
  resetTotpWizard();

  // Show modal
  const modal = el("totp-setup-modal");
  modal.classList.remove("hidden");
  updateTotpView("intro");
}

async function cancelTotpSetup() {
  const modal = el("totp-setup-modal");
  if (modal) modal.classList.add("hidden");

  // If we have a pending factor ID that hasn't been verified, unenroll it
  if (state.mfa.setupFactorId) {
    console.log("Cancelling setup, removing factor:", state.mfa.setupFactorId);
    try {
      await supabase.auth.mfa.unenroll({ factorId: state.mfa.setupFactorId });
      console.log("Factor unenrolled successfully");
    } catch (err) {
      console.warn("Error cleaning up factor on cancel:", err);
      // It might fail if it was already verified or deleted, which is fine
    }
    state.mfa.setupFactorId = null;
  }
}

function resetTotpWizard() {
  state.mfa = {
    setupFactorId: null,
    setupSecret: null,
    qrCode: null,
    tempFactorId: null
  };
  el("totp-verify-input").value = "";
  el("totp-verify-error").textContent = "";
  el("totp-verify-error").classList.add("hidden");
  el("totp-secret-key").textContent = "";
  el("totp-qr-container").innerHTML = "";


  // Reset verify button
  const verifyBtn = el("btn-totp-verify-enable");
  if (verifyBtn) {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify & Enable";
  }
}

function updateTotpView(viewName) {
  // views: intro, scan, verify, recovery
  const views = ["intro", "scan", "verify"];

  views.forEach(v => {
    const elView = el(`totp-view-${v}`);
    if (elView) {
      if (v === viewName) elView.classList.remove("hidden");
      else elView.classList.add("hidden");
    }
  });
}

async function startTotpEnrollment() {
  const startBtn = el("btn-totp-start");
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = "Generating...";
  }

  try {
    // 1. Refresh session to ensure we have latest claims
    await supabase.auth.refreshSession();

    // 2. Cleanup (Try to list factors)
    const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();

    if (listError) {
      console.warn("List factors failed:", listError);
      // If 422/error, we proceed anyway hoping Enroll works or we catch the specific error
    } else if (factorsData?.factors) {
      // Filter for unverified TOTP
      const unverifiedFactors = factorsData.factors.filter(f => f.factor_type === 'totp' && f.status === 'unverified');

      if (unverifiedFactors.length > 0) {
        console.log("Cleaning up unverified factors:", unverifiedFactors.length);
        for (const factor of unverifiedFactors) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
    }

    // 3. Enroll with a Friendly Name
    // Strategy: Try standard name. If it conflicts (and cleanup failed), try unique name.
    let friendlyName = `Cadence (${state.profile?.email || 'User'})`;

    let enrollData, enrollError;

    try {
      const res = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: friendlyName
      });
      enrollData = res.data;
      enrollError = res.error;

      if (enrollError && enrollError.message && enrollError.message.includes("already exists")) {
        console.log("Enrollment conflict detected. Retrying with unique name...");
        throw enrollError; // Throw to catch block for retry
      }
    } catch (e) {
      // Retry with timestamp if it was a conflict
      if (e.message && e.message.includes("already exists")) {
        const timestamp = new Date().getTime().toString().slice(-4);
        friendlyName = `Cadence (${state.profile?.email || 'User'}) - ${timestamp}`;

        const retryRes = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: friendlyName
        });
        enrollData = retryRes.data;
        enrollError = retryRes.error;
      } else {
        // Some other error, rethrow
        throw e;
      }
    }

    if (enrollError) throw enrollError;

    // Map response
    state.mfa.setupFactorId = enrollData.id;
    state.mfa.setupSecret = enrollData.totp?.secret || enrollData.secret;
    let qrCodeSvg = enrollData.totp?.qr_code || enrollData.qr_code;

    // CLEANUP: Supabase sometimes returns "data:image/svg+xml;utf-8, <svg...>" or similar.
    // We want PURE SVG for inline rendering.
    if (qrCodeSvg && typeof qrCodeSvg === 'string') {
      const svgStart = qrCodeSvg.indexOf('<svg');
      if (svgStart > -1) {
        qrCodeSvg = qrCodeSvg.substring(svgStart);
      }

      // FIX: Inject viewBox if missing (restored logic)
      if (!qrCodeSvg.includes('viewBox')) {
        const wMatch = qrCodeSvg.match(/width="(\d+)"/);
        const hMatch = qrCodeSvg.match(/height="(\d+)"/);
        if (wMatch && hMatch) {
          const w = wMatch[1];
          const h = hMatch[1];
          qrCodeSvg = qrCodeSvg.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
        }
      }
    }

    state.mfa.qrCode = qrCodeSvg;

    // Render QR
    if (el("totp-qr-container")) {
      // Use inline SVG (Direct)
      if (state.mfa.qrCode) {
        el("totp-qr-container").innerHTML = state.mfa.qrCode;
      } else {
        console.error("QR Code is undefined in response", enrollData);
        el("totp-qr-container").textContent = "Error loading QR Code. Please use the manual key.";
      }
    }

    if (el("totp-secret-key")) el("totp-secret-key").textContent = state.mfa.setupSecret;

    updateTotpView("scan");

  } catch (err) {
    console.error("Enrollment error:", err);
    toastError("Failed to start enrollment.");
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Get Started";
  }
}

function copyTotpSecret() {
  const secret = state.mfa.setupSecret;
  if (secret) {
    navigator.clipboard.writeText(secret).then(() => {
      toastSuccess("Secret copied to clipboard");
    });
  }
}

async function onTotpVerify() {
  const verifyBtn = el("btn-totp-verify-enable");
  const codeInput = el("totp-verify-input");
  const errorText = el("totp-verify-error");

  const code = codeInput.value.trim();
  if (code.length !== 6) {
    errorText.textContent = "Please enter a 6-digit code.";
    errorText.classList.remove("hidden");
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verifying...";
  errorText.classList.add("hidden");

  try {
    // 1. Create a Challenge first (Required for enrollment verification in some flows, or just robust)
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: state.mfa.setupFactorId
    });

    if (challengeError) throw challengeError;

    // 2. Verify against that challenge
    const verifyRes = await supabase.auth.mfa.verify({
      factorId: state.mfa.setupFactorId,
      challengeId: challengeData.id,
      code: code
    });

    if (verifyRes.error) throw verifyRes.error;

    console.log("✅ TOTP Factor Verified");

    // DEBUG: Alert check status
    // alert("Verified! Checking AAL...");

    // 2. Force Refresh & Check AAL
    const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
    if (sessionError) console.error("Session refresh error:", sessionError);

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    console.log("📊 Current AAL:", aalData.currentLevel);

    // DEBUG: Alert AAL
    // alert("Current AAL: " + aalData.currentLevel);

    if (aalData.currentLevel !== 'aal2') {
      // Try upgrading session using the token from verifyRes if available?
      // verifyRes.data might contain a session
      if (verifyRes.data?.session) {
        await supabase.auth.setSession(verifyRes.data.session);
        // alert("Set session from verify response");
      } else {
        // alert("No session in verify response. Attempting reuse challenge...");
        // Try reusing code (might fail due to replay check)
        const challengeRes = await supabase.auth.mfa.challengeAndVerify({
          factorId: state.mfa.setupFactorId,
          code: code
        });
        if (challengeRes.error) {
          console.warn("Upgrade failed:", challengeRes.error);
          // alert("Upgrade failed: " + challengeRes.error.message);
        } else {
          // alert("Upgraded to AAL2 via reuse!");
        }
      }
    }

    // Re-check AAL
    const { data: aalData2 } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // alert("Final AAL before recovery: " + aalData2.currentLevel);

    // 3. Success & Finish
    // Force UI update explicitly
    await updateMfaStatusUI();

    // Done
    onTotpFinish();

  } catch (err) {
    console.error("Verification error:", err);
    errorText.textContent = err.message || "Invalid code. Please try again.";
    errorText.classList.remove("hidden");
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify & Enable";
  }
}

function onTotpFinish() {
  el("totp-setup-modal")?.classList.add("hidden");
  toastSuccess("Two-Factor Authentication Enabled!");
}

async function openMfaManagement() {
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData.currentLevel !== 'aal2') {
    openMfaChallengeModal({
      onSuccess: showMfaActionSheet
    });
  } else {
    showMfaActionSheet();
  }
}

// function showMfaActionSheet() {
//   // Replaced by promptDisableMfa
// }

function promptDisableMfa() {
  const modal = el("totp-disable-modal");
  if (modal) modal.classList.remove("hidden");

  // Clean up old listeners to prevent dupes (though usually we'd use .onclick or a cleaner event manager)
  // For simplicity here, let's just re-bind or ensure we handle it in setupMfaListeners
}

// NOTE: Moved actual disable call to event listener in setupMfaListeners



async function disableMfa() {
  try {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData.all.find(f => f.factor_type === 'totp' && f.status === 'verified');

    if (!totpFactor) {
      toastError("No TOTP factor found to disable.");
      return;
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
    if (error) throw error;

    toastSuccess("Two-Factor Authentication Disabled.");
    updateMfaStatusUI();

  } catch (err) {
    console.error("Disable MFA error:", err);
    toastError("Failed to disable MFA: " + err.message);
  }
}

// Global challenge handler
let onMfaChallengeSuccess = null;

function openMfaChallengeModal(options = {}) {
  onMfaChallengeSuccess = options.onSuccess;
  const modal = el("mfa-challenge-modal");
  const input = el("mfa-code-input");

  if (input) input.value = "";
  el("mfa-error-message").classList.add("hidden");

  modal.classList.remove("hidden");
  if (input) input.focus();
}

async function handleMfaChallengeSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const input = el("mfa-code-input");
  const errorEl = el("mfa-error-message");

  const code = input.value.trim();
  if (!code) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Verifying...";
  }

  try {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData.all.find(f => f.factor_type === 'totp' && f.status === 'verified');

    if (!totpFactor) {
      throw new Error("No TOTP factor found.");
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totpFactor.id,
      code: code
    });

    if (error) throw error;

    el("mfa-challenge-modal").classList.add("hidden");
    if (onMfaChallengeSuccess) {
      onMfaChallengeSuccess();
      onMfaChallengeSuccess = null;
    } else {
      // Default behavior: just close (for login, we might handle differently)
      // But usually login challenge is handled in handleAuth, not here.
      // This modal is used for re-verification.
    }

  } catch (err) {
    console.error("Challenge error:", err);
    errorEl.textContent = "Invalid code.";
    errorEl.classList.remove("hidden");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify";
    }
  }
}

init();
setupMfaListeners();


function renderSetDetailPendingRequests(set) {
  const container = el("set-detail-pending-requests");
  if (!container) return;

  const currentUserId = state.profile?.id;
  if (!currentUserId || !set) {
    container.classList.add("hidden");
    return;
  }

  // Check for pending requests for this set
  Promise.all([
    supabase
      .from("set_assignments")
      .select("id, role, set_id, status")
      .eq("set_id", set.id)
      .eq("person_id", currentUserId)
      .eq("status", "pending"),
    supabase
      .from("song_assignments")
      .select(`
        id,
        role,
        status,
        set_song:set_song_id (
          set_id
        )
      `)
      .eq("person_id", currentUserId)
      .eq("status", "pending")
  ]).then(([setRes, songRes]) => {
    const pendingSetAssignments = setRes.data || [];
    const pendingSongAssignments = songRes.data || [];

    const relevantSongAssignments = pendingSongAssignments.filter(a => a.set_song?.set_id === set.id);

    if (pendingSetAssignments.length === 0 && relevantSongAssignments.length === 0) {
      container.classList.add("hidden");
      container.innerHTML = '';
      return;
    }

    // Determine what to show
    let requestPayload = null;
    let titleText = "";
    let descText = "";

    if (pendingSetAssignments.length > 0) {
      const assignment = pendingSetAssignments[0];
      requestPayload = {
        type: 'set',
        assignmentId: assignment.id,
        setId: set.id,
        set: set,
        role: assignment.role
      };
      titleText = "Set Assignment Request";
      descText = `You have been requested to serve on this set`;
    } else {
      // Group song assignments
      requestPayload = {
        type: 'song',
        assignmentIds: relevantSongAssignments.map(a => a.id),
        setId: set.id,
        set: set,
        roles: [...new Set(relevantSongAssignments.map(a => a.role))],
        assignmentCount: relevantSongAssignments.length
      };
      titleText = "Song Assignment Requests";
      descText = `You have ${requestPayload.assignmentCount} song assignment${requestPayload.assignmentCount > 1 ? 's' : ''} pending (${requestPayload.roles.join(', ')})`;
    }

    // Render
    container.classList.remove("hidden");
    container.innerHTML = '';

    const banner = document.createElement('div');
    // Add ripple animation
    banner.classList.add('ripple-item');
    banner.style.animationDelay = '0.05s';

    banner.style.background = 'var(--bg-secondary)';
    banner.style.padding = '1rem';
    banner.style.borderRadius = '1rem';
    banner.style.marginBottom = '1.5rem';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'space-between';
    banner.style.border = '1px solid var(--border-color)';
    banner.style.flexWrap = 'wrap';
    banner.style.gap = '1rem';
    banner.style.boxShadow = '0 4px 12px -2px rgba(0,0,0,0.05)';

    const infoDiv = document.createElement('div');
    infoDiv.style.flex = '1';
    infoDiv.style.minWidth = '200px';

    const titleEl = document.createElement('div');
    titleEl.innerHTML = `<i class="fa-solid fa-bell" style="color: var(--accent-color); margin-right: 0.5rem;"></i><span style="font-weight: 600; color: var(--text-primary); font-size: 1.05rem;">${titleText}</span>`;

    const descEl = document.createElement('div');
    descEl.textContent = descText;
    descEl.style.fontSize = '0.9rem';
    descEl.style.color = 'var(--text-secondary)';
    descEl.style.marginTop = '0.35rem';
    descEl.style.marginLeft = '1.75rem'; // Indent to align with text
    descEl.style.lineHeight = '1.4';

    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(descEl);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '0.5rem';

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "btn primary small";
    acceptBtn.innerHTML = '<i class="fa-solid fa-check"></i> Accept';
    acceptBtn.onclick = () => handleAcceptRequest(requestPayload);

    const declineBtn = document.createElement("button");
    declineBtn.className = "btn ghost small";
    declineBtn.innerHTML = '<i class="fa-solid fa-x"></i> Decline';
    declineBtn.onclick = () => handleDeclineRequest(requestPayload);

    actionsDiv.appendChild(acceptBtn);
    actionsDiv.appendChild(declineBtn);

    banner.appendChild(infoDiv);
    banner.appendChild(actionsDiv);

    container.appendChild(banner);
  }).catch(err => {
    console.error("Error loading pending requests for set detail:", err);
  });
}

// ==========================================
// AI Chat Logic
// ==========================================

function parseChatContent(content) {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    if ("text" in content) {
      const text = typeof content.text === "string" ? content.text : String(content.text ?? "");
      const reply = content.reply && typeof content.reply === "object"
        ? {
          role: typeof content.reply.role === "string" ? content.reply.role : "assistant",
          text: typeof content.reply.text === "string" ? content.reply.text : ""
        }
        : null;
      return { text, reply };
    }
    return { text: JSON.stringify(content), reply: null };
  }
  return { text: typeof content === "string" ? content : String(content ?? ""), reply: null };
}

function buildReplyQuote(text) {
  return text.split(/\r?\n/).map(line => `> ${line}`).join("\n");
}

function serializeChatContentForAi(content) {
  const { text, reply } = parseChatContent(content);
  if (reply && reply.text) {
    return `Replying to this message from ${reply.role}:\n${buildReplyQuote(reply.text)}\n\n${text}`;
  }
  return text;
}

function buildAiPayloadMessages(messages) {
  return messages.map(m => ({
    role: m.role,
    content: serializeChatContentForAi(m.content)
  }));
}

function clampChatText(text, maxLen = 240) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

let chatSelectionListenersAttached = false;

function ensureChatSelectionAction() {
  let action = document.getElementById("chat-selection-action");
  if (action) return action;

  action = document.createElement("div");
  action.id = "chat-selection-action";
  action.className = "chat-selection-action hidden";
  action.innerHTML = `
    <button class="btn secondary small chat-selection-btn">
      <i class="fa-solid fa-reply"></i> Reply
    </button>
  `;
  document.body.appendChild(action);

  const button = action.querySelector("button");
  button.addEventListener("click", () => {
    if (!state.aiChatSelection) return;
    state.aiChatReplyContext = {
      role: state.aiChatSelection.role,
      text: state.aiChatSelection.text
    };
    state.aiChatSelection = null;
    renderChatReplyPreview();
    hideChatSelectionAction();

    const input = document.getElementById("chat-input-text");
    if (input) input.focus();
  });

  return action;
}

function hideChatSelectionAction() {
  const action = document.getElementById("chat-selection-action");
  if (action) action.classList.add("hidden");
}

function updateChatSelection(container) {
  const action = ensureChatSelectionAction();
  if (!state.isAiChatOpen || !container) {
    hideChatSelectionAction();
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    state.aiChatSelection = null;
    hideChatSelectionAction();
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    state.aiChatSelection = null;
    hideChatSelectionAction();
    return;
  }

  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node.nodeType === 1 ? node : node.parentElement;
  const messageEl = element ? element.closest(".chat-message") : null;

  if (!messageEl || !container.contains(messageEl)) {
    state.aiChatSelection = null;
    hideChatSelectionAction();
    return;
  }

  const msgIndex = Number(messageEl.dataset.msgIndex);
  if (!Number.isFinite(msgIndex)) {
    state.aiChatSelection = null;
    hideChatSelectionAction();
    return;
  }

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    state.aiChatSelection = null;
    hideChatSelectionAction();
    return;
  }

  state.aiChatSelection = {
    messageIndex: msgIndex,
    role: messageEl.dataset.role || "assistant",
    text
  };

  action.classList.remove("hidden");

  const padding = 8;
  const actionWidth = action.offsetWidth || 72;
  const actionHeight = action.offsetHeight || 28;

  let top = rect.top + window.scrollY - actionHeight - 6;
  if (top < window.scrollY + padding) {
    top = rect.bottom + window.scrollY + 6;
  }

  let left = rect.right + window.scrollX + 6;
  const maxLeft = window.scrollX + window.innerWidth - actionWidth - padding;
  left = Math.min(Math.max(window.scrollX + padding, left), maxLeft);

  action.style.top = `${top}px`;
  action.style.left = `${left}px`;
}

function renderChatReplyPreview() {
  const preview = document.getElementById("chat-reply-preview");
  const label = document.getElementById("chat-reply-label");
  const textEl = document.getElementById("chat-reply-text");
  if (!preview || !label || !textEl) return;

  const reply = state.aiChatReplyContext;
  if (!reply || !reply.text) {
    preview.classList.add("hidden");
    label.textContent = "";
    textEl.textContent = "";
    return;
  }

  label.textContent = `Replying to ${reply.role === "assistant" ? "assistant" : reply.role}`;
  textEl.textContent = clampChatText(reply.text, 200);
  preview.classList.remove("hidden");
}

function clearChatReplyContext() {
  state.aiChatReplyContext = null;
  renderChatReplyPreview();
}

// captureChatSelection removed in favor of updateChatSelection

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isActionObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof value.action === "string";
}

function normalizeActionBlocks(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(isActionObject);
  if (isActionObject(payload)) return [payload];
  if (payload.actions && Array.isArray(payload.actions)) {
    return payload.actions.filter(isActionObject);
  }
  return [];
}

function findJsonBlock(text) {
  if (!text) return null;
  let inString = false;
  let escape = false;
  const stack = [];
  let blockStart = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      if (stack.length === 0) blockStart = i;
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      if (!stack.length) continue;
      const last = stack.pop();
      if ((ch === "}" && last !== "{") || (ch === "]" && last !== "[")) {
        stack.length = 0;
        blockStart = -1;
        continue;
      }
      if (stack.length === 0 && blockStart !== -1) {
        return {
          jsonText: text.slice(blockStart, i + 1),
          start: blockStart,
          end: i + 1
        };
      }
    }
  }

  return null;
}

function extractActionBlocks(contentText) {
  let rawContent = typeof contentText === "string" ? contentText : String(contentText ?? "");
  const actionBlocks = [];
  const rawJsonBlocks = [];

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  let removedFence = false;

  while ((match = fenceRegex.exec(rawContent)) !== null) {
    const jsonText = match[1];
    const parsed = safeJsonParse(jsonText);
    const normalized = normalizeActionBlocks(parsed);
    if (normalized.length > 0) {
      actionBlocks.push(...normalized);
      rawJsonBlocks.push(jsonText);
      const before = rawContent.slice(0, match.index);
      const after = rawContent.slice(fenceRegex.lastIndex);
      rawContent = `${before}${after}`;
      fenceRegex.lastIndex = 0;
      removedFence = true;
    }
  }

  if (!actionBlocks.length) {
    const jsonBlock = findJsonBlock(rawContent);
    if (jsonBlock) {
      const parsed = safeJsonParse(jsonBlock.jsonText);
      const normalized = normalizeActionBlocks(parsed);
      if (normalized.length > 0) {
        actionBlocks.push(...normalized);
        rawJsonBlocks.push(jsonBlock.jsonText);
        rawContent = `${rawContent.slice(0, jsonBlock.start)}${rawContent.slice(jsonBlock.end)}`;
      }
    }
  } else if (removedFence) {
    rawContent = rawContent.trim();
  }

  return {
    rawContent: rawContent.trim(),
    actionBlocks,
    rawActionJson: rawJsonBlocks.length ? rawJsonBlocks.join("\n\n") : null
  };
}

function getSortedSetSongs() {
  const setSongs = state.selectedSet?.set_songs || [];
  return [...setSongs].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
}

function getSetSongById(setSongId) {
  if (!setSongId || !state.selectedSet?.set_songs) return null;
  return state.selectedSet.set_songs.find(ss => String(ss.id) === String(setSongId)) || null;
}

function normalizeMatchString(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function resolveSetSongByIndex(indexValue, setSongs = getSortedSetSongs()) {
  if (indexValue === undefined || indexValue === null || indexValue === "") return null;
  const indexNum = Number(indexValue);
  if (!Number.isFinite(indexNum)) return null;
  const indexInt = Math.round(indexNum);
  if (Math.abs(indexNum - indexInt) > 0.00001) return null;
  if (indexInt >= 1 && indexInt <= setSongs.length) return setSongs[indexInt - 1];
  if (indexInt >= 0 && indexInt < setSongs.length) return setSongs[indexInt];
  return null;
}

function resolveSetSongFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const directId = payload.set_song_id || payload.setSongId || payload.id;
  if (directId) {
    const directMatch = getSetSongById(directId);
    if (directMatch) return directMatch;
  }

  const setSongs = getSortedSetSongs();
  const indexCandidates = [
    directId,
    payload.index,
    payload.song_index,
    payload.set_song_index,
    payload.position,
    payload.song_position,
    payload.order
  ];

  for (const candidate of indexCandidates) {
    const byIndex = resolveSetSongByIndex(candidate, setSongs);
    if (byIndex) return byIndex;
  }

  const titleCandidates = [
    payload.song_title,
    payload.title,
    payload.name,
    payload.song
  ].filter(value => typeof value === "string" && value.trim());

  if (titleCandidates.length > 0) {
    const normalizedTargets = titleCandidates.map(normalizeMatchString).filter(Boolean);
    const matches = setSongs.filter(setSong => {
      const candidateTitles = [
        setSong.song?.title,
        setSong.title,
        getSetSongDisplayName(setSong)
      ].map(normalizeMatchString).filter(Boolean);
      return candidateTitles.some(title => normalizedTargets.includes(title));
    });
    if (matches.length === 1) return matches[0];
  }

  return null;
}

function getPayloadTargetLabel(payload) {
  if (!payload || typeof payload !== "object") return "";
  const indexValue = payload.index ?? payload.song_index ?? payload.set_song_index ?? payload.position ?? payload.song_position ?? payload.order;
  if (indexValue !== undefined && indexValue !== null && String(indexValue).trim() !== "") {
    return `Item #${indexValue}`;
  }
  const titleValue = payload.song_title ?? payload.title ?? payload.name ?? payload.song;
  if (typeof titleValue === "string" && titleValue.trim()) return titleValue.trim();
  return "";
}

function getSetSongDisplayName(setSong) {
  if (!setSong) return "Unknown item";
  const tagInfo = isTag(setSong) ? parseTagDescription(setSong) : null;
  if (tagInfo) {
    const partName = resolveTagPartName(tagInfo.tagType, tagInfo.customValue) || setSong.title || "Tag";
    return `${setSong.song?.title ?? "Untitled"} — ${partName}`;
  }
  if (setSong.song_id) {
    return setSong.song?.title || "Untitled Song";
  }
  return setSong.title || "Untitled Section";
}

function shortId(value) {
  if (!value) return "";
  const str = String(value);
  return str.length > 8 ? `${str.slice(0, 8)}...` : str;
}

function extractReorderIds(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.new_order,
    payload.new_sequence,
    payload.set_song_ids,
    payload.sequence,
    payload.order,
    payload.items
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    if (candidate.every(v => typeof v === "string" || typeof v === "number")) {
      return candidate.map(value => String(value));
    }
    if (candidate.every(v => v && typeof v === "object")) {
      if (candidate.some(v => v.set_song_id)) {
        return candidate
          .slice()
          .sort((a, b) => (a.sequence_order ?? a.order ?? 0) - (b.sequence_order ?? b.order ?? 0))
          .map(v => v.set_song_id || v.id)
          .filter(Boolean)
          .map(value => String(value));
      }
      if (candidate.some(v => v.id)) {
        return candidate
          .slice()
          .sort((a, b) => (a.sequence_order ?? a.order ?? 0) - (b.sequence_order ?? b.order ?? 0))
          .map(v => v.id)
          .filter(Boolean)
          .map(value => String(value));
      }
    }
  }

  return null;
}

function resolveReorderIds(payload) {
  const orderIds = extractReorderIds(payload);
  if (!orderIds || orderIds.length === 0) {
    return { orderIds: null, uniqueIds: null, warnings: ["Missing a reorder list in the payload."] };
  }

  const setSongs = getSortedSetSongs();
  const knownIds = new Set(setSongs.map(song => String(song.id)));
  const normalized = orderIds.map(value => String(value).trim()).filter(Boolean);

  let resolved = normalized.slice();
  let usedIndexMapping = false;

  const unknownIds = resolved.filter(id => !knownIds.has(id));
  if (unknownIds.length > 0) {
    const numeric = resolved.map(value => Number(value));
    if (numeric.every(value => Number.isFinite(value))) {
      const min = Math.min(...numeric);
      const max = Math.max(...numeric);
      if (min >= 1 && max <= setSongs.length) {
        resolved = numeric.map(value => String(setSongs[value - 1]?.id)).filter(Boolean);
        usedIndexMapping = true;
      } else if (min >= 0 && max < setSongs.length) {
        resolved = numeric.map(value => String(setSongs[value]?.id)).filter(Boolean);
        usedIndexMapping = true;
      }
    }
  }

  const uniqueIds = [];
  const seen = new Set();
  resolved.forEach(id => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    uniqueIds.push(id);
  });

  const warnings = [];
  const missingIds = setSongs.map(song => String(song.id)).filter(id => !seen.has(id));
  const stillUnknownIds = uniqueIds.filter(id => !knownIds.has(id));
  if (missingIds.length > 0) warnings.push(`Missing ${missingIds.length} item${missingIds.length === 1 ? "" : "s"} from the reorder list.`);
  if (stillUnknownIds.length > 0) warnings.push(`Contains ${stillUnknownIds.length} unknown item${stillUnknownIds.length === 1 ? "" : "s"}.`);
  if (resolved.length !== uniqueIds.length) warnings.push("Contains duplicate items; duplicates will be ignored.");
  if (usedIndexMapping) warnings.push("Interpreted reorder list as setlist positions (index numbers).");

  return { orderIds: resolved, uniqueIds, warnings, usedIndexMapping };
}

function buildActionSummary(actions) {
  if (!actions || actions.length === 0) return "";
  const parts = actions.map(action => {
    const type = action?.action;
    const payload = action?.payload || {};
    const setSong = resolveSetSongFromPayload(payload);
    const target = setSong ? getSetSongDisplayName(setSong) : (getPayloadTargetLabel(payload) || "item");
    if (type === "change_key") {
      return `Change key of ${target} to ${payload.new_key || payload.key || "?"}`;
    }
    if (type === "add_note") {
      return `Update notes for ${target}`;
    }
    if (type === "remove_song") {
      return `Remove ${target}`;
    }
    if (type === "reorder_songs") {
      return "Reorder setlist";
    }
    return `Apply ${type || "change"}`;
  });
  return `Proposed changes: ${parts.join("; ")}`;
}

function titleCaseAction(value) {
  if (!value) return "Proposed Change";
  return value
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderDiffValue(container, value) {
  if (Array.isArray(value)) {
    const list = document.createElement("ol");
    list.className = "chat-diff-list";
    value.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    container.appendChild(list);
    return;
  }
  if (value === null || value === undefined || value === "") {
    const empty = document.createElement("span");
    empty.className = "chat-diff-empty";
    empty.textContent = "(empty)";
    container.appendChild(empty);
    return;
  }
  if (typeof value === "object") {
    container.textContent = JSON.stringify(value, null, 2);
    container.classList.add("mono");
    return;
  }
  container.textContent = String(value);
}

function buildDiffElement(label, beforeValue, afterValue) {
  const wrapper = document.createElement("div");
  wrapper.className = "chat-diff";

  if (label) {
    const title = document.createElement("div");
    title.className = "chat-diff-title";
    title.textContent = label;
    wrapper.appendChild(title);
  }

  const grid = document.createElement("div");
  grid.className = "chat-diff-grid";

  const beforeCol = document.createElement("div");
  beforeCol.className = "chat-diff-col";
  const beforeLabel = document.createElement("div");
  beforeLabel.className = "chat-diff-label";
  beforeLabel.textContent = "Before";
  const beforeValueEl = document.createElement("div");
  beforeValueEl.className = "chat-diff-value from";
  renderDiffValue(beforeValueEl, beforeValue);
  beforeCol.appendChild(beforeLabel);
  beforeCol.appendChild(beforeValueEl);

  const arrow = document.createElement("div");
  arrow.className = "chat-diff-arrow";
  arrow.textContent = "->";

  const afterCol = document.createElement("div");
  afterCol.className = "chat-diff-col";
  const afterLabel = document.createElement("div");
  afterLabel.className = "chat-diff-label";
  afterLabel.textContent = "After";
  const afterValueEl = document.createElement("div");
  afterValueEl.className = "chat-diff-value to";
  renderDiffValue(afterValueEl, afterValue);
  afterCol.appendChild(afterLabel);
  afterCol.appendChild(afterValueEl);

  grid.appendChild(beforeCol);
  grid.appendChild(arrow);
  grid.appendChild(afterCol);
  wrapper.appendChild(grid);

  return wrapper;
}

function buildSingleValueElement(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "chat-diff";

  if (label) {
    const title = document.createElement("div");
    title.className = "chat-diff-title";
    title.textContent = label;
    wrapper.appendChild(title);
  }

  const pre = document.createElement("pre");
  pre.className = "chat-diff-raw";
  pre.textContent = value;
  wrapper.appendChild(pre);

  return wrapper;
}

function buildReorderPreview(payload) {
  const setSongs = getSortedSetSongs();
  const beforeLabels = setSongs.map(getSetSongDisplayName);
  const { orderIds, uniqueIds, warnings } = resolveReorderIds(payload);
  if (!orderIds || !uniqueIds) {
    return {
      beforeLabels,
      afterLabels: null,
      warnings: warnings || ["Missing a reorder list in the payload."]
    };
  }

  const knownMap = new Map(setSongs.map(song => [String(song.id), song]));
  const afterLabels = uniqueIds.map(id => {
    const setSong = knownMap.get(id);
    return setSong ? getSetSongDisplayName(setSong) : `Unknown item (${shortId(id)})`;
  });

  return { beforeLabels, afterLabels, warnings };
}

function renderActionItem(action) {
  const type = action?.action;
  const payload = action?.payload || {};
  const setSong = resolveSetSongFromPayload(payload);
  const targetLabel = setSong ? getSetSongDisplayName(setSong) : getPayloadTargetLabel(payload);

  const item = document.createElement("div");
  item.className = "chat-change-item";
  item.dataset.state = "pending";

  const header = document.createElement("div");
  header.className = "chat-change-item-header";

  const title = document.createElement("div");
  title.className = "chat-change-item-title";
  title.textContent = titleCaseAction(type);
  header.appendChild(title);

  const controls = document.createElement("div");
  controls.className = "chat-change-item-controls";

  const declineBtn = document.createElement("button");
  declineBtn.className = "chat-change-item-action-btn decline";
  declineBtn.setAttribute("type", "button");
  declineBtn.setAttribute("aria-label", "Decline change");
  declineBtn.setAttribute("title", "Decline");
  declineBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  const approveBtn = document.createElement("button");
  approveBtn.className = "chat-change-item-action-btn approve";
  approveBtn.setAttribute("type", "button");
  approveBtn.setAttribute("aria-label", "Apply change");
  approveBtn.setAttribute("title", "Apply");
  approveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';

  controls.appendChild(declineBtn);
  controls.appendChild(approveBtn);
  header.appendChild(controls);
  item.appendChild(header);

  if (targetLabel) {
    const subtitle = document.createElement("div");
    subtitle.className = "chat-change-item-subtitle";
    subtitle.textContent = targetLabel;
    item.appendChild(subtitle);
  }

  if (type === "change_key") {
    const oldKey = setSong?.key || "";
    const newKey = payload.new_key || payload.key || "";
    item.appendChild(buildDiffElement("Key", oldKey, newKey));
  } else if (type === "add_note") {
    const existingNotes = setSong?.notes || "";
    const note = payload.note || payload.text || "";
    const shouldAppend = payload.mode === "append" || payload.append === true || payload.mode === undefined;
    const updatedNotes = shouldAppend && existingNotes
      ? `${existingNotes}\n${note}`.trim()
      : note;
    item.appendChild(buildDiffElement("Notes", existingNotes, updatedNotes));
  } else if (type === "remove_song") {
    item.appendChild(buildDiffElement("Setlist", "Present", "Removed"));
  } else if (type === "reorder_songs") {
    const preview = buildReorderPreview(payload);
    item.appendChild(buildDiffElement("Order", preview.beforeLabels, preview.afterLabels || "(missing)"));
    if (preview.warnings && preview.warnings.length) {
      const warning = document.createElement("div");
      warning.className = "chat-change-warning";
      warning.textContent = preview.warnings.join(" ");
      item.appendChild(warning);
    }
  } else {
    item.appendChild(buildSingleValueElement("Payload", JSON.stringify(action, null, 2)));
  }

  if (!setSong && (type === "change_key" || type === "add_note" || type === "remove_song")) {
    const warning = document.createElement("div");
    warning.className = "chat-change-warning";
    warning.textContent = "Could not match this change to a setlist item. Ask the assistant to include a set_song_id.";
    item.appendChild(warning);
  }

  const disableItem = (stateLabel, stateValue) => {
    item.classList.add("is-disabled");
    item.dataset.state = stateValue || "done";
    declineBtn.disabled = true;
    approveBtn.disabled = true;
    if (stateLabel) {
      const badge = document.createElement("span");
      badge.className = "chat-change-item-state";
      badge.textContent = stateLabel;
      controls.appendChild(badge);
    }
    if (typeof item.__notifyParent === "function") {
      item.__notifyParent();
    }
  };

  const declineItem = () => {
    if (item.dataset.state !== "pending") return;
    disableItem("Declined", "declined");
  };

  const applyItem = async () => {
    if (item.dataset.state !== "pending") return;
    declineBtn.disabled = true;
    approveBtn.disabled = true;
    const success = await handleAiAction(action);
    if (success) {
      disableItem("Applied", "applied");
    } else {
      declineBtn.disabled = false;
      approveBtn.disabled = false;
    }
  };

  declineBtn.addEventListener("click", declineItem);
  approveBtn.addEventListener("click", applyItem);

  item.__declineAction = declineItem;
  item.__applyAction = applyItem;

  return item;
}

function renderActionCard(actions) {
  const card = document.createElement("div");
  card.className = "chat-action-card chat-change-card";

  const header = document.createElement("div");
  header.className = "chat-change-header";

  const title = document.createElement("div");
  title.className = "chat-change-title";
  title.innerHTML = `<i class="fa-solid fa-bolt"></i> Proposed Changes`;

  const meta = document.createElement("div");
  meta.className = "chat-change-meta";
  meta.textContent = `${actions.length} change${actions.length === 1 ? "" : "s"}`;

  header.appendChild(title);
  header.appendChild(meta);
  card.appendChild(header);

  const list = document.createElement("div");
  list.className = "chat-change-list";
  const footer = document.createElement("div");
  footer.className = "chat-action-footer";

  const declineAllBtn = document.createElement("button");
  declineAllBtn.className = "action-btn decline";
  declineAllBtn.textContent = "Decline All";

  const applyAllBtn = document.createElement("button");
  applyAllBtn.className = "action-btn approve";
  applyAllBtn.textContent = "Apply All";

  const updateFooterState = () => {
    const pendingItems = list.querySelectorAll('.chat-change-item[data-state="pending"]');
    const hasPending = pendingItems.length > 0;
    declineAllBtn.disabled = !hasPending;
    applyAllBtn.disabled = !hasPending;
  };

  actions.forEach(action => {
    const item = renderActionItem(action);
    item.__notifyParent = updateFooterState;
    list.appendChild(item);
  });
  card.appendChild(list);

  declineAllBtn.addEventListener("click", () => {
    const items = list.querySelectorAll('.chat-change-item[data-state="pending"]');
    items.forEach(item => item.__declineAction?.());
    updateFooterState();
  });

  applyAllBtn.addEventListener("click", async () => {
    declineAllBtn.disabled = true;
    applyAllBtn.disabled = true;
    const items = Array.from(list.querySelectorAll('.chat-change-item[data-state="pending"]'));
    for (const item of items) {
      if (item.__applyAction) {
        await item.__applyAction();
      }
    }
    updateFooterState();
  });

  footer.appendChild(declineAllBtn);
  footer.appendChild(applyAllBtn);
  card.appendChild(footer);

  updateFooterState();
  return card;
}

function getLastAssistantIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

function updateChatControls() {
  const sendBtn = document.getElementById("send-chat-btn");
  const input = document.getElementById("chat-input-text");
  if (sendBtn) sendBtn.disabled = state.isAiTyping;
  if (input) input.disabled = state.isAiTyping;
}

async function toggleAiChat(set) {
  state.isAiChatOpen = !state.isAiChatOpen;
  const main = document.querySelector('main');

  if (state.isAiChatOpen) {
    // Open
    await loadAiChatHistory(set.id);
    renderSetChatPanel(set);
    setTimeout(() => {
      const sidebar = el("ai-chat-sidebar");
      if (sidebar) {
        sidebar.classList.remove("hidden");
        // Initial width or current width
        const width = sidebar.style.width || "400px";

        // Trigger layout calculation
        if (typeof window.resizeChatLayout === 'function') {
          window.resizeChatLayout();
        }

      }
    }, 10);
  } else {
    // Close
    const sidebar = el("ai-chat-sidebar");
    if (sidebar) sidebar.classList.add("hidden");
    hideChatSelectionAction();
    main.style.transition = "margin-right 0.3s ease, margin-left 0.3s ease";
    main.style.marginRight = "";
    main.style.marginLeft = "";
  }
}

async function loadAiChatHistory(setId) {
  state.aiChatMessages = [];
  state.aiChatReplyContext = null;
  state.aiChatSelection = null;
  renderChatReplyPreview();
  hideChatSelectionAction();

  // Fetch from DB (RLS ensures we only get our own)
  const { data, error } = await supabase
    .from("set_chat_messages")
    .select("*")
    .eq("set_id", setId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading chat:", error);
    toastError("Failed to load chat history.");
    return;
  }

  state.aiChatMessages = data.map(msg => {
    let content = msg.content;
    if (content && typeof content === "object" && !Array.isArray(content) && !("text" in content)) {
      content = JSON.stringify(content);
    }
    return {
      id: msg.id,
      role: msg.role,
      content
    };
  });
}

// Helper for chat layout
window.resizeChatLayout = () => {
  const sidebar = el("ai-chat-sidebar");
  if (!sidebar || sidebar.classList.contains("hidden")) return;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.style.top = "0px";
    sidebar.style.height = "100%";
    sidebar.style.width = "100%";
    const main = document.querySelector('main');
    if (main) {
      main.style.marginLeft = "";
      main.style.marginRight = "";
    }
    return;
  }

  // Calculate header sync
  const header = document.querySelector('.app-header');
  const headerHeight = header ? header.offsetHeight : 0;
  const top = Math.max(0, headerHeight - window.scrollY);
  sidebar.style.top = `${top}px`;
  sidebar.style.height = "";

  // Calculate layout
  if (window.innerWidth > 768) {
    const sidebarW = parseInt(sidebar.style.width || "400");
    const availW = window.innerWidth - sidebarW;
    const maxContentW = 1200; // Match CSS max-width

    // Center in available space
    const targetLeft = Math.max(0, (availW - maxContentW) / 2);

    const main = document.querySelector('main');
    main.style.marginLeft = `${targetLeft}px`;
    main.style.marginRight = `${sidebarW}px`;
  }
};

window.addEventListener('scroll', window.resizeChatLayout);
window.addEventListener('resize', window.resizeChatLayout);


function renderSetChatPanel(set) {
  let sidebar = el("ai-chat-sidebar");
  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.id = "ai-chat-sidebar";
    sidebar.className = "chat-sidebar hidden";
    // Set default width explicitly for logic
    sidebar.style.width = "400px";
    document.body.appendChild(sidebar);

    // Initial positioning check (if opened first time)
    const header = document.querySelector('.app-header');
    if (header) {
      if (window.innerWidth <= 768) {
        sidebar.style.top = "0px";
        sidebar.style.height = "100%";
      } else {
        sidebar.style.top = `${header.offsetHeight}px`;
      }
    }

    // Add resize handle
    const handle = document.createElement("div");
    handle.className = "chat-resize-handle";
    sidebar.appendChild(handle);

    // Drag resizing logic
    handle.addEventListener('mousedown', (e) => {
      sidebar.dataset.resizing = "true";
      document.body.style.cursor = 'col-resize';
      document.querySelector('main').style.transition = 'none';
      sidebar.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (sidebar.dataset.resizing !== "true") return;

      // Calculate new width relative to right edge
      const newWidth = window.innerWidth - e.clientX;

      // Constraints (min 300, max 800)
      if (newWidth > 300 && newWidth < 800) {
        sidebar.style.width = `${newWidth}px`;
        if (typeof window.resizeChatLayout === 'function') window.resizeChatLayout();
      }
    });

    document.addEventListener('mouseup', () => {
      if (sidebar.dataset.resizing === "true") {
        sidebar.dataset.resizing = "false";
        document.body.style.cursor = '';

        // Re-enable transition
        const main = document.querySelector('main');
        main.style.transition = 'margin-right 0.3s ease, margin-left 0.3s ease';
        sidebar.style.transition = 'transform 0.3s ease';
      }
    });
  }

  // Render content
  sidebar.innerHTML = `
    <div class="chat-resize-handle"></div>
    <div class="chat-header">
      <h3><i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-color)"></i> Set Assistant</h3>
      <button class="btn icon-only" id="close-chat-btn"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="chat-messages" id="chat-messages-list"></div>
    <div class="chat-input-area">
      <div class="chat-reply-preview hidden" id="chat-reply-preview">
        <div class="chat-reply-info">
          <div class="chat-reply-label" id="chat-reply-label"></div>
          <div class="chat-reply-text" id="chat-reply-text"></div>
        </div>
        <button class="btn ghost small icon-only" id="clear-reply-btn"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="chat-input-row">
        <textarea class="chat-input" id="chat-input-text" placeholder="Ask to reorder songs, suggest keys..."></textarea>
        <button class="btn primary icon-only" id="send-chat-btn"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>
  `;

  // Re-attach handle event listener logic
  const handle = sidebar.querySelector(".chat-resize-handle");
  handle.addEventListener('mousedown', (e) => {
    sidebar.dataset.resizing = "true";
    document.body.style.cursor = 'col-resize';
    document.querySelector('main').style.transition = 'none';
    sidebar.style.transition = 'none';
    e.preventDefault();
  });

  sidebar.querySelector("#close-chat-btn").addEventListener("click", () => toggleAiChat(set));

  const sendBtn = sidebar.querySelector("#send-chat-btn");
  const input = sidebar.querySelector("#chat-input-text");

  const send = () => {
    if (state.isAiTyping) return;
    const text = input.value.trim();
    if (!text) return;
    sendMessageToAi(set, text);
    input.value = "";
  };

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  const clearReplyBtn = sidebar.querySelector("#clear-reply-btn");
  if (clearReplyBtn) {
    clearReplyBtn.addEventListener("click", () => clearChatReplyContext());
  }

  const messagesList = sidebar.querySelector("#chat-messages-list");
  messagesList.addEventListener("mouseup", () => updateChatSelection(messagesList));
  messagesList.addEventListener("keyup", () => updateChatSelection(messagesList));

  ensureChatSelectionAction();
  if (!chatSelectionListenersAttached) {
    chatSelectionListenersAttached = true;

    document.addEventListener("selectionchange", () => {
      if (!state.isAiChatOpen) return;
      const list = document.getElementById("chat-messages-list");
      if (!list) return;
      updateChatSelection(list);
    });

    document.addEventListener("mousedown", (event) => {
      const action = document.getElementById("chat-selection-action");
      if (action && action.contains(event.target)) return;
      hideChatSelectionAction();
    });

    window.addEventListener("scroll", () => {
      hideChatSelectionAction();
    }, { passive: true });
  }

  renderChatReplyPreview();
  updateChatControls();
  renderChatMessages(messagesList);
}


function renderChatMessages(container) {
  container.innerHTML = "";

  if (state.aiChatMessages.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
        <i class="fa-solid fa-robot" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p>I can help you manage this set.<br>Try asking: "Sort these songs by BPM" or "Suggest a key for the second song".</p>
      </div>
    `;
    return;
  }

  const lastAssistantIndex = getLastAssistantIndex(state.aiChatMessages);

  state.aiChatMessages.forEach((msg, index) => {
    const msgEl = document.createElement("div");
    msgEl.className = `chat-message ${msg.role}`;
    msgEl.dataset.msgIndex = index;
    msgEl.dataset.role = msg.role;

    const { text, reply } = parseChatContent(msg.content);
    const { rawContent, actionBlocks } = extractActionBlocks(text);
    const actionSummary = buildActionSummary(actionBlocks);
    const displayContent = rawContent || actionSummary;

    if (reply && reply.text) {
      const replyEl = document.createElement("div");
      replyEl.className = "chat-reply-context";

      const replyLabel = document.createElement("div");
      replyLabel.className = "chat-reply-label";
      replyLabel.textContent = `Replying to ${reply.role === "assistant" ? "assistant" : reply.role}`;

      const replyText = document.createElement("div");
      replyText.className = "chat-reply-text";
      replyText.textContent = clampChatText(reply.text, 220);

      replyEl.appendChild(replyLabel);
      replyEl.appendChild(replyText);
      msgEl.appendChild(replyEl);
    }

    if (displayContent) {
      let contentHtml;
      // Check if marked and DOMPurify are available
      if (typeof marked !== 'undefined') {
        try {
          contentHtml = marked.parse(displayContent);
          if (typeof DOMPurify !== 'undefined') {
            contentHtml = DOMPurify.sanitize(contentHtml);
          }
        } catch (err) {
          console.error("Markdown error:", err);
          contentHtml = escapeHtml(displayContent).replace(/\n/g, "<br>");
        }
      } else {
        // Fallback
        contentHtml = escapeHtml(displayContent).replace(/\n/g, "<br>");
      }

      const bubble = document.createElement("div");
      bubble.className = "message-bubble markdown-body";
      bubble.innerHTML = contentHtml;
      msgEl.appendChild(bubble);
    }

    if (actionBlocks && actionBlocks.length) {
      const card = renderActionCard(actionBlocks);
      msgEl.appendChild(card);
    }

    if (msg.role === "user" || msg.role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "chat-message-actions";

      const replyBtn = document.createElement("button");
      replyBtn.className = "btn ghost small chat-action-btn";
      replyBtn.innerHTML = '<i class="fa-solid fa-reply"></i> Reply';
      replyBtn.addEventListener("click", () => {
        const selection = state.aiChatSelection;
        const selectedText = selection && selection.messageIndex === index ? selection.text : "";
        const replyText = (selectedText || displayContent || "").trim();
        if (!replyText) return;

        state.aiChatReplyContext = { role: msg.role, text: replyText };
        state.aiChatSelection = null;
        renderChatReplyPreview();

        const input = document.getElementById("chat-input-text");
        if (input) input.focus();
      });
      actions.appendChild(replyBtn);

      const canRegenerate = msg.role === "assistant" && index === lastAssistantIndex;
      if (canRegenerate) {
        const regenBtn = document.createElement("button");
        regenBtn.className = "btn ghost small chat-action-btn";
        regenBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Regenerate';
        regenBtn.disabled = state.isAiTyping;
        regenBtn.addEventListener("click", () => {
          if (!state.selectedSet) {
            toastError("No set selected.");
            return;
          }
          regenerateAssistantMessage(state.selectedSet, index);
        });
        actions.appendChild(regenBtn);
      }

      msgEl.appendChild(actions);
    }

    container.appendChild(msgEl);
  });

  container.scrollTop = container.scrollHeight;
}


async function streamAiResponse(set, messagesForAi, userId) {
  const container = document.getElementById("chat-messages-list");

  state.isAiTyping = true;
  updateChatControls();

  if (container) {
    const existingTyping = container.querySelector(".typing-indicator");
    if (existingTyping) existingTyping.remove();

    const typing = document.createElement("div");
    typing.className = "chat-message assistant typing-indicator";
    typing.innerHTML = `<div class="message-bubble"><span></span><span></span><span></span></div>`;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) throw new Error("No active session");

    const response = await fetch("https://pvqrxkbyjhgomwqwkedw.supabase.co/functions/v1/ai-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        set_id: set.id,
        messages: messagesForAi
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API Error:", response.status, errorText);
      throw new Error(`AI Request Failed: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiText = "";

    if (container && container.lastChild && container.lastChild.classList.contains("typing-indicator")) {
      container.lastChild.remove();
    }

    const assistantMsg = { role: 'assistant', content: "" };
    state.aiChatMessages.push(assistantMsg);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);

      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.replace("data: ", "").trim();
          if (dataStr === "[DONE]") break;
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices[0]?.delta?.content || "";
            aiText += content;
            assistantMsg.content = aiText;
            if (container) renderChatMessages(container);
          } catch (e) {
            // Ignore partial
          }
        }
      }
    }

    if (userId) {
      const { data, error } = await supabase.from("set_chat_messages").insert({
        set_id: set.id,
        user_id: userId,
        role: 'assistant',
        content: aiText
      }).select("id").single();

      if (!error && data) assistantMsg.id = data.id;
    }

  } catch (err) {
    console.error(err);
    if (container && container.lastChild && container.lastChild.classList.contains("typing-indicator")) {
      container.lastChild.remove();
    }
    toastError("AI is unavailable right now.");
  } finally {
    state.isAiTyping = false;
    updateChatControls();
    if (container) renderChatMessages(container);
  }
}

async function sendMessageToAi(set, text) {
  if (state.isAiTyping) return;

  const reply = state.aiChatReplyContext ? {
    role: state.aiChatReplyContext.role,
    text: state.aiChatReplyContext.text
  } : null;

  const content = reply ? { text, reply } : text;

  const userMsg = { role: 'user', content };
  state.aiChatMessages.push(userMsg);

  const container = document.getElementById("chat-messages-list");
  if (container) renderChatMessages(container);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase.from("set_chat_messages").insert({
    set_id: set.id,
    user_id: user.id,
    role: 'user',
    content
  }).select("id").single();

  if (!error && data) userMsg.id = data.id;

  state.aiChatReplyContext = null;
  state.aiChatSelection = null;
  renderChatReplyPreview();

  const messagesForAi = buildAiPayloadMessages(state.aiChatMessages);
  await streamAiResponse(set, messagesForAi, user.id);
}

async function regenerateAssistantMessage(set, assistantIndex) {
  if (state.isAiTyping) return;

  const history = state.aiChatMessages.slice(0, assistantIndex);
  const hasUserMessage = history.some(m => m.role === "user");
  if (!hasUserMessage) {
    toastError("Nothing to regenerate yet.");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const messagesForAi = buildAiPayloadMessages(history);
  await streamAiResponse(set, messagesForAi, user.id);
}

async function handleAiAction(actionBlock) {
  const action = actionBlock?.action;
  const payload = actionBlock?.payload || {};
  if (!action) return false;

  if (action === 'reorder_songs') {
    const { orderIds, uniqueIds } = resolveReorderIds(payload);
    if (!orderIds || orderIds.length === 0) {
      toastError("Reorder proposal is missing the new order list.");
      return false;
    }
    if (!state.selectedSet) {
      toastError("No set selected.");
      return false;
    }

    const setSongs = getSortedSetSongs();
    const allIds = setSongs.map(song => String(song.id));
    const dedupedIds = uniqueIds || Array.from(new Set(orderIds.map(id => String(id))));
    const unknownIds = dedupedIds.filter(id => !allIds.includes(id));
    const missingIds = allIds.filter(id => !dedupedIds.includes(id));

    if (unknownIds.length > 0) {
      toastError("Reorder proposal contains unknown items.");
      return false;
    }
    if (missingIds.length > 0) {
      toastError("Reorder proposal is missing some items. Please regenerate the suggestion.");
      return false;
    }

    const orderedItems = dedupedIds.map((id, index) => ({ id, sequence_order: index }));
    const success = await updateSongOrder(orderedItems, true);
    if (success) toastSuccess("Setlist reordered");
    return !!success;
  } else if (action === 'change_key') {
    const setSong = resolveSetSongFromPayload(payload);
    const setSongId = setSong?.id;
    const newKey = payload.new_key || payload.key;
    if (!setSongId) {
      toastError("Key change proposal is missing a target. Ask the assistant to include a set_song_id.");
      return false;
    }
    if (!newKey) {
      toastError("Key change proposal is missing the new key.");
      return false;
    }

    const { error } = await supabase
      .from('set_songs')
      .update({ key: newKey })
      .eq('id', setSongId);

    if (error) {
      console.error("AI key change failed:", error);
      toastError("Unable to change key.");
      return false;
    }

    toastSuccess(`Key changed to ${newKey}`);
    const set = state.selectedSet;
    loadSets().then(() => {
      const updated = state.sets.find(s => s.id === set.id);
      if (updated) showSetDetail(updated);
    });
    return true;
  } else if (action === 'add_note') {
    const setSong = resolveSetSongFromPayload(payload);
    const setSongId = setSong?.id;
    const note = payload.note || payload.text || "";
    if (!setSongId) {
      toastError("Note proposal is missing a target. Ask the assistant to include a set_song_id.");
      return false;
    }
    if (!note.trim()) {
      toastError("Note proposal is missing note text.");
      return false;
    }

    const shouldAppend = payload.mode === "append" || payload.append === true || payload.mode === undefined;
    const updatedNotes = shouldAppend && setSong?.notes
      ? `${setSong.notes}\n${note}`.trim()
      : note.trim();

    const { error } = await supabase
      .from('set_songs')
      .update({ notes: updatedNotes || null })
      .eq('id', setSongId);

    if (error) {
      console.error("AI note update failed:", error);
      toastError("Unable to add note.");
      return false;
    }

    toastSuccess("Note added");
    const set = state.selectedSet;
    loadSets().then(() => {
      const updated = state.sets.find(s => s.id === set.id);
      if (updated) showSetDetail(updated);
    });
    return true;
  } else if (action === 'remove_song') {
    const setSong = resolveSetSongFromPayload(payload);
    const setSongId = setSong?.id;
    if (!setSongId) {
      toastError("Remove proposal is missing a target. Ask the assistant to include a set_song_id.");
      return false;
    }

    const { error } = await supabase.from('set_songs').delete().eq('id', setSongId);
    if (error) {
      console.error("AI remove song failed:", error);
      toastError("Unable to remove song.");
      return false;
    }

    toastSuccess("Song removed");
    loadSets().then(() => {
      const updated = state.sets.find(s => s.id === state.selectedSet.id);
      if (updated) showSetDetail(updated);
    });
    return true;
  }
  return false;
}
