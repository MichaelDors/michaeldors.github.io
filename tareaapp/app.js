var intervalc = setInterval(change, 5000);
var intervald = setInterval(changemini, 5000);

document.addEventListener("keypress", function(event) {
    if (event.keyCode == 13) {
      change();
      changemini();
      clearInterval(intervalc);
      clearInterval(intervald);
    }
  });



function change(){
    document.getElementById("ontopof").classList.add('hiding');
    setTimeout(function () {
        document.getElementById("ontopof").classList.add('godown');
        setTimeout(function () {
            const possible = ["things", "life", "homework", "tasks", "organization", "events", "planning", "your goals", "your career", "exercise", "reading", "consistency", "remembering", "personal growth", "challenges", "practicing", "music", "your schedule", "coding", "time management", "mundane tasks", "what you need to", "doing things regularly", "a steady schedule", "anything", "repeating endeavors"];
            const random = Math.floor(Math.random() * possible.length);
            document.getElementById("ontopof").innerHTML = possible[random];
            const colors = ["157,0,255","60,79,224", "255,123,0", "0,191,35", "0,57,191", "191,0,111", "232,37,12", "12,232,159"];
            const randomcol = Math.floor(Math.random() * colors.length);
            var r = document.querySelector(':root');
            r.style.setProperty('--altcolor', colors[randomcol]);
            document.getElementById("ontopof").classList.remove('godown');
            setTimeout(function() {
                document.getElementById("ontopof").classList.remove('hiding');
            }, 300);
        }, 750);
    }, 300);
}
var counter = 0;
function changemini(){
    document.getElementById("minitext").classList.add('hiding');
    document.getElementById("minitext").classList.add('minidown');
    setTimeout(function () {
        const possiblemini = ["Tarea organizes your tasks in a way that rewards you for getting them done.", "Replace your reminders and calendar apps with Tarea.", "Tarea can be used for almost anything that needs organization.", "Gamify tedious tasks by adding positive rewards with Tarea."];

        if(counter < possiblemini.length){
            counter = counter + 1;
        }
        
        if(counter == possiblemini.length){
            counter = 0;
        }

        document.getElementById("minitext").innerHTML = possiblemini[counter];
        setTimeout(function() {
            document.getElementById("minitext").classList.remove('hiding');
            document.getElementById("minitext").classList.remove('minidown');
        }, 300);
    }, 750);
}

function vid1(){
    document.getElementById("vid1").pause();
    document.getElementById("vid1").currentTime = 0;
    document.getElementById("vid1").play();
}    
function vid2(){
    document.getElementById("vid2").pause();
    document.getElementById("vid2").currentTime = 0;
    document.getElementById("vid2").play();
}
function vid3(){
    document.getElementById("vid3").pause();
    document.getElementById("vid3").currentTime = 0;
    document.getElementById("vid3").play();
}

function dragalert(){
    alert(waht);
}
