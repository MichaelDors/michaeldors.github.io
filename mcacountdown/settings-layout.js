// One settings navigation for desktop, touch, and keyboard users.
(() => {
    const settingsPane = document.getElementById('settings');
    const sidebar = document.getElementById('settingssidebar');
    const main = document.getElementById('settingsmainpane');
    const toggle = document.getElementById('settings-menu-toggle');
    if (!settingsPane || !sidebar || !main || !toggle) return;

    const mobile = matchMedia('(max-width: 960px)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const close = document.getElementById('close-settings-menu');
    const saveBar = document.getElementById('saveBar');
    const personalOverlay = document.getElementById('personalSettingsOverlay');
    const toolbar = main.querySelector('.settings-mobile-toolbar');
    const currentLabel = document.getElementById('settings-current-section');
    const links = [...sidebar.querySelectorAll('.sidebaranchor')];
    let drawerOpen = false;
    let scrollFrame = 0;
    let personalReturnFocus = null;

    const isOpen = () => !settingsPane.classList.contains('hidden');
    const visible = element => element && element.getClientRects().length > 0;
    const refreshPreview = () => window.updatePreviewIframe?.();

    function syncLayout() {
        const modal = mobile.matches && drawerOpen && isOpen();
        settingsPane.classList.toggle('settings-menu-open', modal);
        toggle.setAttribute('aria-expanded', String(modal));
        sidebar.inert = mobile.matches && !modal;
        main.inert = modal;
        saveBar.inert = modal;
        if (modal) {
            sidebar.setAttribute('role', 'dialog');
            sidebar.setAttribute('aria-modal', 'true');
        } else {
            sidebar.removeAttribute('role');
            sidebar.removeAttribute('aria-modal');
        }
    }

    function closeDrawer(restoreFocus = true) {
        const wasOpen = drawerOpen;
        drawerOpen = false;
        syncLayout();
        if (wasOpen && restoreFocus && mobile.matches && isOpen()) toggle.focus({ preventScroll: true });
        document.getElementById('accountMenu').classList.remove('visible', 'opened', 'animate-open');
        refreshPreview();
    }

    function openDrawer() {
        if (!mobile.matches || !isOpen()) return;
        drawerOpen = true;
        syncLayout();
        requestAnimationFrame(() => {
            if (drawerOpen) close.focus({ preventScroll: true });
        });
        refreshPreview();
    }

    function updateActiveSection() {
        scrollFrame = 0;
        if (!isOpen()) return;
        const visibleLinks = links.filter(link => visible(link) && visible(document.querySelector(link.hash)));
        let current = visibleLinks[0];
        const top = main.getBoundingClientRect().top + toolbar.offsetHeight + 40;
        for (const link of visibleLinks) {
            if (document.querySelector(link.hash).getBoundingClientRect().top <= top) current = link;
        }
        for (const link of links) {
            link.classList.toggle('active', link === current);
            if (link === current) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        }
        if (current) currentLabel.textContent = current.textContent.trim();
    }

    function navigateTo(target) {
        if (!visible(target)) return;
        closeDrawer(false);
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        const top = target.getBoundingClientRect().top - main.getBoundingClientRect().top
            + main.scrollTop - toolbar.offsetHeight - 20;
        main.scrollTo({ top: Math.max(0, top), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
        updateActiveSection();
    }

    function setOpen(opening) {
        document.body.classList.toggle('options-open', opening);
        closeDrawer(false);
        if (opening) {
            main.scrollTop = 0;
            sidebar.scrollTop = 0;
            updateActiveSection();
        }
    }

    toggle.addEventListener('click', openDrawer);
    close.addEventListener('click', () => closeDrawer());
    document.getElementById('settings-menu-backdrop').addEventListener('click', () => closeDrawer());
    links.forEach(link => link.addEventListener('click', event => {
        const target = document.querySelector(link.hash);
        if (!target) return;
        event.preventDefault();
        navigateTo(target);
    }));
    main.addEventListener('scroll', () => {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateActiveSection);
    }, { passive: true });

    mobile.addEventListener('change', () => {
        const focused = document.activeElement;
        const wasInSidebar = sidebar.contains(focused);
        closeDrawer(false);
        if (isOpen()) {
            if (mobile.matches && wasInSidebar) toggle.focus({ preventScroll: true });
            else if (!mobile.matches && toolbar.contains(focused)) document.getElementById('close-options').focus({ preventScroll: true });
            updateActiveSection();
        }
    });

    document.addEventListener('keydown', event => {
        if (personalOverlay.style.display === 'flex' && event.key === 'Tab') {
            const controls = [...personalOverlay.querySelectorAll('button, a[href], input, [tabindex="0"]')]
                .filter(element => visible(element) && !element.disabled && getComputedStyle(element).visibility !== 'hidden');
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
            return;
        }
        if (!drawerOpen || !mobile.matches) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeDrawer();
        } else if (event.key === 'Tab') {
            const focusable = [...sidebar.querySelectorAll('button, a[href], input, [tabindex="0"]')]
                .filter(element => visible(element) && !element.disabled && getComputedStyle(element).visibility !== 'hidden');
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
                event.preventDefault();
                first?.focus();
            }
        }
    }, true);

    window.MinutehandSettings = {
        setOpen,
        closeDrawer,
        navigateTo,
        isPreviewVisible: () => isOpen() && (!mobile.matches || drawerOpen),
        beforePersonalSettings() {
            personalReturnFocus = drawerOpen ? toggle : document.activeElement;
            closeDrawer(false);
            settingsPane.inert = true;
        },
        afterPersonalSettings() {
            settingsPane.inert = false;
            if (visible(personalReturnFocus)) personalReturnFocus.focus({ preventScroll: true });
        }
    };
    syncLayout();
})();

// Fit the actual countdown text, including wide typefaces and labeled units.
(() => {
    if (new URLSearchParams(location.search).has('cardmode')) return;
    const clock = document.getElementById('clock');
    if (!clock) return;
    const range = document.createRange();
    let measuredKey = '';
    let measuredSize = 75;
    function fitCountdown() {
        if (!clock.isConnected || clock.style.display === 'none') return;
        const preferred = Number(clock.dataset.preferredSize) || 75;
        const requested = parseFloat(clock.style.fontSize) || preferred;
        // The renderer supplies a fresh preferred size each tick; resize uses that last size.
        if (clock.style.fontSize !== clock.dataset.fittedSize) clock.dataset.preferredSize = requested;
        const size = Number(clock.dataset.preferredSize) || requested;
        const available = Math.max(1, document.documentElement.clientWidth - 40);
        const key = [clock.textContent, size, available, document.documentElement.style.getPropertyValue('--typeface')].join('|');
        if (key !== measuredKey) {
            clock.style.fontSize = `${size}px`;
            range.selectNodeContents(clock);
            const textWidth = range.getBoundingClientRect().width;
            measuredSize = textWidth > available ? size * available / textWidth : size;
            measuredKey = key;
        }
        clock.style.fontSize = `${measuredSize}px`;
        clock.dataset.fittedSize = clock.style.fontSize;
        document.documentElement.style.setProperty('--countdown-font-size', `${measuredSize}px`);
    }
    window.MinutehandLayout = { fitCountdown };
    window.addEventListener('resize', fitCountdown, { passive: true });
    document.fonts?.ready.then(() => { measuredKey = ''; fitCountdown(); });
})();
