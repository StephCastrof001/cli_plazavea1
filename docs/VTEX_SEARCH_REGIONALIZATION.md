# Hallazgo VTEX — El search de plazavea NO se regionaliza

**Estado:** CERRADO (spike P0, 2026-06-02) · **Decisión:** Camino C (search global + simulate local)

---

## Pregunta del spike

¿Puede `search` mostrar stock del local del usuario (Comas vs Cercado) en vez de stock global?
Hipótesis inicial (de una fuente externa): inyectar `regionId` en la cookie `vtex_segment`
haría que VTEX regionalice el catálogo. **Resultó FALSA para plazavea.**

## Método

1. **Firecrawl** docs VTEX (`sessions-system-overview`) — estructura de `vtex_segment`.
2. **Live** (sesión real): `regions(postalCode)` para ambas direcciones + search comparando
   `AvailableQuantity` por región.
3. **Captura del frontend** (devtools Network) del request real de búsqueda de plazavea.

## Evidencia

| Hecho | Resultado |
|---|---|
| `vtex_segment` lleva `regionId`+`channel` y regionaliza precio/stock | ✓ confirmado en docs VTEX |
| `regions(postalCode)` da `regionId` distinto por dirección | ✓ Comas `…swl114` vs Cercado `…swl125` |
| Legacy `catalog_system/search` + `vtex_segment` | ✗ 0 divergencia — 10 SKUs idénticos byte a byte |
| Intelligent Search endpoint | existe (200) pero plazavea no lo usa para listar; términos redirigen a categoría |
| **Request real del frontend** | `www.plazavea.com.pe/api/catalog_system/pub/products/search/?sc=1` |
| **Headers de cache de ese request** | `cache-control: public, s-maxage=300` + CloudFront `x-cache` |

### El smoking gun: cache público compartido
```
cache-control: public, max-age=0, s-maxage=300
x-cache: Miss from cloudfront
x-vtex-janus-router-backend-app: portal-search-v3.9.1
```
Una respuesta **regionalizada no puede** vivir en cache público de CDN — sería idéntica para
todos los usuarios sin importar su zona. plazavea cachea el search en CloudFront por 300s para
TODOS. Por contrato de arquitectura, **el search es global, no personalizable por región.**

## Conclusión

- El search de plazavea (`catalog_system`, host `www`, `sc=1`) devuelve **catálogo global cacheado**.
- NO se regionaliza ni con `vtex_segment`, ni con `regionId`, ni con Intelligent Search.
- La regionalización de stock **solo existe** en `simulate`/checkout (orderForm → logisticsInfo,
  per-sesión, no cacheable). Por eso `simulate_stock` SÍ da stock local y el search no.
- **El AHA "ve stock de tu local al buscar" no es viable** en la arquitectura de plazavea.

## Decisión — Camino C

- `search` = stock **global** (honesto; es lo que VTEX expone y cachea).
- `simulate_stock` = stock **local** (único validador real, vía orderForm).
- Flujo: el usuario busca (global) → `simulate_stock` confirma disponibilidad en su local antes de agregar.
- `select_address` sigue siendo necesario para simulate/checkout, pero **no cambia los resultados del search** (y no debe prometerlo).

### Descartados
- **Camino A** (regionId/segment en search): inviable — search es cache público global.
- **Camino B** (batch-simular top-N tras search): N llamadas por búsqueda → lento, riesgo rate-limit. Reservado solo si el negocio exige stock local en search a toda costa.

## Implicación para el problem-statement
Reescribir el valor del CLI: no es "search regionalizado", es **"simulate confirma stock local
antes de agregar + checkout sin fallos por stock"**. `simulate_stock` es la feature estrella, no el search.
