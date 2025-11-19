import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const SUPABASE_URL = "https://pvqrxkbyjhgomwqwkedw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cXJ4a2J5amhnb213cXdrZWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1Mjg1NTQsImV4cCI6MjA3ODEwNDU1NH0.FWrCZOExwjhfihh7nSZFR2FkIhcJjVyDo0GdDaGKg1g";

if (SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
  console.warn("Update SUPABASE_URL and SUPABASE_ANON_KEY before deploying.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
  },
});

const state = {
  session: null,
  profile: null,
  sets: [],
  songs: [],
  selectedSet: null,
  currentSetSongs: [],
};

const el = (id) => document.getElementById(id);
const authGate = el("auth-gate");
const dashboard = el("dashboard");
const logoutBtn = el("btn-logout");
const userInfo = el("user-info");
const userName = el("user-name");
const createSetBtn = el("btn-create-set");
const setsList = el("sets-list");
const setModal = el("set-modal");
const songModal = el("song-modal");
const authForm = el("auth-form");
const loginEmailInput = el("login-email");
const loginPasswordInput = el("login-password");
const authMessage = el("auth-message");
const authSubmitBtn = el("auth-submit-btn");
const toggleSignup = el("toggle-signup");
let isSignUpMode = false;

async function init() {
  // Handle email confirmation redirect - clear hash after processing
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  if (hashParams.get('type') === 'recovery' || hashParams.get('access_token')) {
    // Supabase will handle this via detectSessionInUrl, but we'll clean up the URL
    window.history.replaceState(null, '', window.location.pathname);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    state.session = session;
    if (session) {
      await fetchProfile();
      await Promise.all([loadSongs(), loadSets()]);
      showApp();
    } else {
      resetState();
      showAuthGate();
    }
  });

  // Check for existing session
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Session error:', error);
  }
  state.session = session;
  if (state.session) {
    await fetchProfile();
    await Promise.all([loadSongs(), loadSets()]);
    showApp();
  } else {
    showAuthGate();
  }

  bindEvents();
}

function bindEvents() {
  authForm?.addEventListener("submit", handleAuth);
  toggleSignup?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleAuthMode();
  });
  logoutBtn?.addEventListener("click", () => supabase.auth.signOut());
  createSetBtn?.addEventListener("click", () => openSetModal());
  el("close-set-modal")?.addEventListener("click", () => closeSetModal());
  el("cancel-set")?.addEventListener("click", () => closeSetModal());
  el("set-form")?.addEventListener("submit", handleSetSubmit);
  el("btn-add-song")?.addEventListener("click", () => openSongModal());
  el("close-song-modal")?.addEventListener("click", () => closeSongModal());
  el("cancel-song")?.addEventListener("click", () => closeSongModal());
  el("song-form")?.addEventListener("submit", handleAddSongToSet);
  el("btn-add-assignment")?.addEventListener("click", addAssignmentInput);
}

function showAuthGate() {
  authGate.classList.remove("hidden");
  dashboard.classList.add("hidden");
  userInfo.classList.add("hidden");
  createSetBtn.classList.add("hidden");
  setAuthMessage("");
  isSignUpMode = false;
  updateAuthUI();
}

function showApp() {
  authGate.classList.add("hidden");
  dashboard.classList.remove("hidden");
  userInfo.classList.remove("hidden");
  userName.textContent = state.profile?.full_name ?? "Signed In";
  if (state.profile?.can_manage) {
    createSetBtn.classList.remove("hidden");
  } else {
    createSetBtn.classList.add("hidden");
  }
}

function resetState() {
  state.profile = null;
  state.sets = [];
  state.songs = [];
  state.selectedSet = null;
  state.currentSetSongs = [];
  setsList.innerHTML = "";
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  updateAuthUI();
  setAuthMessage("");
  authForm?.reset();
}

