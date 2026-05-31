import { z } from "zod";
import { ENDPOINTS, OMS_BASE_URL } from "../constants.js";
import { http } from "../http.js";

// Estados exactos de VTEX OMS — NO interpretar más allá de este mapa.
// Si el status no está aquí, devolver el valor crudo sin traducir.
export const VTEX_STATUS_MAP: Record<string, string> = {
  "payment-pending": "Pago pendiente",
  "payment-approved": "Pago aprobado",
  "ready-for-handling": "Listo para procesar",
  handling: "En preparación",
  invoiced: "Facturado / Enviado",
  "order-completed": "Completado",
  "on-order-completed": "Completado",
  canceled: "Cancelado",
  "cancellation-requested": "Cancelación solicitada",
  "window-to-cancel": "Período de cancelación",
  "approve-payment": "Aprobando pago",
  "request-cancel": "Solicitud de cancelación",
};

export function mapVtexStatus(raw: string): string {
  return VTEX_STATUS_MAP[raw] ?? raw;
}

const OrderSchema = z
  .object({
    orderId: z.string(),
    creationDate: z.string(),
    clientName: z.string().optional(),
    totalValue: z.number(),
    totalItems: z.number().optional(),
    currencyCode: z.string().optional(),
    status: z.string(),
    statusDescription: z.string().optional(),
  })
  .catchall(z.unknown());

const OrdersResponseSchema = z
  .object({
    list: z.array(OrderSchema).default([]),
    paging: z.object({ total: z.number(), pages: z.number() }).optional(),
  })
  .catchall(z.unknown());

export type Order = z.infer<typeof OrderSchema> & { statusLabel: string };

export async function getOrders(limit = 10): Promise<Order[]> {
  const raw = await http.get<unknown>(
    `${OMS_BASE_URL}${ENDPOINTS.orders}?page=1&per_page=${limit}`,
  );
  const parsed = OrdersResponseSchema.parse(raw);
  return parsed.list.map((o) => ({
    ...o,
    totalValue: o.totalValue / 100,
    statusLabel: mapVtexStatus(o.status), // label legible + status crudo siempre presente
  }));
}
