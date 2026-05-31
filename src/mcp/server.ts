import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSelectedAddressIndex } from "../config.js";
import { AppError } from "../http.js";
import { buildAnalytics, ensureOrderDetails } from "../services/analytics.js";
import {
  addToCart,
  getAddresses,
  getCart,
  getCheckoutUrl,
  removeFromCart,
  selectFulfillmentAddress,
  simulateStock,
} from "../services/cart.js";
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
    "1. select_address   → Fulfillment Gate: clava el polígono logístico",
    "2. search_products  → Búsqueda Honesta: solo resultados con stock global",
    "3. add_to_cart      → Agrega al carrito (bindea perfil automáticamente)",
    "4. get_checkout_url → Magic Link para pago humano",
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
  const msg = e instanceof AppError ? e.message : String(e);
  const hint = e instanceof AppError && e.isSessionExpired ? " Ejecuta: plaza login" : "";
  return fail(`${msg}${hint}`);
}

// ── select_address (Fulfillment Gate) ────────────────────────────────────────
server.tool(
  "select_address",
  "PASO 1 OBLIGATORIO — Fulfillment Gate. Selecciona una dirección de entrega y la clava en el orderForm. A partir de aquí, el stock es 100% real para tu local. Llama get_addresses primero para ver las opciones.",
  {
    addressIndex: z.number().describe("Índice de la dirección (0-based, de get_addresses)"),
  },
  async ({ addressIndex }) => {
    try {
      const address = await selectFulfillmentAddress(addressIndex);
      return ok({
        selected: true,
        address,
        message: `Polígono logístico clavado en ${address.neighborhood}, ${address.city}. Ahora puedes buscar con stock local real.`,
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
    "IMPORTANTE: Requiere haber llamado select_address primero (Fulfillment Gate).",
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
      const addressIndex = getSelectedAddressIndex();
      if (addressIndex === undefined) {
        return fail(
          "⚠ Fulfillment Gate requerido. Llama select_address primero para clavarn el polígono logístico y garantizar stock real.",
        );
      }
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
      return ok(await getAddresses());
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── simulate_stock ───────────────────────────────────────────────────────────
server.tool(
  "simulate_stock",
  "Verifica si un producto tiene stock en TU local (no el global), usando una dirección guardada. Devuelve disponibilidad, almacén y estimado de entrega. Úsalo ANTES de add_to_cart para evitar que el checkout falle por falta de stock local.",
  {
    skuId: z.string().describe("SKU ID del producto (de search_products)"),
    addressIndex: z
      .number()
      .optional()
      .describe("Índice de la dirección guardada (default 0). Ver get_addresses."),
  },
  async ({ skuId, addressIndex }) => {
    try {
      return ok(await simulateStock(skuId, addressIndex ?? 0));
    } catch (e) {
      return catchErr(e);
    }
  },
);

// ── get_checkout_url (Magic Link) ────────────────────────────────────────────
server.tool(
  "get_checkout_url",
  "PASO 4 — Magic Checkout Link. Genera la URL directa para que el usuario pague en el browser sin fricción. El carrito ya está listo con todos los productos agregados.",
  {},
  async () => {
    try {
      const url = await getCheckoutUrl();
      return ok({
        url,
        message: `👉 Abre este link para pagar: ${url}`,
        note: "El pago es exclusivamente humano. Este servidor NO ejecuta transacciones.",
      });
    } catch (e) {
      return catchErr(e);
    }
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
