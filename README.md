# @convex-dev/encrypted-pii

Type-safe encrypted PII field storage for Convex. Store sensitive data (SSN, credit cards, etc.) with per-user encryption keys and full TypeScript safety.

## Features

- **Type-safe** - Encrypted fields are objects, not strings. TypeScript prevents accidental usage without decryption.
- **Per-user encryption keys** - Each user gets their own Key Encryption Key (KEK)
- **Per-field encryption** - Each value has its own Data Encryption Key (DEK)
- **AES-256-GCM** - Industry-standard authenticated encryption
- **Fast** - Encryption/decryption happens in your code, not across isolate boundaries
- **GDPR compliant** - Easy deletion of all user data

## Installation

```bash
npm install @convex-dev/encrypted-pii
```

Or install from a local tarball:

```bash
npm install /path/to/convex-dev-encrypted-pii-0.1.0.tgz
```

---

## Complete Setup Guide

### Step 1: Configure the Component

Create or update your `convex/convex.config.ts`:

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import encryptedPii from "@convex-dev/encrypted-pii/convex.config";

const app = defineApp();
app.use(encryptedPii);

export default app;
```

### Step 2: Define Your Schema with PII Fields

Use the `piiField()` validator for encrypted fields:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { piiField } from "@convex-dev/encrypted-pii";

export default defineSchema({
  users: defineTable({
    // Regular fields
    name: v.string(),
    email: v.string(),

    // Encrypted PII fields - use piiField() validator
    ssn: v.optional(piiField()),
    creditCard: v.optional(piiField()),
    bankAccount: v.optional(piiField()),
  }),
});
```

**Important:** The `piiField()` validator creates an `EncryptedField` type (an object), not a string. This provides type safety.

### Step 3: Create the PII Client

Create a helper file to instantiate the client:

```typescript
// convex/pii.ts
import { EncryptedPII } from "@convex-dev/encrypted-pii";
import { components } from "./_generated/api";

export const encryptedPii = new EncryptedPII(components.encryptedPii);
```

### Step 4: Run Convex Dev

Push your schema and component:

```bash
npx convex dev
```

---

## Usage Examples

### Encrypting and Storing Data

```typescript
// convex/users.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { encryptedPii } from "./pii";

export const storeSSN = mutation({
  args: {
    userId: v.id("users"),
    ssn: v.string()
  },
  handler: async (ctx, args) => {
    // Step 1: Get PII helper for this user (fetches their encryption key once)
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Step 2: Encrypt the value
    const encryptedSSN = await pii.encrypt(args.ssn);

    // Step 3: Store directly in your document
    await ctx.db.patch(args.userId, {
      ssn: encryptedSSN,
    });
  },
});
```

### Decrypting Data (in Mutations)

```typescript
export const getSSN = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Step 1: Get PII helper for this user
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Step 2: Fetch the document
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Step 3: Decrypt the field
    const ssn = await pii.decrypt(user.ssn);

    return { ssn };
  },
});
```

### Decrypting Data (in Queries)

Use `forUserQuery()` to decrypt in queries. Returns null if the user has no encryption key yet.

```typescript
export const getSSN = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // forUserQuery returns null if user has no key yet
    const pii = await encryptedPii.forUserQuery(ctx, args.userId);
    if (!pii) return null;

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const ssn = await pii.decrypt(user.ssn);
    return { ssn };
  },
});
```

### Storing Multiple PII Fields

```typescript
export const storeAllPII = mutation({
  args: {
    userId: v.id("users"),
    ssn: v.string(),
    creditCard: v.string(),
  },
  handler: async (ctx, args) => {
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Encrypt multiple fields
    await ctx.db.patch(args.userId, {
      ssn: await pii.encrypt(args.ssn),
      creditCard: await pii.encrypt(args.creditCard),
    });
  },
});
```

### Decrypting Multiple Fields

Use `decryptMany()` for convenience:

```typescript
export const getAllPII = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const pii = await encryptedPii.forUser(ctx, args.userId);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Decrypt multiple fields at once
    const decrypted = await pii.decryptMany({
      ssn: user.ssn,
      creditCard: user.creditCard,
    });

    return {
      ssn: decrypted.ssn,           // string | null
      creditCard: decrypted.creditCard,  // string | null
    };
  },
});
```

### Creating a User with PII

```typescript
export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    ssn: v.string(),
  },
  handler: async (ctx, args) => {
    // First create the user without PII
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
    });

    // Then encrypt and add PII
    const pii = await encryptedPii.forUser(ctx, userId);
    await ctx.db.patch(userId, {
      ssn: await pii.encrypt(args.ssn),
    });

    return userId;
  },
});
```

### Deleting User Data (GDPR Compliance)

```typescript
export const deleteUserPII = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Step 1: Clear PII fields from your document
    await ctx.db.patch(args.userId, {
      ssn: undefined,
      creditCard: undefined,
      bankAccount: undefined,
    });

    // Step 2: Delete the user's encryption key from the component
    // This ensures their key can never be used again
    await encryptedPii.deleteAllUserData(ctx, args.userId);
  },
});
```

