import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { AppError } from "../http.js";
import { buildAnalytics, ensureOrderDetails } from "../services/analytics.js";
import { addToCart, getCart, removeFromCart } from "../services/cart.js";
import { getOrders } from "../services/orders.js";
import { searchProducts } from "../services/products.js";
import { trackAdd, trackCheck, trackList } from "../services/tracker.js";

const server = new Server(
  { name: "plazavea-cli", version: "3.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_products",
      description:
        "Busca productos en Plaza Vea. Devuelve lista con precios (regular, oferta LED, Tarjeta OH) y stock global.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Término de búsqueda" },
          limit: { type: "number", description: "Máximo de resultados (default: 10)" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_cart",
      description: "Devuelve el contenido actual del carrito con precios y totales.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "add_to_cart",
      description: "Agrega un producto al carrito por skuId. Verifica stock post-add.",
      inputSchema: {
        type: "object",
        properties: {
          skuId: {
            type: "string",
            description: "SKU ID del producto (obtenido de search_products)",
          },
          quantity: { type: "number", description: "Cantidad a agregar (default: 1)" },
        },
        required: ["skuId"],
      },
    },
    {
      name: "remove_from_cart",
      description: "Elimina un ítem del carrito según su índice (visible en get_cart).",
      inputSchema: {
        type: "object",
        properties: {
          index: { type: "number", description: "Índice del ítem en el carrito (0-based)" },
        },
        required: ["index"],
      },
    },
    {
      name: "get_orders",
      description: "Devuelve el historial de pedidos del usuario.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de pedidos (default: 10)" },
        },
        required: [],
      },
    },
    {
      name: "get_analytics",
      description:
        "Analiza el gasto del usuario: total, promedio por orden, gasto por mes, top productos por gasto y frecuencia. Primera llamada es lenta (descarga detalles de órdenes). Las siguientes usan cache.",
      inputSchema: {
        type: "object",
        properties: {
          month: {
            type: "string",
            description:
              "Filtrar por mes en formato YYYY-MM (ej: 2026-05). Sin valor = todo el historial.",
          },
          topN: { type: "number", description: "Top N productos por gasto (default: 10)" },
          limit: { type: "number", description: "Órdenes a analizar (default: 50)" },
        },
        required: [],
      },
    },
    {
      name: "track_add",
      description:
        "Agrega un producto al radar de precios. Guarda precio actual y dispara alerta cuando baje del umbral.",
      inputSchema: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "Product ID (no el skuId — ver search_products)",
          },
          alertPrice: {
            type: "number",
            description:
              "Precio de alerta en soles. Si el precio actual baja de este valor, alerta.",
          },
        },
        required: ["productId"],
      },
    },
    {
      name: "track_list",
      description:
        "Lista todos los productos en el radar de precios con precio actual y alerta configurada.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "track_check",
      description:
        "Refresca precios de todos los productos rastreados. Devuelve cambios y alertas activas.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

function errorResult(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === "search_products") {
      const query = String(a.query ?? "");
      const limit = typeof a.limit === "number" ? a.limit : 10;
      const results = await searchProducts(query, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    if (name === "get_cart") {
      const cart = await getCart();
      return { content: [{ type: "text", text: JSON.stringify(cart, null, 2) }] };
    }

    if (name === "add_to_cart") {
      const skuId = String(a.skuId ?? "");
      const quantity = typeof a.quantity === "number" ? a.quantity : 1;
      const cart = await addToCart(skuId, quantity);
      const addedItem = cart.items.find((i) => i.id === skuId);
      const warning =
        addedItem?.availability === "withoutStock"
          ? "\n⚠ Agregado pero sin stock en tu local."
          : "";
      return { content: [{ type: "text", text: JSON.stringify(cart, null, 2) + warning }] };
    }

    if (name === "remove_from_cart") {
      const index = typeof a.index === "number" ? a.index : 0;
      const cart = await removeFromCart(index);
      return { content: [{ type: "text", text: JSON.stringify(cart, null, 2) }] };
    }

    if (name === "get_orders") {
      const limit = typeof a.limit === "number" ? a.limit : 10;
      const orders = await getOrders(limit);
      return { content: [{ type: "text", text: JSON.stringify(orders, null, 2) }] };
    }

    if (name === "get_analytics") {
      const month = typeof a.month === "string" ? a.month : null;
      const topN = typeof a.topN === "number" ? a.topN : 10;
      const limit = typeof a.limit === "number" ? a.limit : 50;
      const orders = await getOrders(limit);
      const details = await ensureOrderDetails(orders.map((o) => o.orderId));
      const result = buildAnalytics(details, { month, topN });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "track_add") {
      const productId = String(a.productId ?? "");
      const alertPrice = typeof a.alertPrice === "number" ? a.alertPrice : undefined;
      const result = await trackAdd(productId, alertPrice);
      if (!result) return errorResult(`Producto ${productId} no encontrado.`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "track_list") {
      const tracked = trackList();
      return { content: [{ type: "text", text: JSON.stringify(tracked, null, 2) }] };
    }

    if (name === "track_check") {
      const alerts: string[] = [];
      const changes: Array<{ name: string; price: number; diff: number }> = [];
      await trackCheck((name, price, diff) => {
        changes.push({ name, price, diff });
        if (diff < 0) alerts.push(`${name} bajó a S/${price.toFixed(2)} (${diff.toFixed(2)})`);
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ changes, alerts }, null, 2),
          },
        ],
      };
    }

    return errorResult(`Tool desconocida: ${name}`);
  } catch (e) {
    const msg = e instanceof AppError ? e.message : String(e);
    const hint = e instanceof AppError && e.isSessionExpired ? " Ejecuta: plaza login" : "";
    return errorResult(`${msg}${hint}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[plazavea-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
