/**
 * Wrapped database interface that automatically encrypts/decrypts PII fields.
 *
 * Use this to avoid manual encrypt()/decrypt() calls.
 * The schema's piiField() validators are the source of truth.
 *
 * @example
 * ```typescript
 * import schema from "./schema";
 *
 * const db = await encryptedPii.wrapDb(ctx, userId, schema);
 *
 * // Auto-encrypts on write (knows ssn is piiField from schema)
 * await db.patch(userId, { ssn: "123-45-6789" });
 *
 * // Auto-decrypts on read (detects __encrypted marker)
 * const user = await db.get(userId);  // user.ssn is a string!
 * ```
 */
import type { UserPII } from "./client.js";
import { type EncryptedField } from "./schema.js";
type AnyCtx = any;
type AnyDb = any;
type AnyDoc = any;
/**
 * Utility type that transforms EncryptedField properties to strings.
 * Use this for better TypeScript support with wrapped db results.
 *
 * @example
 * ```typescript
 * import type { Doc } from "./_generated/dataModel";
 * import type { Decrypted } from "@convex-dev/encrypted-pii";
 *
 * type DecryptedUser = Decrypted<Doc<"users">>;
 * // Now DecryptedUser.ssn is string instead of EncryptedField
 * ```
 */
export type Decrypted<T> = {
    [K in keyof T]: T[K] extends EncryptedField ? string : T[K] extends EncryptedField | null | undefined ? string | null : T[K];
};
/**
 * Wrapped query builder that automatically decrypts PII fields.
 */
declare class WrappedQueryBuilder {
    private builder;
    private pii;
    constructor(builder: AnyDb, pii: UserPII);
    /**
     * Collect all results and decrypt PII fields.
     */
    collect(): Promise<AnyDoc[]>;
    /**
     * Get the first result and decrypt PII fields.
     */
    first(): Promise<AnyDoc | null>;
    /**
     * Get the unique result and decrypt PII fields.
     */
    unique(): Promise<AnyDoc | null>;
    /**
     * Use an index for the query.
     */
    withIndex(indexName: string, indexRange?: any): WrappedQueryBuilder;
    /**
     * Filter results.
     */
    filter(predicate: any): WrappedQueryBuilder;
    /**
     * Order results.
     */
    order(order: "asc" | "desc"): WrappedQueryBuilder;
    /**
     * Limit results.
     */
    take(n: number): WrappedQueryBuilder;
    private decryptDoc;
}
/**
 * Wrapped database interface that automatically encrypts/decrypts PII fields.
 *
 * Created via `encryptedPii.wrapDb()` or `encryptedPii.wrapDbQuery()`.
 */
export declare class WrappedDb {
    private db;
    private pii;
    private piiFieldsByTable;
    private allPiiFields;
    constructor(ctx: AnyCtx, pii: UserPII, schema: AnyDoc);
    /**
     * Patch a document, automatically encrypting PII fields.
     *
     * @param id - Document ID to patch
     * @param updates - Fields to update (PII fields will be encrypted)
     */
    patch(id: any, updates: AnyDoc): Promise<void>;
    /**
     * Insert a document, automatically encrypting PII fields.
     *
     * @param table - Table name
     * @param doc - Document to insert (PII fields will be encrypted)
     * @returns The inserted document's ID
     */
    insert(table: string, doc: AnyDoc): Promise<any>;
    /**
     * Replace a document, automatically encrypting PII fields.
     *
     * @param id - Document ID to replace
     * @param doc - New document content (PII fields will be encrypted)
     */
    replace(id: any, doc: AnyDoc): Promise<void>;
    /**
     * Delete a document.
     *
     * @param id - Document ID to delete
     */
    delete(id: any): Promise<void>;
    /**
     * Get a document by ID, automatically decrypting PII fields.
     *
     * @param id - Document ID
     * @returns The document with PII fields decrypted, or null if not found
     */
    get(id: any): Promise<AnyDoc | null>;
    /**
     * Start a query on a table. Results will have PII fields decrypted.
     *
     * @param table - Table name
     * @returns A wrapped query builder
     */
    query(table: string): WrappedQueryBuilder;
    private encryptFields;
    private decryptDoc;
}
export {};
//# sourceMappingURL=wrappedDb.d.ts.map