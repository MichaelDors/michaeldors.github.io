function work(){
    document.getElementById("portfolio").scrollIntoView({ block: 'end',  behavior: 'smooth' });
}
function home(){
    document.getElementById("home").scrollIntoView({ block: 'end',  behavior: 'smooth' });
}


window.onscroll = function() {myFunction()};

var header = document.getElementById("myheader");

var sticky = header.offsetTop;

function myFunction() {
  if (window.pageYOffset > sticky) {
    header.classList.add("sticky");
  } else {
    header.classList.remove("sticky");
  }
}