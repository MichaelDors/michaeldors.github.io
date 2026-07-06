import { ConvexClient } from "https://esm.sh/convex/browser";

// Connect to Convex
const CONVEX_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "https://good-capybara-664.convex.cloud/"
  : "https://giddy-shepherd-959.convex.cloud/";
const convex = new ConvexClient(CONVEX_URL);

// Route restoration logic for SPA on GitHub Pages
const urlParams = new URLSearchParams(window.location.search);
const p = urlParams.get('p');
if (p) {
  window.history.replaceState(null, null, p + window.location.hash);
}

// Simple router
async function route() {
  const appRoot = document.getElementById("app-root");
  const headerContainer = document.getElementById("header-container");
  
  // Clear loading state
  appRoot.innerHTML = '<div class="loader"></div>';
  headerContainer.innerHTML = '';
  
  const path = window.location.pathname.replace(/\/$/, "");
  const segments = path.replace("/disco", "").split("/").filter(Boolean);

  try {
    // Check route aliases first
    if (segments.length === 1) {
      const aliasRecord = await convex.query("queries:getRouteAlias", { alias: "/" + segments[0] });
      if (aliasRecord) {
        window.history.replaceState(null, null, aliasRecord.targetRoute);
        return route(); // re-route
      }
    }

    if (segments.length === 0) {
      // Artist Directory (all artists)
      const artists = await convex.query("queries:getAllArtists", {});
      renderArtistDirectory(appRoot, artists);
    } else if (segments.length === 1) {
      // Artist Page
      const artistSlug = segments[0];
      const artist = await convex.query("queries:getArtistBySlug", { slug: artistSlug });
      if (!artist) return render404(appRoot);
      const releases = await convex.query("queries:getReleasesByArtist", { artistId: artist._id });
      renderArtistPage(appRoot, artist, releases);
    } else if (segments.length === 2) {
      // Release Page
      const artistSlug = segments[0];
      const releaseSlug = segments[1];
      const artist = await convex.query("queries:getArtistBySlug", { slug: artistSlug });
      const release = await convex.query("queries:getReleaseBySlug", { slug: releaseSlug });
      if (!artist || !release) return render404(appRoot);
      renderReleasePage(appRoot, headerContainer, artist, release);
    } else {
      render404(appRoot);
    }
  } catch (err) {
    console.error(err);
    appRoot.innerHTML = `<p style="text-align:center; margin-top: 50px;">Error loading content.</p>`;
  }
}

function render404(container) {
  document.title = "Not Found - Disco";
  container.innerHTML = `
    <div style="text-align: center; margin-top: 100px;">
      <h2>404 - Not Found</h2>
      <a href="/disco/" style="color: var(--text-main); text-decoration: underline;">Return Home</a>
    </div>
  `;
}

