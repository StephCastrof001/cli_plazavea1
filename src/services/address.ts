import { saveSelectedAddress } from "../config.js";
import { ENDPOINTS, WWW_BASE_URL } from "../constants.js";
import { http } from "../http.js";
import { type SavedAddress, attachShipping, readOrderForm } from "./shipping.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO 1 — Anclaje Logístico. select_address SOLO ancla la ubicación.
// No valida stock (eso es Estado 3, fulfillment.ts). Contrato: VTEX_CHECKOUT_RULES.md
// ─────────────────────────────────────────────────────────────────────────────

// Direcciones COMPLETAS (con street) desde el profile, NO desde el orderForm.
// orderForm.availableAddresses viene stripped (street:null, orden distinto) — sirve
// para listar pero NO para registrar el envío (checkout rechaza "campo calle no válido").
// El profile tiene la dirección tal cual la guardó el usuario: street, neighborhood, todo.
export async function getProfileAddresses(): Promise<SavedAddress[]> {
  const of = await http.get<{ clientProfileData?: { email?: string } }>(
    `${WWW_BASE_URL}${ENDPOINTS.orderForm}`,
  );
  const email = of.clientProfileData?.email;
  if (!email) return [];
  const profile = await http.get<{ availableAddresses?: SavedAddress[] }>(
    `${WWW_BASE_URL}${ENDPOINTS.profile}?email=${encodeURIComponent(email)}`,
  );
  return profile.availableAddresses ?? [];
}

export async function getAddresses(): Promise<SavedAddress[]> {
  return getProfileAddresses();
}

// Ancla una dirección en el orderForm. Híbrido Inteligente vía attachShipping:
// carrito vacío → solo address (sin CHK0041); con items → address + logisticsInfo.
// Una sola fuente de verdad (profile) e índice consistente con getAddresses.
export async function selectFulfillmentAddress(addressIndex: number): Promise<SavedAddress> {
  const addresses = await getProfileAddresses();
  const address = addresses[addressIndex] ?? null;
  if (!address)
    throw new Error(
      `Dirección ${addressIndex} no encontrada. Usa get_addresses para ver las disponibles.`,
    );

  const of = await readOrderForm();
  await attachShipping(of.orderFormId, address, of.items?.length ?? 0);

  saveSelectedAddress(addressIndex);
  return address;
}
