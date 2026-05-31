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
    availableAddresses?: SavedAddress[];
    logisticsInfo?: Array<{
      itemId: string;
      selectedSla: string;
      slas: Array<{ id: string; shippingEstimate: string; polygonName?: string }>;
    }>;
  };
}

export async function getAddresses(): Promise<SavedAddress[]> {
  const raw = await http.get<OrderFormWithShipping>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  return raw.shippingData?.availableAddresses ?? [];
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
  return {
    available: true,
    slaName: sla.id,
    shippingEstimate: sla.shippingEstimate,
    polygon: sla.polygonName ?? null,
    address,
  };
}

export async function simulateStock(skuId: string, addressIndex = 0): Promise<SimulateResult> {
  const raw = await http.get<OrderFormWithShipping>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  const addresses = raw.shippingData?.availableAddresses ?? [];
  const address = addresses[addressIndex] ?? null;

  if (!address)
    throw new Error(
      "No hay direcciones guardadas en tu cuenta Plaza Vea. Guarda una dirección en la app o web primero.",
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
