import { ConvexClient } from "https://esm.sh/convex/browser";

// Connect to Convex
const CONVEX_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "https://good-capybara-664.convex.cloud"
  : "https://giddy-shepherd-959.convex.cloud";
const convex = new ConvexClient(CONVEX_URL);

// Route restoration logic for SPA on GitHub Pages
const urlParams = new URLSearchParams(window.location.search);
const p = urlParams.get('p');
if (p) {
  window.history.replaceState(null, null, p + window.location.hash);
}

let currentCleanup = null;

// Simple router
async function route() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

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
            <div class="release-cover artist-pfp-wrapper">
              <img class="directory-pfp" src="${artist.lowResImageUrl || artist.imageUrl}" data-high-res="${artist.imageUrl}" alt="${artist.name}" />
            </div>
            <h3 class="release-title" style="text-align: center;">${artist.name}</h3>
          </a>
        `).join("")}
      </div>
    </section>
  `;

  // Progressive image load for directory pfps
  const pfps = container.querySelectorAll(".directory-pfp");
  pfps.forEach(img => {
    if (img.dataset.highRes && img.src !== img.dataset.highRes) {
      const highRes = new Image();
      highRes.src = img.dataset.highRes;
      highRes.onload = () => { img.src = highRes.src; };
    }
  });
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
      <img class="artist-photo" src="${artist.lowResImageUrl || artist.imageUrl}" data-high-res="${artist.imageUrl}" alt="${artist.name}" id="artistPhoto" />
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

  // Progressive image load for artist pfp
  const img = document.getElementById("artistPhoto");
  if (img && img.dataset.highRes && img.src !== img.dataset.highRes) {
    const highRes = new Image();
    highRes.src = img.dataset.highRes;
    highRes.onload = () => { img.src = highRes.src; };
  }
}

