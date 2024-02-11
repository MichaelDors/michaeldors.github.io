
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
    }, 500)
}

document.addEventListener('DOMContentLoaded', function(event) {
    document.querySelector('body').style.opacity = 1;
})

//window.addEventListener('scroll', e => {
//    if (window.scrollY > 500) {
//        document.getElementById("body").classList.add("scrollsnap");
//    }
//    else {
//        document.getElementById("body").classList.remove("scrollsnap");
//    }
//});



function filters() {
    var filterBar = document.getElementById("filterbar");
    var filterTags = document.getElementById("filtertags");
    var sortTags = document.getElementById("sorttags");

    if(filterbar.classList.contains("openfilterbar") && filterTags.style.display !== "none"){
        filterBar.classList.remove("openfilterbar");
        filterTags.style.opacity = "0";
        sortTags.style.opacity = "0";
        setTimeout(function () {
            document.getElementById("sorttags").style.display = "none";
            document.getElementById("filtertags").style.display = "none";
        }, 150);
    }
    else{
        document.getElementById("filterbar").classList.add("openfilterbar");

        document.getElementById("sorttags").style.opacity = "0";
        document.getElementById("filtertags").style.opacity = "1";
        setTimeout(function () {
            document.getElementById("filtertags").style.display = "";
            document.getElementById("sorttags").style.display = "none";
        }, 200);
    }
}



function sorts(){
    if(document.getElementById("filterbar").classList.contains("openfilterbar") && document.getElementById("sorttags").style.display !== "none"){
        document.getElementById("filterbar").classList.remove("openfilterbar");

        document.getElementById("sorttags").style.opacity = "0";
        document.getElementById("filtertags").style.opacity = "0";
        setTimeout(function () {
            document.getElementById("sorttags").style.display = "none";
            document.getElementById("filtertags").style.display = "none";
        }, 150);
    }
    else{
        document.getElementById("filterbar").classList.add("openfilterbar");

        document.getElementById("sorttags").style.opacity = "1";
        document.getElementById("filtertags").style.opacity = "0";
        setTimeout(function () {
            document.getElementById("sorttags").style.display = "";
            document.getElementById("filtertags").style.display = "none";
        }, 200);
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
