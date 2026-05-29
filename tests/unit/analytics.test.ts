import { expect, test } from "bun:test";
import { buildAnalytics } from "../../src/services/analytics.js";
import type { OrderDetail } from "../../src/schemas/orders.js";

// --- Fixture builder ---

function makeOrder(
  orderId: string,
  date: string,
  items: Array<{ name: string; productId: string; quantity: number; sellingPrice: number }>,
  value: number,
  status = "invoiced",
): OrderDetail {
  return {
    orderId,
    creationDate: date,
    status,
    value,
    items: items.map((i) => ({ id: i.productId, productId: i.productId, name: i.name, quantity: i.quantity, sellingPrice: i.sellingPrice })),
  };
}

// Dataset: 3 órdenes válidas + 1 cancelada
const details: Record<string, OrderDetail> = {
  "order-1": makeOrder("order-1", "2025-01-15T10:00:00Z", [
    { name: "Azucar", productId: "p1", quantity: 2, sellingPrice: 800 },
    { name: "Arroz", productId: "p2", quantity: 1, sellingPrice: 1200 },
  ], 2800),
  "order-2": makeOrder("order-2", "2025-01-22T10:00:00Z", [
    { name: "Azucar", productId: "p1", quantity: 3, sellingPrice: 750 },
  ], 2250),
  "order-3": makeOrder("order-3", "2025-02-05T10:00:00Z", [
    { name: "Leche", productId: "p3", quantity: 6, sellingPrice: 450 },
  ], 2700),
  "order-canceled": makeOrder("order-canceled", "2025-02-10T10:00:00Z", [
    { name: "Producto ignorado", productId: "p99", quantity: 1, sellingPrice: 99900 },
  ], 99900, "canceled"),
};

// --- Totales ---

test("excluye órdenes canceladas del total", () => {
  const r = buildAnalytics(details);
  expect(r.totalOrders).toBe(3);
});

test("totalSpend correcto excluyendo canceladas", () => {
  const r = buildAnalytics(details);
  // (2800 + 2250 + 2700) / 100 = 77.50
  expect(r.totalSpend).toBe(77.50);
});

test("avgOrder correcto", () => {
  const r = buildAnalytics(details);
  expect(r.avgOrder).toBeCloseTo(25.83, 1);
});

// --- Agrupación por mes ---

test("agrupa por mes correctamente", () => {
  const r = buildAnalytics(details);
  expect(r.byMonth).toHaveLength(2);
  expect(r.byMonth[0]?.month).toBe("2025-01");
  expect(r.byMonth[1]?.month).toBe("2025-02");
});

test("filtra por mes", () => {
  const r = buildAnalytics(details, { month: "2025-02" });
  expect(r.totalOrders).toBe(1);
  expect(r.totalSpend).toBe(27);
});

test("totalOrders 0 con mes sin órdenes", () => {
  const r = buildAnalytics(details, { month: "2024-12" });
  expect(r.totalOrders).toBe(0);
  expect(r.totalSpend).toBe(0);
  expect(r.avgOrder).toBe(0);
});

// --- Top por gasto ---

test("topBySpend ranking correcto", () => {
  const r = buildAnalytics(details);
  // Azucar: 2*8.00 + 3*7.50 = 16 + 22.50 = 38.50
  // Leche:  6*4.50 = 27.00
  // Arroz:  1*12.00 = 12.00
  expect(r.topBySpend[0]?.name).toBe("Azucar");
  expect(r.topBySpend[0]?.spend).toBeCloseTo(38.50, 1);
  expect(r.topBySpend[1]?.name).toBe("Leche");
});

test("topBySpend respeta topN", () => {
  const r = buildAnalytics(details, { topN: 2 });
  expect(r.topBySpend).toHaveLength(2);
});

// --- Top por frecuencia ---

test("topByFrequency: Azucar aparece en 2 órdenes", () => {
  const r = buildAnalytics(details);
  expect(r.topByFrequency[0]?.name).toBe("Azucar");
  expect(r.topByFrequency[0]?.orders).toBe(2);
});

test("topByFrequency acumula cantidad total", () => {
  const r = buildAnalytics(details);
  const azucar = r.topByFrequency.find((p) => p.name === "Azucar");
  expect(azucar?.qty).toBe(5); // 2 + 3
});

// --- Edge cases ---

test("dataset vacío devuelve ceros", () => {
  const r = buildAnalytics({});
  expect(r.totalOrders).toBe(0);
  expect(r.totalSpend).toBe(0);
  expect(r.byMonth).toHaveLength(0);
  expect(r.topBySpend).toHaveLength(0);
});

test("solo órdenes canceladas → totales en 0", () => {
  const r = buildAnalytics({ "c": makeOrder("c", "2025-01-01T00:00:00Z", [], 1000, "canceled") });
  expect(r.totalOrders).toBe(0);
  expect(r.totalSpend).toBe(0);
});
