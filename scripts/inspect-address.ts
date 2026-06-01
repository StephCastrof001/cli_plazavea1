// Read-only: compara shippingData.address (clavada) vs availableAddresses[i].
// NO hace POST. Diagnóstico del bug de simulate.
import { WWW_BASE_URL, ENDPOINTS } from "../src/constants.js";
import { http } from "../src/http.js";

const raw = await http.get<{
  shippingData?: { address?: unknown; availableAddresses?: unknown[] };
}>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);

console.log("=== shippingData.address (CLAVADA, la que usa mi fix) ===");
console.log(JSON.stringify(raw.shippingData?.address, null, 2));
console.log("\n=== availableAddresses[0] (COMPLETA, la del código viejo) ===");
console.log(JSON.stringify(raw.shippingData?.availableAddresses?.[0], null, 2));
console.log(`\n=== total availableAddresses: ${raw.shippingData?.availableAddresses?.length} ===`);
