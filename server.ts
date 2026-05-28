#!/usr/bin/env bun
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { searchProducts } from "./src/services/products.js";
import { getCart } from "./src/services/cart.js";
import { getOrders } from "./src/services/orders.js";
import { AppError } from "./src/http.js";

const app = new Hono();

function errorResponse(e: unknown) {
  const msg = e instanceof AppError ? e.message : String(e);
  const status = e instanceof AppError ? (e.statusCode || 500) : 500;
  return { error: msg, status };
}

app.get("/search", async (c) => {
  const q = c.req.query("q");
  const limit = parseInt(c.req.query("limit") ?? "10");
  if (!q) return c.json({ error: "Missing query param: q" }, 400);
  try {
    const results = await searchProducts(q, limit);
    return c.json(results);
  } catch (e) {
    const { error, status } = errorResponse(e);
    return c.json({ error }, status as 400 | 401 | 403 | 500);
  }
});

app.get("/cart", async (c) => {
  try {
    const cart = await getCart();
    return c.json(cart);
  } catch (e) {
    const { error, status } = errorResponse(e);
    return c.json({ error }, status as 400 | 401 | 403 | 500);
  }
});

app.get("/orders", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "10");
  try {
    const orders = await getOrders(limit);
    return c.json(orders);
  } catch (e) {
    const { error, status } = errorResponse(e);
    return c.json({ error }, status as 400 | 401 | 403 | 500);
  }
});

app.get("/health", (c) => c.json({ ok: true, version: "3.0.0" }));

const PORT = parseInt(process.env["PORT"] ?? "3847");
serve({ fetch: app.fetch, port: PORT });
process.stderr.write(`plazavea-cli REST server → http://localhost:${PORT}\n`);
