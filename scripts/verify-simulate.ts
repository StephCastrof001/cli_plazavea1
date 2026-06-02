// QA: simula el MISMO producto contra las 2 direcciones (por addressId).
// Prueba que el stock se calcula según la dirección elegida — sin drift.
import { searchProducts } from "../src/services/products.js";
import { simulateStock, getAddresses } from "../src/services/cart.js";

const addrs = await getAddresses();
console.log("=== Direcciones (con addressId) ===");
addrs.forEach((a, i) =>
  console.log(`  [${i}] ${a.neighborhood} (${a.number})  id=${a.addressId.slice(0, 8)}…`),
);

const results = await searchProducts("arroz costeño 5kg", 1);
const sku = results[0]?.skuId;
console.log(`\n=== Producto: ${results[0]?.name} (sku ${sku}) ===\n`);

for (const a of addrs) {
  const r = await simulateStock(sku as string, a.addressId);
  const match = r.address?.addressId === a.addressId ? "✓ id coincide" : "✖ id NO coincide";
  console.log(
    `${a.neighborhood.padEnd(8)} → simuló: ${r.address?.neighborhood?.padEnd(8)} | available: ${r.available} | ${match}`,
  );
}