function updateAuthUI() {
  const heading = authGate?.querySelector("h2");
  const description = authGate?.querySelector("p:first-of-type");
  const toggleParagraph = toggleSignup?.parentElement;
  
  if (isSignUpMode) {
    if (heading) heading.textContent = "Sign Up";
    if (description) description.textContent = "Create an account with your email and password.";
    if (authSubmitBtn) authSubmitBtn.textContent = "Sign up";
    if (toggleParagraph && toggleSignup) {
      toggleParagraph.firstChild.textContent = "Already have an account? ";
      toggleSignup.textContent = "Sign in";
    }
  } else {
    if (heading) heading.textContent = "Login";
    if (description) description.textContent = "Sign in with your email and password.";
    if (authSubmitBtn) authSubmitBtn.textContent = "Sign in";
    if (toggleParagraph && toggleSignup) {
      toggleParagraph.firstChild.textContent = "Don't have an account? ";
      toggleSignup.textContent = "Sign up";
    }
  }
}

async function handleAuth(event) {
  event.preventDefault();
  const email = loginEmailInput?.value.trim();
  const password = loginPasswordInput?.value;

  if (!email || !password) {
    setAuthMessage("Please enter both email and password.", true);
    return;
  }

  if (password.length < 6) {
    setAuthMessage("Password must be at least 6 characters.", true);
    return;
  }

  toggleAuthButton(true);
  setAuthMessage(isSignUpMode ? "Creating account…" : "Signing in…");

  let error;
  if (isSignUpMode) {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    error = signUpError;
    if (!error && data.user) {
      setAuthMessage("Account created! Please check your email to confirm your account.", false);
      authForm?.reset();
      toggleAuthButton(false);
      return;
    }
  } else {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    error = signInError;
  }

  if (error) {
    console.error('Auth error:', error);
    setAuthMessage(error.message || "Unable to sign in. Please check your credentials.", true);
  } else if (!isSignUpMode) {
    // Sign in successful - onAuthStateChange will handle the rest
    setAuthMessage("");
    authForm?.reset();
  }

  toggleAuthButton(false);
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

async function fetchProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", state.session.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    return;
  }

  if (!data) {
    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: state.session.user.id,
        full_name: state.session.user.user_metadata.full_name || "New User",
      })
      .select()
      .single();
    if (insertError) {
      console.error(insertError);
      return;
    }
    state.profile = newProfile;
  } else {
    state.profile = data;
  }
}

async function loadSongs() {
  const { data, error } = await supabase.from("songs").select("*").order("title");
  if (error) {
    console.error(error);
    return;
  }
  state.songs = data;
}

async function loadSets() {
  const { data, error } = await supabase
    .from("sets")
    .select(
      `
      *,
      set_songs (
        id,
        sequence_order,
        notes,
        song:song_id (
          id, title, bpm, song_key, duration_seconds, description
        ),
        song_assignments (
          id,
          person_name,
          role
        )
      )
    `
    )
    .order("scheduled_date", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  state.sets = data ?? [];
  renderSets();
}

function renderSets() {
  setsList.innerHTML = "";
  if (!state.sets.length) {
    setsList.innerHTML = `<p class="muted">No sets scheduled yet.</p>`;
    return;
  }

  const template = document.getElementById("set-card-template");

  state.sets.forEach((set) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".set-title").textContent = set.title;
    node.querySelector(".set-date").textContent = new Date(
      set.scheduled_date
    ).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    node.querySelector(".set-description").textContent =
      set.description || "No description yet.";

    const editBtn = node.querySelector(".edit-set-btn");
    if (state.profile?.can_manage) {
      editBtn.classList.remove("hidden");
      editBtn.addEventListener("click", () => openSetModal(set));
    }

    const songList = node.querySelector(".set-song-list");
    if (!set.set_songs?.length) {
      songList.innerHTML = `<p class="muted">No songs added.</p>`;
    } else {
      set.set_songs
        .sort((a, b) => a.sequence_order - b.sequence_order)
        .forEach((setSong) => {
          const songNode = document
            .getElementById("song-item-template")
            .content.cloneNode(true);
          songNode.querySelector(".song-title").textContent =
            setSong.song?.title ?? "Untitled";
          songNode.querySelector(".song-meta").textContent = [
            setSong.song?.song_key,
            setSong.song?.bpm ? `${setSong.song.bpm} BPM` : null,
            setSong.song?.duration_seconds
              ? `${Math.round(setSong.song.duration_seconds / 60)} min`
              : null,
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
              pill.querySelector(".assignment-person").textContent =
                assignment.person_name;
              assignmentsWrap.appendChild(pill);
            });
          }

          songList.appendChild(songNode);
        });
    }

    setsList.appendChild(node);
  });
}

