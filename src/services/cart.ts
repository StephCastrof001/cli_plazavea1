import { ENDPOINTS, WWW_BASE_URL } from "../constants.js";
import { http } from "../http.js";
import { type CartNormalized, type OrderFormRaw, normalizeOrderForm } from "../schemas/cart.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO 2 — Operación del Carrito. SOLO items (add/remove/get).
// PROHIBIDO tocar el envío desde aquí (Contrato: VTEX_CHECKOUT_RULES.md).
// El anclaje de dirección vive en address.ts; la conciliación, en fulfillment.ts.
// Invariante de desacople: este archivo no referencia el endpoint de envío.
// ─────────────────────────────────────────────────────────────────────────────

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
