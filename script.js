let db;
let encryptionKey = null;


/* =========================
   ELEMENTS
========================= */

const UnlockScreen =
  document.getElementById("unlock-screen");

const passkey =
  document.getElementById("passkey");

const accessButton =
  document.getElementById("access-button");

const forgotPassword =
  document.getElementById("forgot-password");

const vaultScreen =
  document.getElementById("vault-screen");

const lockButton =
  document.getElementById("lock-button");

const uploadButton =
  document.getElementById("upload-button");

const emptyUploadButton =
  document.getElementById("empty-upload-button");

const fileInput =
  document.getElementById("file-input");

const fileList =
  document.getElementById("file-list");

const emptyVault =
  document.querySelector(".empty-vault");


/* =========================
   DATABASE
========================= */

const databaseRequest =
  indexedDB.open(
    "PhantomVault",
    2
  );


databaseRequest.onupgradeneeded =
  (event) => {

    db = event.target.result;

    if (
      !db.objectStoreNames.contains(
        "files"
      )
    ) {

      db.createObjectStore(
        "files",
        {
          keyPath: "id",
          autoIncrement: true
        }
      );
    }


    if (
      !db.objectStoreNames.contains(
        "vault"
      )
    ) {

      db.createObjectStore(
        "vault",
        {
          keyPath: "id"
        }
      );
    }
  };


databaseRequest.onsuccess =
  (event) => {

    db = event.target.result;

    console.log(
      "Phantom Vault database ready."
    );
  };


databaseRequest.onerror =
  (event) => {

    console.error(
      "Database error:",
      event.target.error
    );
  };


/* =========================
   MOUSE TILT
========================= */

document.addEventListener(
  "mousemove",
  (event) => {

    if (
      UnlockScreen.classList.contains(
        "unlocked"
      )
    ) {

      return;
    }


    const centerX =
      window.innerWidth / 2;

    const centerY =
      window.innerHeight / 2;


    const deltaX =
      event.clientX - centerX;

    const deltaY =
      event.clientY - centerY;


    const rotateX =
      -deltaY / 40;

    const rotateY =
      deltaX / 40;


    UnlockScreen.style.transform =
      `perspective(1000px)
       rotateX(${rotateX}deg)
       rotateY(${rotateY}deg)`;
  }
);


/* =========================
   SALT
========================= */

function getOrCreateSalt() {

  let storedSalt =
    localStorage.getItem(
      "phantomVaultSalt"
    );


  if (!storedSalt) {

    const salt =
      crypto.getRandomValues(
        new Uint8Array(16)
      );


    storedSalt =
      arrayBufferToBase64(
        salt
      );


    localStorage.setItem(
      "phantomVaultSalt",
      storedSalt
    );
  }


  return base64ToArrayBuffer(
    storedSalt
  );
}


/* =========================
   DERIVE KEY
========================= */

async function deriveKey(
  password,
  salt
) {

  const encoder =
    new TextEncoder();


  const passwordData =
    encoder.encode(
      password
    );


  const baseKey =
    await crypto.subtle.importKey(
      "raw",
      passwordData,
      "PBKDF2",
      false,
      ["deriveKey"]
    );


  return crypto.subtle.deriveKey(

    {
      name: "PBKDF2",

      salt: salt,

      iterations: 600000,

      hash: "SHA-256"
    },

    baseKey,

    {
      name: "AES-GCM",

      length: 256
    },

    false,

    [
      "encrypt",
      "decrypt"
    ]
  );
}


/* =========================
   CREATE VERIFICATION
========================= */

async function createVerification(
  key
) {

  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );


  const data =
    new TextEncoder().encode(
      "PHANTOM_VAULT_VERIFIED"
    );


  const encrypted =
    await crypto.subtle.encrypt(

      {
        name: "AES-GCM",

        iv: iv
      },

      key,

      data
    );


  return {

    iv:
      arrayBufferToBase64(
        iv
      ),

    data:
      arrayBufferToBase64(
        encrypted
      )
  };
}


/* =========================
   VERIFY PASSWORD
========================= */

async function verifyPassword(
  key
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          ["vault"],
          "readonly"
        );


      const store =
        transaction.objectStore(
          "vault"
        );


      const request =
        store.get(
          "verification"
        );


      request.onsuccess =
        async () => {

          const verification =
            request.result;


          /*
           * First ever setup.
           */

          if (!verification) {

            resolve(null);

            return;
          }


          try {

            const iv =
              base64ToArrayBuffer(
                verification.iv
              );


            const encrypted =
              base64ToArrayBuffer(
                verification.data
              );


            await crypto.subtle.decrypt(

              {
                name: "AES-GCM",

                iv: iv
              },

              key,

              encrypted
            );


            resolve(true);

          } catch {

            resolve(false);
          }
        };


      request.onerror =
        () => {

          reject(
            request.error
          );
        };
    }
  );
}


/* =========================
   SAVE VERIFICATION
========================= */

