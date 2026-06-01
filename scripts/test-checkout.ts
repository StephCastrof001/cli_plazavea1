// Smoke test — openCheckoutInBrowser
// Uso: bun run scripts/test-checkout.ts
import { configExists } from "../src/config.js";
import { openCheckoutInBrowser } from "../src/services/auth.js";

console.log("=== Smoke Test: openCheckoutInBrowser ===");

if (!configExists()) {
  console.error("✗ Sin sesión activa. Ejecuta: plazavea login");
  process.exit(1);
}

console.log("✓ Sesión detectada. Lanzando browser...");
await openCheckoutInBrowser();
console.log("✓ Browser abierto sin errores de compilación ni Playwright.");
