/**
 * Example Convex app configuration using the encrypted-pii component.
 */
import { defineApp } from "convex/server";
import encryptedPii from "@convex-dev/encrypted-pii/convex.config";

const app = defineApp();

// Install the encrypted PII component
app.use(encryptedPii);

export default app;
