/**
 * Encrypted PII Client
 *
 * Provides type-safe encrypted PII field storage for Convex.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { EncryptedPII } from "@convex-dev/encrypted-pii";
 * import { components } from "./_generated/api";
 *
 * const encryptedPii = new EncryptedPII(components.encryptedPii);
 *
 * // In your mutation:
 * export const storeUserPII = mutation({
 *   args: { userId: v.id("users"), ssn: v.string() },
 *   handler: async (ctx, args) => {
 *     const pii = await encryptedPii.forUser(ctx, args.userId);
 *
 *     await ctx.db.patch(args.userId, {
 *       ssn: await pii.encrypt(args.ssn),
 *     });
 *   },
 * });
 *
 * // Reading:
 * export const getUserPII = mutation({
 *   args: { userId: v.id("users") },
 *   handler: async (ctx, args) => {
 *     const pii = await encryptedPii.forUser(ctx, args.userId);
 *     const user = await ctx.db.get(args.userId);
 *
 *     return {
 *       ssn: await pii.decrypt(user.ssn),
 *     };
 *   },
 * });
 * ```
 */
import { generateKey, generateIV, encrypt, decrypt, wrapKey, unwrapKey, } from "./crypto.js";
export { piiField, isEncryptedField } from "./schema.js";
/**
 * Helper class for encrypting/decrypting PII for a specific user.
 * Returned by `encryptedPii.forUser()`.
 *
 * All operations happen in user space (no isolate boundary crossing)
 * after the initial key fetch.
 */
export class UserPII {
    constructor(kek) {
        this.kek = kek;
    }
    /**
     * Encrypt a plaintext value.
     * Returns an EncryptedField object to store in your document.
     *
     * @param plaintext - The sensitive data to encrypt
     * @returns EncryptedField object to store in your document
     */
    async encrypt(plaintext) {
        // Generate a new DEK for this field
        const dek = generateKey();
        const dekIv = generateIV();
        // Encrypt the plaintext with the DEK
        const valueIv = generateIV();
        const ciphertext = await encrypt(plaintext, dek, valueIv);
        // Wrap (encrypt) the DEK with the user's KEK
        const encryptedDek = await wrapKey(dek, this.kek, dekIv);
        return {
            __encrypted: true,
            v: 1,
            c: ciphertext,
            i: valueIv,
            k: `${encryptedDek}:${dekIv}`, // Store DEK IV alongside encrypted DEK
        };
    }
    /**
     * Decrypt an encrypted field.
     *
     * @param field - The EncryptedField from your document
     * @returns The decrypted plaintext, or null if field is null/undefined
     */
    async decrypt(field) {
        if (!field) {
            return null;
        }
        if (!field.__encrypted) {
            throw new Error("Invalid encrypted field: missing __encrypted marker");
        }
        // Parse the encrypted DEK and its IV
        const [encryptedDek, dekIv] = field.k.split(":");
        if (!encryptedDek || !dekIv) {
            throw new Error("Invalid encrypted field: malformed key data");
        }
        // Unwrap the DEK
        const dek = await unwrapKey(encryptedDek, this.kek, dekIv);
        // Decrypt the ciphertext
        const plaintext = await decrypt(field.c, dek, field.i);
        return plaintext;
    }
    /**
     * Decrypt multiple fields at once.
     *
     * @param fields - Object with encrypted fields
     * @returns Object with decrypted values (same keys)
     *
     * @example
     * ```typescript
     * const { ssn, creditCard } = await pii.decryptMany({
     *   ssn: user.ssn,
     *   creditCard: user.creditCard,
     * });
     * ```
     */
    async decryptMany(fields) {
        const result = {};
        for (const key of Object.keys(fields)) {
            result[key] = await this.decrypt(fields[key]);
        }
        return result;
    }
}
/**
 * Client for the Encrypted PII component.
 * Instantiate once and use throughout your Convex functions.
 */
