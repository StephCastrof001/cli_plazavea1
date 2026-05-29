import { z } from "zod";

export const PriceEntrySchema = z.object({
  date: z.string(),
  price: z.number(),
  listPrice: z.number(),
});

export const TrackedProductSchema = z.object({
  productId: z.string(),
  skuId: z.string(),
  name: z.string(),
  brand: z.string(),
  alert: z.number().optional(),
  history: z.array(PriceEntrySchema).default([]),
});

export const PriceStoreSchema = z.object({
  tracked: z.record(z.string(), TrackedProductSchema).default({}),
});

export type PriceEntry = z.infer<typeof PriceEntrySchema>;
export type TrackedProduct = z.infer<typeof TrackedProductSchema>;
export type PriceStore = z.infer<typeof PriceStoreSchema>;
