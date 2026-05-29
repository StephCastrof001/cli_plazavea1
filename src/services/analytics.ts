import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFIG_DIR_NAME, ENDPOINTS, OMS_BASE_URL, ORDERS_CACHE_FILENAME } from "../constants.js";
import { http } from "../http.js";
import {
  type OrderDetail,
  OrderDetailSchema,
  type OrdersCache,
  OrdersCacheSchema,
} from "../schemas/orders.js";

const CACHE_PATH = path.join(os.homedir(), ".config", CONFIG_DIR_NAME, ORDERS_CACHE_FILENAME);
const CACHE_DIR = path.dirname(CACHE_PATH);

function loadCache(): OrdersCache {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    return OrdersCacheSchema.parse(JSON.parse(raw));
  } catch {
    return OrdersCacheSchema.parse({});
  }
}

function saveCache(cache: OrdersCache): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const raw = await http.get<unknown>(`${OMS_BASE_URL}${ENDPOINTS.orderDetail(orderId)}`);
  return OrderDetailSchema.parse(raw);
}

export async function ensureOrderDetails(
  orderIds: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<Record<string, OrderDetail>> {
  const cache = loadCache();
  const missing = orderIds.filter((id) => !cache.details[id]);

  for (let i = 0; i < missing.length; i++) {
    onProgress?.(i + 1, missing.length);
    try {
      const detail = await getOrderDetail(missing[i]);
      cache.details[missing[i]] = detail;
    } catch {
      // skip failed orders — no bloquear todo por uno
    }
  }

  if (missing.length > 0) saveCache(cache);
  return cache.details;
}

export interface AnalyticsResult {
  totalOrders: number;
  totalSpend: number;
  avgOrder: number;
  byMonth: Array<{ month: string; spend: number }>;
  topBySpend: Array<{ name: string; orders: number; qty: number; spend: number }>;
  topByFrequency: Array<{ name: string; orders: number; qty: number; spend: number }>;
}

// Función pura — no I/O, testeable
export function buildAnalytics(
  details: Record<string, OrderDetail>,
  opts: { month?: string | null; topN?: number } = {},
): AnalyticsResult {
  const { month = null, topN = 10 } = opts;

  let orders = Object.values(details).filter((o) => o.status !== "canceled");
  if (month) orders = orders.filter((o) => o.creationDate?.startsWith(month));

  const totalSpend = orders.reduce((s, o) => s + (o.value ?? 0) / 100, 0);
  const totalOrders = orders.length;

  const monthMap: Record<string, number> = {};
  for (const o of orders) {
    const m = o.creationDate?.slice(0, 7) ?? "desconocido";
    monthMap[m] = (monthMap[m] ?? 0) + (o.value ?? 0) / 100;
  }
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, spend]) => ({ month: m, spend: Number.parseFloat(spend.toFixed(2)) }));

  const byProduct: Record<string, { name: string; qty: number; spend: number; orders: number }> =
    {};
  for (const o of orders) {
    for (const item of o.items) {
      const pid = item.productId ?? item.id;
      if (!byProduct[pid]) byProduct[pid] = { name: item.name, qty: 0, spend: 0, orders: 0 };
      byProduct[pid].qty += item.quantity;
      byProduct[pid].spend += (item.sellingPrice / 100) * item.quantity;
      byProduct[pid].orders += 1;
    }
  }

  const topBySpend = Object.values(byProduct)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, topN);

  const topByFrequency = Object.values(byProduct)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  return {
    totalOrders,
    totalSpend: Number.parseFloat(totalSpend.toFixed(2)),
    avgOrder: totalOrders > 0 ? Number.parseFloat((totalSpend / totalOrders).toFixed(2)) : 0,
    byMonth,
    topBySpend,
    topByFrequency,
  };
}
