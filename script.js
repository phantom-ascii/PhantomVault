let db = null;
let encryptionKey = null;

const unlockScreen = document.getElementById("unlock-screen");
const vaultScreen = document.getElementById("vault-screen");

const passkey = document.getElementById("passkey");
const accessButton = document.getElementById("access-button");
const forgotPassword = document.getElementById("forgot-password");
const lockButton = document.getElementById("lock-button");

const uploadButton = document.getElementById("upload-button");
const emptyUploadButton = document.getElementById("empty-upload-button");
const fileInput = document.getElementById("file-input");

const fileList = document.getElementById("file-list");
const emptyVault = document.querySelector(".empty-vault");

const databaseRequest = indexedDB.open("PhantomVault", 2);

databaseRequest.onupgradeneeded = event => {
    db = event.target.result;

    if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", {
            keyPath: "id",
            autoIncrement: true
        });
    }

    if (!db.objectStoreNames.contains("vault")) {
        db.createObjectStore("vault", {
            keyPath: "id"
        });
    }
};

databaseRequest.onsuccess = event => {
    db = event.target.result;
    console.log("Phantom Vault database ready.");
};

databaseRequest.onerror = event => {
    console.error("Database error:", event.target.error);
};

document.addEventListener("mousemove", event => {
    if (unlockScreen.classList.contains("unlocked")) {
        return;
    }

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const rotateX = -(event.clientY - centerY) / 40;
    const rotateY = (event.clientX - centerX) / 40;

    unlockScreen.style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

function getOrCreateSalt() {
    let salt = localStorage.getItem("phantomVaultSalt");

    if (!salt) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));

        salt = arrayBufferToBase64(bytes);

        localStorage.setItem("phantomVaultSalt", salt);
    }

    return base64ToArrayBuffer(salt);
}

async function deriveKey(password, salt) {
    const passwordData = new TextEncoder().encode(password);

    const baseKey = await crypto.subtle.importKey(
        "raw",
        passwordData,
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 600000,
            hash: "SHA-256"
        },
        baseKey,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );
}

async function createVerification(key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const data = new TextEncoder().encode("PHANTOM_VAULT_VERIFIED");

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        key,
        data
    );

    return {
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encrypted)
    };
}

function verifyPassword(key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["vault"], "readonly");
        const store = transaction.objectStore("vault");
        const request = store.get("verification");

        request.onsuccess = async () => {
            const verification = request.result;

            if (!verification) {
                resolve(null);
                return;
            }

            try {
                const iv = base64ToArrayBuffer(verification.iv);
                const encrypted = base64ToArrayBuffer(verification.data);

                await crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv
                    },
                    key,
                    encrypted
                );

                resolve(true);
            } catch {
                resolve(false);
            }
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function saveVerification(key) {
    const verification = await createVerification(key);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["vault"], "readwrite");
        const store = transaction.objectStore("vault");

        const request = store.put({
            id: "verification",
            iv: verification.iv,
            data: verification.data
        });

        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
    });
}

async function unlockVault() {
    const password = passkey.value;

    if (!password) {
        passkey.focus();
        return;
    }

    accessButton.disabled = true;
    accessButton.textContent = "Checking...";

    try {
        const salt = getOrCreateSalt();
        const key = await deriveKey(password, salt);
        const verified = await verifyPassword(key);

        if (verified === null) {
            await saveVerification(key);
        } else if (!verified) {
            encryptionKey = null;
            alert("Incorrect passkey.");
            return;
        }

        encryptionKey = key;

        unlockScreen.classList.add("unlocked");
        vaultScreen.classList.add("active");

        loadFiles();
    } catch (error) {
        console.error("Unlock error:", error);
        alert("Something went wrong unlocking the vault.");
    } finally {
        accessButton.disabled = false;
        accessButton.textContent = "Access Vault";
    }
}

accessButton.addEventListener("click", unlockVault);

passkey.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        unlockVault();
    }
});

lockButton.addEventListener("click", () => {
    encryptionKey = null;

    vaultScreen.classList.remove("active");
    unlockScreen.classList.remove("unlocked");

    unlockScreen.style.transform = "";
    passkey.value = "";

    fileList.innerHTML = "";
    updateEmptyState();
});

