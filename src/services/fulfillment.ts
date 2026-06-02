import { getProfileAddresses } from "./address.js";
import { type SavedAddress, attachShipping, readOrderForm } from "./shipping.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO 3 — Conciliación Logística + gate de checkout (Estado 4).
// simulate_stock es el ÚNICO validador de disponibilidad. Reconcilia el shipping
// DESPUÉS de que add_to_cart (Estado 2) modificó los items. Contrato: VTEX_CHECKOUT_RULES.md
// ─────────────────────────────────────────────────────────────────────────────

type SlaEntry = { id: string; shippingEstimate: string; polygonName?: string };
type LogisticsEntry = { itemId: string; slas: SlaEntry[] };
type SimulateResult = {
  available: boolean;
  slaName: string | null;
  shippingEstimate: string | null;
  polygon: string | null;
  address: SavedAddress | null;
};

// Función pura — interpreta logisticsInfo de VTEX. Testeable sin red.
export function parseSimulateResult(
  skuId: string,
  logisticsInfo: LogisticsEntry[] | undefined,
  address: SavedAddress,
): SimulateResult {
  const entry = logisticsInfo?.find((li) => li.itemId === skuId);
  if (!entry || entry.slas.length === 0) {
    return { available: false, slaName: null, shippingEstimate: null, polygon: null, address };
  }
  const sla = entry.slas[0];
  if (!sla) {
    return { available: false, slaName: null, shippingEstimate: null, polygon: null, address };
  }
  return {
    available: true,
    slaName: sla.id,
    shippingEstimate: sla.shippingEstimate,
    polygon: sla.polygonName ?? null,
    address,
  };
}

// Reconcilia el shipping para los items YA en el carrito y valida disponibilidad
// del SKU pedido. itemCount real → respeta el Principio del Carrito Vacío (sin
// items, attachShipping no manda logisticsInfo → no CHK0041).
export async function simulateStock(skuId: string, addressId: string): Promise<SimulateResult> {
  const addresses = await getProfileAddresses();
  const address = addresses.find((a) => a.addressId === addressId) ?? null;
  if (!address)
    throw new Error(
      `Dirección ${addressId} no encontrada. Usa get_addresses para ver las disponibles (con su addressId).`,
    );

  const of = await readOrderForm();
  const attached = await attachShipping(of.orderFormId, address, of.items?.length ?? 0);
  return parseSimulateResult(skuId, attached.shippingData?.logisticsInfo, address);
}

// ESTADO 4 gate — stateless. open_checkout DEBE llamar esto antes de abrir el browser.
// Falla si no se pasó por Estado 3 (calle ausente o logística sin reconciliar).
export async function assertCheckoutReady(): Promise<void> {
  const of = await readOrderForm();
  const itemCount = of.items?.length ?? 0;
  if (itemCount === 0) {
    throw new Error("Carrito vacío. Agrega productos (add_to_cart) antes de checkout.");
  }
  const street = of.shippingData?.address?.street;
  if (!street || street.trim().length === 0) {
    throw new Error(
      "Dirección sin calle. Ejecuta select_address (Estado 1) y simulate_stock (Estado 3) antes de checkout.",
    );
  }
  const logistics = of.shippingData?.logisticsInfo ?? [];
  const reconciled = logistics.filter((li) => li.selectedSla && li.selectedSla.length > 0).length;
  if (reconciled < itemCount) {
    throw new Error(
      `Logística sin reconciliar (${reconciled}/${itemCount} items). Ejecuta simulate_stock (Estado 3) antes de checkout.`,
    );
  }
}

// URL de checkout para el handoff humano (Estado 4). No interactúa con shipping.
export async function getCheckoutUrl(): Promise<string> {
  const of = await readOrderForm();
  return `https://www.plazavea.com.pe/checkout/#/cart?orderFormId=${of.orderFormId}`;
}
