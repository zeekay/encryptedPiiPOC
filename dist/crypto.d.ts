/**
 * Cryptographic utilities for encrypted PII.
 * These run in user space for better performance (no isolate boundary crossing).
 */
export declare function generateKey(): string;
export declare function generateIV(): string;
export declare function encrypt(plaintext: string, keyB64: string, ivB64: string): Promise<string>;
export declare function decrypt(ciphertextB64: string, keyB64: string, ivB64: string): Promise<string>;
export declare function wrapKey(dekB64: string, kekB64: string, ivB64: string): Promise<string>;
export declare function unwrapKey(wrappedDekB64: string, kekB64: string, ivB64: string): Promise<string>;
//# sourceMappingURL=crypto.d.ts.map