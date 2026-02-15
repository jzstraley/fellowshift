// Encrypted localStorage utility using Web Crypto API (AES-GCM)

const APP_SALT = 'FellowShift-v1-salt';
const SENSITIVE_KEYS = [
  'fellowship_scheduler_v1',
  'fellowship_lectures_v1',
  'fellowshift_cache',
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-GCM key from a user ID using PBKDF2.
 */
export async function deriveKey(userId) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(APP_SALT),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data and store in localStorage.
 */
export async function encryptAndStore(key, storageKey, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  const payload = JSON.stringify({
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
  });

  localStorage.setItem(storageKey, payload);
}

/**
 * Load from localStorage and decrypt. Returns null if missing or invalid.
 */
export async function loadAndDecrypt(key, storageKey) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const { iv, ct } = JSON.parse(raw);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      key,
      fromBase64(ct)
    );
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    // Data is corrupted, was stored unencrypted, or key changed — clear it
    localStorage.removeItem(storageKey);
    return null;
  }
}

/**
 * Remove all sensitive keys from localStorage.
 */
export function clearSensitiveStorage() {
  for (const key of SENSITIVE_KEYS) {
    localStorage.removeItem(key);
  }
}
