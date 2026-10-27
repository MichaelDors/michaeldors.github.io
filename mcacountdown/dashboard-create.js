// Keep creation choices beside the dashboard's existing plus button.
(() => {
    const button = document.getElementById('newcountdownbutton');
    const menu = document.getElementById('dashboard-create-menu');
    const choices = [...menu.querySelectorAll('a')];
    function close(restoreFocus = false) {
        menu.hidden = true;
        menu.classList.remove('visible', 'animate-open', 'opened');
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) button.focus();
    }
    function open(index = 0) {
        menu.hidden = false;
        menu.classList.add('visible', 'animate-open');
        button.setAttribute('aria-expanded', 'true');
        choices[index].focus();
    }
    menu.addEventListener('animationend', () => {
        menu.classList.remove('animate-open');
        if (!menu.hidden) menu.classList.add('opened');
    });
    button.addEventListener('click', () => menu.hidden ? open() : close(true));
    button.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        open(event.key === 'ArrowUp' ? choices.length - 1 : 0);
    });
    menu.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let index = choices.indexOf(document.activeElement);
        if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = choices.length - 1;
        else index = (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
        choices[index].focus();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
            event.preventDefault();
            close(true);
        }
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('.dashboard-create-control')) close();
    });
    document.addEventListener('focusin', event => {
        if (!event.target.closest('.dashboard-create-control')) close();
    });
})();
