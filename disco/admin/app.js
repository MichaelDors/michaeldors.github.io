import { ConvexClient } from "https://esm.sh/convex/browser";

const CONVEX_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "https://good-capybara-664.convex.cloud"
  : "https://giddy-shepherd-959.convex.cloud";
const convex = new ConvexClient(CONVEX_URL);

function sync_iframe_url() {
  // Check if the app is currently running inside an iframe
  if (window.top !== window.self) {
    let current_path = window.location.pathname;

    // Strip out the '/disco' folder path so it looks clean on dors.fyi
    if (current_path.startsWith('/disco')) {
      current_path = current_path.substring(6);
    }
    // Ensure the root path formats correctly
    if (current_path === '') {
      current_path = '/';
    }

    const message_payload = JSON.stringify({
      type: 'route_change',
      path: current_path,
      title: document.title
    });

    // Send the new path up to the parent window
    window.parent.postMessage(message_payload, '*');
  }
}

// 1. Fire on initial app load
sync_iframe_url();

// 2. Fire when the user clicks the browser's back or forward buttons
window.addEventListener('popstate', sync_iframe_url);

// 3. Intercept the SPA router (Any time your app pushes a new URL to the history)
const original_push_state = history.pushState;
history.pushState = function () {
  original_push_state.apply(this, arguments);
  sync_iframe_url();
};

const original_replace_state = history.replaceState;
history.replaceState = function () {
  original_replace_state.apply(this, arguments);
  sync_iframe_url();
};

