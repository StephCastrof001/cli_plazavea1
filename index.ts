#!/usr/bin/env bun
import { spawnSync } from "child_process";
import path from "path";

const COMMANDS: Record<string, string> = {
  login:    "src/commands/login.ts",
  logout:   "src/commands/logout.ts",
  whoami:   "src/commands/whoami.ts",
  search:   "src/commands/search.ts",
  cart:     "src/commands/cart.ts",
  add:      "src/commands/add.ts",
  remove:   "src/commands/remove.ts",
  simulate: "src/commands/simulate.ts",
  orders:   "src/commands/orders.ts",
  mcp:      "src/mcp/server.ts",
};

const HELP = `
plazavea-cli v3 — Plaza Vea desde la terminal + MCP para Claude Code

Uso:
  plaza <comando> [opciones]

Comandos:
  login                          Iniciar sesión (abre browser)
  logout                         Cerrar sesión
  whoami                         Estado de sesión y antigüedad
  search <término>               Buscar productos [--limit N] [--output json]
  cart                           Ver carrito [--output json]
  add <skuId>                    Agregar al carrito [--quantity N] [--dry-run]
  remove <índice>                Eliminar del carrito [--dry-run]
  simulate                       Verificar stock local [--sku X --postal Y]
  orders                         Historial de pedidos [--limit N] [--output json]
  mcp                            Iniciar MCP server (stdio) para Claude Code

Opciones globales:
  --output json                  Output en JSON (para scripts y agentes)
  --dry-run                      Preview sin ejecutar (en add/remove)
  --help, -h                     Mostrar esta ayuda
`;

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  console.log(HELP);
  process.exit(0);
}

const file = COMMANDS[command];
if (!file) {
  console.error(`Comando desconocido: "${command}". Usa --help para ver comandos.`);
  process.exit(1);
}

const bunPath = process.execPath;
const rootDir = path.resolve(import.meta.dir ?? process.cwd());
const filePath = path.resolve(rootDir, file);

const result = spawnSync(bunPath, ["run", filePath, ...args.slice(1)], {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
