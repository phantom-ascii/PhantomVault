# Phantom Vault

A small local file vault built with HTML, CSS and JavaScript.

Phantom Vault lets you store files in your browser and encrypts them before they're saved. The idea was pretty simple: I wanted to learn how browser storage and encryption actually work, so I built my own little vault instead of using another storage service.

> This is a learning project, not a replacement for a professional password manager.

## What it does

- 🔐 Passkey protected vault
- 🔒 AES-GCM encrypted files
- 📁 Upload multiple files
- 👀 Open/decrypt files from the vault
- 🗑️ Delete files
- 🔒 Lock the vault
- ♻️ Reset the vault if you forget your passkey
- 💾 Stores everything locally in the browser
- 🖱️ Small mouse movement effect on the unlock screen

## How it works

Phantom Vault doesn't store your passkey directly.

When you enter your passkey, it is run through PBKDF2 to derive an AES-256 encryption key.

Files are then encrypted with AES-GCM before being stored in IndexedDB.

The basic flow is:

```text
Passkey
   ↓
PBKDF2
   ↓
AES-256 key
   ↓
AES-GCM
   ↓
Encrypted file
   ↓
IndexedDB
