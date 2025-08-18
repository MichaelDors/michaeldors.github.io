let userInteracted = false;

// Debounce function for limiting how often a function can be called
// Global variables for database sync cooldown
let isInCooldown = false;

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateTitlePosition(fontSize) {
    // Calculate title positioning based on font size
    // Larger font sizes need the title positioned higher
    let titleOffset;
    let titlePercentage;
    
    switch(fontSize) {
        case 75: // Default size (days, hours, etc.)
            titleOffset = 43;
            titlePercentage = 40;
            break;
        case 100: // Hours only
            titleOffset = 60;
            titlePercentage = 40;
            break;
        case 150: // Minutes only
            titleOffset = 90;
            titlePercentage = 40;
            break;
        case 175: // Seconds only
            titleOffset = 105;
            titlePercentage = 40;
            break;
        default:
            titleOffset = 43;
            titlePercentage = 40;
    }
    
    // Update CSS variables
    document.documentElement.style.setProperty('--title-top-offset', titleOffset + 'px');
    document.documentElement.style.setProperty('--title-top-percentage', titlePercentage + '%');
}

syncCookiesToCloud();

  function handleTitleNavigation() {
      const fullUrl = window.location.href;
      const urlParts = fullUrl.split('#');
      if (urlParts.length < 2) return; // No hash present
  
      const urlTitle = urlParts.pop().toLowerCase().trim();
      if (!urlTitle || urlTitle === 'betatimer.html' || urlTitle === 'timer.html' || urlTitle === 'betatimer' || urlTitle === 'timer') return;
  
      const savedLinks = localStorage.getItem('dashboardsaved');
      if (!savedLinks) return;
  
      try {
          const links = JSON.parse(savedLinks);
  
          const matchingCountdown = links.find(link => {
              try {
                  const linkUrl = new URL(link.url, window.location.origin);
                  const titleParam = linkUrl.searchParams.get('title');
                  return titleParam && decodeURIComponent(titleParam).toLowerCase().trim() === decodeURIComponent(urlTitle);
              } catch (e) {
                  console.error('Error parsing URL:', e);
                  return false;
              }
          });
  
          if (matchingCountdown) {
              window.location.href = matchingCountdown.url;
              window.location.replace(matchingCountdown.url);
          }
      } catch (e) {
          console.error('Error parsing saved countdowns:', e);
      }
  }
      
  function updateSaveButtonText() {
    title = "";
    if(document.getElementById("countdowntitle")){
        title = document.getElementById("countdowntitle").value;
    }else{
     title = 'finishedcddone';
    }

    schedule_resettimeinputs();

      // Get the existing links from localStorage
      const savedLinks = localStorage.getItem("dashboardsaved");
      let links = [];
      
      try {
          links = savedLinks ? JSON.parse(savedLinks) : [];
      } catch (e) {
          return;
      }
  
      // Get the current URL parameters
      const currentUrl = document.getElementById("linkinput").value;
  
      
  // Function to get sorted parameters from URL, filtering out default values
  const getUrlParams = (url) => {
      try {
          const urlObj = new URL(url);
          const params = new URLSearchParams(urlObj.search);
          
          // Define default values to filter out
          const defaults = {
              colorone: '8426ff',
              colortwo: '3ab6ff',
              colorthree: '00df52',
              colorfour: 'ff9900'
          };
  
          // Filter out parameters that match defaults
          const filteredParams = [...params.entries()].filter(([key, value]) => {
              if (defaults[key] && value === defaults[key]) {
                  return false;
              }
              return true;
          });
  
          return new URLSearchParams(filteredParams.sort()).toString();
      } catch (e) {
          return '';
      }
  };
  
      // Default button text
      let buttonText = '<i class="fa-solid fa-star"></i> Save';
  
      // Only proceed if we have a title to compare
      if (title) {
          const matchingLink = links.find(link => {
              try {
                  const linkUrl = new URL(link.url);
                  const linkTitle = linkUrl.searchParams.get('title');
                  // Only check if titles match, don't compare URLs here
                  return linkTitle && linkTitle.toLowerCase() === title.toLowerCase();
              } catch (e) {
                  return false;
              }
          });
  
          if (matchingLink) {
              // Now compare the URLs separately
              const urlsMatch = getUrlParams(matchingLink.url) === getUrlParams(currentUrl);
              if (urlsMatch) {
                  buttonText = '<i class="fa-solid fa-circle-check"></i> Saved';
              } else {
                  buttonText = '<i class="fa-solid fa-star"></i> Update';
              }
          }
      }
      
      const saveBar = document.getElementById('saveBar');
      const saveText = document.getElementById('savetext');
      
      if (buttonText.includes('Saved')) {
        saveBar.classList.remove('visible');
        saveBar.classList.add('hiding');
        setTimeout(() => {
          saveBar.classList.remove('hiding');
        }, 300); // duration matches CSS transition
      } else {
        saveText.textContent = buttonText.includes('Update')
          ? "Don't forget to save your changes"
          : "Pin this to your Dashboard to revisit easily";
      
        saveBar.classList.remove('hiding');
        saveBar.classList.add('visible');
      }

      const saveButton = document.getElementById('savedash');
      if (saveButton) {
          saveButton.innerHTML = buttonText;
      }

      // Store user metadata in localStorage after saving dashboard
      // (Assume supabase is globally available if user is logged in)
      if (typeof supabase !== "undefined" && supabase.auth && typeof supabase.auth.getUser === "function") {
        // getUser() returns a Promise
        supabase.auth.getUser().then(function(user) {
          const user_metadata = user?.data?.user?.user_metadata;
          if (user_metadata) {
            localStorage.setItem('dashboardsaved_userdata', JSON.stringify({
              name: user_metadata.full_name || '',
              avatar_url: user_metadata.avatar_url || ''
            }));
          }
        }).catch(function(e){
          // ignore errors
        });
      }
  }
  
  //function unloadPage(){ 
  //	if(document.getElementById('savedash').innerHTML == '<i class="fa-solid fa-star"></i> Update'){
  //		return "Some of your changes have not been saved to Dashboard. Are you sure you want to close this page?";
  //	}
  //}

  function unloadPage(){ 
    if(window.CountdownDataSourceOrigin == "testing"){
        return "You need to log in to save your countdown. Do you still want to leave this page?";
    }else if(isInCooldown){
        return "Some of your changes have not been saved yet. Are you sure you want to close this page?";
    } 
}
  
  if(parameter('cardmode') !== "1"){
  window.onbeforeunload = unloadPage;
  }
  
  if(parameter('cardmode')){
    cardmodemanager();
  }

function cardmodemanager(){
    document.documentElement.style.setProperty('--bgbluramount', '100px');
    document.getElementById("cookie-banner").style.display = 'none';
      document.getElementById("gear").style.display = 'none';
      document.getElementById("toolbar-notch").style.display = 'none';
      document.getElementById("countdowntitle").style.display = 'none';
      if(document.getElementById("autopilotpopup")){
      document.getElementById("autopilotpopup").style.display = 'none';
      }
      if(document.getElementById("autopilotpopupmobile")){
      document.getElementById("autopilotpopupmobile").style.display = 'none';
      }
      if(decodeURIComponent(parameter('typeface')) == "Michroma"){
        if (getCookie("lcdu")) {
            document.getElementById("clock").style.fontSize = '15px';
        }else{
            document.getElementById("clock").style.fontSize = '25px';
        }
        document.getElementById("schedule-classTitle").style.fontSize = '15px';
        document.getElementById("schedule-timeRemaining").style.fontSize = '15px';
      }
      else{
        if (getCookie("lcdu")) {
            document.getElementById("clock").style.fontSize = '30px';
        }else{
            document.getElementById("clock").style.fontSize = '40px';
        }
        document.getElementById("schedule-classTitle").style.fontSize = '20px';
        document.getElementById("schedule-timeRemaining").style.fontSize = '20px';
      }
      document.getElementById("schedule-upcomingClasses").style.display = 'none';
      document.getElementById("schedule-remainingText").style.display = 'none';
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
      updateSaveButtonText();

      SetCountDowngeneral();
      generateProfilePic();

      // Initialize overlay visibility if elements exist
      if (document.getElementById('confettiEmojiPicker') && document.getElementById('emojiOverlay')) {
        updateOverlayVisibility();
      }
      
      // Check if user is editor and update gear icon accordingly
      updateGearIconForUser();
  };
  
  
          document.addEventListener("data-ready", function () {
              updateColorAnimations();
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
  
  var enablecardmode = "0";
  if (parameter("cardmode")){
      enablecardmode = "1";
  } else{
      enablecardmode = "0";
  }
  

      //onload url parameter translation into the correlating customization settings
                 //confetti
                  var confettiType = "none"; //declaring confettitype to none at the very beginning so it's able to be changed anywhere
      if(getParameterFromSource("confettitype")){
          confettiType = decodeURIComponent(getParameterFromSource("confettitype")); //if the confetti type exists, set it
      }
      else{
          confettiType = "1";
      }
  
  if(getParameterFromSource('progress')){
      document.querySelector('.progressdatepicker').value = getParameterFromSource('progress');
// Check if progress date is before countdown end date
const progressDate = new Date(getParameterFromSource('progress')).getTime();
const countdownDate = new Date(getParameterFromSource('date')).getTime();

if(getParameterFromSource('progressposition') && getParameterFromSource('progressposition') !== "null"){
    if(getParameterFromSource('progressposition') == 'bar'){
        document.getElementById("progress-bar").classList.add("progress-bar");
        document.getElementById("progress-bar").classList.remove("progress-bar-fullscreen");
    }else if(getParameterFromSource('progressposition') == 'fs'){
        document.getElementById("progress-bar").classList.remove("progress-bar");
        document.getElementById("progress-bar").classList.add("progress-bar-fullscreen");
    }
    else{
        document.getElementById("progress-bar").style.display = "none";
    }
}
    

if(!getParameterFromSource('schedule')){
    if ((progressDate > countdownDate) || progressDate == countdownDate) {
        // Progress date is after countdown date - hide progress bar
        document.getElementById("progress-bar").style.display = "none";
        showToast('Progress start date must be before countdown end date', 'error');
    } else {
        // Progress date is valid - show and update progress bar
        document.getElementById("progress-bar").style.display = "";
    }
}
  else{
    document.getElementById("progress-bar").style.display = "none";
  }
}

  progressbarposition = getParameterFromSource('progressposition');
        if(getParameterFromSource('progressposition')){
        if(getParameterFromSource('progressposition') == 'bar'){
            ProgressPositionBar('auto');
        }
        else if(getParameterFromSource('progressposition') == 'fs'){
            ProgressPositionFullscreen('auto');
        }
        else{
            ProgressPositionNone('auto');
        }
      }else{
        ProgressPositionNone('auto');
      }
  
      //backgrounds
      var bgstring = "none"; //declaring bgstring to none at the very beginning so it's able to be changed anywhere
      if (getParameterFromSource('atc')) {
          bgstring = getParameterFromSource('atc'); //if there is an animated text countdown background, set that to bg string
      }
      else {
          bgstring = "none"; //hypothetically not necessary since that's already the value but there just in case
      }
  
      if(getParameterFromSource('endingsound')){
          document.getElementById("audioLink").value = atob(getParameterFromSource('endingsound'));
      }
  
      
      document.body.scrollTop = document.documentElement.scrollTop = 0; //sometimes browsers are weird and you start already scrolled down a little
  
      //text colors
      var css = document.querySelector(':root'); //easily allowing JS to reference CSS variables
      let colorPickerCount = 4;  //set the default value to 4, as it will always be 4 on load
  
  // Handle legacy color parameters (colorone through colorfour)
  const legacyParams = [
      { param: 'colorone', id: 'color1', cssVar: '--one', defaultColor: '#8426ff' },
      { param: 'colortwo', id: 'color2', cssVar: '--two', defaultColor: '#3ab6ff' },
      { param: 'colorthree', id: 'color3', cssVar: '--three', defaultColor: '#00df52' },
      { param: 'colorfour', id: 'color4', cssVar: '--four', defaultColor: '#ff9900' }
  ];
  
  // Check if any color parameters exist
  const hasAnyColorParams = legacyParams.some(({param}) => getParameterFromSource(param)) || 
      Array.from({length: 4}, (_, i) => i + 5).some(i => getParameterFromSource(`color${i}`));
  
  if (!hasAnyColorParams) {
      // No color parameters found, set up default colors
      legacyParams.forEach(({id, cssVar, defaultColor}) => {
          if (!document.getElementById(id)) {
              addColorPicker("auto");
          }
          document.getElementById(id).value = defaultColor;
          css.style.setProperty(cssVar, defaultColor);
          css.style.setProperty(`--color${id.slice(-1)}`, defaultColor);
      });
  } else {
      // Handle existing color parameters
      legacyParams.forEach(({param, id, cssVar}) => {
        if (getParameterFromSource(param)) {
            if (getParameterFromSource(param) === "null") {
                console.log(`Colors(${id.slice(-1)}) could not be imported properly.`);
            } else {
                const picker = document.getElementById(id);
                picker.addEventListener('dragstart', handleDragStart);
                picker.addEventListener('dragend', handleDragEnd);
                picker.addEventListener('dragover', handleDragOver);
                picker.addEventListener('drop', handleDrop);
                const paramValue = getParameterFromSource(param);
                if (paramValue === 'fg') {
                    // This is a foreground color
                    if (!document.getElementById(id)) {
                        addForegroundColorPicker("auto");

                    } else {
                        const picker = document.getElementById(id);
                        picker.value = getComputedStyle(document.documentElement).getPropertyValue('--mainforegroundcolor').trim();
                        picker.dataset.useThemeColor = 'true';
                        picker.classList.add("fgcolorpicker");
                        picker.disabled = true;
                        picker.style.cursor = "default";
                    }
                } else {
                    const colorToUse = '#' + paramValue;
                    if (!document.getElementById(id)) {
                        addColorPicker("auto");
                        adjustHeightOfColorPickerContainer();
                    }
                    document.getElementById(id).value = colorToUse;
                    css.style.setProperty(cssVar, colorToUse);
                    css.style.setProperty(`--color${id.slice(-1)}`, colorToUse);
                }
            }
        } else {
            // Remove color picker if parameter doesn't exist
            const picker = document.getElementById(id);
            if (picker) {
                picker.parentElement.remove();
            }
        }
    });
  
      // Handle additional color parameters (color5 through color8)
      for (let i = 5; i <= 8; i++) {
        const colorParam = getParameterFromSource(`color${i}`);
        if (colorParam && colorParam !== "null") {
            if (colorParam === 'fg') {
                // This is a foreground color
                if (!document.getElementById(`color${i}`)) {
                    addForegroundColorPicker("auto");
                }
                const picker = document.getElementById(`color${i}`);
                if (picker) {
                    picker.value = getComputedStyle(document.documentElement).getPropertyValue('--mainforegroundcolor').trim();
                    picker.dataset.useThemeColor = 'true';
                    css.style.setProperty(`--color${i}`, 'var(--mainforegroundcolor)');
                    picker.classList.add("fgcolorpicker");
                    picker.disabled = true;
                    picker.style.cursor = "default";
                }
            } else {
                const colorToUse = '#' + colorParam;
                if (!document.getElementById(`color${i}`)) {
                    addColorPicker("auto");
                }
                document.getElementById(`color${i}`).value = colorToUse;
                css.style.setProperty(`--color${i}`, colorToUse);
            }
        }
    }

    // Update colorPickerCount to match actual number of pickers
    const container = document.getElementById('colorPickersContainer');
    if (container) {
        colorPickerCount = container.getElementsByClassName('colorpicker-container').length;
    }
}
  
      //set up countdown schedules
      if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("schedule")){  
          document.getElementById("clock").style.display = "none"; //hide clock
          document.getElementById("countdowntitle").style.display = "none"; //hide title
      document.getElementById("optionsdatecontainer").style.display = "none"; //hide end date area of options
      document.getElementById("optionsendingcontainer").style.display = "none"; //hide ending options area of options	
      document.getElementById("optionsendinganchor").style.opacity = "0.3"; //grey out ending options anchor 	
      document.getElementById("progressdatepickercontainer").style.display = "none"; //hide progress date picker area of options	
      //document.getElementById("optionsprogresscontainer").style.display = "none"; //hide ending options area of options
      //document.getElementById("optionsprogressanchor").style.opacity = "0.3"; //grey out progress options anchor	
      document.getElementById("cdscheduledisclaimer").style.display = ""; //show personal options schedule disclaimer
          document.getElementById("schedule").style.display = ""; //show schedule
      document.querySelector(".schedule-editor").style.display = ""; //show editor
      document.getElementById("presetupScheduleContent").style.display = "none"; //hide the info preconversion popup
  
          if(!getParameterFromSource("date")){
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
      if (getParameterFromSource('typeface')) {
          if (decodeURIComponent(getParameterFromSource('typeface')) == "Fredoka One") { //decode URI Component simply replaces %20 with a space, etc
              FontFredoka('auto'); //calls the function for said font
          }
          else if (decodeURIComponent(getParameterFromSource('typeface')) == "Poppins") {
              FontPoppins('auto');
          }
          else if (decodeURIComponent(getParameterFromSource('typeface')) == "Yeseva One") {
              FontDMSerif('auto'); //fallback for old depreciated font option Yeseva, replaced by DM Serif Display
          }
          else if (decodeURIComponent(getParameterFromSource('typeface')) == "DM Serif Display") {
              FontDMSerif('auto');
          }
          else if (decodeURIComponent(getParameterFromSource('typeface')) == "Orbitron") {
              FontMichroma('auto');
          }
          else if (decodeURIComponent(getParameterFromSource('typeface')) == "Michroma") {
            FontMichroma('auto');
        }
      }
      else {
          css.style.setProperty('--typeface', "Fredoka One"); //if no parameter is found for the typeface, simply set it to the default (Fredoka One)
      }
      handleTitleNavigation();

  
          //date
          if (getParameterFromSource('date')) {
              if(getParameterFromSource('date').includes('T') && getParameterFromSource('date').includes(':') ){ //if there is an included time, it will be saved as 12/34/56T12:34, this is checking for the T and the :
                 document.querySelector(".datepicker").value = getParameterFromSource('date'); 
              }
              else{
                  document.querySelector(".datepicker").value = getParameterFromSource('date') + 'T00:00'; //if there is no included time, and it's just 12/34/56 for example, it adds the T00:00 for midnight. backwards compatibility for before time was supported
              }
              var countDownDate = new Date(document.querySelector(".datepicker").value); //sets the datepicker in settings to the correct date + time
      
              document.getElementById("autopilotpopup").remove(); //removes the Autopilot popup if a date exists
              document.getElementById("autopilotpopupmobile").remove(); //same with mobile Autopilot popup
          }
          else { //if there is no date parameter
              const savedLinks = localStorage.getItem("dashboardsaved"); //get dashboard save data
      

    if ((savedLinks) && (savedLinks !== '[]' && savedLinks !== '' && savedLinks !== 'null') && !getParameterFromSource("createnew")) { // if countdowns have been saved
        const fullUrl = window.location.href;
        const urlParts = fullUrl.split('#');
        let hasMatchingCountdown = false;

        if (urlParts.length >= 2) { // Check if there's a hash
            const urlTitle = urlParts.pop().toLowerCase().trim();
            if (urlTitle && urlTitle !== 'betatimer.html' && urlTitle !== 'timer.html' || urlTitle === 'betatimer' || urlTitle === 'timer') {
                try {
                    const links = JSON.parse(savedLinks);
                    hasMatchingCountdown = links.some(link => {
                        try {
                            const linkUrl = new URL(link.url, window.location.origin);
                            const titleParam = linkUrl.searchParams.get('title');
                            return titleParam && decodeURIComponent(titleParam).toLowerCase().trim() === decodeURIComponent(urlTitle);
                        } catch (e) {
                            console.error('Error parsing URL:', e);
                            return false;
                        }
                    });
                } catch (e) {
                    console.error('Error parsing saved countdowns:', e);
                }
            }
        }

        if (!hasMatchingCountdown) {
            window.location.href = "countdowndashboard"; //take the user to their dashboard
        }
    }
              else{ //no countdowns have been saved; new user experience with Autopilot  
                const { nextHoliday, matchingHoliday } = getHolidayData();
                document.getElementById("autopilotprediction").innerHTML = nextHoliday.fullname; //set Autopilot to tell the user that NYD is next
                document.getElementById("autopilotpredictionmobile").innerHTML = nextHoliday.fullname; //same for Autopilot mobile

                const year = nextHoliday.date.getFullYear();
                const month = String(nextHoliday.date.getMonth() + 1).padStart(2, '0');
                const day = String(nextHoliday.date.getDate()).padStart(2, '0');
                const hours = String(nextHoliday.date.getHours()).padStart(2, '0');
                const minutes = String(nextHoliday.date.getMinutes()).padStart(2, '0');
                document.querySelector(".datepicker").value = `${year}-${month}-${day}T${hours}:${minutes}`;
                SetCountDowngeneral();
          }
      }
      
  
      if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("schedule")){
          document.querySelector(".datepicker").value = '9999-12-30T00:00';
      }

      if ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) || getParameterFromSource("atc") !== "none") {
        document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
        document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(255,255,255,1)');
    }
    else{
        document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
        document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(0,0,0,1)');
    } 

  
      //countdown title
      if (getParameterFromSource('title')) { 
          document.getElementById("countdowntitle").value = decodeURIComponent(getParameterFromSource('title')); //set the front-facing countdown title input to the parameter value, decoding all %20s and such
          setcountdowntitle("front"); //tell the setcountdowntitle function to set the back (settings) to the same. sending which it came from the the function, not which to send it to
          document.querySelector('meta[property="og:title"]').setAttribute('content', 'Countdown to ' + decodeURIComponent(getParameterFromSource('title')));
      }
  
  
      //bg again this time to finish the job
      var bgstring = "none";
      if (getParameterFromSource('atc') && getParameterFromSource('atc') != "none" && getParameterFromSource('atc') != "undefined") { //checking it has a good value
          setbg(getParameterFromSource('atc'), 'auto'); //setbg function takes the number and sets it to that bg, auto tells it that it was run not from settings and not to setcountdowngeneral
          bgstring = getParameterFromSource('atc'); //set the var to the param
      }
      else {
          bgstring = 'none';
          enablecolor(); //make the color pickers in settings not greyed out anymore
          document.getElementById("animatedbackground").style.display = "none"; //remove the rotating blurred images that would hold the bgs
          void document.getElementById("clock").offsetWidth; // Force reflow
          document.getElementById("clock").classList.add("clock"); //make the clock normal
          updateColorAnimations();
          document.getElementById("clock").classList.remove("staticclock"); //not just white clock
      }
  
          //countdown schedule styling
          if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("atc") == "none"){
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
          document.getElementById("confettiEmojiPicker").value = decodeURIComponent(getParameterFromSource("confettitype"));
      }
  
  if(new Date(document.querySelector(".datepicker").value).getMonth() === 11 && new Date(document.querySelector(".datepicker").value).getDate() === 25) { // December is month 11 (0-based)
      document.querySelector('meta[property="og:image"]').setAttribute('content', 'sharepanels/christmasshare.jpg');
  }else{
      document.querySelector('meta[property="og:image"]').setAttribute('content', 'sharepanels/defaultshare.jpg');
  }

  if(getParameterFromSource('endingsound')){
  showToast('This Countdown has an ending sound- tap or click anywhere to allow', 'persistent');
}
  

   //autopilot onclick animation
   function autopilotsparkle(event) {
    // Check if device is desktop (not touch device and window width > 768px)
    if ('ontouchstart' in window || window.innerWidth <= 768) {
        return; // Exit function if not on desktop
    }

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

    // Only handle mouse events now (removed touch events)
    const x = event.pageX;
    const y = event.pageY;

    for (let i = 0; i < 5; i++) {
        create_sparkle(x, y);
    }
}


