# Gap Analysis — plazavea-cli vs CLIs de referencia

> Diagnóstico read-only. Fecha: 2026-06-01.
> Baseline: CLIs de referencia en `klipso_reverse/` (rappi, ubereats, bancolombia, sunat, trii, wiener, v0).
> Objetivo: ubicar a plazavea-cli contra el estándar del framework y detectar deuda cruzada.

---

## 1. Matriz de capacidades (todos los CLIs)

| CLI | Tests | Smoke | MCP | REST | Banner | Help categ. | tsc real | RESEARCH | problem-stmt | LICENSE |
|-----|:----:|:----:|:---:|:----:|:------:|:-----------:|:--------:|:--------:|:------------:|:-------:|
| **plazavea-cli** | 62 (7f) | ✅ | ✅ | ✅ | ✅ | ✅ | **0** | ✅ | ✅ | ✅ |
| rappi-cli | 0 | – | ✅ | ✅ | ✅ | ✅ | 0 | – | – | – |
| ubereats-cli | 0 | – | ✅ | ✅ | ✅ | ✅ | 0 | – | – | – |
| bancolombia-cli | 0 | – | ✅ | ✅ | ✅ | – | 5 | – | – | – |
| trii-cli | 0 | – | ✅ | ✅ | ✅ | – | 23 | – | – | – |
| wiener-cli | 43f | – | – | – | – | – | 0 | ✅ (recon.md) | – | ✅ |
| v0-cli | 10f | – | – | – | – | – | 0 | – | – | ✅ |
| sunat-cli | 0 | – | – | – | – | – | n/d | – | – | – |
| whatsapp-cli | 0 | – | ✅ | ✅ | – | – | n/d | – | – | – |
| unir-cli | 0 | – | – | – | – | – | n/d | – | – | ✅ |
| spoti-cli | 0 | – | – | – | – | – | n/d | – | – | – |

> `tsc real` = errores strict-null reales (`TS18048/2532/2533/2538/2345`), excluye lib-noise de tsc standalone.
> `(Nf)` = N archivos de test. plazavea: 7 archivos = 62 casos.

---

## 2. Lectura: dónde está plazavea-cli

**plazavea-cli es hoy el CLI más completo del repo.** Único con las 10 dimensiones en verde:
- Único con **smoke test** repetible.
- Único con **problem-statement.md** (gate del CLAUDE.md global).
- Empatado en lo más alto: **0 errores tsc reales** (junto a rappi/ubereats/wiener/v0).
- Help categorizado-coloreado: solo plazavea, rappi, ubereats.

```
Ranking de completitud (dimensiones en verde / 10):
  plazavea-cli  ██████████  10
  rappi-cli     ██████      6
  ubereats-cli  ██████      6 (+.mcp.json)
  trii-cli      ████        4  (pero 23 tsc reales)
  bancolombia   ████        4  (5 tsc reales)
  wiener-cli    ████        4  (43 test files, recon.md)
  v0-cli        ███         3
  resto         ██          2
```

---

## 3. Gaps DE plazavea-cli (lo que aún falta)

| # | Gap | Severidad | Detalle |
|---|-----|:---------:|---------|
| P-1 | **cart-sync no verificado en vivo** | 🔴 Alta | El AHA del producto (carrito CLI→browser) tiene código + fixes pero NUNCA demo end-to-end real. Tests mock no lo cubren. |
| P-2 | **npm no publicado** | 🟡 Media | Registry 404. Bloqueado por OTP. Sin publicar, "instalable" es teórico. |
| P-3 | **`typecheck` no está en el pipeline** | 🟡 Media | QA corre `bun test` + `biome`, nunca `tsc`. Por eso 14 errores convivieron con "todo verde". Sin gate, la deuda vuelve. |
| P-4 | **ADR local ausente** | ⚪ Baja | ADR-0001 vive en `_knowledge/decisions/` (framework), no en el repo. Decisiones propias (Golden Flow, guardrail pagos) sin ADR formal. |

---

## 4. Gaps DEL FRAMEWORK (deuda cruzada — NO tocar, solo diagnóstico)

> Estos son de los CLIs de referencia. Documentados para el framework, NO para arreglar aquí.

### 4.1 — RESEARCH.md mandado pero ausente
El `klipso_reverse/CLAUDE.md` dice: *"sin RESEARCH.md completo → no hay implementación"*. Realidad:
- **6 de 7** CLIs de referencia NO tienen RESEARCH.md (rappi, ubereats, bancolombia, sunat, trii, v0).
- Solo wiener tiene equivalente (`recon.md`).
- **plazavea-cli sí lo tiene** → cumple el gate que el resto saltó.

### 4.2 — Tests casi inexistentes
- **7 de 10** CLIs tienen **0 tests** (rappi, ubereats, bancolombia, sunat, whatsapp, unir, spoti).
- Solo wiener (43f), v0 (10f), plazavea (62 casos) testean.
- El "estándar wiener" del plan retrospectivo es real pero **minoritario** en el repo.

### 4.3 — Deuda de tipos viva en producción
- **trii-cli: 23 errores strict-null reales** — el peor del repo.
- **bancolombia-cli: 5** — Tipo C (banco), donde un crash por undefined es más caro.
- Ningún CLI de referencia corre `tsc` en su pipeline → la deuda es invisible para ellos.

### 4.4 — Banner solo en Tipo A
- Banner presente en Tipo A/E (rappi, ubereats, bancolombia, trii).
- **Ausente en wiener, v0** (Tipo B+D, D) → inconsistencia visual del framework.
- Help categorizado: solo los 2 Tipo A más maduros (rappi, ubereats) + plazavea.

---

## 5. Recomendaciones (priorizadas por ROI)

### Para plazavea-cli (accionable aquí)
1. **🔴 Verificar cart-sync en vivo** (P-1) — es el AHA; sin demo real no hay "DONE" (Pilar 6).
2. **🟡 Agregar `"typecheck": "tsc --noEmit"`** a package.json (P-3) — barato, cierra el gap de proceso permanente.
3. **🟡 npm publish** (P-2) — cuando haya OTP.
4. **⚪ ADR local** (P-4) — formalizar Golden Flow + guardrail pagos.

### Para el framework (subir a `_knowledge/`, fuera de scope aquí)
- **Agregar `tsc` al pipeline estándar** del TEMPLATE.md — trii/bancolombia tienen deuda invisible.
- **Reconocer que RESEARCH.md y tests son aspiracionales**, no práctica real (6/7 y 7/10 los saltan). O se enforce con hook, o se baja a "recomendado".
- **plazavea-cli como nuevo CLI de referencia** para Tipo A-VTEX: es el único con las 10 dimensiones completas.

---

## 6. Conclusión cruda

plazavea-cli **superó al benchmark** (rappi/ubereats) en completitud: mismo nivel técnico (0 tsc, banner, help, MCP) **más** lo que ellos no tienen (smoke, problem-statement, RESEARCH, tests, LICENSE).

El único gap que importa para el negocio es **P-1: cart-sync sin verificar**. Todo lo demás es pulido o release. El producto no está "terminado" hasta esa demo — es la diferencia entre "0 errores tsc" (calidad de código) y "el usuario ve su carrito en el browser" (valor entregado).
