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
import { WrappedDb } from "./wrappedDb.js";
export type { EncryptedField } from "./schema.js";
export { piiField, isEncryptedField, extractPiiFields, DEV_MODE_MARKER } from "./schema.js";
export { WrappedDb, type Decrypted, type WrappedDbOptions } from "./wrappedDb.js";
/**
 * Options for the EncryptedPII client.
 */
export interface EncryptedPIIOptions {
    /**
     * Whether to encrypt PII fields. Default: true.
     * Set to false in dev environments to store plaintext for easier debugging.
     * Data will still use the EncryptedField shape, but with plaintext in the `c` field.
     *
     * Safety: If disabled, wrapDb() will check that no real user keys exist
     * in the database to prevent accidentally writing plaintext to prod.
     */
    encryptionEnabled?: boolean;
}
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
    private encryptionEnabled;
    constructor(component: AnyComponent, options?: EncryptedPIIOptions);
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
    forUser(ctx: AnyCtx, ownerId: string): Promise<UserPII>;
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
    forUserQuery(ctx: AnyCtx, ownerId: string): Promise<UserPII | null>;
    /**
     * Get a wrapped database that automatically encrypts/decrypts PII fields.
     * Use this in mutations for seamless PII handling.
     *
     * The schema's piiField() validators are the source of truth for which
     * fields to encrypt. On reads, encrypted fields are detected by their
     * __encrypted marker and automatically decrypted.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user who owns this data (typically user ID from auth)
     * @param schema - Your Convex schema (import from "./schema")
     * @returns WrappedDb with auto-encrypting writes and auto-decrypting reads
     *
     * @example
     * ```typescript
     * import schema from "./schema";
     *
     * const db = await encryptedPii.wrapDb(ctx, userId, schema);
     *
     * // Auto-encrypts on write (knows ssn is piiField from schema)
     * await db.patch(userId, { ssn: "123-45-6789" });
     * await db.insert("users", { name: "John", ssn: "123-45-6789" });
     *
     * // Auto-decrypts on read (detects __encrypted marker)
     * const user = await db.get(userId);  // user.ssn is a string!
     * const users = await db.query("users").collect();  // all decrypted
     * ```
     */
    wrapDb(ctx: AnyCtx, ownerId: string, schema: any): Promise<WrappedDb>;
    /**
     * Get a wrapped database for queries (read-only).
     * Use this in queries when you only need to decrypt existing data.
     *
     * Returns null if the user has no encryption key yet (no encrypted data).
     * The user's key must have been created by a prior forUser() or wrapDb() call.
     *
     * @param ctx - Convex query context
     * @param ownerId - The user who owns this data
     * @param schema - Your Convex schema (import from "./schema")
     * @returns WrappedDb with auto-decrypting reads, or null if user has no key
     *
     * @example
     * ```typescript
     * import schema from "./schema";
     *
     * export const getUser = query({
     *   args: { userId: v.id("users") },
     *   handler: async (ctx, args) => {
     *     const db = await encryptedPii.wrapDbQuery(ctx, args.userId, schema);
     *     if (!db) return null;
     *
     *     return await db.get(args.userId);  // SSN auto-decrypted
     *   },
     * });
     * ```
     */
    wrapDbQuery(ctx: AnyCtx, ownerId: string, schema: any): Promise<WrappedDb | null>;
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