let toggleSwitch = document.querySelector("input");

toggleSwitch.addEventListener("change", (e) => {
    let body = document.querySelector("body");
    let title = document.querySelector("h4");

    if (e.target.checked) {
        body.style.backgroundColor = "#17193F";
        title.style.color = "#f8f8f8";
    } else {
        body.style.backgroundColor = "#f8f8f8";
        title.style.color = "#17193F";
    }
});

// ! // Importing Scroll Motion Library //
import LocomotiveScroll from "https://cdn.skypack.dev/locomotive-scroll";

const scroller = new LocomotiveScroll({
    el: document.querySelector("[data-scroll-container]"),
    smooth: true,
});

// console.log({scroller});

// Get the button
let mybutton = document.getElementById("myBtn");

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function () {
    scrollFunction();
};

function scrollFunction() {
    if (
        document.body.scrollTop > 20 ||
        document.documentElement.scrollTop > 20
    ) {
        mybutton.style.display = "block";
    } else {
        mybutton.style.display = "none";
    }
}

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}
