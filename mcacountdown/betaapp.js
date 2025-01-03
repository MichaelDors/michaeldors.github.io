	//So pretty much there was a weird bug where CSS zoom works differently from Chrome VS Safari, so I needed to target each one seperately. Safari would scale each item to 75% as if someone used the browser zoom buttons. Chrome would scale the whole page, only using 75% of the space, leaving a border.

	if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
  // If user is using Safari
  const style = document.createElement('style');
  style.innerHTML = `
    @media only screen and (max-width: 1290px) and (orientation:portrait) {
       body {
          zoom: 75%;
       }
    }
  `;
  document.head.appendChild(style);
}

	
window.onload = function() {
    const cookiebanner = document.getElementById('cookie-banner');
    const cookiebannerimage = document.getElementById('cookiebannerimg');
    // Use setTimeout to ensure the banner is fully rendered
    setTimeout(() => {
        const cookiebannerHeight = cookiebanner.offsetHeight;
        cookiebannerimage.style.height = `${cookiebannerHeight}px`;
        cookiebannerimage.style.display = 'block'; // Show the image after setting the height
    }, 1); // Adjust the timeout duration if necessary
    setTimeout(() => {
        const cookiebannerHeight = cookiebanner.offsetHeight;
        cookiebannerimage.style.height = `${cookiebannerHeight}px`;
    }, 3); // Adjust the timeout duration if necessary
    setTimeout(() => {
        const cookiebannerHeight = cookiebanner.offsetHeight;
        cookiebannerimage.style.height = `${cookiebannerHeight}px`;
    }, 5); // Adjust the timeout duration if necessary
    setTimeout(() => {
        const cookiebannerHeight = cookiebanner.offsetHeight;
        cookiebannerimage.style.height = `${cookiebannerHeight}px`;
    }, 10); // Adjust the timeout duration if necessary
    setTimeout(() => {
        const cookiebannerHeight = cookiebanner.offsetHeight;
        cookiebannerimage.style.height = `${cookiebannerHeight}px`;
    }, 20); // Adjust the timeout duration if necessary
    setTimeout(() => {
        const cookiebannerHeight = cookiebanner.offsetHeight;
        cookiebannerimage.style.height = `${cookiebannerHeight}px`;
    }, 50); // Adjust the timeout duration if necessary
    setTimeout(() => {
        const cookiebannerHeight = cookiebanner.offsetHeight;
        cookiebannerimage.style.height = `${cookiebannerHeight}px`;
    }, 100); // Adjust the timeout duration if necessary

    /*
    basically, after 1 ms we adjust the height of the image to match the height of the banner
    then we show the image and repeat at 3ms to account for if the banner changed size (due to the image)
    and so on until 1s. This is to ensure the image is the same size as the banner even if the first
    couple iterations mess with the text wrapping and cange the size of the banner
    */
    
};


        document.addEventListener("DOMContentLoaded", function () {
        var cookieBanner = document.getElementById("cookie-banner");
        var acceptButton = document.getElementById("accept-cookies");

        if (!getCookie("cookiesAccepted")) {
            cookieBanner.style.display = "";
        }
        else{
            cookieBanner.style.display = "none";
        }

        acceptButton.addEventListener("click", function () {
            setCookie("cookiesAccepted", "True", "70")
            cookieBanner.style.display = "none";
            location.reload();
        });
    });

    //onload url parameter translation into the correlating customization settings
               //confetti
                var confettiType = "none"; //declaring confettitype to none at the very beginning so it's able to be changed anywhere
    if(parameter("confettitype")){
        confettiType = decodeURIComponent(parameter("confettitype")); //if the confetti type exists, set it
    }
    else{
        confettiType = "1";
    }

if(parameter('progress')){
	document.getElementByID("progress-bar").style.display = "";
}

    //backgrounds
    var bgstring = "none"; //declaring bgstring to none at the very beginning so it's able to be changed anywhere
    if (parameter('atc')) {
        bgstring = parameter('atc'); //if there is an animated text countdown background, set that to bg string
    }
    else {
        bgstring = "none"; //hypothetically not necessary since that's already the value but there just in case
    }

	if(parameter('endingsound')){
		document.getElementById("audioLink").value = atob(parameter('endingsound'));
	}

	
    document.body.scrollTop = document.documentElement.scrollTop = 0; //sometimes browsers are weird and you start already scrolled down a little

    //text colors
    var css = document.querySelector(':root'); //easily allowing JS to reference CSS variables
    if (parameter('colorone')) { 
        if (parameter('colorone') == "null") {
            console.log("Colors(1) could not be imported properly."); //helps debug
        }
        else {
            var coloronetouse = '#' + parameter('colorone'); //in the param, the hex code is stored without the #, this is adding it back
            document.getElementById("color1").value = coloronetouse; //sets the color picker in settings to the corresponding color
            css.style.setProperty('--one', coloronetouse); //sets the CSS variable to the corresponding color
        }

    }
    if (parameter('colortwo')) { //see colorone for docs
        if (parameter('colortwo') == "null") {
            console.log("Colors(2) could not be imported properly.");
        }
        else {
            var colortwotouse = '#' + parameter('colortwo');
            document.getElementById("color2").value = colortwotouse;
            css.style.setProperty('--two', colortwotouse);
        }
    }
    if (parameter('colorthree')) { //see colorone for docs
        if (parameter('colorthree') == "null") {
            console.log("Colors(3) could not be imported properly.");
        }
        else {
            var colorthreetouse = '#' + parameter('colorthree');
            document.getElementById("color3").value = colorthreetouse;
            css.style.setProperty('--three', colorthreetouse);
        }
    }
    if (parameter('colorfour')) { //see colorone for docs
        if (parameter('colorfour') == "null") {
            console.log("Colors(4) could not be imported properly.");
        }
        else {
            var colorfourtouse = '#' + parameter('colorfour');
            document.getElementById("color4").value = colorfourtouse;
            css.style.setProperty('--four', colorfourtouse);
        }
    }

    //set up countdown schedules
    if(parameter("schedule") !== "null" && parameter("schedule")){  
        document.getElementById("clock").style.display = "none"; //hide clock
        document.getElementById("countdowntitle").style.display = "none"; //hide title
	document.getElementById("optionsdatecontainer").style.display = "none"; //hide end date area of options
	document.getElementById("optionsendingcontainer").style.display = "none"; //hide ending options area of options	
	document.getElementById("optionsendinganchor").style.opacity = "0.5"; //grey out ending options anchor 	
	document.getElementById("optionsprogresscontainer").style.display = "none"; //hide ending options area of options
	document.getElementById("optionsprogressanchor").style.opacity = "0.5"; //grey out progress options anchor	
	document.getElementById("cdscheduledisclaimer").style.display = ""; //show personal options schedule disclaimer
        document.getElementById("schedule").style.display = ""; //show schedule
	document.querySelector(".schedule-editor").style.display = ""; //show editor
	document.getElementById("presetupScheduleContent").style.display = "none"; //hide the info preconversion popup

        if(!parameter("date")){
            document.getElementById("autopilotpopup").remove(); //removes the Autopilot popup if a schedule exists
            document.getElementById("autopilotpopupmobile").remove(); //same with mobile Autopilot popup   
        }
    }
    else{
        document.getElementById("schedule").style.display = "none"; //hide schedule
	document.querySelector(".schedule-editor").style.display = "none"; //hide editor
        document.getElementById("countdowntitle").style.display = ""; //show title
        document.getElementById("clock").style.display = ""; //show clock
    }

    //fonts or typefaces
    if (parameter('typeface')) {
        if (decodeURIComponent(parameter('typeface')) == "Fredoka One") { //decode URI Component simply replaces %20 with a space, etc
            FontFredoka('auto'); //calls the function for said font
        }
        else if (decodeURIComponent(parameter('typeface')) == "Poppins") {
            FontPoppins('auto');
        }
        else if (decodeURIComponent(parameter('typeface')) == "Yeseva One") {
            FontDMSerif('auto'); //fallback for old depreciated font option Yeseva, replaced by DM Serif Display
        }
        else if (decodeURIComponent(parameter('typeface')) == "DM Serif Display") {
            FontDMSerif('auto');
        }
        else if (decodeURIComponent(parameter('typeface')) == "Orbitron") {
            FontOrbitron('auto');
        }
    }
    else {
        css.style.setProperty('--typeface', "Fredoka One"); //if no parameter is found for the typeface, simply set it to the default (Fredoka One)
    }

    //date
    if (parameter('date')) {
        if(parameter('date').includes('T') && parameter('date').includes(':') ){ //if there is an included time, it will be saved as 12/34/56T12:34, this is checking for the T and the :
           document.querySelector(".datepicker").value = parameter('date'); 
        }
        else{
            document.querySelector(".datepicker").value = parameter('date') + 'T00:00'; //if there is no included time, and it's just 12/34/56 for example, it adds the T00:00 for midnight. backwards compatibility for before time was supported
        }
        var countDownDate = new Date(document.querySelector(".datepicker").value); //sets the datepicker in settings to the correct date + time

        document.getElementById("autopilotpopup").remove(); //removes the Autopilot popup if a date exists
        document.getElementById("autopilotpopupmobile").remove(); //same with mobile Autopilot popup
    }
    else { //if there is no date parameter
        const savedLinks = localStorage.getItem("dashboardsaved"); //get dashboard save data

        if((savedLinks) && (savedLinks !== '[]' && savedLinks !== '' && savedLinks !== 'null') && !parameter("createnew")){ //if countdowns have been saved
            window.location.href = "https://michaeldors.com/mcacountdown/countdowndashboard.html"; //take the user to their dashboard
        }
        else{ //no countdowns have been saved; new user experience with Autopilot
            var now = new Date(); //getting the current date
            var nextyear = new Date().getFullYear() + 1; //setting up a next year variable
            var thisyear = new Date().getFullYear(); //setting up a this year variable

            //new years
            var newyearsthisyear = new Date(thisyear + "-01-01T00:00"); //setting up a this year variable for when new years day is in the current year
            if (newyearsthisyear - now < 0) { //if it's already passed
                newyearsday = new Date(nextyear + '-01-01T00:00'); //then set the countdown to new year's next year
            } else { //otherwise, if it's not passed yet
                newyearsday = new Date(thisyear + '-01-01T00:00'); //set the countdown to new year's this year
            }

            //valentines
            var valentinesthisyear = new Date(thisyear + "-02-14T00:00"); //see new years for docs
            if (valentinesthisyear - now < 0) {
                valentinessday = new Date(nextyear + '-02-14T00:00');
            } else {
                valentinessday = new Date(thisyear + '-02-14T00:00');
            }

            //easter
            var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
            //the above line calculates the moon's path to figure out when Easter is

            var easterthisyear = new Date(getEaster(thisyear) + "T00:00"); //see new years for docs, except it's calculating easter as it's not a set date
            if (easterthisyear - now < 0) {
                easterday = new Date(getEaster(nextyear) + "T00:00");
            } else {
                easterday = new Date(getEaster(thisyear) + "T00:00");
            }

            //independence
            var independencethisyear = new Date(thisyear + "-07-04T00:00"); //see new years for docs
            if (independencethisyear - now < 0) {
                independenceday = new Date(nextyear + '-07-04T00:00');
            } else {
                independenceday = new Date(thisyear + '-07-04T00:00');
            }

            //halloween
            var halloweenthisyear = new Date(thisyear + "-10-31T00:00"); //see new years for docs
            if (halloweenthisyear - now < 0) {
                halloweenday = new Date(nextyear + '-10-31T00:00');
            } else {
                halloweenday = new Date(thisyear + '-10-31T00:00');
            }

            //thanksgiving
            var thanksgivingthisyear = new Date(formatDate(getDateString(thisyear, 10, 3, 4))); //10th month, 3rd week, 4th day (thursday)
            if (thanksgivingthisyear - now < 0) { //see new years for docs
                thanksgivingday = new Date(formatDate(getDateString(nextyear, 10, 3, 4)));
            }
            else {
                thanksgivingday = new Date(formatDate(getDateString(thisyear, 10, 3, 4)));
            }

            //christmas
            var christmasthisyear = new Date(thisyear + "-12-25T00:00"); //see new years for doce
            if (christmasthisyear - now < 0) {
                christmasday = new Date(nextyear + '-12-25T00:00');
            } else {
                christmasday = new Date(thisyear + '-12-25T00:00');
            }


            // List of holiday dates
            const holidays = [
                {
                    name: 'newyear',
                    date: newyearsday
                },
                {
                    name: 'valentines',
                    date: valentinessday
                },
                {
                    name: 'easter',
                    date: easterday
                },
                {
                    name: 'independence',
                    date: independenceday
                },
                {
                    name: 'halloween',
                    date: halloweenday
                },
                {
                    name: 'thanksgiving',
                    date: thanksgivingday
                },
                {
                    name: 'christmas',
                    date: christmasday
                }
            ];

            // Now that all the holidays are in a list and we've calculated when they occur next, it'll find which is coming up the soonest
            var nextHoliday = holidays.reduce(function (closest, holiday) {
                var timeDiff = holiday.date.getTime() - now.getTime();
                return timeDiff > 0 && timeDiff < (closest.date.getTime() - now.getTime()) ? holiday : closest;
            }, holidays[0]);


            switch (nextHoliday.name) {
                case 'newyear':
                    document.getElementById("autopilotprediction").innerHTML = "New Year's Day"; //set Autopilot to tell the user that NYD is next
                    document.getElementById("autopilotpredictionmobile").innerHTML = "New Year's Day"; //same for Autopilot mobile

                    NYD(); //and run the NYD function to actually set the date and such to NYD
                    break;
                case 'valentines': //see NYD for docs
                    document.getElementById("autopilotprediction").innerHTML = "Valentine's Day";
                    document.getElementById("autopilotpredictionmobile").innerHTML = "Valentine's Day";

                    VD();
                    break;
                case 'easter': //see NYD for docs
                    document.getElementById("autopilotprediction").innerHTML = "Easter";
                    document.getElementById("autopilotpredictionmobile").innerHTML = "Easter";

                    EASTER();
                    break;
                case 'independence': //see NYD for docs
                    document.getElementById("autopilotprediction").innerHTML = "Independence Day";
                    document.getElementById("autopilotpredictionmobile").innerHTML = "Independence Day";

                    ID();
                    break;
                case 'halloween': //see NYD for docs
                    document.getElementById("autopilotprediction").innerHTML = "Halloween";
                    document.getElementById("autopilotpredictionmobile").innerHTML = "Halloween";

                    H();
                    break;
                case 'thanksgiving': //see NYD for docs
                    document.getElementById("autopilotprediction").innerHTML = "Thanksgiving";
                    document.getElementById("autopilotpredictionmobile").innerHTML = "Thanksgiving";

                    T();
                    break;
                case 'christmas': //see NYD for docs
                    document.getElementById("autopilotprediction").innerHTML = "Christmas";
                    document.getElementById("autopilotpredictionmobile").innerHTML = "Christmas";

                    C();
                    break;
                default:
                    // handle cases where nextHoliday.name doesn't match any of the above
                    console.error('Unexpected holiday name:', nextHoliday.name);
            }
        }
    }

    if(parameter("schedule") !== "null" && parameter("schedule")){
        document.querySelector(".datepicker").value = '9999-12-30T00:00';
    }

