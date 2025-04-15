
if(window.location.href.indexOf("index") > -1){
    document.getElementById("mobilehome").classList.add("navbuttonfilled");
}
else if(window.location.href.indexOf("about") > -1){
    document.getElementById("mobileabout").classList.add("navbuttonfilled");
}
else if(window.location.href.indexOf("projects") > -1){
    document.getElementById("mobileprojects").classList.add("navbuttonfilled");
}
else{
    document.getElementById("mobilehome").classList.add("navbuttonfilled");
}

function openmenu() {
    if (document.getElementById("navigation").classList.contains("opennav")){
        document.getElementById("navigation").classList.remove("opennav");
        document.getElementById("toggler").classList.remove("fa-x");
        document.getElementById("toggler").classList.add("fa-bars");
        document.getElementById("mobileopennav").style.display = 'none';
        document.getElementById("mobilehome").classList.remove("fadein");
        document.getElementById("mobileprojects").classList.remove("fadein");
        document.getElementById("mobileabout").classList.remove("fadein");
        document.getElementById("mobilecontact").classList.remove("fadein");
    }
    else {
        document.getElementById("navigation").classList.add("opennav");
        document.getElementById("toggler").classList.remove("fa-bars");
        document.getElementById("toggler").classList.add("fa-x");
        document.getElementById("mobileopennav").style.display = 'grid';
        document.getElementById("mobilehome").classList.add("fadein");
        document.getElementById("mobileprojects").classList.add("fadein");
        document.getElementById("mobileabout").classList.add("fadein");
        document.getElementById("mobilecontact").classList.add("fadein");
    }
}

window.transitionToPage = function(href) {
    document.querySelector('body').style.opacity = 0;
    setTimeout(function() { 
        window.location.href = href;
    }, 600)
}

if (document.readyState !== 'loading') {
    document.querySelector('body').style.opacity = 1;
} else {
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelector('body').style.opacity = 1;
    });
}


//window.addEventListener('scroll', e => {
//    if (window.scrollY > 500) {
//        document.getElementById("body").classList.add("scrollsnap");
//    }
//    else {
//        document.getElementById("body").classList.remove("scrollsnap");
//    }
//});



function togglefilters() {
    var filterBar = document.getElementById("filterbar");
    var filterTags = document.getElementById("filtertags");
    var sortTags = document.getElementById("sorttags");

    if(filterBar.classList.contains("openfilterbar") && filterTags.style.display !== "none"){

        setTimeout(function () {
            sortTags.style.display = "none";
            filterTags.style.display = "none";
            filterBar.classList.remove("openfilterbar");
        }, 200);

        setTimeout(function () {
            filterTags.style.opacity = "0";
            sortTags.style.opacity = "0";
        }, 100);
    }
    else{
        filterBar.classList.add("openfilterbar");

        setTimeout(function () {
            sortTags.style.display = "none";
            filterTags.style.display = "";
        }, 300);

        setTimeout(function () {
            sortTags.style.opacity = "0";
            filterTags.style.opacity = "1";
        }, 400);
    }
}


function nextproject(){
    window.scrollBy({
        top: document.querySelector(".projectarea").offsetHeight,
        left: 0,
        behavior : "smooth"
    })
}

function sorts(){
    var filterBar = document.getElementById("filterbar");
    var filterTags = document.getElementById("filtertags");
    var sortTags = document.getElementById("sorttags");
    if(filterBar.classList.contains("openfilterbar") && sortTags.style.display !== "none"){

        setTimeout(function () {
            sortTags.style.display = "none";
            filterTags.style.display = "none";
            filterBar.classList.remove("openfilterbar");
        }, 200);

        setTimeout(function () {
            sortTags.style.opacity = "0";
            filterTags.style.opacity = "0";
        }, 100);
    }
    else{
        filterBar.classList.add("openfilterbar");

        setTimeout(function () {
            sortTags.style.display = "";
            filterTags.style.display = "none";
        }, 300);

        setTimeout(function () {
            sortTags.style.opacity = "1";
            filterTags.style.opacity = "0";
        }, 400);
    }
}

function filter(type) {
    document.getElementById("filteranim").opacity = "1";
    document.getElementById("projectcontainer").style.display = "none";
    document.getElementById("filterbar").classList.remove("openfilterbar");
    document.getElementById("sorttags").style.display = "none";
    document.getElementById("filtertags").style.display = "none";
    document.getElementById("filteringcontainer").style.display = "";
    var allElements = document.querySelectorAll('.projectarea');

    if (type.toLowerCase() === "all") {
        allElements.forEach(function (element) {
            element.style.display = "";
        });
    }
    else {
        allElements.forEach(function (element) {
            if (element.getAttribute('data-projecttype') !== type.toLowerCase()) {
                element.style.display = "none";
            }
            else {
                element.style.display = "";
            }
        });
    }


        AOS.init();
        setTimeout(function () {
            document.getElementById("projectcontainer").style.display = "";
            document.getElementById("filteranim").opacity = "0";
            document.getElementById("filteringcontainer").style.display = "none";
        }, 2000);
        window.scrollTo(0, 0);
}



// Move this code inside a function that runs when the DOM is ready
function initCardAnimations() {
    const cards = document.querySelectorAll('.headerimgcontainer');
    
    if (cards.length === 0) {
        console.log('No card elements found with class .headerimgcontainer');
        return;
    }

    cards.forEach(card => {
        // Use requestAnimationFrame for smoother animations
        let rafId = null;
        
        card.addEventListener("mousemove", (e) => {
            // Cancel any pending animation frame
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            
            rafId = requestAnimationFrame(() => {
                const { left, top, width, height } = card.getBoundingClientRect();
                const x = (e.clientX - left) / width - 0.7; // Range: -0.5 to 0.5
                const y = (e.clientY - top) / height - 0.7; // Range: -0.5 to 0.5

                const rotateX = y * -50; // Invert Y-axis for natural feel
                const rotateY = x * 50;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
                rafId = null;
            });
        });

        card.addEventListener("mouseleave", () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            card.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale(1)";
        });
    });
}


// Run the animation initialization when the DOM is ready
if (document.readyState !== 'loading') {
    if (!window.matchMedia("(max-width: 767px)").matches) {
    initCardAnimations();
    }
} else {
    if (!window.matchMedia("(max-width: 767px)").matches) {
    document.addEventListener('DOMContentLoaded', initCardAnimations);
    }
}