async function saveVerification(
  key
) {

  const verification =
    await createVerification(
      key
    );


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          ["vault"],
          "readwrite"
        );


      const store =
        transaction.objectStore(
          "vault"
        );


      const request =
        store.put({

          id: "verification",

          iv:
            verification.iv,

          data:
            verification.data
        });


      request.onsuccess =
        resolve;


      request.onerror =
        () => {

          reject(
            request.error
          );
        };
    }
  );
}


/* =========================
   UNLOCK
========================= */

accessButton.addEventListener(
  "click",
  async () => {

    const password =
      passkey.value;


    if (!password) {

      passkey.focus();

      return;
    }


    try {

      accessButton.disabled =
        true;

      accessButton.textContent =
        "Checking...";


      const salt =
        getOrCreateSalt();


      const key =
        await deriveKey(
          password,
          salt
        );


      const verification =
        await verifyPassword(
          key
        );


      /*
       * FIRST TIME
       */

      if (
        verification === null
      ) {

        await saveVerification(
          key
        );

        encryptionKey =
          key;

      }


      /*
       * CORRECT PASSWORD
       */

      else if (
        verification === true
      ) {

        encryptionKey =
          key;

      }


      /*
       * WRONG PASSWORD
       */

      else {

        encryptionKey =
          null;

        alert(
          "Incorrect passkey."
        );

        return;
      }


      UnlockScreen.classList.add(
        "unlocked"
      );


      vaultScreen.classList.add(
        "active"
      );


      loadFiles();

    } catch (error) {

      console.error(
        "Unlock error:",
        error
      );


      alert(
        "Something went wrong unlocking the vault."
      );

    } finally {

      accessButton.disabled =
        false;

      accessButton.textContent =
        "Access Vault";
    }
  }
);


/* =========================
   ENTER KEY
========================= */

passkey.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter"
    ) {

      accessButton.click();
    }
  }
);


/* =========================
   LOCK
========================= */

lockButton.addEventListener(
  "click",
  () => {

    encryptionKey =
      null;


    vaultScreen.classList.remove(
      "active"
    );


    UnlockScreen.classList.remove(
      "unlocked"
    );


    UnlockScreen.style.transform =
      "";


    passkey.value =
      "";


    fileList.innerHTML =
      "";


    updateEmptyState();
  }
);


/* =========================
   FORGOT PASSWORD
========================= */

forgotPassword.addEventListener(
  "click",
  async () => {

    const confirmed =
      confirm(

        "RESET PHANTOM VAULT?\n\n" +

        "This will permanently delete ALL " +
        "encrypted files and reset the vault.\n\n" +

        "Your old passkey cannot be recovered.\n\n" +

        "This action cannot be undone."

      );


    if (!confirmed) {

      return;
    }


    const confirmation =
      prompt(
        'Type "DELETE" to permanently reset the vault:'
      );


    if (
      confirmation !== "DELETE"
    ) {

      alert(
        "Vault reset cancelled."
      );

      return;
    }


    try {

      encryptionKey =
        null;


      /*
       * Close the current DB connection
       * before deleting it.
       */

      if (db) {

        db.close();

        db = null;
      }


      await new Promise(
        (resolve, reject) => {

          const request =
            indexedDB.deleteDatabase(
              "PhantomVault"
            );


          request.onsuccess =
            resolve;


          request.onerror =
            () => {

              reject(
                request.error
              );
            };


          request.onblocked =
            () => {

              reject(
                new Error(
                  "Database deletion blocked."
                )
              );
            };
        }
      );


      /*
       * Delete encryption salt.
       */

      localStorage.removeItem(
        "phantomVaultSalt"
      );


      alert(
        "Phantom Vault has been reset."
      );


      /*
       * Reload.
       *
       * The database will be created
       * again when the page loads.
       */

      location.reload();

    } catch (error) {

      console.error(
        "Vault reset failed:",
        error
      );


      alert(
        "Could not reset the vault. " +
        "Close any other Phantom Vault tabs " +
        "and try again."
      );
    }
  }
);


/* =========================
   UPLOAD BUTTONS
========================= */

uploadButton.addEventListener(
  "click",
  () => {

    fileInput.click();
  }
);


emptyUploadButton.addEventListener(
  "click",
  () => {

    fileInput.click();
  }
);


/* =========================
   FILE INPUT
========================= */

fileInput.addEventListener(
  "change",
  async () => {

    const files =
      Array.from(
        fileInput.files
      );


    if (
      !files.length
    ) {

      return;
    }


    if (!encryptionKey) {

      alert(
        "Vault is locked."
      );

      return;
    }


    for (
      const file of files
    ) {

      try {

        await encryptAndSaveFile(
          file
        );

      } catch (error) {

        console.error(
          "Encryption failed:",
          error
        );


        alert(
          `Could not encrypt ${file.name}`
        );
      }
    }


    fileInput.value =
      "";


    updateEmptyState();
  }
);


/* =========================
   ENCRYPT FILE
========================= */

