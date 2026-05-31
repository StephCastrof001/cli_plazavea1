// Ejecutado bajo Node+tsx (no Bun) — evita el bug Playwright/CDP en Windows.
// Ver ADR-0001: Playwright cuelga bajo Bun en Windows.
import { openCheckoutInBrowser } from "./auth.js";

await openCheckoutInBrowser();
