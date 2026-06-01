#!/usr/bin/env bun
import { spawnSync } from "child_process";
import path from "path";
import chalk from "chalk";

const COMMANDS: Record<string, string> = {
  login:    "src/commands/login.ts",
  logout:   "src/commands/logout.ts",
  whoami:   "src/commands/whoami.ts",
  search:   "src/commands/search.ts",
  cart:     "src/commands/cart.ts",
  add:      "src/commands/add.ts",
  remove:   "src/commands/remove.ts",
  buy:      "src/commands/buy.ts",
  simulate:  "src/commands/simulate.ts",
  orders:    "src/commands/orders.ts",
  track:     "src/commands/track.ts",
  analytics: "src/commands/analytics.ts",
  mcp:       "src/mcp/index.ts",
};

// Help categorizado + coloreado (patrón rappi/ubereats).
// chalk auto-detecta TTY: en terminal colorea, en non-TTY (Bash tool) devuelve plano legible.
const c = chalk.cyan;
const d = chalk.dim;
const b = chalk.bold;

const HELP = `
${b("Cuenta")}
  ${c("login")}                          Iniciar sesión (abre browser)
  ${c("logout")}                         Cerrar sesión
  ${c("whoami")}                         Estado de sesión y antigüedad

${b("Compra")}
  ${c("search")} ${d("<término>")}               Buscar productos ${d("[--limit N] [--output json]")}
  ${c("buy")} ${d("<término>")}                  Búsqueda interactiva → elegir → agregar ${d("[--limit N]")}
  ${c("simulate")}                       Verificar stock local ${d("[--sku X] [--address N]")}
  ${c("add")} ${d("<skuId>")}                    Agregar al carrito ${d("[--quantity N] [--dry-run]")}
  ${c("remove")} ${d("<índice>")}                Eliminar del carrito ${d("[--dry-run]")}
  ${c("cart")}                           Ver carrito ${d("[--output json]")}

${b("Radar & Datos")}
  ${c("track")} ${d("<sub>")}                    Radar de precios ${d("(add/list/check/remove/history)")}
  ${c("orders")}                         Historial de pedidos ${d("[--limit N] [--output json]")}
  ${c("analytics")}                      Gasto por período ${d("[--month YYYY-MM] [--top N]")}

${b("Sistema")}
  ${c("mcp")}                            Iniciar MCP server ${d("(stdio)")} para Claude Code

${b("Opciones globales")}
  ${d("--output json")}                  Output en JSON ${d("(scripts y agentes)")}
  ${d("--dry-run")}                      Preview sin ejecutar ${d("(add/remove)")}
  ${d("--help, -h")}                     Mostrar esta ayuda
`;

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  // Sin args → banner + help (patrón rappi — sin showStatus para no superar umbral de colapso)
  const { printBanner } = await import("./src/ui/banner.js");
  printBanner("3.2.0");
  console.log(HELP);
  process.exit(0);
}

if (command === "--help" || command === "-h") {
  console.log(HELP);
  process.exit(0);
}

const file = COMMANDS[command];
if (!file) {
  console.error(`Comando desconocido: "${command}". Usa --help para ver comandos.`);
  process.exit(1);
}

const rootDir = path.resolve(import.meta.dir ?? process.cwd());
const filePath = path.resolve(rootDir, file);

// `login` usa Playwright, que cuelga bajo Bun en Windows (cliente WS/CDP no
// completa el handshake con Chrome). Se ejecuta bajo Node + tsx.
// El resto de comandos corren bajo Bun.
let runner: string;
let runnerArgs: string[];
if (command === "login") {
  runner = "node";
  runnerArgs = [
    path.resolve(rootDir, "node_modules/tsx/dist/cli.mjs"),
    filePath,
    ...args.slice(1),
  ];
} else {
  runner = process.execPath; // bun
  runnerArgs = ["run", filePath, ...args.slice(1)];
}

const result = spawnSync(runner, runnerArgs, {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
