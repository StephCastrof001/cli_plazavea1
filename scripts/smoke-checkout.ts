// Smoke checkout — guarda contra el bug "campo calle no válido".
// Valida que las direcciones tengan street COMPLETO (fuente profile, no orderForm)
// y que la dirección clavada por simulate sea válida para checkout.
//
// Uso: bun run scripts/smoke-checkout.ts
import { WWW_BASE_URL, ENDPOINTS } from "../src/constants.js";
import { http } from "../src/http.js";
import { getAddresses, simulateStock } from "../src/services/cart.js";

let pass = 0;
let fail = 0;
const ok = (m: string) => { console.log(`  ✔ ${m}`); pass++; };
const ko = (m: string) => { console.error(`  ✖ ${m}`); fail++; };

console.log("=== Smoke Checkout (regresión campo calle) ===\n");

try {
  // 1. getAddresses (profile) → cada dirección con street no vacío
  const addrs = await getAddresses();
  if (addrs.length > 0) ok(`getAddresses devuelve ${addrs.length} direcciones`);
  else ko("getAddresses vacío");

  const conStreet = addrs.filter((a) => a.street && a.street.trim().length > 0);
  if (conStreet.length === addrs.length && addrs.length > 0)
    ok("todas las direcciones tienen street (fuente profile, no orderForm stripped)");
  else ko(`${addrs.length - conStreet.length} direcciones SIN street → checkout rechazaría`);

  // 2. simular un item del carrito → la dirección resuelta tiene street
  const of = await http.get<{ items?: Array<{ id: string }> }>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  const item = of.items?.[0];
  const target = addrs[0];
  if (item && target) {
    const r = await simulateStock(item.id, target.addressId);
    if (r.address?.street && r.address.street.trim().length > 0)
      ok(`simulate devuelve dirección con street ("${r.address.street}")`);
    else ko("simulate devolvió dirección sin street");

    // 3. la dirección CLAVADA (la que valida el pago) tiene street
    const after = await http.get<{ shippingData?: { address?: { street?: string | null } } }>(
      `${WWW_BASE_URL}${ENDPOINTS.orderForm}`,
    );
    const clavada = after.shippingData?.address?.street;
    if (clavada && clavada.trim().length > 0)
      ok(`shippingData clavada tiene street ("${clavada}") — checkout no rechaza`);
    else ko("shippingData clavada SIN street → 'campo calle no válido' en pago");
  } else {
    console.log("  (carrito vacío o sin direcciones — paso simulate omitido)");
  }
} catch (e) {
  ko(`excepción: ${e instanceof Error ? e.message : String(e)}`);
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