function handleUserInteraction() {
    if(getParameterFromSource('endingsound')){
    if (!userInteracted) {
      userInteracted = true;
      setTimeout(() => removeToast(document.getElementById('enableaudiotoast')), 10);
    }
}
  
    // Remove listeners after first interaction
    window.removeEventListener('click', handleUserInteraction);
    window.removeEventListener('keydown', handleUserInteraction);
  }
  
  window.addEventListener('click', handleUserInteraction);
  window.addEventListener('keydown', handleUserInteraction);




//confetti groundwork for snowflakes and emoji
class ConfettiManager {
    constructor() {
        this.particleTimeouts = [];
        this.isRunning = false;
    }

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
                
                confettiParticle.style.color = `rgb(${snowflakered}, ${snowflakegreen}, ${snowflakeblue})`;
                confettiParticle.style.fontSize = `${size}px`;
                break;
            case 'emoji':
                const emojiArray = Array.from(content); // Convert the content to an array of characters
                confettiParticle.innerHTML = emojiArray.length > 1 ? emojiArray[Math.floor(Math.random() * emojiArray.length)] : content;
                confettiParticle.style.fontSize = `${size}px`;
                confettiParticle.style.color = `var(--mainforegroundcolor)`;
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
        this.isRunning = true;

        const createParticleLoop = () => {
            if (!this.isRunning) {
                return;
            }

            const confettiParticle = this.createParticle(type, content);
            this.animateParticle(confettiParticle, type);

            const timeoutId = setTimeout(createParticleLoop, Math.random() * 200);
            this.particleTimeouts.push(timeoutId);
        };

