# Encrypted PII Demo

A demo app showing the `@convex-dev/encrypted-pii` component in action.

## Setup

1. **Build the component** (from the parent directory):
   ```bash
   cd ..
   npm install
   npm run build
   ```

2. **Install demo dependencies**:
   ```bash
   npm install
   ```

3. **Start Convex**:
   ```bash
   npx convex dev
   ```
   This will prompt you to create a new Convex project if needed.

4. **Start the frontend** (in a new terminal):
   ```bash
   npm run dev
   ```

5. Open http://localhost:5173

## What the Demo Shows

- **Create users** with name and email (stored as plaintext)
- **Store encrypted PII** (SSN, credit card) - encrypted with per-user keys
- **Decrypt PII** - only the owning user can decrypt their data
- **View raw references** - see the opaque `epii_xxx` strings stored in documents
- **Delete user** - removes user AND all their encrypted PII (GDPR compliant)

## Architecture

```
Master Key (1 per component)
    └── User KEK (1 per user) - encrypted with master key
            └── Field DEK (1 per value) - encrypted with user KEK
                    └── Encrypted Value - encrypted with field DEK
```

- Each user has their own Key Encryption Key (KEK)
- Each encrypted field has its own Data Encryption Key (DEK)
- Direct database access only reveals ciphertext
- Only the owning user can decrypt their data
