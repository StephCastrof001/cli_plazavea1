import { expect, test } from "bun:test";
import { normalizeVtexSearch } from "../../src/schemas/product.js";

// --- Fixture builder: arma un raw VTEX mínimo válido ---

interface OfferOpts {
  price?: number;
  listPrice?: number;
  available?: number;
  isAvailable?: boolean;
  teaserNames?: string[];
  installmentName?: string;
}

function makeOffer(o: OfferOpts = {}) {
  return {
    Price: o.price ?? 19.9,
    ListPrice: o.listPrice ?? 19.9,
    AvailableQuantity: o.available ?? 10,
    IsAvailable: o.isAvailable ?? true,
    Teasers: (o.teaserNames ?? []).map((name) => ({
      "<Name>k__BackingField": name,
    })),
    Installments: o.installmentName ? [{ Name: o.installmentName, Value: 0 }] : [],
  };
}

function makeProduct(opts: {
  productName?: string;
  brand?: string;
  itemId?: string;
  sellers?: Array<{ sellerId: string; offer: OfferOpts }>;
}) {
  const sellers = opts.sellers ?? [{ sellerId: "1", offer: {} }];
  return {
    productId: "P1",
    productName: opts.productName ?? "Producto Test",
    brand: opts.brand ?? "MarcaTest",
    link: "https://tienda.plazavea.com.pe/p/test",
    items: [
      {
        itemId: opts.itemId ?? "SKU-1",
        name: "item",
        sellers: sellers.map((s) => ({
          sellerId: s.sellerId,
          sellerName: `Seller ${s.sellerId}`,
          commertialOffer: makeOffer(s.offer),
        })),
      },
    ],
  };
}

// --- OH desde Teasers (campaña tipo 1) ---

test("extrae precio OH desde Teasers", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { teaserNames: ["Tarjeta oh! S/ 12.50"] } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.oh).toBe(12.5);
});

test("extrae OH desde Teaser con coma decimal", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { teaserNames: ["Precio oh! S/ 8,90"] } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.oh).toBe(8.9);
});

// --- OH desde Installments (campaña tipo 2) ---

test("extrae precio OH desde Installments cuando Teasers vacío", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { installmentName: "Tarjeta OH S/ 9.90" } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.oh).toBe(9.9);
});

// --- Sin OH ---

test("oh es null cuando no hay teaser ni installment OH", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { teaserNames: ["Promo 2x1"] } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.oh).toBeNull();
});

test("oh es null cuando teaser dice oh pero sin precio parseable", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { teaserNames: ["Tarjeta oh! descuento"] } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.oh).toBeNull();
});

// --- LED (descuento sin tarjeta) ---

test("led se setea cuando Price < ListPrice", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { price: 15.9, listPrice: 19.9 } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.regular).toBe(19.9);
  expect(result?.prices.led).toBe(15.9);
});

test("led es null cuando Price == ListPrice", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { price: 19.9, listPrice: 19.9 } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.led).toBeNull();
});

// --- Limpieza de nombre (packs VTEX) ---

test("limpia (x2) del nombre de producto", () => {
  const raw = [makeProduct({ productName: "Arroz Costeño Extra (x2)" })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.name).toBe("Arroz Costeño Extra");
});

test("limpia (x3) case-insensitive", () => {
  const raw = [makeProduct({ productName: "Atún Florida (X3)" })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.name).toBe("Atún Florida");
});

// --- Preferencia de seller "1" (Plaza Vea directo) ---

test("prefiere seller 1 sobre otros sellers", () => {
  const raw = [
    makeProduct({
      sellers: [
        { sellerId: "3", offer: { listPrice: 99.9 } },
        { sellerId: "1", offer: { listPrice: 19.9 } },
      ],
    }),
  ];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.regular).toBe(19.9);
});

test("usa primer seller si no existe seller 1", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "5", offer: { listPrice: 49.9 } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.prices.regular).toBe(49.9);
});

// --- inStock ---

test("inStock true cuando hay cantidad y disponible", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { available: 5, isAvailable: true } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.inStock).toBe(true);
});

test("inStock false cuando AvailableQuantity es 0", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { available: 0, isAvailable: true } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.inStock).toBe(false);
});

test("inStock false cuando IsAvailable es false", () => {
  const raw = [makeProduct({ sellers: [{ sellerId: "1", offer: { available: 10, isAvailable: false } }] })];
  const [result] = normalizeVtexSearch(raw);
  expect(result?.inStock).toBe(false);
});