        createParticleLoop();
    }

    stopParticles() {
        this.isRunning = false;
        this.particleTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.particleTimeouts = [];
    }
}
  
          const confettiManager = new ConfettiManager();

          // Global variables for emoji overlay functionality
          let emojiPopInterval;
          let emojiPlaceholderIndex = 0;

          function emojiPopNext() {
            const input = document.getElementById('confettiEmojiPicker');
            const overlay = document.getElementById('emojiOverlay');
            if (!input || !overlay) return;
            
            const raw = input.getAttribute('data-placeholders') || '';
            const placeholders = raw.split(',').map(s => s.trim()).filter(Boolean);
            
            if (placeholders.length === 0) return;
            
            overlay.textContent = placeholders[emojiPlaceholderIndex];
            overlay.classList.remove('pop');
            void overlay.offsetWidth;
            overlay.classList.add('pop');
            
            input.placeholder = placeholders[emojiPlaceholderIndex];
            emojiPlaceholderIndex = (emojiPlaceholderIndex + 1) % placeholders.length;
          }

          function startEmojiPopCycle() {
            // Don't start if already running
            if (emojiPopInterval) return;
            
            emojiPopNext();
            emojiPopInterval = setInterval(emojiPopNext, 5000);
          }

          function stopEmojiPopCycle() {
            if (emojiPopInterval) {
              clearInterval(emojiPopInterval);
              emojiPopInterval = null;
            }
          }

          function updateOverlayVisibility() {
            const input = document.getElementById('confettiEmojiPicker');
            const overlay = document.getElementById('emojiOverlay');
            if (!input || !overlay) return;
            
            if (document.activeElement === input || input.value) {
              stopEmojiPopCycle();
              overlay.classList.remove('pop');
              overlay.style.opacity = '0';
              overlay.style.zIndex = '-1';
            } else {
              if (!emojiPopInterval) {
                startEmojiPopCycle();
              }
              overlay.style.opacity = '1';
              overlay.style.zIndex = '';
            }
          }

          document.addEventListener('data-ready', () => {
            const input = document.getElementById('confettiEmojiPicker');
            if (!input) return;
            
            // Initialize overlay visibility (this will start the cycle if appropriate)
            updateOverlayVisibility();
          
            // Event listeners
            input.addEventListener('focus', updateOverlayVisibility);
            input.addEventListener('blur', updateOverlayVisibility);
            input.addEventListener('input', updateOverlayVisibility);
          });
          

          function updateActiveSection() {
            if(!document.getElementById("settings").classList.contains("hidden")){
            const sections = document.querySelectorAll('h1[id]:not(#personalSettingsOverlay h1[id])');
            const sidebarLinks = document.querySelectorAll('.sidebaranchor');
            
            // Get the current scroll position
            const scrollPosition = window.scrollY;
            
            // Find the current section
            let currentSection = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop - 100; // Offset to trigger slightly before reaching section
                if (scrollPosition >= sectionTop) {
                    currentSection = section.id;
                }
            });
            
            // Update active state of sidebar links
            sidebarLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentSection}`) {
                    link.classList.add('active');
                }
            });
        }
        }
        
        // Add scroll event listener
        window.addEventListener('scroll', updateActiveSection);
        // Call once on load to set initial state
        window.addEventListener('load', updateActiveSection);


function spawnIcon(el) {
  const icon = document.createElement('i');
  const icons = [
    'fa-heart',
    'fa-star',
    'fa-music',
    'fa-bolt',
    'fa-fire',
    'fa-snowflake',
    'fa-tree',
    'fa-gift',
    'fa-bell',
    'fa-candy-cane',
    'fa-holly-berry',
    'fa-hat-wizard',
    'fa-ghost',
    'fa-pumpkin',
    'fa-birthday-cake',
    'fa-champagne-glasses',
  ];
  
  icon.className = `fas ${icons[Math.floor(Math.random() * icons.length)]} floating-icon`;
  
  // Position relative to parent
  const rect = el.getBoundingClientRect();
  icon.style.left = `${20 + Math.random() * (rect.width - 40)}px`;
  icon.style.top = `${rect.height - (Math.random() * rect.height)}px`;
  el.appendChild(icon);

  setTimeout(() => icon.remove(), 5000); // Remove after animation
}

function initFloatingIcons() {
    document.querySelectorAll('.float-icons').forEach(el => {
        setInterval(() => {
          if (Math.random() < 0.3) spawnIcon(el);
        }, 300);
      });
}

document.addEventListener('data-ready', initFloatingIcons);
          
        
  
      //animation speed toggle
      // New dropdown speed picker
      // Place this block after cookie acceptance logic
      const speedDropdown = document.getElementById('speedDropdown');
      if (speedDropdown) {
        const speedButton = speedDropdown.querySelector('.dropdown-button');
        const speedMenu = document.getElementById('speedMenu');
        const speedItems = speedMenu.querySelectorAll('.dropdown-item');
        
        speedButton.addEventListener('click', () => {
            if (!speedMenu.classList.contains('visible')) {
                speedMenu.classList.add('visible', 'animate-open');
                speedMenu.addEventListener('animationend', () => {
                    speedMenu.classList.remove('animate-open');
                    speedMenu.classList.add('opened');
                }, { once: true });
            } else {
                speedMenu.classList.remove('visible', 'opened');
            }
        });
        
        speedItems.forEach(item => {
            item.addEventListener('click', () => {
                const speed = item.dataset.speed;
                
                if (speed === 'slow') {
                    speed2();
                    document.cookie = 'speed2=True';
                    document.cookie = 'speed1=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                    document.cookie = 'speed3=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                    
                    speedButton.style.color = '#595959';
                    setTimeout(() => {
                        speedButton.innerHTML = '<i class="fa-solid fa-seedling"></i> Slow';
                        speedButton.style.color = '#ffffff';
                    }, 150);
                } else if (speed === 'default') {
                    speed1();
                    document.cookie = 'speed1=True';
                    document.cookie = 'speed2=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                    document.cookie = 'speed3=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                    
                    speedButton.style.color = '#595959';
                    setTimeout(() => {
                        speedButton.innerHTML = '<i class="fa-solid fa-gauge"></i> Default';
                        speedButton.style.color = '#ffffff';
                    }, 150);
                } else if (speed === 'fast') {
                    speed3();
                    document.cookie = 'speed3=True';
                    document.cookie = 'speed1=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                    document.cookie = 'speed2=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                    
                    speedButton.style.color = '#595959';
                    setTimeout(() => {
                        speedButton.innerHTML = '<i class="fa-solid fa-bolt"></i> Fast';
                        speedButton.style.color = '#ffffff';
                    }, 150);
                }
        
                speedMenu.classList.remove('visible', 'opened');
            });
        });
        
      }
      if (speedDropdown) {
        const speedButton = speedDropdown.querySelector('.dropdown-button');
        if (getCookie("speed1")) {
            speed1();
            speedButton.innerHTML = '<i class="fa-solid fa-gauge"></i> Default';
        } else if (getCookie("speed2")) {
            speed2();
            speedButton.innerHTML = '<i class="fa-solid fa-seedling"></i> Slow';
        } else if (getCookie("speed3")) {
            speed3();
            speedButton.innerHTML = '<i class="fa-solid fa-bolt"></i> Fast';
        }
    }
  
      function speed1() {
          if (!isNaN(getParameterFromSource("atc"))) {
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
  
          if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("atc") == "none"){
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
          if (!isNaN(getParameterFromSource("atc"))) {
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
  
          if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("atc") == "none"){
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
          if (!isNaN(getParameterFromSource("atc"))) {
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
  
          if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("atc") == "none"){
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
      document.getElementById("toolbar-notch").style.display = "";
  
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

      const includeDropdown = document.getElementById('includeDropdown');
      const includeButton = includeDropdown.querySelector('.dropdown-button');
      const includeMenu = document.getElementById('includeMenu');
      const includeItems = includeMenu.querySelectorAll('.dropdown-item');
      
      includeButton.addEventListener('click', () => {
        if (!includeMenu.classList.contains('visible')) {
          includeMenu.classList.add('visible', 'animate-open');
          includeMenu.addEventListener('animationend', () => {
            includeMenu.classList.remove('animate-open');
            includeMenu.classList.add('opened');
          }, { once: true });
        } else {
          includeMenu.classList.remove('visible', 'opened');
        }
      });
      
      includeItems.forEach(item => {
        item.addEventListener('click', () => {
          const unit = item.dataset.unit;
          const allUnits = ['week', 'day', 'hour', 'minute', 'second', 'millisecond'];
      
          if (unit === 'none') {
            allUnits.forEach(u => eraseCookie(u));
          } else {
            setCookie(unit, 'true', '70');
            allUnits.filter(u => u !== unit).forEach(u => eraseCookie(u));
          }
      
      
          includeButton.style.color = '#595959';
          setTimeout(() => {
            includeButton.innerHTML = item.innerHTML;
            includeButton.style.color = '#ffffff';
          }, 150);
          includeMenu.classList.remove('visible', 'opened');
          updateoptions();
        });
      });
      
      // On load: set correct label
      const initUnit = ['week', 'day', 'hour', 'minute', 'second', 'millisecond'].find(u => getCookie(u));
      const defaultItem = [...includeItems].find(i => i.dataset.unit === (initUnit || 'none'));
      if (defaultItem) {
        includeButton.innerHTML = defaultItem.innerHTML;
      }
  
      function SetCountDowngeneral() { //gets called quite a bit, updates all settings and parameters to match the current state
        countDownDate = new Date(document.querySelector(".datepicker").value);
        var css = document.querySelector(':root');
        var colors = [];
        var colorsNormalized = [];
        
        // Get all color pickers dynamically
        const colorPickers = document.querySelectorAll('.colorpicker, .disabledcolorpicker');
        colorPickers.forEach((picker, index) => {
            // If this picker is marked to use theme color, get the current theme color
            if (picker.dataset.useThemeColor === 'true') {
                const computedStyle = getComputedStyle(document.documentElement);
                const themeColor = computedStyle.getPropertyValue('--mainforegroundcolor').trim();
                picker.value = themeColor;
                colors[index] = 'fg';
                colorsNormalized[index] = 'fg';
            } else {
                colors[index] = picker.value;
                colorsNormalized[index] = picker.value.replace("#", "");
            }
            css.style.setProperty(`--color${index + 1}`, colors[index]);
        });

        // Maintain backwards compatibility with old CSS variables
        css.style.setProperty('--one', colors[0] || '#8426ff');
        css.style.setProperty('--two', colors[1] || '#3ab6ff');
        css.style.setProperty('--three', colors[2] || '#00ff5e');
        css.style.setProperty('--four', colors[3] || '#ff9900');
        adjustHeightOfColorPickerContainer();
  
          var cdtitle = document.getElementById("countdowntitle").value; //set the title
  
      updateSaveButtonText();

          
          if(cdtitle){
              document.querySelector('meta[property="og:title"]').setAttribute('content', 'Countdown to ' + cdtitle);
          }
          else{
              document.querySelector('meta[property="og:title"]').setAttribute('content', 'Minutehand - Michael Dors');
          }

          if(cdtitle && ((document.getElementById('savedash').innerHTML == '<i class="fa-solid fa-star"></i> Update') || document.getElementById('savedash').innerHTML == '<i class="fa-solid fa-circle-check"></i> Saved')){
              document.getElementById('localshortcutcontainerdiv').style.display = '';
              document.getElementById('localshortcutcontainerdivtooltip').style.display = '';
          }
          else{
              document.getElementById('localshortcutcontainerdiv').style.display = 'none';
              document.getElementById('localshortcutcontainerdivtooltip').style.display = 'none';
          }
          
  
          if(countDownDate.getMonth() === 11 && countDownDate.getDate() === 25) { // December is month 11 (0-based)
              document.querySelector('meta[property="og:image"]').setAttribute('content', 'sharepanels/christmasshare.jpg');
          }else{
          document.querySelector('meta[property="og:image"]').setAttribute('content', 'sharepanels/defaultshare.jpg');
      }
  
          if(!confettiType){
              confettiType = document.getElementById("confettiEmojiPicker").value;
          }

          // Build color parameters string
          let colorParams = '';
          colorsNormalized.forEach((color, index) => {
              if (index < 4) {
                  // Maintain backwards compatibility with original parameter names
                  const paramNames = ['colorone', 'colortwo', 'colorthree', 'colorfour'];
                  colorParams += `&${paramNames[index]}=${color}`;
              } else {
                  // Add additional colors with new parameter names
                  colorParams += `&color${index + 1}=${color}`;
              }
          });
  
          var parameterstring = 
          '?date=' + document.querySelector(".datepicker").value + 
          colorParams + 
          '&typeface=' + encodeURIComponent(css.style.getPropertyValue('--typeface')) + 
          '&atc=' + bgstring + 
          '&title=' + encodeURIComponent(cdtitle) + 
          '&confettitype=' + confettiType + 
      '&progress=' + document.getElementById("progressdatepicker").value + 
      '&progressposition=' + progressbarposition + 
          '&endingsound=' + btoa(document.getElementById("audioLink").value) + 
          '&schedule=' + getParameterFromSource('schedule');

          window.CountdownDataSource = parameterstring;

          var refresh = window.location.protocol + "//" + window.location.host + window.location.pathname + parameterstring;
          // Only update URL if it's actually different to avoid unnecessary history entries
          if(window.CountdownDataSourceOrigin == "url"){
            if (window.location.href !== refresh) {
                window.history.replaceState({ path: refresh }, '', refresh); //update current URL without creating new history entry
            }
  
            document.getElementById("linkinput").value = refresh; //refresh the link
            document.getElementById("linkinput-info").value = refresh; //refresh the info pane link
            document.getElementById("previewiframe").src = refresh + "&cardmode=true";
            document.getElementById("locallinkinput").value = "https://michaeldors.com/mcacountdown/betatimer#" + encodeURIComponent(cdtitle);
            if(document.getElementById('qrcodecontainerdiv').offsetWidth > document.getElementById("localshortcutcontainerdiv").style.width){
                document.getElementById("localshortcutcontainerdiv").style.width = document.getElementById('qrcodecontainerdiv').offsetWidth + 'px';
            }
          }else if (window.CountdownDataSourceOrigin == "db"){
            if(window.CountdownDataID){
                var dbrefresh = window.location.protocol + "//" + window.location.host + window.location.pathname + "?id=" + window.CountdownDataID;
            }else{
                var dbrefresh = window.location.protocol + "//" + window.location.host + window.location.pathname;
            }
            window.history.replaceState({path: dbrefresh}, '', dbrefresh);
            document.getElementById("linkinput").value = dbrefresh; //refresh the link
            document.getElementById("linkinput-info").value = dbrefresh; //refresh the info pane link
            document.getElementById("previewiframe").src = refresh + "&cardmode=true";
            document.getElementById("locallinkinput").value = "https://michaeldors.com/mcacountdown/betatimer#" + encodeURIComponent(getParameterFromSource('title'));
            if(document.getElementById('qrcodecontainerdiv').offsetWidth > document.getElementById("localshortcutcontainerdiv").style.width){
                document.getElementById("localshortcutcontainerdiv").style.width = document.getElementById('qrcodecontainerdiv').offsetWidth + 'px';
            }

            syncCountdownToDatabase(parameterstring);
          }
          else if (window.CountdownDataSourceOrigin == "testing"){
            var testingrefresh = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path: testingrefresh}, '', testingrefresh);
            document.getElementById("linkinput").value = testingrefresh; //refresh the link
            document.getElementById("linkinput-info").value = testingrefresh; //refresh the info pane link
            const previewIframe = document.getElementById("previewiframe");
            document.querySelector('.preview-label').style.display = "none";
            previewIframe.style.background = "center / contain no-repeat url('Backgrounds/loginpreview.png')";
            document.getElementById("loginpromptcard").style.display = "flex";
            document.getElementById("sharingcenter").style.display = "none";
            document.getElementById("locallinkinput").value = "https://michaeldors.com/mcacountdown/betatimer";
            if(document.getElementById('qrcodecontainerdiv').offsetWidth > document.getElementById("localshortcutcontainerdiv").style.width){
                document.getElementById("localshortcutcontainerdiv").style.width = document.getElementById('qrcodecontainerdiv').offsetWidth + 'px';
            }
          }
          makeQR(); //refresh the QR code
          
          // Initialize title position based on current clock font size
          const clockElement = document.getElementById("clock");
          if (clockElement) {
              const computedStyle = window.getComputedStyle(clockElement);
              const fontSize = parseInt(computedStyle.fontSize);
              updateTitlePosition(fontSize);
          }
      }
  
      
      function generateShortId() {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          console.log("uploading cd to db - generating ID");
          let result = '';
          for (let i = 0; i < 11; i++) {
              result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
      }

            // Database sync cooldown
            let lastDatabaseSync = 0;
            const DATABASE_SYNC_COOLDOWN = 5000; // 5 seconds
      
      async function syncCountdownToDatabase(countdownData) {
        console.log("uploading cd to db - init");
          // Check cooldown
          const now = Date.now();
          if (now - lastDatabaseSync < DATABASE_SYNC_COOLDOWN) {
            console.log("uploading cd to db - stopped via cooldown");
              isInCooldown = true;
              // Set a timeout to reset the cooldown flag after the cooldown period
              setTimeout(() => {
                  isInCooldown = false;
              }, DATABASE_SYNC_COOLDOWN - (now - lastDatabaseSync));
              return;
          }
          
          try {

              // Check if user is authenticated using the same system as account dropdown
              console.log("uploading cd to db - checking supabase client:", typeof window.supabaseClient, window.supabaseClient?.auth);
              
              // Wait for Supabase client to be available and initialized
              if (typeof window.supabaseClient === "undefined" || !window.supabaseClient.auth) {
                  console.log("uploading cd to db - supabase client not available, skipping sync");
                  return; // Supabase client not available, skip sync
              }
              
              // Use the same pattern as the auth listener setup
              const { data: { session } } = await window.supabaseClient.auth.getSession();
              console.log("uploading cd to db - session result:", session);
              
              if (!session) {
                  console.log("uploading cd to db - not logged in");
                  return; // Not logged in, skip sync
              }
              
              const user = session.user;
              console.log("uploading cd to db - user found:", user.id);
              
              console.log("uploading cd to db " + countdownData);
              
              // Use existing ID if available, otherwise generate new one
              const countdownId = window.CountdownDataID || generateShortId();
              window.CountdownDataID = countdownId;
              console.log("id" + window.CountdownDataID);
              console.log("uploading cd to db " + countdownId);
              
              // Save to database
              const { error } = await window.supabaseClient
                  .from('countdown')
                  .upsert({
                      id: countdownId,
                      data: JSON.stringify(countdownData),
                      creator: user.id,
                      collaborator_ids: [],
                      visibility: 1 // unlisted by default
                  }, { onConflict: ['id'] });
                  
              if (error) {
                  console.error('[syncCountdownToDatabase] Database sync failed:', error.message);
              } else {
                  console.log('[syncCountdownToDatabase] Countdown synced to database');
                  lastDatabaseSync = now;
                  isInCooldown = false;
              }
          } catch (error) {
              console.error('[syncCountdownToDatabase] Error during database sync:', error);
          }
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

      function getParameterFromSource(name){
        var query = window.CountdownDataSource.substring(1);
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
  
          // Check if user is an editor
          isUserEditor().then(isEditor => {
              if (isEditor) {
                  // User is editor - show normal settings
                  if (document.getElementById("settings").classList.contains("hidden")) { //if settings is closed (Being opened)
                      document.getElementById("schedule").style.display = "none"; //hide schedule
                      document.getElementById("settings").classList.remove("hidden"); //unhide settings
                      document.getElementById("clock").style.display = "none"; //hide clock
                      document.getElementById("schedule").style.display = "none"; //hide schedule
                      document.getElementById("countdowntitle").style.display = "none"; //hide title
                      document.getElementById("gear").classList.add("hidden"); //hide settings icon
                      document.getElementById("toolbar-notch").style.display = "none"; //hide settings icon
                      document.getElementById("innergear").classList.add("hidden"); //hide inner settings icon
                      document.getElementById("preloader").classList.add("hidden"); //hide loading screen?
                      document.getElementById("unfocused").classList.add("hidden"); //hide memsave popup
                    document.getElementById("progress-bar").classList.add("hidden"); //hide progress bar
                      document.getElementById("body").style.overflowY = ''; //allow scrolling
                      document.body.scrollTop = document.documentElement.scrollTop = 0; //scroll to top for good measure
                  }
                  else { //if settings is already opened (Being closed)
                      if(getParameterFromSource("schedule") != "null"){ //if user is using Countdown Schedule
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
                      document.getElementById("toolbar-notch").style.display = ""; //unhide gear icon
                      document.getElementById("innergear").classList.remove("hidden"); //unhide inner settings icon
                      document.getElementById("preloader").classList.add("hidden"); //hide loading screen?
                      document.getElementById("unfocused").classList.add("hidden"); //hide memsave popup
                    document.getElementById("progress-bar").classList.remove("hidden"); //unhide progress bar
                      document.getElementById("body").style.overflowY = 'hidden'; //don't allow scrolling
                      document.body.scrollTop = document.documentElement.scrollTop = 0; //once again scroll to top for good measure
                  if(document.getElementById('savedash').innerHTML == '<i class="fa-solid fa-star"></i> Update'){
                  showToast('Some changes have not been saved to Dashboard', 'save');	
                  }
                  if ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) || getParameterFromSource("atc") !== "none") {
                    document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
                    document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(255,255,255,1)');
                }
                else{
                    document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
                    document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(0,0,0,1)');
                } 
                  }
              } else {
                  // User is not editor - show info pane instead
                  if (document.getElementById("infoPane").classList.contains("hidden")) { //if info pane is closed (Being opened)
                      document.getElementById("infoPane").classList.remove("hidden"); //unhide info pane
                      
                      document.getElementById("body").style.overflowY = ''; //allow scrolling
                      document.body.scrollTop = document.documentElement.scrollTop = 0; //scroll to top for good measure
                  }
                  else { //if info pane is already opened (Being closed)
                    document.getElementById("infoPane").classList.add("hidden"); //unhide info pane

                    document.getElementById("progress-bar").classList.remove("hidden"); //unhide progress bar
                      document.getElementById("body").style.overflowY = 'hidden'; //don't allow scrolling
                      document.body.scrollTop = document.documentElement.scrollTop = 0; //once again scroll to top for good measure
                  }
              }
          });

          if(document.getElementById("progressdatepicker").value && document.getElementById("progressdatepicker").value !== "null"){
            document.getElementById("progress-bar").style.display = "";
            if(getParameterFromSource("atc") !== "none"){
                document.getElementById('progress').classList.remove("progresscolored");
                document.getElementById('progress').classList.add("progressblur");
            }
            else{
                document.getElementById('progress').style.background = window.getComputedStyle(document.getElementById("clock")).getPropertyValue("color");
                document.getElementById('progress').classList.add("progresscolored");
                document.getElementById('progress').classList.remove("progressblur");
            }
          }
          else{
            document.getElementById("progress-bar").style.display = "none";
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

// Improved searchsettings function for settings search
function searchsettings() {
    const input = document.getElementById("searchbarinput");
    const filter = input.value.toLowerCase();
    const resultsContainer = document.getElementById("search-results");
    resultsContainer.innerHTML = "";

    if (!filter) {
        resultsContainer.classList.add("hidden");
        return;
    }

    const headings = document.querySelectorAll('#settings h1[id], #settings h2[id], #settings h3[id]');
    let found = false;

    headings.forEach(heading => {
        let combinedText = heading.textContent.toLowerCase();
        let sibling = heading.nextElementSibling;
        let collectedText = "";

        while (sibling && !['H1','H2','H3'].includes(sibling.tagName)) {
            collectedText += " " + sibling.textContent.toLowerCase();
            sibling = sibling.nextElementSibling;
        }

        combinedText += collectedText;

        if (combinedText.includes(filter)) {
            const resultBtn = document.createElement("button");
            resultBtn.className = "searchresultbtn";
            resultBtn.textContent = heading.textContent;
            resultBtn.onclick = () => {
                heading.scrollIntoView({ behavior: "smooth", block: "start" });
                document.getElementById("searchbarinput").value = "";
                resultsContainer.innerHTML = "";
                resultsContainer.classList.add("hidden");

                if (window.innerWidth < 768) {
                    settings(); // close settings on mobile
                }
            };
            resultsContainer.appendChild(resultBtn);
            found = true;
        }
    });

    resultsContainer.classList.toggle("hidden", !found);
}
  
      //grey out color pickers and theme color for background
      if (!isNaN(getParameterFromSource("atc"))) { //if animated background is enabled
          document.getElementById("animatedbackground").classList.remove("hidden"); //unhide background
          document.querySelector("meta[name=theme-color]").setAttribute("content", '#141414'); //sets the theme color to grey
          disablecolor(); //greys out color picker
      }
      else { //if animated background is disabled
          document.getElementById("animatedbackground").classList.add("hidden"); //hide background
          if (document.getElementById("clock") && document.getElementById("clock").style.display !== "none") { //if the clock exists and settings is not open
              document.querySelector("meta[name=theme-color]").setAttribute("content", window.getComputedStyle(document.getElementById("clock")).getPropertyValue("color")); //sets the theme color to the current foreground color
          }
          else if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("schedule")){ //if using schedule instead of clock
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
              document.documentElement.style.overflowY = "hidden";
          } //if settings is closed we perpetually scroll to the top of the tab 
          else{
            document.documentElement.style.overflowY = "";
          }
  
          updateoptions();

        if(getCookie('increasecontrast')){
            document.documentElement.style.filter = 'contrast(150%)';
        }
        else{
            document.documentElement.style.filter = 'contrast(100%)';
        }

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setDarkMode();
        }
        else{
            setLightMode();
        }
  
  
          if (!isNaN(getParameterFromSource("atc"))) {
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
            void document.getElementById("clock").offsetWidth; // Force reflow
              document.getElementById("clock").classList.add("clock"); //add back colored clock
              updateColorAnimations();
              document.getElementById("clock").classList.remove("staticclock"); //remove white only clock
              if (document.getElementById("clock") && document.getElementById("clock").style.display !== "none") { //if the clock exists and settings is not opened
                  document.querySelector("meta[name=theme-color]").setAttribute("content", window.getComputedStyle(document.getElementById("clock")).getPropertyValue("color")); //sets the theme color to the current foreground color
              }
              else if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("schedule")){ //if using schedule instead of clock
                  document.querySelector("meta[name=theme-color]").setAttribute("content", window.getComputedStyle(document.getElementById("schedule-currentClass")). getPropertyValue("background-color")); //sets the theme color to the current foreground color
              }
              else{ //should never be triggered(?) mostly a fallback
                  document.querySelector("meta[name=theme-color]").setAttribute("content", '#8426ff'); //sets the theme color to Countdown Purple
              }
              
              enablecolor(); //un-greys color picker
          }
  
          document.getElementById("preloader").classList.add("hidden"); //hide loading screen

          if(document.getElementById("progressdatepicker").value && document.getElementById("progressdatepicker").value !== "null"){
            if(getParameterFromSource("atc") !== "none"){
                document.getElementById('progress').classList.remove("progresscolored");
                document.getElementById('progress').classList.add("progressblur");
            }
            else{
                document.getElementById('progress').style.background = window.getComputedStyle(document.getElementById("clock")).getPropertyValue("color");
                document.getElementById('progress').classList.add("progresscolored");
                document.getElementById('progress').classList.remove("progressblur");
            }
          }

  
          var now = new Date().getTime();
  
          var distance = countDownDate - now;
  
      function formatZeroesofNumber(num) {
              return num < 10 ? '0' + num : num;
      }
      
          var days = Math.floor(distance / (1000 * 60 * 60 * 24));
          var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          var seconds = Math.floor((distance % (1000 * 60)) / 1000);
  
  
          if(getParameterFromSource("schedule") == "null"){ //will only trigger when there is no schedule active. schedule titles are handled with the cdschedule code.
              if (document.getElementById("countdowntitle").value != "") { //if the countdown has a title
                  if (days > 0) { //if it's over 0 days, we use the days text with the title since there is a title
                      if(days == 1){
                          document.title = document.getElementById("countdowntitle").value + " in " + days + " day | Minutehand";
                      }
                      else{
                          document.title = document.getElementById("countdowntitle").value + " in " + days + " days | Minutehand";
                      }
                  }
                  else if (hours > 0) { //over 0 hours use hours with title
                      if(hours == 1){
                          document.title = document.getElementById("countdowntitle").value + " in " + hours + " hour | Minutehand";
                      }
                      else{
                          document.title = document.getElementById("countdowntitle").value + " in " + hours + " hours | Minutehand";
                      }
                  }
                  else if (minutes > 0) { //over 0 minutes use minutes with title
                      if(minutes == 1){
                          document.title = document.getElementById("countdowntitle").value + " in " + minutes + " minute | Minutehand";
                      }
                      else{
                          document.title = document.getElementById("countdowntitle").value + " in " + minutes + " minutes | Minutehand";
                      }
                  }
                  else if (seconds > 0) { //over 0 seconds use seconds with title
                      if(seconds == 1){
                          document.title = document.getElementById("countdowntitle").value + " in " + seconds + " second | Minutehand";
                      }
                      else{
                          document.title = document.getElementById("countdowntitle").value + " in " + seconds + " seconds | Minutehand";
                      }
                  }
                  else { //otherwise just use Minutehand
                      document.title = "Minutehand";
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
                      document.title = "Minutehand";
                  }
              }
          }
  
          //only include
          if (getCookie("day")) {
            if(days == 1){
                document.getElementById("clock").innerHTML = days + " day"; //no calc, just use days
            }
            else{
                document.getElementById("clock").innerHTML = days + " days"; //no calc, just use days
            }
              if(enablecardmode == "0"){
                  document.getElementById("clock").style.fontSize = '75px';
                  updateTitlePosition(75);
              }
          }
          else if (getCookie("hour")) {
              var hourcount = Math.floor(distance / 3600000); //figure out how many hours in that many milliseconds
              if(hourcount == 1){
                  document.getElementById("clock").innerHTML = hourcount + " hour";
              } else {
                  document.getElementById("clock").innerHTML = hourcount + " hours";
              }
              if(enablecardmode == "0"){
                  document.getElementById("clock").style.fontSize = '75px';
                  updateTitlePosition(75);
              }
          }
          else if (getCookie("minute")) {
              var minutecount = Math.floor(distance / 60000); //milliseconds converted to days
              if(minutecount == 1){
                  document.getElementById("clock").innerHTML = minutecount + " minute";
              } else {
                  document.getElementById("clock").innerHTML = minutecount + " minutes";
              }
              if(enablecardmode == "0"){
                  document.getElementById("clock").style.fontSize = '75px';
                  updateTitlePosition(75);
              }
          }
          else if (getCookie("second")) {
              var secondcount = Math.floor(distance / 1000); //milliseconds converted to seconds
              if(secondcount == 1){
                  document.getElementById("clock").innerHTML = secondcount + " second";
              } else {
                  document.getElementById("clock").innerHTML = secondcount + " seconds";
              }
              if(enablecardmode == "0"){
                  document.getElementById("clock").style.fontSize = '75px';
                  updateTitlePosition(75);
              }
          }
          else if (getCookie("millisecond")) {
              if(distance == 1){
                  document.getElementById("clock").innerHTML = distance + " millisecond"; //no calc, just use milliseconds
              } else {
                  document.getElementById("clock").innerHTML = distance + " milliseconds"; //no calc, just use milliseconds
              }
              if(enablecardmode == "0"){
                  document.getElementById("clock").style.fontSize = '75px';
                  updateTitlePosition(75);
              }
          }
          else if (getCookie("week")) {
              var weekcount = Math.floor(days / 7); //days / seven, weeks
              if(weekcount == 1){
                  document.getElementById("clock").innerHTML = weekcount + " week";
              } else {
                  document.getElementById("clock").innerHTML = weekcount + " weeks";
              }
              if(enablecardmode == "0"){
                  document.getElementById("clock").style.fontSize = '75px';
                  updateTitlePosition(75);
              }
          }
          else if (getCookie("lcdu")) { //label countdown units
              if (days > 0) {
                  document.getElementById("clock").innerHTML = days + "d " + hours + "h " + minutes + "m " + seconds + "s "; //same as title, change the text as needed depending on what's left
                  if(enablecardmode == "0"){
                      document.getElementById("clock").style.fontSize = '75px';
                      updateTitlePosition(75);
                  }
              }
              else if (hours > 0) {
                  document.getElementById("clock").innerHTML = hours + "h " + minutes + "m " + seconds + "s "; //only for hours, no more days
                  if(enablecardmode == "0"){
                      document.getElementById("clock").style.fontSize = '100px';
                      updateTitlePosition(100);
                  }
              }
              else if (minutes > 0) {
                  document.getElementById("clock").innerHTML = minutes + "m " + seconds + "s "; //only for minutes no more hours
                  if(enablecardmode == "0"){
                      document.getElementById("clock").style.fontSize = '150px';
                      updateTitlePosition(150);
                  }
              }
              else {
                  document.getElementById("clock").innerHTML = seconds + "s"; //just seconds
                  if(enablecardmode == "0"){
                      document.getElementById("clock").style.fontSize = '175px';
                      updateTitlePosition(175);
                  }
              }
          }
          else { //not labeling or only including
              if (days > 0) {
                  document.getElementById("clock").innerHTML =  formatZeroesofNumber(days) + ":" +  formatZeroesofNumber(hours) + ":" +  formatZeroesofNumber(minutes) + ":" +  formatZeroesofNumber(seconds); //same as labeled just without labels
                  if(enablecardmode == "0"){
                      document.getElementById("clock").style.fontSize = '75px';
                      updateTitlePosition(75);
                  }
              }
              else if (hours > 0) {
                  document.getElementById("clock").innerHTML =  formatZeroesofNumber(hours) + ":" +  formatZeroesofNumber(minutes) + ":" +  formatZeroesofNumber(seconds); //only for hours no more days
                  if(enablecardmode == "0"){   
                      document.getElementById("clock").style.fontSize = '100px';
                      updateTitlePosition(100);
                  }
              }
              else if (minutes > 0) {
                  document.getElementById("clock").innerHTML =  formatZeroesofNumber(minutes) + ":" +  formatZeroesofNumber(seconds); //only for minutes no more hours
                  if(enablecardmode == "0"){
                      document.getElementById("clock").style.fontSize = '150px';
                      updateTitlePosition(150);
                  }
              }
              else {
                  document.getElementById("clock").innerHTML = seconds;
                  if(enablecardmode == "0"){
                      document.getElementById("clock").style.fontSize = '175px'; //just seconds
                      updateTitlePosition(175);
                  } 
              }
          }
  
if(enablecardmode == "1"){
     cardmodemanager();
  }
  
if(getParameterFromSource('progressposition') && getParameterFromSource('progressposition') !== "null"){ //if the user has their progress bar enabled

    if(getParameterFromSource('progressposition') == 'bar'){
        document.getElementById("progress-bar").classList.add("progress-bar");
        document.getElementById("progress-bar").classList.remove("progress-bar-fullscreen");
    }else if(getParameterFromSource('progressposition') == 'fs'){
        document.getElementById("progress-bar").classList.remove("progress-bar");
        document.getElementById("progress-bar").classList.add("progress-bar-fullscreen");
    }
    else{
        document.getElementById("progress-bar").style.display = "none";
    }

    // Calculate duration between progress start and countdown end dates
    const progressStartDate = new Date(document.querySelector('.progressdatepicker').value);
    const countdownEndDate = new Date(document.querySelector('.datepicker').value);
    const countdownDuration = countdownEndDate - progressStartDate;
    
    // Calculate elapsed time since progress start date
    const progressDistance = new Date() - progressStartDate;
    
    // Calculate progress percentage (0-100)
    const progressBarValue = Math.min(100, Math.max(0, (progressDistance / countdownDuration) * 100));
    
    // Update progress bar width
    document.getElementById('progress').style.width = `${progressBarValue}%`;
    document.getElementById("progress-bar").style.display = "";
}else{
    document.getElementById("progress-bar").style.display = "none";
}
  
          if(distance < 1){ //when countdown is one second from ending, to give time to load
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
  
  
                startConfettiManagerAnimation();
          }
  
      }, 1);

function stopConfettiManagerAnimation(){
    stopConfetti();
    confettiManager.stopParticles();
}

    function startConfettiManagerAnimation(){
                      if (!getCookie('coce')) { //if disable confetti is not enabled, 
                  if(confettiType == "1"){ //default confetti
                      if(getParameterFromSource("atc") == "none"){
                      const colorPickers = document.querySelectorAll('.colorpicker');
                      confetticolorstring = Array.from(colorPickers).map(picker => picker.value).join(', ');
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
  
                          confetticolorstring = eval(`bg${getParameterFromSource("atc")}colors`);
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
            if (getCookie("increasecontrast")) {
              document.getElementById("contrast").classList.add("enabled");
              document.getElementById("contrast").classList.remove("disabled");
          }
          else {
              document.getElementById("contrast").classList.remove("enabled");
              document.getElementById("contrast").classList.add("disabled");
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


          if(!getParameterFromSource('cardmode') == "1"){
            // Use debounce to limit execution to once every 30 seconds
            const debouncedCookieSync = debounce(() => {
             syncCookiesToCloud();
            }, 30000);
            debouncedCookieSync();
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

function contrast(){ //increase contrast set or remove cookie
    if(getCookie('increasecontrast')){
        eraseCookie('increasecontrast');
    }
    else{
        setCookie('increasecontrast', 'true', '70');
    }
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
          eraseCookie('increasecontrast');
          eraseCookie('preferlightscheme');
          updateoptions(); //update classes of settings buttons
  
          document.getElementById("animatedbackground").style.display = "none"; //remove animated bg
          bgstring = "none"; //set the background var to none
  
          var css = document.querySelector(':root'); //access the CSS variables
          // Remove any additional color pickers beyond the first four
          const container = document.getElementById('colorPickersContainer');
          while (container.children.length > 4) {
              container.lastChild.remove();
          }
          colorPickerCount = 4;
          // Reset the original four color pickers
          document.getElementById("color1").value = "#8426ff";
          document.getElementById("color2").value = "#3ab6ff";
          document.getElementById("color3").value = "#00ff5e";
          document.getElementById("color4").value = "#ff9900";
          // Reset CSS variables
          css.style.setProperty('--one', "#8426ff");
          css.style.setProperty('--two', "#3ab6ff");
          css.style.setProperty('--three', "#00ff5e");
          css.style.setProperty('--four', "#ff9900");
          adjustHeightOfColorPickerContainer();
          css.style.setProperty('--typeface', "Fredoka One"); //reset typeface
  
          localStorage.removeItem('dashboardsaved'); //reset dashboard
          localStorage.removeItem('pfp_color'); //reset dashboard
          localStorage.removeItem('pfp_name'); //reset dashboard
  
          window.location.href = window.location.origin + window.location.pathname; //set URL
  
      }

      function deletalldata(){
        resetcookies();
        alert("Account deletion is coming soon. Please contact us if you need to delete your account during this beta period.");
      }
  
      //date picker presets tab box
      const tabsBox = document.querySelector(".tabs-box"),
          allTabs = tabsBox.querySelectorAll(".tab"),
          arrowIcons = document.querySelectorAll(".icon i");
      let isDragging = false;
      const handleIcons = (scrollVal) => {
          let maxScrollableWidth = tabsBox.scrollWidth - tabsBox.clientWidth;
  // Fade out left arrow when at start, fade in when not
  if (scrollVal <= 0) {
      arrowIcons[0].parentElement.style.opacity = "0";
      setTimeout(() => {
          arrowIcons[0].parentElement.style.display = "none";
      }, 200);
  } else {
      arrowIcons[0].parentElement.style.display = "flex";
      setTimeout(() => {
          arrowIcons[0].parentElement.style.opacity = "1";
      }, 200);
  }
  
  // Fade out right arrow when at end, fade in when not 
  if (maxScrollableWidth - scrollVal <= 1) {
      arrowIcons[1].parentElement.style.opacity = "0";
      setTimeout(() => {
          arrowIcons[1].parentElement.style.display = "none";
      }, 200);
  } else {
      arrowIcons[1].parentElement.style.display = "flex";
      setTimeout(() => {
          arrowIcons[1].parentElement.style.opacity = "1"; 
      }, 200);
  }
  
          if (scrollVal <= 0) {
              // At the start, remove left fade
              tabsBox.style.maskImage = "linear-gradient(to right, black 0%, black 85%, rgba(0, 0, 0, 0))";
              tabsBox.style.webkitMaskImage = "linear-gradient(to right, black 0%, black 85%, rgba(0, 0, 0, 0))";
          } else if (scrollVal >= maxScrollableWidth) {
              // At the end, remove right fade
              tabsBox.style.maskImage = "linear-gradient(to right, rgba(0, 0, 0, 0), black 15%, black 100%)";
              tabsBox.style.webkitMaskImage = "linear-gradient(to right, rgba(0, 0, 0, 0), black 15%, black 100%)";
          } else {
              // In the middle, apply full fading effect
              tabsBox.style.maskImage = "linear-gradient(to right, rgba(0, 0, 0, 0), black 15%, black 85%, rgba(0, 0, 0, 0))";
              tabsBox.style.webkitMaskImage = "linear-gradient(to right, rgba(0, 0, 0, 0), black 15%, black 85%, rgba(0, 0, 0, 0))";
          }
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
          document.querySelector(".datepicker").value = '2026-05-21T11:30';
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

      function MLK() { //Martin Luther King Jr. Day
        var mlkthisyear = new Date(formatDate(getDateString(thisyear, 0, 2, 1))); //0th month (Jan), 2nd week, 1st day (Monday)
        if (mlkthisyear - now < 0) {
            document.querySelector(".datepicker").value = formatDate(getDateString(nextyear, 0, 2, 1));
            } else {
            document.querySelector(".datepicker").value = formatDate(getDateString(thisyear, 0, 2, 1));
        }
        SetCountDowngeneral();
    }
    
    function GROUNDHOG() { //Groundhog Day
        var groundhogthisyear = new Date(thisyear + "-02-02T00:00");
        if (groundhogthisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-02-02T00:00';
        } else {
            document.querySelector(".datepicker").value = thisyear + '-02-02T00:00';
        }
        SetCountDowngeneral();
    }
    
    function SDP() { //St. Patrick's Day
        var stpatricksthisyear = new Date(thisyear + "-03-17T00:00");
        if (stpatricksthisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-03-17T00:00';
            } else {
            document.querySelector(".datepicker").value = thisyear + '-03-17T00:00';
        }
        SetCountDowngeneral();
    }
    
    function CINCO() { //Cinco de Mayo
        var cincothisyear = new Date(thisyear + "-05-05T00:00");
        if (cincothisyear - now < 0) {
            document.querySelector(".datepicker").value = nextyear + '-05-05T00:00';
              } else {
            document.querySelector(".datepicker").value = thisyear + '-05-05T00:00';
        }
          SetCountDowngeneral();
    }
  
          function autopilottab(){
              showToast('Timekeeper found the next holiday!', 'success');
              const { nextHoliday, matchingHoliday } = getHolidayData();

              const year = nextHoliday.date.getFullYear();
              const month = String(nextHoliday.date.getMonth() + 1).padStart(2, '0');
              const day = String(nextHoliday.date.getDate()).padStart(2, '0');
              const hours = String(nextHoliday.date.getHours()).padStart(2, '0');
              const minutes = String(nextHoliday.date.getMinutes()).padStart(2, '0');
              document.querySelector(".datepicker").value = `${year}-${month}-${day}T${hours}:${minutes}`;
              SetCountDowngeneral();
          }
  
  
  
      //Link copy buttom
      function copyinputtextlink() {
          let linkinputfield = document.getElementById("linkinput"); //Get the value of the link input box
          navigator.clipboard.writeText(linkinputfield.value); //Save that value to clipboard
      }

      //Info pane link copy button
      function copyinputtextlinkInfo() {
          let linkinputfield = document.getElementById("linkinput-info"); //Get the value of the info pane link input box
          navigator.clipboard.writeText(linkinputfield.value); //Save that value to clipboard
      }

      //Local Shortcut copy buttom
      function copyinputtextlocalshortcutlink() {
          let locallinkinputfield = document.getElementById("locallinkinput"); //Get the value of the link input box
          navigator.clipboard.writeText(locallinkinputfield.value); //Save that value to clipboard
      }
  
      document.querySelector(".tabs-box").style.maskImage = "linear-gradient(to right, black 0%, black 85%, rgba(0, 0, 0, 0))";
      document.querySelector(".tabs-box").style.webkitMaskImage = "linear-gradient(to right, black 0%, black 85%, rgba(0, 0, 0, 0))";
      //Scrolling controls tabs box too
      const container = document.getElementById("tabs-box");
      container.addEventListener("wheel", function (e) {
  
          if (e.deltaY > 0) {
              container.scrollLeft += 200;
              handleIcons(container.scrollLeft);
              e.preventDefault();
          }
          else {
              container.scrollLeft -= 200;
              handleIcons(container.scrollLeft);
              e.preventDefault();
          }
      });
  
  
      //Function to enable color when a background is disabled
      function enablecolor() {
          const colorPickers = document.querySelectorAll('input[type="color"]');
          colorPickers.forEach(picker => {
              picker.classList.add("colorpicker");
              picker.classList.remove("disabledcolorpicker");
          });
      }
  
      //Function to disable color when a background is enabled
      function disablecolor() {
          const colorPickers = document.querySelectorAll('input[type="color"]');
          colorPickers.forEach(picker => {
              picker.classList.remove("colorpicker");
              picker.classList.add("disabledcolorpicker");
          });
      }
  
      function setbg(bgint, method) {
        // Clear any pending timeouts to prevent race conditions
        if (window.bgTimeoutId) {
            clearTimeout(window.bgTimeoutId);
            window.bgTimeoutId = null;
        }

        if ((method != "auto") && (getParameterFromSource("atc") == bgint)) {
            //the selected background is already the set background - turn off background
            enablecolor();
            showToast("Disabling the background enables foreground colors", 'info');
            
            // First set opacity to 0 to trigger the transition
            document.getElementById("animatedbackground").style.opacity = "0";
            
            // Store the current state to avoid race conditions
            bggotdisabled = "true";
            bgstring = "none";
            
            // Wait for the transition to complete before hiding the element
            window.bgTimeoutId = setTimeout(() => {
                // Only hide if background is still supposed to be off
                if (bggotdisabled === "true") {
                    document.getElementById("animatedbackground").style.display = "none";
                }
            }, 1000); // Match this to your transition duration
        }
        else if ((getParameterFromSource("atc") == "none") && bgint != "none") {
            //param is none, but the selected background is not - turn on and set background
            disablecolor();
            showToast('Enabling a background disables the foreground colors', 'info');
            
            // Make sure the element is visible but with opacity 0
            document.getElementById("animatedbackground").style.display = "";
            document.getElementById("animatedbackground").classList.remove("hidden");
            document.getElementById("animatedbackground").style.zIndex = "-3";
            document.getElementById("animatedbackground").style.position = "fixed";
            document.getElementById("animatedbackground").style.opacity = "0"; // Start with opacity 0
            
            // Set the background images
            document.getElementById("bg1").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            document.getElementById("bg2").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            
            // Force a reflow to ensure the browser registers the display change before opacity
            void document.getElementById("animatedbackground").offsetWidth;
            
            // Now set opacity to 1 to trigger the transition
            document.getElementById("animatedbackground").style.opacity = "1";
            
            bgstring = bgint;
            bggotdisabled = "false";
        }
        else if ((getParameterFromSource("atc") != "none") && (document.getElementById("bg1").src != "Backgrounds/enhancedbackground_" + bgint + ".png")) {
            //parameter is not none, but the selected and set backgrounds are different - change the bg w/o turning on or off
            document.getElementById("bg1").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            document.getElementById("bg2").src = "Backgrounds/enhancedbackground_" + bgint + ".png";
            bgstring = bgint;
            bggotdisabled = "false";
        }
        else {
            //catchall for errors too but primarily for and should only be pinged when not using atc
            enablecolor();
            
            // First set opacity to 0 to trigger the transition
            document.getElementById("animatedbackground").style.opacity = "0";
            
            // Store the current state
            bgstring = "none";
            bggotdisabled = "true";
            
            // Wait for the transition to complete before hiding
            window.bgTimeoutId = setTimeout(() => {
                if (bggotdisabled === "true") {
                    document.getElementById("animatedbackground").style.display = "none";
                }
            }, 1000);
        }

        // For loop that adds selected and normal bgbutton classes
  
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
  
          if(method == "manual"){
              SetCountDowngeneral();
          }
          updateSaveButtonText();
  
          //countdown schedule styling
          if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("atc") == "none"){
              document.getElementById("schedule-currentClass").classList.add("schedulebgcolored");
          }
          else{
              document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
                    }
      }
  
  
      function makeQR() {
          const qrcodeElement = document.getElementById("qrcode");
          const qrcodeInfoElement = document.getElementById("qrcode-info");
          
          // Clear any existing content
          while (qrcodeElement.firstChild) {
              qrcodeElement.removeChild(qrcodeElement.firstChild);
          }
          
          // Clear any existing content in info pane QR code
          if (qrcodeInfoElement) {
              while (qrcodeInfoElement.firstChild) {
                  qrcodeInfoElement.removeChild(qrcodeInfoElement.firstChild);
              }
          }
  
          function imgQR(qrCanvas, centerImage, factor) {
              var h = qrCanvas.height;
              var cs = h * factor;
              var co = (h - cs) / 2;
              var ctx = qrCanvas.getContext("2d");
              ctx.drawImage(centerImage, 0, 0, centerImage.width, centerImage.height, co, co, cs, cs);
          }
  
          // Create QR code only after clearing
          const icon = new Image();
          icon.onload = function generateQR() {
              if (qrcodeElement.children.length === 0) {
                  new QRCode(qrcodeElement, {
                      text: document.getElementById("linkinput").value,
                      width: 150,
                      height: 150,
                      colorDark: "#000000",
                      colorLight: "#ffffff",
                      correctLevel: QRCode.CorrectLevel.H
                  });
                  
                  const canvas = qrcodeElement.querySelector('canvas');
                  if (canvas) {
                      imgQR(canvas, icon, 0.3);
                  }
              }
              
              // Generate QR code for info pane if it exists
              if (qrcodeInfoElement && qrcodeInfoElement.children.length === 0) {
                  new QRCode(qrcodeInfoElement, {
                      text: document.getElementById("linkinput-info").value,
                      width: 150,
                      height: 150,
                      colorDark: "#000000",
                      colorLight: "#ffffff",
                      correctLevel: QRCode.CorrectLevel.H
                  });
                  
                  const canvasInfo = qrcodeInfoElement.querySelector('canvas');
                  if (canvasInfo) {
                      imgQR(canvasInfo, icon, 0.3);
                  }
              }
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
        if(autocircle && autocircle.getBBox().width !== 0){
            const length = autocircle.getTotalLength();
        }
          if(autocircle){
              const offset = length - (length * (10000 + autocountdown) / 10000);
              autocircle.style.strokeDashoffset = offset;
              if (autocountdown < 1) {
                  if(document.getElementById("autopilotpopup") || document.getElementById("autopilotpopupmobile")){
                  document.getElementById("autopilotpopup").style.opacity = "0";
                  document.getElementById("autopilotpopupmobile").style.opacity = "0";
                  }
  
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
          document.getElementById("michroma").classList.remove("selectedfontpicker");
          document.getElementById("michroma").classList.add("fontpicker");
  
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
          document.getElementById("michroma").classList.remove("selectedfontpicker");
          document.getElementById("michroma").classList.add("fontpicker");
  
          document.getElementById("schedule-classTitle").style.textTransform = "initial";
  
          if (method == "Manual") {
              SetCountDowngeneral();
          }
      }
  
      //set DM Serif font, previously Yeseva
      function FontDMSerif(method) {
          document.querySelector(':root').style.setProperty('--typeface', 'DM Serif Display');
          document.querySelector(':root').style.setProperty('--comptypeface', 'DM Serif Display');
  
          document.getElementById("fredoka").classList.remove("selectedfontpicker");
          document.getElementById("fredoka").classList.add("fontpicker");
          document.getElementById("poppins").classList.remove("selectedfontpicker");
          document.getElementById("poppins").classList.add("fontpicker");
          document.getElementById("dmserif").classList.add("selectedfontpicker");
          document.getElementById("michroma").classList.remove("selectedfontpicker");
          document.getElementById("michroma").classList.add("fontpicker");
  
          document.getElementById("schedule-classTitle").style.textTransform = "initial";
  
          if (method == "Manual") {
              SetCountDowngeneral();
          }
      }
  
      //set michroma font
      function FontMichroma(method) {
          document.querySelector(':root').style.setProperty('--typeface', 'Michroma');
          document.querySelector(':root').style.setProperty('--comptypeface', 'Michroma');
  
          document.getElementById("fredoka").classList.remove("selectedfontpicker");
          document.getElementById("fredoka").classList.add("fontpicker");
          document.getElementById("poppins").classList.remove("selectedfontpicker");
          document.getElementById("poppins").classList.add("fontpicker");
          document.getElementById("dmserif").classList.remove("selectedfontpicker");
          document.getElementById("dmserif").classList.add("fontpicker");
          document.getElementById("michroma").classList.add("selectedfontpicker");

          document.getElementById("schedule-classTitle").style.textTransform = "initial";
    
          if (method == "Manual") {
              SetCountDowngeneral();
          }
      }

      function ProgressPositionBar(method){
        progressbarposition = "bar";
        document.getElementById("progressnone").classList.remove("selectedfontpicker");
        document.getElementById("progressnone").classList.add("fontpicker");
        document.getElementById("progressbottombar").classList.remove("fontpicker");
        document.getElementById("progressbottombar").classList.add("selectedfontpicker");
        document.getElementById("progressfullscreen").classList.remove("selectedfontpicker");
        document.getElementById("progressfullscreen").classList.add("fontpicker");
        if (method == "Manual") {
            SetCountDowngeneral();
        }
      }
      function ProgressPositionFullscreen(method){
        progressbarposition = "fs";
        document.getElementById("progressnone").classList.remove("selectedfontpicker");
        document.getElementById("progressnone").classList.add("fontpicker");
        document.getElementById("progressbottombar").classList.add("fontpicker");
        document.getElementById("progressbottombar").classList.remove("selectedfontpicker");
        document.getElementById("progressfullscreen").classList.add("selectedfontpicker");
        document.getElementById("progressfullscreen").classList.remove("fontpicker");
        if (method == "Manual") {
            SetCountDowngeneral();
        }
      }
      function ProgressPositionNone(method){
        progressbarposition = "null";
        document.getElementById("progressnone").classList.add("selectedfontpicker");
        document.getElementById("progressnone").classList.remove("fontpicker");
        document.getElementById("progressbottombar").classList.add("fontpicker");
        document.getElementById("progressbottombar").classList.remove("selectedfontpicker");
        document.getElementById("progressfullscreen").classList.remove("selectedfontpicker");
        document.getElementById("progressfullscreen").classList.add("fontpicker");
        if (method == "Manual") {
            SetCountDowngeneral();
        }
      }
  
  if (!window.matchMedia("(max-width: 767px)").matches) {
      document.getElementById("body").addEventListener("mousemove", function (event) {
        if(document.getElementById("countdowntitle")){
          // Get element dimensions
          const rect = document.getElementById("countdowntitle").getBoundingClientRect();
        
          const recttoolbar = document.getElementById("toolbar-notch").getBoundingClientRect();
  
          // Calculate distance from mouse to center of element
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceX = Math.abs(event.clientX - centerX);
          const distanceY = Math.abs(event.clientY - centerY);
          const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
  
          // Calculate distance from mouse to center of element
          const toolbarcenterX = recttoolbar.left + recttoolbar.width / 2;
          const toolbarcenterY = recttoolbar.top + recttoolbar.height / 2;
          const toolbardistanceX = Math.abs(event.clientX - toolbarcenterX);
          const toolbardistanceY = Math.abs(event.clientY - toolbarcenterY);
          const toolbardistance = Math.sqrt(toolbardistanceX ** 2 + toolbardistanceY ** 2);
  
          // Normalize distance to 0-1 based on threshold (300px)
          const opacity = Math.max(0, 1 - distance / 300) / 3;
  
          // Set element opacity
          if (((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) || getParameterFromSource("atc") !== "none") {
            document.getElementById("countdowntitle").style.border = `1px solid rgba(255, 255, 255, ${opacity})`;
        document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
        document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(255,255,255,1)');
    }
    else{
            document.getElementById("countdowntitle").style.border = `1px solid rgba(0, 0, 0, ${opacity})`;
        document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
        document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(0,0,0,1)');
    } 
    }
      });
    }
  
      const superchargeyourschedulecard = document.getElementById("presetupScheduleContent");
  
      superchargeyourschedulecard.addEventListener("mousemove", (e) => {
          const { left, top, width, height } = superchargeyourschedulecard.getBoundingClientRect();
          const x = (e.clientX - left) / width - 0.5; // Range: -0.5 to 0.5
          const y = (e.clientY - top) / height - 0.5; // Range: -0.5 to 0.5
      
          const rotateX = y * -15; // Invert Y-axis for natural feel
          const rotateY = x * 15;
      
          superchargeyourschedulecard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
      });
      
      superchargeyourschedulecard.addEventListener("mouseleave", () => {
          superchargeyourschedulecard.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale(1)";
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
  
          updateSaveButtonText(); // Update save button text when title changes
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
  
      //create a new color picker
  function addColorPicker(method) {
      if (colorPickerCount < 8) {
          colorPickerCount++;
          const container = document.getElementById('colorPickersContainer');
          const newColorPickerContainer = document.createElement('div');
          newColorPickerContainer.className = 'colorpicker-container';
          newColorPickerContainer.draggable = true;
          
          // Add drag event listeners
          newColorPickerContainer.addEventListener('dragstart', handleDragStart);
          newColorPickerContainer.addEventListener('dragend', handleDragEnd);
          newColorPickerContainer.addEventListener('dragover', handleDragOver);
          newColorPickerContainer.addEventListener('drop', handleDrop);
  
          const newColorPicker = document.createElement('input');
          newColorPicker.className = 'colorpicker';
          if(getParameterFromSource("atc")){
            newColorPicker.classList.add("disabledcolorpicker");
          }
          newColorPicker.id = `color${colorPickerCount}`;
          newColorPicker.type = 'color';
          newColorPicker.value = getRandomColor();
          newColorPicker.onblur = SetCountDowngeneral;
  
          const removeButton = document.createElement('div');
          removeButton.className = 'remove-button';
          removeButton.innerHTML = '-';
          removeButton.title = "Remove this color";
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

          if(colorpickersocontainer.children.length > 8){
            document.querySelector(".clraddfg").classList.add("clraddoff");
        }
        else{
            document.querySelector(".clraddfg").classList.remove("clraddoff");
        }

  
          adjustHeightOfColorPickerContainer();
          updateColorAnimations();
  
          if(method !== "auto"){
              SetCountDowngeneral();
              newColorPicker.focus();
              newColorPicker.click();
          }
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

          if(colorpickersocontainer.children.length > 8){
            document.querySelector(".clraddfg").classList.add("clraddoff");
        }
        else{
            document.querySelector(".clraddfg").classList.remove("clraddoff");
        }
      
      adjustHeightOfColorPickerContainer();
      SetCountDowngeneral();
      updateColorAnimations();
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
  
           SetCountDowngeneral();
  
      document.getElementById("clock").style.display = "none"; //hide clock
          document.getElementById("countdowntitle").style.display = "none"; //hide title
      document.getElementById("optionsdatecontainer").style.display = "none"; //hide end date area of options
      document.getElementById("optionsendingcontainer").style.display = "none"; //hide ending options area of options	
      document.getElementById("optionsendinganchor").style.opacity = "0.3"; //grey out ending options anchor 	
      //document.getElementById("optionsprogresscontainer").style.display = "none"; //hide ending options area of options
      //document.getElementById("optionsprogressanchor").style.opacity = "0.3"; //grey out progress options anchor	
      document.getElementById("cdscheduledisclaimer").style.display = ""; //show personal options schedule disclaimer
  
      document.querySelector(".schedule-editor").style.display = ""; //show the schedule editor
      document.getElementById("presetupScheduleContent").style.display = "none"; //hide the info preconversion popup
      document.title = "Countdown Schedule";
      showToast('Schedule created successfully!', 'success');

      document.getElementById("schedule-eventTitle").scrollIntoView();

      if(getParameterFromSource("atc") == "none"){
        document.getElementById("schedule-currentClass").classList.add("schedulebgcolored");
    }
    else{
        document.getElementById("schedule-currentClass").classList.remove("schedulebgcolored");
    }

    ProgressPositionBar('manual');
      }

      function schedule_resettimeinputs(){
        document.querySelectorAll('.scheduletimeinput').forEach(input => {
            const now = new Date();
            now.setHours(12, 30, 0, 0); // Set time to 12:30 PM
        
            if (input.type === 'datetime-local') {
              input.value = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
            } else if (input.type === 'date') {
              input.value = now.toISOString().slice(0, 10); // YYYY-MM-DD
            } else if (input.type === 'time') {
              input.value = now.toTimeString().slice(0, 5); // HH:MM
            }
          });
        }
  
          function schedule_resetAll(){
              history.replaceState(null, '', `?schedule=null`);
              schedule_loadScheduleFromURL();
          }
  
          function schedule_loadScheduleFromURL() {
              const encodedSchedule = getParameterFromSource('schedule');
              if (encodedSchedule && encodedSchedule !== "null") {
                  const decoded = schedule_decodeSchedule(encodedSchedule);
                  schedule_events = decoded.schedule_events;
                  schedule_exceptions = decoded.schedule_exceptions;
                  schedule_updateEventList();
                  schedule_updateExceptionList();
              }
          }

          function importICSFile() {
            try {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.ics';
                
                // Add event listener before appending to DOM
                fileInput.addEventListener('change', function(e) {
                    try {
                        const file = e.target.files[0];
                        if (!file) {
                            showToast('No file selected', 'error');
                            return;
                        }
                        
                        showToast('Reading file...', 'info');
                        
                        const reader = new FileReader();
                        
                        reader.onload = function(event) {
                            try {
                                const icsContent = event.target.result;
                                processICSContent(icsContent);
                            } catch (error) {
                                console.error('Error processing file content:', error);
                                showToast('Error processing file: ' + error.message, 'error');
                            }
                        };
                        
                        reader.onerror = function(event) {
                            console.error('Error reading file:', event);
                            showToast('Error reading file', 'error');
                        };
                        
                        reader.readAsText(file);
                    } catch (error) {
                        console.error('Error handling selected file:', error);
                        showToast('Error handling file: ' + error.message, 'error');
                    }
                });
                
                // Append to DOM temporarily to ensure event handling works
                document.body.appendChild(fileInput);
                fileInput.click();
                
                // Remove after click to keep DOM clean
                setTimeout(() => {
                    document.body.removeChild(fileInput);
                }, 1000);
                
            } catch (error) {
                console.error('Error in importICSFile:', error);
                showToast('Error creating file input: ' + error.message, 'error');
            }
        }
        
        function processICSContent(icsContent) {
            console.log('Processing ICS content...');
            console.log('Clearing existing schedule...');
            schedule_events = [];
            schedule_exceptions = {
                0: [], // Sunday
                1: [], // Monday
                2: [], // Tuesday
                3: [], // Wednesday
                4: [], // Thursday
                5: [], // Friday
                6: []  // Saturday
            };
            
            console.log('Parsing ICS events...');
            const events = parseICSEvents(icsContent);
            console.log(`Found ${events.length} events to process for scheduling`);
            
            const dailyEvents = [];
            const weeklyEvents = {};
            let processedEventCount = 0;
            
            console.log('Processing events for schedule...');
            events.forEach((event, index) => {
                console.log(`Processing event ${index + 1}/${events.length}: "${event.summary}"`);
                
                if (!event.rrule) {
                    console.log(`Event "${event.summary}" has no recurrence rule, skipping`);
                    return;
                }
                
                if (event.rrule.freq === 'DAILY') {
                    console.log(`Adding daily event: "${event.summary}"`);
                    dailyEvents.push({
                        title: event.summary,
                        startTime: formatICSTime(event.dtstart),
                        endTime: formatICSTime(event.dtend)
                    });
                    processedEventCount++;
                }
                else if (event.rrule.freq === 'WEEKLY') {
                    console.log(`Processing weekly event: "${event.summary}"`);
                    const days = event.rrule.byday || [];
                    
                    if (days.length === 0) {
                        console.log(`Weekly event "${event.summary}" has no specific days, skipping`);
                        return;
                    }
                    
                    const dayMap = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
                    
                    days.forEach(day => {
                        const dayIndex = dayMap[day];
                        if (dayIndex !== undefined) {
                            console.log(`Adding "${event.summary}" to ${day} schedule`);
                            if (!weeklyEvents[dayIndex]) {
                                weeklyEvents[dayIndex] = [];
                            }
                            
                            weeklyEvents[dayIndex].push({
                                title: event.summary,
                                startTime: formatICSTime(event.dtstart),
                                endTime: formatICSTime(event.dtend)
                            });
                            processedEventCount++;
                        }
                    });
                }
            });
            
            console.log(`Found ${dailyEvents.length} daily events to add to regular schedule`);
            schedule_events = [...dailyEvents];
            
            console.log('Processing exception days...');
            let exceptionDaysCount = 0;
            
            // Reset schedule_exceptions to not have empty arrays - we'll only add days that have events
            schedule_exceptions = {};
            
            // Only create exception days for days that have weekly events
            Object.keys(weeklyEvents).forEach(dayIndex => {
                if (weeklyEvents[dayIndex].length > 0) {
                    exceptionDaysCount++;
                    console.log(`Creating exception day ${dayIndex} with ${weeklyEvents[dayIndex].length} weekly events`);
                    schedule_exceptions[dayIndex] = [
                        ...dailyEvents,
                        ...weeklyEvents[dayIndex]
                    ];
                    
                    console.log(`Sorting exception day ${dayIndex}`);
                    schedule_exceptions[dayIndex].sort((a, b) => a.startTime.localeCompare(b.startTime));
                }
            });
            
            console.log('Sorting regular schedule...');
            schedule_events.sort((a, b) => a.startTime.localeCompare(b.startTime));
            
            console.log('Updating UI...');
            schedule_updateEventList();
            schedule_updateExceptionList();
            schedule_updateURL();
            schedule_updateScheduleViewer();
            
            console.log('Import complete');
            if (processedEventCount > 0) {
                showToast(
                    `Successfully imported ${dailyEvents.length} daily events and created ${exceptionDaysCount} exception days!`, 
                    'success'
                );
            } else {
                showToast('No compatible recurring events found in calendar', 'info');
            }
        }
        
        function parseICSEvents(icsContent) {
            console.log('Starting ICS parsing...');
            const events = [];
            let currentEvent = null;
            
            try {
                // Check if the file contains iCalendar data
                if (!icsContent.includes('BEGIN:VCALENDAR')) {
                    console.error('Invalid ICS file: No VCALENDAR found');
                    showToast('Invalid ICS file format', 'error');
                    return [];
                }
                
                const lines = icsContent.split(/\r\n|\n|\r/);
                console.log(`Found ${lines.length} lines to parse`);
                
                const processedLines = [];
                
                // Handle line folding first (lines that start with space or tab are part of the previous line)
                for (let i = 0; i < lines.length; i++) {
                    if (i > 0 && (lines[i].startsWith(' ') || lines[i].startsWith('\t'))) {
                        processedLines[processedLines.length - 1] += lines[i].substring(1);
                    } else {
                        processedLines.push(lines[i]);
                    }
                }
                
                for (let i = 0; i < processedLines.length; i++) {
                    const line = processedLines[i];
                    
                    if (line === 'BEGIN:VEVENT') {
                        console.log('Starting new event...');
                        currentEvent = {
                            summary: 'Untitled Event', // Default title
                            dtstart: '',
                            dtend: '',
                            isRecurring: false,
                            status: 'CONFIRMED' // Default status
                        };
                    }
                    else if (line === 'END:VEVENT') {
                        if (currentEvent) {
                            // Check if the event has required properties
                            if (currentEvent.summary && currentEvent.dtstart) {
                                // Skip CANCELLED events
                                if (currentEvent.status === 'CANCELLED') {
                                    console.log('Skipping CANCELLED event:', currentEvent.summary);
                                }
                                // Only include recurring events with valid RRULE
                                else if (currentEvent.isRecurring && currentEvent.rrule) {
                                    // If no end time is specified, use start time + 1 hour
                                    if (!currentEvent.dtend && currentEvent.dtstart) {
                                        currentEvent.dtend = currentEvent.dtstart;
                                    }
                                    
                                    console.log(`Checking if event "${currentEvent.summary}" is active...`);
                                    const isActive = isEventStillActive(currentEvent);
                                    
                                    
                                    if (isActive) {
                                        console.log('Adding active recurring event:', currentEvent);
                                        events.push(currentEvent);
                                    } else {
                                        console.log('Skipping inactive event:', currentEvent.summary);
                                    }
                                } else {
                                    console.log('Skipping non-recurring event or event with invalid RRULE');
                                }
                            } else {
                                console.log('Skipping incomplete event:', currentEvent);
                            }
                        }
                        currentEvent = null;
                    }
                    else if (currentEvent) {
                        const colonIndex = line.indexOf(':');
                        if (colonIndex > 0) {
                            const name = line.substring(0, colonIndex);
                            const value = line.substring(colonIndex + 1);
                            
                            const semicolonIndex = name.indexOf(';');
                            const propertyName = semicolonIndex > 0 ? name.substring(0, semicolonIndex) : name;
                            
                            console.log(`Processing property: ${propertyName} = ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
                            
                            switch (propertyName) {
                                case 'SUMMARY':
                                    currentEvent.summary = value || 'Untitled Event';
                break;
                                case 'DTSTART':
                                    currentEvent.dtstart = value;
                break;
                                case 'DTEND':
                                    currentEvent.dtend = value;
                                    break;
                                case 'RRULE':
                                    currentEvent.isRecurring = true;
                                    currentEvent.rrule = parseRRule(value);
                                    break;
                                case 'STATUS':
                                    currentEvent.status = value;
                                    break;
                                case 'EXDATE':
                                    if (!currentEvent.exdates) {
                                        currentEvent.exdates = [];
                                    }
                                    currentEvent.exdates.push(value);
                                    break;
                            }
                        }
                    }
                }
                                console.log(`Parsing complete, found ${events.length} active recurring events`);
                
                if (events.length === 0) {
                    showToast('No active recurring events found in calendar', 'info');
                }
                
                return events;
            } catch (error) {
                console.error('Error parsing ICS file:', error);
                showToast('Error parsing calendar file: ' + error.message, 'error');
                return [];
            }
        }
        
        function isEventStillActive(event) {
            try {
                // Parse event start date
                let startDate;
                if (!event.dtstart) {
                    console.log('Event has no start date');
                    return false;
                }
                
                try {
                    startDate = parseICSDate(event.dtstart);
                    console.log(`Event start date: ${startDate.toISOString().split('T')[0]}`);
                } catch (e) {
                    console.error('Error parsing start date:', e);
                    return true; // If we can't parse the date, assume it's active
                }
                
                const now = new Date();
                
                // If the event has no recurrence rule but a start date in the past
                if (!event.rrule) {
                    console.log('Event has no recurrence rule');
                    return false;
                }
                
                // If the event is recurring but has UNTIL date in the past
                if (event.rrule.until) {
                    try {
                        const untilDate = parseICSDate(event.rrule.until);
                        console.log(`Event has UNTIL date: ${untilDate.toISOString().split('T')[0]}`);
                        
                        if (untilDate < now) {
                            console.log('Event UNTIL date is in the past, marking as inactive');
                            return false;
                        }
                    } catch (e) {
                        console.error('Error parsing UNTIL date:', e);
                        // Continue processing if date parsing fails
                    }
                }
                
                // Special handling for DAILY events - always consider them active if they have no UNTIL date
                // or if the UNTIL date is in the future
                if (event.rrule.freq === 'DAILY') {
                    console.log('Event is DAILY, considering active');
                    return true;
                }
                
                // If event start date is too far in the past (more than 5 years)
                // and there's no UNTIL date, it's probably obsolete
                // Only apply this rule to weekly events, not daily ones
                if (event.rrule.freq === 'WEEKLY') {
                    const fiveYearsAgo = new Date();
                    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
                    
                    if (startDate < fiveYearsAgo && !event.rrule.until) {
                        console.log('Weekly event start date more than 5 years old with no end date, assuming inactive');
                        return false;
                    }
                }
                
                console.log('Event passes all activity checks, marking as active');
                return true;
            } catch (error) {
                console.error('Error checking if event is active:', error);
                return true; // Default to including the event if there's an error
            }
        }
        
        function parseICSDate(dateStr) {
            if (!dateStr) return null;
            
            try {
                // Handle date with time (YYYYMMDDTHHMMSSZ format)
                if (dateStr.includes('T')) {
                    const datePart = dateStr.split('T')[0];
                    const year = parseInt(datePart.substring(0, 4), 10);
                    const month = parseInt(datePart.substring(4, 6), 10) - 1; // JS months are 0-indexed
                    const day = parseInt(datePart.substring(6, 8), 10);
                    return new Date(year, month, day);
                } 
                // Handle date only (YYYYMMDD format)
                else if (dateStr.length >= 8) {
                    const year = parseInt(dateStr.substring(0, 4), 10);
                    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
                    const day = parseInt(dateStr.substring(6, 8), 10);
                    return new Date(year, month, day);
                }
                
                throw new Error('Unknown date format: ' + dateStr);
            } catch (error) {
                console.error('Error parsing ICS date:', error);
                throw error;
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
                              showToast('Event updated successfully', 'success');
                          } else {
                              showToast('Error updating event', 'error');
                          }
                      } else {
                          const index = schedule_events.indexOf(schedule_editingEvent);
                          if (index !== -1) {
                              schedule_events[index] = newEvent;
                              showToast('Event updated successfully', 'success');
                          } else {
                              showToast('Error updating event', 'error');
                          }
                      }
                      document.getElementById('addtoexceptionbutton').style.display = "";

                  } else {
                      // Add new event
                      if (schedule_editingExceptionDay !== null) {
                          if (!schedule_exceptions[schedule_editingExceptionDay]) {
                              schedule_exceptions[schedule_editingExceptionDay] = [];
                          }
                          schedule_exceptions[schedule_editingExceptionDay].push(newEvent);
                          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          showToast('Event successfully added to ' + dayNames[schedule_editingExceptionDay], 'success')
                      } else {
                          schedule_events.push(newEvent);
                          showToast('Event added to regular schedule', 'success');
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
              else{
                showToast('You must input a valid title, start time, and end time', 'error')
              }
              const collapsibles = document.querySelectorAll('.schedule-collapsible');
            collapsibles.forEach(collapsible => {
                if (collapsible.classList.contains('active')) {
                schedule_toggleCollapsible(collapsible);
                }
            });
          }
  
          function schedule_editEvent(event, isException = false, day = null) {
            if(!event && isException){
                setTimeout(function() {
                    schedule_addOrUpdateEvent();
                    document.getElementById("schedule-eventTitle").scrollIntoView();
                    const exceptiondaybuttonstochange = document.querySelectorAll('.addeventtoexceptionday');
                  exceptiondaybuttonstochange.forEach(element => {
                    element.classList.add('disabled');
                  });
                }, 100);
            }
              schedule_editingEvent = event;
              schedule_editingExceptionDay = isException ? day : null;
              document.getElementById('schedule-eventTitle').value = event.title;
              document.getElementById('schedule-startTime').value = event.startTime;
              document.getElementById('schedule-endTime').value = event.endTime;
              document.getElementById('schedule-addOrUpdateEventBtn').innerHTML = '<i class="fa-solid fa-check-circle"></i> Update Event';
              document.getElementById('addtoexceptionbutton').style.display = "none";
          document.getElementById("schedule-eventTitle").scrollIntoView();
          }

          function selectexceptiontoaddevent(){
            document.getElementById("exceptiondaycontainer").scrollIntoView();
                             const exceptiondaybuttonstochange = document.querySelectorAll('.addeventtoexceptionday');
                  exceptiondaybuttonstochange.forEach(element => {
                    element.classList.remove('disabled');
                  });
// Find all collapsible elements and trigger click to open them
const collapsibles = document.querySelectorAll('.schedule-collapsible');
collapsibles.forEach(collapsible => {
  if (!collapsible.classList.contains('active')) {
schedule_toggleCollapsible(collapsible);
  }
});

showToast('Pick an exception day to add this event to', 'info')
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
              document.getElementById("schedule-eventTitle").scrollIntoView();

          }
  
function schedule_addExceptionDay() {
    const selectedDay = document.querySelector('#exceptionDayMenu .dropdown-item.selected');
    if (!selectedDay) {
        showToast('Please select a day first', 'error');
        return;
    }
    const day = selectedDay.getAttribute('data-day');
    if (!schedule_exceptions[day]) {
        schedule_exceptions[day] = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        showToast(dayNames[day] + ' exception created', 'success');
            }
            else{
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      showToast('You already have an exception for ' + dayNames[day], 'error');
    }
    schedule_updateExceptionList();
    schedule_updateURL();
    schedule_updateScheduleViewer();
}

// Add event listeners for the exception day dropdown
document.addEventListener('data-ready', function() {
    const exceptionDayDropdown = document.getElementById('schedule-exceptionDay');
    if (exceptionDayDropdown) {
        const exceptionDayButton = exceptionDayDropdown.querySelector('.dropdown-button');
        const exceptionDayMenu = document.getElementById('exceptionDayMenu');
        const exceptionDayItems = exceptionDayMenu.querySelectorAll('.dropdown-item');
        
        exceptionDayButton.addEventListener('click', () => {
            if (!exceptionDayMenu.classList.contains('visible')) {
                exceptionDayMenu.classList.add('visible', 'animate-open');
                exceptionDayMenu.addEventListener('animationend', () => {
                    exceptionDayMenu.classList.remove('animate-open');
                    exceptionDayMenu.classList.add('opened');
                }, { once: true });
            } else {
                exceptionDayMenu.classList.remove('visible', 'opened');
            }
        });

        exceptionDayItems.forEach(item => {
            item.addEventListener('click', function() {
                // Remove selected class from all items
                exceptionDayItems.forEach(i => i.classList.remove('selected'));
                // Add selected class to clicked item
                this.classList.add('selected');
                // Update button text
                exceptionDayButton.innerHTML = this.innerHTML;
                // Close dropdown
                exceptionDayMenu.classList.remove('visible', 'opened');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!exceptionDayDropdown.contains(event.target)) {
                exceptionDayMenu.classList.remove('visible', 'opened');
            }
        });
    }


    const accountDropdown = document.getElementById('accountDropdown');
    if (accountDropdown) {
        const accountButton = document.getElementById('accountDropdownButton');
        const accountMenu = document.getElementById('accountMenu');
        const accountItems = accountMenu.querySelectorAll('.dropdown-item');
        
        accountButton.addEventListener('click', async () => {
            // Check if user is logged in
            if (typeof window.supabaseClient !== "undefined" && window.supabaseClient.auth) {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                
                if (!session) {
                    // User is not logged in, redirect to auth page
                    const authUrl = window.CountdownDataID ? `auth?id=${window.CountdownDataID}` : 'auth';
                    window.location.href = authUrl;
                    return;
                }
            } else {
                // Supabase client not available, redirect to auth page
                const authUrl = window.CountdownDataID ? `auth?id=${window.CountdownDataID}` : 'auth';
                window.location.href = authUrl;
                return;
            }
            
            // User is logged in, show dropdown menu
            
            if (!accountMenu.classList.contains('visible')) {
                accountMenu.classList.add('visible', 'animate-open');
                accountMenu.addEventListener('animationend', () => {
                    accountMenu.classList.remove('animate-open');
                    accountMenu.classList.add('opened');
                }, { once: true });
            } else {
                accountMenu.classList.remove('visible', 'opened');
            }
        });

        accountItems.forEach(item => {
            item.addEventListener('click', function() {
                // Remove selected class from all items
                accountItems.forEach(i => i.classList.remove('selected'));
                // Add selected class to clicked item
                this.classList.add('selected');
                // Close dropdown
                accountMenu.classList.remove('visible', 'opened');
            });
        });
    }

    const resetDropdown = document.getElementById('resetDropdown');
    if (resetDropdown) {
      const resetButton = resetDropdown.querySelector('.dropdown-button');
      const resetMenu = document.getElementById('resetMenu');
      const resetItems = resetMenu.querySelectorAll('.dropdown-item');
      
      resetButton.addEventListener('click', () => {
          if (!resetMenu.classList.contains('visible')) {
              resetMenu.classList.add('visible', 'animate-open');
              resetMenu.addEventListener('animationend', () => {
                  resetMenu.classList.remove('animate-open');
                  resetMenu.classList.add('opened');
              }, { once: true });
          } else {
              resetMenu.classList.remove('visible', 'opened');
          }
      });
    }
});
  
          function schedule_removeExceptionDay(day) {
              delete schedule_exceptions[day];
              schedule_updateExceptionList();
              schedule_updateURL();
              schedule_updateScheduleViewer();

              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                showToast(dayNames[day] + ' exception deleted', 'success');
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
                      <button class="schedule-collapsible" style="font-family: Dosis; font-size: 20px;" onclick="schedule_toggleCollapsible(this)">${dayName}</button>
                      <div class="schedule-content">
                      <h1>${dayName} Exception</h1>
                        <a class="addeventtoexceptionday disabled" onclick="schedule_editEvent(null, true, '${day}');"><i class="fa-solid fa-plus-circle"></i> Add Event to ${dayName}</a>
                        <a class="warning" onclick="schedule_removeExceptionDay('${day}')"><i class="fa-solid fa-trash"></i> Remove Exception Day</a>
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
              schedule_resettimeinputs();
              document.getElementById('schedule-addOrUpdateEventBtn').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add to Regular Schedule';
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
                      if (!getCookie("lcdu")) {
                          document.getElementById('schedule-timeRemaining').textContent = `${minutesUntilStart}:${secondsUntilStart.toString().padStart(2, '0')}`;
                      }else{
                          document.getElementById('schedule-timeRemaining').textContent = `${minutesUntilStart}m ${secondsUntilStart.toString().padStart(2, '0')}s`;
                      }
                      document.getElementById('schedule-remainingText').textContent = 'starting';
                      document.getElementById('schedule-progress').style.width = '0%';
                      document.getElementById('schedule-remainingText').classList.add("pulsing");
                    if(currentEvent.title){
                      document.title = currentEvent.title + " Starting Soon";
                    }else{
                      document.title = document.getElementById("countdowntitle").value + " Starting Soon";
                    }
                  } else {
                    document.getElementById('schedule-remainingText').classList.remove("pulsing");
                      const remainingTime = currentEvent.endTime - now;
                      const totalDuration = currentEvent.endTime - currentEvent.startTime;
                      const progress = 100 - (remainingTime / totalDuration * 100);
                      if(getParameterFromSource("progressposition") && getParameterFromSource("progressposition") !== 'null'){
                        if(getParameterFromSource('progressposition') == 'bar'){
                            document.getElementById("schedule-progress-bar").classList.add("schedule-progress-bar");
                            document.getElementById("schedule-progress-bar").classList.remove("schedule-progress-bar-fullscreen");
                        }else if(getParameterFromSource('progressposition') == 'fs'){
                            document.getElementById("schedule-progress-bar").classList.remove("schedule-progress-bar");
                            document.getElementById("schedule-progress-bar").classList.add("schedule-progress-bar-fullscreen");
                        }
                        document.getElementById('schedule-progress').style.width = `${progress}%`;
                      }else{
                        document.getElementById('schedule-progress').style.width = '0%';
                      }
  
                      const minutes = Math.floor(remainingTime / 60000);
                      const seconds = Math.floor((remainingTime % 60000) / 1000);
                      if (!getCookie("lcdu")) {
                          document.getElementById('schedule-timeRemaining').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      } else{
                          document.getElementById('schedule-timeRemaining').textContent = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
                      }
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
                  const formattedTimeUntilStart = minutesUntilStart >= 60 ? 
                    `${Math.floor(minutesUntilStart / 60)}:${String(minutesUntilStart % 60).padStart(2, '0')}` : 
                    `${minutesUntilStart} mins`;
                  const upcomingEl = document.createElement('div');
                  upcomingEl.className = 'schedule-upcoming-class';
                  upcomingEl.innerHTML = `
                      <div class="schedule-upcoming-class-title">${event.title}</div>
                      <div class="schedule-upcoming-class-time">
                          <div><i class="fa-regular fa-clock"></i> In ${formattedTimeUntilStart}</div>
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
                  document.getElementById('schedule-classTitle').innerHTML = '<i class="fa-solid fa-calendar-check"></i> Enjoy your time!<p style="font-family:Dosis; color:white;">There are no events on your schedule right now</p>';
                  document.getElementById('schedule-timeRemaining').textContent = '';
                  document.getElementById('schedule-remainingText').textContent = '';
                  document.getElementById('schedule-progress').style.width = '0%';
                  document.getElementById('schedule-upcomingClasses').innerHTML = '';
                  if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("schedule")){
                      startConfettiManagerAnimation();
                  }
                  return;
              }else{
                  stopConfettiManagerAnimation();
              }
  
              const firstEvent = tomorrowSchedule[0];
              const [startHours, startMinutes] = firstEvent.startTime.split(':');
              const startTime = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), startHours, startMinutes);
              const timeUntilStart = startTime - new Date();
              const hoursUntilStart = Math.floor(timeUntilStart / 3600000);
              const minutesUntilStart = Math.floor((timeUntilStart % 3600000) / 60000);
                      const secondsUntilStart = Math.floor((timeUntilStart % 60000) / 1000);
  
                if(document.getElementById("countdowntitle").value){
              document.getElementById('schedule-classTitle').textContent = `${document.getElementById("countdowntitle").value}`;
                }else{
                    document.getElementById('schedule-classTitle').textContent = 'Schedule';
                }

            document.getElementById('schedule-remainingText').classList.add("pulsing");

                document.title = document.getElementById("countdowntitle").value + " Starting Soon";
            
              if (!getCookie("lcdu")) {
                  document.getElementById('schedule-timeRemaining').textContent = `${hoursUntilStart}:${minutesUntilStart.toString().padStart(2, '0')}:${secondsUntilStart.toString().padStart(2, '0')}`;
              }else{
                  document.getElementById('schedule-timeRemaining').textContent = `${hoursUntilStart}h ${minutesUntilStart.toString().padStart(2, '0')}m ${secondsUntilStart.toString().padStart(2, '0')}s`;
              }
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
        console.log("Invalid YouTube URL");
      return;
    }
  
    const iframe = document.createElement('iframe');
    iframe.width = "1";
    iframe.height = "1";
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    iframe.allow = "autoplay; encrypted-media";
    iframe.style.opacity = "0";
    
    const container = document.getElementById('playerContainer');
    
    container.appendChild(iframe);
  }
  
  function extractYouTubeId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
    return match ? match[1] : null;
  }
  
  function playSoundCloud(link) {
      const iframe = document.createElement('iframe');
      iframe.width = "1";
      iframe.height = "1";
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&auto_play=true`;
      iframe.style.opacity = "0";
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
      const title = urlObj.searchParams.get('title');
  
      // Check if there's a title
      if (!title) {
          showToast('Please add a title before saving to Dashboard', 'error');
          return;
      }
  
      // Get the existing links from localStorage
      const savedLinks = localStorage.getItem("dashboardsaved");
      let links = savedLinks ? JSON.parse(savedLinks) : [];
  
      // Check if a countdown with the same title already exists
      const existingIndex = links.findIndex(link => {
          const linkUrl = new URL(link.url);
          const linkTitle = linkUrl.searchParams.get('title') || '';
          return linkTitle.toLowerCase() === title.toLowerCase();
      });
  
      // If this is a new countdown and we already have 8 saved
      //if (existingIndex === -1 && links.length >= 8) {
      //    showToast('Your Dashboard is full, remove a Countdown to save this', 'error');
      //    return;
      //}
  
      // If found, update the existing countdown, otherwise add a new one
      if (existingIndex !== -1) {
          links[existingIndex] = { url, title };
          console.log('[savetodash] Updated existing countdown:', title);
      } else {
          links.push({ url, title });
          console.log('[savetodash] Added new countdown:', title);
      }
  
      // Save the updated links back to localStorage
      localStorage.setItem('dashboardsaved', JSON.stringify(links));
      
      // Also save deleted items tracking to maintain sync state
      const deletedItemsList = JSON.parse(localStorage.getItem("dashboard_deleted_items") || "[]");
      localStorage.setItem('dashboard_deleted_items', JSON.stringify(deletedItemsList));
  
      // Trigger cloud sync if user is authenticated
      syncToCloud(links);
  
      updateSaveButtonText();
      showToast('Your Countdown was saved to Dashboard', 'success');
      SetCountDowngeneral();
  }

  async function syncToCloud(links) {
    try {
        // Check if user is authenticated
        const { data } = await window.supabaseClient.auth.getUser();
        if (!data?.user) {
            console.log('[savetodash] User not authenticated, skipping cloud sync');
            return;
        }
        
        console.log('[savetodash] Syncing to cloud for user:', data.user.id);
        
        // Save to cloud
        const { error } = await window.supabaseClient
            .from('user_dashboards')
            .upsert({
                user_id: data.user.id,
                dashboard_data: links,
                updated_at: new Date().toISOString()
            }, { onConflict: ['user_id'] });
            
        if (error) {
            console.error('[savetodash] Cloud sync failed:', error.message);
            showToast('Saved locally, but cloud sync failed', 'error');
        } else {
            console.log('[savetodash] Cloud sync successful');
        }
    } catch (error) {
        console.error('[savetodash] Error during cloud sync:', error);
        showToast('Saved locally, but cloud sync failed', 'error');
    }
}
  
  function magictitle(){
      if(getParameterFromSource("schedule") !== "null" && getParameterFromSource("schedule")){
          document.getElementById("countdowntitle").value = "Schedule";
          document.getElementById("magictitle").classList.add("magictitle-success");
          setTimeout(function() {
              document.getElementById("magictitle").classList.remove("magictitle-success");
          }, 500);
     setcountdowntitle("front"); 
      }
      else{
        const { nextHoliday, matchingHoliday } = getHolidayData();
        document.getElementById("countdowntitle").value = matchingHoliday.fullname;
        document.getElementById("magictitle").classList.add("magictitle-success");
        showToast('Timekeeper found a matching event!', 'success');
        setTimeout(function() {
            document.getElementById("magictitle").classList.remove("magictitle-success");
        }, 500);
      
    setcountdowntitle("front"); 
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
          if (event.key === 'Escape') {
            if(document.getElementById('personalSettingsOverlay').style.display = "none"){
              settings();
            }else{
                closePersonalSettings();
            }
            return;
          }
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault(); // Prevent the default save action
        savetodash();
        return;
    }
          input += event.key;
          if (input.endsWith('debug')) {
              document.getElementById('debugoptions').style.display = '';
              document.getElementById('onemintab').style.display = '';
              input = ''; // Reset the input
          }
      };
  })());
  
      function updateColorAnimations() {
          const styleTag = document.getElementById('animationHandler');
          if (!styleTag) {
              console.error('Animation handler style tag not found');
              return;
          }
          
          const colorPickers = document.querySelectorAll('.colorpicker');
          const colors = Array.from(colorPickers).map(picker => picker.value);
          
          if (colors.length === 0) {
              styleTag.textContent = ''; // Clear animations if no colors
              return;
          }
      
          // Calculate the percentage steps
          const step = 100 / colors.length;
          
          // Generate keyframes for text color animation
          let textKeyframes = '';
          let bgKeyframes = '';
          
          colors.forEach((color, index) => {
              const startPercent = index * step;
              const midPercent = startPercent + (step / 2);
              const endPercent = startPercent + step;
              
              // Add keyframes for this color
              textKeyframes += `
                  ${startPercent}% { color: ${color}; }
                  ${midPercent}% { color: ${color}; }
              `;
              
              bgKeyframes += `
                  ${startPercent}% { background-color: ${color}; }
                  ${midPercent}% { background-color: ${color}; }
              `;
              
              // Add transition to next color if not the last color
              if (index < colors.length - 1) {
                  textKeyframes += `${endPercent}% { color: ${colors[(index + 1) % colors.length]}; }\n`;
                  bgKeyframes += `${endPercent}% { background-color: ${colors[(index + 1) % colors.length]}; }\n`;
            } else {
                  // Complete the loop back to the first color
                  textKeyframes += `100% { color: ${colors[0]}; }\n`;
                  bgKeyframes += `100% { background-color: ${colors[0]}; }\n`;
              }
          });
      
          // Force browser to reflow by removing and re-adding the style element
          const newStyle = document.createElement('style');
          newStyle.id = 'animationhandler';
          newStyle.textContent = `
              @keyframes backgroundgradient {
                  ${textKeyframes}
              }
              @keyframes schedulebackgroundgradient {
                  ${bgKeyframes}
              }
          `;
          
          //styleTag.parentNode.replaceChild(newStyle, styleTag);
          styleTag.innerHTML = newStyle.textContent;
      }
  
      
  
      function showToast(message, type = 'info') {
          const toastContainer = document.getElementById('toast-container');
          
          // Create toast element
          const toast = document.createElement('div');
          toast.className = `toast ${type}`;
          
          // Create icon element
          const icon = document.createElement('img');
          icon.className = 'toast-icon';
      if(type == "error"){
          icon.src = "toasticons/error.png";
      }
      else if(type == "info"){
          icon.src = "toasticons/info.png";
      }
      else if(type == "success"){
          icon.src = "toasticons/success.png";
      }
      else if(type == "save"){
          icon.src = "toasticons/save.png";
      }
      else if(type == "persistent"){
        toast.id = "enableaudiotoast";
        icon.src = "toasticons/info.png";
    }
      else{
          icon.src = "toasticons/info.png";
      }
          
          // Create toast content
          const content = document.createElement('div');
          content.className = 'toast-content';
          content.textContent = message;
          
          // Create close button
          const closeButton = document.createElement('button');
          closeButton.className = 'toast-close';
          closeButton.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
          closeButton.onclick = () => removeToast(toast);
          
          // Assemble toast
          toast.appendChild(icon);
          toast.appendChild(content);
          toast.appendChild(closeButton);
          toastContainer.appendChild(toast);
  
          // Use setTimeout to ensure the banner is fully rendered
                    setTimeout(() => {
              const toastHeight = toast.offsetHeight;
              icon.style.height = `${toastHeight}px`;
          }, 1); // Adjust the timeout duration if necessary
          setTimeout(() => {
              const toastHeight = toast.offsetHeight;
              icon.style.height = `${toastHeight}px`;
          }, 3); // Adjust the timeout duration if necessary
          setTimeout(() => {
              const toastHeight = toast.offsetHeight;
              icon.style.height = `${toastHeight}px`;
          }, 5); // Adjust the timeout duration if necessary
          setTimeout(() => {
              const toastHeight = toast.offsetHeight;
              icon.style.height = `${toastHeight}px`;
          }, 10); // Adjust the timeout duration if necessary
          setTimeout(() => {
              const toastHeight = toast.offsetHeight;
              icon.style.height = `${toastHeight}px`;
          }, 20); // Adjust the timeout duration if necessary
          setTimeout(() => {
              const toastHeight = toast.offsetHeight;
              icon.style.height = `${toastHeight}px`;
          }, 50); // Adjust the timeout duration if necessary
          setTimeout(() => {
              const toastHeight = toast.offsetHeight;
              icon.style.height = `${toastHeight}px`;
          }, 100); // Adjust the timeout duration if necessary
          
          if(type !== 'persistent'){
          // Auto remove after 5 seconds
          setTimeout(() => removeToast(toast), 5000);
          }
      }
  
      function removeToast(toast) {
          toast.style.animation = 'toastslideOut 0.3s ease forwards';
              setTimeout(() => {
            toast.remove();
          }, 300);
        }

        function resetprogressinput(){
            document.getElementById("progressdatepicker").value = "";
        }

        function resetendsoundinput(){
            document.getElementById("audioLink").value = "";
        }

        function setLightMode() {
            document.documentElement.style.setProperty('--mainbgcolor', '#ffffff');
            document.documentElement.style.setProperty('--mainforegroundcolor', '#000000');
            document.documentElement.style.setProperty('--selectedgreen', '#00d04c');
            document.documentElement.style.setProperty('--selectedgreengradient', 'linear-gradient(to bottom right, #ffffff00, #00d04c44)');
            document.documentElement.style.setProperty('--inputbackground', 'linear-gradient(to left,rgba(129, 70, 255, 0.42), transparent)');
            document.documentElement.style.setProperty('--speeddivbackground', 'linear-gradient(to bottom right,rgba(255, 255, 255, 0.61), #9a4cff)');
            document.documentElement.style.setProperty('--blurbackground', 'rgba(239, 239, 239, 0.73)');
            document.documentElement.style.setProperty('--altblurbackground', 'rgba(255, 255, 255, 0.8)');
            document.documentElement.style.setProperty('--blurbackgroundshadowcolor', 'rgba(255, 255, 255, 0.1)');
            document.documentElement.style.setProperty('--sidebarcolor', '#ffffff');
            document.documentElement.style.setProperty('--scheduleblurbg', 'rgba(239, 239, 239, 0.85)');
            document.documentElement.style.setProperty('--schedulebgbottomblur', '#ffffff');
            document.documentElement.style.setProperty('--progressbarblur', '#ffffffc8');
            document.documentElement.style.setProperty('--cardborder', '1.54px solid rgba(0, 0, 0, 0.1)');
            document.documentElement.style.setProperty('--progressbarhighlight', '0 4px 30px rgba(0, 0, 0, 0.1), inset 0 1.54px 0 rgba(255, 255, 255, 0.3)');
            document.documentElement.style.setProperty('--collaborationcardbg', '#d3b3ff');
            document.documentElement.style.setProperty('--collaborationcardbuttonshadow', '#343434');
            document.documentElement.style.setProperty('--collaborationbuttonbg', '#000000');
            if(getParameterFromSource("atc")== "none"){
                document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
                document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(0,0,0,1)');
            }
        }
        
        function setDarkMode() {
            document.documentElement.style.setProperty('--mainbgcolor', '#141414');
            document.documentElement.style.setProperty('--mainforegroundcolor', '#ffffff');
            document.documentElement.style.setProperty('--selectedgreen', '#01FE5E');
            document.documentElement.style.setProperty('--selectedgreengradient', 'linear-gradient(to bottom right, #14141400, #01fe5e34)');
            document.documentElement.style.setProperty('--inputbackground', 'linear-gradient(to left, rgba(129, 70, 255, 0.42), transparent)');
            document.documentElement.style.setProperty('--speeddivbackground', 'linear-gradient(to bottom right, #00000000, #2e0960)');
            document.documentElement.style.setProperty('--blurbackground', 'rgba(20, 20, 20, 0.83)');
            document.documentElement.style.setProperty('--altblurbackground', 'rgba(0, 0, 0, 0.8)');
            document.documentElement.style.setProperty('--blurbackgroundshadowcolor', 'rgba(0, 0, 0, 0.1)');
            document.documentElement.style.setProperty('--sidebarcolor', '#000000');
            document.documentElement.style.setProperty('--scheduleblurbg', 'rgba(20, 20, 20, 0.83)');
            document.documentElement.style.setProperty('--schedulebgbottomblur', '#14141491');
            document.documentElement.style.setProperty('--progressbarblur', '#141414c8');
            document.documentElement.style.setProperty('--titlergba', 'rgba(255,255,255,0)');
            document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(255,255,255,1)');
            document.documentElement.style.setProperty('--cardborder', '1.54px solid rgba(255, 255, 255, 0.1)');
            document.documentElement.style.setProperty('--progressbarhighlight', 'none');
            document.documentElement.style.setProperty('--collaborationcardbg', '#8426ff');
            document.documentElement.style.setProperty('--collaborationcardbuttonshadow', '#c0c0c0');
            document.documentElement.style.setProperty('--collaborationbuttonbg', '#ffffff');
        }
        
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
        setDarkMode();
    } else {
        setLightMode();
    }
