import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { searchProducts } from "../services/products.js";
import { getCart, addToCart, removeFromCart } from "../services/cart.js";
import { getOrders } from "../services/orders.js";
import { AppError } from "../http.js";

const server = new Server(
  { name: "plazavea-cli", version: "3.0.0" },
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
          skuId: { type: "string", description: "SKU ID del producto (obtenido de search_products)" },
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
      description:
        "Devuelve el historial de pedidos. Puede dar 403 si la cuenta no tiene historial accesible.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de pedidos (default: 10)" },
        },
        required: [],
      },
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
      const query = String(a["query"] ?? "");
      const limit = typeof a["limit"] === "number" ? a["limit"] : 10;
      const results = await searchProducts(query, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    if (name === "get_cart") {
      const cart = await getCart();
      return { content: [{ type: "text", text: JSON.stringify(cart, null, 2) }] };
    }

    if (name === "add_to_cart") {
      const skuId = String(a["skuId"] ?? "");
      const quantity = typeof a["quantity"] === "number" ? a["quantity"] : 1;
      const cart = await addToCart(skuId, quantity);
      const addedItem = cart.items.find((i) => i.id === skuId);
      const warning =
        addedItem?.availability === "withoutStock"
          ? "\n⚠ Agregado pero sin stock en tu local."
          : "";
      return { content: [{ type: "text", text: JSON.stringify(cart, null, 2) + warning }] };
    }

    if (name === "remove_from_cart") {
      const index = typeof a["index"] === "number" ? a["index"] : 0;
      const cart = await removeFromCart(index);
      return { content: [{ type: "text", text: JSON.stringify(cart, null, 2) }] };
    }

    if (name === "get_orders") {
      const limit = typeof a["limit"] === "number" ? a["limit"] : 10;
      const orders = await getOrders(limit);
      return { content: [{ type: "text", text: JSON.stringify(orders, null, 2) }] };
    }

    return errorResult(`Tool desconocida: ${name}`);

  } catch (e) {
    const msg = e instanceof AppError ? e.message : String(e);
    const hint = e instanceof AppError && e.isSessionExpired
      ? " Ejecuta: plaza login"
      : "";
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
