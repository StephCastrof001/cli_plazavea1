# plazavea-cli — CONTEXT.md (para agentes AI)

## Qué hace este CLI

Crea el canal programático y conversacional que Plaza Vea no tiene — permite que Claude opere
las compras sin que el usuario abra el browser, y expone el historial de gasto que la app no analiza.

**AHA moment:** `search → simulate → add → cart` completo vía Claude, sin browser.
Ver `docs/problem-statement.md` para el contexto completo.

Target: VTEX headless. **Auth: cookie `VtexIdclientAutCookie_plazavea`** (NO vtex_session, que es anónimo).
Doble host: search/cart en `tienda.plazavea.com.pe`, orders en `www.plazavea.com.pe`.

## Carrito y sesión

El orderForm VTEX está asociado a la **cuenta**, no al browser. Lo que Claude agrega aparece
en la app del usuario, y lo que el usuario tiene en su carrito Claude lo ve con `get_cart`.
Canal bidireccional real entre CLI/MCP y la app móvil.

## Flujo típico de uso

```bash
plazavea login                                    # abre browser, espera login manual
plazavea search "leche gloria" --limit 10         # busca con precios completos
plazavea simulate --sku 123456 --postal 15001     # verifica stock en local antes de agregar
plazavea add 123456 --dry-run                     # preview sin agregar
plazavea add 123456                               # agrega al carrito
plazavea cart                                     # ver carrito con totales
plazavea orders                                   # historial de pedidos
plazavea whoami                                   # estado de sesión + antigüedad cookie
```

## Output JSON (usar siempre en MCP)

Todos los comandos aceptan `--output json`:
```bash
plazavea search "arroz" --output json | jq '.[].prices'
```

## MCP tools disponibles (13 tools — v3.2.0)

Golden Flow (en este orden): `select_address` → `search_products` → `add_to_cart` → `open_checkout`

| Tool | Input | Output | Fase |
|---|---|---|---|
| `select_address` | `addressIndex: number` | `{ address, itemCount }` | 1 — Fulfillment Gate (OBLIGATORIO primero) |
| `get_addresses` | — | `Address[]` | 1 — listar opciones antes de select |
| `search_products` | `query: string, limit?: number` | `ProductResult[]` | 2 — Búsqueda |
| `simulate_stock` | `skuId: string, addressIndex?: number` | `StockResult` | 2 — Verificar stock local |
| `get_cart` | — | `CartNormalized` | 3 — Ver carrito |
| `add_to_cart` | `skuId: string, quantity?: number` | `CartNormalized` | 3 — Agregar |
| `remove_from_cart` | `index: number` | `CartNormalized` | 3 — Eliminar |
| `open_checkout` | — | `{ command: string }` | 4 — Handoff humano (retorna comando PS) |
| `get_orders` | `limit?: number` | `Order[]` | Post-venta |
| `get_analytics` | `month?: string, topN?: number, limit?: number` | `AnalyticsResult` | Post-venta |
| `track_add` | `productId: string, alertPrice?: number` | `TrackedProduct` | Radar |
| `track_list` | — | `TrackedProduct[]` | Radar |
| `track_check` | — | `{ changes, alerts }` | Radar |

## Precios — estructura

Cada producto tiene hasta 3 precios (no siempre aparecen los 3):
- `prices.regular` — precio base, siempre presente
- `prices.led` — Low Every Day / oferta sin tarjeta — null si no aplica
- `prices.oh` — Tarjeta OH — null si no aplica

`inStock` en search es **stock GLOBAL** — usar `simulate` para verificar stock del local.

## Sesión y TTL

- Sin login: `search` y `cart` (orderForm) responden (semi-públicos)
- Con login: `orders` y operaciones autenticadas — requiere `VtexIdclientAutCookie`
- TTL: por confirmar (la cookie VtexId suele durar horas/días, no minutos)
- Verificar antigüedad: `plazavea whoami`
- Si sesión expirada (401/403): `plazavea login` de nuevo

## Nota para agentes — login bajo Node

`plazavea login` se ejecuta bajo Node+tsx (no Bun) porque Playwright cuelga bajo Bun en
Windows. El dispatcher lo rutea automático — no requiere acción del agente.
