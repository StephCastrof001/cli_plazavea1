# VTEX Checkout Rules — Contrato de máquina de estados

> Fuente de verdad del flujo de checkout. VTEX **no** es una API simple: es una
> máquina de estados. Tratarla como CRUD genera regresiones cíclicas (CHK0041,
> pérdida de calle, índice de dirección invertido). Este documento es el contrato
> que el código (`src/services/`) y las tools del MCP (`src/mcp/index.ts`) deben
> respetar ESTRICTAMENTE.

---

## 3 Principios (invariantes de la API)

### 1. Principio del Carrito Vacío
Si el orderForm tiene **0 items**, está **PROHIBIDO** mandar `logisticsInfo` en el
POST a `shippingData`. `logisticsInfo` referencia `itemIndex:0`, que no existe en
un carrito vacío → VTEX responde **CHK0041 "Índice de item inválido"**.
→ Carrito vacío: el body del POST es solo `{ address }`.

### 2. Principio del Carrito Lleno
Si hay items, `address` y `logisticsInfo` van **OBLIGATORIAMENTE en UN solo POST**.
Mandar `{ address }` y luego `{ logisticsInfo }` en posts separados hace que VTEX
**borre la calle** (el segundo POST descarta el address clavado).
→ Carrito con items: body = `{ address, logisticsInfo }` juntos, en una llamada.

### 3. Separación de responsabilidades
- `select_address` → **solo ancla la ubicación**. No valida stock.
- `simulate_stock` → **único** que valida disponibilidad y reconcilia logística.
- `add` / `remove` → **solo** tocan items. JAMÁS tocan `shippingData`.

> El street completo vive en `/api/checkout/pub/profiles?email=`, **NO** en
> `orderForm.availableAddresses` (viene `street:null`/stripped y en orden distinto
> → causa el bug de índice). Toda dirección se resuelve desde el profile.

---

## Máquina de 4 Estados

Ningún agente puede saltarse un estado.

| # | Estado | Tool | Propósito | Lógica API | Regla estricta |
|---|--------|------|-----------|-----------|----------------|
| 1 | **Anclaje Logístico** | `select_address` | Decir a VTEX a dónde se enviará, antes de mirar catálogo | Resuelve `addressId` del profile (calle completa). **Híbrido Inteligente**: vacío → POST `{address}`; con items → POST `{address, logisticsInfo}` | Solo ancla. No valida stock |
| 2 | **Operación Carrito** | `search`, `add_to_cart` | Armar el pedido | Libre de buscar y agregar SKUs vía API de items | **PROHIBIDO** tocar `shippingData` |
| 3 | **Conciliación Logística** | `simulate_stock` | Punto de control final tras agregar items | Re-POST `{address, logisticsInfo}` cubriendo TODOS los items, con calle del profile. Verifica que ningún item cayó a stock 0 | Único validador de disponibilidad |
| 4 | **Zero-Click Handoff** | `open_checkout` | Pasar control al humano para pagar | No interactúa con VTEX. `child_process` abre Chrome en la URL de checkout | **FALLA** si no pasó Estado 3 (`assertCheckoutReady`) |

---

## Mapa código → contrato

| Estado | Módulo dueño | Función |
|--------|--------------|---------|
| núcleo | `src/services/shipping.ts` | `attachShipping(orderFormId, address, itemCount)` — **única** implementación del POST (Híbrido Inteligente). `readShippingData()` |
| 1 | `src/services/address.ts` | `getProfileAddresses`, `getAddresses`, `selectFulfillmentAddress` |
| 2 | `src/services/cart.ts` | `getCart`, `addToCart`, `removeFromCart` — **sin** lógica de shipping |
| 3 | `src/services/fulfillment.ts` | `simulateStock`, `parseSimulateResult`, `assertCheckoutReady`, `getCheckoutUrl` |

**Invariante de desacople:** `grep shippingData src/services/cart.ts` → 0 resultados.
Si `cart.ts` vuelve a tocar shipping, el contrato está roto.

---

## 🛑 Frontera Humano/IA (heredada, INVIOLABLE)
El CLI/MCP llega hasta el carrito. **El pago lo hace el humano.** PROHIBIDO
`attachPayment`/`paymentData`/cualquier tool de pago. `open_checkout` solo abre el
browser; nunca ejecuta transacciones.