const countdownTitle = document.getElementById("countdowntitle");
if (countdownTitle) {
    if (((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) || getParameterFromSource("atc") !== "none") {
        countdownTitle.style.border = `1px solid rgba(255, 255, 255, 0)`;
        document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
        document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(255,255,255,1)');
    } else {
        countdownTitle.style.border = `1px solid rgba(0, 0, 0, 0)`;
        document.documentElement.style.setProperty('--titlergba', 'rgba(0,0,0,0)');
        document.documentElement.style.setProperty('--titleforegroundcolor', 'rgba(0,0,0,1)');
    }
}
SetCountDowngeneral(); // Update any theme-colored pickers

});



        function parseRRule(rruleStr) {
            console.log('Parsing RRULE:', rruleStr);
            try {
                const rrule = {
                    freq: null,
                    interval: 1, // Default interval is 1
                    byday: [],
                    until: null,
                    count: null
                };
                
                if (!rruleStr) {
                    console.error('Empty RRULE string');
                    return null;
                }
                
                const parts = rruleStr.split(';');
                
                parts.forEach(part => {
                    const equalsIndex = part.indexOf('=');
                    if (equalsIndex === -1) return;
                    
                    const name = part.substring(0, equalsIndex);
                    const value = part.substring(equalsIndex + 1);
                    
                    console.log(`Processing RRULE part: ${name}=${value}`);
                    
                    switch (name) {
                        case 'FREQ':
                            rrule.freq = value;
                            break;
                        case 'INTERVAL':
                            const interval = parseInt(value, 10);
                            rrule.interval = !isNaN(interval) ? interval : 1;
                            break;
                        case 'BYDAY':
                            rrule.byday = value.split(',').filter(day => 
                                ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].includes(day));
                            break;
                        case 'UNTIL':
                            rrule.until = value;
                            break;
                        case 'COUNT':
                            rrule.count = parseInt(value, 10);
                            break;
                        // Ignore other RRULE properties for now
                    }
                });
                
                // If it's a weekly event with no specific days, default to the original event day
                if (rrule.freq === 'WEEKLY' && rrule.byday.length === 0) {
                    // Since we don't have the original date available here, we'll skip validation
                    console.log('Weekly event with no specified days');
                }
                
                console.log('RRULE parsing complete:', rrule);
                
                // Validate the rrule
                if (!rrule.freq) {
                    console.error('Invalid RRULE: Missing FREQ');
                    return null;
                }
                
                // Only support DAILY and WEEKLY frequencies
                if (rrule.freq !== 'DAILY' && rrule.freq !== 'WEEKLY') {
                    console.log(`Unsupported frequency: ${rrule.freq}, only DAILY and WEEKLY are supported`);
                    return null;
                }
                
                // For daily events, ensure they don't have a large interval
                if (rrule.freq === 'DAILY' && rrule.interval > 1) {
                    console.log(`Daily event has interval > 1 (${rrule.interval}), but will still be processed`);
                    // We still allow this for daily events, just log it
                }
                
                // Skip events that recur less often than weekly (interval > 1 for weekly events)
                if (rrule.freq === 'WEEKLY' && rrule.interval > 1) {
                    console.log(`Skipping bi-weekly or monthly event with interval: ${rrule.interval}`);
                    return null;
                }
                
                return rrule;
            } catch (error) {
                console.error('Error parsing RRULE:', error);
                return null;
            }
        }
        
        function formatICSTime(timeStr) {
            console.log('Formatting time:', timeStr);
            try {
                let time = '00:00'; // Default time
                
                if (!timeStr) {
                    console.log('Empty time string, using default');
                    return time;
                }
                
                // Handle various ICS time formats
                if (timeStr.includes('T')) {
                    // Standard format: YYYYMMDDTHHMMSSZ or similar
                    const dateTime = timeStr.split('T')[1];
                    
                    // Extract hours and minutes from the time part
                    if (dateTime.length >= 4) {
                        const hours = dateTime.substring(0, 2);
                        const minutes = dateTime.substring(2, 4);
                        
                        // Validate hours and minutes
                        const hoursNum = parseInt(hours, 10);
                        const minutesNum = parseInt(minutes, 10);
                        
                        if (!isNaN(hoursNum) && !isNaN(minutesNum) && 
                            hoursNum >= 0 && hoursNum <= 23 && 
                            minutesNum >= 0 && minutesNum <= 59) {
                            time = `${hours}:${minutes}`;
                        }
                    }
                } else if (timeStr.includes(':')) {
                    // Handle HH:MM format directly
                    const parts = timeStr.split(':');
                    if (parts.length >= 2) {
                        const hours = parts[0].padStart(2, '0');
                        const minutes = parts[1].padStart(2, '0');
                        time = `${hours}:${minutes}`;
                    }
                } else if (/^\d{6,}$/.test(timeStr)) {
                    // Handle raw numeric format (e.g., 083000 for 8:30 AM)
                    const hours = timeStr.substring(0, 2);
                    const minutes = timeStr.substring(2, 4);
                    time = `${hours}:${minutes}`;
                }
                
                console.log('Formatted time:', time);
                return time;
            } catch (error) {
                console.error('Error formatting time:', error);
                return '00:00'; // Default in case of error
            }
        }


      // Add these new drag-and-drop handler functions
      let draggedItem = null;

      function handleDragStart(e) {
          draggedItem = this;
          this.style.opacity = '0.4';
          
          // Create a custom drag image that matches the color picker
          const dragImage = this.cloneNode(true);
          dragImage.style.opacity = '0.7';
          dragImage.style.position = 'absolute';
          dragImage.style.top = '-1000px';
          document.body.appendChild(dragImage);
          e.dataTransfer.setDragImage(dragImage, 20, 20);
          
          // Remove the drag image after it's no longer needed
      setTimeout(() => {
              document.body.removeChild(dragImage);
          }, 0);
      }

      function handleDragEnd(e) {
          this.style.opacity = '1';
          
          const containers = document.querySelectorAll('.colorpicker-container');
          containers.forEach(container => {
              container.classList.remove('drag-over');
          });
      }

      function handleDragOver(e) {
          e.preventDefault();
          this.classList.add('drag-over');
      }

      function handleDrop(e) {
          e.preventDefault();
          this.classList.remove('drag-over');
          
          if (this === draggedItem) return;
          
          const container = document.getElementById('colorPickersContainer');
          const allItems = [...container.getElementsByClassName('colorpicker-container')];
          const draggedIndex = allItems.indexOf(draggedItem);
          const droppedIndex = allItems.indexOf(this);
          
          if (draggedIndex < droppedIndex) {
              this.parentNode.insertBefore(draggedItem, this.nextSibling);
          } else {
              this.parentNode.insertBefore(draggedItem, this);
          }
          
          // Update the line break position
          if(document.querySelector(".colorpickerlinebreak")){
              document.querySelector(".colorpickerlinebreak").remove();
          }
          if (container.children.length > 4) {
              const newBR = document.createElement('br');
              newBR.className = 'colorpickerlinebreak';
              container.insertBefore(newBR, container.children[4]);
          }

          // Defer remove button update until after DOM order is correct
          setTimeout(() => {
              const allItems = [...container.getElementsByClassName('colorpicker-container')];
              allItems.forEach((item, idx) => {
                  const removeBtn = item.querySelector('.remove-button');
                  if (removeBtn) {
                      if (idx === 0) {
                          removeBtn.style.cssText += "opacity:0 !important; user-select: none; cursor: default;";
                      } else {
                          removeBtn.style.opacity = "";
                          removeBtn.style.userSelect = "";
                          removeBtn.style.cursor = "";
                      }
                  }
              });
          }, 0);

          adjustHeightOfColorPickerContainer();
          updateColorAnimations();
              SetCountDowngeneral();
          }


      // Initialize drag-and-drop for existing color pickers
      window.addEventListener('load', () => {
          const containers = document.querySelectorAll('.colorpicker-container');
          containers.forEach(container => {
              container.draggable = true;
              container.addEventListener('dragstart', handleDragStart);
              container.addEventListener('dragend', handleDragEnd);
              container.addEventListener('dragover', handleDragOver);
              container.addEventListener('drop', handleDrop);
          });
      });
  

        function addForegroundColorPicker(method) {
            if (colorPickerCount < 8) {
                colorPickerCount++;
                const container = document.getElementById('colorPickersContainer');
                const newColorPickerContainer = document.createElement('div');
                newColorPickerContainer.className = 'colorpicker-container';
                newColorPickerContainer.draggable = true;
                
                // Add drag event listeners
                newColorPickerContainer.addEventListener('dragstart', handleDragStart);
                newColorPickerContainer.addEventListener('dragend', handleDragEnd);
                newColorPickerContainer.addEventListener('dragover', handleDragOver);
                newColorPickerContainer.addEventListener('drop', handleDrop);
        
                const newColorPicker = document.createElement('input');
                newColorPicker.className = 'colorpicker disabledcolorpicker fgcolorpicker';
                newColorPicker.id = `color${colorPickerCount}`;
                newColorPicker.type = 'color';
                newColorPicker.disabled = true;
                newColorPicker.style.cursor = "default";
                newColorPicker.title = "This color dynamically changes with your system theme";
                // Use CSS variable for theme color
                const computedStyle = getComputedStyle(document.documentElement);
                const themeColor = computedStyle.getPropertyValue('--mainforegroundcolor').trim();
                newColorPicker.value = themeColor;
                newColorPicker.dataset.useThemeColor = 'true'; // Mark this picker as using theme color
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
        
                if(colorpickersocontainer.children.length > 8){
                    document.querySelector(".clraddfg").classList.add("clraddoff");
                }
                else{
                    document.querySelector(".clraddfg").classList.remove("clraddoff");
                }
        
                adjustHeightOfColorPickerContainer();
                updateColorAnimations();
                if(method !== "auto"){
          SetCountDowngeneral();
                        }
                    }
                }
                
                document.querySelectorAll('.pfp-stack').forEach(stack=>{
                    const avatars = stack.querySelectorAll('.pfp');
                    avatars.forEach((av,i)=>{
                      av.style.zIndex = avatars.length - i;
                    });
                  });


                  const colors = ['#8426ff', '#3ab6ff', '#00df52', '#ff9900'];

                  function getInitials(name) {
                    const parts = name.trim().split(/\s+/).filter(Boolean);
                    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
                  }
                  
                  function generateProfilePic() {
    console.log('[betaapp] generateProfilePic called');
    // Prevent concurrent calls and redundant calls
    if (window.generatingProfile || window.lastProfileGeneration && Date.now() - window.lastProfileGeneration < 1000) {
        console.log('[betaapp] Profile generation skipped - too soon or already in progress');
        return;
    }
    window.generatingProfile = true;
    window.lastProfileGeneration = Date.now();
    
    // Skip database features in card mode
    if (parameter('cardmode')) {
        const localName = 'Sign In'; // Use default name instead of localStorage
        console.log('[betaapp] Card mode, using default name:', localName);
        generateProfilePicWithName(localName);
        const usrdetail = document.getElementById('usrdetail');
        if (usrdetail) usrdetail.innerHTML = 'Save, share, sync, and more';
        window.generatingProfile = false;
        return;
    }
    
    // First check if we have a session
    window.supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
        console.log('[betaapp] Session check:', session ? 'Logged in' : 'Not logged in');
        
        if (session?.user) {
            try {
                // Get user data from database
                const { data: userData, error } = await window.supabaseClient
                    .from('users')
                    .select('name, has_plus, avatar_url')
                    .eq('id', session.user.id)
                    .maybeSingle();
                
                console.log('[betaapp] Database query result:', { userData, error });
                
                if (userData) {
                    if (userData.has_plus && userData.avatar_url) {
                        console.log('[betaapp] Using avatar from database');
                        document.getElementById('userpfp').src = userData.avatar_url;
                        document.getElementById('settingsuserpfp').src = userData.avatar_url;
                        document.getElementById('usrname').textContent = userData.name || 'User';
                        document.getElementById('settingsusrname').textContent = userData.name || 'User';
                        return;
                    }
                    
                    if (userData.name && !error) {
                        console.log('[betaapp] Using name from database:', userData.name);
                        generateProfilePicWithName(userData.name);
                        return;
                    }
                }
                
                // Fallback to user metadata if no database entry
                const fallbackName = session.user.user_metadata?.full_name || 'Sign In';
                console.log('[betaapp] Using fallback name:', fallbackName);
                generateProfilePicWithName(fallbackName);
                if (fallbackName === 'Sign In') {
                  const usrdetail = document.getElementById('usrdetail');
                  if (usrdetail) usrdetail.innerHTML = 'Save, share, sync, and more';
                }
            } catch (error) {
                console.error('[betaapp] Error getting user data:', error);
                const fallbackName = session.user.user_metadata?.full_name || 'Sign In';
                generateProfilePicWithName(fallbackName);
                if (fallbackName === 'Sign In') {
                  const usrdetail = document.getElementById('usrdetail');
                  if (usrdetail) usrdetail.innerHTML = 'Save, share, sync, and more';
                }
            }
        } else {
            // Not logged in, use default name
            const localName = 'Sign In';
            console.log('[betaapp] Not logged in, using default name:', localName);
            generateProfilePicWithName(localName);
            const usrdetail = document.getElementById('usrdetail');
            if (usrdetail) usrdetail.innerHTML = 'Save, share, sync, and more';
        }
    }).catch(error => {
        console.error('[betaapp] Session check error:', error);
        const localName = 'Sign In';
        generateProfilePicWithName(localName);
        const usrdetail = document.getElementById('usrdetail');
        if (usrdetail) usrdetail.innerHTML = 'Save, share, sync, and more';
    }).finally(() => {
        window.generatingProfile = false;
    });
                  }

                  function generateProfilePicWithName(name) {
                    console.log('[betaapp] generateProfilePicWithName called with:', name);
                    
                    const usrnameElement = document.getElementById('usrname');
                    const settingsusrnameElement = document.getElementById('settingsusrname');
                    const userpfpElement = document.getElementById('userpfp');
                    const settingsuserpfpElement = document.getElementById('settingsuserpfp');
                    const profileCanvasElement = document.getElementById('profileCanvas');
                    
                    console.log('[betaapp] DOM elements found:', {
                        usrname: !!usrnameElement,
                        settingsusrname: !!settingsusrnameElement,
                        userpfp: !!userpfpElement,
                        settingsuserpfp: !!settingsuserpfpElement,
                        profileCanvas: !!profileCanvasElement
                    });
                    
                    if (!usrnameElement || !userpfpElement || !profileCanvasElement || !settingsusrnameElement || !settingsuserpfpElement) {
                        console.error('[betaapp] Missing required DOM elements');
                        return;
                    }
                    
                    usrnameElement.textContent = name;
                    settingsusrnameElement.textContent = name;
                    let color = localStorage.getItem('pfp_color');
                  
                    // Assign a random color only on first visit
                    if (!color) {
                      color = colors[Math.floor(Math.random() * colors.length)];
                      localStorage.setItem('pfp_color', color);
                    }
                  let initials = "";
                  if(name == 'Sign In'){
                     initials = '?';
                  }else{
                     initials = getInitials(name);
                  }
                    const canvas = profileCanvasElement;
                    const ctx = canvas.getContext('2d');
                  
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                  
                    ctx.fillStyle = 'white';
                    ctx.font = '100 80px "Fredoka One"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(initials, canvas.width / 2, canvas.height / 2);
                  
                    const dataURL = canvas.toDataURL('image/png');
                    userpfpElement.src = dataURL;
                    settingsuserpfpElement.src = dataURL;
                    console.log('[betaapp] Profile picture generated successfully');
                  }

                  // Set up authentication state listener (only once globally)
                  if (!parameter('cardmode')) {
                    if (typeof window.supabaseClient !== "undefined" && window.supabaseClient.auth && !window.authListenerSetup) {
                      window.authListenerSetup = true;
                      console.log('[betaapp] Setting up auth listener');
                      
                      // First check current session
                      window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
                          console.log('[betaapp] Initial session check:', session ? 'Logged in' : 'Not logged in');
                          
                          // Set up auth state change listener
                          window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
                              console.log('[betaapp] Auth state changed:', event, session);
                              if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
                                // Create/update user in database
                                const user = session.user;
                                const userId = user.id;
                                const email = user.email;
                                const name = user.user_metadata?.full_name;
                                const avatar_url = user.user_metadata?.avatar_url;
                                
                                console.log('[betaapp] User signed in:', { userId, email, name, avatar_url });
                                
                                if (userId && email && name) {
                                    try {
                                        const { error } = await window.supabaseClient
                                            .from("users")
                                            .upsert({
                                                id: userId,
                                                email,
                                                name,
                                                avatar_url,
                                            }, { onConflict: 'id' });
                                        
                                        if (error) {
                                            console.error('[betaapp] User upsert error:', error.message);
                                        } else {
                                            console.log('[betaapp] User upserted successfully');
                                            // Only generate profile pic after successful upsert
                                            generateProfilePic();
                                            // Load cookies from cloud when user logs in
                                            await loadCookiesFromCloud();
                                        }
                                    } catch (upsertError) {
                                        console.error('[betaapp] User upsert failed:', upsertError);
                                    }
                                } else {
                                    console.warn('[betaapp] Missing user info for upsert:', { userId, email, name });
                                }
                              } else if (event === 'SIGNED_OUT') {
                                  console.log('[betaapp] User signed out');
                                  // User signed out, use default name
                                  const localName = 'Sign In';
                                  generateProfilePicWithName(localName);
                                  const usrdetail = document.getElementById('usrdetail');
                                  if (usrdetail) usrdetail.innerHTML = 'Save, share, sync, and more';
                              }
                          });
                          
                          // If we have a session, trigger initial profile pic generation
                          if (session) {
                              generateProfilePic();
                          }
                      });
                    } else {
                      console.log('[betaapp] Auth listener setup skipped:', {
                          supabaseClientExists: typeof window.supabaseClient !== "undefined",
                          authExists: typeof window.supabaseClient !== "undefined" && window.supabaseClient.auth,
                          alreadySetup: window.authListenerSetup
                      });
                    }
                  }

                  // Initialize profile picture on page load
                  if (parameter('cardmode')) {
                    // In card mode, just generate once with default data
                    console.log('[betaapp] Card mode - generating with default data');
                    const localName = 'Sign In';
                    generateProfilePicWithName(localName);
                  } else if (typeof window.supabaseClient !== "undefined" && window.supabaseClient.auth) {
                    // Let the auth listener handle the initial profile pic generation
                  }

                  function renameUser() {
                    const newName = prompt('Enter your new name:');
                    if (newName?.trim()) {
                      generateProfilePicWithName(newName.trim()); // regenerate with new name, same color
                    }
                  }


                  function openPersonalSettings() {
                    document.getElementById('personalSettingsOverlay').style.display = 'flex';
                  }
                
                  function closePersonalSettings() {
                    document.getElementById('personalSettingsOverlay').style.display = 'none';
                  }