### Checking if PII Exists

```typescript
export const hasPII = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    return {
      hasSSN: user?.ssn !== undefined,
      hasCreditCard: user?.creditCard !== undefined,
    };
  },
});
```

---

## Type Safety

The `piiField()` validator creates an `EncryptedField` type that TypeScript won't let you use as a string:

```typescript
const user = await ctx.db.get(userId);

// ❌ Type error - EncryptedField is not assignable to string
console.log(`SSN: ${user.ssn}`);
sendEmail(user.ssn);
JSON.stringify({ ssn: user.ssn }); // Works but exposes encrypted blob

// ✅ Correct - must decrypt first
const pii = await encryptedPii.forUser(ctx, userId);
const ssn = await pii.decrypt(user.ssn);
console.log(`SSN: ${ssn}`);
```

### The EncryptedField Type

```typescript
type EncryptedField = {
  __encrypted: true;  // Marker for identification
  v: number;          // Version (for future migrations)
  c: string;          // Ciphertext (base64)
  i: string;          // IV (base64)
  k: string;          // Encrypted DEK (base64)
};
```

---

## API Reference

### `EncryptedPII` Class

#### `constructor(component)`

Create a new EncryptedPII client.

```typescript
import { EncryptedPII } from "@convex-dev/encrypted-pii";
import { components } from "./_generated/api";

const encryptedPii = new EncryptedPII(components.encryptedPii);
```

#### `forUser(ctx, ownerId): Promise<UserPII>`

Get a PII helper for a specific user (for mutations). Creates the user's encryption key if it doesn't exist yet.

- `ctx` - Convex mutation context
- `ownerId` - String identifying the user (typically `ctx.auth.getUserIdentity().subject` or a user document ID)

```typescript
const pii = await encryptedPii.forUser(ctx, userId);
```

#### `forUserQuery(ctx, ownerId): Promise<UserPII | null>`

Get a PII helper for a specific user (for queries - read-only). Returns null if the user has no encryption key yet.

Use this in queries when you only need to decrypt existing data. The user's key must have been created by a prior `forUser()` call in a mutation.

- `ctx` - Convex query context
- `ownerId` - String identifying the user

```typescript
const pii = await encryptedPii.forUserQuery(ctx, userId);
if (!pii) return null; // User has no encrypted data yet
```

#### `deleteAllUserData(ctx, ownerId): Promise<number>`

Delete all encryption keys for a user. Call this for GDPR compliance.

```typescript
const keysDeleted = await encryptedPii.deleteAllUserData(ctx, userId);
```

---

### `UserPII` Class

Returned by `encryptedPii.forUser()`. All methods run locally (no isolate boundary crossing).

#### `encrypt(plaintext): Promise<EncryptedField>`

Encrypt a string value. Returns an `EncryptedField` object to store in your document.

```typescript
const encrypted = await pii.encrypt("123-45-6789");
await ctx.db.patch(userId, { ssn: encrypted });
```

#### `decrypt(field): Promise<string | null>`

Decrypt an encrypted field. Returns null if the field is null/undefined.

```typescript
const ssn = await pii.decrypt(user.ssn);
```

#### `decryptMany(fields): Promise<Record<string, string | null>>`

Decrypt multiple fields at once. Returns an object with the same keys.

```typescript
const { ssn, creditCard } = await pii.decryptMany({
  ssn: user.ssn,
  creditCard: user.creditCard,
});
```

---

### Schema Helper

#### `piiField()`

Convex validator for encrypted PII fields. Use in your schema.

```typescript
import { piiField } from "@convex-dev/encrypted-pii";

// In schema:
ssn: v.optional(piiField()),
```

---

## What Gets Stored

Encrypted fields are stored as objects in your Convex documents:

```json
{
  "_id": "jh7abc123...",
  "_creationTime": 1234567890,
  "name": "John Doe",
  "email": "john@example.com",
  "ssn": {
    "__encrypted": true,
    "v": 1,
    "c": "base64-encoded-ciphertext...",
    "i": "base64-encoded-iv...",
    "k": "base64-encrypted-dek:base64-dek-iv"
  }
}
```

The `__encrypted: true` marker makes it obvious in the Convex dashboard that data is encrypted.

---

## Architecture

### Key Hierarchy

```
Master Key (1 per component instance)
    │
    └── User KEK (1 per user)
            │
            └── Field DEK (1 per encrypted value)
                    │
                    └── Encrypted Value (AES-256-GCM)
```

### How It Works

1. **Master Key**: Generated once when the component is first used. Stored in the component's isolated tables. Encrypts all user KEKs.

2. **User KEK (Key Encryption Key)**: Generated when `forUser()` is first called for a user. Encrypted with the master key before storage. Used to encrypt/decrypt that user's field DEKs.

3. **Field DEK (Data Encryption Key)**: Generated fresh for each `encrypt()` call. Encrypted with the user's KEK. Stored alongside the ciphertext in the `EncryptedField` object.

4. **Encryption**: AES-256-GCM with random 96-bit IVs. Provides both confidentiality and authenticity.

