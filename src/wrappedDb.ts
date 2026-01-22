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
import { extractPiiFields, isEncryptedField, DEV_MODE_MARKER, type EncryptedField } from "./schema.js";

/**
 * Options for WrappedDb.
 */
export interface WrappedDbOptions {
  /** Whether encryption is enabled. When false, PII is stored as plaintext in dev mode format. */
  encryptionEnabled: boolean;
}

// Use permissive types for cross-package compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  [K in keyof T]: T[K] extends EncryptedField
    ? string
    : T[K] extends EncryptedField | null | undefined
      ? string | null
      : T[K];
};

/**
 * Wrapped query builder that automatically decrypts PII fields.
 */
class WrappedQueryBuilder {
  private builder: AnyDb;
  private pii: UserPII | null;
  private encryptionEnabled: boolean;

  constructor(builder: AnyDb, pii: UserPII | null, encryptionEnabled: boolean) {
    this.builder = builder;
    this.pii = pii;
    this.encryptionEnabled = encryptionEnabled;
  }

  /**
   * Collect all results and decrypt PII fields.
   */
  async collect(): Promise<AnyDoc[]> {
    const docs = await this.builder.collect();
    return Promise.all(docs.map((doc: AnyDoc) => this.decryptDoc(doc)));
  }

  /**
   * Get the first result and decrypt PII fields.
   */
  async first(): Promise<AnyDoc | null> {
    const doc = await this.builder.first();
    return doc ? this.decryptDoc(doc) : null;
  }

  /**
   * Get the unique result and decrypt PII fields.
   */
  async unique(): Promise<AnyDoc | null> {
    const doc = await this.builder.unique();
    return doc ? this.decryptDoc(doc) : null;
  }

  /**
   * Use an index for the query.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withIndex(indexName: string, indexRange?: any): WrappedQueryBuilder {
    return new WrappedQueryBuilder(
      this.builder.withIndex(indexName, indexRange),
      this.pii,
      this.encryptionEnabled
    );
  }

  /**
   * Filter results.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter(predicate: any): WrappedQueryBuilder {
    return new WrappedQueryBuilder(this.builder.filter(predicate), this.pii, this.encryptionEnabled);
  }

  /**
   * Order results.
   */
  order(order: "asc" | "desc"): WrappedQueryBuilder {
    return new WrappedQueryBuilder(this.builder.order(order), this.pii, this.encryptionEnabled);
  }

  /**
   * Limit results.
   */
  take(n: number): WrappedQueryBuilder {
    return new WrappedQueryBuilder(this.builder.take(n), this.pii, this.encryptionEnabled);
  }

  private async decryptDoc(doc: AnyDoc): Promise<AnyDoc> {
    const result = { ...doc };
    for (const [key, value] of Object.entries(result)) {
      if (isEncryptedField(value)) {
        if (value.k === DEV_MODE_MARKER) {
          // Dev mode: c contains plaintext
          result[key] = value.c;
        } else {
          // Prod mode: actually decrypt
          if (!this.pii) {
            throw new Error(
              `Cannot decrypt field "${key}": found encrypted data but encryption is disabled. ` +
                `This may happen if prod data was copied to a dev environment.`
            );
          }
          result[key] = await this.pii.decrypt(value);
        }
      }
    }
    return result;
  }
}

/**
 * Wrapped database interface that automatically encrypts/decrypts PII fields.
 *
 * Created via `encryptedPii.wrapDb()` or `encryptedPii.wrapDbQuery()`.
 */
export class WrappedDb {
  private db: AnyDb;
  private pii: UserPII | null;
  private piiFieldsByTable: Map<string, Set<string>>;
  private allPiiFields: Set<string>;
  private encryptionEnabled: boolean;

  constructor(ctx: AnyCtx, pii: UserPII | null, schema: AnyDoc, options?: WrappedDbOptions) {
    this.db = ctx.db;
    this.pii = pii;
    this.piiFieldsByTable = extractPiiFields(schema);
    // Also keep flat set for quick lookup
    this.allPiiFields = new Set(
      [...this.piiFieldsByTable.values()].flatMap((s) => [...s])
    );
    this.encryptionEnabled = options?.encryptionEnabled ?? true;
  }

  // ============================================================
  // Write Methods
  // ============================================================

  /**
   * Patch a document, automatically encrypting PII fields.
   *
   * @param id - Document ID to patch
   * @param updates - Fields to update (PII fields will be encrypted)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async patch(id: any, updates: AnyDoc): Promise<void> {
    const encrypted = await this.encryptFields(updates);
    return this.db.patch(id, encrypted);
  }

  /**
   * Insert a document, automatically encrypting PII fields.
   *
   * @param table - Table name
   * @param doc - Document to insert (PII fields will be encrypted)
   * @returns The inserted document's ID
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async insert(table: string, doc: AnyDoc): Promise<any> {
    const encrypted = await this.encryptFields(doc);
    return this.db.insert(table, encrypted);
  }

  /**
   * Replace a document, automatically encrypting PII fields.
   *
   * @param id - Document ID to replace
   * @param doc - New document content (PII fields will be encrypted)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async replace(id: any, doc: AnyDoc): Promise<void> {
    const encrypted = await this.encryptFields(doc);
    return this.db.replace(id, encrypted);
  }

  /**
   * Delete a document.
   *
   * @param id - Document ID to delete
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(id: any): Promise<void> {
    return this.db.delete(id);
  }

  // ============================================================
  // Read Methods
  // ============================================================

  /**
   * Get a document by ID, automatically decrypting PII fields.
   *
   * @param id - Document ID
   * @returns The document with PII fields decrypted, or null if not found
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(id: any): Promise<AnyDoc | null> {
    const doc = await this.db.get(id);
    if (!doc) return null;
    return this.decryptDoc(doc);
  }

  /**
   * Start a query on a table. Results will have PII fields decrypted.
   *
   * @param table - Table name
   * @returns A wrapped query builder
   */
  query(table: string): WrappedQueryBuilder {
    return new WrappedQueryBuilder(this.db.query(table), this.pii, this.encryptionEnabled);
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private async encryptFields(obj: AnyDoc): Promise<AnyDoc> {
    const result = { ...obj };
    for (const field of this.allPiiFields) {
      if (field in result && typeof result[field] === "string") {
        if (this.encryptionEnabled && this.pii) {
          // Prod: actually encrypt
          result[field] = await this.pii.encrypt(result[field]);
        } else {
          // Dev: store plaintext in encrypted shape
          result[field] = {
            __encrypted: true,
            v: 1,
            c: result[field], // plaintext
            i: "",
            k: DEV_MODE_MARKER,
          } as EncryptedField;
        }
      }
    }
    return result;
  }

  private async decryptDoc(doc: AnyDoc): Promise<AnyDoc> {
    const result = { ...doc };
    for (const [key, value] of Object.entries(result)) {
      if (isEncryptedField(value)) {
        if (value.k === DEV_MODE_MARKER) {
          // Dev mode: c contains plaintext
          result[key] = value.c;
        } else {
          // Prod mode: actually decrypt
          if (!this.pii) {
            throw new Error(
              `Cannot decrypt field "${key}": found encrypted data but encryption is disabled. ` +
                `This may happen if prod data was copied to a dev environment.`
            );
          }
          result[key] = await this.pii.decrypt(value);
        }
      }
    }
    return result;
  }
}