//autopilot onnclick animation
	function autopilotsparkle(event) {
const create_sparkle = (x, y) => {
        const sparkle = document.createElement('div');
                sparkle.innerHTML = `
            <svg viewBox="0 0 100 100" width="20" height="20">
                <path d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z" 
                      fill="url(#grad)" />
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color: #00FF5E; stop-opacity:1" />
                        <stop offset="100%" style="stop-color: #03a662; stop-opacity:1" />
                    </linearGradient>
                </defs>
            </svg>
        `;
        sparkle.style.position = 'absolute';
        sparkle.style.pointerEvents = 'none';
        sparkle.style.left = `${x - 10}px`;
        sparkle.style.top = `${y - 10}px`;
        sparkle.style.transform = 'scale(1)';
        sparkle.style.opacity = '1';
        sparkle.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease-out';

        document.body.appendChild(sparkle);

        const angle = Math.random() * 2 * Math.PI;
        const distance = 50 + Math.random() * 30;
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;

        requestAnimationFrame(() => {
            sparkle.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(0.5)`;
            sparkle.style.opacity = '0';
        });

        setTimeout(() => sparkle.remove(), 1000);
    };

    // Handle both touch and mouse events
    const x = event.touches ? event.touches[0].pageX : event.pageX;
    const y = event.touches ? event.touches[0].pageY : event.pageY;

    for (let i = 0; i < 5; i++) {
        create_sparkle(x, y);
    }
}

    //countdown title
    if (parameter('title')) { 
        document.getElementById("countdowntitle").value = decodeURIComponent(parameter('title')); //set the front-facing countdown title input to the parameter value, decoding all %20s and such
        setcountdowntitle("front"); //tell the setcountdowntitle function to set the back (settings) to the same. sending which it came from the the function, not which to send it to
        document.querySelector('meta[property="og:title"]').setAttribute('content', 'Countdown to ' + decodeURIComponent(parameter('title')));
    }


    //bg again this time to finish the job
    var bgstring = "none";
    if (parameter('atc') && parameter('atc') != "none" && parameter('atc') != "undefined") { //checking it has a good value
        setbg(parameter('atc'), 'auto'); //setbg function takes the number and sets it to that bg, auto tells it that it was run not from settings and not to setcountdowngeneral
        bgstring = parameter('atc'); //set the var to the param
    }
    else {
        bgstring = 'none';
        enablecolor(); //make the color pickers in settings not greyed out anymore
        document.getElementById("animatedbackground").style.display = "none"; //remove the rotating blurred images that would hold the bgs
        document.getElementById("clock").classList.add("clock"); //make the clock normal
        document.getElementById("clock").classList.remove("staticclock"); //not just white clock
    }

        //countdown schedule styling
        if(parameter("schedule") !== "null" && parameter("atc") == "none"){
            document.getElementById("schedule-currentClass").classList.add("schedulebgcolored");
        }
        else{
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
        }


    if(confettiType == "1"){
        ConfettiModeDefault();
    }else if(confettiType == "2"){
        ConfettiModeSnow();
    }else if(confettiType == ""){
        ConfettiModeNone();
    }else{
        ConfettiModeEmoji();
        document.getElementById("confettiEmojiPicker").value = decodeURIComponent(parameter("confettitype"));
    }

if(new Date(document.querySelector(".datepicker").value).getMonth() === 11 && new Date(document.querySelector(".datepicker").value).getDate() === 25) { // December is month 11 (0-based)
	document.querySelector('meta[property="og:image"]').setAttribute('content', 'https://michaeldors.com/mcacountdown/sharepanels/christmasshare.jpg');
}else{
	document.querySelector('meta[property="og:image"]').setAttribute('content', 'https://michaeldors.com/mcacountdown/sharepanels/defaultshare.jpg');
}

    //confetti groundwork for snowflakes and emoji
    class ConfettiManager {
            createParticle(type, content) {
                const confettiParticle = document.createElement('div');
                confettiParticle.style.position = 'fixed';
                confettiParticle.style.pointerEvents = 'none';
                confettiParticle.style.zIndex = '1000';
                
                const size = Math.random() * 20 + 10;
                confettiParticle.style.width = `${size}px`;
                confettiParticle.style.height = `${size}px`;
                
                const startX = Math.random() * window.innerWidth;
                confettiParticle.style.left = `${startX}px`;
                confettiParticle.style.top = '-20px';
                
                switch (type) {
                    case 'snowflake':
                        confettiParticle.innerHTML = '<i class="fa-regular fa-snowflake"></i>';
                        const snowflakered = Math.floor(Math.random() * 50); // Low red for a blue tone (0-49)
                        const snowflakegreen = Math.floor(Math.random() * 100) + 150; // Moderate green for a soft blue (150-249)
                        const snowflakeblue = Math.floor(Math.random() * 56) + 200; // High blue for brightness (200-255)
                        
                            confettiParticle.style.color=`rgb(${snowflakered}, ${snowflakegreen}, ${snowflakeblue})`;
                            confettiParticle.style.fontSize = `${size}px`;
                        break;
                    case 'emoji':
                        const emojiArray = Array.from(content); // Convert the content to an array of characters
                        confettiParticle.innerHTML = emojiArray.length > 1 ? emojiArray[Math.floor(Math.random() * emojiArray.length)] : content;
                        confettiParticle.style.fontSize = `${size}px`;
                        confettiParticle.style.color = `#FFFFFF`;
                        confettiParticle.style.fontFamily = `Fredoka One`;
                    break;
                }
                
                document.body.appendChild(confettiParticle);
                return confettiParticle;
            }

            animateParticle(confettiParticle, type) {
                const duration = Math.random() * 2000 + 3000;
                const startX = parseFloat(confettiParticle.style.left);
                const amplitude = Math.random() * 100 + 50;
                
                const keyframes = [
                    { 
                        transform: 'translate(0, 0)',
                        opacity: 1 
                    },
                    { 
                        transform: type === 'bubble' 
                            ? `translate(${Math.sin(Math.random() * Math.PI) * amplitude}px, -${window.innerHeight}px)` 
                            : `translate(${Math.sin(Math.random() * Math.PI) * amplitude}px, ${window.innerHeight}px)`,
                        opacity: 0 
                    }
                ];

                const animation = confettiParticle.animate(keyframes, {
                    duration,
                    easing: type === 'bubble' ? 'ease-in' : 'ease-out',
                });

                animation.onfinish = () => confettiParticle.remove();
            }

            createMultipleParticles(type, content) {
                const createParticleLoop = () => {
                    const confettiParticle = this.createParticle(type, content);
                    this.animateParticle(confettiParticle, type);
                    setTimeout(createParticleLoop, Math.random() * 200);
                };
                createParticleLoop();
            }
        }

        const confettiManager = new ConfettiManager();

    //animation speed toggle
    document.querySelector('#searchTypeToggle').addEventListener('click', function (event) {

        if (event.target.tagName.toLowerCase() == 'input') {

            let input = event.target;
            let slider = this.querySelector('div');
            let labels = this.querySelectorAll('label');

            slider.style.transform = `translateX(${input.dataset.location})`;
            labels.forEach(function (label) {
                if (label == input.parentElement) {
                    label.classList.add('selected');
                } else {
                    label.classList.remove('selected');
                }
            });

            if (event.target == document.getElementById("speed1")) {
                eraseCookie('speed2');
                eraseCookie('speed3');
                setCookie('speed1', 'true', '70');
                speed1();
            }
            if (event.target == document.getElementById("speed2")) {
                eraseCookie('speed1');
                eraseCookie('speed3');
                setCookie('speed2', 'true', '70');
                speed2();
            }
            if (event.target == document.getElementById("speed3")) {
                eraseCookie('speed2');
                eraseCookie('speed1');
                setCookie('speed3', 'true', '70');
                speed3();
            }
        }

    });


    function speed1() {
        if (!isNaN(parameter("atc"))) {
            document.getElementById("clock").classList.add("staticclock");
            document.getElementById("bg1").classList.add("bg-color");
            document.getElementById("bg1").classList.remove("bg-color-slow");
            document.getElementById("bg1").classList.remove("bg-color-fast");
            document.getElementById("bg2").classList.add("bg-black");
            document.getElementById("bg2").classList.remove("bg-black-slow");
            document.getElementById("bg2").classList.remove("bg-black-fast");
        }
        else {
            document.getElementById("clock").classList.remove("clockslow");
            document.getElementById("clock").classList.remove("clockfast");
            document.getElementById("clock").classList.add("clock");
        }

        if(parameter("schedule") !== "null" && parameter("atc") == "none"){
            document.getElementById("schedule-currentClass").classList.add("schedulebgcolored");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredfast");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredslow");
        }
        else{
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredfast");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredslow");
        }
    }
    function speed2() {
        if (!isNaN(parameter("atc"))) {
            document.getElementById("clock").classList.add("staticclock");
            document.getElementById("bg1").classList.remove("bg-color");
            document.getElementById("bg1").classList.add("bg-color-slow");
            document.getElementById("bg1").classList.remove("bg-color-fast");
            document.getElementById("bg2").classList.remove("bg-black");
            document.getElementById("bg2").classList.add("bg-black-slow");
            document.getElementById("bg2").classList.remove("bg-black-fast");
        }
        else {
            document.getElementById("clock").classList.add("clockslow");
            document.getElementById("clock").classList.remove("clockfast");
            document.getElementById("clock").classList.remove("clock");
        }

        if(parameter("schedule") !== "null" && parameter("atc") == "none"){
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredfast");
            document.getElementById("schedule-currentClass").classList.add("schedulebgcoloredslow");
        }
        else{
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredfast");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredslow");
        }
    }
    function speed3() {
        if (!isNaN(parameter("atc"))) {
            document.getElementById("clock").classList.add("staticclock");
            document.getElementById("bg1").classList.remove("bg-color");
            document.getElementById("bg1").classList.remove("bg-color-slow");
            document.getElementById("bg1").classList.add("bg-color-fast");
            document.getElementById("bg2").classList.remove("bg-black");
            document.getElementById("bg2").classList.remove("bg-black-slow");
            document.getElementById("bg2").classList.add("bg-black-fast");
        }
        else {
            document.getElementById("clock").classList.remove("clockslow");
            document.getElementById("clock").classList.add("clockfast");
            document.getElementById("clock").classList.remove("clock");
        }

        if(parameter("schedule") !== "null" && parameter("atc") == "none"){
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
            document.getElementById("schedule-currentClass").classList.add("schedulebgcoloredfast");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredslow");
        }
        else{
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredfast");
            document.getElementById("schedule-currentClass").classList.remove("schedulebgcoloredslow");
        }
    }

    updateoptions();

    document.getElementById("body").style.overflowY = 'hidden';
    document.getElementById("gear").classList.remove("hidden");

    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }
    function getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    function eraseCookie(name) {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }


    function SetCountDowngeneral() { //gets called quite a bit, updates all settings and parameters to match the current state
        countDownDate = new Date(document.querySelector(".datepicker").value);
        var css = document.querySelector(':root');
        var color1 = document.getElementById("color1").value; //get the color values
        var color2 = document.getElementById("color2").value;
        var color3 = document.getElementById("color3").value;
        var color4 = document.getElementById("color4").value;
        css.style.setProperty('--one', color1); //set the color values as CSS vars
        css.style.setProperty('--two', color2);
        css.style.setProperty('--three', color3);
        css.style.setProperty('--four', color4);

        var color1normalized = color1.replace("#", ""); //remove the #s from the color params to get them ready
        var color2normalized = color2.replace("#", "");
        var color3normalized = color3.replace("#", "");
        var color4normalized = color4.replace("#", "");

        var cdtitle = document.getElementById("countdowntitle").value; //set the title
        
        if(cdtitle){
            document.querySelector('meta[property="og:title"]').setAttribute('content', 'Countdown to ' + cdtitle);
        }
        else{
            document.querySelector('meta[property="og:title"]').setAttribute('content', 'Countdown - Michael Dors');
        }

        if(countDownDate.getMonth() === 11 && countDownDate.getDate() === 25) { // December is month 11 (0-based)
            document.querySelector('meta[property="og:image"]').setAttribute('content', 'https://michaeldors.com/mcacountdown/sharepanels/christmasshare.jpg');
        }else{
		document.querySelector('meta[property="og:image"]').setAttribute('content', 'https://michaeldors.com/mcacountdown/sharepanels/defaultshare.jpg');
	}

        if(!confettiType){
            confettiType = document.getElementById("confettiEmojiPicker").value;
        }

        var refresh = window.location.protocol + "//" + window.location.host + window.location.pathname + '?date=' + document.querySelector(".datepicker").value + '&colorone=' + color1normalized + '&colortwo=' + color2normalized + '&colorthree=' + color3normalized + '&colorfour=' + color4normalized + '&typeface=' + encodeURIComponent(css.style.getPropertyValue('--typeface')) + '&atc=' + bgstring + '&title=' + encodeURIComponent(cdtitle) + '&confettitype=' + confettiType + '&endingsound=' + btoa(document.getElementById("audioLink").value) + '&schedule=' + parameter('schedule');
        window.history.pushState({ path: refresh }, '', refresh); //create and push a new URL

        document.getElementById("linkinput").value = refresh; //refresh the link
        makeQR(); //refresh the QR code
    }

    function parameter(name) { //returns the value of the parameter it's sent
        var query = window.location.search.substring(1);
        var parameters = query.split('&');
        for (var i = 0; i < parameters.length; i++) {
            var pair = parameters[i].split('=');
            if (pair[0] == name) {
                return pair[1];
            }
        }
        return null;
    }

    //memory saver 
    document.addEventListener('visibilitychange', function () { //when the tab changes focus state
        if (document.hidden) { //if the tab is hidden
            if (getCookie('memsav')) { //if memory saver is enabled
                clearInterval(x); //kill the countdown
                document.getElementById("clock").remove(); //remove the clock element as it's no longer needed
                document.getElementById("unfocused").classList.remove("hidden"); //add the memory saver popup even though it disappears when the tab is back and nobody is humanly fast enough to read it
            }
        }

        if (!document.hidden && getCookie('memsav')) { //if the tab is gone back to and memory saver is on
            location.reload(); //reload the tab
        }

    }, false);

    //settings
    function settings() {
        if(getCookie("cookiesAccepted")){

        if (document.getElementById("autopilotpopup")) {
            document.getElementById("autopilotpopup").remove();
        } //if settings is opened while the autpilot popup is still up, get rid of it

        if (document.getElementById("autopilotpopupmobile")) {
            document.getElementById("autopilotpopupmobile").remove();
        } //same but autopilot mobile

        if (document.getElementById("settings").classList.contains("hidden")) { //if settings is closed (Being opened)
            document.getElementById("schedule").style.display = "none"; //hide schedule
            document.getElementById("settings").classList.remove("hidden"); //unhide settings
            document.getElementById("clock").style.display = "none"; //hide clock
            document.getElementById("schedule").style.display = "none"; //hide schedule
            document.getElementById("countdowntitle").style.display = "none"; //hide title
            document.getElementById("gear").classList.add("hidden"); //hide settings icon
            document.getElementById("innergear").classList.add("hidden"); //hide inner settings icon
            document.getElementById("preloader").classList.add("hidden"); //hide loading screen?
            document.getElementById("unfocused").classList.add("hidden"); //hide memsave popup
            document.getElementById("body").style.overflowY = ''; //allow scrolling
            document.body.scrollTop = document.documentElement.scrollTop = 0; //scroll to top for good measure
        }
        else { //if settings is already opened (Being closed)
            if(parameter("schedule") != "null"){ //if user is using Countdown Schedule
                document.getElementById("schedule").style.display = ""; //unhide schedule
                document.getElementById("clock").style.display = "none"; //hide clock
                document.getElementById("countdowntitle").style.display = "none"; //hide title
            }else{ //user is not using Countdown Schedule
                document.getElementById("clock").style.display = ""; //unhide clock
                document.getElementById("schedule").style.display = "none"; //hide schedule
                document.getElementById("countdowntitle").style.display = ""; //unhide title
                document.getElementById("schedule").style.display = "none"; //unhide schedule
            }
            document.getElementById("settings").classList.add("hidden"); //hide settings
            document.getElementById("gear").classList.remove("hidden"); //unhide gear icon
            document.getElementById("innergear").classList.remove("hidden"); //unhide inner settings icon
            document.getElementById("preloader").classList.add("hidden"); //hide loading screen?
            document.getElementById("unfocused").classList.add("hidden"); //hide memsave popup
            document.getElementById("body").style.overflowY = 'hidden'; //don't allow scrolling
            document.body.scrollTop = document.documentElement.scrollTop = 0; //once again scroll to top for good measure
        }

        SetCountDowngeneral();
        }
        else{
            document.getElementById("cookie-banner").classList.add("failedcookiebanner");
            setTimeout(function() {
                document.getElementById("cookie-banner").classList.remove("failedcookiebanner");
            }, 500);
        }
    }

    //grey out color pickers and theme color for background
    if (!isNaN(parameter("atc"))) { //if animated background is enabled
        document.getElementById("animatedbackground").classList.remove("hidden"); //unhide background
        document.querySelector("meta[name=theme-color]").setAttribute("content", '#141414'); //sets the theme color to grey
        disablecolor(); //greys out color picker
    }
    else { //if animated background is disabled
        document.getElementById("animatedbackground").classList.add("hidden"); //hide background
        if (document.getElementById("clock") && document.getElementById("clock").style.display !== "none") { //if the clock exists and settings is not open
            document.querySelector("meta[name=theme-color]").setAttribute("content", window.getComputedStyle(document.getElementById("clock")).getPropertyValue("color")); //sets the theme color to the current foreground color
        }
        else if(parameter("schedule") !== "null" && parameter("schedule")){ //if using schedule instead of clock
            document.querySelector("meta[name=theme-color]").setAttribute("content", window.getComputedStyle(document.getElementById("schedule-currentClass")).getPropertyValue("background-color")); //sets the theme color to the current foreground color
        }
        else{ //should never be triggered(?) mostly a fallback
            document.querySelector("meta[name=theme-color]").setAttribute("content", '#8426ff'); //sets the theme color to Countdown Purple
        }
        enablecolor(); //un-greys color picker
    }


    //section of code that does the counting
    var x = setInterval(function () {

        if (document.getElementById("settings").classList.contains("hidden")) {
            document.body.scrollTop = document.documentElement.scrollTop = 0;
        } //if settings is closed we perpetually scroll to the top of the tab 

        updateoptions();

        if (getCookie("speed1")) { //if speed one has been chosen in the past and still has a cookie representing it
            document.getElementById("speed1").click(); //simulate a click on speed one to remember that choice
        }
        else if (getCookie("speed2")) { //see speed one
            document.getElementById("speed2").click(); //see line above
        }
        else if (getCookie("speed3")) { //see speed two
            document.getElementById("speed3").click(); //see line above
        }

        if (!isNaN(parameter("atc"))) {
            document.getElementById("clock").classList.remove("clock"); //remove colored normal clock
            document.getElementById("clock").classList.remove("clockslow"); //remove colored slow clock
            document.getElementById("clock").classList.remove("clockfast"); //remove colored fast clock
            document.getElementById("clock").classList.add("staticclock"); //add white only clock
            if (document.getElementById("settings").classList.contains("hidden")) { //if settings is hidden
                document.getElementById("animatedbackground").classList.remove("hidden"); //add animated background
                document.querySelector("meta[name=theme-color]").setAttribute("content", '#141414'); //greys theme color
                disablecolor(); //greys out color picker
            }
        }
        else {
            document.getElementById("clock").classList.add("clock"); //add back colored clock
            document.getElementById("clock").classList.remove("staticclock"); //remove white only clock
            document.getElementById("animatedbackground").classList.add("hidden"); //remove background
            if (document.getElementById("clock") && document.getElementById("clock").style.display !== "none") { //if the clock exists and settings is not opened
                document.querySelector("meta[name=theme-color]").setAttribute("content", window.getComputedStyle(document.getElementById("clock")).getPropertyValue("color")); //sets the theme color to the current foreground color
            }
            else if(parameter("schedule") !== "null" && parameter("schedule")){ //if using schedule instead of clock
                document.querySelector("meta[name=theme-color]").setAttribute("content", window.getComputedStyle(document.getElementById("schedule-currentClass")). getPropertyValue("background-color")); //sets the theme color to the current foreground color
            }
            else{ //should never be triggered(?) mostly a fallback
                document.querySelector("meta[name=theme-color]").setAttribute("content", '#8426ff'); //sets the theme color to Countdown Purple
            }
            
            enablecolor(); //un-greys color picker
        }

        document.getElementById("preloader").classList.add("hidden"); //hide loading screen


        var now = new Date().getTime();

        var distance = countDownDate - now;

	function formatZeroesofNumber(num) {
    		return num < 10 ? '0' + num : num;
	}
	
        var days = Math.floor(distance / (1000 * 60 * 60 * 24));
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);


        if(parameter("schedule") == "null"){ //will only trigger when there is no schedule active. schedule titles are handled with the cdschedule code.
            if (document.getElementById("countdowntitle").value != "") { //if the countdown has a title
                if (days > 0) { //if it's over 0 days, we use the days text with the title since there is a title
                    if(days == 1){
                        document.title = document.getElementById("countdowntitle").value + " in " + days + " day | Countdown";
                    }
                    else{
                        document.title = document.getElementById("countdowntitle").value + " in " + days + " days | Countdown";
                    }
                }
                else if (hours > 0) { //over 0 hours use hours with title
                    if(hours == 1){
                        document.title = document.getElementById("countdowntitle").value + " in " + hours + " hour | Countdown";
                    }
                    else{
                        document.title = document.getElementById("countdowntitle").value + " in " + hours + " hours | Countdown";
                    }
                }
                else if (minutes > 0) { //over 0 minutes use minutes with title
                    if(minutes == 1){
                        document.title = document.getElementById("countdowntitle").value + " in " + minutes + " minute | Countdown";
                    }
                    else{
                        document.title = document.getElementById("countdowntitle").value + " in " + minutes + " minutes | Countdown";
                    }
                }
                else if (seconds > 0) { //over 0 seconds use seconds with title
                    if(seconds == 1){
                        document.title = document.getElementById("countdowntitle").value + " in " + seconds + " second | Countdown";
                    }
                    else{
                        document.title = document.getElementById("countdowntitle").value + " in " + seconds + " seconds | Countdown";
                    }
                }
                else { //otherwise just use Countdown
                    document.title = "Countdown";
                }
            }
            else {
                if (days > 0) { //over 0 days no title
                    if(days == 1){
                        document.title = "Countdown for " + days + " day";
                    }
                    else{
                        document.title = "Countdown for " + days + " days";
                    }
                }
                else if (hours > 0) { //over 0 hours no title
                    if(hours == 1){
                        document.title = "Countdown for " + hours + " hour";
                    }
                    else{
                        document.title = "Countdown for " + hours + " hours";
                    }
                }
                else if (minutes > 0) { //over 0 minutes no title
                    if(minutes == 1){
                        document.title = "Countdown for " + minutes + " minute";
                    }
                    else{
                        document.title = "Countdown for " + minutes + " minutes";
                    }
                }
                else if (seconds > 0) { //over 0 seconds no title
                    if(seconds == 1){
                        document.title = "Countdown for " + seconds + " second";
                    }
                    else{
                        document.title = "Countdown for " + seconds + " seconds";
                    }
                } //since there are "else if" and not their own else, we dont have to worry about "seconds" triggering when it should be on "hours"- while the seconds is technically over 0, it will stop if it reaches hours and that's true
                else { //just countdown
                    document.title = "Countdown";
                }
            }
        }

        //only include
        if (getCookie("day")) {
            document.getElementById("clock").innerHTML = days + " days"; //no calc, just use days
            document.getElementById("clock").style.fontSize = '75px';
        }
        else if (getCookie("hour")) {
            var hourcount = Math.floor(distance / 3600000); //figure out how many hours in that many milliseconds
            document.getElementById("clock").innerHTML = hourcount + " hours";
            document.getElementById("clock").style.fontSize = '75px';
        }
        else if (getCookie("minute")) {
            var minutecount = Math.floor(distance / 60000); //milliseconds converted to days
            document.getElementById("clock").innerHTML = minutecount + " minutes";
            document.getElementById("clock").style.fontSize = '75px';
        }
        else if (getCookie("second")) {
            var secondcount = Math.floor(distance / 1000); //milliseconds converted to seconds
            document.getElementById("clock").innerHTML = secondcount + " seconds";
            document.getElementById("clock").style.fontSize = '75px';
        }
        else if (getCookie("millisecond")) {
            document.getElementById("clock").innerHTML = distance + " milliseconds"; //no calc, just use milliseconds
            document.getElementById("clock").style.fontSize = '75px';
        }
        else if (getCookie("week")) {
            var weekcount = Math.floor(days / 7); //days / seven, weeks
            document.getElementById("clock").innerHTML = weekcount + " weeks";
            document.getElementById("clock").style.fontSize = '75px';
        }
        else if (getCookie("lcdu")) { //label countdown units
            if (days > 0) {
                document.getElementById("clock").innerHTML = days + "d " + hours + "h " + minutes + "m " + seconds + "s "; //same as title, change the text as needed depending on what's left
                document.getElementById("clock").style.fontSize = '75px';
            }
            else if (hours > 0) {
                document.getElementById("clock").innerHTML = hours + "h " + minutes + "m " + seconds + "s "; //only for hours, no more days
                document.getElementById("clock").style.fontSize = '100px';
            }
            else if (minutes > 0) {
                document.getElementById("clock").innerHTML = minutes + "m " + seconds + "s "; //only for minutes no more hours
                document.getElementById("clock").style.fontSize = '150px';
            }
            else {
                document.getElementById("clock").innerHTML = seconds + "s"; //just seconds
                document.getElementById("clock").style.fontSize = '175px';
            }
        }
        else { //not labeling or only including
            if (days > 0) {
                document.getElementById("clock").innerHTML =  formatZeroesofNumber(days) + ":" +  formatZeroesofNumber(hours) + ":" +  formatZeroesofNumber(minutes) + ":" +  formatZeroesofNumber(seconds); //same as labeled just without labels
                document.getElementById("clock").style.fontSize = '75px';
            }
            else if (hours > 0) {
                document.getElementById("clock").innerHTML =  formatZeroesofNumber(hours) + ":" +  formatZeroesofNumber(minutes) + ":" +  formatZeroesofNumber(seconds); //only for hours no more days
                document.getElementById("clock").style.fontSize = '100px';
            }
            else if (minutes > 0) {
                document.getElementById("clock").innerHTML =  formatZeroesofNumber(minutes) + ":" +  formatZeroesofNumber(seconds); //only for minutes no more hours
                document.getElementById("clock").style.fontSize = '150px';
            }
            else {
                document.getElementById("clock").innerHTML = seconds;
                document.getElementById("clock").style.fontSize = '175px'; //just seconds
            }
        }

	if(parameter('progress')){ //if the user has their progress bar enabled
		document.getElementByID("progress-bar").style.display = "";
		const countdownduration = document.querySelector('.progressdatepicker').value - document.querySelector('.datepicker').value;
		alert(countdownduration);
		const progressbarvalue = 100 - (distance / countdownduration * 100);
		alert(progressbarvalue);
                document.getElementById('schedule-progress').style.width = `${progress}%`;
	}

        if(distance == 1000){ //when countdown is one second from ending, to give time to load
		if(!getCookie('soce')){ //if disable end sound is not enabled
			//check if ending sound url input has value
            		if(document.getElementById("audioLink").value !== ""){
                		playAudio(); //play end sound
            		}
		}
        }

        if (distance < 0) { //if the timer is over
            clearInterval(x);
            document.getElementById("clock").remove();
            document.getElementById("countdowntitle").remove();
            document.getElementById("settings").display = "none";
            document.getElementById("innergear").classList.remove("fa-gears"); //remove clock, title, settings icon
            document.getElementById("innergear").classList.add("fa-xmark"); //add a button to close the countdown
            document.getElementById("gear").onclick = finishedcountdownend; //when said button is clicked go to the homepage

            document.getElementById("animatedbackground").style.opacity = "0"; //fade out the animated background (as it has a transition property for opacity)
            setTimeout(() => {
                document.getElementById("animatedbackground").remove(); //in one second when the fade is done, completely delete the background
            }, 1000);


            if (!getCookie('coce')) { //if disable confetti is not enabled, 
                if(confettiType == "1"){ //default confetti
                    if(parameter("atc") == "none"){
                    confetticolorstring = document.getElementById("color1").value + ', ' + document.getElementById("color2").value + ', ' + document.getElementById("color3").value + ', ' + document.getElementById("color4").value 
                    }else{
                        bg1colors = '[#8426ff, #8426ff, #8426ff, #8426ff, #5702c7, #974df7, #3ab6ff, #00ff5e, #ff9900]';
                        bg2colors = '[#FF3131, #FF3131, #FF3131, #FF3131, #00FF5E, #00FF5E, #00FF5E, #3AB6FF, #FFFFFF]';
                        bg3colors = '[#3AB6FF, #FF3131]';
                        bg4colors = '[#FF9900, #FF9900, #FFCC00, #FF3131]';
                        bg5colors = '[#FF3131, #00FF5E, #FFCC00, #3AB6FF]';
                        bg6colors = '[#FF3169, #FF5400, #FF8A00, #FF0026]';
                        bg7colors = '[#3AB6FF, #3AB6FF, #8426FF, #00FF5E]';
                        bg8colors = '[#FA8F55, #8E53FD]';
                        bg9colors = '[#FF3131, #FF0000, #8D0000, #E40000]';
                        bg10colors = '[#148D00, #0BE400, #05FF00, #4EFF31]';
                        bg11colors = '[#3177FF, #0029FF, #00568D, #0069E4]';
                        bg12colors = '[#C931FF, #BD00FF, #60008D, #A200E4]';

                        confetticolorstring = eval(`bg${parameter("atc")}colors`);
                    }

                    startConfetti(confetticolorstring); //START THE PARTY!!
                }else if (confettiType == "2"){ //snowflakes
                    confettiManager.createMultipleParticles('snowflake');
                }else{ //emojis or input
                    const confettiEmoji = document.getElementById('confettiEmojiPicker').value;
                    confettiManager.createMultipleParticles('emoji', confettiEmoji);
                }
            }
        }



    }, 1);

    function finishedcountdownend() {
        window.location.href = "http://countdown.michaeldors.com"; //used on the x mark for confetti, makes a new countdown
    }

    function updateoptions() { //updates the states of the toggle buttons in settings
        if (getCookie("memsav")) { //memory saver
            document.getElementById("memsav").classList.add("enabled");
            document.getElementById("memsav").classList.remove("disabled");
        }
        else {
            document.getElementById("memsav").classList.remove("enabled");
            document.getElementById("memsav").classList.add("disabled");
        }
        if (getCookie("coce")) { //disable confetti
            document.getElementById("coce").classList.add("enabled");
            document.getElementById("coce").classList.remove("disabled");
        }
        else {
            document.getElementById("coce").classList.remove("enabled");
            document.getElementById("coce").classList.add("disabled");
        }
	if (getCookie("soce")) { //disable end sound
            document.getElementById("soce").classList.add("enabled");
            document.getElementById("soce").classList.remove("disabled");
        }
	else {
            document.getElementById("soce").classList.remove("enabled");
            document.getElementById("soce").classList.add("disabled");
        }
        if (getCookie("lcdu")) { //label countdown units
            document.getElementById("lcdu").classList.add("enabled");
            document.getElementById("lcdu").classList.remove("disabled");
        }
        else {
            document.getElementById("lcdu").classList.remove("enabled");
            document.getElementById("lcdu").classList.add("disabled");
        }

        if (getCookie("second")) { //only include seconds
            document.getElementById("second").classList.add("enabled");
            document.getElementById("second").classList.remove("disabled");
        }
        else {
            document.getElementById("second").classList.remove("enabled");
            document.getElementById("second").classList.add("disabled");
        }

        if (getCookie("millisecond")) { //only include milliseconds
            document.getElementById("millisecond").classList.add("enabled");
            document.getElementById("millisecond").classList.remove("disabled");
        }
        else {
            document.getElementById("millisecond").classList.remove("enabled");
            document.getElementById("millisecond").classList.add("disabled");
        }

        if (getCookie("minute")) { //only include minutes
            document.getElementById("minute").classList.add("enabled");
            document.getElementById("minute").classList.remove("disabled");
        }
        else {
            document.getElementById("minute").classList.remove("enabled");
            document.getElementById("minute").classList.add("disabled");
        }

        if (getCookie("hour")) { //only include hours
            document.getElementById("hour").classList.add("enabled");
            document.getElementById("hour").classList.remove("disabled");
        }
        else {
            document.getElementById("hour").classList.remove("enabled");
            document.getElementById("hour").classList.add("disabled");
        }

        if (getCookie("day")) { //only include days
            document.getElementById("day").classList.add("enabled");
            document.getElementById("day").classList.remove("disabled");
        }
        else {
            document.getElementById("day").classList.remove("enabled");
            document.getElementById("day").classList.add("disabled");
        }

        if (getCookie("week")) { //only include weeks
            document.getElementById("week").classList.add("enabled");
            document.getElementById("week").classList.remove("disabled");
        }
        else {
            document.getElementById("week").classList.remove("enabled");
            document.getElementById("week").classList.add("disabled");
        }
    }




    function memsav() { //memory saver set or remove cookie
        if (getCookie('memsav')) {
            eraseCookie('memsav');
        }
        else {
            setCookie('memsav', 'true', '70');
        }
        updateoptions();
    }



    function coce() { //disable confetti set or remove cookie 
        if (getCookie('coce')) {
            eraseCookie('coce');
        }
        else {
            setCookie('coce', 'true', '70');
        }
        updateoptions();
    }

    function soce() { //disable end sound set or remove cookie 
        if (getCookie('soce')) {
            eraseCookie('soce');
        }
        else {
            setCookie('soce', 'true', '70');
        }
        updateoptions();
    }


    function lcdu() { //label countdown units set or remove cookie
        if (getCookie('lcdu')) {
            eraseCookie('lcdu');
        }
        else {
            setCookie('lcdu', 'true', '70');
        }
        updateoptions();
    }


    function week() { //only include week set or remove cookie
        if (getCookie('week')) {
            eraseCookie('week');
        }
        else {
            setCookie('week', 'true', '70');
            eraseCookie('second'); //remove all other only includes
            eraseCookie('minute');
            eraseCookie('hour');
            eraseCookie('day');
            eraseCookie('millisecond');
        }
        updateoptions();
    }
    function day() { //only include day set or remove cookie
        if (getCookie('day')) {
            eraseCookie('day');
        }
        else {
            setCookie('day', 'true', '70');
            eraseCookie('second'); //remove all other only includes
            eraseCookie('minute');
            eraseCookie('week');
            eraseCookie('hour');
            eraseCookie('millisecond');
        }
        updateoptions();
    }
    function hour() { //only include hour set or remove cookie
        if (getCookie('hour')) {
            eraseCookie('hour');
        }
        else {
            setCookie('hour', 'true', '70');
            eraseCookie('second'); //remove all other only includes
            eraseCookie('day');
            eraseCookie('week');
            eraseCookie('minute');
            eraseCookie('millisecond');
        }
        updateoptions();
    }
    function minute() { //only include minute set or remove cookie
        if (getCookie('minute')) {
            eraseCookie('minute');
        }
        else {
            setCookie('minute', 'true', '70');
            eraseCookie('second'); //remove all other only includes
            eraseCookie('week');
            eraseCookie('day');
            eraseCookie('hour');
            eraseCookie('millisecond');
        }
        updateoptions();
    }
    function second() { //only include second set or remove cookie
        if (getCookie('second')) {
            eraseCookie('second');
        }
        else {
            setCookie('second', 'true', '70');
            eraseCookie('minute'); //remove all other only includes
            eraseCookie('day');
            eraseCookie('hour');
            eraseCookie('week');
            eraseCookie('millisecond');
        }
        updateoptions();
    }
    function millisecond() { //only include millisecond set or remove cookie
        if (getCookie('millisecond')) {
            eraseCookie('millisecond');
        }
        else {
            setCookie('millisecond', 'true', '70');
            eraseCookie('minute'); //remove all other only includes
            eraseCookie('day');
            eraseCookie('second');
            eraseCookie('hour');
            eraseCookie('week');
        }
        updateoptions();
    }
    function resetcookies() { //remove all saved cookies
        eraseCookie('memsav');
        eraseCookie('coce');
        eraseCookie('minute');
        eraseCookie('millisecond');
        eraseCookie('week');
        eraseCookie('second');
        eraseCookie('day');
        eraseCookie('hour');
        eraseCookie('cookiesAccepted');
        eraseCookie('lcdu');
        updateoptions(); //update classes of settings buttons

        document.getElementById("animatedbackground").style.display = "none"; //remove animated bg
        bgstring = "none"; //set the background var to none

        var css = document.querySelector(':root'); //access the CSS variables
        document.getElementById("color1").value = "#8426ff";
        document.getElementById("color2").value = "#3ab6ff";
        document.getElementById("color3").value = "#00ff5e";
        document.getElementById("color4").value = "#ff9900"; //reset all four color values
        css.style.setProperty('--one', "#8426ff");
        css.style.setProperty('--two', "#3ab6ff");
        css.style.setProperty('--three', "#00ff5e");
        css.style.setProperty('--four', "#ff9900"); //mirror that reset in the CSS variables
        css.style.setProperty('--typeface', "Fredoka One"); //reset typeface

        localStorage.removeItem('dashboardsaved'); //reset dashboard

        window.location.href = window.location.origin + window.location.pathname; //set URL

    }

    //date picker presets tab box
    const tabsBox = document.querySelector(".tabs-box"),
        allTabs = tabsBox.querySelectorAll(".tab"),
        arrowIcons = document.querySelectorAll(".icon i");
    let isDragging = false;
    const handleIcons = (scrollVal) => {
        let maxScrollableWidth = tabsBox.scrollWidth - tabsBox.clientWidth;
        arrowIcons[0].parentElement.style.display = scrollVal <= 0 ? "none" : "flex";
        arrowIcons[1].parentElement.style.display = maxScrollableWidth - scrollVal <= 1 ? "none" : "flex";
    }
    arrowIcons.forEach(icon => {
        icon.addEventListener("click", () => {
            // if clicked icon is left, reduce from tabsBox scrollLeft else add
            let scrollWidth = tabsBox.scrollLeft += icon.id === "left" ? -200 : 200;
            handleIcons(scrollWidth);
        });
    });

    const dragging = (e) => {
        if (!isDragging) return;
        tabsBox.classList.add("dragging");
        tabsBox.scrollLeft -= e.movementX;
        handleIcons(tabsBox.scrollLeft)
    }
    const dragStop = () => {
        isDragging = false;
        tabsBox.classList.remove("dragging");
    }
    tabsBox.addEventListener("mousedown", () => isDragging = true);
    tabsBox.addEventListener("mousemove", dragging);
    document.addEventListener("mouseup", dragStop);


    /*
    //presets tabbox
    const PresetstabsBox = document.querySelector(".presetstabs-box"),
        PresetsallTabs = tabsBox.querySelectorAll(".tab"),
        PresetsarrowIcons = document.querySelectorAll(".presetsicon i");
    let PresetsisDragging = false;
    const PresetshandleIcons = (scrollVal) => {
        let maxScrollableWidth = PresetstabsBox.scrollWidth - PresetstabsBox.clientWidth;
        PresetsarrowIcons[0].parentElement.style.display = scrollVal <= 0 ? "none" : "flex";
        PresetsarrowIcons[1].parentElement.style.display = maxScrollableWidth - scrollVal <= 1 ? "none" : "flex";
    }
    PresetsarrowIcons.forEach(icon => {
        icon.addEventListener("click", () => {
            // if clicked icon is left, reduce from tabsBox scrollLeft else add
            let scrollWidth = PresetstabsBox.scrollLeft += icon.id === "presetsleft" ? -300 : 300;
            PresetshandleIcons(scrollWidth);
        });
    });

    const Presetsdragging = (e) => {
        if (!PresetsisDragging) return;
        PresetstabsBox.classList.add("dragging");
        PresetstabsBox.scrollLeft -= e.movementX;
        PresetshandleIcons(tabsBox.scrollLeft)
    }
    const PresetsdragStop = () => {
        PresetsisDragging = false;
        PresetstabsBox.classList.remove("dragging");
    }
    PresetstabsBox.addEventListener("mousedown", () => isDragging = true);
    PresetstabsBox.addEventListener("mousemove", dragging);
    document.addEventListener("mouseup", dragStop);
    
    */


    const holidays = { // keys are formatted as month,week,day
        "0,2,1": "Martin Luther King, Jr. Day",
        "1,2,1": "President's Day",
        "2,1,0": "Daylight Savings Time Begins",
        "3,3,3": "Administrative Assistants Day",
        "4,1,0": "Mother's Day",
        "4,-1,1": "Memorial Day",
        "5,2,0": "Father's Day",
        "6,2,0": "Parents Day",
        "8,0,1": "Labor Day",
        "8,1,0": "Grandparents Day",
        "8,-1,0": "Gold Star Mothers Day",
        "9,1,1": "Columbus Day",
        "10,0,0": "Daylight Savings Time Ends",
        "10,3,4": "Thanksgiving Day"
    };
    function getDate(year, month, week, day) {
        const firstDay = 1;
        if (week < 0) {
            month++;
        }
        const date = new Date(year, month, (week * 7) + firstDay);
        if (day < date.getDay()) {
            day += 7;
        }
        date.setDate(date.getDate() - date.getDay() + day);
        return date;
    }

    function getDateString(year, month, week, day) {
        const date = getDate(year, month, week, day);
        let dateString = date.toLocaleDateString();

        return dateString;
    }

    function formatDate(userDate) {
        var dateArr = userDate.split('/');
        if (dateArr[0].length == 1) {
            dateArr[0] = '0' + dateArr[0];
        } else if (dateArr[1].length == 1) {
            dateArr[1] = '0' + dateArr[1];
        }
        userDate = dateArr[2] + "-" + dateArr[0] + "-" + dateArr[1];
        return userDate + 'T00:00';
    }

    //Date preset functions
    //See autopilot code for docs
    var now = new Date().getTime();
    var nextyear = new Date().getFullYear() + 1;
    var thisyear = new Date().getFullYear();

    function MES() { //MCA End of School
        document.querySelector(".datepicker").value = '2025-05-23T11:30';
        SetCountDowngeneral();
    }
    function EASTER() { //Easter
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }

        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            document.querySelector(".datepicker").value = (getEaster(nextyear) + "T00:00");
        } else {
            document.querySelector(".datepicker").value = (getEaster(thisyear) + "T00:00");
        }
        SetCountDowngeneral();
    }
    function NYD() { //New Years Day
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-01-01T00:00';
        } else {
            document.querySelector(".datepicker").value = thisyear + '-01-01T00:00';
        }
        SetCountDowngeneral();
    }
    function VD() { //Valentines Day
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-02-14T00:00';
        } else {
            document.querySelector(".datepicker").value = thisyear + '-02-14T00:00';
        }
        SetCountDowngeneral();
    }

    function ID() { //Independence Day
        var independencethisyear = new Date(thisyear + "-07-04T00:00");
        if (independencethisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-07-04T00:00';
        } else {
            document.querySelector(".datepicker").value = thisyear + '-07-04T00:00';
        }
        SetCountDowngeneral();
    }
    function H() { //Halloween
        var halloweenthisyear = new Date(thisyear + "-10-31T00:00");
        if (halloweenthisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-10-31T00:00';
        } else {
            document.querySelector(".datepicker").value = thisyear + '-10-31T00:00';
        }
        SetCountDowngeneral();
    }
    function T() { //Thanksgiving
        var thanksgivingthisyear = new Date(formatDate(getDateString(thisyear, 10, 3, 4)));
        if (thanksgivingthisyear - now < 0) {
            document.querySelector(".datepicker").value = formatDate(getDateString(nextyear, 10, 3, 4));
        }
        else {
            document.querySelector(".datepicker").value = formatDate(getDateString(thisyear, 10, 3, 4));
        }
        SetCountDowngeneral();
    }
    function C() { //Christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-12-25T00:00';
        } else {
            document.querySelector(".datepicker").value = thisyear + '-12-25T00:00';
        }
        SetCountDowngeneral();
    }

        function autopilottab(){
            var now = new Date(); //getting the current date
            var nextyear = new Date().getFullYear() + 1; //setting up a next year variable
            var thisyear = new Date().getFullYear(); //setting up a this year variable

            //new years
            var newyearsthisyear = new Date(thisyear + "-01-01T00:00"); //setting up a this year variable for when new years day is in the current year
            if (newyearsthisyear - now < 0) { //if it's already passed
                newyearsday = new Date(nextyear + '-01-01T00:00'); //then set the countdown to new year's next year
            } else { //otherwise, if it's not passed yet
                newyearsday = new Date(thisyear + '-01-01T00:00'); //set the countdown to new year's this year
            }

            //valentines
            var valentinesthisyear = new Date(thisyear + "-02-14T00:00"); //see new years for docs
            if (valentinesthisyear - now < 0) {
                valentinessday = new Date(nextyear + '-02-14T00:00');
            } else {
                valentinessday = new Date(thisyear + '-02-14T00:00');
            }

            //easter
            var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
            //the above line calculates the moon's path to figure out when Easter is

            var easterthisyear = new Date(getEaster(thisyear) + "T00:00"); //see new years for docs, except it's calculating easter as it's not a set date
            if (easterthisyear - now < 0) {
                easterday = new Date(getEaster(nextyear) + "T00:00");
            } else {
                easterday = new Date(getEaster(thisyear) + "T00:00");
            }

            //independence
            var independencethisyear = new Date(thisyear + "-07-04T00:00"); //see new years for docs
            if (independencethisyear - now < 0) {
                independenceday = new Date(nextyear + '-07-04T00:00');
            } else {
                independenceday = new Date(thisyear + '-07-04T00:00');
            }

            //halloween
            var halloweenthisyear = new Date(thisyear + "-10-31T00:00"); //see new years for docs
            if (halloweenthisyear - now < 0) {
                halloweenday = new Date(nextyear + '-10-31T00:00');
            } else {
                halloweenday = new Date(thisyear + '-10-31T00:00');
            }

            //thanksgiving
            var thanksgivingthisyear = new Date(formatDate(getDateString(thisyear, 10, 3, 4))); //10th month, 3rd week, 4th day (thursday)
            if (thanksgivingthisyear - now < 0) { //see new years for docs
                thanksgivingday = new Date(formatDate(getDateString(nextyear, 10, 3, 4)));
            }
            else {
                thanksgivingday = new Date(formatDate(getDateString(thisyear, 10, 3, 4)));
            }

            //christmas
            var christmasthisyear = new Date(thisyear + "-12-25T00:00"); //see new years for doce
            if (christmasthisyear - now < 0) {
                christmasday = new Date(nextyear + '-12-25T00:00');
            } else {
                christmasday = new Date(thisyear + '-12-25T00:00');
            }


            // List of holiday dates
            const holidays = [
                {
                    name: 'newyear',
                    date: newyearsday
                },
                {
                    name: 'valentines',
                    date: valentinessday
                },
                {
                    name: 'easter',
                    date: easterday
                },
                {
                    name: 'independence',
                    date: independenceday
                },
                {
                    name: 'halloween',
                    date: halloweenday
                },
                {
                    name: 'thanksgiving',
                    date: thanksgivingday
                },
                {
                    name: 'christmas',
                    date: christmasday
                }
            ];

            // Now that all the holidays are in a list and we've calculated when they occur next, it'll find which is coming up the soonest
            var nextHoliday = holidays.reduce(function (closest, holiday) {
                var timeDiff = holiday.date.getTime() - now.getTime();
                return timeDiff > 0 && timeDiff < (closest.date.getTime() - now.getTime()) ? holiday : closest;
            }, holidays[0]);


            switch (nextHoliday.name) {
                case 'newyear':
                    NYD(); //run the NYD function to actually set the date and such to NYD
                    break;
                case 'valentines': //see NYD for docs
                    VD();
                    break;
                case 'easter': //see NYD for docs
                    EASTER();
                    break;
                case 'independence': //see NYD for docs
                    ID();
                    break;
                case 'halloween': //see NYD for docs
                    H();
                    break;
                case 'thanksgiving': //see NYD for docs
                    T();
                    break;
                case 'christmas': //see NYD for docs
                    C();
                    break;
                default:
                    // handle cases where nextHoliday.name doesn't match any of the above
                    console.error('Unexpected holiday name:', nextHoliday.name);
            }
        }


    function MESPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/mcaeoy.svg)";

        //set date
        MES();

        //set title
        document.getElementById("cdtitlesettings").value = "MCA End of School";
        setcountdowntitle("settings");
    }
    function NYDPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/nyd.svg)";

        //set date
        NYD();

        //set title
        document.getElementById("cdtitlesettings").value = "New Year's Day";
        setcountdowntitle("settings");
    }
    function VDPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/bonsai.svg)";

        //set date
        VD();

        //set title
        document.getElementById("cdtitlesettings").value = "Valentine's Day";
        setcountdowntitle("settings");

        SetCountDowngeneral();
    }
    function EASTERPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/wildflowers.svg)";

        //set date
        EASTER();

        //set title
        document.getElementById("cdtitlesettings").value = "Easter";
       setcountdowntitle("settings"); 
    }
    function IDPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/id.svg)";

        //set date
        ID();

        //set title
        document.getElementById("cdtitlesettings").value = "Independence Day";
       setcountdowntitle("settings"); 
    }
    function HPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/halloween.svg)";
        
        //set date
        H();

        //set title
        document.getElementById("cdtitlesettings").value = "Halloween";
       setcountdowntitle("settings"); 
    }
    function TPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/thanksgiving.svg)";
        
        //set date
        T();

        //set title
        document.getElementById("cdtitlesettings").value = "Thanksgiving";
       setcountdowntitle("settings"); 
    }
    function CPreset(){
        //set background
        document.getElementById("body").style.backgroundImage="url(Backgrounds/Presets/christmas.svg)";

        //set date
        C();
        
        //set title
        document.getElementById("cdtitlesettings").value = "Christmas";
       setcountdowntitle("settings"); 
    }


    //Link copy buttom
    function copyinputtextlink() {
        let linkinputfield = document.getElementById("linkinput"); //Get the value of the link input box
        navigator.clipboard.writeText(linkinputfield.value); //Save that value to clipboard
    }

    //Scrolling controls tabs box too
    const container = document.getElementById("tabs-box");
    container.addEventListener("wheel", function (e) {

        if (e.deltaY > 0) {
            container.scrollLeft += 200;
            e.preventDefault();
        }
        else {
            container.scrollLeft -= 200;
            e.preventDefault();
        }
    });

        //Scrolling controls presets tabs box too
        //const presetscontainer = document.getElementById("presetstabs-box");
    //presetscontainer.addEventListener("wheel", function (e) {

        //if (e.deltaY > 0) {
        //    presetscontainer.scrollLeft += 200;
        //    e.preventDefault();
       // }
       // else {
      //      presetscontainer.scrollLeft -= 200;
      //      e.preventDefault();
      //  }
   // });

    //Function to enable color when a background is disabled
    function enablecolor() {
        document.getElementById("color1").classList.add("colorpicker");
        document.getElementById("color1").classList.remove("disabledcolorpicker");
        document.getElementById("color2").classList.add("colorpicker");
        document.getElementById("color2").classList.remove("disabledcolorpicker");
        document.getElementById("color3").classList.add("colorpicker");
        document.getElementById("color3").classList.remove("disabledcolorpicker");
        document.getElementById("color4").classList.add("colorpicker");
        document.getElementById("color4").classList.remove("disabledcolorpicker");
    }

    //Function to disable color when a background is enabled
    function disablecolor() {
        document.getElementById("color1").classList.remove("colorpicker");
        document.getElementById("color1").classList.add("disabledcolorpicker");
        document.getElementById("color2").classList.remove("colorpicker");
        document.getElementById("color2").classList.add("disabledcolorpicker");
        document.getElementById("color3").classList.remove("colorpicker");
        document.getElementById("color3").classList.add("disabledcolorpicker");
        document.getElementById("color4").classList.remove("colorpicker");
        document.getElementById("color4").classList.add("disabledcolorpicker");
    }

    function setbg(bgint, method) {
        if ((method != "auto") && (parameter("atc") == bgint)) {
            //the selected background is already the set background - turn off background
            enablecolor();
            document.getElementById("animatedbackground").style.opacity = "0"; //fade out the animated background (as it has a transition property for opacity)
            setTimeout(() => {
                document.getElementById("animatedbackground").style.display = "none"; //in one second when the fade is done, hide the background
            }, 1000);
            bgstring = "none";

            bggotdisabled = "true";
        }
        else if ((parameter("atc") == "none") && bgint != "none") {
            //param is none, but the selected background is not - turn on and set background
            disablecolor();
            //grey out color pickers and theme color for background
            document.getElementById("animatedbackground").classList.remove("hidden"); //unhide background
            document.getElementById("animatedbackground").style.zIndex = "-3"; //set the bg to be behind all other elements
            document.getElementById("animatedbackground").style.position = "fixed"; //fixed position so it stays even when scrolled
            document.getElementById("bg1").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            document.getElementById("bg2").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            bgstring = bgint;
            document.getElementById("animatedbackground").style.display = "";
            document.getElementById("animatedbackground").style.opacity = "1"; //fade out the animated background (as it has a transition property for opacity)

            bggotdisabled = "false";
        }
        else if ((parameter("atc") != "none") && (document.getElementById("bg1").src != "Backgrounds/enhancedbackground_" + bgint + ".png")) {
            //parameter is not none, but the selected and set backgrounds are different - change the bg w/o turning on or off
            document.getElementById("bg1").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            document.getElementById("bg2").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            bgstring = bgint;

            bggotdisabled = "false";
        }
        else {
            //catchall for errors too but primarily for and should only be pinged when not using atc
            enablecolor();
            document.getElementById("animatedbackground").style.opacity = "0"; //fade out the animated background (as it has a transition property for opacity)
            setTimeout(() => {
                document.getElementById("animatedbackground").style.display = ""; //in one second when the fade is done, hide delete the background
            }, 1000);
            
            bgstring = "none";
            bggotdisabled = "true";
        }

        //for loop that adds selected and normal bgbutton classes

        const buttons = document.querySelectorAll('.bgbtnn');

        for (const button of buttons) {
            const buttonId = button.id.slice(5); // remove bgbtn get number

            if (bggotdisabled == "true" && button.classList.contains("selectedbackgroundpicker")) {
                button.classList.remove('selectedbackgroundpicker');
                button.classList.add('backgroundpicker');
            }
            else {
                if (bgint == buttonId) {
                    button.classList.add('selectedbackgroundpicker');
                    button.classList.remove('backgroundpicker');
                }
                else {
                    button.classList.remove('selectedbackgroundpicker');
                    button.classList.add('backgroundpicker');
                }
            }
        }

        SetCountDowngeneral();

    }


    //QR code generation
    function makeQR() {
        const qrcode = document.getElementById("qrcode");
        const qrCanvas = qrcode.getElementsByTagName('canvas')[0];  // Get the canvas element

        if (qrCanvas) {
            qrCanvas.getContext('2d').clearRect(0, 0, qrCanvas.width, qrCanvas.height); // Clear only if canvas exists
        }

        document.getElementById('qrcode').innerHTML = '';

        function imgQR(qrCanvas, centerImage, factor) {
            var h = qrCanvas.height;
            var cs = h * factor;
            var co = (h - cs) / 2;
            var ctx = qrCanvas.getContext("2d");
            ctx.drawImage(centerImage, 0, 0, centerImage.width, centerImage.height, co, co, cs, cs);
        }
        const icon = new Image();
        icon.onload = function generateQR() {
            var qrcode = new QRCode(document.getElementById("qrcode"), {
                text: "https://michaeldors.com/mcacountdown/timer.html?date=" + parameter('date') + "?colorone=" + parameter('colorone') + "?colortwo=" + parameter('colortwo') + "?colorthree=" + parameter('colorthree') + "?colorfour=" + parameter('colorfour'),
                width: 150,
                height: 150,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            imgQR(qrcode._oDrawing._elCanvas, this, 0.3)
        }
        icon.src = 'icon.ico';

    }

    //Shareable QR Code download
    function downloadQR() {
        var imageContainer = document.getElementById('qrcode');
        var imageElement = imageContainer.querySelector('img');

        var imageData = imageElement.src;

        var downloadLink = document.createElement('a');
        downloadLink.href = imageData;
        downloadLink.download = 'mdcountdownqrcode.png';

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    //Autopilot animation
    const autocircle = document.querySelector('.autopilot-countdown-circle .progressbarr');
    let autocountdown = 10000;
    let autocountdownInterval;

    function updateCountdown() {
        const length = autocircle.getTotalLength();
        if(autocircle){
            const offset = length - (length * (10000 + autocountdown) / 10000);
            autocircle.style.strokeDashoffset = offset;
            if (autocountdown < 1) {
                document.getElementById("autopilotpopup").style.opacity = "0";
                document.getElementById("autopilotpopupmobile").style.opacity = "0";

                autocircle.remove();
            }
            if (autocountdown === "-0") {
                clearInterval(autocountdownInterval);
                document.getElementById("autopilotpopup").remove();
                document.getElementById("autopilotpopupmobile").remove();
            }
            autocountdown -= 10;
        }else{
            clearInterval(autocountdownInterval);
        }
    }

    if(autocircle){
    autocountdownInterval = setInterval(updateCountdown, 10);
    }

    //close the autopilot popup
    function closeautopanel() {
        document.getElementById("autopilotpopup").style.opacity = "0";
        document.getElementById("autopilotpopupmobile").style.opacity = "0";
    }


    //set Fredoka font
    function FontFredoka(method) {
        document.querySelector(':root').style.setProperty('--typeface', 'Fredoka One');
        document.querySelector(':root').style.setProperty('--comptypeface', 'Dosis');

        document.getElementById("fredoka").classList.add("selectedfontpicker");
        document.getElementById("poppins").classList.remove("selectedfontpicker");
        document.getElementById("poppins").classList.add("fontpicker");
        document.getElementById("dmserif").classList.remove("selectedfontpicker");
        document.getElementById("dmserif").classList.add("fontpicker");
        document.getElementById("orbitron").classList.remove("selectedfontpicker");
        document.getElementById("orbitron").classList.add("fontpicker");

        document.getElementById("schedule-classTitle").style.textTransform = "initial";

        if (method == "Manual") {
            SetCountDowngeneral();
        }
    }

    //set Poppins font
    function FontPoppins(method) {
        document.querySelector(':root').style.setProperty('--typeface', 'Poppins');
        document.querySelector(':root').style.setProperty('--comptypeface', 'Poppins');

        document.getElementById("fredoka").classList.remove("selectedfontpicker");
        document.getElementById("fredoka").classList.add("fontpicker");
        document.getElementById("poppins").classList.add("selectedfontpicker");
        document.getElementById("dmserif").classList.remove("selectedfontpicker");
        document.getElementById("dmserif").classList.add("fontpicker");
        document.getElementById("orbitron").classList.remove("selectedfontpicker");
        document.getElementById("orbitron").classList.add("fontpicker");

        document.getElementById("schedule-classTitle").style.textTransform = "initial";

        if (method == "Manual") {
            SetCountDowngeneral();
        }
    }

    //set DM Serif font, previously Yeseva
    function FontDMSerif(method) {
        document.querySelector(':root').style.setProperty('--typeface', 'DM Serif Display');
        document.querySelector(':root').style.setProperty('--comptypeface', 'Castoro');

        document.getElementById("fredoka").classList.remove("selectedfontpicker");
        document.getElementById("fredoka").classList.add("fontpicker");
        document.getElementById("poppins").classList.remove("selectedfontpicker");
        document.getElementById("poppins").classList.add("fontpicker");
        document.getElementById("dmserif").classList.add("selectedfontpicker");
        document.getElementById("orbitron").classList.remove("selectedfontpicker");
        document.getElementById("orbitron").classList.add("fontpicker");

        document.getElementById("schedule-classTitle").style.textTransform = "initial";

        if (method == "Manual") {
            SetCountDowngeneral();
        }
    }

    //set Orbitron font
    function FontOrbitron(method) {
        document.querySelector(':root').style.setProperty('--typeface', 'Orbitron');
        document.querySelector(':root').style.setProperty('--comptypeface', 'Ubuntu');

        document.getElementById("fredoka").classList.remove("selectedfontpicker");
        document.getElementById("fredoka").classList.add("fontpicker");
        document.getElementById("poppins").classList.remove("selectedfontpicker");
        document.getElementById("poppins").classList.add("fontpicker");
        document.getElementById("dmserif").classList.remove("selectedfontpicker");
        document.getElementById("dmserif").classList.add("fontpicker");
        document.getElementById("orbitron").classList.add("selectedfontpicker");

        document.getElementById("schedule-classTitle").style.textTransform = "uppercase";

        if (method == "Manual") {
            SetCountDowngeneral();
        }
    }


    document.getElementById("body").addEventListener("mousemove", function (event) {
        // Get element dimensions
        const rect = document.getElementById("countdowntitle").getBoundingClientRect();

        // Calculate distance from mouse to center of element
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distanceX = Math.abs(event.clientX - centerX);
        const distanceY = Math.abs(event.clientY - centerY);
        const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

        // Normalize distance to 0-1 based on threshold (300px)
        const opacity = Math.max(0, 1 - distance / 300) / 3;

        // Set element opacity
        document.getElementById("countdowntitle").style.border = `1px solid rgba(255, 255, 255, ${opacity})`;
    });

    //set countdown title
    function setcountdowntitle(from) {
        var fronttitlepicker = document.getElementById("countdowntitle");
        var settingstitlepicker = document.getElementById("cdtitlesettings");
        if (from == 'settings') { //if it's set from settings, set the front one
            fronttitlepicker.value = settingstitlepicker.value;
        }

        if (from == 'front') { //if it's set from the front, set from settings
            settingstitlepicker.value = fronttitlepicker.value;
        }

        SetCountDowngeneral();
    }

    //generate a random color when adding colors to the text animation
    function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

    let colorPickerCount = 4;

    //create a new color picker
function addColorPicker() {
    if (colorPickerCount < 8) {
        colorPickerCount++;
        const container = document.getElementById('colorPickersContainer');
        const newColorPickerContainer = document.createElement('div');
        newColorPickerContainer.className = 'colorpicker-container';

        const newColorPicker = document.createElement('input');
        newColorPicker.className = 'colorpicker';
        newColorPicker.id = `color${colorPickerCount}`;
        newColorPicker.type = 'color';
        newColorPicker.value = getRandomColor();
        newColorPicker.onblur = SetCountDowngeneral;

        const removeButton = document.createElement('div');
        removeButton.className = 'remove-button';
        removeButton.innerHTML = '-';
        removeButton.onclick = function() { removeColorPicker(removeButton); };

        newColorPickerContainer.appendChild(newColorPicker);
        newColorPickerContainer.appendChild(removeButton);

        container.appendChild(newColorPickerContainer);

        if(document.querySelector(".colorpickerlinebreak")){
        document.querySelector(".colorpickerlinebreak").remove();
        }
        const colorpickersocontainer = document.getElementById('colorPickersContainer');
        if (colorpickersocontainer.children.length > 4) {
            const newBR = document.createElement('br');
            newBR.className = 'colorpickerlinebreak';
            colorpickersocontainer.insertBefore(newBR, colorpickersocontainer.children[4]);
        }
        
        if(colorpickersocontainer.children.length > 8){
            document.querySelector(".clradd").classList.add("clraddoff");
        }
        else{
            document.querySelector(".clradd").classList.remove("clraddoff");
        }
        newColorPicker.focus();
        newColorPicker.click();


        adjustHeightOfColorPickerContainer();
        SetCountDowngeneral();
    }
}

//remove the color picker that the clicked remove button is appended to
function removeColorPicker(button) {
    const container = button.parentElement;
    container.style.transform = 'scale(0)';
    setTimeout(() => {
    container.remove();
    colorPickerCount--;
    const colorpickersocontainer = document.getElementById('colorPickersContainer');
    if(document.querySelector(".colorpickerlinebreak")){
        document.querySelector(".colorpickerlinebreak").remove();
    }
        if (colorpickersocontainer.children.length > 4) {
            const newBR = document.createElement('br');
            newBR.className = 'colorpickerlinebreak';
            colorpickersocontainer.insertBefore(newBR, colorpickersocontainer.children[4]);
        }

        if(colorpickersocontainer.children.length > 8){
            document.querySelector(".clradd").classList.add("clraddoff");
        }
        else{
            document.querySelector(".clradd").classList.remove("clraddoff");
        }
    
    adjustHeightOfColorPickerContainer();
    SetCountDowngeneral();
    }, 300);
}

//adjusts the height of color picker container. is called after any changes
function adjustHeightOfColorPickerContainer() {
    const container = document.getElementById('colorPickersContainer');
    const children = container.children;
    let numRows = Math.ceil(children.length / 4); // Calculate the number of rows (1 or 2)
    let maxHeight = 0;

    // Find the maximum height of a single color picker (assuming uniform height for simplicity)
    for (let i = 0; i < children.length; i++) {
        if (children[i].offsetHeight > maxHeight) {
            maxHeight = children[i].offsetHeight;
        }
    }

    // Adjust numRows calculation to avoid extra spacing when exactly 8 pickers are present
    if (children.length === 9) {
        numRows = 2; // Explicitly set to 2 rows when there are exactly 8 children
    }

    // Set the container height based on the number of rows and the maximum height of a single row
    container.style.height = `${numRows * maxHeight}px`;
}

//Countdown Schedule 
let schedule_events = [];
        let schedule_exceptions = {};
        let schedule_editingEvent = null;
        let schedule_editingExceptionDay = null;

        function schedule_encodeSchedule() {
            return btoa(JSON.stringify({ schedule_events, schedule_exceptions }));
        }

        function schedule_decodeSchedule(encoded) {
            try {
                const decoded = JSON.parse(atob(encoded));
                return {
                    schedule_events: decoded.schedule_events || [],
                    schedule_exceptions: decoded.schedule_exceptions || {}
                };
            } catch (e) {
                console.error('Failed to decode schedule:', e);
                return { schedule_events: [], schedule_exceptions: {} };
            }
        }

        function schedule_updateURL() {
            const encoded = schedule_encodeSchedule();
            history.replaceState(null, '', `?schedule=${encoded}`);
		SetCountDowngeneral();
        }

	function startCountdownSchedule(){
		history.replaceState(null, '', `?schedule=eyJzY2hlZHVsZV9ldmVudHMiOltdLCJzY2hlZHVsZV9leGNlcHRpb25zIjp7fX0=`);
		document.querySelector(".datepicker").value = '9999-12-30T00:00';

        	if(parameter("atc") == "none"){
            		document.getElementById("schedule-currentClass").classList.add("schedulebgcolored");
        	}
        	else{
            		document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
        	}
	     SetCountDowngeneral();

	document.getElementById("clock").style.display = "none"; //hide clock
        document.getElementById("countdowntitle").style.display = "none"; //hide title
	document.getElementById("optionsdatecontainer").style.display = "none"; //hide end date area of options
	document.getElementById("optionsendingcontainer").style.display = "none"; //hide ending options area of options	
	document.getElementById("optionsendinganchor").style.opacity = "0.5"; //grey out ending options anchor 	
	document.getElementById("optionsprogresscontainer").style.display = "none"; //hide ending options area of options
	document.getElementById("optionsprogressanchor").style.opacity = "0.5"; //grey out progress options anchor	
	document.getElementById("cdscheduledisclaimer").style.display = ""; //show personal options schedule disclaimer

	document.querySelector(".schedule-editor").style.display = ""; //show the schedule editor
	document.getElementById("presetupScheduleContent").style.display = "none"; //hide the info preconversion popup
	}

        function schedule_resetAll(){
            history.replaceState(null, '', `?schedule=null`);
            schedule_loadScheduleFromURL();
        }

        function schedule_loadScheduleFromURL() {
            const encodedSchedule = parameter('schedule');
            if (encodedSchedule && encodedSchedule !== "null") {
                const decoded = schedule_decodeSchedule(encodedSchedule);
                schedule_events = decoded.schedule_events;
                schedule_exceptions = decoded.schedule_exceptions;
                schedule_updateEventList();
                schedule_updateExceptionList();
            }
        }

        function schedule_addOrUpdateEvent() {
            const title = document.getElementById('schedule-eventTitle').value;
            const startTime = document.getElementById('schedule-startTime').value;
            const endTime = document.getElementById('schedule-endTime').value;

            if (title && startTime && endTime) {
                const newEvent = { title, startTime, endTime };
                if (schedule_editingEvent) {
                    // Update existing event
                    if (schedule_editingExceptionDay !== null) {
                        const index = schedule_exceptions[schedule_editingExceptionDay].findIndex(e => e === schedule_editingEvent);
                        if (index !== -1) {
                            schedule_exceptions[schedule_editingExceptionDay][index] = newEvent;
                        }
                    } else {
                        const index = schedule_events.indexOf(schedule_editingEvent);
                        if (index !== -1) {
                            schedule_events[index] = newEvent;
                        }
                    }
                } else {
                    // Add new event
                    if (schedule_editingExceptionDay !== null) {
                        if (!schedule_exceptions[schedule_editingExceptionDay]) {
                            schedule_exceptions[schedule_editingExceptionDay] = [];
                        }
                        schedule_exceptions[schedule_editingExceptionDay].push(newEvent);
                    } else {
                        schedule_events.push(newEvent);
                    }
                }

                if (schedule_editingExceptionDay !== null) {
                    schedule_exceptions[schedule_editingExceptionDay].sort((a, b) => a.startTime.localeCompare(b.startTime));
                } else {
                    schedule_events.sort((a, b) => a.startTime.localeCompare(b.startTime));
                }

                schedule_updateEventList();
                schedule_updateExceptionList();
                schedule_resetForm();
                schedule_updateURL();
                schedule_updateScheduleViewer();
            }
        }

        function schedule_editEvent(event, isException = false, day = null) {
            schedule_editingEvent = event;
            schedule_editingExceptionDay = isException ? day : null;
            document.getElementById('schedule-eventTitle').value = event.title;
            document.getElementById('schedule-startTime').value = event.startTime;
            document.getElementById('schedule-endTime').value = event.endTime;
            document.getElementById('schedule-addOrUpdateEventBtn').innerHTML = '<i class="fa-solid fa-check-circle"></i> Update Event';
		document.getElementById("schedule-eventTitle").scrollIntoView();
        }

        function schedule_removeEvent(index, isException = false, day = null) {
            if (isException) {
                schedule_exceptions[day].splice(index, 1);
                if (schedule_exceptions[day].length === 0) {
                    delete schedule_exceptions[day];
                }
            } else {
                schedule_events.splice(index, 1);
            }
            schedule_updateEventList();
            schedule_updateExceptionList();
            schedule_updateURL();
            schedule_updateScheduleViewer();
        }

        function schedule_addExceptionDay() {
            const day = document.getElementById('schedule-exceptionDay').value;
            if (!schedule_exceptions[day]) {
                schedule_exceptions[day] = [];
            }
            schedule_updateExceptionList();
            schedule_updateURL();
            schedule_updateScheduleViewer();
        }

        function schedule_removeExceptionDay(day) {
            delete schedule_exceptions[day];
            schedule_updateExceptionList();
            schedule_updateURL();
            schedule_updateScheduleViewer();
        }

        function schedule_updateEventList() {
            const eventList = document.getElementById('schedule-eventList');
            eventList.innerHTML = '';
            schedule_events.forEach((event, index) => {
                const li = document.createElement('li');
                li.className = 'schedule-event-item';
                li.innerHTML = `
                    <h1>${event.title}</h1><br>
                    <p>Start: ${schedule_formatTime(event.startTime)}<br>
                    End: ${schedule_formatTime(event.endTime)}<br></p>
                    <a onclick="schedule_editEvent(schedule_events[${index}])"><i class="fa-solid fa-pencil"></i> Edit</a>
                    <a class="warning" onclick="schedule_removeEvent(${index})"><i class="fa-solid fa-trash"></i> Remove</a>
                    <br>
                    <br>
                `;
                eventList.appendChild(li);
            });
        }

        function schedule_updateExceptionList() {
            const exceptionList = document.getElementById('schedule-exceptionList');
            exceptionList.innerHTML = '';
            for (const [day, dayEvents] of Object.entries(schedule_exceptions)) {
                const dayDiv = document.createElement('div');
                dayDiv.className = 'schedule-exception-day';
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
                dayDiv.innerHTML = `
                    <button class="schedule-collapsible" style="font-family: Fredoka One; font-size: 20px;" onclick="schedule_toggleCollapsible(this)">${dayName}       
		    	<div style="position:absolute; right:15%;">
       				<a onclick="schedule_editEvent(null, true, '${day}')">Add Event</a>
                        	<a class="warning" onclick="schedule_removeExceptionDay('${day}')"><i class="fa-solid fa-trash"></i></a>
       			</div>
		    </button>
                    <div class="schedule-content">
                        <br>
                        <br>
                        <ul style="list-style-type:none; margin:0; padding:0;">
                            ${dayEvents.map((event, index) => `
                                <li class="schedule-exception-item">
                                    <h1>${event.title}</h1><br>
                                    <p>Start: ${schedule_formatTime(event.startTime)}<br>
                                    End: ${schedule_formatTime(event.endTime)}<br></p>
                                    <a onclick="schedule_editEvent(schedule_exceptions['${day}'][${index}], true, '${day}')"><i class="fa-solid fa-pencil"></i> Edit</a>
                                    <a class="warning" onclick="schedule_removeEvent(${index}, true, '${day}')"> <i class="fa-solid fa-trash"></i> Remove</a>
                                    <br>
                                    <br>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
                exceptionList.appendChild(dayDiv);
            }
        }

        function schedule_resetForm() {
            document.getElementById('schedule-eventTitle').value = '';
            document.getElementById('schedule-startTime').value = '';
            document.getElementById('schedule-endTime').value = '';
            document.getElementById('schedule-addOrUpdateEventBtn').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add Event';
            schedule_editingEvent = null;
            schedule_editingExceptionDay = null;
        }

        function schedule_getScheduleForDay(date) {
            const dayOfWeek = date.getDay().toString();
            return schedule_exceptions[dayOfWeek] || schedule_events;
        }

        function schedule_formatTime(time) {
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const formattedHour = hour % 12 || 12;
            return `${formattedHour}:${minutes} ${ampm}`;
        }

        function schedule_updateScheduleViewer() {
            const now = new Date();
            const currentSchedule = schedule_getScheduleForDay(now);
            
            if (currentSchedule.length === 0) {
                schedule_showTomorrowSchedule();
                return;
            }

            let currentEvent = null;
            let upcomingEvents = [];

            for (let i = 0; i < currentSchedule.length; i++) {
                const event = currentSchedule[i];
                const [startHours, startMinutes] = event.startTime.split(':');
                const [endHours, endMinutes] = event.endTime.split(':');
                const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHours, startMinutes);
                const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHours, endMinutes);

                if (now >= startTime && now < endTime) {
                    currentEvent = { ...event, startTime, endTime };
                    upcomingEvents = currentSchedule.slice(i + 1);
                    break;
                } else if (now < startTime) {
                    currentEvent = { ...event, startTime, endTime, isUpcoming: true };
                    upcomingEvents = currentSchedule.slice(i + 1);
                    break;
                }
            }

            if (currentEvent) {
                document.getElementById('schedule-classTitle').textContent = currentEvent.title;
                if (currentEvent.isUpcoming) {
                    const timeUntilStart = currentEvent.startTime - now;
                    const minutesUntilStart = Math.floor(timeUntilStart / 60000);
                    const secondsUntilStart = Math.floor((timeUntilStart % 60000) / 1000);
                    document.getElementById('schedule-timeRemaining').textContent = `${minutesUntilStart}:${secondsUntilStart.toString().padStart(2, '0')}`;
                    document.getElementById('schedule-remainingText').textContent = 'starting';
                    document.getElementById('schedule-progress').style.width = '0%';
                    document.title = "Event Starting Soon";
                } else {
                    const remainingTime = currentEvent.endTime - now;
                    const totalDuration = currentEvent.endTime - currentEvent.startTime;
                    const progress = 100 - (remainingTime / totalDuration * 100);
                    document.getElementById('schedule-progress').style.width = `${progress}%`;

                    const minutes = Math.floor(remainingTime / 60000);
                    const seconds = Math.floor((remainingTime % 60000) / 1000);
                    document.getElementById('schedule-timeRemaining').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    document.getElementById('schedule-remainingText').textContent = 'remaining';
			if(Math.round(remainingTime/60000) > 1){
		    		document.title = currentEvent.title + " | " + Math.round(remainingTime/60000) + " mins remaining";
                	}else{
				document.title = currentEvent.title + " | " + Math.round(remainingTime/60000) + " min remaining";
			}
                }
            } else {
                schedule_showTomorrowSchedule();
                return;
            }

            const upcomingClassesEl = document.getElementById('schedule-upcomingClasses');
            upcomingClassesEl.innerHTML = '';
            upcomingEvents.forEach(event => {
                const [startHours, startMinutes] = event.startTime.split(':');
                const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHours, startMinutes);
                const timeUntilStart = startTime - now;
                const minutesUntilStart = Math.floor(timeUntilStart / 60000);
                const upcomingEl = document.createElement('div');
                upcomingEl.className = 'schedule-upcoming-class';
                upcomingEl.innerHTML = `
                    <div class="schedule-upcoming-class-title">${event.title}</div>
                    <div class="schedule-upcoming-class-time">
                        <div><i class="fa-regular fa-clock"></i> In ${minutesUntilStart} min</div>
                        <div><i class="fa-regular fa-calendar"></i> ${schedule_formatTime(event.startTime)} - ${schedule_formatTime(event.endTime)}</div>
                    </div>
                `;
                upcomingClassesEl.appendChild(upcomingEl);
            });
        }

        function schedule_showTomorrowSchedule() {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const tomorrowSchedule = schedule_getScheduleForDay(tomorrow);

            if (tomorrowSchedule.length === 0) {
                document.getElementById('schedule-classTitle').innerHTML = '<i class="fa-solid fa-calendar-check"></i> Enjoy your day!<p>There are no events on your schedule- enjoy the free time!</p>';
                document.getElementById('schedule-timeRemaining').textContent = '';
                document.getElementById('schedule-remainingText').textContent = '';
                document.getElementById('schedule-progress').style.width = '0%';
                document.getElementById('schedule-upcomingClasses').innerHTML = '';
                return;
            }

            const firstEvent = tomorrowSchedule[0];
            const [startHours, startMinutes] = firstEvent.startTime.split(':');
            const startTime = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), startHours, startMinutes);
            const timeUntilStart = startTime - new Date();
            const hoursUntilStart = Math.floor(timeUntilStart / 3600000);
            const minutesUntilStart = Math.floor((timeUntilStart % 3600000) / 60000);

            document.getElementById('schedule-classTitle').textContent = `${firstEvent.title}`;
            document.getElementById('schedule-timeRemaining').textContent = `${hoursUntilStart}:${minutesUntilStart.toString().padStart(2, '0')}`;
            document.getElementById('schedule-remainingText').textContent = 'starting';
            document.getElementById('schedule-progress').style.width = '0%';

            const upcomingClassesEl = document.getElementById('schedule-upcomingClasses');
            tomorrowSchedule.forEach(event => {
                const upcomingEl = document.createElement('div');
                upcomingEl.className = 'schedule-upcoming-class';
                upcomingEl.innerHTML = `
                    <div class="schedule-upcoming-class-title">${event.title}</div>
                    <div class="schedule-upcoming-class-time">
                        <div>${schedule_formatTime(event.startTime)} - ${schedule_formatTime(event.endTime)}</div>
                    </div>
                `;
                upcomingClassesEl.appendChild(upcomingEl);
            });
        }

        function schedule_toggleCollapsible(button) {
            button.classList.toggle("active");
            var content = button.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        }

        document.getElementById('schedule-addOrUpdateEventBtn').addEventListener('click', schedule_addOrUpdateEvent);
        document.getElementById('schedule-addExceptionBtn').addEventListener('click', schedule_addExceptionDay);

        // Load schedule from URL when the page loads
        window.addEventListener('load', () => {
            schedule_loadScheduleFromURL();
            schedule_updateScheduleViewer();
            setInterval(schedule_updateScheduleViewer, 1000);
        });


        //ending sound

        let player;

