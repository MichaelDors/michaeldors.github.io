import { ConvexClient } from "https://esm.sh/convex/browser";

const CONVEX_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "https://good-capybara-664.convex.cloud"
  : "https://giddy-shepherd-959.convex.cloud";
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

const platformPresets = [
  { label: "Spotify", className: "spotify" },
  { label: "Apple Music", className: "apple" },
  { label: "YouTube Music", className: "youtube" },
  { label: "Amazon Music", className: "amazon" },
  { label: "Deezer", className: "deezer" },
  { label: "TIDAL", className: "tidal" },
  { label: "Pandora", className: "pandora" },
  { label: "Instagram", className: "instagram" },
  { label: "Custom", className: "custom" },
];

function createLinkRow(container, initialData = { label: "", className: "spotify", url: "" }) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "10px";
  row.style.alignItems = "center";
  row.style.marginBottom = "5px";
  
  const select = document.createElement("select");
  select.style.width = "120px";
  select.innerHTML = platformPresets.map(p => `
    <option value="${p.className}" ${initialData.className === p.className ? "selected" : ""}>${p.label}</option>
  `).join("");
  
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "Label";
  labelInput.style.width = "100px";
  labelInput.value = initialData.label || "";
  if (initialData.className !== "custom") {
    labelInput.style.display = "none";
  }

  select.addEventListener("change", () => {
    if (select.value === "custom") {
      labelInput.style.display = "block";
      labelInput.value = "";
    } else {
      labelInput.style.display = "none";
      const preset = platformPresets.find(p => p.className === select.value);
      labelInput.value = preset ? preset.label : "";
    }
  });

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.placeholder = "URL";
  urlInput.style.flex = "1";
  urlInput.required = true;
  urlInput.value = initialData.url || "";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "✖";
  removeBtn.style.background = "#ff3b30";
  removeBtn.style.color = "white";
  removeBtn.style.padding = "5px 10px";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(select);
  row.appendChild(labelInput);
  row.appendChild(urlInput);
  row.appendChild(removeBtn);
  
  if (initialData.className !== "custom" && !initialData.label) {
    const preset = platformPresets.find(p => p.className === select.value);
    labelInput.value = preset ? preset.label : "";
  }

  container.appendChild(row);
}

function getLinksFromBuilder(container) {
  const links = [];
  const rows = container.children;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const select = row.querySelector("select");
    const labelInput = row.querySelector("input[placeholder='Label']");
    const urlInput = row.querySelector("input[placeholder='URL']");
    if (select && urlInput && urlInput.value) {
      links.push({
        label: labelInput.value || select.options[select.selectedIndex].text,
        className: select.value,
        url: urlInput.value
      });
    }
  }
  return links;
}

let currentReleases = [];

function renderArtists(artists) {
  artistsList.innerHTML = artists.map(a => `
    <div class="list-item">
      <div><strong>${a.name}</strong> (${a.slug})</div>
      <button onclick="editArtist('${a._id}')">Edit</button>
    </div>
  `).join("");
}

function renderReleases(releases) {
  currentReleases = releases;
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
  
  const builder = document.getElementById("artist-socials-builder");
  builder.innerHTML = "";
  (a.socials || []).forEach(link => createLinkRow(builder, link));
  
  artistForm.classList.remove("hidden");
};

newArtistBtn.addEventListener("click", () => {
  document.getElementById("artist-id").value = "";
  artistForm.reset();
  const builder = document.getElementById("artist-socials-builder");
  builder.innerHTML = "";
  createLinkRow(builder, { label: "Instagram", className: "instagram", url: "" });
  artistForm.classList.remove("hidden");
});

document.getElementById("add-social-btn").addEventListener("click", () => {
  createLinkRow(document.getElementById("artist-socials-builder"), { label: "", className: "instagram", url: "" });
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
    socials: getLinksFromBuilder(document.getElementById("artist-socials-builder"))
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
  
  const builder = document.getElementById("release-links-builder");
  builder.innerHTML = "";
  (r.links || []).forEach(link => createLinkRow(builder, link));

  document.getElementById("release-sort").value = r.sortOrder || 0;
  releaseForm.classList.remove("hidden");
};

newReleaseBtn.addEventListener("click", () => {
  document.getElementById("release-id").value = "";
  releaseForm.reset();
  const builder = document.getElementById("release-links-builder");
  builder.innerHTML = "";
  createLinkRow(builder, { label: "Spotify", className: "spotify", url: "" });
  releaseForm.classList.remove("hidden");
});

document.getElementById("add-link-btn").addEventListener("click", () => {
  createLinkRow(document.getElementById("release-links-builder"), { label: "", className: "spotify", url: "" });
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
    links: getLinksFromBuilder(document.getElementById("release-links-builder")),
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
