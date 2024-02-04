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

//window.addEventListener('scroll', e => {
//    if (window.scrollY > 500) {
//        document.getElementById("body").classList.add("scrollsnap");
//    }
//    else {
//        document.getElementById("body").classList.remove("scrollsnap");
//    }
//});
