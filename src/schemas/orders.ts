import { z } from "zod";

export const OrderDetailItemSchema = z
  .object({
    id: z.string(),
    productId: z.string().optional(),
    name: z.string(),
    quantity: z.number(),
    sellingPrice: z.number(), // centavos
  })
  .catchall(z.unknown());

export const OrderDetailSchema = z
  .object({
    orderId: z.string(),
    creationDate: z.string().optional(),
    status: z.string().optional(),
    value: z.number().optional(), // centavos
    items: z.array(OrderDetailItemSchema).default([]),
  })
  .catchall(z.unknown());

export const OrdersCacheSchema = z.object({
  fetchedAt: z.number().default(0),
  details: z.record(z.string(), OrderDetailSchema).default({}),
});

export type OrderDetail = z.infer<typeof OrderDetailSchema>;
export type OrdersCache = z.infer<typeof OrdersCacheSchema>;
