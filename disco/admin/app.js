import { ConvexClient } from "https://esm.sh/convex/browser";

const CONVEX_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "https://good-capybara-664.convex.cloud/"
  : "https://giddy-shepherd-959.convex.cloud/";
const convex = new ConvexClient(CONVEX_URL);

let sessionToken = localStorage.getItem("discoAdminToken");
let allArtists = [];

// DOM Elements
const authView = document.getElementById("auth-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

const tabs = document.querySelectorAll(".tab");
const artistsPanel = document.getElementById("artists-panel");
const releasesPanel = document.getElementById("releases-panel");

const artistsList = document.getElementById("artists-list");
const newArtistBtn = document.getElementById("new-artist-btn");
const artistForm = document.getElementById("artist-form");
const cancelArtistBtn = document.getElementById("cancel-artist-btn");
const artistError = document.getElementById("artist-error");

const releasesList = document.getElementById("releases-list");
const newReleaseBtn = document.getElementById("new-release-btn");
const releaseForm = document.getElementById("release-form");
const cancelReleaseBtn = document.getElementById("cancel-release-btn");
const releaseError = document.getElementById("release-error");

async function checkAuth() {
  if (!sessionToken) return false;
  try {
    const valid = await convex.query("auth:checkSession", { token: sessionToken });
    if (!valid) {
      sessionToken = null;
      localStorage.removeItem("discoAdminToken");
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function init() {
  const isAuth = await checkAuth();
  if (isAuth) {
    authView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    loadData();
  } else {
    authView.classList.remove("hidden");
    dashboardView.classList.add("hidden");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("password").value;
  try {
    sessionToken = await convex.mutation("auth:login", { password });
    localStorage.setItem("discoAdminToken", sessionToken);
    loginError.textContent = "";
    init();
  } catch (err) {
    loginError.textContent = err.message || "Login failed";
  }
});

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.target;
    if (target === "artists") {
      artistsPanel.classList.remove("hidden");
      releasesPanel.classList.add("hidden");
    } else {
      artistsPanel.classList.add("hidden");
      releasesPanel.classList.remove("hidden");
    }
  });
});

async function loadData() {
  try {
    allArtists = await convex.query("queries:getAllArtists", {});
    renderArtists(allArtists);
    
    // Load releases (naive: load all by iterating, in reality we'd want a getAllReleases query, but we can just use our existing ones)
    // Actually, we need to fetch all releases. Let's add a query if it doesn't exist, or just loop artists.
    // For now, let's fetch releases per artist to build the list.
    let allReleases = [];
    for (const artist of allArtists) {
      const rels = await convex.query("queries:getReleasesByArtist", { artistId: artist._id });
      allReleases = allReleases.concat(rels.map(r => ({...r, artistName: artist.name})));
    }
    renderReleases(allReleases);

    // Update release form artist dropdown
    const select = document.getElementById("release-artist");
    select.innerHTML = allArtists.map(a => `<option value="${a._id}">${a.name}</option>`).join("");
  } catch(e) {
    console.error(e);
    if(e.message.includes("Unauthorized")) {
      sessionToken = null; localStorage.removeItem("discoAdminToken"); init();
    }
  }
}

function renderArtists(artists) {
  artistsList.innerHTML = artists.map(a => `
    <div class="list-item">
      <div><strong>${a.name}</strong> (${a.slug})</div>
      <button onclick="editArtist('${a._id}')">Edit</button>
    </div>
  `).join("");
}

function renderReleases(releases) {
  releasesList.innerHTML = releases.map(r => `
    <div class="list-item">
      <div><strong>${r.title}</strong> by ${r.artistName} (${r.slug})</div>
      <button onclick="editRelease('${r._id}')">Edit</button>
    </div>
  `).join("");
}

