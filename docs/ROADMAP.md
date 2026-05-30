# Roadmap / Sprint — plazavea-cli

## Estado actual (v3.1) — verificado en vivo

| Feature | Estado |
|---------|--------|
| `search` (3 precios) | ✅ |
| `cart` / `add` / `remove` | ✅ smoke tested (host www, PATCH/POST) |
| `orders` | ✅ |
| `simulate` (stock local) | ✅ vía attachShipping + direcciones guardadas |
| `analytics` (gasto por mes, top SKUs) | ✅ 50 órdenes reales |
| `track` (radar de precios) | ✅ add/list/check/remove/history |
| `whoami` / `logout` / `login` | ✅ login bajo Node+tsx |
| MCP server | ✅ 9 tools |
| REST server (Hono) | ✅ :3847 |
| Tests (bun:test) | ✅ 45 (price, cart, analytics, tracker) |
| Docs | ✅ README, RESEARCH, CONTEXT, problem-statement, customer-journey, ADR-0001 |

---

# Sprint de cierre — por capas (Pilar 7)

## 🔒 Capa Safety/Seguridad (NUEVA — gap detectado)

### S1. Hardening pre-publicación
- **💼 Negocio:** Vamos a abrir el código (MIT). Las cookies son sesión real de Plaza Vea. Un dev clona, no lee la advertencia, le roban la sesión → daño reputacional al proyecto.
- **✅ Criterios de aceptación:**
  - `.gitignore` excluye `session.json`, `prices.json`, `orders-cache.json`, `*.config.json` (defensa aunque vivan en `~/.config`)
  - `git ls-files` no muestra ningún archivo de sesión/cache
  - README sección Seguridad lista riesgos (cookie en texto plano, `logout` al terminar)
- **🏁 DoD:** `git ls-files | grep -E "session|cache|prices"` vacío; advertencia visible en README.

### S2. Guardrail Checkout (frontera Humano/IA)
- **💼 Negocio:** Decisión de producto: la IA NO toca pagos. Pero hoy no está CODIFICADA — nada impide que alguien le diga a Claude "paga mi carrito" y busque un endpoint de pago.
- **✅ Criterios de aceptación:**
  - El MCP NO expone ninguna tool de checkout/pago (verificado: hoy son 9 tools, ninguna de pago) ✅
  - `CLAUDE.md` del proyecto dice en **negrita**: "NUNCA ejecutar pagos. El checkout es exclusivamente humano."
  - `attachPayment` / checkout NO se implementa en v3
- **🏁 DoD:** regla escrita en CLAUDE.md; `grep -i "payment\|checkout" src/mcp/server.ts` vacío.

## 🤖 Capa Agent/MCP

### 2. Exponer `simulate` + `get_addresses` como MCP tools
- **💼 Negocio:** Arreglamos `simulate` solo como CLI. El AHA ("Claude verifica stock local antes de agregar") NO funciona por MCP todavía — y el MCP es el canal del producto. El diferenciador está a medias.
- **✅ Criterios de aceptación:**
  - Tool `simulate_stock(skuId, addressIndex?)` → disponibilidad + almacén local
  - Tool `get_addresses()` → direcciones guardadas
- **🏁 DoD:** desde Claude, "¿hay arroz en mi local de Rímac?" se responde por MCP, verificado en vivo.

## 🎨 Capa UX/Presentación

### 1. Banner + showStatus (absorber de antigravity)
- **💼 Negocio:** Paridad visual con los 6 CLIs del framework. Banner = repo percibido como mantenido/profesional.
- **✅ Criterios de aceptación:** `bun run index.ts` sin args → banner rojo "PLAZA VEA" + estado de sesión.
- **🏁 DoD:** banner en terminal y Claude Code (FORCE_COLOR), sin romper el dispatcher.

## ✅ Capa Tests

### 3. Smoke test end-to-end (script repetible) + test de simulate
- **💼 Negocio:** Hoy el smoke se corre a mano. Script repetible = regresión en segundos. Es el gate del CLAUDE.md global.
- **✅ Criterios de aceptación:**
  - `bun run smoke` → search → simulate → add → cart → remove → analytics → track, con ✅/✖ por paso
  - Test unitario de la extracción de disponibilidad de `logisticsInfo` (mock → available true/false)
- **🏁 DoD:** `bun run smoke` verde end-to-end; suite 45 → ~48.

## 📦 Capa Distribución

### 4. Archivar antigravity (decisión PM)
- **💼 Negocio:** Dos repos vivos = ambigüedad. Una sola verdad consolida tráfico/estrellas.
- **✅ Criterios de aceptación:** antigravity "archived" en GitHub; su README apunta a v3.
- **🏁 DoD:** `gh repo view` → `isArchived: true`; `claude mcp list` solo v3.

### 5. LICENSE + metadata + README agnóstico al LLM
- **💼 Negocio:** Sin LICENSE nadie serio adopta (riesgo legal). README dice "Claude" 9 veces → debería ser agnóstico (Claude Code, Cursor, cualquier cliente MCP). "Servidor MCP Universal para Retail" multiplica el valor percibido vs "Plugin de Claude".
- **✅ Criterios de aceptación:**
  - `LICENSE` MIT
  - `package.json` con `repository`, `keywords`, `author`
  - README posicionado como "Servidor MCP para retail VTEX" (✅ hecho), y referencias a "Claude" generalizadas a "Claude Code / Cursor / cliente MCP" donde aplique
- **🏁 DoD:** `npm pack` válido; README sin atar el producto a un solo LLM.

## ⚙️ Capa Funcional (decisión)

### 6. `buy` interactivo — o posponer explícitamente
- **💼 Negocio:** v2 tiene `buy` (search+add en uno). Mejora UX, ROI medio (search+add ya lo cubren).
- **✅ Criterios de aceptación:** `plaza buy "arroz"` → lista → elegís → agrega.
- **🏁 DoD:** implementado y smoke-tested, O documentado aquí como "pospuesto a propósito" (no limbo).

---

## ✅ Ya cerrado (no re-abrir)
- Customer journey documentado (`docs/customer-journey.md`) + hallazgo attachShipping en `RESEARCH.md §Stock`
- ADR-0001 runtime híbrido Bun/Node (`klipso_reverse/_knowledge/decisions/`)

## Priorización por ROI
**S2 (guardrail, barato+crítico) → 2 (cierra AHA por MCP) → S1 (seguridad pre-publish) → 1 (banner) → 3 (smoke) → 4 (archivar) → 5 (LICENSE) → 6 (decisión buy)**

## Fuera de scope (v3) — decisión consciente
- Checkout / pago (frontera humano/IA — ver S2)
- Comparación con otros retailers (producto separado)
- Paginación de búsqueda (`--limit` suficiente)
