import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { getSelectedAddressIndex, requireAddress, requireSession } from "../config.js";
import { AppError } from "../http.js";
import { buildAnalytics, ensureOrderDetails } from "../services/analytics.js";
import { getAddresses, selectFulfillmentAddress } from "../services/address.js";
import { addToCart, getCart, removeFromCart } from "../services/cart.js";
import { assertCheckoutReady, simulateStock } from "../services/fulfillment.js";
import { getOrders } from "../services/orders.js";
import { searchProducts } from "../services/products.js";
import { trackAdd, trackCheck, trackList } from "../services/tracker.js";

const server = new McpServer({
  name: "Plaza Vea 🛒",
  version: "3.2.0",
  description: [
    "Servidor MCP para retail VTEX — Plaza Vea (Perú).",
    "",
    "Golden Flow (SIEMPRE en este orden):",
    "1. select_address   → Selección de dirección: guarda tu dirección de envío",
    "2. search_products  → Búsqueda Honesta: solo resultados con stock global",
    "3. add_to_cart      → Agrega al carrito (bindea perfil automáticamente)",
    "4. open_checkout    → Abre browser con carrito precargado para pago humano",
    "",
    "IMPORTANTE: El checkout es exclusivamente humano. Este servidor NO ejecuta pagos.",
  ].join("\n"),
});

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], isError: true as const };
}

function catchErr(e: unknown) {
  const msg = e instanceof AppError ? e.message : e instanceof Error ? e.message : String(e);
  const hint = e instanceof AppError && e.isSessionExpired ? " Ejecuta: plazavea login" : "";
  return fail(`${msg}${hint}`);
}

// Raíz del repo resuelta dinámicamente (NO hardcodear paths de usuario).
// src/mcp/index.ts → ../../ = raíz.
const ROOT = path.resolve(import.meta.dir, "..", "..");
const TSX = "node_modules/tsx/dist/cli.mjs";

