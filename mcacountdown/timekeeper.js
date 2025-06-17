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

function getLocale() {
    // 1) Try locale country code
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    const cc = loc.includes('-') ? loc.split('-')[1].toUpperCase() : null;
    if (cc && cc.length === 2) {
        return cc;      // e.g. "FR", "LA"
    }

    // 2) Fallback to time‑zone → country lookup
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;   // e.g. "Asia/Vientiane"
    const tzMap = {
        /* ---------- CANADA ---------- */
        'America/Toronto'   : 'CA', // Eastern
        'America/Montreal'  : 'CA',
        'America/Winnipeg'  : 'CA', // Central
        'America/Regina'    : 'CA', // SK (no DST)
        'America/Edmonton'  : 'CA', // Mountain
        'America/Vancouver' : 'CA', // Pacific
        'America/St_Johns'  : 'CA', // Newfoundland
        'America/Halifax'   : 'CA',

        /* ---------- UNITED KINGDOM ---------- */
        'Europe/London'     : 'GB',

        /* ---------- AUSTRALIA ---------- */
        'Australia/Sydney'  : 'AU',
        'Australia/Melbourne': 'AU',
        'Australia/Brisbane': 'AU',
        'Australia/Adelaide': 'AU',
        'Australia/Perth'   : 'AU',

        /* ---------- GERMANY ---------- */
        'Europe/Berlin'     : 'DE',

        /* ---------- FRANCE ---------- */
        'Europe/Paris'      : 'FR',

        /* ---------- JAPAN ---------- */
        'Asia/Tokyo'        : 'JP',

        /* ---------- INDIA ---------- */
        'Asia/Kolkata'      : 'IN',

        /* ---------- BRAZIL ---------- */
        'America/Sao_Paulo' : 'BR',

        /* ---------- MEXICO ---------- */
        'America/Mexico_City': 'MX',

        /* ---------- CHINA ---------- */
        // 'Asia/Shanghai'     : 'CN'
    };
    const guess = tzMap[tz] || 'US';                  // default
    return guess;
}

var locale = getLocale();

