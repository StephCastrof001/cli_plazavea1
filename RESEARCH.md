# Plaza Vea (VTEX) — RESEARCH.md

## Auth — CONFIRMADO (2026-05-29)

- **Cookie de login real: `VtexIdclientAutCookie_plazavea`** (también una variante con UUID: `VtexIdclientAutCookie_<uuid>`).
- ⚠ **`vtex_session` NO es auth** — aparece para visitantes anónimos (tracking). Detectar login SOLO por `VtexIdclientAutCookie*`. Usar vtex_session como señal de login es un bug (guarda sesión anónima → 401 en orders).
- Método: Playwright extrae cookies del browser real (headless: false), filtradas por dominio `plazavea`.
- TTL: por confirmar con uso real (cookie VtexId suele durar horas/días).
- Sin login: búsqueda y orderForm (cart) responden igual (semi-públicos). **orders SÍ requiere `VtexIdclientAutCookie`.**

### ⚠ CRÍTICO — Playwright NO corre bajo Bun en este entorno

- `chromium.launch()` y `connectOverCDP()` bajo **Bun** cuelgan: el cliente WebSocket/CDP de Bun no completa el handshake con Chrome en Windows (timeout, ventana nunca abre).
- **NO es antivirus** (Kaspersky desinstalado = fantasma WMI; Defender apagado).
- **Solución:** correr el login bajo **Node + tsx**, no Bun:
  ```
  node node_modules/tsx/dist/cli.mjs src/commands/login.ts
  ```
  El resto del CLI (search/cart/orders/mcp) sigue en Bun — solo el login usa Node.
- Playwright pineado a `1.59.1` para reusar `chromium-1217` ya en disco (evita descarga).
- Fallback: `plaza login --manual "<header Cookie completo>"` (pegar desde Network tab de DevTools).

---

## Price Schema — Bug conocido (heredado de v2)

VTEX codifica el precio OH en DOS lugares según la campaña activa:

**Lugar 1 — Teasers:**
```json
"Teasers": [{ "<Name>k__BackingField": "Tarjeta oh! S/ 12.50 ..." }]
```

**Lugar 2 — Installments:**
```json
"Installments": [{ "Name": "¡Precio Exclusivo Tarjeta oh! S/ 12.50" }]
```

v2 solo buscaba en Teasers → falla con campañas que usan Installments.
v3 busca en ambos → usa el primero que encuentre.

### 3 niveles de precio — no siempre aparecen los 3

| Campo | Nombre real | Cuándo aparece |
|---|---|---|
| `regular` | Precio normal / sin descuento | Siempre |
| `led` | Low Every Day — oferta base sin tarjeta | Solo productos con precio LED activo |
| `oh` | Precio Tarjeta OH — descuento adicional con tarjeta | Solo en campañas OH activas |

**Posibles combinaciones:**
- Solo `regular` → precio único, sin campaña
- `regular` + `led` → descuento base visible para todos
- `regular` + `oh` → descuento solo con tarjeta OH
- `regular` + `led` + `oh` → dos niveles de descuento

**⚠ DM-004:** Confirmar si LED siempre viene en `commertialOffer.Price < ListPrice` o si hay casos donde también usa Teasers.

---

## Stock — Bug conocido (reportado por usuario) + incidencia simulate (CONFIRMADO 2026-05-29)

### El problema de negocio (por qué existe `simulate`)

`search` API devuelve **stock GLOBAL** del catálogo (seller por defecto `"1"`).
Al hacer checkout, VTEX verifica el stock del **local físico** asignado a tu dirección de envío.
Resultado: `search` dice "disponible ✅" pero el checkout en tu local falla → **pedido cae al final del flujo.**

> **Lo que queremos evitar:** que el usuario (o Claude) arme el carrito, llegue al checkout, y recién ahí descubra que no hay stock en su local. `simulate` mueve esa verificación al **inicio**, antes de agregar.

### Modelo mental correcto: 1 producto × N sellers (locales) = N stocks

El error de v3 fue asumir "1 producto = 1 stock". La realidad VTEX:

```
Cada zona de Lima la atiende un SELLER distinto (= tienda/almacén físico):
   Rímac (postal 15094)  →  seller "plazaveamko522"
   catálogo / global     →  seller "1"
```

`search`/`cart` usan el catálogo global (seller "1") → por eso funcionan.
`simulate` necesita el **seller del local específico** → por eso fallaba con seller "1" hardcodeado.

### Incidencia: simulate tiraba VTEX 500 (`code 001` Object reference not set)

**Causa raíz:** `simulateStock()` mandaba `seller: "1"` fijo. Para postal 15094 (Rímac) el seller real es `plazaveamko522`. Pedir simulación del seller "1" en una región que no atiende → null-ref server-side. **Fallaba con cualquier postal y cualquier variante de payload** (probado: con/sin `sc=1`, `geoCoordinates`, `salesChannel`, sin seller).

### La "lista de VTEX" — endpoint `/regions` (fuente de verdad postal→seller)

NO adivinar el postal de listas web (codigo-postal.co). VTEX tiene su propio mapa:

```
GET /api/checkout/pub/regions?country=PER&postalCode=15094&sc=1
→ { value: [{ id: "U1cjcGxhemF2ZWFta281MjI=",   ← regionId
              sellers: [{ id: "plazaveamko522" }] }] }   ← seller del local
```

### Flujo correcto de capa C (fix de simulate — 2 pasos)

```
PASO 1: postal ──/regions──▶ regionId + seller del local
PASO 2: simulation(sku, seller correcto / regionId) ──▶ stock REAL del local
```

**Endpoint simulation:**
```
POST /api/checkout/pub/orderForms/simulation?sc=1
Body: { items: [{id, quantity, seller: "<seller del local>"}], postalCode, country: "PER" }
```
No modifica carrito. **Auth NO requerida** (semi-público, igual que search/cart).
⚠ El `seller` DEBE venir de `/regions`, no hardcodeado. Ese es el fix pendiente de `simulateStock()`.

**Solución v3 (3 capas) — estado real:**
- A: columna Stock en `search` muestra `⚠ global` ✅
- B: `add` verifica `availability` en respuesta del cart → warning si `withoutStock` ✅
- C: `simulate` — ⚠ **roto por seller hardcodeado**. Fix = anteponer `/regions` lookup (ver arriba).

---

## Endpoints confirmados — DOS HOSTS distintos (CONFIRMADO 2026-05-29)

⚠ **Arquitectura de doble host:**
- `tienda.plazavea.com.pe` → search, cart, orderForm, simulate
- `www.plazavea.com.pe` → **OMS (orders)** — el único que vive en `www`

| Host | Endpoint | Método | Auth | Descripción |
|---|---|---|---|---|
| tienda | `/api/catalog_system/pub/products/search/{term}?_from=0&_to=49` | GET | No | Búsqueda |
| tienda | `/api/checkout/pub/orderForm` | GET | Semi | Ver/crear carrito |
| tienda | `/api/checkout/pub/orderForm/{id}/items` | POST | Sí | Agregar ítem |
| tienda | `/api/checkout/pub/orderForm/{id}/items/update` | POST | Sí | Actualizar/eliminar |
| tienda | `/api/checkout/pub/orderForms/simulation` | POST | No | Stock por postal |
| **www** | `/api/oms/user/orders?page=1&per_page=N` | GET | Sí | **Historial pedidos ✔ 200** |
| ~~`/api/oms/pvt/orders`~~ | — | — | — | ❌ SIEMPRE 401 (pvt = admin/API key, no cookie) |

### Schema de orders (`/api/oms/user/orders`)

Respuesta: `{ list: Order[], paging, facets, stats }`. Campos clave de cada Order:
- `orderId`, `creationDate`, `clientName`, `status`, `statusDescription`
- **`totalValue`** (centavos → ÷100 = soles). ⚠ NO es `value`.
- `totalItems`, `currencyCode` ("PEN"), `items` (puede ser null en lista)

---

## Gotchas

1. `commertialOffer.Price` ya viene en soles (ej: 15.90). Verificar si orderForm usa centavos (1590 → S/ 15.90) — normalizar en schema.
2. Seller `"1"` = catálogo global / Plaza Vea directo — sirve para `search`/`cart` (precio oficial). ⚠ PERO para stock por local, cada región tiene su PROPIO seller (ej. Rímac = `plazaveamko522`). Obtenerlo de `/regions`, no asumir "1".
3. orderForm se crea automáticamente al hacer GET — no requiere POST de inicialización.
4. `(x2)`, `(x3)` en nombre del producto es multiplicador VTEX (pack), no parte del nombre real — limpiar con regex.
5. `commertialOffer.AvailableQuantity > 0 && IsAvailable` = heurística de stock global, no local.
6. **OMS orders vive en `www.plazavea.com.pe`, NO en `tienda`** — usar `OMS_BASE_URL`. Mismo cookie funciona en ambos (dominio `.plazavea.com.pe`).
7. **Cookie auth = `VtexIdclientAutCookie_plazavea`**, no `vtex_session`. vtex_session = anónimo.
8. **Playwright cuelga bajo Bun en Windows** → login corre bajo Node+tsx. Resto en Bun.
9. orders `totalValue` en centavos; el campo NO se llama `value`.
10. **`simulate` con `seller: "1"` hardcodeado → VTEX 500 `code 001` (null-ref).** El seller depende de la región. Flujo correcto: `/regions?postalCode=X` → seller del local → `/simulation` con ese seller. Ver §Stock.
11. **`/regions?country=PER&postalCode=X&sc=1`** = mapa oficial postal→seller de VTEX. La dirección guardada del usuario (orderForm `shippingData`) es la otra fuente del local. NO usar listas postales web externas.
12. **Cart/orderForm viven en `www.plazavea.com.pe`, NO en `tienda`.** `tienda` acepta PATCH en `/items` pero rechaza POST con 405. `www` acepta POST y PATCH. Search/catalog van a `tienda`; todo lo transaccional (orderForm, add, remove) va a `www`. Mismo patrón que OMS/orders.
13. ⚠ Agregar nuevos gotchas numerados aquí — no en notas sueltas.