window.editArtist = (id) => {
  const a = allArtists.find(x => x._id === id);
  if (!a) return;
  document.getElementById("artist-id").value = a._id;
  document.getElementById("artist-name").value = a.name;
  document.getElementById("artist-slug").value = a.slug;
  document.getElementById("artist-image").value = a.imageUrl;
  document.getElementById("artist-about").value = a.about || "";
  document.getElementById("artist-about-images").value = a.aboutImageUrls?.join(",") || "";
  document.getElementById("artist-socials").value = JSON.stringify(a.socials || [], null, 2);
  artistForm.classList.remove("hidden");
};

newArtistBtn.addEventListener("click", () => {
  document.getElementById("artist-id").value = "";
  artistForm.reset();
  artistForm.classList.remove("hidden");
});

cancelArtistBtn.addEventListener("click", () => { artistForm.classList.add("hidden"); });

artistForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("artist-id").value;
  const data = {
    token: sessionToken,
    name: document.getElementById("artist-name").value,
    slug: document.getElementById("artist-slug").value,
    imageUrl: document.getElementById("artist-image").value,
    about: document.getElementById("artist-about").value,
    aboutImageUrls: document.getElementById("artist-about-images").value.split(",").map(s => s.trim()).filter(Boolean),
    socials: JSON.parse(document.getElementById("artist-socials").value)
  };
  try {
    if (id) {
      await convex.mutation("mutations:updateArtist", { id, ...data });
    } else {
      await convex.mutation("mutations:createArtist", data);
    }
    artistForm.classList.add("hidden");
    loadData();
  } catch(err) {
    artistError.textContent = err.message;
  }
});

// Release logic (global access for inline onclick)
let currentReleases = [];
const _renderReleases = renderReleases;
renderReleases = (rels) => { currentReleases = rels; _renderReleases(rels); };

window.editRelease = (id) => {
  const r = currentReleases.find(x => x._id === id);
  if (!r) return;
  document.getElementById("release-id").value = r._id;
  document.getElementById("release-artist").value = r.artistId;
  document.getElementById("release-title").value = r.title;
  document.getElementById("release-slug").value = r.slug;
  document.getElementById("release-type").value = r.type;
  document.getElementById("release-year").value = r.year;
  document.getElementById("release-cover").value = r.coverUrl;
  document.getElementById("release-date").value = r.releaseAtUtc || "";
  document.getElementById("release-about").value = r.about || "";
  document.getElementById("release-stickers").value = r.stickerUrls?.join(",") || "";
  document.getElementById("release-about-images").value = r.aboutImageUrls?.join(",") || "";
  document.getElementById("release-links").value = JSON.stringify(r.links || [], null, 2);
  document.getElementById("release-sort").value = r.sortOrder || 0;
  releaseForm.classList.remove("hidden");
};

newReleaseBtn.addEventListener("click", () => {
  document.getElementById("release-id").value = "";
  releaseForm.reset();
  releaseForm.classList.remove("hidden");
});

cancelReleaseBtn.addEventListener("click", () => { releaseForm.classList.add("hidden"); });

releaseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("release-id").value;
  const data = {
    token: sessionToken,
    artistId: document.getElementById("release-artist").value,
    title: document.getElementById("release-title").value,
    slug: document.getElementById("release-slug").value,
    type: document.getElementById("release-type").value,
    year: document.getElementById("release-year").value,
    coverUrl: document.getElementById("release-cover").value,
    releaseAtUtc: document.getElementById("release-date").value,
    about: document.getElementById("release-about").value,
    stickerUrls: document.getElementById("release-stickers").value.split(",").map(s => s.trim()).filter(Boolean),
    aboutImageUrls: document.getElementById("release-about-images").value.split(",").map(s => s.trim()).filter(Boolean),
    links: JSON.parse(document.getElementById("release-links").value),
    sortOrder: parseInt(document.getElementById("release-sort").value, 10) || 0,
  };
  try {
    if (id) {
      await convex.mutation("mutations:updateRelease", { id, ...data });
    } else {
      await convex.mutation("mutations:createRelease", data);
    }
    releaseForm.classList.add("hidden");
    loadData();
  } catch(err) {
    releaseError.textContent = err.message;
  }
});

init();
