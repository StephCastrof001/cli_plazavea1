import { z } from "zod";
import { ENDPOINTS } from "../constants.js";
import { http } from "../http.js";

const OrderSchema = z.object({
  orderId: z.string(),
  creationDate: z.string(),
  clientName: z.string().optional(),
  value: z.number(),
  status: z.string(),
  statusDescription: z.string().optional(),
}).catchall(z.unknown());

const OrdersResponseSchema = z.object({
  list: z.array(OrderSchema).default([]),
  paging: z.object({ total: z.number(), pages: z.number() }).optional(),
}).catchall(z.unknown());

export type Order = z.infer<typeof OrderSchema>;

export async function getOrders(limit = 10): Promise<Order[]> {
  const raw = await http.get<unknown>(`${ENDPOINTS.orders}?page=1&per_page=${limit}`);
  const parsed = OrdersResponseSchema.parse(raw);
  return parsed.list.map((o) => ({
    ...o,
    value: o.value / 100, // centavos → soles
  }));
}
