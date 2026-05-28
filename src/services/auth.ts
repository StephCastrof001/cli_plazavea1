import { chromium } from "playwright";
import { saveConfig, removeConfig } from "../config.js";
import { BASE_URL } from "../constants.js";

const LOGIN_URL = `${BASE_URL}/login`;
const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos máximo

export async function loginWithBrowser(): Promise<boolean> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--window-size=1280,800",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.bringToFront();

  process.stderr.write("  Inicia sesión en el browser que se abrió...\n");

  // Esperar hasta que aparezca vtex_session (indica login exitoso)
  const start = Date.now();
  let success = false;

  while (Date.now() - start < TIMEOUT_MS) {
    const cookies = await context.cookies();
    const hasSession = cookies.some(
      (c) => c.name === "vtex_session" && c.domain.includes("plazavea"),
    );
    if (hasSession) {
      success = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (success) {
    const cookies = await context.cookies();
    saveConfig({ cookies, savedAt: new Date().toISOString() });
  }

  await browser.close();
  return success;
}

export function logout(): void {
  removeConfig();
}
