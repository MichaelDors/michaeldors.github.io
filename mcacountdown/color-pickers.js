(() => {
    const defaults = ['8426ff', '3ab6ff', '00df52', 'ff9900'];
    const parameters = ['colorone', 'colortwo', 'colorthree', 'colorfour', 'color5', 'color6', 'color7', 'color8'];
    let container;
    let onChange;
    let onInput;
    let disabled = false;
    let draggedItem = null;

    const items = () => container ? Array.from(container.children) : [];
    const values = () => items().map(item => {
        const input = item.querySelector('input');
        return input.dataset.useThemeColor === 'true' ? 'fg' : input.value.slice(1);
    });
    const cssColors = () => values().map(value => value === 'fg' ? 'var(--mainforegroundcolor)' : `#${value}`);

    function refresh() {
        if (!container) return;
        const palette = items();
        const theme = getComputedStyle(document.documentElement).getPropertyValue('--mainforegroundcolor').trim();
        palette.forEach((item, index) => {
            const input = item.querySelector('input');
            const adaptive = input.dataset.useThemeColor === 'true';
            input.id = `color${index + 1}`;
            input.setAttribute('aria-label', `Color ${index + 1}${adaptive ? ', follows the system theme' : ''}`);
            input.disabled = disabled || adaptive;
            input.classList.toggle('disabledcolorpicker', disabled);
            if (adaptive) input.value = theme;
            item.tabIndex = adaptive && !disabled ? 0 : -1;
            item.draggable = !disabled;
            item.setAttribute('aria-label', `Color ${index + 1}${adaptive ? ', follows the system theme' : ''}. Use Alt and an arrow key to reorder.`);
            const remove = item.querySelector('.remove-button');
            remove.hidden = palette.length === 1;
            remove.disabled = disabled || palette.length === 1;
            remove.setAttribute('aria-label', `Remove color ${index + 1}`);
        });
        document.querySelectorAll('.clradd, .clraddfg').forEach(button => {
            button.disabled = disabled || palette.length >= 8;
        });
        const colors = cssColors();
        const root = document.documentElement.style;
        for (let i = 0; i < 8; i++) {
            if (colors[i]) root.setProperty(`--color${i + 1}`, colors[i]);
            else root.removeProperty(`--color${i + 1}`);
        }
        ['--one', '--two', '--three', '--four'].forEach((name, index) => {
            root.setProperty(name, colors[index % colors.length] || `#${defaults[index]}`);
        });
    }

    function commit() {
        refresh();
        onChange?.();
    }

    function createPicker(value) {
        const item = document.createElement('div');
        item.className = 'colorpicker-container';
        item.dataset.adaptive = String(value === 'fg');
        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'colorpicker';
        input.dataset.useThemeColor = String(value === 'fg');
        if (value !== 'fg') input.value = `#${value}`;
        input.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight');
        item.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight');
        if (value === 'fg') item.title = 'This color follows your system theme. Use Alt and an arrow key to reorder.';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-button';
        remove.textContent = '−';
        remove.title = 'Remove this color';
        item.append(input, remove);
        return item;
    }

    function replaceColors(colors) {
        clearDrag();
        container.replaceChildren(...colors.map(createPicker));
        refresh();
    }

    function loadFromSource(readParameter) {
        // Missing slots and legacy "null" values must not leave stale pickers behind.
        const colors = parameters.map(name => readParameter(name)).filter(value => typeof value === 'string')
            .map(value => value.trim().replace(/^#/, '').toLowerCase())
            .filter(value => value === 'fg' || /^[0-9a-f]{6}$/.test(value));
        replaceColors(colors.length ? colors : defaults);
    }

    function add(adaptive = false) {
        if (disabled || items().length >= 8) return;
        const value = adaptive ? 'fg' : Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0');
        const item = createPicker(value);
        container.append(item);
        commit();
        const input = item.querySelector('input');
        (adaptive ? item : input).focus({ preventScroll: true });
        if (!adaptive) input.click();
    }

    function remove(item) {
        if (disabled || item.parentElement !== container || items().length <= 1) return;
        const next = item.nextElementSibling || item.previousElementSibling;
        const restoreFocus = item.contains(document.activeElement);
        item.remove();
        commit();
        if (restoreFocus) {
            (next.dataset.adaptive === 'true' ? next : next.querySelector('input')).focus({ preventScroll: true });
        }
    }

    function move(item, target) {
        const palette = items();
        const from = palette.indexOf(item);
        const to = palette.indexOf(target);
        if (disabled || from < 0 || to < 0 || from === to) return;
        const focused = document.activeElement;
        container.insertBefore(item, from < to ? target.nextElementSibling : target);
        commit();
        if (item.contains(focused)) focused.focus({ preventScroll: true });
    }

    function clearDrag() {
        items().forEach(item => item.classList.remove('dragging', 'drag-over'));
        draggedItem = null;
    }

    function init(options) {
        onChange = options.onChange;
        onInput = options.onInput;
        if (container) return;
        container = document.getElementById('colorPickersContainer');
        container.addEventListener('input', event => {
            if (event.target.matches('input[type="color"]') && !event.target.disabled) {
                refresh();
                onInput?.();
            }
        });
        container.addEventListener('change', event => {
            if (event.target.matches('input[type="color"]') && !event.target.disabled) commit();
        });
        container.addEventListener('click', event => {
            const button = event.target.closest('.remove-button');
            if (button) remove(button.parentElement);
        });
        container.addEventListener('keydown', event => {
            if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            const item = event.target.closest('.colorpicker-container');
            if (!item) return;
            event.preventDefault();
            const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
            move(item, backwards ? item.previousElementSibling : item.nextElementSibling);
        });
        container.addEventListener('dragstart', event => {
            const item = event.target.closest('.colorpicker-container');
            if (disabled || !item || event.target.closest('button')) {
                event.preventDefault();
                return;
            }
            draggedItem = item;
            item.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.querySelector('input').id);
        });
        container.addEventListener('dragover', event => {
            if (!draggedItem) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            const target = event.target.closest('.colorpicker-container');
            items().forEach(item => item.classList.toggle('drag-over', item === target && item !== draggedItem));
        });
        container.addEventListener('dragleave', event => {
            if (!container.contains(event.relatedTarget)) items().forEach(item => item.classList.remove('drag-over'));
        });
        container.addEventListener('drop', event => {
            // Ignore external drags and always reorder whole picker containers.
            if (!draggedItem) return;
            event.preventDefault();
            move(draggedItem, event.target.closest('.colorpicker-container'));
            clearDrag();
        });
        container.addEventListener('dragend', clearDrag);
    }

    window.MinutehandColors = {
        init, loadFromSource, values, cssColors, refresh, add,
        reset: () => replaceColors(defaults),
        setDisabled(value) {
            if (disabled === value) return;
            disabled = value;
            refresh();
        }
    };
})();
