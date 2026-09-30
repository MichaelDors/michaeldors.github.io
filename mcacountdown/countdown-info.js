// Owner-written details are stored separately from the countdown's timer settings.
(() => {
    const form = document.getElementById('countdown-info-form');
    if (!form) return;

    const fields = {
        description: document.getElementById('countdown-info-description'),
        url: document.getElementById('countdown-info-url'),
        address: document.getElementById('countdown-info-address')
    };
    const fieldset = document.getElementById('countdown-info-fields');
    const saveButton = document.getElementById('countdown-info-save');
    const status = document.getElementById('countdown-info-status');
    const retry = document.getElementById('countdown-info-retry');
    const viewer = document.getElementById('countdown-owner-info');
    const unavailable = document.getElementById('countdown-info-unavailable');
    const emptyInfo = () => ({ description: '', url: '', address: '' });
    let countdownId = null;
    let ownerId = null;
    let editable = false;
    let loaded = false;
    let saving = false;
    let dirty = false;
    let requestVersion = 0;
    let saved = emptyInfo();

    function normalizeInfo(info) {
        return Object.fromEntries(Object.keys(fields).map(key => [key, typeof info?.[key] === 'string' ? info[key] : '']));
    }

    function websiteURL(value, allowBareDomain = false) {
        let input = value.trim();
        if (!input) return '';
        if (allowBareDomain && !/^[a-z][a-z\d+.-]*:/i.test(input)) input = `https://${input}`;
        try {
            const url = new URL(input);
            if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password || /\s/.test(input)) return null;
            return url.href;
        } catch {
            return null;
        }
    }

    function setStatus(message, error = false) {
        status.textContent = message;
        status.classList.toggle('info-save-error', error);
    }

    function updateControls() {
        fieldset.disabled = !editable || !loaded || saving;
        saveButton.disabled = fieldset.disabled || !dirty;
        saveButton.textContent = saving ? 'Saving…' : 'Save information';
    }

    function fillForm(info) {
        for (const [key, field] of Object.entries(fields)) field.value = info[key];
        fields.url.setCustomValidity('');
        dirty = false;
    }

    function render(info) {
        const description = document.getElementById('owner-info-description');
        const urlRow = document.getElementById('owner-info-url-row');
        const link = document.getElementById('owner-info-url');
        const addressRow = document.getElementById('owner-info-address-row');
        const address = document.getElementById('owner-info-address');
        description.textContent = info.description;
        description.hidden = !info.description.trim();
        const url = websiteURL(info.url);
        urlRow.hidden = !url;
        link.removeAttribute('href');
        link.textContent = '';
        if (url) {
            link.href = url;
            link.textContent = url;
        }
        address.textContent = info.address;
        addressRow.hidden = !info.address.trim();
        viewer.hidden = description.hidden && urlRow.hidden && addressRow.hidden;
    }

    async function load() {
        const version = ++requestVersion;
        const id = window.CountdownDataID;
        const previousId = countdownId;
        const previousOwner = ownerId;
        countdownId = id || null;
        editable = false;
        loaded = false;
        saving = false;
        retry.hidden = true;
        unavailable.hidden = true;
        updateControls();

        if (!id || new URLSearchParams(location.search).has('cardmode')) {
            saved = emptyInfo();
            fillForm(saved);
            render(saved);
            setStatus('Sign in and save this countdown to add information for viewers.');
            return;
        }

        setStatus('Loading information…');
        try {
            const [infoResult, sessionResult, countdownResult] = await Promise.all([
                window.supabaseClient.from('countdown_info').select('description, url, address').eq('countdown_id', id).maybeSingle(),
                window.supabaseClient.auth.getSession(),
                window.CountdownUserData?.countdown
                    ? Promise.resolve({ data: window.CountdownUserData.countdown })
                    : window.supabaseClient.from('countdown').select('creator').eq('id', id).maybeSingle()
            ]);
            if (version !== requestVersion) return;
            if (infoResult.error || countdownResult.error) throw infoResult.error || countdownResult.error;
            ownerId = sessionResult.error ? null : sessionResult.data?.session?.user?.id;
            editable = !!ownerId && countdownResult.data?.creator === ownerId;
            saved = normalizeInfo(infoResult.data);
            loaded = true;
            // An auth refresh must not discard a draft from the same owner.
            if (!dirty || previousId !== id || previousOwner !== ownerId || !editable) fillForm(saved);
            render(saved);
            setStatus(editable ? (dirty ? 'You have unsaved information.' : 'Only the owner can edit these details.') : 'Only the countdown owner can edit these details.');
        } catch (error) {
            if (version !== requestVersion) return;
            render(emptyInfo());
            unavailable.hidden = false;
            retry.hidden = false;
            setStatus('Could not load information. Try again before editing.', true);
            console.warn('[countdown-info] Could not load information:', error.message);
        } finally {
            if (version === requestVersion) updateControls();
        }
    }

    async function save(event) {
        event.preventDefault();
        if (!editable || !loaded || saving || !dirty || document.body.classList.contains('viewer-preview')) return;
        const url = websiteURL(fields.url.value, true);
        fields.url.setCustomValidity(url === null ? 'Enter a valid http:// or https:// website URL without a username or password.' : '');
        if (!form.reportValidity()) return;
        const payload = {
            countdown_id: countdownId,
            description: fields.description.value.trim(),
            url,
            address: fields.address.value.trim()
        };
        // URL normalization can increase the length of a bare domain.
        if (payload.url.length > fields.url.maxLength) {
            fields.url.setCustomValidity('Use a website URL of 2,048 characters or fewer.');
            fields.url.reportValidity();
            return;
        }
        const version = requestVersion;
        saving = true;
        updateControls();
        setStatus('Saving information…');
        try {
            const { data, error } = await window.supabaseClient.from('countdown_info')
                .upsert(payload, { onConflict: 'countdown_id' })
                .select('description, url, address').single();
            if (version !== requestVersion) return;
            if (error || !data) throw error || new Error('No saved information returned');
            saved = normalizeInfo(data);
            fillForm(saved);
            render(saved);
            setStatus('Information saved. Viewers can now see your changes.');
        } catch (error) {
            if (version !== requestVersion) return;
            setStatus('Could not save information. Your changes are still here—try again.', true);
            console.warn('[countdown-info] Could not save information:', error.message);
        } finally {
            if (version === requestVersion) {
                saving = false;
                updateControls();
            }
        }
    }

    form.addEventListener('submit', save);
    form.addEventListener('input', () => {
        fields.url.setCustomValidity('');
        dirty = Object.entries(fields).some(([key, field]) => field.value !== saved[key]);
        setStatus(dirty ? 'You have unsaved information.' : 'Only the owner can edit these details.');
        updateControls();
    });
    retry.addEventListener('click', load);
    document.getElementById('countdown-info-viewer-retry').addEventListener('click', load);
    window.addEventListener('beforeunload', event => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = '';
    });
    window.MinutehandInfo = { load };
})();
