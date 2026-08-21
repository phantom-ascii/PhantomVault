const UnlockScreen = document.getElementById("unlock-screen");

document.addEventListener("mousemove", (event) => {
    const x = event.clientX;
    const y = event.clientY;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const deltaX = x - centerX;
    const deltaY = y - centerY;

    const moveX = deltaX / 30;
    const moveY = deltaY / 30;
});``