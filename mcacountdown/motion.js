// Motion shared by the dashboard and the full countdown. Previews stay still.
(() => {
    if (window.self !== window.top || new URLSearchParams(location.search).has('cardmode')) {
        const previewStyle = document.createElement('style');
        previewStyle.textContent = '@view-transition { navigation: none; }';
        document.head.appendChild(previewStyle);
        return;
    }

    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const navigationKey = 'minutehand.motion.navigation';
    const hasPageTransitions = 'onpageswap' in window && 'onpagereveal' in window;
    const animations = new Set();
    let activeTransition = null;
    let updating = false;
    let navigating = false;
    let contentReady = false;
    let pageRevealed = false;
    let arrival = null;
    let revealTimeout;

    function pageFor(href) {
        if (!href) return null;
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return null;
        const name = url.pathname.split('/').pop().replace(/\.html$/, '');
        return name === 'countdowndashboard' ? 'dashboard' : name === 'betatimer' ? 'countdown' : null;
    }

    function direction(from, to) {
        const source = pageFor(from);
        const destination = pageFor(to);
        if (!source || !destination || source === destination) return null;
        return destination === 'countdown' ? 'countdown-open' : 'countdown-close';
    }

    function animate(element, frames, duration, keepUntilNavigation = false) {
        if (!element?.animate || reducedMotion.matches) return Promise.resolve();
        const animation = element.animate(frames, {
            duration,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both'
        });
        animations.add(animation);
        return animation.finished.catch(() => {}).then(() => {
            if (!keepUntilNavigation) {
                animations.delete(animation);
                animation.cancel();
            }
        });
    }

    function stopAnimations() {
        animations.forEach(animation => animation.cancel());
        animations.clear();
        activeTransition?.skipTransition();
    }

    function trackTransition(transition, isNavigation = false) {
        activeTransition = transition;
        if (isNavigation) transition.updateCallbackDone.catch(() => {});
        // Skipping a transition (rapid input, hidden tab, resize) is normal.
        transition.ready.catch(() => {
            if (isNavigation && activeTransition === transition && !document.hidden && !reducedMotion.matches) {
                animate(document.body, [{ opacity: 0.6 }, { opacity: 1 }], 260);
            }
        });
        transition.finished.catch(() => {}).then(() => {
            if (activeTransition !== transition) return;
            activeTransition = null;
            delete root.dataset.motion;
            delete root.dataset.motionWaiting;
        });
    }

    function change(kind, update) {
        // Only guard the DOM update, so another gesture can interrupt the settle.
        if (updating) return;
        stopAnimations();
        if (reducedMotion.matches || document.hidden) {
            update();
            return;
        }
        root.dataset.motion = kind;
        root.style.setProperty('--motion-origin', '50% 50%');
        updating = true;
        const apply = () => {
            try { update(); } finally { updating = false; }
        };
        if (document.startViewTransition) {
            const transition = document.startViewTransition(apply);
            trackTransition(transition);
            return transition.updateCallbackDone;
        }
        // Keep both directions animated on browsers without snapshot transitions.
        return animate(document.body, [{ opacity: 1 }, { opacity: 0.25 }], 100)
            .then(() => {
                apply();
                return animate(document.body, [{ opacity: 0.25 }, { opacity: 1 }], 260);
            }).finally(() => { delete root.dataset.motion; });
    }

    function pageReady() {
        contentReady = true;
        if (!reducedMotion.matches && hasPageTransitions && !pageRevealed && root.hasAttribute('data-motion-arriving')) return;
        clearTimeout(revealTimeout);
        delete root.dataset.motionWaiting;
        if (root.hasAttribute('data-motion-arriving')) {
            delete root.dataset.motionArriving;
            animate(document.body, [{ opacity: 0 }, { opacity: 1 }], 360);
        }
    }

    function navigate(href, source) {
        if (navigating) return;
        const destination = new URL(href, location.href);
        const kind = direction(location.href, destination.href);
        if (!kind || reducedMotion.matches) {
            location.assign(destination.href);
            return;
        }
        navigating = true;
        stopAnimations();
        const rect = source?.getBoundingClientRect();
        const origin = rect
            ? `${((rect.left + rect.width / 2) / innerWidth) * 100}% ${((rect.top + rect.height / 2) / innerHeight) * 100}%`
            : '50% 50%';
        root.style.setProperty('--motion-origin', origin);
        root.dataset.motion = kind;
        try {
            sessionStorage.setItem(navigationKey, JSON.stringify({
                destination: destination.pathname + destination.search,
                kind, origin, time: Date.now()
            }));
        } catch (_) { /* Navigation still works with storage disabled. */ }
        if (hasPageTransitions) {
            location.assign(destination.href);
        } else {
            animate(document.body, [{ opacity: 1 }, { opacity: 0.35 }], 140, true)
                .then(() => location.assign(destination.href));
        }
    }

    try {
        const saved = JSON.parse(sessionStorage.getItem(navigationKey));
        sessionStorage.removeItem(navigationKey);
        if (saved && Date.now() - saved.time < 15000 &&
            saved.destination === location.pathname + location.search) {
            arrival = saved;
            root.style.setProperty('--motion-origin', saved.origin);
            if (!reducedMotion.matches) {
                root.dataset.motionArriving = '';
                revealTimeout = setTimeout(() => {
                    pageRevealed = true;
                    pageReady();
                }, 1500);
            }
        }
    } catch (_) { /* Private browsing can restrict session storage. */ }

    // Registered in the head before the first paint, including back/forward restores.
    window.addEventListener('pageswap', event => {
        if (!event.viewTransition) return;
        event.viewTransition.ready.catch(() => {});
        event.viewTransition.finished.catch(() => {});
        event.viewTransition.updateCallbackDone.catch(() => {});
        const kind = direction(location.href, event.activation?.entry.url);
        if (!kind || reducedMotion.matches) {
            event.viewTransition.skipTransition();
            return;
        }
        root.dataset.motion = kind;
    });

    window.addEventListener('pagereveal', event => {
        pageRevealed = true;
        if (!event.viewTransition) {
            if (contentReady) pageReady();
            return;
        }
        delete root.dataset.motionArriving;
        const kind = direction(window.navigation?.activation?.from?.url, location.href) || arrival?.kind;
        arrival = null;
        if (!kind || reducedMotion.matches) {
            event.viewTransition.ready.catch(() => {});
            event.viewTransition.finished.catch(() => {});
            event.viewTransition.updateCallbackDone.catch(() => {});
            event.viewTransition.skipTransition();
            return;
        }
        root.dataset.motion = kind;
        if (!contentReady) {
            // The incoming snapshot is live: let the clock/cards render before
            // starting the reveal, with a bound for slow or unavailable data.
            root.dataset.motionWaiting = '';
            revealTimeout = setTimeout(pageReady, 1500);
        }
        trackTransition(event.viewTransition, true);
    });

    window.addEventListener('pageshow', event => {
        navigating = false;
        if (event.persisted) {
            animations.forEach(animation => animation.cancel());
            animations.clear();
            delete root.dataset.motionArriving;
            pageReady();
        }
    });

    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey ||
            event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') ||
            (link.target && link.target !== '_self') || !direction(location.href, link.href)) return;
        event.preventDefault();
        navigate(link.href, link.closest('.card') || link);
    });

    const motionPreferenceChanged = () => {
        if (!reducedMotion.matches) return;
        stopAnimations();
        pageReady();
    };
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', motionPreferenceChanged);
    else reducedMotion.addListener(motionPreferenceChanged);

    window.MinutehandMotion = { change, navigate, pageReady };
})();