async function encryptAndSaveFile(
  file
) {

  const fileData =
    await file.arrayBuffer();


  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );


  const encryptedData =
    await crypto.subtle.encrypt(

      {
        name: "AES-GCM",

        iv: iv
      },

      encryptionKey,

      fileData
    );


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          ["files"],
          "readwrite"
        );


      const store =
        transaction.objectStore(
          "files"
        );


      const request =
        store.add({

          name:
            file.name,

          type:
            file.type,

          size:
            file.size,

          iv:
            arrayBufferToBase64(
              iv
            ),

          data:
            arrayBufferToBase64(
              encryptedData
            )
        });


      request.onsuccess =
        () => {

          addFileToUI({

            id:
              request.result,

            name:
              file.name,

            type:
              file.type,

            size:
              file.size
          });


          resolve();
        };


      request.onerror =
        () => {

          reject(
            request.error
          );
        };
    }
  );
}


/* =========================
   LOAD FILES
========================= */

function loadFiles() {

  if (!db) {

    return;
  }


  fileList.innerHTML =
    "";


  const transaction =
    db.transaction(
      ["files"],
      "readonly"
    );


  const store =
    transaction.objectStore(
      "files"
    );


  const request =
    store.getAll();


  request.onsuccess =
    () => {

      request.result.forEach(
        (file) => {

          addFileToUI(
            file
          );
        }
      );


      updateEmptyState();
    };
}


/* =========================
   FILE UI
========================= */

function addFileToUI(
  file
) {

  const fileItem =
    document.createElement(
      "div"
    );


  fileItem.classList.add(
    "file-item"
  );


  fileItem.innerHTML = `

    <span class="file-name">
      ${escapeHTML(file.name)}
    </span>

    <div class="file-actions">

      <button class="open-file">
        Open
      </button>

      <button class="delete-file">
        Delete
      </button>

    </div>
  `;


  fileList.appendChild(
    fileItem
  );


  const openButton =
    fileItem.querySelector(
      ".open-file"
    );


  const deleteButton =
    fileItem.querySelector(
      ".delete-file"
    );


  /* =========================
     OPEN
  ========================== */

  openButton.addEventListener(
    "click",
    async () => {

      try {

        openButton.disabled =
          true;

        openButton.textContent =
          "Decrypting...";


        const stored =
          await getFile(
            file.id
          );


        const iv =
          base64ToArrayBuffer(
            stored.iv
          );


        const encrypted =
          base64ToArrayBuffer(
            stored.data
          );


        const decrypted =
          await crypto.subtle.decrypt(

            {
              name: "AES-GCM",

              iv: iv
            },

            encryptionKey,

            encrypted
          );


        const blob =
          new Blob(
            [decrypted],
            {
              type:
                stored.type ||
                "application/octet-stream"
            }
          );


        const url =
          URL.createObjectURL(
            blob
          );


        window.open(
          url,
          "_blank"
        );


        setTimeout(
          () => {

            URL.revokeObjectURL(
              url
            );

          },
          60000
        );

      } catch (error) {

        console.error(
          "Decryption failed:",
          error
        );


        alert(
          "Could not decrypt this file."
        );

      } finally {

        openButton.disabled =
          false;

        openButton.textContent =
          "Open";
      }
    }
  );


  /* =========================
     DELETE
  ========================== */

  deleteButton.addEventListener(
    "click",
    async () => {

      const confirmed =
        confirm(
          `Delete "${file.name}"?`
        );


      if (!confirmed) {

        return;
      }


      try {

        await deleteFile(
          file.id,
          fileItem
        );

      } catch (error) {

        console.error(
          "Delete failed:",
          error
        );

        alert(
          "Could not delete the file."
        );
      }
    }
  );
}


/* =========================
   GET FILE
========================= */

function getFile(
  id
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          ["files"],
          "readonly"
        );


      const store =
        transaction.objectStore(
          "files"
        );


      const request =
        store.get(id);


      request.onsuccess =
        () => {

          resolve(
            request.result
          );
        };


      request.onerror =
        () => {

          reject(
            request.error
          );
        };
    }
  );
}


/* =========================
   DELETE FILE
========================= */

function deleteFile(
  id,
  element
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          ["files"],
          "readwrite"
        );


      const store =
        transaction.objectStore(
          "files"
        );


      const request =
        store.delete(
          id
        );


      request.onsuccess =
        () => {

          element.remove();

          updateEmptyState();

          resolve();
        };


      request.onerror =
        () => {

          reject(
            request.error
          );
        };
    }
  );
}


/* =========================
   EMPTY STATE
========================= */

function updateEmptyState() {

  if (
    fileList.children.length === 0
  ) {

    emptyVault.style.display =
      "flex";

  } else {

    emptyVault.style.display =
      "none";
  }
}


/* =========================
   BASE64
========================= */

function arrayBufferToBase64(
  buffer
) {

  const bytes =
    new Uint8Array(
      buffer
    );


  let binary =
    "";


  for (
    let i = 0;
    i < bytes.length;
    i++
  ) {

    binary +=
      String.fromCharCode(
        bytes[i]
      );
  }


  return btoa(
    binary
  );
}


function base64ToArrayBuffer(
  base64
) {

  const binary =
    atob(
      base64
    );


  const bytes =
    new Uint8Array(
      binary.length
    );


  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    bytes[i] =
      binary.charCodeAt(
        i
      );
  }


  return bytes.buffer;
}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(
  text
) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    text;


  return div.innerHTML;
}