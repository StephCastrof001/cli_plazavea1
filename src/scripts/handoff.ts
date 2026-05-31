// Playwright Browser Handoff — ejecutar desde terminal del usuario (NO desde MCP)
// ADR-0001: Playwright cuelga bajo Bun en Windows. Usar Node+tsx:
//   node node_modules/tsx/dist/cli.mjs src/scripts/handoff.ts
//
// Inyecta las cookies de sesión guardadas en ~/.config/plazavea/config.json
// y abre Chromium headed en /checkout/#/cart con el carrito precargado.
import { openCheckoutInBrowser } from "../services/auth.js";

console.log("Abriendo checkout con sesión activa...");
await openCheckoutInBrowser();
