<div align="center">

```
██████  ██       █████  ███████  █████      ██    ██ ███████  █████
██   ██ ██      ██   ██    ███  ██   ██     ██    ██ ██      ██   ██
██████  ██      ███████   ███   ███████     ██    ██ █████   ███████
██      ██      ██   ██  ███    ██   ██      ██  ██  ██      ██   ██
██      ███████ ██   ██ ███████ ██   ██       ████   ███████ ██   ██
```

**Servidor MCP para retail VTEX** · v3.2.0

Opera tus compras de supermercado desde **cualquier cliente MCP** (Claude Code, Cursor, etc.) o por CLI.<br>
El agente busca, confirma con `simulate_stock` que el producto llega a **tu local**, y agrega al carrito — sin abrir el browser.<br>
<sub>Primera implementación: Plaza Vea (Perú). Arquitectura VTEX → portable a Wong, Tottus, Vivanda.</sub>

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)
![MCP](https://img.shields.io/badge/MCP-14%20tools-green)

</div>

---

## Por qué existe

La app de Plaza Vea muestra tus órdenes pero no las suma, no las analiza, y no hay forma de que un agente AI opere tus compras. Este CLI crea ese canal.

**AHA moment:** Le pides a tu agente *"agrega leche Gloria para mi casa en Comas"*.
Busca, simula el stock en **tu local**, y descubre que en Comas no hay — aunque la web
la muestre "disponible". Te avisa **antes** de agregarla, en vez de que el checkout
falle al final. Ni la app ni la web hacen eso.

```bash
# Lo mismo desde tu terminal (o vía MCP), sin abrir el browser:
plazavea select-address 0                      # tu local: Comas
plazavea search "leche gloria"                 # catálogo + precios reales
plazavea simulate --sku 11389962               # ✖ sin stock en Comas (la web diría "disponible")
plazavea simulate --sku 11389962 --address 1   # ✔ sí hay en Cercado
# Agregas solo lo que tu local sí tiene → el checkout no falla.
```

## Qué hace

- 🤖 **MCP server** — Claude Code, Cursor o cualquier cliente MCP opera tus compras nativamente (14 tools)
- 📍 **Verificar stock local** (`simulate_stock`) — distingue stock global de stock en tu tienda
- 🔍 Buscar con los **3 niveles de precio** (regular, descuento sin tarjeta, Tarjeta OH)
- 🛒 Gestionar carrito desde terminal (lo que Claude agrega se ve en la app y viceversa)
- 📦 Historial de pedidos que la app no analiza
- 🔒 **Pago exclusivamente humano** — el CLI llega hasta el carrito; el checkout lo abrís vos en el browser

## Flujo (máquina de 4 estados)

VTEX no es un CRUD simple: es una máquina de estados. El flujo está dividido en 4 estados
estrictos para evitar errores cíclicos (CHK0041, pérdida de calle):

| # | Tool | Hace | Regla |
|---|------|------|-------|
| 1 | `select_address` | Guarda tu dirección de envío | Solo ancla; no valida stock |
| 2 | `search_products` / `add_to_cart` | Arma el pedido | No toca el envío |
| 3 | `simulate_stock` | Confirma stock en **tu local** y reconcilia logística | Único validador; obligatorio antes de checkout |
| 4 | `open_checkout` | Handoff de pago al browser | Falla si no pasó el Estado 3. El pago lo hacés vos |

> **Stock local solo en `simulate_stock`, no en `search`.** El search de plazavea es global
> por diseño (catálogo cacheado en CDN, no regionalizable por usuario). `simulate_stock` es
> el único punto donde VTEX expone disponibilidad por región, vía el orderForm.

### Browser handoff (login y checkout)

`open_login` y `open_checkout` te ofrecen dos opciones (el agente pregunta cuál prefieres):
**(A)** abre el navegador automáticamente en tu máquina, o **(B)** te da el comando para que
lo ejecutes en tu propia terminal. Ambas respetan el guardrail: el browser abre y **tú pagas**
— el servidor nunca ejecuta el pago.

## Limitaciones conocidas

- 🔒 **Pago humano** — el CLI llega hasta el carrito; el checkout y el pago los haces tú en el browser. No automatizable por diseño (guardrail de seguridad).
- ⚖️ **Productos de pesaje** — frutas, verduras y carnes vendidas por kg no se pueden agregar todavía (requieren un flujo de cantidad-por-peso que el modelo aún no maneja). En el roadmap.
- 📄 **Búsqueda sin paginación** — `search` devuelve hasta `--limit 50` resultados; no hay scroll de páginas (suficiente para uso con agentes).
- 🏪 **Solo Plaza Vea** — la arquitectura VTEX es portable a Wong, Tottus y Vivanda, pero aún no están implementados.

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
      "args": ["run", "/path/to/plazavea-cli/src/mcp/index.ts"]
    }
  }
}
```

> **Nota:** usa la ruta completa a `bun` (no solo `"bun"`). En macOS/Linux: `which bun`. En Windows: `C:/Users/<usuario>/.bun/bin/bun.exe`.

### Setup para Claude Desktop

Edita el archivo de configuración de Claude Desktop:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "Plaza Vea 🛒": {
      "command": "C:/Users/TU_USUARIO/.bun/bin/bun.exe",
      "args": ["run", "C:/ruta/completa/a/plazavea-cli/src/mcp/index.ts"]
    }
  }
}
```