forgotPassword.addEventListener("click", async () => {
    const confirmed = confirm(
        "RESET PHANTOM VAULT?\n\n" +
        "This will permanently delete ALL encrypted files and reset the vault.\n\n" +
        "Your old passkey cannot be recovered.\n\n" +
        "This action cannot be undone."
    );

    if (!confirmed) {
        return;
    }

    const confirmation = prompt(
        'Type "DELETE" to permanently reset the vault:'
    );

    if (confirmation !== "DELETE") {
        alert("Vault reset cancelled.");
        return;
    }

    try {
        encryptionKey = null;

        if (db) {
            db.close();
            db = null;
        }

        await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase("PhantomVault");

            request.onsuccess = resolve;

            request.onerror = () => {
                reject(request.error);
            };

            request.onblocked = () => {
                reject(new Error("Database deletion blocked."));
            };
        });

        localStorage.removeItem("phantomVaultSalt");

        alert("Phantom Vault has been reset.");
        location.reload();
    } catch (error) {
        console.error("Vault reset failed:", error);

        alert(
            "Could not reset the vault. " +
            "Close any other Phantom Vault tabs and try again."
        );
    }
});

uploadButton.addEventListener("click", () => {
    fileInput.click();
});

emptyUploadButton.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files);

    if (!files.length) {
        return;
    }

    if (!encryptionKey) {
        alert("Vault is locked.");
        return;
    }

    for (const file of files) {
        try {
            await encryptAndSaveFile(file);
        } catch (error) {
            console.error("Encryption failed:", error);
            alert(`Could not encrypt ${file.name}`);
        }
    }

    fileInput.value = "";
    updateEmptyState();
});

async function encryptAndSaveFile(file) {
    const fileData = await file.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        encryptionKey,
        fileData
    );

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");

        const request = store.add({
            name: file.name,
            type: file.type,
            size: file.size,
            iv: arrayBufferToBase64(iv),
            data: arrayBufferToBase64(encryptedData)
        });

        request.onsuccess = () => {
            addFileToUI({
                id: request.result,
                name: file.name,
                type: file.type,
                size: file.size
            });

            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

function loadFiles() {
    if (!db) {
        return;
    }

    fileList.innerHTML = "";

    const transaction = db.transaction(["files"], "readonly");
    const store = transaction.objectStore("files");
    const request = store.getAll();

    request.onsuccess = () => {
        request.result.forEach(file => {
            addFileToUI(file);
        });

        updateEmptyState();
    };
}

function addFileToUI(file) {
    const fileItem = document.createElement("div");

    fileItem.className = "file-item";

    fileItem.innerHTML = `
        <span class="file-name">${escapeHTML(file.name)}</span>

        <div class="file-actions">
            <button class="open-file">Open</button>
            <button class="delete-file">Delete</button>
        </div>
    `;

    fileList.appendChild(fileItem);

    const openButton = fileItem.querySelector(".open-file");
    const deleteButton = fileItem.querySelector(".delete-file");

    openButton.addEventListener("click", async () => {
        try {
            openButton.disabled = true;
            openButton.textContent = "Decrypting...";

            const stored = await getFile(file.id);

            const iv = base64ToArrayBuffer(stored.iv);
            const encrypted = base64ToArrayBuffer(stored.data);

            const decrypted = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv
                },
                encryptionKey,
                encrypted
            );

            const blob = new Blob([decrypted], {
                type: stored.type || "application/octet-stream"
            });

            const url = URL.createObjectURL(blob);

            window.open(url, "_blank");

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 60000);
        } catch (error) {
            console.error("Decryption failed:", error);
            alert("Could not decrypt this file.");
        } finally {
            openButton.disabled = false;
            openButton.textContent = "Open";
        }
    });

    deleteButton.addEventListener("click", async () => {
        const confirmed = confirm(`Delete "${file.name}"?`);

        if (!confirmed) {
            return;
        }

        try {
            await deleteFile(file.id, fileItem);
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Could not delete the file.");
        }
    });
}

function getFile(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["files"], "readonly");
        const store = transaction.objectStore("files");
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

function deleteFile(id, element) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        const request = store.delete(id);

        request.onsuccess = () => {
            element.remove();
            updateEmptyState();
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

function updateEmptyState() {
    emptyVault.style.display =
        fileList.children.length === 0 ? "flex" : "none";
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;

    return div.innerHTML;
}
