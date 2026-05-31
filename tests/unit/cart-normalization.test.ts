import { expect, test } from "bun:test";
import { normalizeOrderForm } from "../../src/schemas/cart.js";

// --- Fixture builder: orderForm raw VTEX mínimo ---

interface ItemOpts {
  id?: string;
  name?: string;
  quantity?: number;
  sellingPrice?: number; // centavos
  availability?: string;
}

function makeOrderForm(opts: {
  items?: ItemOpts[];
  totalizers?: Array<{ id: string; value: number }>;
} = {}) {
  return {
    orderFormId: "OF-123",
    items: (opts.items ?? []).map((i) => ({
      id: i.id ?? "SKU-1",
      name: i.name ?? "Item",
      quantity: i.quantity ?? 1,
      sellingPrice: i.sellingPrice ?? 0,
      availability: i.availability ?? "available",
    })),
    totalizers: (opts.totalizers ?? []).map((t) => ({
      id: t.id,
      name: t.id,
      value: t.value,
    })),
  };
}

// --- Centavos → soles ---

test("convierte sellingPrice de centavos a soles", () => {
  const raw = makeOrderForm({ items: [{ sellingPrice: 1590 }] });
  const cart = normalizeOrderForm(raw);
  expect(cart.items[0]?.sellingPrice).toBe(15.9);
});

test("total = precio * cantidad en soles", () => {
  const raw = makeOrderForm({ items: [{ sellingPrice: 1590, quantity: 3 }] });
  const cart = normalizeOrderForm(raw);
  expect(cart.items[0]?.total).toBeCloseTo(47.7, 5);
});

// --- Totalizers ---

test("totalValue toma totalizer Items en soles", () => {
  const raw = makeOrderForm({ totalizers: [{ id: "Items", value: 4770 }] });
  const cart = normalizeOrderForm(raw);
  expect(cart.totalValue).toBe(47.7);
});

test("shippingValue toma totalizer Shipping en soles", () => {
  const raw = makeOrderForm({ totalizers: [{ id: "Shipping", value: 990 }] });
  const cart = normalizeOrderForm(raw);
  expect(cart.shippingValue).toBe(9.9);
});

test("totalValue y shippingValue son 0 si no existen totalizers", () => {
  const raw = makeOrderForm({});
  const cart = normalizeOrderForm(raw);
  expect(cart.totalValue).toBe(0);
  expect(cart.shippingValue).toBe(0);
});

// --- Availability ---

test("preserva availability withoutStock", () => {
  const raw = makeOrderForm({ items: [{ availability: "withoutStock" }] });
  const cart = normalizeOrderForm(raw);
  expect(cart.items[0]?.availability).toBe("withoutStock");
});

test("availability inválida cae a available (catch)", () => {
  const raw = makeOrderForm({ items: [{ availability: "estadoInventado" }] });
  const cart = normalizeOrderForm(raw);
  expect(cart.items[0]?.availability).toBe("available");
});

// --- Carrito vacío ---

test("carrito sin items devuelve lista vacía", () => {
  const cart = normalizeOrderForm({ orderFormId: "OF-1" });
  expect(cart.items).toEqual([]);
  expect(cart.totalValue).toBe(0);
});

test("preserva orderFormId", () => {
  const cart = normalizeOrderForm(makeOrderForm({}));
  expect(cart.orderFormId).toBe("OF-123");
});
