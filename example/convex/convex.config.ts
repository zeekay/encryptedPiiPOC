import { defineApp } from "convex/server";
import encryptedPii from "@convex-dev/encrypted-pii/convex.config";

const app = defineApp();
app.use(encryptedPii);

export default app;
