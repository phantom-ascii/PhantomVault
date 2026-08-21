const UnlockScreen = document.getElementById("unlock-screen");
const passkey = document.getElementById("passkey");
const accessButton = document.getElementById("access-button");
const vaultScreen = document.getElementById("vault-screen");
const lockButton = document.getElementById("lock-button");
const uploadButton = document.getElementById("upload-button");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");

document.addEventListener("mousemove", (event) => {
    const x = event.clientX;
    const y = event.clientY;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const deltaX = x - centerX;
    const deltaY = y - centerY;

    const rotateX = -deltaY / 40;
    const rotateY = deltaX / 40;

    UnlockScreen.style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

accessButton.addEventListener("click", () => {
    const enteredPasskey = passkey.value;

    if (enteredPasskey === "") {
        return;
    }

    UnlockScreen.classList.add("unlocked");
    vaultScreen.classList.add("active");
});

lockButton.addEventListener("click", () => {
    UnlockScreen.classList.remove("unlocked");
    vaultScreen.classList.remove("active");

    passkey.value = "";
});

uploadButton.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    const emptyVault = document.querySelector(".empty-vault");

    emptyVault.style.display = "none";

    const fileItem = document.createElement("div");

    fileItem.classList.add("file-item");

    fileItem.innerHTML = `
        <span>${file.name}</span>
        <span>${(file.size / 1024).toFixed(1)} KB</span>
    `;

    fileList.appendChild(fileItem);

    fileInput.value = "";
});