function renderArtistDirectory(container, artists) {
  document.title = "Disco Artists";
  if (!artists || artists.length === 0) {
    container.innerHTML = `<p style="text-align:center; margin-top: 50px;">No artists found.</p>`;
    return;
  }
  container.innerHTML = `
    <section class="artist-hero" style="margin-bottom: 40px;">
      <h1 class="artist-title">Disco Artists</h1>
    </section>
    <section class="release-section">
      <div class="release-grid">
        ${artists.map(artist => `
          <a class="release-card" href="/disco/${artist.slug}" onclick="navigate(event, '/disco/${artist.slug}')">
            <div class="release-cover">
              <img src="${artist.imageUrl}" alt="${artist.name}" />
            </div>
            <h3 class="release-title" style="text-align: center;">${artist.name}</h3>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderArtistPage(container, artist, releases) {
  document.title = artist.name;
  const socialsHtml = artist.socials?.map(social => `
    <a class="btn ${social.className}" href="${social.url}" target="_blank" rel="noopener noreferrer">${social.label}</a>
  `).join("") || "";

  const releasesHtml = releases?.map(release => `
    <a class="release-card" href="/disco/${artist.slug}/${release.slug}" onclick="navigate(event, '/disco/${artist.slug}/${release.slug}')">
      <div class="release-cover">
        <img src="${release.coverUrl}" alt="${release.title} cover art" />
      </div>
      <h3 class="release-title">${release.title}</h3>
      <p class="release-meta">${release.type} · ${release.year}</p>
    </a>
  `).join("") || "<p>No releases yet.</p>";

  const aboutImagesHtml = artist.aboutImageUrls?.map(src => `
    <img class="carousel-img" src="${src}" alt="About ${artist.name}" draggable="false" />
  `).join("") || "";

  container.innerHTML = `
    <section class="artist-hero">
      <img class="artist-photo" src="${artist.imageUrl}" alt="${artist.name}" />
      <h1 class="artist-title">${artist.name}</h1>
      <div class="artist-actions">
        ${socialsHtml}
      </div>
    </section>

    <section class="release-section">
      <h2 class="section-title">Releases</h2>
      <div class="release-grid">
        ${releasesHtml}
      </div>
    </section>

    ${artist.about ? `
    <section class="about" id="aboutSection">
      <h2 class="about-title">About ${artist.name}</h2>
      ${aboutImagesHtml ? `
      <div class="about-carousel">
        <div class="carousel-track">
          ${aboutImagesHtml}
        </div>
      </div>` : ""}
      <div class="about-text">
        <p>${artist.about.replace(/\\n/g, "<br>")}</p>
      </div>
    </section>` : ""}

    <footer class="site-footer">
      Powered by <img src="https://raw.githubusercontent.com/MichaelDors/straightouttacomp/refs/heads/main/disco_light.png" alt="Disco" class="footer-icon"> by Michael Dors
    </footer>
  `;
}

function renderReleasePage(container, headerContainer, artist, release) {
  document.title = `Stream ${release.title}`;

  headerContainer.innerHTML = `
    <header id="stickyHeader" class="sticky-header" aria-hidden="true" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
      <div class="sticky-header-content">
        <div class="sticky-cover-wrapper album-art-frame">
          <img src="${release.coverUrl}" alt="" class="sticky-cover" />
        </div>
        <div class="sticky-meta">
          <span class="sticky-title">${release.title}</span>
          <a class="sticky-artist" href="/disco/${artist.slug}" onclick="navigate(event, '/disco/${artist.slug}')">${artist.name}</a>
        </div>
        <div class="sticky-countdown" id="stickyCountdownCard" aria-live="polite">
          <span class="countdown-time" id="stickyCountdown">00:00:00:00</span>
        </div>
      </div>
    </header>
  `;

  const linksHtml = release.links?.length > 0
    ? release.links.map(link => `<a class="btn ${link.className}" href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`).join("")
    : '<p class="missing-platform">Streaming links coming soon.</p>';

  const aboutImagesHtml = release.aboutImageUrls?.map(src => `<img class="carousel-img" src="${src}" alt="About This Album" draggable="false" />`).join("") || "";

  container.innerHTML = `
    <div class="sticker-layer" id="stickerLayer" aria-hidden="true"></div>
    <section class="hero">
      <div class="cover-frame album-art-frame">
        <img class="cover" id="albumCover" src="${release.coverUrl}" alt="${release.title} cover art" />
      </div>
      <div class="meta">
        <h1 class="title" id="albumTitle">${release.title}</h1>
        <a class="artist" id="artistName" href="/disco/${artist.slug}" onclick="navigate(event, '/disco/${artist.slug}')">${artist.name}</a>
        <p class="countdown" aria-live="polite">
          <span class="countdown-label">Drops in</span>
          <span class="countdown-time" id="countdown">00:00:00:00</span>
        </p>
      </div>
      <div class="actions">
        ${linksHtml}
      </div>
      <p class="missing-platform">Don't see your favorite platform? We may still be there!</p>
    </section>

    ${release.about ? `
    <section class="about" id="aboutSection">
      <h2 class="about-title">About This Album</h2>
      ${aboutImagesHtml ? `
      <div class="about-carousel" id="aboutCarousel">
        <div class="carousel-track" id="carouselTrack">
          ${aboutImagesHtml}
        </div>
      </div>` : ""}
      <div class="about-text">
        <p>${release.about.replace(/\\n/g, "<br>")}</p>
      </div>
    </section>` : ""}

    <footer class="site-footer">
      Powered by <img src="https://raw.githubusercontent.com/MichaelDors/straightouttacomp/refs/heads/main/disco_light.png" alt="Disco" class="footer-icon"> by Michael Dors
    </footer>
  `;

  initInteractiveFeatures(release.releaseAtUtc);
}

function initInteractiveFeatures(releaseDateStr) {
  // Sticky header
  const stickyHeader = document.getElementById("stickyHeader");
  const artistElement = document.getElementById("artistName");
  let headerVisible = false;

  function checkScroll() {
    if (!artistElement || !stickyHeader) return;
    const rect = artistElement.getBoundingClientRect();
    const shouldShow = rect.bottom < 70;
    if (shouldShow !== headerVisible) {
      headerVisible = shouldShow;
      if (shouldShow) stickyHeader.classList.add("visible");
      else stickyHeader.classList.remove("visible");
    }
  }
  window.addEventListener("scroll", checkScroll, { passive: true });
  checkScroll();

  // Countdown
  const targetDate = releaseDateStr ? new Date(releaseDateStr) : null;
  const stickyCountdownEl = document.getElementById("stickyCountdown");
  const stickyCountdownCard = document.getElementById("stickyCountdownCard");
  const countdownEl = document.getElementById("countdown");
  const countdownCard = countdownEl ? countdownEl.closest(".countdown") : null;

  function renderCountdown() {
    if (!targetDate) {
      if (countdownCard) countdownCard.style.display = "none";
      if (stickyCountdownCard) stickyCountdownCard.style.display = "none";
      return;
    }
    const diffMs = targetDate.getTime() - Date.now();
    if (diffMs <= 0) {
      if (countdownCard) countdownCard.style.display = "none";
      if (stickyCountdownCard) stickyCountdownCard.style.display = "none";
      return;
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const timeStr = [days, hours, minutes, seconds].map(v => String(v).padStart(2, "0")).join(":");
    if (countdownEl) countdownEl.textContent = timeStr;
    if (stickyCountdownEl) stickyCountdownEl.textContent = timeStr;
  }
  
  if (targetDate) {
    renderCountdown();
    setInterval(renderCountdown, 1000);
  }
}

window.navigate = function(event, path) {
  event.preventDefault();
  event.stopPropagation();
  window.history.pushState(null, null, path);
  route();
};

window.addEventListener("popstate", route);

// Start router
route();
