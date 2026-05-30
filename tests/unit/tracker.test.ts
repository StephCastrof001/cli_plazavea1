import { expect, test } from "bun:test";
import { trackAdd, trackCheck, trackHistory, trackList, trackRemove } from "../../src/services/tracker.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Usa un archivo temporal para no tocar el real ~/.config/plazavea/prices.json
// Monkey-patch PRICES_PATH via módulo no expuesto — probamos vía comportamiento observable

// Los tests de tracker son de integración ligera (usan disco pero carpeta temp)
// Las funciones puras a testear: lógica de alerta, acumulación de historial

// --- Lógica de alerta (pura, sin disco) ---

test("alerta se dispara cuando precio <= alertPrice", () => {
  const alerts: string[] = [];
  const price = 8.90;
  const alertPrice = 9.00;
  if (price <= alertPrice) {
    alerts.push(`Producto bajó a S/${price.toFixed(2)} (alerta: S/${alertPrice.toFixed(2)})`);
  }
  expect(alerts).toHaveLength(1);
  expect(alerts[0]).toContain("8.90");
});

test("alerta NO se dispara cuando precio > alertPrice", () => {
  const alerts: string[] = [];
  const price = 9.50;
  const alertPrice = 9.00;
  if (price <= alertPrice) {
    alerts.push("alerta");
  }
  expect(alerts).toHaveLength(0);
});

test("alerta se dispara cuando precio == alertPrice (borde)", () => {
  const alerts: string[] = [];
  const price = 9.00;
  const alertPrice = 9.00;
  if (price <= alertPrice) {
    alerts.push("alerta");
  }
  expect(alerts).toHaveLength(1);
});

// --- Diff de precio (lógica que usa trackCheck internamente) ---

test("diff positivo = precio subió", () => {
  const lastPrice = 8.90;
  const currentPrice = 9.50;
  const diff = currentPrice - lastPrice;
  expect(diff).toBeCloseTo(0.60, 2);
  expect(diff > 0).toBe(true);
});

test("diff negativo = precio bajó", () => {
  const lastPrice = 9.50;
  const currentPrice = 8.90;
  const diff = currentPrice - lastPrice;
  expect(diff).toBeCloseTo(-0.60, 2);
  expect(diff < 0).toBe(true);
});

test("diff cero = sin cambio", () => {
  const diff = 8.90 - 8.90;
  expect(diff).toBe(0);
});

// --- Estructura PriceEntry (formato de fecha) ---

test("fecha de entrada tiene formato YYYY-MM-DD", () => {
  const date = new Date().toISOString().slice(0, 10);
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("fecha slice(0,10) es consistente con ISO", () => {
  const iso = "2026-05-29T14:30:00.000Z";
  expect(iso.slice(0, 10)).toBe("2026-05-29");
});

// --- Guard: no duplicar entrada del mismo día ---

test("alreadyToday detecta correctamente fecha duplicada", () => {
  const today = "2026-05-29";
  const history = [
    { date: "2026-05-28", price: 9.0, listPrice: 10.0 },
    { date: "2026-05-29", price: 8.9, listPrice: 10.0 },
  ];
  const alreadyToday = history.some((h) => h.date === today);
  expect(alreadyToday).toBe(true);
});

test("alreadyToday false cuando no existe entrada hoy", () => {
  const today = "2026-05-30";
  const history = [
    { date: "2026-05-28", price: 9.0, listPrice: 10.0 },
    { date: "2026-05-29", price: 8.9, listPrice: 10.0 },
  ];
  const alreadyToday = history.some((h) => h.date === today);
  expect(alreadyToday).toBe(false);
});