// --- Search settings functionality ---
function searchsettings() {
    const input = document.getElementById("searchbarinput");
    const filter = input.value.toLowerCase();
    const resultsContainer = document.getElementById("search-results");
    resultsContainer.innerHTML = "";

    if (!filter) {
        resultsContainer.classList.add("searchhidden");
        return;
    }

    const sections = document.querySelectorAll('#settings h1[id], #settings h2[id], #settings h3[id]');
    let found = false;
    
    sections.forEach(section => {
        const fullText = [
            section.textContent,
            section.nextElementSibling?.textContent
          ].join(" ").toLowerCase();
              
        if (fullText.includes(filter)) {
            const resultBtn = document.createElement("button");
            resultBtn.className = "searchresultbtn";
            resultBtn.textContent = section.textContent;
            resultBtn.onclick = () => {
                section.scrollIntoView({ behavior: "smooth", block: "start" });
                document.getElementById("searchbarinput").value = "";
                resultsContainer.innerHTML = "";
                resultsContainer.classList.add("searchhidden");
    
                if (window.innerWidth < 768) {
                    settings(); // close settings on mobile
                }
            };
            resultsContainer.appendChild(resultBtn);
            found = true;
        }
    });

    if (found) {
        resultsContainer.classList.remove("searchhidden");
      } else {
        resultsContainer.classList.add("searchhidden");
      }
    }


    function getAllCookiesAsString() {
        const cookies = document.cookie.split(';');
        let cookieString = '';
        cookies.forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (!name.toLowerCase().includes('posthog')) {
                cookieString += `${name}: ${value}\n`;
            }
        });
        return cookieString;
    }


