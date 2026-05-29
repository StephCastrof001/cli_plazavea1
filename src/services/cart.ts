import { COUNTRY, ENDPOINTS } from "../constants.js";
import { http } from "../http.js";
import { type CartNormalized, type OrderFormRaw, normalizeOrderForm } from "../schemas/cart.js";

async function getOrderFormId(): Promise<string> {
  const raw = await http.get<OrderFormRaw>(ENDPOINTS.orderForm);
  return raw.orderFormId;
}

export async function getCart(): Promise<CartNormalized> {
  const raw = await http.get<unknown>(`${ENDPOINTS.orderForm}?sc=1`);
  return normalizeOrderForm(raw);
}

export async function addToCart(
  skuId: string,
  quantity: number,
  seller = "1",
): Promise<CartNormalized> {
  const orderFormId = await getOrderFormId();
  const body = {
    expectedOrderFormSections: ["items", "totalizers", "clientProfileData", "shippingData"],
    orderItems: [{ id: skuId, quantity, seller }],
  };
  const raw = await http.post<unknown>(ENDPOINTS.addItem(orderFormId), body);
  return normalizeOrderForm(raw);
}

export async function removeFromCart(itemIndex: number): Promise<CartNormalized> {
  const orderFormId = await getOrderFormId();
  const body = {
    expectedOrderFormSections: ["items", "totalizers", "clientProfileData", "shippingData"],
    orderItems: [{ index: itemIndex, quantity: 0 }],
  };
  const raw = await http.post<unknown>(ENDPOINTS.updateItem(orderFormId), body);
  return normalizeOrderForm(raw);
}

export async function simulateStock(
  skuId: string,
  postalCode: string,
  quantity = 1,
  seller = "1",
): Promise<{ available: boolean; postalCode: string }> {
  const body = {
    items: [{ id: skuId, quantity, seller }],
    postalCode,
    country: COUNTRY,
  };
  const raw = await http.post<{ items: Array<{ availability: string }> }>(ENDPOINTS.simulate, body);
  const availability = raw.items[0]?.availability ?? "withoutStock";
  return { available: availability === "available", postalCode };
}
