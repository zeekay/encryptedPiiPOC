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
 * Client for the Encrypted PII component.
 * Instantiate once and use throughout your Convex functions.
 */
export class EncryptedPII {
    constructor(component) {
        this.component = component;
    }
    /**
     * Store an encrypted value.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user who owns this data (typically ctx.auth user ID)
     * @param value - The plaintext value to encrypt
     * @returns A reference ID to store in your document
     */
    async store(ctx, ownerId, value) {
        const ref = await ctx.runMutation(this.component.public.store, { ownerId, value });
        return ref;
    }
    /**
     * Retrieve and decrypt a value.
     *
     * @param ctx - Convex mutation context (mutation required for key operations)
     * @param ownerId - The user attempting to decrypt (must match the original owner)
     * @param ref - The reference ID returned by store()
     * @returns The decrypted value, or null if not found/unauthorized
     */
    async get(ctx, ownerId, ref) {
        return ctx.runMutation(this.component.public.get, { ownerId, ref });
    }
    /**
     * Retrieve and decrypt multiple values in a single call.
     * Much faster than calling get() multiple times.
     *
     * @param ctx - Convex mutation context
     * @param items - Array of { ownerId, ref } to decrypt
     * @returns Array of { ref, value } in the same order as input
     *
     * @example
     * ```typescript
     * const results = await encryptedPii.getBatch(ctx, [
     *   { ownerId: user1Id, ref: user1SsnRef },
     *   { ownerId: user1Id, ref: user1CcRef },
     *   { ownerId: user2Id, ref: user2SsnRef },
     * ]);
     * // results[0].value = user1's SSN
     * // results[1].value = user1's credit card
     * // results[2].value = user2's SSN
     * ```
     */
    async getBatch(ctx, items) {
        return ctx.runMutation(this.component.public.getBatch, { items });
    }
    /**
     * Delete an encrypted value.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user attempting to delete (must match the original owner)
     * @param ref - The reference ID to delete
     * @returns true if deleted, false if not found/unauthorized
     */
    async delete(ctx, ownerId, ref) {
        return ctx.runMutation(this.component.public.deleteField, { ownerId, ref });
    }
    /**
     * Delete ALL encrypted data for a user.
     * Use for GDPR "right to be forgotten" compliance.
     *
     * @param ctx - Convex mutation context
     * @param ownerId - The user whose data should be deleted
     * @returns Number of fields deleted
     */
    async deleteAllUserData(ctx, ownerId) {
        return ctx.runMutation(this.component.public.deleteAllUserData, { ownerId });
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
    async exists(ctx, ownerId, ref) {
        return ctx.runQuery(this.component.public.exists, { ownerId, ref });
    }
    /**
     * List all encrypted field references for a user.
     * Does NOT decrypt the values.
     *
     * @param ctx - Convex query context
     * @param ownerId - The user whose refs to list
     * @returns Array of refs with creation timestamps
     */
    async listRefs(ctx, ownerId) {
        const results = await ctx.runQuery(this.component.public.listRefs, { ownerId });
        return results.map((r) => ({
            ref: r.ref,
            createdAt: r.createdAt,
        }));
    }
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
    async getRawEncryptedData(ctx, ownerId, ref) {
        return ctx.runQuery(this.component.public.getRawEncryptedData, { ownerId, ref });
    }
}
