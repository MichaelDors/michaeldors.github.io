(function () {
  function initSongDetailsDemo(root) {
    if (!root || root.dataset.songDetailsReady === "true") return;

    var clickTrackBtn = root.querySelector("[data-click-track]");
    var modalVinyl = root.querySelector("[data-vinyl]");

    if (!clickTrackBtn || !modalVinyl) return;

    root.dataset.songDetailsReady = "true";

    var isPlaying = false;

    function updateClickTrackUI() {
      if (isPlaying) {
        clickTrackBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Stop';
        clickTrackBtn.classList.add("active");
        modalVinyl.classList.add("is-spinning");
        modalVinyl.classList.remove("is-paused");
      } else {
        clickTrackBtn.innerHTML = '<i class="fa-solid fa-play"></i> Click';
        clickTrackBtn.classList.remove("active");
        if (modalVinyl.classList.contains("is-spinning")) {
          modalVinyl.classList.add("is-paused");
        } else {
          modalVinyl.classList.remove("is-paused");
        }
      }

      const albumArtContainer = document.getElementById("song-album-art-placeholder");
      if (albumArtContainer && window.matchMedia("(hover: hover)").matches) {
        setupAlbumArtTilt(albumArtContainer);
      }
    }


    function setupAlbumArtTilt(container) {
      if (!container || container.dataset.albumArtTiltBound === "1") return;
      container.dataset.albumArtTiltBound = "1";
      let rafId = null;
      container.addEventListener("mousemove", function (e) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function () {
          const rect = container.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = (y - centerY) / centerY * -12;
          const rotateY = (x - centerX) / centerX * 12;
          container.style.transform =
            "perspective(1000px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg) scale3d(1.08, 1.08, 1.08)";
        });
      });
      container.addEventListener("mouseleave", function () {
        if (rafId) cancelAnimationFrame(rafId);
        container.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)";
      });
    }

    function stopClickTrack() {
      isPlaying = false;
      updateClickTrackUI();
    }

    function toggleClickTrack() {
      isPlaying = !isPlaying;
      updateClickTrackUI();
    }

    clickTrackBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleClickTrack();
    });

    root.addEventListener("pointerleave", stopClickTrack);
    updateClickTrackUI();
  }

  function initAllSongDetailsDemos() {
    var demos = document.querySelectorAll("[data-song-details-demo]");
    var i;
    for (i = 0; i < demos.length; i++) {
      initSongDetailsDemo(demos[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllSongDetailsDemos);
  } else {
    initAllSongDetailsDemos();
  }

  window.initSongDetailsDemo = initSongDetailsDemo;
})();
