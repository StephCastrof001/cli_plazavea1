import { chromium } from "playwright";
import { removeConfig, saveConfig } from "../config.js";
import { BASE_URL } from "../constants.js";

const LOGIN_URL = `${BASE_URL}/login`;
const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos máximo

// VTEX: SOLO VtexIdclientAutCookie = token de login real.
// vtex_session aparece para visitantes anónimos (tracking) — NO sirve para auth.
const AUTH_COOKIE_NAMES = ["VtexIdclientAutCookie"];

export async function loginWithBrowser(): Promise<boolean> {
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=900,700", "--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.bringToFront();

  process.stderr.write("  Inicia sesión en la ventana del browser...\n");

  const start = Date.now();
  let success = false;
  while (Date.now() - start < TIMEOUT_MS) {
    const cookies = await context.cookies();
    const hasAuth = cookies.some(
      (c) => AUTH_COOKIE_NAMES.some((n) => c.name.startsWith(n)) && c.value.length > 0,
    );
    if (hasAuth) {
      success = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (success) {
    // Navegar al orderForm en www.plazavea.com.pe para que VTEX setee
    // el cookie checkout.vtex.com (__ofid = orderFormId del usuario).
    // Sin este cookie el CLI crea un orderFormId separado al del browser.
    try {
      process.stderr.write("  Sincronizando orderForm con tu cuenta...\n");
      await page.goto("https://www.plazavea.com.pe/api/checkout/pub/orderForm", {
        waitUntil: "domcontentloaded",
        timeout: 12000,
      });
      await new Promise((r) => setTimeout(r, 1500));
    } catch {
      // Non-fatal — continuar sin checkout cookie
    }

    // Capturar TODOS los cookies de plazavea.com.pe + vtex.com (checkout cookie puede vivir en vtex.com)
    const finalCookies = await context.cookies();
    const plazaCookies = finalCookies.filter(
      (c) => c.domain.includes("plazavea") || c.name === "checkout.vtex.com",
    );
    saveConfig({ cookies: plazaCookies, savedAt: new Date().toISOString() });
    const names = plazaCookies.map((c) => c.name).join(", ");
    process.stderr.write(`  Cookies capturadas: ${names}\n`);
  }

  await browser.close();
  return success;
}

export function logout(): void {
  removeConfig();
}
