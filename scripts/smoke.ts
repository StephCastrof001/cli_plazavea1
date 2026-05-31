#!/usr/bin/env bun
/**
 * Smoke test e2e — flujo core: search → add → simulate → cart → remove → analytics → track
 * Uso:  bun run smoke
 * DoD:  todos los pasos ✅ en < 2 min con sesión activa
 *
 * Cada paso es independiente (try/catch). Un fallo no aborta los siguientes.
 * Limpieza: el ítem que agrega el smoke lo elimina antes de salir.
 *
 * Orden deliberado: simulate va DESPUÉS de add porque attachShipping
 * solo puede consultar ítems que ya están en el orderForm.
 */

import { spawnSync } from "child_process";
import path from "path";

const BUN = process.execPath;
const CLI = path.resolve(import.meta.dir, "../index.ts");

type StepResult = { name: string; ok: boolean; detail?: string };
const results: StepResult[] = [];
let skuId = "";
let productId = "";
let addedIdx = -1;

function cli(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync(BUN, ["run", CLI, ...args], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function step(name: string, fn: () => { ok: boolean; detail?: string }): void {
  try {
    const res = fn();
    results.push({ name, ...res });
  } catch (e) {
    results.push({ name, ok: false, detail: String(e) });
  }
}

// ── 1. health ───────────────────────────────────────────────────────────────
step("health (banner)", () => {
  const r = cli([]);
  return { ok: r.ok };
});

// ── 2. search → extraer skuId + productId ───────────────────────────────────
// productId != skuId en VTEX: un producto agrupa múltiples SKUs.
// tracker usa productId para lookup; add/simulate usan skuId.
step("search → skuId + productId", () => {
  const r = cli(["search", "arroz", "--limit", "3", "--output", "json"]);
  if (!r.ok) return { ok: false, detail: r.stderr.slice(0, 120) };
  try {
    const products = JSON.parse(r.stdout) as Array<{ skuId?: string; productId?: string }>;
    skuId = String(products[0]?.skuId ?? "");
    productId = String(products[0]?.productId ?? "");
    if (!skuId) return { ok: false, detail: "respuesta vacía o sin skuId" };
    return { ok: true, detail: `skuId=${skuId} productId=${productId}` };
  } catch {
    return { ok: false, detail: "parse JSON falló" };
  }
});

// ── 3. add --dry-run ─────────────────────────────────────────────────────────
step("add --dry-run (preview)", () => {
  if (!skuId) return { ok: false, detail: "sin skuId" };
  const r = cli(["add", skuId, "--dry-run"]);
  return { ok: r.ok, detail: r.ok ? undefined : r.stderr.slice(0, 120) };
});

// ── 4. add real ───────────────────────────────────────────────────────────────
step("add (real)", () => {
  if (!skuId) return { ok: false, detail: "sin skuId" };
  const r = cli(["add", skuId]);
  return { ok: r.ok, detail: r.ok ? undefined : r.stderr.slice(0, 120) };
});

// ── 5. simulate — DESPUÉS del add (attachShipping requiere ítem en orderForm) ─
step("simulate stock local", () => {
  if (!skuId) return { ok: false, detail: "sin skuId" };
  const r = cli(["simulate", "--sku", skuId]);
  return { ok: r.ok, detail: r.ok ? undefined : r.stderr.slice(0, 120) };
});

// ── 6. cart → verificar ítem presente ────────────────────────────────────────
step("cart (verify add)", () => {
  const r = cli(["cart", "--output", "json"]);
  if (!r.ok) return { ok: false, detail: r.stderr.slice(0, 120) };
  try {
    const cart = JSON.parse(r.stdout) as { items: Array<{ id: string }> };
    const items = cart.items ?? [];
    if (items.length === 0) return { ok: false, detail: "carrito vacío tras add" };
    const foundIdx = items.findIndex((i) => i.id === skuId);
    addedIdx = foundIdx >= 0 ? foundIdx : items.length - 1;
    return { ok: true, detail: `${items.length} ítems, idx=${addedIdx}` };
  } catch {
    return { ok: false, detail: "parse JSON falló" };
  }
});

// ── 7. remove (cleanup) ───────────────────────────────────────────────────────
step("remove (cleanup)", () => {
  const idx = addedIdx >= 0 ? addedIdx : 0;
  const r = cli(["remove", String(idx)]);
  return { ok: r.ok, detail: r.ok ? undefined : r.stderr.slice(0, 120) };
});

// ── 8. analytics ──────────────────────────────────────────────────────────────
step("analytics", () => {
  const r = cli(["analytics"]);
  return { ok: r.ok, detail: r.ok ? undefined : r.stderr.slice(0, 120) };
});

// ── 9. track add / list / check / remove ──────────────────────────────────────
// Usa productId (no skuId) — trackAdd hace fq=productId:X en la API VTEX.
step("track (add → list → check → remove)", () => {
  const id = productId || skuId;
  if (!id) return { ok: false, detail: "sin productId" };

  const add = cli(["track", "add", id]);
  if (!add.ok) return { ok: false, detail: `add: ${add.stderr.slice(0, 80)}` };

  const list = cli(["track", "list"]);
  if (!list.ok) return { ok: false, detail: `list: ${list.stderr.slice(0, 80)}` };

  const check = cli(["track", "check"]);
  if (!check.ok) return { ok: false, detail: `check: ${check.stderr.slice(0, 80)}` };

  const remove = cli(["track", "remove", id]);
  if (!remove.ok) return { ok: false, detail: `remove: ${remove.stderr.slice(0, 80)}` };

  return { ok: true };
});

// ── Reporte ───────────────────────────────────────────────────────────────────
console.log("\n  plazavea-cli  smoke test\n");
let allOk = true;
for (const r of results) {
  const icon = r.ok ? "✅" : "✖ ";
  const detail = r.detail ? `  — ${r.detail}` : "";
  console.log(`  ${icon}  ${r.name}${detail}`);
  if (!r.ok) allOk = false;
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n  ${passed}/${results.length} pasos OK\n`);

process.exit(allOk ? 0 : 1);
