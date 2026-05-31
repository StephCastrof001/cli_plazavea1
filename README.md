<div align="center">

```
██████  ██       █████  ███████  █████      ██    ██ ███████  █████
██   ██ ██      ██   ██    ███  ██   ██     ██    ██ ██      ██   ██
██████  ██      ███████   ███   ███████     ██    ██ █████   ███████
██      ██      ██   ██  ███    ██   ██      ██  ██  ██      ██   ██
██      ███████ ██   ██ ███████ ██   ██       ████   ███████ ██   ██
```

**Servidor MCP para retail VTEX** · v3.1.0

Opera tus compras de supermercado desde Claude Code o Cursor.<br>
El agente busca, verifica stock en **tu local** y agrega al carrito — sin abrir el browser.<br>
<sub>Primera implementación: Plaza Vea (Perú). Arquitectura VTEX → portable a Wong, Tottus, Vivanda.</sub>

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)
![MCP](https://img.shields.io/badge/MCP-11%20tools-green)

</div>

---

## Por qué existe

La app de Plaza Vea muestra tus órdenes pero no las suma, no las analiza, y no hay forma de que un agente AI opere tus compras. Este CLI crea ese canal.

**AHA moment:**
```bash
# Todo esto sin abrir el browser:
plaza search "arroz costeño" --output json   # buscar con precios reales
plaza simulate --sku X                        # verificar stock en tu local (usa dirección guardada)
plaza add X                                   # agregar al carrito
plaza cart                                    # confirmar
```

## Qué hace

- 🤖 **MCP server** — Claude Code, Cursor o cualquier cliente MCP opera tus compras nativamente (11 tools)
- 📍 **Verificar stock local** (`simulate`) — distingue stock global de stock en tu tienda
- 🔍 Buscar con los **3 niveles de precio** (regular, descuento sin tarjeta, Tarjeta OH)
- 🛒 Gestionar carrito desde terminal (lo que Claude agrega se ve en la app y viceversa)
- 📦 Historial de pedidos que la app no analiza

## Instalar

```bash
git clone https://github.com/StephCastrof001/cli_plazavea1.git
cd cli_plazavea1
bun install
```

> Requiere [Bun](https://bun.sh) y [Node.js](https://nodejs.org).

## Login

```bash
bun run index.ts login       # Abre browser — inicia sesión con tu cuenta Plaza Vea
```

El comando abre Chrome en el login de Plaza Vea. Inicias sesión manualmente y el CLI
captura la cookie de sesión automáticamente (tu contraseña nunca se guarda).

### Login manual (fallback)

Si el browser no abre, copia el header `Cookie:` completo desde el Network tab de DevTools:

```bash
bun run index.ts login --manual "VtexIdclientAutCookie_plazavea=...; vtex_session=..."
```

## Uso CLI

```bash
# Búsqueda
bun run index.ts search "leche gloria" --limit 10
bun run index.ts search "arroz" --output json

# Carrito
bun run index.ts cart                          # Ver carrito
bun run index.ts add <skuId> --quantity 2      # Agregar (--dry-run para preview)
bun run index.ts remove <índice>               # Eliminar ítem

# Stock por local (evita bug global vs local)
bun run index.ts simulate --sku <skuId>              # usa 1era dirección guardada
bun run index.ts simulate --sku <skuId> --address 1  # usa 2da dirección
bun run index.ts simulate --list-addresses           # ver todas las direcciones

# Pedidos
bun run index.ts orders --limit 5

# Sesión
bun run index.ts whoami                         # Estado de sesión + antigüedad
bun run index.ts logout                         # Cerrar sesión
```

## REST API

```bash
bun run server.ts    # Inicia en http://localhost:3847
```

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/search?q=<término>&limit=N` | Buscar productos |
| GET | `/cart` | Ver carrito |
| GET | `/orders?limit=N` | Historial de pedidos |
| GET | `/health` | Estado del servidor |

## Servidor MCP (integración con Claude Code, Cursor, etc.)

El CLI incluye un servidor MCP que expone tools para que cualquier cliente MCP opere Plaza Vea nativamente.

### Setup para Claude Code

Agrega `.mcp.json` a la raíz de tu proyecto:

```json
{
  "mcpServers": {
    "plaza-vea": {
      "command": "/ruta/completa/a/bun",
      "args": ["run", "/path/to/plazavea-cli/src/mcp/server.ts"]
    }
  }
}
```

> **Nota:** usa la ruta completa a `bun` (no solo `"bun"`). En macOS/Linux: `which bun`. En Windows: `C:/Users/<usuario>/.bun/bin/bun.exe`.

### Tools disponibles (11)

| Tool | Descripción |
|------|-------------|
| `search_products` | Buscar productos con precios (regular/descuento/OH) y stock global |
| `get_cart` | Ver contenido del carrito con totales |
| `add_to_cart` | Agregar producto por skuId (verifica stock post-add) |
| `remove_from_cart` | Eliminar ítem del carrito por índice |
| `get_orders` | Historial de pedidos |
| `get_analytics` | Gasto total, por mes y top productos. Primera llamada lenta, usa cache después |
| `track_add` | Agregar producto al radar de precios (con alerta opcional) |
| `track_list` | Ver productos rastreados con precio actual |
| `track_check` | Refrescar precios y ver alertas activas |
| `get_addresses` | Ver direcciones de entrega guardadas en tu cuenta |
| `simulate_stock` | Verificar disponibilidad en tu local por dirección (usa ANTES de `add_to_cart`) |

## Estructura de precios (3 niveles)

Plaza Vea tiene hasta 3 precios por producto — no siempre aparecen los 3:

| Campo | Nombre real | Cuándo aparece |
|-------|-------------|----------------|
| `regular` | Precio normal sin descuento | Siempre |
| `led` | Precio descuento sin tarjeta | Solo cuando aplica oferta base |
| `oh` | Precio Tarjeta OH — descuento con tarjeta | Solo en campañas OH activas |

VTEX codifica el precio OH en dos lugares según la campaña (`Teasers` o `Installments`).
El CLI busca en ambos. Ver `RESEARCH.md` para el detalle.

## Arquitectura

```
index.ts             → Dispatcher (login→Node+tsx, resto→Bun)
server.ts            → REST API (Hono, puerto 3847)
src/
  constants.ts       → BASE_URL (tienda) + OMS_BASE_URL (www) + endpoints
  http.ts            → Cliente HTTP tipado + AppError (isSessionExpired)
  config.ts          → Config con Zod en ~/.config/plazavea/session.json
  schemas/           → Zod: product (PriceInfo 3 niveles), cart
  services/          → Lógica: auth (Playwright), products, cart, orders
  commands/          → Un archivo por comando
  mcp/server.ts      → Servidor MCP (11 tools)
```

### Doble host (importante)

- `tienda.plazavea.com.pe` → search / catálogo
- `www.plazavea.com.pe` → carrito, orderForm, simulate, OMS / orders

La misma cookie funciona en ambos (dominio `.plazavea.com.pe`).

## Type Safety

Toda respuesta de VTEX se valida con [Zod](https://zod.dev/) antes de usarse:

- **Búsqueda** → `schemas/product.ts` (normaliza el JSON caótico de VTEX a `PriceInfo`)
- **Carrito** → `schemas/cart.ts` (centavos → soles)
- **Errores** → `AppError` con detección de sesión expirada (401/403)

## Consideraciones de seguridad

> **Herramienta de uso local y personal.** Corre enteramente en tu máquina — no envía datos
> a terceros (excepto las APIs de Plaza Vea). Trabajar con tu sesión real conlleva riesgos.

- La cookie de sesión se guarda en **texto plano** en `~/.config/plazavea/session.json`
  (con `chmod 600` en sistemas Unix). Cualquiera con acceso a tu home podría leerla.
- Ejecuta `logout` cuando termines para limpiar la sesión.
- El servidor REST (`server.ts`) abre en localhost sin autenticación — no lo expongas a la red.
- Usando MCP, los datos de tus pedidos/carrito se envían como texto al modelo de Claude.
- Proyecto **no oficial**, sin relación con Plaza Vea. Úsalo bajo tu propio riesgo.

## Stack

- [Bun](https://bun.sh) — Runtime
- [TypeScript](https://www.typescriptlang.org/) — Strict, sin `any`
- [Zod](https://zod.dev/) — Validación de schemas
- [Hono](https://hono.dev/) — REST API
- [Playwright](https://playwright.dev/) — Login por browser
- [MCP SDK](https://modelcontextprotocol.io/) — Integración con Claude (5 tools)