function syncCookiesToCloud() {
    // Use window-scoped variables to avoid ReferenceError on first use
    if (typeof window.lastCookieSync === "undefined") window.lastCookieSync = 0;
    if (typeof window.lastSyncedCookies === "undefined") window.lastSyncedCookies = "";

    const now = Date.now();
    // 10s cooldown
    if (now - window.lastCookieSync < 10000) {
        console.log('[betaapp] Skipping cookie sync: cooldown active');
        return;
    }

    if (typeof window.supabaseClient !== "undefined" && window.supabaseClient.auth) {
        window.supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                try {
                    // Get local cookies as the source of truth
                    const localCookies = getAllCookiesAsString();

                    // Only sync if cookies have changed since last sync
                    if (localCookies === window.lastSyncedCookies) {
                        console.log('[betaapp] Skipping cookie sync: no changes detected');
                        return;
                    }

                    // Update cloud with local settings (no merging)
                    const { error: updateError } = await window.supabaseClient
                        .from('users')
                        .update({ settings: localCookies })
                        .eq('id', session.user.id);

                    if (updateError) {
                        console.error('[betaapp] Error updating settings:', updateError);
                    } else {
                        window.lastCookieSync = Date.now();
                        window.lastSyncedCookies = localCookies;
                        console.log('[betaapp] Settings synced to cloud successfully');
                    }
                } catch (updateError) {
                    console.error('[betaapp] Settings update failed:', updateError);
                }
            }
        });
    }
}

