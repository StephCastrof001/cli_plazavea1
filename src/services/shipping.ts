import { ENDPOINTS, WWW_BASE_URL } from "../constants.js";
import { http } from "../http.js";

// ─────────────────────────────────────────────────────────────────────────────
// NÚCLEO AISLADO de shippingData. Único módulo que hace POST a shippingData.
// Contrato: docs/VTEX_CHECKOUT_RULES.md. NADIE más toca este endpoint —
// ni cart.ts (items), ni los commands directamente.
// ─────────────────────────────────────────────────────────────────────────────

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

export interface ShippingState {
  address?: SavedAddress; // dirección de envío actualmente guardada (Selección de dirección)
  availableAddresses?: SavedAddress[];
  logisticsInfo?: Array<{
    itemId: string;
    selectedSla: string;
    slas: Array<{ id: string; shippingEstimate: string; polygonName?: string }>;
  }>;
}

export interface OrderFormWithShipping {
  orderFormId: string;
  items: Array<{ id: string }>;
  shippingData?: ShippingState;
}

// Híbrido Inteligente — la ÚNICA forma correcta de registrar el envío en VTEX.
//   - itemCount === 0 → body { address } solo. logisticsInfo referenciaría
//     itemIndex:0 inexistente → CHK0041. (Principio del Carrito Vacío.)
//   - itemCount  >  0 → body { address, logisticsInfo } JUNTOS en un POST.
//     Separarlos borra la calle. (Principio del Carrito Lleno.)
// Función pura — la decisión del body es testeable sin red.
export function buildShippingBody(address: SavedAddress, itemCount: number) {
  return itemCount > 0
    ? {
        address,
        logisticsInfo: Array.from({ length: itemCount }, (_, i) => ({
          itemIndex: i,
          selectedSla: "Despacho a Domicilio",
          selectedDeliveryChannel: "delivery",
        })),
      }
    : { address };
}

export async function attachShipping(
  orderFormId: string,
  address: SavedAddress,
  itemCount: number,
): Promise<OrderFormWithShipping> {
  const body = buildShippingBody(address, itemCount);

  return http.post<OrderFormWithShipping>(
    `${WWW_BASE_URL}/api/checkout/pub/orderForm/${orderFormId}/attachments/shippingData`,
    body,
  );
}

// Lee el orderForm crudo (con shippingData) — para anclar, simular y el gate de checkout.
export async function readOrderForm(): Promise<OrderFormWithShipping> {
  return http.get<OrderFormWithShipping>(`${WWW_BASE_URL}${ENDPOINTS.orderForm}`);
}

// Lee solo el estado de envío actualmente guardado.
export async function readShippingData(): Promise<ShippingState | undefined> {
  const of = await readOrderForm();
  return of.shippingData;
}