function _getHolidayData() {
    var now = new Date(); //getting the current date
    var nextyear = new Date().getFullYear() + 1; //setting up a next year variable
    var thisyear = new Date().getFullYear(); //setting up a this year variable

    let holidays = [];
    if (locale === 'CA') { //canada
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // easter
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
        //the above line calculates the moon's path to figure out when Easter is
        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            easterday = new Date(getEaster(nextyear) + "T00:00");
        } else {
            easterday = new Date(getEaster(thisyear) + "T00:00");
        }

        // victoria day (Monday on or before May 24th)
        var victoriathisyear = new Date(thisyear, 4, 24); // May 24th
        while (victoriathisyear.getDay() !== 1) { // 1 is Monday
            victoriathisyear.setDate(victoriathisyear.getDate() - 1);
        }
        if (victoriathisyear - now < 0) {
            victoriaday = new Date(nextyear, 4, 24);
            while (victoriaday.getDay() !== 1) {
                victoriaday.setDate(victoriaday.getDate() - 1);
            }
        } else {
            victoriaday = new Date(thisyear, 4, 24);
            while (victoriaday.getDay() !== 1) {
                victoriaday.setDate(victoriaday.getDate() - 1);
            }
        }

        // canada day
        var canadathisyear = new Date(thisyear + "-07-01T00:00");
        if (canadathisyear - now < 0) {
            canadaday = new Date(nextyear + '-07-01T00:00');
        } else {
            canadaday = new Date(thisyear + '-07-01T00:00');
        }

        // labour day (first Monday in September)
        var labourthisyear = new Date(thisyear, 8, 1); // Start with September 1st
        while (labourthisyear.getDay() !== 1) { // 1 is Monday
            labourthisyear.setDate(labourthisyear.getDate() + 1);
        }
        if (labourthisyear - now < 0) {
            labourday = new Date(nextyear, 8, 1);
            while (labourday.getDay() !== 1) {
                labourday.setDate(labourday.getDate() + 1);
            }
        } else {
            labourday = new Date(thisyear, 8, 1);
            while (labourday.getDay() !== 1) {
                labourday.setDate(labourday.getDate() + 1);
            }
        }

        // thanksgiving (second Monday in October)
        var thanksgivingthisyear = new Date(formatDate(getDateString(thisyear, 9, 1, 1)));
        if (thanksgivingthisyear - now < 0) {
            thanksgivingday = new Date(formatDate(getDateString(nextyear, 9, 1, 1)));
        } else {
            thanksgivingday = new Date(formatDate(getDateString(thisyear, 9, 1, 1)));
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'victoria',
                fullname: "Victoria Day",
                date: victoriaday
            },
            {
                name: 'canada',
                fullname: "Canada Day",
                date: canadaday
            },
            {
                name: 'labour',
                fullname: "Labour Day",
                date: labourday
            },
            {
                name: 'thanksgiving',
                fullname: "Thanksgiving",
                date: thanksgivingday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
        '<li id="victoriatab" class="tab" onclick="const date = victoriaday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Victoria Day</li>' +
        '<li id="canadatab" class="tab" onclick="const date = canadaday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Canada Day</li>' +
        '<li id="labourtab" class="tab" onclick="const date = labourday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Labour Day</li>' +
        '<li id="ttab" class="tab" onclick="const date = thanksgivingday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Thanksgiving</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'GB') { //Great Britain
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // easter
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
        //the above line calculates the moon's path to figure out when Easter is
        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            easterday = new Date(getEaster(nextyear) + "T00:00");
        } else {
            easterday = new Date(getEaster(thisyear) + "T00:00");
        }

        // early may bank holiday (first Monday in May)
        var earlymathisyear = new Date(thisyear, 4, 1); // Start with May 1st
        while (earlymathisyear.getDay() !== 1) { // 1 is Monday
            earlymathisyear.setDate(earlymathisyear.getDate() + 1);
        }
        if (earlymathisyear - now < 0) {
            earlymaybankholiday = new Date(nextyear, 4, 1);
            while (earlymaybankholiday.getDay() !== 1) {
                earlymaybankholiday.setDate(earlymaybankholiday.getDate() + 1);
            }
        } else {
            earlymaybankholiday = new Date(thisyear, 4, 1);
            while (earlymaybankholiday.getDay() !== 1) {
                earlymaybankholiday.setDate(earlymaybankholiday.getDate() + 1);
            }
        }

        // spring bank holiday (last Monday in May)
        var springthisyear = new Date(thisyear, 4, 31); // Start with May 31st
        while (springthisyear.getDay() !== 1) { // 1 is Monday
            springthisyear.setDate(springthisyear.getDate() - 1);
        }
        if (springthisyear - now < 0) {
            springbankholiday = new Date(nextyear, 4, 31);
            while (springbankholiday.getDay() !== 1) {
                springbankholiday.setDate(springbankholiday.getDate() - 1);
            }
        } else {
            springbankholiday = new Date(thisyear, 4, 31);
            while (springbankholiday.getDay() !== 1) {
                springbankholiday.setDate(springbankholiday.getDate() - 1);
            }
        }

        // summer bank holiday (last Monday in August)
        var summerthisyear = new Date(thisyear, 7, 31); // Start with August 31st
        while (summerthisyear.getDay() !== 1) { // 1 is Monday
            summerthisyear.setDate(summerthisyear.getDate() - 1);
        }
        if (summerthisyear - now < 0) {
            summerbankholiday = new Date(nextyear, 7, 31);
            while (summerbankholiday.getDay() !== 1) {
                summerbankholiday.setDate(summerbankholiday.getDate() - 1);
            }
        } else {
            summerbankholiday = new Date(thisyear, 7, 31);
            while (summerbankholiday.getDay() !== 1) {
                summerbankholiday.setDate(summerbankholiday.getDate() - 1);
            }
        }

        // halloween
        var halloweenthisyear = new Date(thisyear + "-10-31T00:00");
        if (halloweenthisyear - now < 0) {
            halloweenday = new Date(nextyear + '-10-31T00:00');
        } else {
            halloweenday = new Date(thisyear + '-10-31T00:00');
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // boxing day
        var boxingthisyear = new Date(thisyear + "-12-26T00:00");
        if (boxingthisyear - now < 0) {
            boxingday = new Date(nextyear + '-12-26T00:00');
        } else {
            boxingday = new Date(thisyear + '-12-26T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'earlymay',
                fullname: "Early May Bank Holiday",
                date: earlymaybankholiday
            },
            {
                name: 'spring',
                fullname: "Spring Bank Holiday",
                date: springbankholiday
            },
            {
                name: 'summer',
                fullname: "Summer Bank Holiday",
                date: summerbankholiday
            },
            {
                name: 'halloween',
                fullname: "Halloween",
                date: halloweenday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            },
            {
                name: 'boxing',
                fullname: "Boxing Day",
                date: boxingday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
        '<li id="earlymay" class="tab" onclick="const date = earlymaybankholiday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Early May BH</li>' +
        '<li id="springtab" class="tab" onclick="const date = springbankholiday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Spring BH</li>' +
        '<li id="summertab" class="tab" onclick="const date = summerbankholiday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Summer BH</li>' +
        '<li id="htab" class="tab" onclick="const date = halloweenday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Halloween</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>' +
        '<li id="boxingtab" class="tab" onclick="const date = boxingday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Boxing Day</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'AU') { //Australia
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // australia day
        var australiathisyear = new Date(thisyear + "-01-26T00:00");
        if (australiathisyear - now < 0) {
            australiaday = new Date(nextyear + '-01-26T00:00');
        } else {
            australiaday = new Date(thisyear + '-01-26T00:00');
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // easter
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
        //the above line calculates the moon's path to figure out when Easter is
        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            easterday = new Date(getEaster(nextyear) + "T00:00");
        } else {
            easterday = new Date(getEaster(thisyear) + "T00:00");
        }

        // anzac day
        var anzacthisyear = new Date(thisyear + "-04-25T00:00");
        if (anzacthisyear - now < 0) {
            anzacday = new Date(nextyear + '-04-25T00:00');
        } else {
            anzacday = new Date(thisyear + '-04-25T00:00');
        }

        // king's birthday (second Monday in June)
        var kingsthisyear = new Date(formatDate(getDateString(thisyear, 5, 1, 1))); //5th month (June), 1st week, 1st day (Monday)
        if (kingsthisyear - now < 0) {
            kingsbirthday = new Date(formatDate(getDateString(nextyear, 5, 1, 1)));
        } else {
            kingsbirthday = new Date(formatDate(getDateString(thisyear, 5, 1, 1)));
        }

        // halloween
        var halloweenthisyear = new Date(thisyear + "-10-31T00:00");
        if (halloweenthisyear - now < 0) {
            halloweenday = new Date(nextyear + '-10-31T00:00');
        } else {
            halloweenday = new Date(thisyear + '-10-31T00:00');
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // boxing day
        var boxingthisyear = new Date(thisyear + "-12-26T00:00");
        if (boxingthisyear - now < 0) {
            boxingday = new Date(nextyear + '-12-26T00:00');
        } else {
            boxingday = new Date(thisyear + '-12-26T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'australia',
                fullname: "Australia Day",
                date: australiaday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'anzac',
                fullname: "Anzac Day",
                date: anzacday
            },
            {
                name: 'kings',
                fullname: "King's Birthday",
                date: kingsbirthday
            },
            {
                name: 'halloween',
                fullname: "Halloween",
                date: halloweenday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            },
            {
                name: 'boxing',
                fullname: "Boxing Day",
                date: boxingday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="australiatab" class="tab" onclick="const date = australiaday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Australia Day</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
        '<li id="anzactab" class="tab" onclick="const date = anzacday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Anzac Day</li>' +
        '<li id="kingstab" class="tab" title="King\'s Birthday (Most States)" onclick="const date = kingsbirthday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">King\'s Birthday</li>' +
        '<li id="htab" class="tab" onclick="const date = halloweenday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Halloween</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>' +
        '<li id="boxingtab" class="tab" onclick="const date = boxingday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Boxing Day</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'DE') { //Germany
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // easter
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
        //the above line calculates the moon's path to figure out when Easter is
        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            easterday = new Date(getEaster(nextyear) + "T00:00");
        } else {
            easterday = new Date(getEaster(thisyear) + "T00:00");
        }

        // labour day
        var labourthisyear = new Date(thisyear + "-05-01T00:00");
        if (labourthisyear - now < 0) {
            labourday = new Date(nextyear + '-05-01T00:00');
        } else {
            labourday = new Date(thisyear + '-05-01T00:00');
        }

        // german unity day
        var unitythisyear = new Date(thisyear + "-10-03T00:00");
        if (unitythisyear - now < 0) {
            unityday = new Date(nextyear + '-10-03T00:00');
        } else {
            unityday = new Date(thisyear + '-10-03T00:00');
        }

        // reformation day
        var reformationthisyear = new Date(thisyear + "-10-31T00:00");
        if (reformationthisyear - now < 0) {
            reformationday = new Date(nextyear + '-10-31T00:00');
        } else {
            reformationday = new Date(thisyear + '-10-31T00:00');
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // second christmas day
        var secondchristmasthisyear = new Date(thisyear + "-12-26T00:00");
        if (secondchristmasthisyear - now < 0) {
            secondchristmasday = new Date(nextyear + '-12-26T00:00');
        } else {
            secondchristmasday = new Date(thisyear + '-12-26T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'labour',
                fullname: "Labour Day",
                date: labourday
            },
            {
                name: 'unity',
                fullname: "German Unity Day",
                date: unityday
            },
            {
                name: 'reformation',
                fullname: "Reformation Day",
                date: reformationday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            },
            {
                name: 'secondchristmas',
                fullname: "Second Christmas Day",
                date: secondchristmasday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
        '<li id="labourtab" class="tab" onclick="const date = labourday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Labour Day</li>' +
        '<li id="unitytab" class="tab" onclick="const date = unityday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Unity Day</li>' +
        '<li id="reformationtab" class="tab" onclick="const date = reformationday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Reformation Day</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>' +
        '<li id="secondchristmastab" class="tab" onclick="const date = secondchristmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">2nd Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'FR') { //France
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // easter
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
        //the above line calculates the moon's path to figure out when Easter is
        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            easterday = new Date(getEaster(nextyear) + "T00:00");
        } else {
            easterday = new Date(getEaster(thisyear) + "T00:00");
        }

        // labour day
        var labourthisyear = new Date(thisyear + "-05-01T00:00");
        if (labourthisyear - now < 0) {
            labourday = new Date(nextyear + '-05-01T00:00');
        } else {
            labourday = new Date(thisyear + '-05-01T00:00');
        }

        // bastille day
        var bastillethisyear = new Date(thisyear + "-07-14T00:00");
        if (bastillethisyear - now < 0) {
            bastilleday = new Date(nextyear + '-07-14T00:00');
        } else {
            bastilleday = new Date(thisyear + '-07-14T00:00');
        }

        // assumption day
        var assumptionthisyear = new Date(thisyear + "-08-15T00:00");
        if (assumptionthisyear - now < 0) {
            assumptionday = new Date(nextyear + '-08-15T00:00');
        } else {
            assumptionday = new Date(thisyear + '-08-15T00:00');
        }

        // all saints' day
        var allsainthisyear = new Date(thisyear + "-11-01T00:00");
        if (allsainthisyear - now < 0) {
            allsaintday = new Date(nextyear + '-11-01T00:00');
        } else {
            allsaintday = new Date(thisyear + '-11-01T00:00');
        }

        // armistice day
        var armisticethisyear = new Date(thisyear + "-11-11T00:00");
        if (armisticethisyear - now < 0) {
            armisticeday = new Date(nextyear + '-11-11T00:00');
        } else {
            armisticeday = new Date(thisyear + '-11-11T00:00');
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'labour',
                fullname: "Labour Day",
                date: labourday
            },
            {
                name: 'bastille',
                fullname: "Bastille Day",
                date: bastilleday
            },
            {
                name: 'assumption',
                fullname: "Assumption Day",
                date: assumptionday
            },
            {
                name: 'allsaint',
                fullname: "All Saints' Day",
                date: allsaintday
            },
            {
                name: 'armistice',
                fullname: "Armistice Day",
                date: armisticeday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
        '<li id="labourtab" class="tab" onclick="const date = labourday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Labour Day</li>' +
        '<li id="bastilletab" class="tab" onclick="const date = bastilleday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Bastille Day</li>' +
        '<li id="assumptiontab" class="tab" onclick="const date = assumptionday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Assumption Day</li>' +
        '<li id="allsainttab" class="tab" onclick="const date = allsaintday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">All Saints\' Day</li>' +
        '<li id="armisticetab" class="tab" onclick="const date = armisticeday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Armistice Day</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'JP') { //Japan
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // coming of age day (second Monday in January)
        var comingofagethisyear = new Date(formatDate(getDateString(thisyear, 0, 1, 1))); //0th month (Jan), 1st week, 1st day (Monday)
        if (comingofagethisyear - now < 0) {
            comingofageday = new Date(formatDate(getDateString(nextyear, 0, 1, 1)));
        } else {
            comingofageday = new Date(formatDate(getDateString(thisyear, 0, 1, 1)));
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // golden week (Constitution Memorial Day - May 3)
        var goldenweekthisyear = new Date(thisyear + "-05-03T00:00");
        if (goldenweekthisyear - now < 0) {
            goldenweekday = new Date(nextyear + '-05-03T00:00');
        } else {
            goldenweekday = new Date(thisyear + '-05-03T00:00');
        }

        // respect for the aged day (third Monday in September)
        var respectthisyear = new Date(formatDate(getDateString(thisyear, 8, 2, 1))); //8th month (Sep), 2nd week, 1st day (Monday)
        if (respectthisyear - now < 0) {
            respectday = new Date(formatDate(getDateString(nextyear, 8, 2, 1)));
        } else {
            respectday = new Date(formatDate(getDateString(thisyear, 8, 2, 1)));
        }

        // labour thanksgiving day
        var labourthanksgivingthisyear = new Date(thisyear + "-11-23T00:00");
        if (labourthanksgivingthisyear - now < 0) {
            labourthanksgivingday = new Date(nextyear + '-11-23T00:00');
        } else {
            labourthanksgivingday = new Date(thisyear + '-11-23T00:00');
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'comingage',
                fullname: "Coming of Age Day",
                date: comingofageday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'goldenweek',
                fullname: "Golden Week",
                date: goldenweekday
            },
            {
                name: 'respect',
                fullname: "Respect for the Aged Day",
                date: respectday
            },
            {
                name: 'labourthanksgiving',
                fullname: "Labour Thanksgiving Day",
                date: labourthanksgivingday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="comingtab" class="tab" onclick="const date = comingofageday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Coming of Age</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="goldentab" class="tab" onclick="const date = goldenweekday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Golden Week</li>' +
        '<li id="respecttab" class="tab" onclick="const date = respectday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Respect for Aged</li>' +
        '<li id="labourthanksgivingtab" class="tab" onclick="const date = labourthanksgivingday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Labour Thanks</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'IN') { //India
        // republic day
        var republicthisyear = new Date(thisyear + "-01-26T00:00");
        if (republicthisyear - now < 0) {
            republicday = new Date(nextyear + '-01-26T00:00');
        } else {
            republicday = new Date(thisyear + '-01-26T00:00');
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // independence day
        var independencethisyear = new Date(thisyear + "-08-15T00:00");
        if (independencethisyear - now < 0) {
            independenceday = new Date(nextyear + '-08-15T00:00');
        } else {
            independenceday = new Date(thisyear + '-08-15T00:00');
        }

        // gandhi jayanti
        var gandhithisyear = new Date(thisyear + "-10-02T00:00");
        if (gandhithisyear - now < 0) {
            gandhiday = new Date(nextyear + '-10-02T00:00');
        } else {
            gandhiday = new Date(thisyear + '-10-02T00:00');
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'republic',
                fullname: "Republic Day",
                date: republicday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'independence',
                fullname: "Independence Day",
                date: independenceday
            },
            {
                name: 'gandhi',
                fullname: "Gandhi Jayanti",
                date: gandhiday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="republictab" class="tab" onclick="const date = republicday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Republic Day</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="idtab" class="tab" onclick="const date = independenceday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Independence Day</li>' +
        '<li id="gandhitab" class="tab" onclick="const date = gandhiday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Gandhi Jayanti</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'BR') { //Brazil
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // easter calculation for carnival
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
        //the above line calculates the moon's path to figure out when Easter is

        // easter
        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            easterday = new Date(getEaster(nextyear) + "T00:00");
        } else {
            easterday = new Date(getEaster(thisyear) + "T00:00");
        }

        // carnival (47 days before Easter)
        var carnivalthisyear = new Date(easterthisyear);
        carnivalthisyear.setDate(carnivalthisyear.getDate() - 47);
        if (carnivalthisyear - now < 0) {
            var nextyearEaster = new Date(getEaster(nextyear) + "T00:00");
            carnivalday = new Date(nextyearEaster);
            carnivalday.setDate(carnivalday.getDate() - 47);
        } else {
            carnivalday = new Date(carnivalthisyear);
        }

        // tiradentes day
        var tiradentesthisyear = new Date(thisyear + "-04-21T00:00");
        if (tiradentesthisyear - now < 0) {
            tiradentesday = new Date(nextyear + '-04-21T00:00');
        } else {
            tiradentesday = new Date(thisyear + '-04-21T00:00');
        }

        // labour day
        var labourthisyear = new Date(thisyear + "-05-01T00:00");
        if (labourthisyear - now < 0) {
            labourday = new Date(nextyear + '-05-01T00:00');
        } else {
            labourday = new Date(thisyear + '-05-01T00:00');
        }

        // independence day
        var independencethisyear = new Date(thisyear + "-09-07T00:00");
        if (independencethisyear - now < 0) {
            independenceday = new Date(nextyear + '-09-07T00:00');
        } else {
            independenceday = new Date(thisyear + '-09-07T00:00');
        }

        // all souls' day
        var allsoulsthisyear = new Date(thisyear + "-11-02T00:00");
        if (allsoulsthisyear - now < 0) {
            allsoulsday = new Date(nextyear + '-11-02T00:00');
        } else {
            allsoulsday = new Date(thisyear + '-11-02T00:00');
        }

        // republic day
        var republicthisyear = new Date(thisyear + "-11-15T00:00");
        if (republicthisyear - now < 0) {
            republicday = new Date(nextyear + '-11-15T00:00');
        } else {
            republicday = new Date(thisyear + '-11-15T00:00');
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'carnival',
                fullname: "Carnival",
                date: carnivalday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'tiradentes',
                fullname: "Tiradentes Day",
                date: tiradentesday
            },
            {
                name: 'labour',
                fullname: "Labour Day",
                date: labourday
            },
            {
                name: 'independence',
                fullname: "Independence Day",
                date: independenceday
            },
            {
                name: 'allsouls',
                fullname: "All Souls' Day",
                date: allsoulsday
            },
            {
                name: 'republic',
                fullname: "Republic Day",
                date: republicday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="carnivaltab" class="tab" onclick="const date = carnivalday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Carnival</li>' +
        '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
        '<li id="tiradentestab" class="tab" onclick="const date = tiradentesday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Tiradentes</li>' +
        '<li id="labourtab" class="tab" onclick="const date = labourday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Labour Day</li>' +
        '<li id="idtab" class="tab" onclick="const date = independenceday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Independence Day</li>' +
        '<li id="allsoulstab" class="tab" onclick="const date = allsoulsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">All Souls\' Day</li>' +
        '<li id="republictab" class="tab" onclick="const date = republicday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Republic Day</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else if (locale === 'MX') { //Mexico
        // new years
        var newyearsthisyear = new Date(thisyear + "-01-01T00:00");
        if (newyearsthisyear - now < 0) {
            newyearsday = new Date(nextyear + '-01-01T00:00');
        } else {
            newyearsday = new Date(thisyear + '-01-01T00:00');
        }

        // valentines
        var valentinesthisyear = new Date(thisyear + "-02-14T00:00");
        if (valentinesthisyear - now < 0) {
            valentinessday = new Date(nextyear + '-02-14T00:00');
        } else {
            valentinessday = new Date(thisyear + '-02-14T00:00');
        }

        // constitution day (first Monday in February)
        var constitutionthisyear = new Date(formatDate(getDateString(thisyear, 1, 0, 1))); //1st month (Feb), 0th week, 1st day (Monday)
        if (constitutionthisyear - now < 0) {
            constitutionday = new Date(formatDate(getDateString(nextyear, 1, 0, 1)));
        } else {
            constitutionday = new Date(formatDate(getDateString(thisyear, 1, 0, 1)));
        }

        // benito juárez day (third Monday in March)
        var juarezthisyear = new Date(formatDate(getDateString(thisyear, 2, 2, 1))); //2nd month (Mar), 2nd week, 1st day (Monday)
        if (juarezthisyear - now < 0) {
            juarezday = new Date(formatDate(getDateString(nextyear, 2, 2, 1)));
        } else {
            juarezday = new Date(formatDate(getDateString(thisyear, 2, 2, 1)));
        }

        // easter
        var epoch = 2444238.5, elonge = 278.83354, elongp = 282.596403, eccent = .016718, sunsmax = 149598500, sunangsiz = .533128, mmlong = 64.975464, mmlongp = 349.383063, mlnode = 151.950429, minc = 5.145396, mecc = .0549, mangsiz = .5181, msmax = 384401, mparallax = .9507, synmonth = 29.53058868, lunatbase = 2423436, earthrad = 6378.16, PI = 3.141592653589793, epsilon = 1e-6; function sgn(x) { return x < 0 ? -1 : x > 0 ? 1 : 0 } function abs(x) { return x < 0 ? -x : x } function fixAngle(a) { return a - 360 * Math.floor(a / 360) } function toRad(d) { return d * (PI / 180) } function toDeg(d) { return d * (180 / PI) } function dsin(x) { return Math.sin(toRad(x)) } function dcos(x) { return Math.cos(toRad(x)) } function toJulianTime(date) { var year, month, day; year = date.getFullYear(); var m = (month = date.getMonth() + 1) > 2 ? month : month + 12, y = month > 2 ? year : year - 1, d = (day = date.getDate()) + date.getHours() / 24 + date.getMinutes() / 1440 + (date.getSeconds() + date.getMilliseconds() / 1e3) / 86400, b = isJulianDate(year, month, day) ? 0 : 2 - y / 100 + y / 100 / 4; return Math.floor(365.25 * (y + 4716) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5) } function isJulianDate(year, month, day) { if (year < 1582) return !0; if (year > 1582) return !1; if (month < 10) return !0; if (month > 10) return !1; if (day < 5) return !0; if (day > 14) return !1; throw "Any date in the range 10/5/1582 to 10/14/1582 is invalid!" } function jyear(td, yy, mm, dd) { var z, f, alpha, b, c, d, e; return f = (td += .5) - (z = Math.floor(td)), b = (z < 2299161 ? z : z + 1 + (alpha = Math.floor((z - 1867216.25) / 36524.25)) - Math.floor(alpha / 4)) + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001), { day: Math.floor(b - d - Math.floor(30.6001 * e) + f), month: Math.floor(e < 14 ? e - 1 : e - 13), year: Math.floor(mm > 2 ? c - 4716 : c - 4715) } } function jhms(j) { var ij; return j += .5, ij = Math.floor(86400 * (j - Math.floor(j)) + .5), { hour: Math.floor(ij / 3600), minute: Math.floor(ij / 60 % 60), second: Math.floor(ij % 60) } } function jwday(j) { return Math.floor(j + 1.5) % 7 } function meanphase(sdate, k) { var t, t2; return 2415020.75933 + synmonth * k + 1178e-7 * (t2 = (t = (sdate - 2415020) / 36525) * t) - 155e-9 * (t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2) } function truephase(k, phase) { var t, t2, t3, pt, m, mprime, f, apcor = !1; if (pt = 2415020.75933 + synmonth * (k += phase) + 1178e-7 * (t2 = (t = k / 1236.85) * t) - 155e-9 * (t3 = t2 * t) + 33e-5 * dsin(166.56 + 132.87 * t - .009173 * t2), m = 359.2242 + 29.10535608 * k - 333e-7 * t2 - 347e-8 * t3, mprime = 306.0253 + 385.81691806 * k + .0107306 * t2 + 1236e-8 * t3, f = 21.2964 + 390.67050646 * k - .0016528 * t2 - 239e-8 * t3, phase < .01 || abs(phase - .5) < .01 ? (pt += (.1734 - 393e-6 * t) * dsin(m) + .0021 * dsin(2 * m) - .4068 * dsin(mprime) + .0161 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0104 * dsin(2 * f) - .0051 * dsin(m + mprime) - .0074 * dsin(m - mprime) + 4e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .001 * dsin(2 * f - mprime) + 5e-4 * dsin(m + 2 * mprime), apcor = !0) : (abs(phase - .25) < .01 || abs(phase - .75) < .01) && (pt += (.1721 - 4e-4 * t) * dsin(m) + .0021 * dsin(2 * m) - .628 * dsin(mprime) + .0089 * dsin(2 * mprime) - 4e-4 * dsin(3 * mprime) + .0079 * dsin(2 * f) - .0119 * dsin(m + mprime) - .0047 * dsin(m - mprime) + 3e-4 * dsin(2 * f + m) - 4e-4 * dsin(2 * f - m) - 6e-4 * dsin(2 * f + mprime) + .0021 * dsin(2 * f - mprime) + 3e-4 * dsin(m + 2 * mprime) + 4e-4 * dsin(m - 2 * mprime) - 3e-4 * dsin(2 * m + mprime), pt += phase < .5 ? .0028 - 4e-4 * dcos(m) + 3e-4 * dcos(mprime) : 4e-4 * dcos(m) - .0028 - 3e-4 * dcos(mprime), apcor = !0), !apcor) throw "Error calculating moon phase!"; return pt } function phasehunt(sdate, phases) { var adate, k1, k2, nt1, nt2, yy, mm, dd, jyearResult = jyear(adate = sdate - 45, yy, mm, dd); for (yy = jyearResult.year, mm = jyearResult.month, dd = jyearResult.day, adate = nt1 = meanphase(adate, k1 = Math.floor(12.3685 * (yy + 1 / 12 * (mm - 1) - 1900))); nt2 = meanphase(adate += synmonth, k2 = k1 + 1), !(nt1 <= sdate && nt2 > sdate);)nt1 = nt2, k1 = k2; return phases[0] = truephase(k1, 0), phases[1] = truephase(k1, .25), phases[2] = truephase(k1, .5), phases[3] = truephase(k1, .75), phases[4] = truephase(k2, 0), phases } function kepler(m, ecc) { var e, delta; e = m = toRad(m); do { e -= (delta = e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e)) } while (abs(delta) > epsilon); return e } function getMoonPhase(julianDate) { var Day, N, M, Ec, Lambdasun, ml, MM, MN, Ev, Ae, MmP, mEc, lP, lPP, NP, y, x, MoonAge, MoonPhase, MoonDist, MoonDFrac, MoonAng, F, SunDist, SunAng; return N = fixAngle(360 / 365.2422 * (Day = julianDate - epoch)), Ec = kepler(M = fixAngle(N + elonge - elongp), eccent), Ec = Math.sqrt((1 + eccent) / (1 - eccent)) * Math.tan(Ec / 2), Lambdasun = fixAngle((Ec = 2 * toDeg(Math.atan(Ec))) + elongp), F = (1 + eccent * Math.cos(toRad(Ec))) / (1 - eccent * eccent), SunDist = sunsmax / F, SunAng = F * sunangsiz, ml = fixAngle(13.1763966 * Day + mmlong), MM = fixAngle(ml - .1114041 * Day - mmlongp), MN = fixAngle(mlnode - .0529539 * Day), MmP = MM + (Ev = 1.2739 * Math.sin(toRad(2 * (ml - Lambdasun) - MM))) - (Ae = .1858 * Math.sin(toRad(M))) - .37 * Math.sin(toRad(M)), lPP = (lP = ml + Ev + (mEc = 6.2886 * Math.sin(toRad(MmP))) - Ae + .214 * Math.sin(toRad(2 * MmP))) + .6583 * Math.sin(toRad(2 * (lP - Lambdasun))), NP = MN - .16 * Math.sin(toRad(M)), y = Math.sin(toRad(lPP - NP)) * Math.cos(toRad(minc)), x = Math.cos(toRad(lPP - NP)), toDeg(Math.atan2(y, x)), NP, toDeg(Math.asin(Math.sin(toRad(lPP - NP)) * Math.sin(toRad(minc)))), MoonAge = lPP - Lambdasun, MoonPhase = (1 - Math.cos(toRad(MoonAge))) / 2, MoonDist = msmax * (1 - mecc * mecc) / (1 + mecc * Math.cos(toRad(MmP + mEc))), MoonAng = mangsiz / (MoonDFrac = MoonDist / msmax), mparallax / MoonDFrac, { moonIllumination: MoonPhase, moonAgeInDays: synmonth * (fixAngle(MoonAge) / 360), distanceInKm: MoonDist, angularDiameterInDeg: MoonAng, distanceToSun: SunDist, sunAngularDiameter: SunAng, moonPhase: fixAngle(MoonAge) / 360 } } function getMoonInfo(date) { return null == date ? { moonPhase: 0, moonIllumination: 0, moonAgeInDays: 0, distanceInKm: 0, angularDiameterInDeg: 0, distanceToSun: 0, sunAngularDiameter: 0 } : getMoonPhase(toJulianTime(date)) } function getEaster(year) { var previousMoonInfo, moonInfo, fullMoon = new Date(year, 2, 21), gettingDarker = void 0; do { previousMoonInfo = getMoonInfo(fullMoon), fullMoon.setDate(fullMoon.getDate() + 1), moonInfo = getMoonInfo(fullMoon), void 0 === gettingDarker ? gettingDarker = moonInfo.moonIllumination < previousMoonInfo.moonIllumination : gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination && (gettingDarker = !1) } while (gettingDarker && moonInfo.moonIllumination < previousMoonInfo.moonIllumination || !gettingDarker && moonInfo.moonIllumination > previousMoonInfo.moonIllumination); for (fullMoon.setDate(fullMoon.getDate() - 1); 0 !== fullMoon.getDay();)fullMoon.setDate(fullMoon.getDate() + 1); return fullMoon.toISOString().split('T')[0] }
        //the above line calculates the moon's path to figure out when Easter is
        var easterthisyear = new Date(getEaster(thisyear) + "T00:00");
        if (easterthisyear - now < 0) {
            easterday = new Date(getEaster(nextyear) + "T00:00");
        } else {
            easterday = new Date(getEaster(thisyear) + "T00:00");
        }

        // labour day
        var labourthisyear = new Date(thisyear + "-05-01T00:00");
        if (labourthisyear - now < 0) {
            labourday = new Date(nextyear + '-05-01T00:00');
        } else {
            labourday = new Date(thisyear + '-05-01T00:00');
        }

        // independence day
        var independencethisyear = new Date(thisyear + "-09-16T00:00");
        if (independencethisyear - now < 0) {
            independenceday = new Date(nextyear + '-09-16T00:00');
        } else {
            independenceday = new Date(thisyear + '-09-16T00:00');
        }

        // día de muertos
        var muertosthisyear = new Date(thisyear + "-11-02T00:00");
        if (muertosthisyear - now < 0) {
            muertosday = new Date(nextyear + '-11-02T00:00');
        } else {
            muertosday = new Date(thisyear + '-11-02T00:00');
        }

        // revolution day (third Monday in November)
        var revolutionthisyear = new Date(formatDate(getDateString(thisyear, 10, 2, 1))); //10th month (Nov), 2nd week, 1st day (Monday)
        if (revolutionthisyear - now < 0) {
            revolutionday = new Date(formatDate(getDateString(nextyear, 10, 2, 1)));
        } else {
            revolutionday = new Date(formatDate(getDateString(thisyear, 10, 2, 1)));
        }

        // christmas
        var christmasthisyear = new Date(thisyear + "-12-25T00:00");
        if (christmasthisyear - now < 0) {
            christmasday = new Date(nextyear + '-12-25T00:00');
        } else {
            christmasday = new Date(thisyear + '-12-25T00:00');
        }

        // list of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'constitution',
                fullname: "Constitution Day",
                date: constitutionday
            },
            {
                name: 'juarez',
                fullname: "Benito Juárez Day",
                date: juarezday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'labour',
                fullname: "Labour Day",
                date: labourday
            },
            {
                name: 'independence',
                fullname: "Independence Day",
                date: independenceday
            },
            {
                name: 'muertos',
                fullname: "Día de Muertos",
                date: muertosday
            },
            {
                name: 'revolution',
                fullname: "Revolution Day",
                date: revolutionday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            }
        ]; 

        const datepickerpresets = 
        '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
        '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
        '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
        '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
        '<li id="constitutiontab" class="tab" onclick="const date = constitutionday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Constitution Day</li>' +
        '<li id="juareztab" class="tab" onclick="const date = juarezday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Juárez Day</li>' +
        '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
        '<li id="labourtab" class="tab" onclick="const date = labourday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Labour Day</li>' +
        '<li id="idtab" class="tab" onclick="const date = independenceday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Independence Day</li>' +
        '<li id="muertostab" class="tab" onclick="const date = muertosday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Día de Muertos</li>' +
        '<li id="revolutiontab" class="tab" onclick="const date = revolutionday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Revolution Day</li>' +
        '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    } else { //USA or default
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

        //groundhog day
        var groundhogthisyear = new Date(thisyear + "-02-02T00:00"); //setting up this year's date
        if (groundhogthisyear - now < 0) { //if it's already passed
            groundhogday = new Date(nextyear + '-02-02T00:00'); //then set to next year
        } else { //otherwise, if it's not passed yet
            groundhogday = new Date(thisyear + '-02-02T00:00'); //set to this year
        }

        //st patricks day
        var stpatricksthisyear = new Date(thisyear + "-03-17T00:00");
        if (stpatricksthisyear - now < 0) {
            stpatricksday = new Date(nextyear + '-03-17T00:00');
        } else {
            stpatricksday = new Date(thisyear + '-03-17T00:00');
        }

        //cinco de mayo
        var cincothisyear = new Date(thisyear + "-05-05T00:00");
        if (cincothisyear - now < 0) {
            cincodemayo = new Date(nextyear + '-05-05T00:00');
        } else {
            cincodemayo = new Date(thisyear + '-05-05T00:00');
        }

        //mlk jr day (third Monday in January)
        var mlkthisyear = new Date(formatDate(getDateString(thisyear, 0, 2, 1))); //0th month (Jan), 2nd week, 1st day (Monday)
        if (mlkthisyear - now < 0) {
            mlkday = new Date(formatDate(getDateString(nextyear, 0, 2, 1)));
        } else {
            mlkday = new Date(formatDate(getDateString(thisyear, 0, 2, 1)));
        }

        // List of holiday dates
        holidays = [
            {
                name: 'newyear',
                fullname: "New Year's Day",
                date: newyearsday
            },
            {
                name: 'mlk',
                fullname: "MLK Jr Day",
                date: mlkday
            },
            {
                name: 'groundhog',
                fullname: "Groundhog Day",
                date: groundhogday
            },
            {
                name: 'valentines',
                fullname: "Valentine's Day",
                date: valentinessday
            },
            {
                name: 'stpatricks',
                fullname: "St. Patrick's Day",
                date: stpatricksday
            },
            {
                name: 'easter',
                fullname: "Easter",
                date: easterday
            },
            {
                name: 'cinco',
                fullname: "Cinco de Mayo",
                date: cincodemayo
            },
            {
                name: 'independence',
                fullname: "Independence Day",
                date: independenceday
            },
            {
                name: 'halloween',
                fullname: "Halloween",
                date: halloweenday
            },
            {
                name: 'thanksgiving',
                fullname: "Thanksgiving",
                date: thanksgivingday
            },
            {
                name: 'christmas',
                fullname: "Christmas",
                date: christmasday
            }
        ];

        const datepickerpresets = 
            '<li class="debugtab" id="onemintab" style="display:none" onclick="const datepicker = document.querySelector(\'.datepicker\'); const now = new Date(); now.setMinutes(now.getMinutes() + 1); const offset = now.getTimezoneOffset(); now.setMinutes(now.getMinutes() - offset); const localISOTime = now.toISOString().slice(0, 16); datepicker.value = localISOTime; setCountDowngeneral();">One Minute</li>' +
            '<li title="Timekeeper will automatically pick the next upcoming holiday" id="autopilottab" class="autopilottab float-icons" style="position: relative;" onclick="autopilottab(); autopilotsparkle(event); SetCountDowngeneral();"><i class="fa-solid fa-business-time"></i> Second Sense</li>' +
            '<li id="endtab" class="mcatab" onclick="MES(); SetCountDowngeneral();">MCA</li>' +
            '<li id="nydtab" class="tab" onclick="const date = newyearsday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">New Year\'s Day</li>' +
            '<li id="mlktab" class="tab" onclick="const date = mlkday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">MLK Jr. Day</li>' +
            '<li id="groundhogtab" class="tab" onclick="const date = groundhogday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Groundhog Day</li>' +
            '<li id="vdtab" class="tab" onclick="const date = valentinessday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Valentine\'s Day</li>' +
            '<li id="stpatrickstab" class="tab" onclick="const date = stpatricksday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">St. Patrick\'s</li>' +
            '<li id="eastertab" class="tab" onclick="const date = easterday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Easter</li>' +
            '<li id="cincotab" class="tab" onclick="const date = cincodemayo; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Cinco de Mayo</li>' +
            '<li id="idtab" class="tab" onclick="const date = independenceday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Independence Day</li>' +
            '<li id="htab" class="tab" onclick="const date = halloweenday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Halloween</li>' +
            '<li id="ttab" class="tab" onclick="const date = thanksgivingday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Thanksgiving</li>' +
            '<li id="ctab" class="tab" onclick="const date = christmasday; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, \'0\'); const day = String(date.getDate()).padStart(2, \'0\'); const hours = String(date.getHours()).padStart(2, \'0\'); const minutes = String(date.getMinutes()).padStart(2, \'0\'); document.querySelector(\'.datepicker\').value = year + \'-\' + month + \'-\' + day + \'T\' + hours + \':\' + minutes; SetCountDowngeneral();">Christmas</li>';
        document.getElementById('tabs-box').innerHTML = datepickerpresets;
    }

    var dpEl = document.querySelector(".datepicker");
    if (dpEl && dpEl.value) {
        var selectedDate = new Date(dpEl.value);
        var matchingHoliday = holidays.find(function (holiday) {
            return holiday.date.toDateString() === selectedDate.toDateString();
        }) || { name: 'none', date: null };
    }
    else{
        var matchingHoliday = { name: 'none', date: null };
    }

    var nextHoliday = holidays.length ? holidays.reduce(function (closest, holiday) {
        var timeDiff = holiday.date.getTime() - now.getTime();
        return timeDiff > 0 && timeDiff < (closest.date.getTime() - now.getTime()) ? holiday : closest;
    }, holidays[0]) : { name: 'none', fullname: 'Unknown', date: null };

    return { nextHoliday, matchingHoliday };
}



// Initialize holiday data and make it available globally
const initialHolidayData = _getHolidayData();
window.getHolidayData = _getHolidayData;