async function logoutUser() {
    console.log('[betaapp] Logout function called');
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        if (!user) {
            return;
        }
                
        const { error } = await window.supabaseClient.auth.signOut();
        
        if (error) {
            showToast('Logout failed: ' + error.message, 'error');
        } else {
            showToast('Logged out successfully', 'success');
        }
    } catch (error) {
        showToast('Logout failed: ' + error.message, 'error');
    }
    resetcookies();

    // Reload the page after logout
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// Add this function after the existing functions, before the settings function
async function isUserEditor() {
    try {
        if (parameter('id')) {
            // Check if user is authenticated
            if (typeof window.supabaseClient === "undefined" || !window.supabaseClient.auth) {
                return false;
            }

            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) {
                return false;
            }

            const user = session.user;

            // Check if user is the owner
            if (window.CountdownDataID) {
                const { data: countdownData, error } = await window.supabaseClient
                    .from('countdown')
                    .select('creator, collaborator_ids')
                    .eq('id', window.CountdownDataID)
                    .maybeSingle();

                if (countdownData && !error) {
                    // User is owner
                    if (countdownData.creator === user.id) {
                        return true;
                    }

                    // User is collaborator
                    if (countdownData.collaborator_ids && countdownData.collaborator_ids.includes(user.id)) {
                        return true;
                    }
                }
            }
        }else{
            return true;
        }

        
        return false;
    } catch (error) {
        console.error('[isUserEditor] Error checking editor status:', error);
        return false;
    }
}

