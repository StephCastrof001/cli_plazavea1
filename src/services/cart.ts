import { saveSelectedAddress } from "../config.js";
import { COUNTRY, ENDPOINTS, WWW_BASE_URL } from "../constants.js";
import { http } from "../http.js";
import { type CartNormalized, type OrderFormRaw, normalizeOrderForm } from "../schemas/cart.js";

async function getOrderFormId(): Promise<string> {
  const raw = await http.get<OrderFormRaw>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  return raw.orderFormId;
}

export async function getCart(): Promise<CartNormalized> {
  const raw = await http.get<Record<string, unknown>>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);

  // VTEX puede crear un carrito anónimo (loggedIn: false) si no reconoce la sesión.
  // Llamar /profiles fuerza a VTEX a vincular el orderForm al usuario autenticado
  // y sincronizarlo con el carrito que el usuario ve en el browser.
  if (raw.loggedIn === false) {
    await http.get(`${WWW_BASE_URL}/api/checkout/pub/profiles`).catch(() => {});
    const synced = await http.get<Record<string, unknown>>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
    return normalizeOrderForm(synced);
  }

  return normalizeOrderForm(raw);
}

async function bindProfileToCart(orderFormId: string): Promise<void> {
  // Bindea el carrito al usuario autenticado via clientProfileData.
  // Sin este bind, VTEX puede mantener el carrito del CLI separado del browser.
  try {
    const profile = await http.get<{ email?: string }>(`${WWW_BASE_URL}/api/checkout/pub/profiles`);
    if (profile?.email) {
      await http.post(
        `${WWW_BASE_URL}/api/checkout/pub/orderForm/${orderFormId}/attachments/clientProfileData`,
        { email: profile.email },
      );
    }
  } catch {
    // Non-fatal — el carrito funciona aunque no se pueda bindear el perfil
  }
}

export async function addToCart(
  skuId: string,
  quantity: number,
  seller = "1",
): Promise<CartNormalized> {
  const orderFormId = await getOrderFormId();
  const body = { orderItems: [{ id: skuId, quantity, seller }] };
  const raw = await http.post<unknown>(`${WWW_BASE_URL}${ENDPOINTS.addItem(orderFormId)}`, body);

  // Bindear perfil al orderForm para que el carrito sea visible en el browser web
  await bindProfileToCart(orderFormId);

  return normalizeOrderForm(raw);
}

export async function removeFromCart(itemIndex: number): Promise<CartNormalized> {
  const orderFormId = await getOrderFormId();
  const body = { orderItems: [{ index: itemIndex, quantity: 0 }] };
  // remove = PATCH con quantity 0 (patrón de antigravity v2)
  const raw = await http.patch<unknown>(
    `${WWW_BASE_URL}${ENDPOINTS.updateItem(orderFormId)}`,
    body,
  );
  return normalizeOrderForm(raw);
}

export interface SavedAddress {
  addressId: string;
  addressType: string;
  receiverName: string;
  neighborhood: string;
  street: string;
  number: string;
  city: string;
  postalCode: string;
}

interface OrderFormWithShipping {
  orderFormId: string;
  items: Array<{ id: string }>;
  shippingData?: {
    address?: SavedAddress; // dirección actualmente clavada (Fulfillment Gate)
    availableAddresses?: SavedAddress[];
    logisticsInfo?: Array<{
      itemId: string;
      selectedSla: string;
      slas: Array<{ id: string; shippingEstimate: string; polygonName?: string }>;
    }>;
  };
}

// Fulfillment Gate — selecciona una dirección y la "clava" en el orderForm.
// Esto hace que simulate_stock y el carrito usen stock local real desde el inicio.
export async function selectFulfillmentAddress(addressIndex: number): Promise<SavedAddress> {
  const raw = await http.get<OrderFormWithShipping>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  // Dirección COMPLETA desde profile (con street). Si clavamos availableAddresses
  // del orderForm (street:null) y el usuario va directo a checkout SIN pasar por
  // simulate_stock, el pago se rechaza con "campo calle no válido". Una sola fuente
  // de verdad (profile) para selectFulfillment y simulate elimina ese path roto.
  const addresses = await getProfileAddresses();
  const address = addresses[addressIndex] ?? null;
  if (!address)
    throw new Error(
      `Dirección ${addressIndex} no encontrada. Usa get_addresses para ver las disponibles.`,
    );

  // UN solo POST con address + logisticsInfo juntos — igual que simulateStock.
  // El split en 2 POSTs (address solo, luego logisticsInfo) dejaba el address en
  // estado vacío al re-leer el orderForm: VTEX descarta una dirección clavada sin
  // logisticsInfo asociado. Math.max(.,1) cubre el carrito vacío (Paso 1 del flujo).
  const itemCount = Math.max(raw.items?.length ?? 0, 1);
  await http.post(
    `${WWW_BASE_URL}/api/checkout/pub/orderForm/${raw.orderFormId}/attachments/shippingData`,
    {
      address,
      logisticsInfo: Array.from({ length: itemCount }, (_, i) => ({
        itemIndex: i,
        selectedSla: "Despacho a Domicilio",
        selectedDeliveryChannel: "delivery",
      })),
    },
  );

  saveSelectedAddress(addressIndex);
  return address;
}

export async function getCheckoutUrl(): Promise<string> {
  const raw = await http.get<{ orderFormId: string }>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  return `https://www.plazavea.com.pe/checkout/#/cart?orderFormId=${raw.orderFormId}`;
}

// Direcciones COMPLETAS (con street) desde el profile, NO desde el orderForm.
// El orderForm.availableAddresses viene stripped (street:null, neighborhood
// erróneo) — sirve para listar pero NO para clavar shipping (checkout rechaza
// "campo calle no válido"). El profile tiene la dirección tal cual la guardó el
// usuario en la web: street, neighborhood y todo correcto.
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

type SlaEntry = { id: string; shippingEstimate: string; polygonName?: string };
type LogisticsEntry = { itemId: string; slas: SlaEntry[] };
type SimulateResult = {
  available: boolean;
  slaName: string | null;
  shippingEstimate: string | null;
  polygon: string | null;
  address: SavedAddress | null;
};

// Función pura extraída para testabilidad — interpreta logisticsInfo de VTEX
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

export async function simulateStock(skuId: string, addressId: string): Promise<SimulateResult> {
  const raw = await http.get<OrderFormWithShipping>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  // Dirección COMPLETA desde profile (con street) — matchear por addressId estable.
  // Si usáramos orderForm.availableAddresses, street vendría null → attachShipping
  // clava una dirección sin calle → el checkout rechaza "campo calle no válido".
  const addresses = await getProfileAddresses();
  const address = addresses.find((a) => a.addressId === addressId) ?? null;

  if (!address)
    throw new Error(
      `Dirección ${addressId} no encontrada. Usa get_addresses para ver las disponibles (con su addressId).`,
    );

  // Patrón antigravity: attachShipping con la dirección elegida
  const itemCount = Math.max(raw.items?.length ?? 0, 1);
  const attachBody = {
    address,
    logisticsInfo: Array.from({ length: itemCount }, (_, i) => ({
      itemIndex: i,
      selectedSla: "Despacho a Domicilio",
      selectedDeliveryChannel: "delivery",
    })),
  };

  const attached = await http.post<OrderFormWithShipping>(
    `${WWW_BASE_URL}/api/checkout/pub/orderForm/${raw.orderFormId}/attachments/shippingData`,
    attachBody,
  );

  return parseSimulateResult(skuId, attached.shippingData?.logisticsInfo, address);
}
