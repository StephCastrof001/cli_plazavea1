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
plaza login                                    # abre browser, espera login manual
plaza search "leche gloria" --limit 10         # busca con precios completos
plaza simulate --sku 123456 --postal 15001     # verifica stock en local antes de agregar
plaza add 123456 --dry-run                     # preview sin agregar
plaza add 123456                               # agrega al carrito
plaza cart                                     # ver carrito con totales
plaza orders                                   # historial de pedidos
plaza whoami                                   # estado de sesión + antigüedad cookie
```

## Output JSON (usar siempre en MCP)

Todos los comandos aceptan `--output json`:
```bash
plaza search "arroz" --output json | jq '.[].prices'
```

## MCP tools disponibles (9 tools — v3.1.0)

| Tool | Input | Output |
|---|---|---|
| `search_products` | `query: string, limit?: number` | `ProductResult[]` |
| `get_cart` | — | `CartNormalized` |
| `add_to_cart` | `skuId: string, quantity?: number` | `CartNormalized` |
| `remove_from_cart` | `index: number` | `CartNormalized` |
| `get_orders` | `limit?: number` | `Order[]` |
| `get_analytics` | `month?: string, topN?: number, limit?: number` | `AnalyticsResult` (gasto, top SKUs) |
| `track_add` | `productId: string, alertPrice?: number` | `TrackedProduct` |
| `track_list` | — | `TrackedProduct[]` |
| `track_check` | — | `{ changes, alerts }` |

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
- Verificar antigüedad: `plaza whoami`
- Si sesión expirada (401/403): `plaza login` de nuevo

## Nota para agentes — login bajo Node

`plaza login` se ejecuta bajo Node+tsx (no Bun) porque Playwright cuelga bajo Bun en
Windows. El dispatcher lo rutea automático — no requiere acción del agente.
