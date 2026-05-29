import { COUNTRY, ENDPOINTS, WWW_BASE_URL } from "../constants.js";
import { http } from "../http.js";
import { type CartNormalized, type OrderFormRaw, normalizeOrderForm } from "../schemas/cart.js";

async function getOrderFormId(): Promise<string> {
  const raw = await http.get<OrderFormRaw>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  return raw.orderFormId;
}

export async function getCart(): Promise<CartNormalized> {
  const raw = await http.get<unknown>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
  return normalizeOrderForm(raw);
}

export async function addToCart(
  skuId: string,
  quantity: number,
  seller = "1",
): Promise<CartNormalized> {
  const orderFormId = await getOrderFormId();
  const body = { orderItems: [{ id: skuId, quantity, seller }] };
  const raw = await http.post<unknown>(`${WWW_BASE_URL}${ENDPOINTS.addItem(orderFormId)}`, body);
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

type RegionItem = { id: string; sellers: Array<{ id: string }> };

async function getLocalSeller(postalCode: string): Promise<{ seller: string; regionId: string }> {
  const raw = await http.get<RegionItem[]>(ENDPOINTS.regions(postalCode));
  const region = Array.isArray(raw) ? raw[0] : undefined;
  if (!region?.id) throw new Error(`No hay local de Plaza Vea para el código postal ${postalCode}`);
  const seller = region.sellers[0]?.id ?? "1";
  return { seller, regionId: region.id };
}

export async function simulateStock(
  skuId: string,
  postalCode: string,
  quantity = 1,
): Promise<{ available: boolean; postalCode: string; seller: string }> {
  const { seller } = await getLocalSeller(postalCode);
  const body = {
    items: [{ id: skuId, quantity, seller }],
    postalCode,
    country: COUNTRY,
  };
  const raw = await http.post<{ items: Array<{ availability: string }> }>(ENDPOINTS.simulate, body);
  const availability = raw.items[0]?.availability ?? "withoutStock";
  return { available: availability === "available", postalCode, seller };
}