### Data Flow

**Encrypting:**
```
plaintext
  → generate random DEK
  → encrypt plaintext with DEK
  → encrypt DEK with user's KEK
  → return EncryptedField object
```

**Decrypting:**
```
EncryptedField
  → decrypt DEK using user's KEK
  → decrypt ciphertext using DEK
  → return plaintext
```

---

## Performance

The `forUser()` API is optimized for performance:

1. **One key fetch** - `forUser()` fetches the user's KEK once from the component (one isolate boundary crossing)
2. **Local crypto** - All `encrypt()`/`decrypt()` calls use Web Crypto API locally
3. **No more boundary crossings** - After getting the key, everything runs in your code

This is significantly faster than an API that crosses the isolate boundary for every encrypt/decrypt operation.

---

## Security Considerations

### What This Provides

- Encryption at rest with AES-256-GCM
- Per-user key isolation
- Per-field unique encryption keys
- Envelope encryption (keys encrypting keys)

### What This Does NOT Provide

- **Zero-knowledge encryption** - The server (Convex) can theoretically access the master key since it's stored in the component's tables. A malicious operator could decrypt data.
- **Client-side encryption** - Keys are managed server-side. For true zero-knowledge, you'd need keys derived from user passwords that never leave the client.

### Threat Model

This component protects against:
- Accidental exposure of PII in logs/dashboards
- Database dumps containing plaintext PII
- Developers accidentally accessing raw PII

This component does NOT protect against:
- Malicious Convex operators
- Compromised server-side code
- Someone with full database access who also accesses the component's tables

---

## Migration Guide

### Migrating from Legacy API to forUser() API

The legacy API (`store()`/`get()`) stored encrypted data in the component's tables. The new `forUser()` API stores encrypted data directly in your documents, which is faster and gives you more control.

#### Before (Legacy API)

```typescript
// Schema - stored references to component's tables
users: defineTable({
  name: v.string(),
  ssnRef: v.optional(v.string()),  // Just a reference string
})

// Storing
const ssnRef = await encryptedPii.store(ctx, userId, ssn);
await ctx.db.patch(userId, { ssnRef });

// Reading
const ssn = await encryptedPii.get(ctx, userId, user.ssnRef);
```

#### After (New forUser() API)

```typescript
// Schema - stores encrypted data directly
import { piiField } from "@convex-dev/encrypted-pii";

users: defineTable({
  name: v.string(),
  ssn: v.optional(piiField()),  // EncryptedField object
})

// Storing
const pii = await encryptedPii.forUser(ctx, userId);
await ctx.db.patch(userId, { ssn: await pii.encrypt(ssn) });

// Reading
const pii = await encryptedPii.forUser(ctx, userId);
const ssn = await pii.decrypt(user.ssn);
```

#### Migration Steps

1. **Update your schema** to use `piiField()` instead of `v.string()`:

```typescript
// Before
ssnRef: v.optional(v.string()),

// After
ssn: v.optional(piiField()),
```

2. **Create a migration mutation** to re-encrypt existing data:

```typescript
import { encryptedPii } from "./pii";

export const migrateUserPII = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.ssnRef) return; // No data to migrate

    // Decrypt using legacy API
    const ssn = await encryptedPii.get(ctx, args.userId, user.ssnRef);
    if (!ssn) return;

    // Re-encrypt using new API
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Update document with new format and remove old ref
    await ctx.db.patch(args.userId, {
      ssn: await pii.encrypt(ssn),
      ssnRef: undefined,  // Remove old reference
    });

    // Optionally delete old data from component
    await encryptedPii.delete(ctx, args.userId, user.ssnRef);
  },
});
```

3. **Run migration** for all users:

```typescript
export const migrateAllUsers = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let migrated = 0;

    for (const user of users) {
      if (user.ssnRef && !user.ssn) {
        // Has old format, needs migration
        const ssn = await encryptedPii.get(ctx, user._id, user.ssnRef);
        if (ssn) {
          const pii = await encryptedPii.forUser(ctx, user._id);
          await ctx.db.patch(user._id, {
            ssn: await pii.encrypt(ssn),
            ssnRef: undefined,
          });
          await encryptedPii.delete(ctx, user._id, user.ssnRef);
          migrated++;
        }
      }
    }

    return { migrated };
  },
});
```

4. **Update all your mutations** to use the new API pattern.

5. **Remove old schema fields** once migration is complete.

---

## Troubleshooting

### "Cannot find module '@convex-dev/encrypted-pii'"

Make sure you've installed the package and run `npx convex dev` to generate types.

### Type errors with `piiField()`

Make sure you're importing from the correct location:

```typescript
import { piiField } from "@convex-dev/encrypted-pii";
```

### Using forUser() vs forUserQuery()

- `forUser()` requires a **mutation** context because it may create the user's encryption key on first use. Use this when encrypting data or when you need to ensure the key exists.
- `forUserQuery()` works in **query** context but returns `null` if the user has no key yet. Use this for read-only decryption when you know the user already has encrypted data.

---

## License

MIT
