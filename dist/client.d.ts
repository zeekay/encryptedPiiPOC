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
/**
 * Reference to an encrypted PII field.
 * This is an opaque string that should be stored in your documents.
 */
export type EncryptedFieldRef = string & {
    __brand: "EncryptedFieldRef";
};
type AnyCtx = any;
type AnyComponent = any;
/**
 * Client for the Encrypted PII component.
 * Instantiate once and use throughout your Convex functions.
 */
export declare class EncryptedPII {
    private component;
    constructor(component: AnyComponent);
    /**
     * Store an encrypted value.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user who owns this data (typically ctx.auth user ID)
     * @param value - The plaintext value to encrypt
     * @returns A reference ID to store in your document
     */
    store(ctx: AnyCtx, ownerId: string, value: string): Promise<EncryptedFieldRef>;
    /**
     * Retrieve and decrypt a value.
     *
     * @param ctx - Convex mutation context (mutation required for key operations)
     * @param ownerId - The user attempting to decrypt (must match the original owner)
     * @param ref - The reference ID returned by store()
     * @returns The decrypted value, or null if not found/unauthorized
     */
    get(ctx: AnyCtx, ownerId: string, ref: EncryptedFieldRef | string): Promise<string | null>;
    /**
     * Delete an encrypted value.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user attempting to delete (must match the original owner)
     * @param ref - The reference ID to delete
     * @returns true if deleted, false if not found/unauthorized
     */
    delete(ctx: AnyCtx, ownerId: string, ref: EncryptedFieldRef | string): Promise<boolean>;
    /**
     * Delete ALL encrypted data for a user.
     * Use for GDPR "right to be forgotten" compliance.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user whose data should be deleted
     * @returns Number of fields deleted
     */
    deleteAllUserData(ctx: AnyCtx, ownerId: string): Promise<number>;
    /**
     * Check if a reference exists and belongs to a user.
     * This is a query (no decryption performed).
     *
     * @param ctx - Convex query context
     * @param ownerId - The user to check ownership for
     * @param ref - The reference ID to check
     * @returns true if exists and owned by user
     */
    exists(ctx: AnyCtx, ownerId: string, ref: EncryptedFieldRef | string): Promise<boolean>;
    /**
     * List all encrypted field references for a user.
     * Does NOT decrypt the values.
     *
     * @param ctx - Convex query context
     * @param ownerId - The user whose refs to list
     * @returns Array of refs with creation timestamps
     */
    listRefs(ctx: AnyCtx, ownerId: string): Promise<Array<{
        ref: EncryptedFieldRef;
        createdAt: number;
    }>>;
    /**
     * Get the raw encrypted data for a field (for debugging/demo purposes).
     * Shows what's actually stored - ciphertext, IV, encrypted DEK.
     * Does NOT decrypt anything.
     *
     * @param ctx - Convex query context
     * @param ownerId - The user who owns the data
     * @param ref - The reference ID
     * @returns Raw encrypted data or null if not found
     */
    getRawEncryptedData(ctx: AnyCtx, ownerId: string, ref: EncryptedFieldRef | string): Promise<{
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
export type { EncryptedFieldRef as PIIRef };
//# sourceMappingURL=client.d.ts.map