function renderReleasePage(container, headerContainer, artist, release) {
  document.title = `Stream ${release.title}`;

  headerContainer.innerHTML = `
    <header id="stickyHeader" class="sticky-header" aria-hidden="true" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
      <div class="sticky-header-content">
        <div class="sticky-cover-wrapper album-art-frame">
          <img src="${release.lowResCoverUrl || release.coverUrl}" data-high-res="${release.coverUrl}" alt="" class="sticky-cover" id="stickyCoverImg" />
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
    ? release.links.map(link => {
        const isPresave = link.className === "presave" || link.openInIframe;
        if (isPresave) {
          return `<a class="btn ${link.className}" href="${link.url}" data-iframe="true" data-title="${release.title} - ${link.label}">${link.label}</a>`;
        }
        return `<a class="btn ${link.className}" href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`;
      }).join("")
    : `<p class="missing-platform">Streaming links coming soon.</p>`;

  const aboutImagesHtml = release.aboutImageUrls?.map(src => `<img class="carousel-img" src="${src}" alt="About This Album" draggable="false" />`).join("") || "";

  container.innerHTML = `
    <div class="sticker-layer" id="stickerLayer" aria-hidden="true"></div>
    <section class="hero">
      <div class="cover-frame album-art-frame">
        <img class="cover" id="albumCover" src="${release.lowResCoverUrl || release.coverUrl}" data-high-res="${release.coverUrl}" alt="${release.title} cover art" />
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
      <p class="missing-platform">Don't see your favorite platform? This release may still be there.</p>
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
      Powered by <img src="https://raw.githubusercontent.com/MichaelDors/straightouttacomp/refs/heads/main/disco_light.png" alt="Disco" class="footer-icon" id="footerDiscoLogo" style="opacity: 0;"> by Michael Dors
    </footer>
  `;

  currentCleanup = initInteractiveFeatures(release);
}

function initInteractiveFeatures(release) {
  // Progressive image load for release covers
  const albumCover = document.getElementById("albumCover");
  const stickyCoverImg = document.getElementById("stickyCoverImg");

  if (albumCover && albumCover.dataset.highRes && albumCover.src !== albumCover.dataset.highRes) {
    const highRes = new Image();
    highRes.src = albumCover.dataset.highRes;
    highRes.onload = () => { albumCover.src = highRes.src; };
  }
  if (stickyCoverImg && stickyCoverImg.dataset.highRes && stickyCoverImg.src !== stickyCoverImg.dataset.highRes) {
    const highRes = new Image();
    highRes.src = stickyCoverImg.dataset.highRes;
    highRes.onload = () => { stickyCoverImg.src = highRes.src; };
  }

  // Sticky header elements
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

  // Countdown elements
  const targetDate = release.releaseAtUtc ? new Date(release.releaseAtUtc) : null;
  const stickyCountdownEl = document.getElementById("stickyCountdown");
  const stickyCountdownCard = document.getElementById("stickyCountdownCard");
  const countdownEl = document.getElementById("countdown");
  const countdownCard = countdownEl ? countdownEl.closest(".countdown") : null;
  let countdownInterval;

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
      if (countdownInterval) clearInterval(countdownInterval);
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
    countdownInterval = setInterval(renderCountdown, 1000);
  }

  // --- STICKER SYSTEM ---
  const hero = document.querySelector(".hero");
  const stickerLayer = document.getElementById("stickerLayer");
  const actions = document.querySelector(".actions");
  const title = document.getElementById("albumTitle");
  const artist = document.getElementById("artistName");
  const aboutCarousel = document.getElementById("aboutCarousel");
  const carouselTrack = document.getElementById("carouselTrack");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const storageKey = `stickerLayout${release.slug}.v1`;

  let dragState = null;
  let zCounter = 40;
  let imageMetaCache = {};
  const stickerSources = release.stickerUrls || [];
  let activeStickers = [];

  if (!hero || !stickerLayer || !albumCover || !actions) {
    return () => {
      window.removeEventListener("scroll", checkScroll);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }

  function getStoredState() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveStickerState(id, data) {
    const state = getStoredState();
    state[id] = data;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) { }
  }

  function randomInRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function rectFromElement(el, layerRect) {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left - layerRect.left,
      top: rect.top - layerRect.top,
      right: rect.right - layerRect.left,
      bottom: rect.bottom - layerRect.top
    };
  }

  function intersects(a, b, padding) {
    return !(
      a.right + padding < b.left ||
      a.left - padding > b.right ||
      a.bottom + padding < b.top ||
      a.top - padding > b.bottom
    );
  }

  function clamp(min, value, max) {
    return Math.max(min, Math.min(value, max));
  }

  function insetRect(rect, insetX, insetY) {
    return {
      left: rect.left + insetX,
      top: rect.top + insetY,
      right: rect.right - insetX,
      bottom: rect.bottom - insetY
    };
  }

  function expandRect(rect, pad) {
    return {
      left: rect.left - pad,
      top: rect.top - pad,
      right: rect.right + pad,
      bottom: rect.bottom + pad
    };
  }

  function buildProtectedRects(layerRect) {
    const strict = [];
    const center = [];
    const textPad = 12;

    if (title) strict.push(expandRect(rectFromElement(title, layerRect), textPad));
    if (artist) strict.push(expandRect(rectFromElement(artist, layerRect), textPad));
    if (countdownCard && getComputedStyle(countdownCard).display !== "none") {
      strict.push(expandRect(rectFromElement(countdownCard, layerRect), textPad));
    }

    const aboutSection = document.getElementById("aboutSection");
    if (aboutSection) {
      strict.push(expandRect(rectFromElement(aboutSection, layerRect), 0));
    }

    const coverFrame = albumCover.closest(".cover-frame");
    if (coverFrame) {
      const coverRect = rectFromElement(coverFrame, layerRect);
      const coverInset = Math.round(Math.min(coverRect.width, coverRect.height) * 0.28);
      center.push(insetRect(coverRect, coverInset, coverInset));
    }

    const buttons = actions.querySelectorAll(".btn");
    for (let i = 0; i < buttons.length; i++) {
      const btnRect = rectFromElement(buttons[i], layerRect);
      center.push(insetRect(btnRect, 28, 14));
    }
    return { strict, center };
  }

  function shuffleArray(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  }

  function zoneIfValid(zone, minWidth, minHeight) {
    if (zone.right - zone.left < minWidth || zone.bottom - zone.top < minHeight) {
      return null;
    }
    return zone;
  }

  function placementCenterBlocked(candidate, centerRects) {
    const cx = (candidate.left + candidate.right) / 2;
    const cy = (candidate.top + candidate.bottom) / 2;
    return centerRects.some(rect => cx > rect.left && cx < rect.right && cy > rect.top && cy < rect.bottom);
  }

  // padding default check
  function placementBlocked(candidate, protectedRects) {
    if (protectedRects.strict.some(rect => intersects(candidate, rect, 2))) {
      return true;
    }
    return placementCenterBlocked(candidate, protectedRects.center);
  }

  function getStickerOccupancyRect(left, top, dimensions, rotationDeg, extraPad) {
    const pad = extraPad || 0;
    const rad = (rotationDeg || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const boundW = dimensions.width * cos + dimensions.height * sin;
    const boundH = dimensions.width * sin + dimensions.height * cos;
    const cx = left + dimensions.width / 2;
    const cy = top + dimensions.height / 2;
    return {
      left: cx - boundW / 2 - pad,
      top: cy - boundH / 2 - pad,
      right: cx + boundW / 2 + pad,
      bottom: cy + boundH / 2 + pad
    };
  }

  function overlapsPlacedStickers(left, top, dimensions, rotation, placedRects) {
    const candidate = getStickerOccupancyRect(left, top, dimensions, rotation, 10);
    return placedRects.some(placed => intersects(candidate, placed, 0));
  }

  function isValidInitialPlacement(left, top, dimensions, rotation, protectedRects, placedRects) {
    if (overlapsPlacedStickers(left, top, dimensions, rotation, placedRects)) return false;
    const axisRect = {
      left: left,
      top: top,
      right: left + dimensions.width,
      bottom: top + dimensions.height
    };
    return !placementBlocked(axisRect, protectedRects);
  }

  function buildBalancedPlacementSlots(count) {
    const anchors = [];
    const coverCount = Math.floor(count / 2);
    let i;
    for (i = 0; i < coverCount; i++) anchors.push("cover");
    for (i = coverCount; i < count; i++) anchors.push("buttons");

    const sides = [];
    const leftCount = Math.floor(count / 2);
    for (i = 0; i < leftCount; i++) sides.push("left");
    for (i = leftCount; i < count; i++) sides.push("right");

    shuffleArray(anchors);
    shuffleArray(sides);

    const slots = [];
    for (i = 0; i < count; i++) {
      slots.push({ anchor: anchors[i], side: sides[i] });
    }
    return slots;
  }

  function getZonesForPlacementSlot(layerRect, dimensions, slot) {
    const minWidth = Math.min(dimensions.width * 0.45, 44);
    const minHeight = Math.min(dimensions.height * 0.45, 44);
    const hangW = dimensions.width * 0.22;
    const hangH = dimensions.height * 0.22;
    const overlapW = dimensions.width * 0.42;
    const overlapH = dimensions.height * 0.38;
    const btnHangW = dimensions.width * 0.4;
    const btnHangH = dimensions.height * 0.26;
    const btnOverlapW = Math.min(dimensions.width * 0.1, 14);
    const btnOverlapH = Math.min(dimensions.height * 0.08, 10);
    const coverRect = rectFromElement(albumCover.closest(".cover-frame"), layerRect);
    const actionsRect = rectFromElement(actions, layerRect);
    const zones = [];
    const buttons = actions.querySelectorAll(".btn");
    let btnIndex;
    let btnRect;

    if (slot.anchor === "cover") {
      if (slot.side === "left") {
        zones.push({
          left: coverRect.left - hangW,
          right: coverRect.left + overlapW,
          top: coverRect.top - hangH,
          bottom: coverRect.top + overlapH
        });
        zones.push({
          left: coverRect.left - hangW,
          right: coverRect.left + overlapW,
          top: coverRect.bottom - overlapH,
          bottom: coverRect.bottom + hangH
        });
      } else {
        zones.push({
          left: coverRect.right - overlapW,
          right: coverRect.right + hangW,
          top: coverRect.top - hangH,
          bottom: coverRect.top + overlapH
        });
        zones.push({
          left: coverRect.right - overlapW,
          right: coverRect.right + hangW,
          top: coverRect.bottom - overlapH,
          bottom: coverRect.bottom + hangH
        });
      }
    } else if (slot.side === "left") {
      zones.push({
        left: actionsRect.left - btnHangW,
        right: actionsRect.left + btnOverlapW,
        top: actionsRect.top - btnHangH,
        bottom: actionsRect.bottom + btnHangH
      });
      for (btnIndex = 0; btnIndex < buttons.length; btnIndex++) {
        btnRect = rectFromElement(buttons[btnIndex], layerRect);
        zones.push({
          left: btnRect.left - btnHangW,
          right: btnRect.left + btnOverlapW,
          top: btnRect.top - btnOverlapH,
          bottom: btnRect.bottom + btnOverlapH
        });
      }
    } else {
      zones.push({
        left: actionsRect.right - btnOverlapW,
        right: actionsRect.right + btnHangW,
        top: actionsRect.top - btnHangH,
        bottom: actionsRect.bottom + btnHangH
      });
      for (btnIndex = 0; btnIndex < buttons.length; btnIndex++) {
        btnRect = rectFromElement(buttons[btnIndex], layerRect);
        zones.push({
          left: btnRect.right - btnOverlapW,
          right: btnRect.right + btnHangW,
          top: btnRect.top - btnOverlapH,
          bottom: btnRect.bottom + btnOverlapH
        });
      }
    }

    return zones
      .map(zone => zoneIfValid(zone, minWidth, minHeight))
      .filter(Boolean);
  }

  function getStickerBounds(layerRect) {
    let baseEdge = Math.round(clamp(72, layerRect.width * 0.22, 124));
    if (window.innerWidth < 420) baseEdge = Math.max(64, baseEdge - 10);
    return {
      baseEdge,
      minEdge: 58,
      maxEdge: 148
    };
  }

  function createStickerEl(id, src, dimensions, rotation, peeled) {
    const sticker = document.createElement("button");
    sticker.type = "button";
    sticker.className = "sticker" + (peeled ? " peeled" : "");
    sticker.setAttribute("aria-hidden", "true");
    sticker.tabIndex = -1;
    sticker.dataset.stickerId = id;
    sticker.dataset.peeled = peeled ? "true" : "false";
    sticker.style.width = dimensions.width + "px";
    sticker.style.height = dimensions.height + "px";
    sticker.style.setProperty("--sticker-rotation", rotation + "deg");
    sticker.style.transform = "rotate(" + rotation + "deg)";
    sticker.style.zIndex = String(++zCounter);

    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.draggable = false;
    img.addEventListener("error", () => {
      sticker.style.display = "none";
    });
    sticker.appendChild(img);
    return sticker;
  }

  function chooseRandomPosition(dimensions, rotation, zones, protectedRects, placedRects, layerRect) {
    if (!zones.length) return null;
    const zoneOrder = zones.slice();
    shuffleArray(zoneOrder);

    for (let zi = 0; zi < zoneOrder.length; zi++) {
      const zone = zoneOrder[zi];
      for (let attempt = 0; attempt < 36; attempt++) {
        const x = randomInRange(zone.left, Math.max(zone.left + 1, zone.right - dimensions.width));
        const y = randomInRange(zone.top, Math.max(zone.top + 1, zone.bottom - dimensions.height));
        if (!isValidInitialPlacement(x, y, dimensions, rotation, protectedRects, placedRects)) {
          continue;
        }

        const nudged = nudgePositionOntoScreen({ left: x, top: y }, dimensions, layerRect);
        if (!isValidInitialPlacement(nudged.left, nudged.top, dimensions, rotation, protectedRects, placedRects)) {
          continue;
        }

        return {
          left: nudged.left,
          top: nudged.top,
          right: nudged.left + dimensions.width,
          bottom: nudged.top + dimensions.height
        };
      }
    }
    return null;
  }

  function setStickerPosition(sticker, left, top) {
    sticker.style.left = left + "px";
    sticker.style.top = top + "px";
  }

  function clampStickerToLayer(left, top, dimensions, layerRect) {
    const visibleRatio = 0.88;
    const maxHangX = dimensions.width * (1 - visibleRatio);
    return {
      left: clamp(-maxHangX, left, layerRect.width - dimensions.width + maxHangX),
      top
    };
  }

  function nudgePositionOntoScreen(candidate, dimensions, layerRect) {
    const visibleRatio = 0.88;
    const minLeft = -(dimensions.width * (1 - visibleRatio));
    const maxLeft = layerRect.width - dimensions.width * visibleRatio;
    const minTop = -(dimensions.height * (1 - visibleRatio));
    const maxTop = layerRect.height - dimensions.height * visibleRatio;
    return {
      left: clamp(minLeft, candidate.left, maxLeft),
      top: clamp(minTop, candidate.top, maxTop),
      right: clamp(minLeft, candidate.left, maxLeft) + dimensions.width,
      bottom: clamp(minTop, candidate.top, maxTop) + dimensions.height
    };
  }

  function getDimensionsForImage(meta, stored, bounds) {
    const ratio = meta && meta.width > 0 && meta.height > 0 ? meta.width / meta.height : 1;
    if (stored && typeof stored.width === "number" && typeof stored.height === "number") {
      return {
        width: clamp(bounds.minEdge, stored.width, bounds.maxEdge * 1.35),
        height: clamp(bounds.minEdge, stored.height, bounds.maxEdge * 1.35)
      };
    }
    const longEdge = clamp(bounds.minEdge, bounds.baseEdge + Math.round(randomInRange(-12, 16)), bounds.maxEdge);
    if (ratio >= 1) {
      return {
        width: longEdge,
        height: clamp(bounds.minEdge, Math.round(longEdge / ratio), bounds.maxEdge)
      };
    }
    return {
      width: clamp(bounds.minEdge, Math.round(longEdge * ratio), bounds.maxEdge),
      height: longEdge
    };
  }

  function isPersonStickerSource(src) {
    try {
      const cleanSrc = String(src).split("?")[0].split("#")[0];
      const filename = decodeURIComponent(cleanSrc.substring(cleanSrc.lastIndexOf("/") + 1));
      return filename.toLowerCase().indexOf("person_") === 0;
    } catch (error) {
      return false;
    }
  }

  function loadImageMeta(src) {
    return new Promise(resolve => {
      if (imageMetaCache[src]) {
        resolve(imageMetaCache[src]);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const originalWidth = img.naturalWidth || 1;
        const originalHeight = img.naturalHeight || 1;

        const maxDim = 800;
        let scale = 1;
        if (originalWidth > maxDim || originalHeight > maxDim) {
          scale = maxDim / Math.max(originalWidth, originalHeight);
        }

        const renderWidth = Math.max(1, Math.round(originalWidth * scale));
        const renderHeight = Math.max(1, Math.round(originalHeight * scale));
        const bakedBorder = Math.ceil(24 * (Math.max(renderWidth, renderHeight) / 800));

        const canvas = document.createElement("canvas");
        canvas.width = renderWidth + bakedBorder * 2;
        canvas.height = renderHeight + bakedBorder * 2;
        const ctx = canvas.getContext("2d");

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = renderWidth;
        maskCanvas.height = renderHeight;
        const mCtx = maskCanvas.getContext("2d");
        mCtx.drawImage(img, 0, 0, renderWidth, renderHeight);
        mCtx.globalCompositeOperation = "source-in";
        mCtx.fillStyle = "rgba(255, 255, 255, 0.98)";
        mCtx.fillRect(0, 0, renderWidth, renderHeight);

        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          const dx = Math.cos(angle) * bakedBorder;
          const dy = Math.sin(angle) * bakedBorder;
          ctx.drawImage(maskCanvas, bakedBorder + dx, bakedBorder + dy);
        }

        const innerBorder = bakedBorder * 0.5;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dx = Math.cos(angle) * innerBorder;
          const dy = Math.sin(angle) * innerBorder;
          ctx.drawImage(maskCanvas, bakedBorder + dx, bakedBorder + dy);
        }

        ctx.drawImage(img, bakedBorder, bakedBorder, renderWidth, renderHeight);

        let bakedSrc = src;
        try {
          bakedSrc = canvas.toDataURL("image/png");
        } catch (e) {
          console.error("Canvas taint error, using original src", e);
        }

        const meta = {
          width: originalWidth,
          height: originalHeight,
          bakedSrc,
          renderRatio: (renderWidth + bakedBorder * 2) / renderWidth
        };
        imageMetaCache[src] = meta;
        resolve(meta);
      };
      img.onerror = () => {
        const fallback = { width: 1, height: 1, bakedSrc: src, renderRatio: 1 };
        imageMetaCache[src] = fallback;
        resolve(fallback);
      };
      img.src = src;
    });
  }

  function loadAllImageMeta(sources) {
    return Promise.all(sources.map(src => loadImageMeta(src))).then(metaList => {
      const bySource = {};
      sources.forEach((src, i) => {
        bySource[src] = metaList[i];
      });
      return bySource;
    });
  }

  function isDynamicRotationSticker(src) {
    try {
      const cleanSrc = String(src).split("?")[0].split("#")[0];
      const filename = decodeURIComponent(cleanSrc.substring(cleanSrc.lastIndexOf("/") + 1)).toLowerCase();
      return filename.indexOf("person_adam") !== -1 || filename.indexOf("person_caden") !== -1;
    } catch (error) {
      return false;
    }
  }

  function calculateDynamicRotation(left, width) {
    const centerX = window.innerWidth / 2;
    const stickerCenterX = left + width / 2;
    const dx = stickerCenterX - centerX;

    const contentHalf = 210;
    const baseRotation = 12;

    if (Math.abs(dx) <= contentHalf) {
      return -(dx / contentHalf) * baseRotation;
    } else {
      const sign = dx < 0 ? 1 : -1;
      const excess = Math.abs(dx) - contentHalf;
      return sign * (baseRotation + Math.sqrt(excess) * 0.4);
    }
  }

  function applyStickerDrag(stickerData, left, top) {
    setStickerPosition(stickerData.el, left, top);
    stickerData.left = left;
    stickerData.top = top;

    if (isDynamicRotationSticker(stickerData.src)) {
      const newRotation = calculateDynamicRotation(left, stickerData.dimensions.width);
      stickerData.rotation = newRotation;
      stickerData.el.style.setProperty("--sticker-rotation", newRotation + "deg");
      stickerData.el.style.transform = "rotate(" + newRotation + "deg)";
    }
  }

  function startDrag(event) {
    const target = event.target.closest(".sticker");
    if (!target) return;
    const stickerData = activeStickers.find(item => item.el === target);
    if (!stickerData) return;

    event.preventDefault();
    const pointerX = event.clientX;
    const pointerY = event.clientY;
    const layerRect = stickerLayer.getBoundingClientRect();
    const offsetX = pointerX - layerRect.left - stickerData.left;
    const offsetY = pointerY - layerRect.top - stickerData.top;

    if (target.style.animation) {
      target.style.animation = "none";
    }

    if (stickerData.peeled !== true) {
      stickerData.peeled = true;
      stickerData.el.dataset.peeled = "true";
      stickerData.el.classList.add("peeled");
    }

    target.classList.add("dragging");
    target.style.zIndex = String(++zCounter);
    target.setPointerCapture(event.pointerId);
    dragState = {
      sticker: stickerData,
      offsetX,
      offsetY,
      pointerId: event.pointerId
    };
  }

  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const layerRect = stickerLayer.getBoundingClientRect();
    const nextLeft = event.clientX - layerRect.left - dragState.offsetX;
    const nextTop = event.clientY - layerRect.top - dragState.offsetY;
    const clamped = clampStickerToLayer(nextLeft, nextTop, dragState.sticker.dimensions, layerRect);
    applyStickerDrag(dragState.sticker, clamped.left, clamped.top);
  }

  function onPointerEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const stickerData = dragState.sticker;
    if (stickerData.el.hasPointerCapture(event.pointerId)) {
      try {
        stickerData.el.releasePointerCapture(event.pointerId);
      } catch (e) { }
    }
    stickerData.el.classList.remove("dragging");

    if (!isDynamicRotationSticker(stickerData.src)) {
      const newRotation = randomInRange(-16, 14);
      stickerData.rotation = newRotation;
      stickerData.el.style.setProperty("--sticker-rotation", newRotation + "deg");
      stickerData.el.style.transform = "rotate(" + newRotation + "deg)";
    }

    const carouselRect = aboutCarousel ? aboutCarousel.getBoundingClientRect() : null;
    let attachedToCarousel = false;

    if (carouselRect) {
      const stickerRect = stickerData.el.getBoundingClientRect();
      const stickerCenterY = stickerRect.top + stickerRect.height / 2;
      if (stickerCenterY >= carouselRect.top && stickerCenterY <= carouselRect.bottom) {
        attachedToCarousel = true;
      }
    }

    if (attachedToCarousel) {
      stickerData.attachedTo = 'carousel';
      stickerData.relativeLeft = stickerData.left + aboutCarousel.scrollLeft;
    } else {
      stickerData.attachedTo = 'body';
      stickerData.relativeLeft = 0;
    }

    if (stickerData.id !== "disco_logo") {
      saveStickerState(stickerData.id, {
        left: stickerData.left,
        top: stickerData.top,
        rotation: stickerData.rotation,
        peeled: true,
        width: stickerData.baseWidth || stickerData.dimensions.width,
        height: stickerData.baseHeight || stickerData.dimensions.height,
        attachedTo: stickerData.attachedTo,
        relativeLeft: stickerData.relativeLeft
      });
    }
    dragState = null;
  }

  function mountStickers(metaBySource, skipAnimation) {
    stickerLayer.innerHTML = "";
    activeStickers = [];

    const layerRect = stickerLayer.getBoundingClientRect();
    const protectedRects = buildProtectedRects(layerRect);
    const state = getStoredState();
    const placedRects = [];
    const bounds = getStickerBounds(layerRect);
    const placementSlots = buildBalancedPlacementSlots(stickerSources.length);

    stickerSources.forEach((src, index) => {
      const id = "sticker_" + index;
      const stored = state[id];
      const meta = metaBySource[src];
      let rotation = stored && typeof stored.rotation === "number" ? stored.rotation : randomInRange(-16, 14);
      let dimensions = getDimensionsForImage(meta, stored, bounds);
      if (!stored && isPersonStickerSource(src)) {
        dimensions = {
          width: clamp(bounds.minEdge, Math.round(dimensions.width * 1.32), Math.round(bounds.maxEdge * 1.5)),
          height: clamp(bounds.minEdge, Math.round(dimensions.height * 1.32), Math.round(bounds.maxEdge * 1.5))
        };
      }

      const renderRatio = meta ? (meta.renderRatio || 1) : 1;
      const baseWidth = dimensions.width;
      const baseHeight = dimensions.height;
      dimensions.width = Math.round(dimensions.width * renderRatio);
      dimensions.height = Math.round(dimensions.height * renderRatio);

      const sticker = createStickerEl(
        id,
        meta ? (meta.bakedSrc || src) : src,
        dimensions,
        rotation,
        Boolean(stored && stored.peeled)
      );

      let position = null;

      if (stored && typeof stored.left === "number" && typeof stored.top === "number") {
        let storedLeft = stored.left;
        const isAttachedToCarousel = stored.attachedTo === 'carousel' && typeof stored.relativeLeft === "number";

        if (isAttachedToCarousel) {
          storedLeft = stored.relativeLeft - (aboutCarousel ? aboutCarousel.scrollLeft : 0);
        }

        const clampedStored = isAttachedToCarousel
          ? { left: storedLeft, top: stored.top }
          : clampStickerToLayer(storedLeft, stored.top, dimensions, layerRect);

        position = {
          left: clampedStored.left,
          top: clampedStored.top,
          right: clampedStored.left + dimensions.width,
          bottom: clampedStored.top + dimensions.height
        };
      }

      if (!position) {
        const slot = placementSlots[index];
        const zones = getZonesForPlacementSlot(layerRect, dimensions, slot);
        position = chooseRandomPosition(dimensions, rotation, zones, protectedRects, placedRects, layerRect);
      }

      if (!position) {
        const spread = Math.max(dimensions.width, dimensions.height) * 0.75;
        const safeWidth = Math.min(layerRect.width, 800);
        const safeLeft = (layerRect.width - safeWidth) / 2;
        for (let fi = 0; fi < 24; fi++) {
          const tryLeft = clamp(
            safeLeft + 8,
            safeLeft + 12 + index * 8 + (fi % 6) * spread * 0.35,
            safeLeft + safeWidth - dimensions.width - 8
          );
          const tryTop = clamp(
            8,
            16 + Math.floor(fi / 6) * spread * 0.4,
            layerRect.height - dimensions.height - 8
          );
          if (!isValidInitialPlacement(tryLeft, tryTop, dimensions, rotation, protectedRects, placedRects)) {
            continue;
          }
          const nudgedFallback = nudgePositionOntoScreen({ left: tryLeft, top: tryTop }, dimensions, layerRect);
          if (isValidInitialPlacement(
            nudgedFallback.left,
            nudgedFallback.top,
            dimensions,
            rotation,
            protectedRects,
            placedRects
          )) {
            position = {
              left: nudgedFallback.left,
              top: nudgedFallback.top,
              right: nudgedFallback.left + dimensions.width,
              bottom: nudgedFallback.top + dimensions.height
            };
            break;
          }
        }
      }

      if (!position) {
        const safeWidth = Math.min(layerRect.width, 800);
        const safeLeft = (layerRect.width - safeWidth) / 2;
        const lastLeft = clamp(
          safeLeft + 8,
          safeLeft + 8 + index * (dimensions.width * 0.55 + 22),
          safeLeft + safeWidth - dimensions.width - 8
        );
        const lastTop = clamp(
          8,
          8 + index * (dimensions.height * 0.45 + 26),
          layerRect.height - dimensions.height - 8
        );

        position = {
          left: lastLeft,
          top: lastTop,
          right: lastLeft + dimensions.width,
          bottom: lastTop + dimensions.height
        };
      }

      if (!position) return;

      if (isDynamicRotationSticker(src)) {
        rotation = calculateDynamicRotation(position.left, dimensions.width);
        sticker.style.setProperty("--sticker-rotation", rotation + "deg");
        sticker.style.transform = "rotate(" + rotation + "deg)";
      }

      setStickerPosition(sticker, position.left, position.top);
      if (!reducedMotion && !skipAnimation) {
        sticker.style.animation = "sticker-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both";
        sticker.style.animationDelay = (index * 80) + "ms";
        sticker.addEventListener("animationend", () => {
          sticker.style.animation = "none";
        }, { once: true });
      }
      stickerLayer.appendChild(sticker);

      placedRects.push(getStickerOccupancyRect(position.left, position.top, dimensions, rotation, 10));

      let isCarousel = false;
      let relLeft = 0;
      if (stored && stored.attachedTo) {
        isCarousel = stored.attachedTo === 'carousel';
        relLeft = stored.relativeLeft || 0;
      } else {
        const stickerCenterY = position.top + dimensions.height / 2 + layerRect.top;
        const carouselRect = aboutCarousel ? aboutCarousel.getBoundingClientRect() : null;
        if (carouselRect && stickerCenterY >= carouselRect.top && stickerCenterY <= carouselRect.bottom) {
          isCarousel = true;
          relLeft = position.left + (aboutCarousel ? aboutCarousel.scrollLeft : 0);
        }
      }

      activeStickers.push({
        id,
        src,
        el: sticker,
        left: position.left,
        top: position.top,
        dimensions,
        baseWidth,
        baseHeight,
        rotation,
        peeled: Boolean(stored && stored.peeled),
        attachedTo: isCarousel ? 'carousel' : 'body',
        relativeLeft: isCarousel ? relLeft : 0
      });
    });

    const discoPlaceholder = document.getElementById("footerDiscoLogo");
    if (discoPlaceholder) {
      const discoId = "disco_logo";
      const discoSrc = "https://raw.githubusercontent.com/MichaelDors/straightouttacomp/refs/heads/main/disco_light.png";
      const dRect = discoPlaceholder.getBoundingClientRect();
      const dDimensions = { width: dRect.width, height: dRect.height };

      const dLeft = dRect.left - layerRect.left;
      const dTop = dRect.top - layerRect.top;

      const dSticker = createStickerEl(discoId, discoSrc, dDimensions, 0, false);
      setStickerPosition(dSticker, dLeft, dTop);

      if (!reducedMotion && !skipAnimation) {
        dSticker.style.animation = "sticker-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both";
        dSticker.style.animationDelay = (stickerSources.length * 80) + "ms";
        dSticker.addEventListener("animationend", () => {
          dSticker.style.animation = "none";
        }, { once: true });
      }
      stickerLayer.appendChild(dSticker);

      activeStickers.push({
        id: discoId,
        src: discoSrc,
        el: dSticker,
        left: dLeft,
        top: dTop,
        dimensions: dDimensions,
        baseWidth: dDimensions.width,
        baseHeight: dDimensions.height,
        rotation: 0,
        peeled: false,
        attachedTo: 'body',
        relativeLeft: 0
      });
    }
  }

  let lastLayoutWidth = window.innerWidth;
  let lastLayoutHeight = window.innerHeight;
  let resizeMountTimer;

  function onResize() {
    if (dragState) return;

    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;

    if (nextWidth === lastLayoutWidth && nextHeight === lastLayoutHeight) return;
    if (Math.abs(nextWidth - lastLayoutWidth) < 2 && Math.abs(nextHeight - lastLayoutHeight) > 60) return;

    lastLayoutWidth = nextWidth;
    lastLayoutHeight = nextHeight;
    clearTimeout(resizeMountTimer);
    resizeMountTimer = setTimeout(() => {
      loadAllImageMeta(stickerSources).then(metaBySource => {
        mountStickers(metaBySource, true);
      });
    }, 250);
  }

  function randomizeStickerPositions() {
    if (dragState) {
      if (dragState.sticker.el.hasPointerCapture(dragState.pointerId)) {
        try {
          dragState.sticker.el.releasePointerCapture(dragState.pointerId);
        } catch (error) { }
      }
      dragState.sticker.el.classList.remove("dragging");
      dragState = null;
    }

    try {
      localStorage.removeItem(storageKey);
    } catch (error) { }

    loadAllImageMeta(stickerSources).then(metaBySource => {
      mountStickers(metaBySource);
    });
  }

  function onRandomizeKey(event) {
    if (event.key !== "r" && event.key !== "R") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) {
      return;
    }

    event.preventDefault();
    randomizeStickerPositions();
  }

  document.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onRandomizeKey);

  let isScrolling = false;
  function onCarouselScroll() {
    if (!isScrolling) {
      window.requestAnimationFrame(() => {
        activeStickers.forEach(stickerData => {
          if (stickerData.attachedTo === 'carousel' && (!dragState || dragState.sticker !== stickerData)) {
            const newLeft = stickerData.relativeLeft - aboutCarousel.scrollLeft;
            setStickerPosition(stickerData.el, newLeft, stickerData.top);
            stickerData.left = newLeft;

            if (isDynamicRotationSticker(stickerData.src)) {
              const newRotation = calculateDynamicRotation(newLeft, stickerData.dimensions.width);
              stickerData.rotation = newRotation;
              stickerData.el.style.setProperty("--sticker-rotation", newRotation + "deg");
              stickerData.el.style.transform = "rotate(" + newRotation + "deg)";
            }
          }
        });
        isScrolling = false;
      });
      isScrolling = true;
    }
  }

  if (aboutCarousel) {
    aboutCarousel.addEventListener("scroll", onCarouselScroll, { passive: true });
  }

  loadAllImageMeta(stickerSources).then(metaBySource => {
    mountStickers(metaBySource);
  });

  return () => {
    window.removeEventListener("scroll", checkScroll);
    document.removeEventListener("pointerdown", startDrag);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onRandomizeKey);
    if (aboutCarousel) {
      aboutCarousel.removeEventListener("scroll", onCarouselScroll);
    }
    if (countdownInterval) clearInterval(countdownInterval);
  };
}

window.navigate = function (event, path) {
  event.preventDefault();
  event.stopPropagation();
  window.history.pushState(null, null, path);
  route();
};

window.addEventListener("popstate", route);

// Fullscreen Iframe Modal for Pre-Save links
function openIframeModal(url, title = "Pre-Save") {
  let modal = document.getElementById("presave-iframe-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "presave-iframe-modal";
    modal.className = "iframe-modal-overlay";
    modal.innerHTML = `
      <div class="iframe-modal-header">
        <span class="iframe-modal-title" id="iframeModalTitle"></span>
        <div class="iframe-modal-actions">
          <a class="iframe-modal-external-btn" id="iframeModalExternalBtn" target="_blank" rel="noopener noreferrer">Open in Tab ↗</a>
          <button class="iframe-modal-close" id="iframeModalClose" aria-label="Close modal">&times;</button>
        </div>
      </div>
      <div class="iframe-modal-body">
        <div class="iframe-modal-loader" id="iframeModalLoader">
          <div class="loader"></div>
          <span>Loading Pre-Save...</span>
        </div>
        <iframe class="iframe-modal-frame" id="iframeModalFrame" allow="autoplay; clipboard-write; encrypted-media; fullscreen; payment; microphone; camera; storage-access" sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation" frameborder="0"></iframe>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector("#iframeModalClose");
    closeBtn.addEventListener("click", closeIframeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeIframeModal();
    });
  }

  const titleEl = modal.querySelector("#iframeModalTitle");
  const externalBtn = modal.querySelector("#iframeModalExternalBtn");
  const iframe = modal.querySelector("#iframeModalFrame");
  const loader = modal.querySelector("#iframeModalLoader");

  titleEl.textContent = title;
  if (externalBtn) externalBtn.href = url;
  loader.style.display = "flex";
  iframe.style.opacity = "0";

  iframe.onload = () => {
    loader.style.display = "none";
    iframe.style.opacity = "1";
  };

  iframe.src = url;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";

  window.addEventListener("keydown", handleIframeModalEsc);
}

function closeIframeModal() {
  const modal = document.getElementById("presave-iframe-modal");
  if (modal) {
    modal.classList.remove("active");
    const iframe = modal.querySelector("#iframeModalFrame");
    if (iframe) iframe.src = "about:blank";
  }
  document.body.style.overflow = "";
  window.removeEventListener("keydown", handleIframeModalEsc);
}

function handleIframeModalEsc(e) {
  if (e.key === "Escape") {
    closeIframeModal();
  }
}

// Global delegated click handler for iframe modal links
document.addEventListener("click", (e) => {
  const target = e.target.closest("a[data-iframe='true'], a.btn.presave");
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    const url = target.getAttribute("href");
    const title = target.getAttribute("data-title") || target.textContent.trim() || "Pre-Save";
    if (url) {
      openIframeModal(url, title);
    }
  }
});

// Start router
route();