document.getElementById('infopanecontent').style.display = 'none';
        
// Show loading element
const loadingElement = document.getElementById('infopreloader');
if (loadingElement) {
    loadingElement.style.display = 'block';
}

// Function to update gear icon based on user's editor status
async function updateGearIconForUser() {
    // Check if this function has already run
    if (window.gearIconUpdated) {
        return;
    }
    
    try {
        const isEditor = await isUserEditor();
        const gearIcon = document.getElementById('innergear');
        const gearButton = document.getElementById('gear');
        
        if (gearIcon && gearButton) {
            if (isEditor) {
                // User is editor - show gear icon and normal settings behavior
                gearIcon.className = 'fa-solid fa-gear';
                gearButton.onclick = settings;
            } else {
                // User is not editor - show info icon and info pane behavior
                gearIcon.className = 'fa-solid fa-info';
                gearButton.onclick = settings; // The settings function now handles both cases
            }
        }

        // Check if user is logged in and show/hide appropriate divs
        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            const infosignupDiv = document.getElementById('infosignup');
            const infoclonecdDiv = document.getElementById('infoclonecd');
            
            if (user) {
                // User is logged in - hide infosignup, show infoclonecd
                if (infosignupDiv) infosignupDiv.style.display = 'none';
                if (infoclonecdDiv) infoclonecdDiv.style.display = '';
            } else {
                // User is not logged in - show infosignup, hide infoclonecd
                if (infosignupDiv) infosignupDiv.style.display = '';
                if (infoclonecdDiv) infoclonecdDiv.style.display = 'none';
            }
        } catch (authError) {
            console.log('[updateGearIconForUser] User not authenticated or auth error:', authError);
            // Default to showing signup and hiding clonecd when auth fails
            const infosignupDiv = document.getElementById('infosignup');
            const infoclonecdDiv = document.getElementById('infoclonecd');
            if (infosignupDiv) infosignupDiv.style.display = '';
            if (infoclonecdDiv) infoclonecdDiv.style.display = 'none';
        }

        // Update info pane with countdown creator info
        if (window.CountdownDataID) {
            try {
                console.log('[updateGearIconForUser] Updating info pane for countdown ID:', window.CountdownDataID);
                
                // Fetch countdown data including creator, created_at, and clonedfrom
                const { data: countdownData, error: countdownError } = await window.supabaseClient
                    .from('countdown')
                    .select('creator, created_at, clonedfrom')
                    .eq('id', window.CountdownDataID)
                    .maybeSingle();

                console.log('[updateGearIconForUser] Countdown data:', countdownData, 'Error:', countdownError);

                if (countdownData && !countdownError && countdownData.creator) {
                    console.log('[updateGearIconForUser] Creator UUID:', countdownData.creator);
                    
                    // Fetch creator's name, avatar, and official status from users table
                    console.log('[updateGearIconForUser] Querying users table for ID:', countdownData.creator);
                    const { data: userData, error: userError } = await window.supabaseClient
                        .from('public_profiles')
                        .select('name, avatar_url, official')
                        .eq('id', countdownData.creator)
                        .maybeSingle();

                    console.log('[updateGearIconForUser] Users table query result - Data:', userData, 'Error:', userError);
                    
                    // Let's also try to see if the user exists at all
                    const { data: userExists, error: existsError } = await window.supabaseClient
                        .from('public_profiles')
                        .select('id')
                        .eq('id', countdownData.creator)
                        .maybeSingle();
                    
                    console.log('[updateGearIconForUser] User exists check - Data:', userExists, 'Error:', existsError);

                    if (userData && !userError && userData.name) {
                        console.log('[updateGearIconForUser] Updating creator name to:', userData.name);
                        
                        // Update the creator name in the info pane
                        const creatorNameElement = document.getElementById('infocreatorname');
                        console.log('[updateGearIconForUser] Creator name element found:', !!creatorNameElement);
                        if (creatorNameElement) {
                            creatorNameElement.textContent = userData.name;
                        }

                        // Update the creator's profile picture
                        if (userData.avatar_url) {
                            console.log('[updateGearIconForUser] Updating creator avatar to:', userData.avatar_url);
                            const creatorPfpElement = document.getElementById('infocreatorpfp');
                            console.log('[updateGearIconForUser] Creator avatar element found:', !!creatorPfpElement);
                            if (creatorPfpElement) {
                                creatorPfpElement.src = userData.avatar_url;
                            }
                        }

                        // Check official status and show/hide verification badge
                        if (userData.official !== undefined) {
                            console.log('[updateGearIconForUser] Creator official status:', userData.official);
                            const verifiedElement = document.getElementById('infocreatorverified');
                            if (verifiedElement) {
                                if (userData.official === true) {
                                    // User is official - do nothing (keep badge visible)
                                    console.log('[updateGearIconForUser] Creator is official, keeping verification badge visible');
                                } else {
                                    // User is not official - hide verification badge
                                    console.log('[updateGearIconForUser] Creator is not official, hiding verification badge');
                                    document.getElementById('officialtexttip').style.display = 'none';
                                    verifiedElement.style.display = 'none';
                                }
                            } else {
                                console.log('[updateGearIconForUser] Verification badge element not found');
                            }
                        } else {
                            console.log('[updateGearIconForUser] No official status found for creator');
                        }
                    }

                    // Update the creation date
                    if (countdownData.created_at) {
                        console.log('[updateGearIconForUser] Updating creation date to:', countdownData.created_at);
                        const creationDateElement = document.getElementById('infocreationdate');
                        console.log('[updateGearIconForUser] Creation date element found:', !!creationDateElement);
                        if (creationDateElement) {
                            const createdDate = new Date(countdownData.created_at);
                            const formattedDate = createdDate.toLocaleDateString('en-US', {
                                month: '2-digit',
                                day: '2-digit',
                                year: 'numeric'
                            });
                            creationDateElement.textContent = formattedDate;
                        }
                    }

                    // Check if this countdown was cloned from another one
                    if (countdownData.clonedfrom) {
                        console.log('[updateGearIconForUser] Countdown was cloned from:', countdownData.clonedfrom);
                        
                        // Update the verb text to "adapted"
                        const createdVerbElement = document.getElementById('infocreatedverb');
                        if (createdVerbElement) {
                            createdVerbElement.textContent = 'Adapted';
                            
                            // Make it clickable to go to the original countdown
                            createdVerbElement.style.cursor = 'pointer';
                            createdVerbElement.style.textDecoration = 'underline';
                            createdVerbElement.onclick = function() {
                                const originalUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "?id=" + countdownData.clonedfrom;
                                window.location.href = originalUrl;
                            };
                        }
                    }
                } else {
                    console.log('[updateGearIconForUser] No countdown data or creator found');
                }
            } catch (error) {
                console.error('[updateGearIconForUser] Error updating info pane:', error);
            }
        } else {
            console.log('[updateGearIconForUser] No CountdownDataID available');
        }

        // Hide loading element after all data is processed
        if (document.getElementById('infopreloader')) {
            document.getElementById('infopanecontent').style.display = '';
            loadingElement.style.display = 'none';
        }
        
        // Mark function as completed
        window.gearIconUpdated = true;
        
    } catch (error) {
        console.error('[updateGearIconForUser] Error updating gear icon:', error);
        // Fallback to default gear icon
        const gearIcon = document.getElementById('innergear');
        if (gearIcon) {
            gearIcon.className = 'fa-solid fa-gear';
        }
        
        // Hide loading element on error
        const loadingElement = document.getElementById('infopreloader');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        // Mark function as completed even on error
        window.gearIconUpdated = true;
    }
}

async function clonecountdown() {
    try {
        // Check if user is authenticated
        if (typeof window.supabaseClient === "undefined" || !window.supabaseClient.auth) {
            console.log('[clonecountdown] Supabase client not available');
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            console.log('[clonecountdown] User not logged in');
            return;
        }

        const user = session.user;
        const currentCountdownId = window.CountdownDataID;

        if (!currentCountdownId) {
            console.log('[clonecountdown] No current countdown ID found');
            return;
        }

        // Get the current countdown data
        const { data: countdownData, error: fetchError } = await window.supabaseClient
            .from('countdown')
            .select('*')
            .eq('id', currentCountdownId)
            .maybeSingle();

        if (fetchError || !countdownData) {
            console.error('[clonecountdown] Error fetching countdown data:', fetchError);
            return;
        }

        // Check if current user is the owner
        if (countdownData.creator === user.id) {
            console.log('[clonecountdown] User is the owner, cannot clone own countdown');
            return;
        }

        // Generate new ID for the cloned countdown
        const newCountdownId = generateShortId();

        // Clone the countdown data but with new ID and current user as owner
        const clonedCountdownData = {
            id: newCountdownId,
            data: countdownData.data, // Use the 'data' column as requested
            creator: user.id,
            collaborator_ids: [],
            visibility: 1, // unlisted by default
            clonedfrom: currentCountdownId // Set the clonedfrom column
        };

        // Insert the cloned countdown into the database
        const { error: insertError } = await window.supabaseClient
            .from('countdown')
            .insert(clonedCountdownData);

        if (insertError) {
            console.error('[clonecountdown] Error inserting cloned countdown:', insertError);
            return;
        }

        console.log('[clonecountdown] Countdown cloned successfully with ID:', newCountdownId);

        // Redirect to the new countdown
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "?id=" + newCountdownId;
        window.location.href = newUrl;

    } catch (error) {
        console.error('[clonecountdown] Error during cloning:', error);
    }
}