// Smoke test del MCP server — Opción A (caja negra / integración).
// Levanta el server real vía stdio, hace el handshake JSON-RPC y verifica
// que las 13 tools estén registradas con el shape correcto.
//
// NO mockea: prueba el wiring real (bootea, protocolo, registro de tools).
// NO llama tools que tocan VTEX (requieren sesión) — solo lista.
//
// Uso: bun run scripts/smoke-mcp.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const SERVER = path.join(ROOT, "src", "mcp", "index.ts");

// Las 13 tools que el código declara (src/mcp/index.ts).
const EXPECTED = [
  "search_products",
  "select_address",
  "add_to_cart",
  "get_cart",
  "remove_from_cart",
  "get_orders",
  "get_analytics",
  "track_add",
  "track_check",
  "track_list",
  "get_addresses",
  "simulate_stock",
  "open_checkout",
  "open_login",
];

let pass = 0;
let fail = 0;
const ok = (msg: string) => {
  console.log(`  ✔ ${msg}`);
  pass++;
};
const ko = (msg: string) => {
  console.error(`  ✖ ${msg}`);
  fail++;
};

console.log("=== Smoke MCP — levantando server real via stdio ===\n");

const transport = new StdioClientTransport({
  command: process.execPath, // bun (el que corre este script)
  args: ["run", SERVER],
});

const client = new Client({ name: "smoke-mcp", version: "1.0.0" });

try {
  // 1. Bootea + handshake (initialize). Si falla, el server no arranca.
  await client.connect(transport);
  ok("server bootea y completa handshake JSON-RPC (initialize)");

  // 2. Lista tools.
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();

  if (tools.length === EXPECTED.length) {
    ok(`registra ${tools.length} tools (esperadas: ${EXPECTED.length})`);
  } else {
    ko(`registra ${tools.length} tools, esperadas ${EXPECTED.length}`);
  }

  // 3. Cada tool esperada está presente.
  for (const name of EXPECTED) {
    if (names.includes(name)) ok(`tool presente: ${name}`);
    else ko(`tool FALTA: ${name}`);
  }

  // 4. Tools desconocidas (drift código vs registro).
  const extra = names.filter((n) => !EXPECTED.includes(n));
  if (extra.length === 0) ok("sin tools inesperadas");
  else ko(`tools inesperadas: ${extra.join(", ")}`);

  // 5. Cada tool tiene description no vacía (contrato para el agente).
  const noDesc = tools.filter((t) => !t.description || t.description.length < 10);
  if (noDesc.length === 0) ok("todas las tools tienen description");
  else ko(`tools sin description: ${noDesc.map((t) => t.name).join(", ")}`);
} catch (e) {
  ko(`excepción: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await client.close().catch(() => {});
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
