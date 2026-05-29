import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { CONFIG_DIR_NAME, CONFIG_FILENAME } from "./constants.js";

const CookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
});

const ConfigSchema = z.object({
  cookies: z.array(CookieSchema).default([]),
  savedAt: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Cookie = z.infer<typeof CookieSchema>;

export const CONFIG_DIR = path.join(os.homedir(), ".config", CONFIG_DIR_NAME);
export const CONFIG_PATH = path.join(CONFIG_DIR, CONFIG_FILENAME);

export function getConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return ConfigSchema.parse(JSON.parse(raw));
  } catch {
    return ConfigSchema.parse({});
  }
}

export function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {
    /* Windows */
  }
}

export function removeConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
}

export function configExists(): boolean {
  if (!fs.existsSync(CONFIG_PATH)) return false;
  const config = getConfig();
  return config.cookies.some((c) => c.name === "vtex_session");
}

export function configAge(): number {
  if (!fs.existsSync(CONFIG_PATH)) return Number.POSITIVE_INFINITY;
  return Date.now() - fs.statSync(CONFIG_PATH).mtimeMs;
}

export function configAgeLabel(): string {
  const ms = configAge();
  if (ms === Number.POSITIVE_INFINITY) return "sin sesión";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)}h ${min % 60}min`;
}
