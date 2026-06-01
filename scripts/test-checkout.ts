// Smoke test — openCheckoutInBrowser
// Uso: bun run src/test-checkout.ts
import { configExists } from "./config.js";
import { openCheckoutInBrowser } from "./services/auth.js";

console.log("=== Smoke Test: openCheckoutInBrowser ===");

if (!configExists()) {
  console.error("✗ Sin sesión activa. Ejecuta: plazavea login");
  process.exit(1);
}

console.log("✓ Sesión detectada. Lanzando browser...");
await openCheckoutInBrowser();
console.log("✓ Browser abierto sin errores de compilación ni Playwright.");
