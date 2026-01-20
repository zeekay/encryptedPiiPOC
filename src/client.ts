/**
 * Encrypted PII Client
 *
 * Provides a storage-like interface for encrypted PII fields.
 * Use this in your Convex mutations/queries to store and retrieve
 * encrypted user data.
 *
 * Example usage:
 * ```typescript
 * import { EncryptedPII } from "@convex-dev/encrypted-pii";
 * import { components } from "./_generated/api";
 *
 * const encryptedPii = new EncryptedPII(components.encryptedPii);
 *
 * // In a mutation:
 * const ssnRef = await encryptedPii.store(ctx, userId, ssn);
 * // Store ssnRef in your document
 *
 * // Later, to retrieve:
 * const ssn = await encryptedPii.get(ctx, userId, ssnRef);
 * ```
 */

import type {
  GenericMutationCtx,
  GenericQueryCtx,
  GenericActionCtx,
} from "convex/server";

// Type for the component API - will be refined when generated types are available
type ComponentApi = {
  public: {
    store: any;
    get: any;
    deleteField: any;
    deleteAllUserData: any;
    exists: any;
    listRefs: any;
  };
};

/**
 * Reference to an encrypted PII field.
 * This is an opaque string that should be stored in your documents.
 */
export type EncryptedFieldRef = string & { __brand: "EncryptedFieldRef" };

/**
 * Client for the Encrypted PII component.
 * Instantiate once and use throughout your Convex functions.
 */
export class EncryptedPII {
  constructor(private component: ComponentApi) {}

  /**
   * Store an encrypted value.
   *
   * @param ctx - Convex mutation context
   * @param ownerId - The user who owns this data (typically ctx.auth user ID)
   * @param value - The plaintext value to encrypt
   * @returns A reference ID to store in your document
   *
   * @example
   * ```typescript
   * const ssnRef = await encryptedPii.store(ctx, userId, "123-45-6789");
   * await ctx.db.patch(userId, { ssnRef });
   * ```
   */
  async store(
    ctx: GenericMutationCtx<any>,
    ownerId: string,
    value: string
  ): Promise<EncryptedFieldRef> {
    const ref = await ctx.runMutation(this.component.public.store, {
      ownerId,
      value,
    });
    return ref as EncryptedFieldRef;
  }

  /**
   * Retrieve and decrypt a value.
   *
   * @param ctx - Convex mutation context (mutation required for key operations)
   * @param ownerId - The user attempting to decrypt (must match the original owner)
   * @param ref - The reference ID returned by store()
   * @returns The decrypted value, or null if not found/unauthorized
   *
   * @example
   * ```typescript
   * const ssn = await encryptedPii.get(ctx, userId, user.ssnRef);
   * if (ssn) {
   *   // Use the decrypted SSN
   * }
   * ```
   */
  async get(
    ctx: GenericMutationCtx<any>,
    ownerId: string,
    ref: EncryptedFieldRef | string
  ): Promise<string | null> {
    return ctx.runMutation(this.component.public.get, {
      ownerId,
      ref,
    });
  }

  /**
   * Delete an encrypted value.
   *
   * @param ctx - Convex mutation context
   * @param ownerId - The user attempting to delete (must match the original owner)
   * @param ref - The reference ID to delete
   * @returns true if deleted, false if not found/unauthorized
   */
  async delete(
    ctx: GenericMutationCtx<any>,
    ownerId: string,
    ref: EncryptedFieldRef | string
  ): Promise<boolean> {
    return ctx.runMutation(this.component.public.deleteField, {
      ownerId,
      ref,
    });
  }

  /**
   * Delete ALL encrypted data for a user.
   * Use for GDPR "right to be forgotten" compliance.
   *
   * @param ctx - Convex mutation context
   * @param ownerId - The user whose data should be deleted
   * @returns Number of fields deleted
   */
  async deleteAllUserData(
    ctx: GenericMutationCtx<any>,
    ownerId: string
  ): Promise<number> {
    return ctx.runMutation(this.component.public.deleteAllUserData, {
      ownerId,
    });
  }

  /**
   * Check if a reference exists and belongs to a user.
   * This is a query (no decryption performed).
   *
   * @param ctx - Convex query context
   * @param ownerId - The user to check ownership for
   * @param ref - The reference ID to check
   * @returns true if exists and owned by user
   */
  async exists(
    ctx: GenericQueryCtx<any>,
    ownerId: string,
    ref: EncryptedFieldRef | string
  ): Promise<boolean> {
    return ctx.runQuery(this.component.public.exists, {
      ownerId,
      ref,
    });
  }

  /**
   * List all encrypted field references for a user.
   * Does NOT decrypt the values.
   *
   * @param ctx - Convex query context
   * @param ownerId - The user whose refs to list
   * @returns Array of refs with creation timestamps
   */
  async listRefs(
    ctx: GenericQueryCtx<any>,
    ownerId: string
  ): Promise<Array<{ ref: EncryptedFieldRef; createdAt: number }>> {
    const results = await ctx.runQuery(this.component.public.listRefs, {
      ownerId,
    });
    return results.map((r: { ref: string; createdAt: number }) => ({
      ref: r.ref as EncryptedFieldRef,
      createdAt: r.createdAt,
    }));
  }
}

// Re-export the type for use in schemas
export type { EncryptedFieldRef as PIIRef };
