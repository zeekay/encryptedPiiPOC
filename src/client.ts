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

import {
  generateKey,
  generateIV,
  encrypt,
  decrypt,
  wrapKey,
  unwrapKey,
} from "./crypto.js";
import type { EncryptedField } from "./schema.js";

// Re-export types
export type { EncryptedField } from "./schema.js";
export { piiField, isEncryptedField } from "./schema.js";

// Use permissive types for cross-package compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = any;

/**
 * Helper class for encrypting/decrypting PII for a specific user.
 * Returned by `encryptedPii.forUser()`.
 *
 * All operations happen in user space (no isolate boundary crossing)
 * after the initial key fetch.
 */
export class UserPII {
  private kek: string;

  constructor(kek: string) {
    this.kek = kek;
  }

  /**
   * Encrypt a plaintext value.
   * Returns an EncryptedField object to store in your document.
   *
   * @param plaintext - The sensitive data to encrypt
   * @returns EncryptedField object to store in your document
   */
  async encrypt(plaintext: string): Promise<EncryptedField> {
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
  async decrypt(field: EncryptedField | null | undefined): Promise<string | null> {
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
  async decryptMany<T extends Record<string, EncryptedField | null | undefined>>(
    fields: T
  ): Promise<{ [K in keyof T]: string | null }> {
    const result = {} as { [K in keyof T]: string | null };

    for (const key of Object.keys(fields) as (keyof T)[]) {
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
  private component: AnyComponent;

  constructor(component: AnyComponent) {
    this.component = component;
  }

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
  async forUser(ctx: AnyCtx, ownerId: string): Promise<UserPII> {
    const kek = await ctx.runMutation(this.component.public.getUserKey, { ownerId });
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
  async store(ctx: AnyCtx, ownerId: string, value: string): Promise<string> {
    return ctx.runMutation(this.component.public.store, { ownerId, value });
  }

  /**
   * @deprecated Use `forUser()` instead for better performance.
   * Retrieve and decrypt a value from the component's tables.
   */
  async get(ctx: AnyCtx, ownerId: string, ref: string): Promise<string | null> {
    return ctx.runMutation(this.component.public.get, { ownerId, ref });
  }

  /**
   * @deprecated Use `forUser()` instead for better performance.
   * Retrieve and decrypt multiple values from the component's tables.
   */
  async getBatch(
    ctx: AnyCtx,
    items: Array<{ ownerId: string; ref: string }>
  ): Promise<Array<{ ref: string; value: string | null }>> {
    return ctx.runMutation(this.component.public.getBatch, { items });
  }

  /**
   * Delete an encrypted value from the component's tables.
   */
  async delete(ctx: AnyCtx, ownerId: string, ref: string): Promise<boolean> {
    return ctx.runMutation(this.component.public.deleteField, { ownerId, ref });
  }

  /**
   * Delete ALL encrypted data for a user (GDPR compliance).
   * This deletes data from the component's tables AND the user's KEK.
   */
  async deleteAllUserData(ctx: AnyCtx, ownerId: string): Promise<number> {
    return ctx.runMutation(this.component.public.deleteAllUserData, { ownerId });
  }

  /**
   * Check if a reference exists in the component's tables.
   */
  async exists(ctx: AnyCtx, ownerId: string, ref: string): Promise<boolean> {
    return ctx.runQuery(this.component.public.exists, { ownerId, ref });
  }

  /**
   * List all encrypted field references for a user in the component's tables.
   */
  async listRefs(ctx: AnyCtx, ownerId: string): Promise<Array<{ ref: string; createdAt: number }>> {
    return ctx.runQuery(this.component.public.listRefs, { ownerId });
  }

  /**
   * Get raw encrypted data for debugging/demo purposes.
   */
  async getRawEncryptedData(
    ctx: AnyCtx,
    ownerId: string,
    ref: string
  ): Promise<{
    ref: string;
    ownerId: string;
    ciphertext: string;
    encryptedDek: string;
    iv: string;
    algorithm: string;
    version: number;
    createdAt: number;
  } | null> {
    return ctx.runQuery(this.component.public.getRawEncryptedData, { ownerId, ref });
  }
}
