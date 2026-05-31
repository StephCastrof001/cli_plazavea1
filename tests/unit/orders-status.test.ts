import { expect, test } from "bun:test";
import { mapVtexStatus, VTEX_STATUS_MAP } from "../../src/services/orders.js";

test("invoiced → Facturado / Enviado (no pendiente)", () => {
  expect(mapVtexStatus("invoiced")).toBe("Facturado / Enviado");
});

test("handling → En preparación", () => {
  expect(mapVtexStatus("handling")).toBe("En preparación");
});

test("canceled → Cancelado", () => {
  expect(mapVtexStatus("canceled")).toBe("Cancelado");
});

test("payment-pending → Pago pendiente", () => {
  expect(mapVtexStatus("payment-pending")).toBe("Pago pendiente");
});

test("payment-approved → Pago aprobado (no pendiente)", () => {
  expect(mapVtexStatus("payment-approved")).toBe("Pago aprobado");
});

test("status desconocido → devuelve el valor crudo sin inventar", () => {
  expect(mapVtexStatus("some-unknown-vtex-state")).toBe("some-unknown-vtex-state");
});

test("todos los estados del mapa tienen label no vacío", () => {
  for (const [status, label] of Object.entries(VTEX_STATUS_MAP)) {
    expect(label.length, `status "${status}" tiene label vacío`).toBeGreaterThan(0);
  }
});
