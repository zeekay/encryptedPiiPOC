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
import type { EncryptedField } from "./schema.js";
export type { EncryptedField } from "./schema.js";
export { piiField, isEncryptedField } from "./schema.js";
type AnyCtx = any;
type AnyComponent = any;
/**
 * Helper class for encrypting/decrypting PII for a specific user.
 * Returned by `encryptedPii.forUser()`.
 *
 * All operations happen in user space (no isolate boundary crossing)
 * after the initial key fetch.
 */
export declare class UserPII {
    private kek;
    constructor(kek: string);
    /**
     * Encrypt a plaintext value.
     * Returns an EncryptedField object to store in your document.
     *
     * @param plaintext - The sensitive data to encrypt
     * @returns EncryptedField object to store in your document
     */
    encrypt(plaintext: string): Promise<EncryptedField>;
    /**
     * Decrypt an encrypted field.
     *
     * @param field - The EncryptedField from your document
     * @returns The decrypted plaintext, or null if field is null/undefined
     */
    decrypt(field: EncryptedField | null | undefined): Promise<string | null>;
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
    decryptMany<T extends Record<string, EncryptedField | null | undefined>>(fields: T): Promise<{
        [K in keyof T]: string | null;
    }>;
}
/**
 * Client for the Encrypted PII component.
 * Instantiate once and use throughout your Convex functions.
 */
export declare class EncryptedPII {
    private component;
    constructor(component: AnyComponent);
    /**
     * Get a PII helper for a specific user.
     * This fetches the user's encryption key once, then all subsequent
     * encrypt/decrypt operations happen locally (no isolate boundary crossing).
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
    forUser(ctx: AnyCtx, ownerId: string): Promise<UserPII>;
    /**
     * @deprecated Use `forUser()` instead for better performance.
     * Store an encrypted value in the component's tables.
     */
    store(ctx: AnyCtx, ownerId: string, value: string): Promise<string>;
    /**
     * @deprecated Use `forUser()` instead for better performance.
     * Retrieve and decrypt a value from the component's tables.
     */
    get(ctx: AnyCtx, ownerId: string, ref: string): Promise<string | null>;
    /**
     * @deprecated Use `forUser()` instead for better performance.
     * Retrieve and decrypt multiple values from the component's tables.
     */
    getBatch(ctx: AnyCtx, items: Array<{
        ownerId: string;
        ref: string;
    }>): Promise<Array<{
        ref: string;
        value: string | null;
    }>>;
    /**
     * Delete an encrypted value from the component's tables.
     */
    delete(ctx: AnyCtx, ownerId: string, ref: string): Promise<boolean>;
    /**
     * Delete ALL encrypted data for a user (GDPR compliance).
     * This deletes data from the component's tables AND the user's KEK.
     */
    deleteAllUserData(ctx: AnyCtx, ownerId: string): Promise<number>;
    /**
     * Check if a reference exists in the component's tables.
     */
    exists(ctx: AnyCtx, ownerId: string, ref: string): Promise<boolean>;
    /**
     * List all encrypted field references for a user in the component's tables.
     */
    listRefs(ctx: AnyCtx, ownerId: string): Promise<Array<{
        ref: string;
        createdAt: number;
    }>>;
    /**
     * Get raw encrypted data for debugging/demo purposes.
     */
    getRawEncryptedData(ctx: AnyCtx, ownerId: string, ref: string): Promise<{
        ref: string;
        ownerId: string;
        ciphertext: string;
        encryptedDek: string;
        iv: string;
        algorithm: string;
        version: number;
        createdAt: number;
    } | null>;
}
//# sourceMappingURL=client.d.ts.map