// Smoke checkout — máquina de estados VTEX, DINÁMICO (cero hardcode).
// Descubre las direcciones reales del perfil y valida, para CADA una, que el
// street que VTEX clava coincide EXACTAMENTE con el street de esa dirección.
// Esto prueba genéricamente el bug de índice invertido (Comas/Cercado) sin
// depender de qué direcciones tenga la cuenta.
//
// Uso: bun run scripts/smoke-checkout.ts   (requiere sesión viva: plazavea login)
import { getAddresses, selectFulfillmentAddress } from "../src/services/address.js";
import { assertCheckoutReady, simulateStock } from "../src/services/fulfillment.js";
import { readShippingData } from "../src/services/shipping.js";
import { searchProducts } from "../src/services/products.js";

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

console.log("=== Smoke Checkout — máquina de estados VTEX (dinámico) ===\n");

try {
  // ── Estado 1: anclaje. Validar índice→street para CADA dirección real ──────
  // (carrito vacío al inicio → confirma además que NO hay CHK0041)
  const addrs = await getAddresses();
  if (addrs.length === 0) {
    ko("getAddresses vacío — no hay direcciones que probar");
  } else {
    ok(`getAddresses devuelve ${addrs.length} direcciones (fuente profile)`);
  }

  for (let i = 0; i < addrs.length; i++) {
    const expected = addrs[i];
    if (!expected) continue;
    try {
      await selectFulfillmentAddress(i); // carrito vacío → sin CHK0041
      const clavada = (await readShippingData())?.address?.street ?? "";
      if (clavada === expected.street && expected.street.trim().length > 0) {
        ok(`idx ${i}: street clavado == perfil ("${clavada}") — mapeo correcto, sin CHK0041`);
      } else {
        ko(`idx ${i}: esperaba "${expected.street}", VTEX clavó "${clavada}"`);
      }
    } catch (e) {
      ko(`idx ${i}: select_address lanzó ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Estados 2+3: agregar item dinámico → simular → checkout-ready ──────────
  const target = addrs[0];
  if (target) {
    const results = await searchProducts("arroz", 5);
    const sku = results.find((p) => p.inStock)?.skuId ?? results[0]?.skuId;
    if (!sku) {
      console.log("  (search sin resultados — paso items omitido)");
    } else {
      const { addToCart } = await import("../src/services/cart.js");
      await addToCart(sku, 1); // Estado 2
      const sim = await simulateStock(sku, target.addressId); // Estado 3
      if (sim.address?.street === target.street && target.street.trim().length > 0)
        ok(`simulate reconcilia con street del perfil ("${sim.address?.street}")`);
      else ko(`simulate street "${sim.address?.street}" != perfil "${target.street}"`);

      try {
        await assertCheckoutReady(); // Estado 4 gate
        ok("assertCheckoutReady pasa — logística reconciliada, listo para handoff");
      } catch (e) {
        ko(`assertCheckoutReady falló: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
} catch (e) {
  ko(`excepción: ${e instanceof Error ? e.message : String(e)}`);
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
