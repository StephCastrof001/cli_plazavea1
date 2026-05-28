import { z } from "zod";

// --- RAW VTEX (lo que devuelve la API) ---

const TeaserSchema = z
  .object({
    "<Name>k__BackingField": z.string(),
    "<Effects>k__BackingField": z
      .object({
        "<Parameters>k__BackingField": z.array(
          z.object({
            "<Name>k__BackingField": z.string(),
            "<Value>k__BackingField": z.string(),
          }),
        ),
      })
      .optional(),
  })
  .catchall(z.unknown());

const InstallmentSchema = z
  .object({
    Name: z.string().optional(),
    Value: z.number().optional(),
  })
  .catchall(z.unknown());

const CommercialOfferSchema = z
  .object({
    Price: z.number(),
    ListPrice: z.number(),
    AvailableQuantity: z.number(),
    IsAvailable: z.boolean().default(false),
    Teasers: z.array(TeaserSchema).default([]),
    Installments: z.array(InstallmentSchema).default([]),
  })
  .catchall(z.unknown());

const SellerSchema = z
  .object({
    sellerId: z.string(),
    sellerName: z.string().optional(),
    commertialOffer: CommercialOfferSchema,
  })
  .catchall(z.unknown());

const VtexItemSchema = z
  .object({
    itemId: z.string(),
    name: z.string(),
    ean: z.string().optional(),
    sellers: z.array(SellerSchema),
  })
  .catchall(z.unknown());

export const VtexSearchRawSchema = z.array(
  z
    .object({
      productId: z.string(),
      productName: z.string(),
      brand: z.string().optional().default("Genérico"),
      link: z.string(),
      items: z.array(VtexItemSchema),
    })
    .catchall(z.unknown()),
);

// --- NORMALIZADO (lo que usa el CLI) ---

export interface PriceInfo {
  regular: number;       // precio base, siempre presente
  led: number | null;    // Low Every Day / oferta sin tarjeta — null si no aplica
  oh: number | null;     // Tarjeta OH — null si no aplica
}

export const ProductResultSchema = z.object({
  productId: z.string(),
  skuId: z.string(),
  name: z.string(),
  brand: z.string(),
  prices: z.object({
    regular: z.number(),
    led: z.number().nullable(),
    oh: z.number().nullable(),
  }),
  inStock: z.boolean(),
});

export type ProductResult = z.infer<typeof ProductResultSchema>;

// --- EXTRACCIÓN DE PRECIOS ---

function extractOhPrice(offer: z.infer<typeof CommercialOfferSchema>): number | null {
  // Lugar 1: Teasers (formato: "Tarjeta oh! S/ X.XX" o similar)
  for (const t of offer.Teasers) {
    const name = t["<Name>k__BackingField"] ?? "";
    if (name.toLowerCase().includes("oh")) {
      const m = name.match(/S\/\s*([0-9]+[.,][0-9]+)/);
      if (m?.[1]) return parseFloat(m[1].replace(",", "."));
    }
  }
  // Lugar 2: Installments[0].Name (formato alternativo de campaña)
  const instName = offer.Installments[0]?.Name ?? "";
  if (instName.toLowerCase().includes("oh")) {
    const m = instName.match(/S\/\s*([0-9]+[.,][0-9]+)/);
    if (m?.[1]) return parseFloat(m[1].replace(",", "."));
  }
  return null;
}

// --- MAPPER ---

export function normalizeVtexSearch(rawArray: unknown[]): ProductResult[] {
  const parsed = VtexSearchRawSchema.parse(rawArray);

  return parsed.map((product) => {
    const item = product.items[0];
    if (!item) throw new Error(`Product ${product.productId} has no items`);

    // Preferir seller "1" (Plaza Vea directo), fallback al primero
    const seller =
      item.sellers.find((s) => s.sellerId === "1") ?? item.sellers[0];
    if (!seller) throw new Error(`Product ${product.productId} has no sellers`);

    const offer = seller.commertialOffer;

    // LED: si Price < ListPrice → hay descuento base
    const led = offer.Price < offer.ListPrice ? offer.Price : null;
    const oh = extractOhPrice(offer);

    // Limpiar nombre: remover (x2), (x3) de packs VTEX
    const name = product.productName.replace(/\(x\d+\)/gi, "").trim();

    return {
      productId: product.productId,
      skuId: item.itemId,
      name,
      brand: product.brand,
      prices: {
        regular: offer.ListPrice,
        led,
        oh,
      },
      inStock: offer.AvailableQuantity > 0 && offer.IsAvailable,
    };
  });
}
