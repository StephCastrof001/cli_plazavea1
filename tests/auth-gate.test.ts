/**
 * Auth Gate — tests de integración
 * Prueba requireSession() y requireAddress() contra el filesystem real.
 * Hace backup/restore del config existente para no destruir la sesión activa.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".config", "plazavea");
const CONFIG_PATH = path.join(CONFIG_DIR, "session.json");

const VALID_COOKIE = { name: "VtexIdclientAutCookie_PE", value: "tok", domain: ".plazavea.com.pe" };
const ANON_COOKIE  = { name: "vtex_session", value: "anon", domain: ".plazavea.com.pe" };

function writeConfig(data: object) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data), "utf8");
}

// ── Fixture helpers ─────────────────────────────────────────────────────────
let backup: string | null = null;

beforeEach(() => {
  backup = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, "utf8") : null;
});

afterEach(() => {
  if (backup !== null) {
    fs.writeFileSync(CONFIG_PATH, backup, "utf8");
  } else if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
});

// ── requireSession() ────────────────────────────────────────────────────────
describe("requireSession()", () => {
  it("lanza cuando no hay config.json", async () => {
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
    const { requireSession } = await import("../src/config.js");
    expect(() => requireSession()).toThrow("Sin sesión activa. Ejecuta: plaza login");
  });

  it("lanza cuando config solo tiene cookie anónima (vtex_session)", async () => {
    writeConfig({ cookies: [ANON_COOKIE], savedAt: new Date().toISOString() });
    const { requireSession } = await import("../src/config.js");
    expect(() => requireSession()).toThrow("Sin sesión activa. Ejecuta: plaza login");
  });

  it("no lanza cuando config tiene VtexIdclientAutCookie", async () => {
    writeConfig({ cookies: [VALID_COOKIE], savedAt: new Date().toISOString() });
    const { requireSession } = await import("../src/config.js");
    expect(() => requireSession()).not.toThrow();
  });
});

// ── requireAddress() ────────────────────────────────────────────────────────
describe("requireAddress()", () => {
  it("lanza cuando no hay selectedAddressIndex en config", async () => {
    writeConfig({ cookies: [VALID_COOKIE], savedAt: new Date().toISOString() });
    const { requireAddress } = await import("../src/config.js");
    expect(() => requireAddress()).toThrow("Sin dirección seleccionada");
  });

  it("no lanza cuando selectedAddressIndex es 0", async () => {
    writeConfig({ cookies: [VALID_COOKIE], savedAt: new Date().toISOString(), selectedAddressIndex: 0 });
    const { requireAddress } = await import("../src/config.js");
    expect(() => requireAddress()).not.toThrow();
  });

  it("no lanza cuando selectedAddressIndex es N > 0", async () => {
    writeConfig({ cookies: [VALID_COOKIE], savedAt: new Date().toISOString(), selectedAddressIndex: 2 });
    const { requireAddress } = await import("../src/config.js");
    expect(() => requireAddress()).not.toThrow();
  });
});

// ── Combinado: orden correcto de gates ──────────────────────────────────────
describe("Auth Gate — orden de checks", () => {
  it("requireSession falla antes que requireAddress cuando no hay sesión", async () => {
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
    const { requireSession, requireAddress } = await import("../src/config.js");
    expect(() => requireSession()).toThrow("Sin sesión activa");
    // requireAddress ni se llega a ejecutar en el flujo normal
    expect(() => requireAddress()).toThrow("Sin dirección seleccionada"); // configExists() → false → selectedAddressIndex undefined → lanza dirección
  });
});
