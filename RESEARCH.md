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

## Stock — Bug conocido (reportado por usuario)

**Problema:** search API devuelve stock GLOBAL (suma de todos los locales del país).
Al hacer checkout, VTEX verifica stock del local asignado a la dirección de envío → puede estar agotado aunque global diga disponible.

**Solución v3 (3 capas):**
- A: columna Stock en `search` muestra `⚠ global`
- B: `add` verifica `availability` en respuesta del cart → warning si `withoutStock`
- C: comando `simulate --sku X --postal Y` llama simulation API antes de agregar

**Endpoint simulation:**
```
POST /api/checkout/pub/orderForms/simulation
Body: { items: [{id, quantity, seller}], postalCode: "15001", country: "PER" }
```
No modifica carrito. Respuesta ~200ms.
⚠ Auth requerida: sin confirmar — verificar durante implementación.

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
2. Seller `"1"` = Plaza Vea directo. Otros sellers = terceros en marketplace — filtrar por seller "1" para precio oficial.
3. orderForm se crea automáticamente al hacer GET — no requiere POST de inicialización.
4. `(x2)`, `(x3)` en nombre del producto es multiplicador VTEX (pack), no parte del nombre real — limpiar con regex.
5. `commertialOffer.AvailableQuantity > 0 && IsAvailable` = heurística de stock global, no local.
6. **OMS orders vive en `www.plazavea.com.pe`, NO en `tienda`** — usar `OMS_BASE_URL`. Mismo cookie funciona en ambos (dominio `.plazavea.com.pe`).
7. **Cookie auth = `VtexIdclientAutCookie_plazavea`**, no `vtex_session`. vtex_session = anónimo.
8. **Playwright cuelga bajo Bun en Windows** → login corre bajo Node+tsx. Resto en Bun.
9. orders `totalValue` en centavos; el campo NO se llama `value`.
10. ⚠ Agregar nuevos gotchas numerados aquí — no en notas sueltas.
