// * // Get Element Button //
let mybutton = document.getElementById("myBtn");

// * // When the user scrolls down 20px from the top of the document, show the button //
window.onscroll = () => {
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

// * // Function to Scroll Document Up //
function topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}
