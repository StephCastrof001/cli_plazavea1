import { z } from "zod";

// Availability states que VTEX puede devolver
const AvailabilitySchema = z.enum([
  "available",
  "withoutStock",
  "cannotBeDelivered",
  "unavailableItemFound",
]);

const CartItemRawSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    // VTEX devuelve sellingPrice en centavos (1590 = S/ 15.90)
    sellingPrice: z.number(),
    availability: AvailabilitySchema.catch("available"),
  })
  .catchall(z.unknown());

const TotalizerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
  })
  .catchall(z.unknown());

export const OrderFormRawSchema = z
  .object({
    orderFormId: z.string(),
    items: z.array(CartItemRawSchema).default([]),
    totalizers: z.array(TotalizerSchema).default([]),
    shippingData: z
      .object({
        logisticsInfo: z.array(z.unknown()).default([]),
      })
      .nullable()
      .optional(),
  })
  .catchall(z.unknown());

export type OrderFormRaw = z.infer<typeof OrderFormRawSchema>;

// --- NORMALIZADO ---

export const CartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number(),
  sellingPrice: z.number(), // ya en soles (dividido por 100 del raw)
  total: z.number(),
  availability: AvailabilitySchema,
});

export const CartNormalizedSchema = z.object({
  orderFormId: z.string(),
  items: z.array(CartItemSchema),
  totalValue: z.number(),
  shippingValue: z.number(),
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type CartNormalized = z.infer<typeof CartNormalizedSchema>;

// --- MAPPER ---

export function normalizeOrderForm(raw: unknown): CartNormalized {
  const parsed = OrderFormRawSchema.parse(raw);

  const items = parsed.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    sellingPrice: item.sellingPrice / 100, // centavos → soles
    total: (item.sellingPrice / 100) * item.quantity,
    availability: item.availability,
  }));

  const totalValue =
    parsed.totalizers.find((t) => t.id === "Items")?.value ?? 0;
  const shippingValue =
    parsed.totalizers.find((t) => t.id === "Shipping")?.value ?? 0;

  return {
    orderFormId: parsed.orderFormId,
    items,
    totalValue: totalValue / 100,
    shippingValue: shippingValue / 100,
  };
}
