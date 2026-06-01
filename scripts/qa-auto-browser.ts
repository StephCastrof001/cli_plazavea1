// QA del feature auto-browser — llama las tools reales via MCP client.
// Solo auto=false (NO abre browser). Valida contrato: shape, fallback, param requerido.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const SERVER = path.join(ROOT, "src", "mcp", "index.ts");

let pass = 0;
let fail = 0;
const ok = (m: string) => {
  console.log(`  ✔ ${m}`);
  pass++;
};
const ko = (m: string) => {
  console.error(`  ✖ ${m}`);
  fail++;
};

function parse(res: { content: Array<{ type: string; text?: string }>; isError?: boolean }) {
  const txt = res.content?.[0]?.text ?? "";
  try {
    return { json: JSON.parse(txt), isError: res.isError ?? false, raw: txt };
  } catch {
    return { json: null, isError: res.isError ?? false, raw: txt };
  }
}

console.log("=== QA auto-browser (auto=false, sin abrir browser) ===\n");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["run", SERVER],
});
const client = new Client({ name: "qa-auto-browser", version: "1.0.0" });

try {
  await client.connect(transport);
  ok("MCP conecta");

  // 1. open_login auto=false → comando, sin spawn
  {
    const r = parse((await client.callTool({ name: "open_login", arguments: { auto: false } })) as never);
    if (r.json?.browser_launched === false) ok("open_login auto=false → browser_launched:false");
    else ko(`open_login auto=false → browser_launched esperado false, got ${r.json?.browser_launched}`);
    if (typeof r.json?.command === "string" && r.json.command.includes("login.ts"))
      ok("open_login devuelve comando fallback (login.ts)");
    else ko(`open_login sin comando login.ts: ${r.json?.command}`);
  }

  // 2. open_checkout auto=false → comando, sin spawn (requiere sesión+dirección)
  {
    const r = parse((await client.callTool({ name: "open_checkout", arguments: { auto: false } })) as never);
    if (r.isError) {
      ok(`open_checkout auto=false → bloqueado por gate (esperado si no hay sesión/dirección): ${r.raw.slice(0, 60)}`);
    } else {
      if (r.json?.browser_launched === false) ok("open_checkout auto=false → browser_launched:false");
      else ko(`open_checkout auto=false → esperado false, got ${r.json?.browser_launched}`);
      if (typeof r.json?.command === "string" && r.json.command.includes("handoff.ts"))
        ok("open_checkout devuelve comando fallback (handoff.ts)");
      else ko(`open_checkout sin comando handoff.ts: ${r.json?.command}`);
      if (typeof r.json?.note === "string" && r.json.note.includes("humano"))
        ok("open_checkout mantiene guardrail de pago humano");
      else ko("open_checkout perdió el guardrail de pago humano");
    }
  }

  // 3. auto es REQUERIDO — llamar sin auto debe fallar (Zod)
  {
    let rejected = false;
    try {
      const r = parse((await client.callTool({ name: "open_login", arguments: {} })) as never);
      rejected = r.isError === true;
    } catch {
      rejected = true; // el SDK puede tirar excepción por validación
    }
    if (rejected) ok("auto REQUERIDO: llamada sin auto es rechazada (control del usuario)");
    else ko("auto NO requerido: la tool aceptó llamada sin el parámetro");
  }
} catch (e) {
  ko(`excepción: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await client.close().catch(() => {});
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
