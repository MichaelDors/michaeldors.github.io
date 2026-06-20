(function () {
  var CONTACT_MAILTO =
    "mailto:contact@michaeldors.com?subject=Hello%20from%20michaeldors.com";
  var BRAND_TINT_MATCH_THRESHOLD = 42;
  var colorProbe = null;

  function getColorProbe() {
    if (!colorProbe) {
      colorProbe = document.createElement("div");
      colorProbe.style.display = "none";
      document.body.appendChild(colorProbe);
    }
    return colorProbe;
  }

  function readCssColor(varName) {
    var probe = getColorProbe();
    probe.style.backgroundColor = "var(" + varName + ")";
    var computed = getComputedStyle(probe).backgroundColor;
    return parseRgb(computed) || { r: 4, g: 11, b: 9 };
  }

  function parseRgb(computed) {
    var match = computed && computed.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    var parts = match[1].split(",").map(function (part) {
      return parseFloat(part.trim());
    });
    if (parts.length < 3) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function colorDistance(a, b) {
    return Math.sqrt(
      Math.pow(a.r - b.r, 2) +
        Math.pow(a.g - b.g, 2) +
        Math.pow(a.b - b.b, 2)
    );
  }

  function isBrandHeaderTint(tint) {
    if (!tint) return false;
    var brand = readCssColor("--brand-color");
    var bg = readCssColor("--bg");
    var distToBrand = colorDistance(tint, brand);
    if (distToBrand > BRAND_TINT_MATCH_THRESHOLD) return false;
    return distToBrand < colorDistance(tint, bg);
  }

  function readCurrentHeaderTint() {
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--header-blur-tint")
      .trim();
    if (!raw) return readCssColor("--bg");
    var parts = raw.split(",").map(function (part) {
      return parseFloat(part.trim());
    });
    if (parts.length < 3 || parts.some(function (n) { return Number.isNaN(n); })) {
      return readCssColor("--bg");
    }
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function luminance(color) {
    function channel(value) {
      var v = value / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return (
      0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b)
    );
  }

  function updateHeaderNavTint(tint) {
    var header = document.querySelector(".top-header");
    if (!header) return;

    header.classList.toggle("is-brand-tint", isBrandHeaderTint(tint));

    var lightBackground = header.classList.contains("is-menu-open")
      ? window.matchMedia("(prefers-color-scheme: light)").matches
      : luminance(tint) >= 0.42;
    header.classList.toggle("is-chrome-on-light", lightBackground);
    header.classList.toggle("is-chrome-on-dark", !lightBackground);

    var logo = header.querySelector(".site-logo");
    if (logo) {
      logo.classList.toggle("logo-on-light", lightBackground);
      logo.classList.toggle("logo-on-dark", !lightBackground);
    }
  }

  function syncNavTintFromHeaderCss() {
    updateHeaderNavTint(readCurrentHeaderTint());
  }

  function isHomePage() {
    return Boolean(document.getElementById("heroSection"));
  }

  function setMobileMenuState(menu, open) {
    if (!menu) return;
    menu.removeAttribute("hidden");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    menu.inert = !open;
  }

  function closeMobileMenu(header) {
    if (!header) return;
    header.classList.remove("is-menu-open");
    var toggle = header.querySelector(".header-menu-toggle");
    var menu = header.querySelector(".header-mobile-menu");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }
    setMobileMenuState(menu, false);
    syncNavTintFromHeaderCss();
  }

  function openMobileMenu(header) {
    header.classList.add("is-menu-open");
    var toggle = header.querySelector(".header-menu-toggle");
    var menu = header.querySelector(".header-mobile-menu");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    }
    setMobileMenuState(menu, true);
    syncNavTintFromHeaderCss();
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markActiveNavLink(header) {
    var path = window.location.pathname.split("/").pop() || "index.html";
    var links = header.querySelectorAll(".header-nav-link[data-nav-page]");
    links.forEach(function (link) {
      var page = link.getAttribute("data-nav-page");
      var active =
        (page === "home" && isHomePage()) ||
        (page === "about" && path === "about.html") ||
        (page === "projects" && path === "projects.html");
      link.classList.toggle("is-active", active);
    });
  }

  function bindHomeNavigation(link, onHome, homeHref) {
    link.href = onHome ? "#" : homeHref;
    link.addEventListener("click", function (event) {
      if (!onHome) return;
      event.preventDefault();
      scrollToTop();
      closeMobileMenu(link.closest(".top-header"));
    });
  }

  function initSiteHeader() {
    var header = document.querySelector(".top-header");
    if (!header) return;

    var onHome = isHomePage();
    var homeHref = document.body.getAttribute("data-home-href") || "index.html";
    var logoLink = header.querySelector(".header-logo-link");
    var homeLinks = header.querySelectorAll("[data-nav-home]");
    var toggle = header.querySelector(".header-menu-toggle");
    var menu = header.querySelector(".header-mobile-menu");

    if (logoLink) {
      bindHomeNavigation(logoLink, onHome, homeHref);
    }

    homeLinks.forEach(function (link) {
      bindHomeNavigation(link, onHome, homeHref);
    });

    if (toggle && menu) {
      setMobileMenuState(menu, false);

      toggle.addEventListener("click", function () {
        if (header.classList.contains("is-menu-open")) {
          closeMobileMenu(header);
        } else {
          openMobileMenu(header);
        }
      });

      document.addEventListener("click", function (event) {
        if (!header.classList.contains("is-menu-open")) return;
        if (header.contains(event.target)) return;
        closeMobileMenu(header);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeMobileMenu(header);
      });

      menu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          closeMobileMenu(header);
        });
      });
    }

    markActiveNavLink(header);
    syncNavTintFromHeaderCss();
    requestAnimationFrame(syncNavTintFromHeaderCss);

    var colorScheme = window.matchMedia("(prefers-color-scheme: light)");
    function onColorSchemeChange() {
      syncNavTintFromHeaderCss();
    }
    if (typeof colorScheme.addEventListener === "function") {
      colorScheme.addEventListener("change", onColorSchemeChange);
    } else if (typeof colorScheme.addListener === "function") {
      colorScheme.addListener(onColorSchemeChange);
    }
  }

  window.initSiteHeader = initSiteHeader;
  window.syncNavTintFromHeaderCss = syncNavTintFromHeaderCss;
  window.updateHeaderNavTint = updateHeaderNavTint;
  window.MD_CONTACT_MAILTO = CONTACT_MAILTO;

  document.addEventListener("DOMContentLoaded", initSiteHeader);
})();
