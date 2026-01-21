/**
 * Cryptographic utilities for encrypted PII.
 * These run in user space for better performance (no isolate boundary crossing).
 */
// Generate a random 256-bit key as base64
export function generateKey() {
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    return btoa(String.fromCharCode(...key));
}
// Generate a random 96-bit IV as base64 (standard for AES-GCM)
export function generateIV() {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    return btoa(String.fromCharCode(...iv));
}
// Base64 to Uint8Array
function b64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
// Uint8Array to Base64
function bytesToB64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}
// Import a base64 key for AES-GCM encryption
async function importKey(keyB64) {
    const keyBytes = b64ToBytes(keyB64);
    return crypto.subtle.importKey("raw", keyBytes.buffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
// Encrypt plaintext with AES-256-GCM
export async function encrypt(plaintext, keyB64, ivB64) {
    const key = await importKey(keyB64);
    const iv = b64ToBytes(ivB64);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer }, key, data.buffer);
    return bytesToB64(new Uint8Array(ciphertext));
}
// Decrypt ciphertext with AES-256-GCM
export async function decrypt(ciphertextB64, keyB64, ivB64) {
    const key = await importKey(keyB64);
    const iv = b64ToBytes(ivB64);
    const ciphertext = b64ToBytes(ciphertextB64);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer }, key, ciphertext.buffer);
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
}
// Wrap (encrypt) a DEK with a KEK
export async function wrapKey(dekB64, kekB64, ivB64) {
    return encrypt(dekB64, kekB64, ivB64);
}
// Unwrap (decrypt) a DEK with a KEK
export async function unwrapKey(wrappedDekB64, kekB64, ivB64) {
    return decrypt(wrappedDekB64, kekB64, ivB64);
}