> Claude Desktop no hereda el PATH del shell — la ruta completa a `bun` es obligatoria.
> Reinicia Claude Desktop después de guardar el archivo.

### Setup para Cursor

Agrega en `Settings → MCP Servers`:

```json
{
  "Plaza Vea 🛒": {
    "command": "/ruta/completa/a/bun",
    "args": ["run", "/ruta/completa/a/plazavea-cli/src/mcp/index.ts"]
  }
}
```

### Tools disponibles (14)

| Tool | Estado | Descripción |
|------|--------|-------------|
| `open_login` | — | Inicia sesión (abre browser o devuelve comando; pregunta cuál preferís) |
| `select_address` | 1 | Selección de dirección — guarda tu dirección de envío (no valida stock) |
| `get_addresses` | 1 | Ver direcciones de entrega guardadas en tu cuenta |
| `search_products` | 2 | Buscar productos con precios (regular/descuento/OH) y stock **global** |
| `add_to_cart` | 2 | Agregar producto por skuId (verifica stock post-add) |
| `remove_from_cart` | 2 | Eliminar ítem del carrito por índice |
| `get_cart` | 2 | Ver contenido del carrito con totales |
| `simulate_stock` | 3 | Verificar disponibilidad en **tu local** por dirección. OBLIGATORIO antes de checkout |
| `open_checkout` | 4 | Handoff de pago (browser o comando). Falla si no pasó el Estado 3 |
| `get_orders` | — | Historial de pedidos |
| `get_analytics` | — | Gasto total, por mes y top productos. Primera llamada lenta, usa cache después |
| `track_add` | — | Agregar producto al radar de precios (con alerta opcional) |
| `track_list` | — | Ver productos rastreados con precio actual |
| `track_check` | — | Refrescar precios y ver alertas activas |

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
  constants.ts       → BASE_URL (tienda) + WWW_BASE_URL (www) + endpoints
  http.ts            → Cliente HTTP tipado + AppError (isSessionExpired)
  config.ts          → Config con Zod en ~/.config/plazavea/session.json
  schemas/           → Zod: product (PriceInfo 3 niveles), cart
  services/          → Lógica por estado (máquina de 4 estados VTEX):
                        shipping.ts    → núcleo aislado del envío (Híbrido Inteligente)
                        address.ts     → Estado 1 (anclaje de dirección)
                        cart.ts        → Estado 2 (solo items)
                        fulfillment.ts → Estado 3 (simulate + gate de checkout)
                        auth (Playwright), products, orders, analytics, tracker
  commands/          → Un archivo por comando
  scripts/handoff.ts → Checkout en browser (Node+tsx, ADR-0001)
  mcp/index.ts       → Servidor MCP (14 tools)
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
- [MCP SDK](https://modelcontextprotocol.io/) — Integración con Claude (14 tools)
