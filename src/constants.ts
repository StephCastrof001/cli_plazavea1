export const BASE_URL = "https://tienda.plazavea.com.pe"; // search/catalog
export const WWW_BASE_URL = "https://www.plazavea.com.pe"; // cart + OMS (transaccional)
export const OMS_BASE_URL = WWW_BASE_URL; // alias para claridad
export const COUNTRY = "PER";

export const ENDPOINTS = {
  search: (term: string, from = 0, to = 49) =>
    `/api/catalog_system/pub/products/search/${encodeURIComponent(term)}?_from=${from}&_to=${to}`,
  productById: (productId: string) =>
    `/api/catalog_system/pub/products/search/?fq=productId:${productId}`,
  orderForm: "/api/checkout/pub/orderForm",
  addItem: (orderFormId: string) => `/api/checkout/pub/orderForm/${orderFormId}/items`,
  updateItem: (orderFormId: string) => `/api/checkout/pub/orderForm/${orderFormId}/items`,
  profile: "/api/checkout/pub/profiles",
  orders: "/api/oms/user/orders",
  orderDetail: (orderId: string) => `/api/oms/user/orders/${orderId}`,
  simulate: "/api/checkout/pub/orderForms/simulation?sc=1",
  regions: (postalCode: string) =>
    `/api/checkout/pub/regions?country=PER&postalCode=${encodeURIComponent(postalCode)}&sc=1`,
};

export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const CONFIG_DIR_NAME = "plazavea";
export const CONFIG_FILENAME = "session.json";
export const PRICES_FILENAME = "prices.json";
export const ORDERS_CACHE_FILENAME = "orders-cache.json";
