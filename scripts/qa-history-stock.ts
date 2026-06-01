// QA: toma productos del histórico real de pedidos y simula cada uno en
// AMBAS direcciones (por addressId). Marca dónde Comas y Rimac DIFIEREN.
import { getOrders } from "../src/services/orders.js";
import { ensureOrderDetails } from "../src/services/analytics.js";
import { simulateStock, getAddresses } from "../src/services/cart.js";

const addrs = await getAddresses();
if (addrs.length < 2) {
  console.log("Necesito 2 direcciones para comparar.");
  process.exit(0);
}
console.log(`=== Direcciones ===`);
addrs.forEach((a) => console.log(`  ${a.neighborhood} (id ${a.addressId.slice(0, 8)}…)`));

// 1. Histórico → últimos pedidos → detalles → productos únicos
const orders = await getOrders(8);
const detailMap = await ensureOrderDetails(orders.map((o) => o.orderId));
const seen = new Map<string, string>(); // skuId → name
for (const detail of Object.values(detailMap)) {
  for (const item of detail.items) {
    if (!seen.has(item.id)) seen.set(item.id, item.name);
  }
}
const products = [...seen.entries()].slice(0, 8); // límite 8 para no demorar
console.log(`\n=== ${products.length} productos del histórico — simulando en ambas ===\n`);

let diffs = 0;
for (const [sku, name] of products) {
  const out: Record<string, boolean> = {};
  for (const a of addrs) {
    try {
      const r = await simulateStock(sku, a.addressId);
      out[a.neighborhood] = r.available;
    } catch {
      out[a.neighborhood] = false;
    }
  }
  const vals = Object.values(out);
  const differ = new Set(vals).size > 1;
  if (differ) diffs++;
  const flag = differ ? "⚠ DIFIERE" : "";
  const cols = addrs.map((a) => `${a.neighborhood}:${out[a.neighborhood] ? "✓" : "✗"}`).join("  ");
  console.log(`  ${name.slice(0, 40).padEnd(40)} ${cols}  ${flag}`);
}

console.log(`\n=== ${diffs}/${products.length} productos con stock DISTINTO entre direcciones ===`);
