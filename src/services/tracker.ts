import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFIG_DIR_NAME, ENDPOINTS, PRICES_FILENAME } from "../constants.js";
import { http } from "../http.js";
import { normalizeVtexSearch } from "../schemas/product.js";
import { type PriceStore, PriceStoreSchema, type TrackedProduct } from "../schemas/tracker.js";

const PRICES_PATH = path.join(os.homedir(), ".config", CONFIG_DIR_NAME, PRICES_FILENAME);
const PRICES_DIR = path.dirname(PRICES_PATH);

function loadStore(): PriceStore {
  try {
    const raw = fs.readFileSync(PRICES_PATH, "utf8");
    return PriceStoreSchema.parse(JSON.parse(raw));
  } catch {
    return PriceStoreSchema.parse({});
  }
}

function saveStore(store: PriceStore): void {
  if (!fs.existsSync(PRICES_DIR)) fs.mkdirSync(PRICES_DIR, { recursive: true });
  fs.writeFileSync(PRICES_PATH, JSON.stringify(store, null, 2));
}

export async function trackAdd(
  productId: string,
  alertPrice?: number,
): Promise<TrackedProduct | null> {
  const raw = await http.get<unknown[]>(ENDPOINTS.productById(productId));
  const products = normalizeVtexSearch(raw);
  const product = products[0];
  if (!product) return null;

  const store = loadStore();
  const entry: TrackedProduct = {
    productId,
    skuId: product.skuId,
    name: product.name,
    brand: product.brand,
    alert: alertPrice,
    history: [
      {
        date: new Date().toISOString().slice(0, 10),
        price: product.prices.led ?? product.prices.regular,
        listPrice: product.prices.regular,
      },
    ],
  };
  store.tracked[productId] = entry;
  saveStore(store);
  return entry;
}

export async function trackCheck(
  onProgress?: (name: string, price: number, diff: number) => void,
): Promise<{ alerts: string[] }> {
  const store = loadStore();
  const products = Object.values(store.tracked);
  const alerts: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const tracked of products) {
    const raw = await http.get<unknown[]>(ENDPOINTS.productById(tracked.productId));
    const results = normalizeVtexSearch(raw);
    const current = results[0];
    if (!current) {
      onProgress?.(tracked.name, 0, 0);
      continue;
    }

    const currentPrice = current.prices.led ?? current.prices.regular;
    const last = tracked.history[tracked.history.length - 1];
    const lastPrice = last?.price ?? currentPrice;
    const diff = currentPrice - lastPrice;

    onProgress?.(tracked.name, currentPrice, diff);

    const alreadyToday = tracked.history.some((h) => h.date === today);
    const newEntry = {
      date: today,
      price: currentPrice,
      listPrice: current.prices.regular,
    };

    if (!alreadyToday) {
      store.tracked[tracked.productId].history.push(newEntry);
    } else {
      const idx = store.tracked[tracked.productId].history.length - 1;
      store.tracked[tracked.productId].history[idx] = newEntry;
    }

    if (tracked.alert !== undefined && currentPrice <= tracked.alert) {
      alerts.push(
        `${tracked.name} bajó a S/${currentPrice.toFixed(2)} (alerta: S/${tracked.alert.toFixed(2)})`,
      );
    }
  }

  saveStore(store);
  return { alerts };
}

export function trackList(): TrackedProduct[] {
  return Object.values(loadStore().tracked);
}

export function trackRemove(productId: string): string | null {
  const store = loadStore();
  const prod = store.tracked[productId];
  if (!prod) return null;
  delete store.tracked[productId];
  saveStore(store);
  return prod.name;
}

export function trackHistory(productId: string): TrackedProduct | null {
  return loadStore().tracked[productId] ?? null;
}
