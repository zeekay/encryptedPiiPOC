/**
 * Cryptographic utilities for the encrypted PII component.
 *
 * Uses AES-256-GCM for all encryption operations.
 * Key hierarchy:
 *   Master Key (MK) -> encrypts -> User KEKs
 *   User KEK -> encrypts -> Field DEKs
 *   Field DEK -> encrypts -> Field Value
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM

/**
 * Generate a random 256-bit key as base64 string.
 * Must be called from an action context.
 */
export function generateKey(): string {
  const key = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(key);
  return base64Encode(key);
}

/**
 * Generate a random IV for AES-GCM.
 */
export function generateIV(): string {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return base64Encode(iv);
}

/**
 * Generate a unique reference ID with prefix.
 */
export function generateRef(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `epii_${base64UrlEncode(bytes)}`;
}

/**
 * Encrypt data with a key.
 * Returns base64-encoded ciphertext.
 */
export async function encrypt(
  plaintext: string,
  keyBase64: string,
  ivBase64: string
): Promise<string> {
  const key = await importKey(base64Decode(keyBase64));
  const iv = base64Decode(ivBase64);
  const data = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  return base64Encode(new Uint8Array(ciphertext));
}

/**
 * Decrypt data with a key.
 * Returns plaintext string.
 */
export async function decrypt(
  ciphertextBase64: string,
  keyBase64: string,
  ivBase64: string
): Promise<string> {
  const key = await importKey(base64Decode(keyBase64));
  const iv = base64Decode(ivBase64);
  const ciphertext = base64Decode(ciphertextBase64);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Wrap (encrypt) a key with another key.
 * Used to encrypt DEKs with KEKs, and KEKs with master key.
 */
export async function wrapKey(
  keyToWrap: string,
  wrappingKeyBase64: string,
  ivBase64: string
): Promise<string> {
  // We encrypt the key bytes directly using AES-GCM
  // (crypto.subtle.wrapKey requires a CryptoKey which we don't persist)
  return encrypt(keyToWrap, wrappingKeyBase64, ivBase64);
}

/**
 * Unwrap (decrypt) a wrapped key.
 */
export async function unwrapKey(
  wrappedKey: string,
  wrappingKeyBase64: string,
  ivBase64: string
): Promise<string> {
  return decrypt(wrappedKey, wrappingKeyBase64, ivBase64);
}

/**
 * Import a raw key for use with Web Crypto.
 */
async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// Base64 encoding/decoding utilities

export function base64Encode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

export function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(data: Uint8Array): string {
  return base64Encode(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