export class EncryptedPII {
    constructor(component) {
        this.component = component;
    }
    /**
     * Get a PII helper for a specific user (for mutations).
     * This fetches the user's encryption key once, then all subsequent
     * encrypt/decrypt operations happen locally (no isolate boundary crossing).
     *
     * Creates the user's encryption key if it doesn't exist yet.
     * Use this in mutations when you need to encrypt OR decrypt.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user who owns this data (typically user ID from auth)
     * @returns UserPII helper with encrypt() and decrypt() methods
     *
     * @example
     * ```typescript
     * const pii = await encryptedPii.forUser(ctx, userId);
     *
     * // Encrypt and store
     * await ctx.db.patch(userId, {
     *   ssn: await pii.encrypt("123-45-6789"),
     * });
     *
     * // Read and decrypt
     * const user = await ctx.db.get(userId);
     * const ssn = await pii.decrypt(user.ssn);
     * ```
     */
    async forUser(ctx, ownerId) {
        const kek = await ctx.runMutation(this.component.public.getUserKey, { ownerId });
        return new UserPII(kek);
    }
    /**
     * Get a PII helper for a specific user (for queries - read-only).
     * Use this in queries when you only need to decrypt existing data.
     *
     * Returns null if the user has no encryption key yet (no encrypted data).
     * The user's key must have been created by a prior forUser() call in a mutation.
     *
     * @param ctx - Convex query context
     * @param ownerId - The user who owns this data
     * @returns UserPII helper with decrypt() methods, or null if user has no key
     *
     * @example
     * ```typescript
     * export const getSSN = query({
     *   args: { userId: v.id("users") },
     *   handler: async (ctx, args) => {
     *     const pii = await encryptedPii.forUserQuery(ctx, args.userId);
     *     if (!pii) return null; // User has no encrypted data yet
     *
     *     const user = await ctx.db.get(args.userId);
     *     return { ssn: await pii.decrypt(user?.ssn) };
     *   },
     * });
     * ```
     */
    async forUserQuery(ctx, ownerId) {
        const kek = await ctx.runQuery(this.component.public.getUserKeyQuery, { ownerId });
        if (!kek) {
            return null;
        }
        return new UserPII(kek);
    }
    // ============================================================
    // Legacy API (stores data in component's tables)
    // Consider using forUser() for better performance
    // ============================================================
    /**
     * @deprecated Use `forUser()` instead for better performance.
     * Store an encrypted value in the component's tables.
     */
    async store(ctx, ownerId, value) {
        return ctx.runMutation(this.component.public.store, { ownerId, value });
    }
    /**
     * @deprecated Use `forUser()` instead for better performance.
     * Retrieve and decrypt a value from the component's tables.
     */
    async get(ctx, ownerId, ref) {
        return ctx.runMutation(this.component.public.get, { ownerId, ref });
    }
    /**
     * @deprecated Use `forUser()` instead for better performance.
     * Retrieve and decrypt multiple values from the component's tables.
     */
    async getBatch(ctx, items) {
        return ctx.runMutation(this.component.public.getBatch, { items });
    }
    /**
     * Delete an encrypted value from the component's tables.
     */
    async delete(ctx, ownerId, ref) {
        return ctx.runMutation(this.component.public.deleteField, { ownerId, ref });
    }
    /**
     * Delete ALL encrypted data for a user (GDPR compliance).
     * This deletes data from the component's tables AND the user's KEK.
     */
    async deleteAllUserData(ctx, ownerId) {
        return ctx.runMutation(this.component.public.deleteAllUserData, { ownerId });
    }
    /**
     * Check if a reference exists in the component's tables.
     */
    async exists(ctx, ownerId, ref) {
        return ctx.runQuery(this.component.public.exists, { ownerId, ref });
    }
    /**
     * List all encrypted field references for a user in the component's tables.
     */
    async listRefs(ctx, ownerId) {
        return ctx.runQuery(this.component.public.listRefs, { ownerId });
    }
    /**
     * Get raw encrypted data for debugging/demo purposes.
     */
    async getRawEncryptedData(ctx, ownerId, ref) {
        return ctx.runQuery(this.component.public.getRawEncryptedData, { ownerId, ref });
    }
}
