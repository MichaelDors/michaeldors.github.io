const moveElements = (e) => {
    const tracker = document.querySelector(".tracker");

    tracker.style.top = `${e.clientY}px`;
    tracker.style.left = `${e.clientX}px`;

    if (window.scrollY > 500 && window.scrollY < 1500) {
        tracker.style.opacity = 1;
    }
    else {
        tracker.style.opacity=0;
    }
};

document.addEventListener("mousemove", moveElements);

