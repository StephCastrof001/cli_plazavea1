# Roadmap — plazavea-cli

## Estado actual (v3.1)

| Feature | Estado | Notas |
|---------|--------|-------|
| `search` — buscar con 3 precios | ✅ funciona | stock en resultado = global (esperado) |
| `cart` — ver carrito | ✅ funciona | |
| `add` — agregar al carrito | ✅ funciona | warning si `withoutStock` post-add |
| `remove` — eliminar del carrito | ✅ funciona | |
| `orders` — historial de pedidos | ✅ funciona | |
| `whoami` / `logout` | ✅ funciona | |
| `simulate` — stock en local | ⚠ fix pendiente | seller hardcodeado → VTEX 500. Fix: `/regions` lookup primero. Ver `RESEARCH.md §Stock` |
| MCP server (5 tools) | ✅ funciona | search, cart, add, remove, orders |
| REST server (Hono) | ✅ funciona | puerto 3847 |
| Tests unitarios (bun:test) | ✅ 23 tests | price-extraction + cart-normalization |
| Login (Playwright) | ✅ funciona | bajo Node+tsx (no Bun) |

## P0 — Fix `simulate` (capa C de stock)

**Por qué:** cerrar el DONE WHEN del problem-statement (checkout limpio).

**Fix:**
```typescript
// simulateStock() debe:
// 1. GET /api/checkout/pub/regions?country=PER&postalCode=X&sc=1 → seller del local
// 2. POST /api/checkout/pub/orderForms/simulation con ese seller (no "1")
```

Ver detalle técnico completo en `RESEARCH.md §Stock`.

## P1 — Integrar cligentic (convertir código muerto en valor)

`src/cli/` tiene 10 bloques copiados pero 0 importados. Solo 2 valen la pena ahora:
- `error-map` → reemplazar `AppError` manual en `http.ts`
- `json-mode` → usar `emit()` en search/cart/orders (output dual consistente)

## P2 — Analytics de gasto (el gap real de la app)

Requiere endpoint de detalle de orden (`/api/oms/user/orders/{orderId}`):
- Gasto por período (1m / 3m / 12m)
- Productos más comprados
- Tendencias de precio por SKU

## Fuera de scope (v3)
- Checkout / pago
- Comparación con otros retailers
- Paginación de búsqueda
