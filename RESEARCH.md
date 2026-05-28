# Plaza Vea (VTEX) — RESEARCH.md

## Auth

- Cookie principal: `vtex_session`
- Método: Playwright extrae cookies del browser real (headless: false)
- TTL estimado: ~30 min (⚠ confirmar durante implementación — DM-004)
- Cookies adicionales: `VtexFingerPrint`, `checkout.vtex.com`
- Sin vtex_session: búsqueda funciona igual (endpoint público). Auth solo requerida para cart/orders/profile.

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

## Endpoints confirmados

| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| `/api/catalog_system/pub/products/search/{term}?_from=0&_to=49` | GET | No | Búsqueda de productos |
| `/api/checkout/pub/orderForm` | GET | Sí | Ver/crear carrito |
| `/api/checkout/pub/orderForm/{id}/items` | POST | Sí | Agregar ítem |
| `/api/checkout/pub/orderForm/{id}/items/update` | POST | Sí | Actualizar/eliminar ítem |
| `/api/checkout/pub/profiles` | GET | Sí | Perfil del usuario |
| `/api/oms/pvt/orders` | GET | Sí | Historial de pedidos (⚠ puede dar 403 en sesión web) |
| `/api/checkout/pub/orderForms/simulation` | POST | ? | Verificar stock por local/postal |

---

## Gotchas

1. `commertialOffer.Price` ya viene en soles (ej: 15.90). Verificar si orderForm usa centavos (1590 → S/ 15.90) — normalizar en schema.
2. Seller `"1"` = Plaza Vea directo. Otros sellers = terceros en marketplace — filtrar por seller "1" para precio oficial.
3. orderForm se crea automáticamente al hacer GET — no requiere POST de inicialización.
4. `(x2)`, `(x3)` en nombre del producto es multiplicador VTEX (pack), no parte del nombre real — limpiar con regex.
5. `commertialOffer.AvailableQuantity > 0 && IsAvailable` = heurística de stock global, no local.
6. ⚠ Agregar nuevos gotchas numerados aquí durante implementación — no en notas sueltas.
