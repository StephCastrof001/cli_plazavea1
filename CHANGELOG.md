# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [3.2.0] - 2026-06-02

### Añadido
- **Máquina de 4 estados (Golden Flow):** `select_address` (anclaje) → `search`/`add_to_cart` → `simulate_stock` (conciliación) → `open_checkout` (handoff).
- **Browser handoff:** `open_login` y `open_checkout` ofrecen 2 opciones (abrir navegador automático / comando para tu terminal). Guardrail: el pago es exclusivamente humano.
- **Stock local por dirección:** `simulate_stock` por `addressId` — distingue stock entre tus locales (probado: Leche Gloria sin stock en Comas, sí en Cercado).
- **Servicios desacoplados:** `shipping.ts` (núcleo de envío), `address.ts`, `cart.ts`, `fulfillment.ts`.
- **Tests de lógica nueva:** `buildShippingBody`, `checkCheckoutReady`, `parseSimulateResult` (68 tests).
- **Validación:** `smoke-mcp.ts` (14 tools), `smoke-checkout.ts` (mapeo índice→street dinámico).
- **Gate typecheck** (`tsc --noEmit`) en el pipeline.

### Corregido
- **"campo calle no válido"** en checkout: dirección completa desde `/profiles` (con street), no del orderForm stripped.
- **CHK0041 en carrito vacío:** Híbrido Inteligente (vacío → solo address; con items → address + logisticsInfo en un POST).
- **Índice de dirección invertido** (Comas/Cercado): una sola fuente de verdad (profile) para `select` y `simulate`.
- **Cart-sync:** el handoff abre `www` (transaccional), no `tienda` (catálogo).

### Cambiado
- **MCP: 14 tools** (antes 11) — +`select_address`, +`open_checkout`, +`open_login`.
- **Lenguaje plano:** "clavar"/"Fulfillment Gate" → "guardar dirección"/"Selección de dirección".

### Documentado
- **Hallazgo VTEX:** el search de plazavea NO se regionaliza (cache público CDN). Stock local solo vía `simulate_stock`. Decisión: search global + simulate local.