function openSetModal(set = null) {
  if (!state.profile?.can_manage) return;
  state.selectedSet = set;
  setModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  el("set-modal-title").textContent = set ? "Edit Set" : "New Set";
  el("set-title").value = set?.title ?? "";
  el("set-date").value = set?.scheduled_date ?? "";
  el("set-description").value = set?.description ?? "";

  const hasSet = Boolean(set);
  el("set-songs-section").classList.toggle("hidden", !hasSet);
  if (hasSet) {
    loadSetSongs(set.id);
  }
}

function closeSetModal() {
  setModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("set-form").reset();
  state.selectedSet = null;
  state.currentSetSongs = [];
  el("set-songs-list").innerHTML = "";
}

async function handleSetSubmit(event) {
  event.preventDefault();
  if (!state.profile?.can_manage) return;

  const payload = {
    title: el("set-title").value,
    scheduled_date: el("set-date").value,
    description: el("set-description").value,
    created_by: state.profile.id,
  };

  let response;
  if (state.selectedSet) {
    response = await supabase
      .from("sets")
      .update(payload)
      .eq("id", state.selectedSet.id)
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

  closeSetModal();
  await loadSets();
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

function renderSetSongsEditor() {
  const container = el("set-songs-list");
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
          <p class="song-meta">${setSong.song?.song_key ?? ""}</p>
        </div>
        <button class="btn small ghost" data-remove="${setSong.id}">Remove</button>
      </div>
      <p class="song-notes">${setSong.notes ?? ""}</p>
    `;

    div.querySelector("[data-remove]")?.addEventListener("click", async () => {
      if (!confirm("Remove this song from the set?")) return;
      const { error } = await supabase
        .from("set_songs")
        .delete()
        .eq("id", setSong.id);
      if (error) {
        console.error(error);
        return;
      }
      await loadSetSongs(state.selectedSet.id);
      await loadSets();
    });

    container.appendChild(div);
  });
}

function openSongModal() {
  if (!state.profile?.can_manage || !state.selectedSet) return;
  songModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  populateSongOptions();
  el("assignments-list").innerHTML = "";
}

function closeSongModal() {
  songModal.classList.add("hidden");
  document.body.style.overflow = "";
  el("song-form").reset();
  el("assignments-list").innerHTML = "";
}

function populateSongOptions() {
  const select = el("song-select");
  select.innerHTML = "";
  state.songs.forEach((song) => {
    const option = document.createElement("option");
    option.value = song.id;
    option.textContent = song.title;
    select.appendChild(option);
  });
}

async function handleAddSongToSet(event) {
  event.preventDefault();
  const songId = el("song-select").value;
  const notes = el("song-notes").value;
  const assignments = collectAssignments();

  const { data: setSong, error } = await supabase
    .from("set_songs")
    .insert({
      set_id: state.selectedSet.id,
      song_id: songId,
      notes,
      sequence_order: state.currentSetSongs.length,
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
          ...assignment,
          set_song_id: setSong.id,
        }))
      );
    if (assignmentError) {
      console.error(assignmentError);
      alert("Assignments partially failed.");
    }
  }

  closeSongModal();
  await loadSetSongs(state.selectedSet.id);
  await loadSets();
}

function addAssignmentInput() {
  const container = el("assignments-list");
  const div = document.createElement("div");
  div.className = "assignment-row";
  div.innerHTML = `
    <label>
      Role
      <input type="text" class="assignment-role-input" placeholder="Lead Vocal" required />
    </label>
    <label>
      Person
      <input type="text" class="assignment-person-input" placeholder="Name" required />
    </label>
    <button type="button" class="btn small ghost remove-assignment">Remove</button>
  `;
  div.querySelector(".remove-assignment").addEventListener("click", () => {
    container.removeChild(div);
  });
  container.appendChild(div);
}

function collectAssignments() {
  const roles = Array.from(document.querySelectorAll(".assignment-role-input"));
  const people = Array.from(
    document.querySelectorAll(".assignment-person-input")
  );
  const assignments = [];

  roles.forEach((roleInput, index) => {
    const role = roleInput.value.trim();
    const person = people[index]?.value.trim();
    if (role && person) {
      assignments.push({ role, person_name: person });
    }
  });
  return assignments;
}

init();

