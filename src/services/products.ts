import { ENDPOINTS } from "../constants.js";
import { http } from "../http.js";
import { normalizeVtexSearch, type ProductResult } from "../schemas/product.js";

export async function searchProducts(term: string, limit = 10): Promise<ProductResult[]> {
  const results = await http.get<unknown[]>(ENDPOINTS.search(term, 0, limit - 1));
  const normalized = normalizeVtexSearch(results);
  // Disponibles primero
  return normalized.sort((a, b) => Number(b.inStock) - Number(a.inStock));
}
