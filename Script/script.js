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
  smooth: true
});

// console.log({scroller});