// Lanza un runner Playwright en proceso SEPARADO bajo Node+tsx.
// ADR-0001: Playwright cuelga bajo Bun; el MCP (Bun) solo hace spawn, no toca Chromium.
// detached + stdio:"ignore" = no bloquea ni corrompe el stdio JSON-RPC del MCP.
function launchDetached(script: string): boolean {
  try {
    const child = spawn("node", [TSX, script], {
      cwd: ROOT,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// ── select_address (Selección de dirección) ─────────────────────────────────
server.tool(
  "select_address",
  "ESTADO 1 — Anclaje Logístico. SOLO ancla la ubicación; NO valida stock (eso es simulate_stock, Estado 3). Llama get_addresses, muestra las opciones al usuario y PREGUNTA cuál prefiere ANTES de invocar. NO asumas ni elijas solo. Una vez el usuario elija, ancla esa dirección en el orderForm (funciona con carrito vacío — Híbrido Inteligente). Las búsquedas posteriores ya saben la ubicación.",
  {
    addressIndex: z.number().describe("Índice de la dirección (0-based, de get_addresses)"),
  },
  async ({ addressIndex }) => {
    try {
      requireSession();
      const address = await selectFulfillmentAddress(addressIndex);
      return ok({
        selected: true,
        address,
        message: `Dirección de envío guardada: ${address.neighborhood}, ${address.city}. El search muestra stock global; usa simulate_stock para confirmar disponibilidad en tu local antes de agregar.`,
      });
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── search_products (Búsqueda Honesta) ───────────────────────────────────────
server.tool(
  "search_products",
  [
    "PASO 2 — Búsqueda Honesta. Busca productos filtrando los sin stock global.",
    "IMPORTANTE: Requiere haber llamado select_address primero (Selección de dirección).",
    "Si no hay dirección seleccionada, retorna error con instrucción.",
    "Muestra resultados SIEMPRE en tabla de 4 columnas:",
    "| Producto | Precio Lista | Precio Online | Precio Tarjeta OH! |",
    "Usa - si un precio no aplica. PROHIBIDO usar la palabra LED.",
  ].join("\n"),
  {
    query: z.string().describe("Término de búsqueda"),
    limit: z.number().optional().describe("Máximo de resultados (default: 10)"),
  },
  async ({ query, limit }) => {
    try {
      requireSession();
      requireAddress();
      const addressIndex = getSelectedAddressIndex() as number;
      const results = await searchProducts(query, limit ?? 10);
      // Búsqueda Honesta: filtrar productos sin stock global
      const honest = results.filter((p) => p.inStock);
      return ok({
        query,
        addressIndex,
        total: results.length,
        available: honest.length,
        filtered_out: results.length - honest.length,
        results: honest,
      });
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── get_cart ─────────────────────────────────────────────────────────────────
server.tool(
  "get_cart",
  "Devuelve el contenido actual del carrito con precios y totales.",
  {},
  async () => {
    try {
      requireSession();
      return ok(await getCart());
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── add_to_cart ──────────────────────────────────────────────────────────────
server.tool(
  "add_to_cart",
  "Agrega un producto al carrito por skuId. Verifica stock post-add.",
  {
    skuId: z.string().describe("SKU ID del producto (obtenido de search_products)"),
    quantity: z.number().optional().describe("Cantidad a agregar (default: 1)"),
  },
  async ({ skuId, quantity }) => {
    try {
      requireSession();
      requireAddress();
      const cart = await addToCart(skuId, quantity ?? 1);
      const addedItem = cart.items.find((i) => i.id === skuId);
      const warning =
        addedItem?.availability === "withoutStock"
          ? "\n⚠ Agregado pero sin stock en tu local."
          : "";
      return {
        content: [{ type: "text" as const, text: JSON.stringify(cart, null, 2) + warning }],
      };
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── remove_from_cart ─────────────────────────────────────────────────────────
server.tool(
  "remove_from_cart",
  "Elimina un ítem del carrito según su índice (visible en get_cart).",
  {
    index: z.number().describe("Índice del ítem en el carrito (0-based)"),
  },
  async ({ index }) => {
    try {
      requireSession();
      return ok(await removeFromCart(index));
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── get_orders ───────────────────────────────────────────────────────────────
server.tool(
  "get_orders",
  "Devuelve el historial de pedidos del usuario.",
  {
    limit: z.number().optional().describe("Máximo de pedidos (default: 10)"),
  },
  async ({ limit }) => {
    try {
      requireSession();
      return ok(await getOrders(limit ?? 10));
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── get_analytics ────────────────────────────────────────────────────────────
server.tool(
  "get_analytics",
  "Analiza el gasto del usuario: total, promedio por orden, gasto por mes, top productos. Primera llamada es lenta (descarga detalles). Las siguientes usan cache.",
  {
    month: z
      .string()
      .optional()
      .describe("Filtrar por mes YYYY-MM (ej: 2026-05). Sin valor = todo el historial."),
    topN: z.number().optional().describe("Top N productos por gasto (default: 10)"),
    limit: z.number().optional().describe("Órdenes a analizar (default: 50)"),
  },
  async ({ month, topN, limit }) => {
    try {
      requireSession();
      const orders = await getOrders(limit ?? 50);
      const details = await ensureOrderDetails(orders.map((o) => o.orderId));
      return ok(buildAnalytics(details, { month: month ?? null, topN: topN ?? 10 }));
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── track_add ────────────────────────────────────────────────────────────────
server.tool(
  "track_add",
  "Agrega un producto al radar de precios. Guarda precio actual y dispara alerta cuando baje del umbral.",
  {
    productId: z.string().describe("Product ID (no el skuId — ver search_products)"),
    alertPrice: z
      .number()
      .optional()
      .describe("Precio de alerta en soles. Alerta cuando el precio baje de este valor."),
  },
  async ({ productId, alertPrice }) => {
    try {
      requireSession();
      const result = await trackAdd(productId, alertPrice);
      if (!result) return fail(`Producto ${productId} no encontrado.`);
      return ok(result);
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── track_list ───────────────────────────────────────────────────────────────
server.tool(
  "track_list",
  "Lista todos los productos en el radar de precios con precio actual y alerta configurada.",
  {},
  async () => {
    try {
      return ok(trackList());
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── track_check ──────────────────────────────────────────────────────────────
server.tool(
  "track_check",
  "Refresca precios de todos los productos rastreados. Devuelve cambios y alertas activas.",
  {},
  async () => {
    try {
      requireSession();
      const alerts: string[] = [];
      const changes: Array<{ name: string; price: number; diff: number }> = [];
      await trackCheck((name, price, diff) => {
        changes.push({ name, price, diff });
        if (diff < 0) alerts.push(`${name} bajó a S/${price.toFixed(2)} (${diff.toFixed(2)})`);
      });
      return ok({ changes, alerts });
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── get_addresses ────────────────────────────────────────────────────────────
server.tool(
  "get_addresses",
  "Lista las direcciones de envío guardadas en la cuenta. Úsalo para saber qué locales puede verificar simulate_stock.",
  {},
  async () => {
    try {
      requireSession();
      return ok(await getAddresses());
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── simulate_stock ───────────────────────────────────────────────────────────
server.tool(
  "simulate_stock",
  "ESTADO 3 — Conciliación Logística. Punto de control DESPUÉS de add_to_cart (el SKU debe estar en el carrito). Reconcilia el shipping para todos los items y verifica si el producto tiene stock en TU local (no el global) para la dirección elegida. Devuelve disponibilidad, almacén y estimado. Llama get_addresses y PREGUNTA al usuario qué dirección — el stock depende de ella. OBLIGATORIO antes de open_checkout (Estado 4).",
  {
    skuId: z.string().describe("SKU ID del producto (de search_products)"),
    addressId: z
      .string()
      .describe("addressId de la dirección elegida por el usuario (de get_addresses). El stock se calcula para ESA dirección."),
  },
  async ({ skuId, addressId }) => {
    try {
      requireSession();
      return ok(await simulateStock(skuId, addressId));
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── open_checkout (Browser Handoff: auto + fallback) ─────────────────────────
// ADR-0001: Playwright cuelga bajo Bun. auto=true → spawn detached de un runner
// Node+tsx (no bloquea el MCP). auto=false → devuelve el comando manual.
// El comando manual SIEMPRE viaja en la respuesta como respaldo.
server.tool(
  "open_checkout",
  "ESTADO 4 — Zero-Click Handoff. REQUIERE haber pasado Estado 3 (simulate_stock) — si la logística no está reconciliada, esta tool FALLA con instrucción. OBLIGATORIO presentar al usuario sus DOS opciones como elección (no asumas ninguna, no colapses a una sola): (A) auto=true → abro el navegador en tu máquina con sesión+carrito ya cargados; (B) auto=false → te doy el comando para que lo pegues en tu propia terminal. AMBAS son seguras y respetan el guardrail: en las dos el browser abre y TÚ pagas — el servidor NUNCA ejecuta el pago ni toca paymentData. El guardrail prohíbe pagar, NO prohíbe abrir el navegador. NO invocar hasta que el usuario elija A o B.",
  {
    auto: z
      .boolean()
      .describe(
        "REQUERIDO. true: abre el navegador automáticamente. false: devuelve el comando manual. Pregunta al usuario qué prefiere ANTES de invocar.",
      ),
  },
  async ({ auto }) => {
    try {
      requireSession();
      requireAddress();
      // ESTADO 4 gate — no abrir el pago si no se reconcilió la logística (Estado 3).
      await assertCheckoutReady();
    } catch (e) {
      return catchErr(e);
    }
    const command = `node ${TSX} src/scripts/handoff.ts`;
    const launched = auto ? launchDetached("src/scripts/handoff.ts") : false;
    return ok({
      ready: true,
      browser_launched: launched,
      message: launched
        ? "Navegador abriéndose en tu máquina con tu carrito precargado. Completa el pago ahí."
        : "Ejecuta este comando en tu PowerShell para abrir el pago con tu sesión activa:",
      command, // respaldo siempre presente, incluso en modo auto
      cwd: ROOT,
      note: "El pago es exclusivamente humano. Este servidor NO ejecuta transacciones.",
    });
  },
);

// ── open_login (auto + fallback) ─────────────────────────────────────────────
server.tool(
  "open_login",
  "Inicia sesión en Plaza Vea. ANTES de invocar, OBLIGATORIO preguntar: '¿Quieres que abra el navegador de login automáticamente (te aparece la ventana ya) o prefieres ejecutar el comando desde tu propia terminal?'. Opción 1 = auto=true. Opción 2 = auto=false (comando para tu terminal). NO invocar hasta que el usuario elija.",
  {
    auto: z
      .boolean()
      .describe(
        "REQUERIDO. true: abre el navegador de login automáticamente. false: devuelve el comando manual. Pregunta al usuario qué prefiere ANTES de invocar.",
      ),
  },
  async ({ auto }) => {
    const command = `node ${TSX} src/commands/login.ts`;
    const launched = auto ? launchDetached("src/commands/login.ts") : false;
    return ok({
      browser_launched: launched,
      message: launched
        ? "Navegador de login abriéndose. Inicia sesión en la ventana; la cookie se captura sola."
        : "Ejecuta este comando en tu PowerShell para iniciar sesión:",
      command, // respaldo siempre presente
      cwd: ROOT,
    });
  },
);

// ── bootstrap ────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[plazavea-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