// 4. Observe title changes to sync dynamic title updates
const targetTitle = document.querySelector('title');
if (targetTitle) {
  new MutationObserver(() => sync_iframe_url()).observe(targetTitle, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

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
      allReleases = allReleases.concat(rels.map(r => ({ ...r, artistName: artist.name })));
    }
    renderReleases(allReleases);

    // Update release form artist dropdown
    const select = document.getElementById("release-artist");
    select.innerHTML = allArtists.map(a => `<option value="${a._id}">${a.name}</option>`).join("");
  } catch (e) {
    console.error(e);
    if (e.message.includes("Unauthorized")) {
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
  { label: "Pre-Save", className: "presave" },
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
  if (initialData.className !== "custom" && initialData.className !== "presave") {
    labelInput.style.display = "none";
  }

  select.addEventListener("change", () => {
    if (select.value === "custom" || select.value === "presave") {
      labelInput.style.display = "block";
      if (select.value === "presave" && !labelInput.value) {
        labelInput.value = "Pre-Save";
      }
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

  if (initialData.className !== "custom" && initialData.className !== "presave" && !initialData.label) {
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
  document.getElementById("artist-lowres-image").value = a.lowResImageUrl || "";
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
  document.getElementById("artist-lowres-image").value = "";
  const builder = document.getElementById("artist-socials-builder");
  builder.innerHTML = "";
  createLinkRow(builder, { label: "Instagram", className: "instagram", url: "" });
  artistForm.classList.remove("hidden");
});

document.getElementById("add-social-btn").addEventListener("click", () => {
  createLinkRow(document.getElementById("artist-socials-builder"), { label: "", className: "instagram", url: "" });
});

async function fetchHtmlViaProxy(url) {
  const proxies = [
    target => `https://corsproxy.io/?${encodeURIComponent(target)}`,
    target => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    target => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`
  ];

  for (let i = 0; i < proxies.length; i++) {
    try {
      const proxyUrl = proxies[i](url);
      const res = await fetch(proxyUrl);
      if (!res.ok) continue;
      if (proxyUrl.includes("allorigins.win")) {
        const json = await res.json();
        if (json && json.contents) return json.contents;
      } else {
        const text = await res.text();
        if (text && text.length > 500) return text;
      }
    } catch (e) {
      console.warn(`Proxy ${i} failed:`, e);
    }
  }
  throw new Error("All CORS proxies failed to fetch the page.");
}

document.getElementById("import-artist-itunes").addEventListener("click", async () => {
  let nameOrUrl = document.getElementById("artist-name").value.trim();
  if (!nameOrUrl) {
    nameOrUrl = prompt("Enter Artist Name or Apple Music Artist URL to import:");
    if (!nameOrUrl) return;
    document.getElementById("artist-name").value = nameOrUrl;
  }

  const btn = document.getElementById("import-artist-itunes");
  const originalText = btn.textContent;
  btn.textContent = "Importing...";
  btn.disabled = true;

  try {
    let artistName = "";
    let artistLinkUrl = "";

    if (nameOrUrl.startsWith("http")) {
      const idMatch = nameOrUrl.match(/\/artist\/[^/]+\/(\d+)/i) || nameOrUrl.match(/\/artist\/(\d+)/i);
      const artistId = idMatch ? idMatch[1] : null;
      if (artistId) {
        btn.textContent = "Resolving name...";
        const res = await fetch(`https://itunes.apple.com/lookup?id=${artistId}`);
        const json = await res.json();
        if (json.results && json.results.length > 0) {
          artistName = json.results[0].artistName;
          artistLinkUrl = json.results[0].artistLinkUrl || nameOrUrl;
        }
      }
      if (!artistName) {
        const pathParts = nameOrUrl.split("/artist/")[1]?.split("/");
        if (pathParts && pathParts[0]) {
          artistName = decodeURIComponent(pathParts[0]).replace(/-/g, " ");
        }
        artistLinkUrl = nameOrUrl;
      }
    } else {
      btn.textContent = "Searching iTunes...";
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(nameOrUrl)}&entity=musicArtist&limit=1`);
      const json = await res.json();
      if (json.results && json.results.length > 0) {
        artistName = json.results[0].artistName;
        artistLinkUrl = json.results[0].artistLinkUrl;
      } else {
        artistName = nameOrUrl;
      }
    }

    if (!artistName) {
      alert("Could not determine artist name.");
      return;
    }

    document.getElementById("artist-name").value = artistName;
    document.getElementById("artist-slug").value = artistName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    let imageImported = false;

    // A. Try official Apple Music profile picture scraping via Convex server-side Action
    if (artistLinkUrl) {
      try {
        btn.textContent = "Scraping Apple Music...";
        const rawPfpUrl = await convex.action("actions:fetchArtistPfp", { artistLinkUrl });
        if (rawPfpUrl) {
          const artworkRegex = /\/\d+x\d+[^/]*\.(jpg|png|jpeg|webp)$/i;
          const highRes = rawPfpUrl.replace(artworkRegex, "/1000x1000.$1");
          const lowRes = rawPfpUrl.replace(artworkRegex, "/100x100.$1");

          document.getElementById("artist-image").value = highRes;
          document.getElementById("artist-lowres-image").value = lowRes;
          imageImported = true;
          console.log("Successfully scraped AM profile picture via Convex Action");
        }
      } catch (e) {
        console.warn("Convex server-side scrape failed:", e);
      }
    }

    // B. Try Wikidata (CORS-free, clean Wikimedia Commons photos)
    if (!imageImported) {
      try {
        btn.textContent = "Checking Wikidata...";
        const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&format=json&origin=*`;
        const searchRes = await fetch(searchUrl);
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          if (searchJson.search && searchJson.search.length > 0) {
            const entityId = searchJson.search[0].id;
            const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json&origin=*`;
            const entityRes = await fetch(entityUrl);
            if (entityRes.ok) {
              const entityJson = await entityRes.json();
              const claims = entityJson.entities[entityId].claims;
              const p18 = claims.P18;
              if (p18 && p18.length > 0 && p18[0].mainsnak && p18[0].mainsnak.datavalue) {
                const filename = p18[0].mainsnak.datavalue.value;
                btn.textContent = "Resolving image...";

                const getCommonsUrl = async (width) => {
                  const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&iiurlwidth=${width}&format=json&origin=*`;
                  const res = await fetch(commonsUrl);
                  const json = await res.json();
                  const pages = json.query.pages;
                  const pageId = Object.keys(pages)[0];
                  return pages[pageId].imageinfo[0].thumburl || pages[pageId].imageinfo[0].url;
                };

                const highRes = await getCommonsUrl(1000);
                const lowRes = await getCommonsUrl(100);

                document.getElementById("artist-image").value = highRes;
                document.getElementById("artist-lowres-image").value = lowRes;
                imageImported = true;
              }
            }
          }
        }
      } catch (e) {
        console.warn("Wikidata import failed:", e);
      }
    }

    // C. iTunes Top Album Cover fallback
    if (!imageImported) {
      try {
        btn.textContent = "Using top album artwork...";
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=album&limit=1`);
        const json = await res.json();
        if (json.results && json.results.length > 0) {
          const imgUrl = json.results[0].artworkUrl100;
          const artworkRegex = /\/\d+x\d+[^/]*\.(jpg|png|jpeg|webp)$/i;
          const highRes = imgUrl.replace(artworkRegex, "/1000x1000.$1");
          const lowRes = imgUrl.replace(artworkRegex, "/100x100.$1");

          document.getElementById("artist-image").value = highRes;
          document.getElementById("artist-lowres-image").value = lowRes;
          imageImported = true;
        }
      } catch (e) {
        console.warn("iTunes top album fallback failed:", e);
      }
    }

    if (!imageImported) {
      alert("Autofilled metadata, but could not retrieve artist photo automatically. Please paste the image URL manually.");
    }
  } catch (err) {
    console.error(err);
    alert("Error importing artist: " + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
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
    lowResImageUrl: document.getElementById("artist-lowres-image").value || undefined,
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
  } catch (err) {
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
  document.getElementById("release-lowres-cover").value = r.lowResCoverUrl || "";
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
  document.getElementById("release-lowres-cover").value = "";
  const builder = document.getElementById("release-links-builder");
  builder.innerHTML = "";
  createLinkRow(builder, { label: "Spotify", className: "spotify", url: "" });
  releaseForm.classList.remove("hidden");
});

document.getElementById("add-link-btn").addEventListener("click", () => {
  createLinkRow(document.getElementById("release-links-builder"), { label: "", className: "spotify", url: "" });
});

document.getElementById("import-release-itunes").addEventListener("click", async () => {
  let titleOrUrl = document.getElementById("release-title").value.trim();
  if (!titleOrUrl) {
    titleOrUrl = prompt("Enter Album Name or Apple Music Album URL to import:");
    if (!titleOrUrl) return;
    document.getElementById("release-title").value = titleOrUrl;
  }

  const btn = document.getElementById("import-release-itunes");
  const originalText = btn.textContent;
  btn.textContent = "Importing...";
  btn.disabled = true;

  try {
    let album = null;

    if (titleOrUrl.startsWith("http")) {
      const idMatch = titleOrUrl.match(/\/album\/[^/]+\/(\d+)/i) || titleOrUrl.match(/\/album\/(\d+)/i);
      const albumId = idMatch ? idMatch[1] : null;
      if (!albumId) {
        alert("Could not parse Album ID from URL.");
        return;
      }
      const res = await fetch(`https://itunes.apple.com/lookup?id=${albumId}`);
      const json = await res.json();
      if (!json.results || json.results.length === 0) {
        alert("Album not found on iTunes lookup.");
        return;
      }
      album = json.results[0];
    } else {
      const artistId = document.getElementById("release-artist").value;
      const artist = allArtists.find(a => a._id === artistId);
      const searchTerm = artist ? `${artist.name} ${titleOrUrl}` : titleOrUrl;

      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=album&limit=1`);
      const json = await res.json();
      if (!json.results || json.results.length === 0) {
        alert("Album not found on iTunes.");
        return;
      }
      album = json.results[0];
    }

    if (album) {
      document.getElementById("release-title").value = album.collectionName;
      document.getElementById("release-slug").value = album.collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      document.getElementById("release-type").value = album.trackCount > 3 ? "Album" : "Single";
      document.getElementById("release-year").value = album.releaseDate.substring(0, 4);
      document.getElementById("release-date").value = album.releaseDate;

      const imgUrl = album.artworkUrl100;
      const artworkRegex = /\/\d+x\d+[^/]*\.(jpg|png|jpeg|webp)$/i;
      const highRes = imgUrl.replace(artworkRegex, "/3000x3000.$1");
      const lowRes = imgUrl.replace(artworkRegex, "/100x100.$1");

      document.getElementById("release-cover").value = highRes;
      document.getElementById("release-lowres-cover").value = lowRes;

      if (album.collectionViewUrl) {
        const builder = document.getElementById("release-links-builder");
        const existingRows = getLinksFromBuilder(builder);
        const hasApple = existingRows.some(l => l.className === "apple");
        if (!hasApple) {
          createLinkRow(builder, { label: "Apple Music", className: "apple", url: album.collectionViewUrl });
        }
      }
    }
  } catch (err) {
    console.error(err);
    alert("Error importing release: " + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
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
    lowResCoverUrl: document.getElementById("release-lowres-cover").value || undefined,
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
  } catch (err) {
    releaseError.textContent = err.message;
  }
});

init();
