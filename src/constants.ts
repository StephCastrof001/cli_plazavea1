export const BASE_URL = "https://tienda.plazavea.com.pe";
export const COUNTRY = "PER";

export const ENDPOINTS = {
  search: (term: string, from = 0, to = 49) =>
    `/api/catalog_system/pub/products/search/${encodeURIComponent(term)}?_from=${from}&_to=${to}`,
  orderForm: "/api/checkout/pub/orderForm",
  addItem: (orderFormId: string) =>
    `/api/checkout/pub/orderForm/${orderFormId}/items`,
  updateItem: (orderFormId: string) =>
    `/api/checkout/pub/orderForm/${orderFormId}/items/update`,
  profile: "/api/checkout/pub/profiles",
  orders: "/api/oms/pvt/orders",
  simulate: "/api/checkout/pub/orderForms/simulation",
};

export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const CONFIG_DIR_NAME = "plazavea";
export const CONFIG_FILENAME = "session.json";