function playAudio() {
    const link = document.getElementById('audioLink').value;
    const playerContainer = document.getElementById('playerContainer');
    playerContainer.innerHTML = '';

    if (link.includes('youtube.com') || link.includes('youtu.be')) {
        playYouTube(link);
    } else if (link.includes('soundcloud.com')) {
        playSoundCloud(link);
    } else {
        playDirectAudio(link);
    }
}

function playYouTube(link) {
    const videoId = extractYouTubeId(link);
    if (!videoId) {
        alert('Invalid YouTube URL');
        return;
    }

    const iframe = document.createElement('iframe');
    iframe.width = "0";
    iframe.height = "0";
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    iframe.allow = "autoplay";
    document.getElementById('playerContainer').appendChild(iframe);
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function playSoundCloud(link) {
    const iframe = document.createElement('iframe');
    iframe.width = "0";
    iframe.height = "0";
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&auto_play=true`;
    document.getElementById('playerContainer').appendChild(iframe);
}

function playDirectAudio(link) {
    const audio = document.createElement('audio');
    audio.src = link;
    audio.style.display = 'none';
    audio.autoplay = true;
    document.getElementById('playerContainer').appendChild(audio);
}

function savetodash() {
    const url = window.location.href; // Get the current page URL
    const urlObj = new URL(url);
    title = urlObj.searchParams.get('title') || '';
    // If no title found in URL, use the date as a fallback
    if (!title) {
        const dateStr = urlObj.searchParams.get('date') || '';
        if (dateStr) {
            const date = new Date(dateStr);
            const options = { year: '2-digit', month: '2-digit', day: '2-digit' };
            title = date.toLocaleDateString('en-US', options);
            }
        }

    // Get the existing links from the cookie
    const savedLinks = localStorage.getItem("dashboardsaved");
    let links = savedLinks ? JSON.parse(savedLinks) : [];

    // Add the new link
    links.push({ url, title: title || '' });

    // Save the updated links back to the cookie
    localStorage.setItem('dashboardsaved', JSON.stringify(links), 70);

    window.location.href = "https://michaeldors.com/mcacountdown/countdowndashboard.html";
}

function magictitle(){
    if(parameter("schedule") !== "null" && parameter("schedule")){
        document.getElementById("countdowntitle").value = "Schedule";
        document.getElementById("magictitle").classList.add("magictitle-success");
        setTimeout(function() {
            document.getElementById("magictitle").classList.remove("magictitle-success");
        }, 500);
    }
    else{
            var now = new Date(); //getting the current date
            var nextyear = new Date().getFullYear() + 1; //setting up a next year variable
            var thisyear = new Date().getFullYear(); //setting up a this year variable

            //new years
            var newyearsthisyear = new Date(thisyear + "-01-01T00:00"); //setting up a this year variable for when new years day is in the current year
            if (newyearsthisyear - now < 0) { //if it's already passed
                newyearsday = new Date(nextyear + '-01-01T00:00'); //then set the countdown to new year's next year
            } else { //otherwise, if it's not passed yet
                newyearsday = new Date(thisyear + '-01-01T00:00'); //set the countdown to new year's this year
            }

            //valentines
            var valentinesthisyear = new Date(thisyear + "-02-14T00:00"); //see new years for docs
            if (valentinesthisyear - now < 0) {
                valentinessday = new Date(nextyear + '-02-14T00:00');
            } else {
                valentinessday = new Date(thisyear + '-02-14T00:00');
            }

            //easter
            var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
            //the above line calculates the moon's path to figure out when Easter is

            var easterthisyear = new Date(getEaster(thisyear) + "T00:00"); //see new years for docs, except it's calculating easter as it's not a set date
            if (easterthisyear - now < 0) {
                easterday = new Date(getEaster(nextyear) + "T00:00");
            } else {
                easterday = new Date(getEaster(thisyear) + "T00:00");
            }

            //independence
            var independencethisyear = new Date(thisyear + "-07-04T00:00"); //see new years for docs
            if (independencethisyear - now < 0) {
                independenceday = new Date(nextyear + '-07-04T00:00');
            } else {
                independenceday = new Date(thisyear + '-07-04T00:00');
            }

            //halloween
            var halloweenthisyear = new Date(thisyear + "-10-31T00:00"); //see new years for docs
            if (halloweenthisyear - now < 0) {
                halloweenday = new Date(nextyear + '-10-31T00:00');
            } else {
                halloweenday = new Date(thisyear + '-10-31T00:00');
            }

            //thanksgiving
            var thanksgivingthisyear = new Date(formatDate(getDateString(thisyear, 10, 3, 4))); //10th month, 3rd week, 4th day (thursday)
            if (thanksgivingthisyear - now < 0) { //see new years for docs
                thanksgivingday = new Date(formatDate(getDateString(nextyear, 10, 3, 4)));
            }
            else {
                thanksgivingday = new Date(formatDate(getDateString(thisyear, 10, 3, 4)));
            }

            //christmas
            var christmasthisyear = new Date(thisyear + "-12-25T00:00"); //see new years for doce
            if (christmasthisyear - now < 0) {
                christmasday = new Date(nextyear + '-12-25T00:00');
            } else {
                christmasday = new Date(thisyear + '-12-25T00:00');
            }


            // List of holiday dates
            const holidays = [
                {
                    name: 'newyear',
                    date: newyearsday
                },
                {
                    name: 'valentines',
                    date: valentinessday
                },
                {
                    name: 'easter',
                    date: easterday
                },
                {
                    name: 'independence',
                    date: independenceday
                },
                {
                    name: 'halloween',
                    date: halloweenday
                },
                {
                    name: 'thanksgiving',
                    date: thanksgivingday
                },
                {
                    name: 'christmas',
                    date: christmasday
                }
            ];

            // Now that all the holidays are in a list, we'll find the holiday that matches the current datepicker input value
            var selectedDate = new Date(document.querySelector(".datepicker").value);
            var matchingHoliday = holidays.find(function (holiday) {
                return holiday.date.toDateString() === selectedDate.toDateString();
            }) || { name: 'none', date: null }; // Default to none if no match is found


            switch (matchingHoliday.name) {
                case 'newyear':
                document.getElementById("countdowntitle").value = "New Year's Day";
                document.getElementById("magictitle").classList.add("magictitle-success");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-success");
                    }, 500);
                setcountdowntitle("front"); 
                    break;
                case 'valentines': //see NYD for docs
                document.getElementById("countdowntitle").value = "Valentine's Day";
                document.getElementById("magictitle").classList.add("magictitle-success");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-success");
                    }, 500);
                setcountdowntitle("front"); 
                    break;
                case 'easter': //see NYD for docs
                document.getElementById("countdowntitle").value = "Easter";
                document.getElementById("magictitle").classList.add("magictitle-success");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-success");
                    }, 500);
                setcountdowntitle("front"); 
                    break;
                case 'independence': //see NYD for docs
                document.getElementById("countdowntitle").value = "Independence Day";
                document.getElementById("magictitle").classList.add("magictitle-success");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-success");
                    }, 500);
                setcountdowntitle("front"); 
                    break;
                case 'halloween': //see NYD for docs
                document.getElementById("countdowntitle").value = "Halloween";
                document.getElementById("magictitle").classList.add("magictitle-success");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-success");
                    }, 500);
                setcountdowntitle("front"); 
                    break;
                case 'thanksgiving': //see NYD for docs
                document.getElementById("countdowntitle").value = "Thanksgiving";
                document.getElementById("magictitle").classList.add("magictitle-success");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-success");
                    }, 500);
                setcountdowntitle("front"); 
                    break;
                case 'christmas': //see NYD for docs
                document.getElementById("countdowntitle").value = "Christmas";
                document.getElementById("magictitle").classList.add("magictitle-success");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-success");
                    }, 500);
                setcountdowntitle("front");
                    break;
                default:
                    // handle cases where nextHoliday.name doesn't match any of the above
                    console.error('Magic Title did not find a matching holiday.');
                    document.getElementById("magictitle").classList.add("magictitle-failed");
                    setTimeout(function() {
                        document.getElementById("magictitle").classList.remove("magictitle-failed");
                    }, 500);
            }
        }
    
    }

    function ConfettiModeDefault(){
        document.getElementById("defaultconfetti").classList.remove("fontpicker");
        document.getElementById("defaultconfetti").classList.add("selectedfontpicker");

        document.getElementById("emojiconfetti").classList.add("fontpicker");
        document.getElementById("emojiconfetti").classList.remove("selectedfontpicker");

        document.getElementById("snowconfetti").classList.add("fontpicker");
        document.getElementById("snowconfetti").classList.remove("selectedfontpicker");

        document.getElementById("noconfetti").classList.add("fontpicker");
        document.getElementById("noconfetti").classList.remove("selectedfontpicker");

        confettiType = "1";
    }function ConfettiModeEmoji(){
        document.getElementById("emojiconfetti").classList.remove("fontpicker");
        document.getElementById("emojiconfetti").classList.add("selectedfontpicker");

        document.getElementById("defaultconfetti").classList.add("fontpicker");
        document.getElementById("defaultconfetti").classList.remove("selectedfontpicker");

        document.getElementById("snowconfetti").classList.add("fontpicker");
        document.getElementById("snowconfetti").classList.remove("selectedfontpicker");

        document.getElementById("noconfetti").classList.add("fontpicker");
        document.getElementById("noconfetti").classList.remove("selectedfontpicker");

        confettiType = decodeURIComponent(document.getElementById("confettiEmojiPicker").value);
    }function ConfettiModeSnow(){
        document.getElementById("snowconfetti").classList.remove("fontpicker");
        document.getElementById("snowconfetti").classList.add("selectedfontpicker");

        document.getElementById("defaultconfetti").classList.add("fontpicker");
        document.getElementById("defaultconfetti").classList.remove("selectedfontpicker");

        document.getElementById("emojiconfetti").classList.add("fontpicker");
        document.getElementById("emojiconfetti").classList.remove("selectedfontpicker");

        document.getElementById("noconfetti").classList.add("fontpicker");
        document.getElementById("noconfetti").classList.remove("selectedfontpicker");

        confettiType = "2";
    }function ConfettiModeNone(){
        document.getElementById("noconfetti").classList.remove("fontpicker");
        document.getElementById("noconfetti").classList.add("selectedfontpicker");

        document.getElementById("defaultconfetti").classList.add("fontpicker");
        document.getElementById("defaultconfetti").classList.remove("selectedfontpicker");

        document.getElementById("emojiconfetti").classList.add("fontpicker");
        document.getElementById("emojiconfetti").classList.remove("selectedfontpicker");

        document.getElementById("snowconfetti").classList.add("fontpicker");
        document.getElementById("snowconfetti").classList.remove("selectedfontpicker");

        confettiType = " ";
    }

	document.addEventListener('keydown', (() => {
    let input = '';
    return (event) => {
        input += event.key;
        if (input.endsWith('debug')) {
            document.getElementById('debugoptions').style.display = '';
            input = ''; // Reset the input
        }
    };
})());

	function TestProgressOptionsRemoveAtSomePoint(){
		alert("test mode entered");
			document.getElementByID("progress-bar").style.display = "";
    			const countdownduration = new Date(document.querySelector('.progressdatepicker').value) - new Date(document.querySelector('.datepicker').value);
    			alert(countdownduration);
			const distance = new Date() - new Date(document.querySelector('.datepicker').value);
			alert(distance);
			const progressbarvalue = 100 - (distance / countdownduration * 100);
			alert(progressbarvalue);
                	document.getElementById('schedule-progress').style.width = `${progressbarvalue}%`;
	}
