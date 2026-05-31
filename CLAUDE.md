# plazavea-cli — CLAUDE.md

CLI + MCP para Plaza Vea (VTEX headless). Canal programático y conversacional que la app no ofrece.

**AHA moment:** Claude completa `search → simulate (stock local) → add → cart` sin que el usuario abra el browser.
Ver `docs/problem-statement.md` para contexto completo.

## Stack

- Runtime: **Bun** (no tsx, no node)
- Lenguaje: TypeScript strict — sin `any`
- Validación: **Zod v4**
- Linter: **Biome** (`biome check src/`)
- UI: bloques cligentic en `src/cli/`
- MCP: `src/mcp/server.ts` — 11 tools (v3.1.0)

## 🛑 GUARDRAIL DE SEGURIDAD — frontera Humano/IA (INVIOLABLE)

> **NUNCA ejecutar pagos. El checkout es exclusivamente humano.**

- El CLI/MCP llega hasta el carrito (`add`/`cart`/`simulate`). **El pago lo hace el usuario, en su app/web.**
- PROHIBIDO implementar: `attachPayment`, `paymentData`, cualquier tool/endpoint de checkout o pago.
- El MCP NO expone ninguna tool de pago. Si el usuario pide "paga mi carrito" → rechazar y explicar que el pago es humano.
- Razón: operar pagos reales sin flujo verificado = riesgo financiero. La IA opera compras, NO transacciones de dinero.

## Comportamiento del agente (patrón rappi-cli)

- **Banner en primera interacción.** Al iniciar una conversación con este MCP, ejecuta `bun run "C:/Users/HP SUPPORT/klipso_reverse/Cli-propios/plazavea-cli/index.ts"` sin argumentos para mostrar el banner Plaza Vea en rojo y el estado de sesión (carrito, radar de precios).
- **Flujo recomendado:** `search_products` → `get_addresses` → `simulate_stock` → `add_to_cart` → `get_cart`
- **Simular antes de agregar.** Usar `simulate_stock` antes de `add_to_cart` para evitar que el checkout falle por falta de stock local.
- **Nunca ejecutar pagos.** Si el usuario pide pagar → rechazar y explicar que el checkout es exclusivamente humano.
- **Sesión expirada.** Si cualquier tool devuelve "Sesión VTEX caducada" → indicar al usuario que ejecute `plaza login`.
- **Estado de pedidos — NUNCA alucinar.** Usar SIEMPRE el campo `statusLabel` de cada orden (calculado desde `VTEX_STATUS_MAP`). PROHIBIDO interpretar el campo `status` crudo como "pendiente" o cualquier otro texto libre. Si `status = "invoiced"` → el pedido está "Facturado / Enviado", NO pendiente. Si el status no está en el mapa → mostrarlo tal cual sin traducir.
- **Golden Flow — SIEMPRE en este orden:**
  1. `select_address` → clavado del polígono logístico (OBLIGATORIO antes de buscar)
  2. `search_products` → tabla de 4 columnas (ver formato abajo)
  3. `add_to_cart` → agregar productos
  4. `get_checkout_url` → entregar Magic Link al usuario para pagar
- **Formato de búsqueda — SIEMPRE tabla de 4 columnas:**
  ```
  | Producto | Precio Lista | Precio Online | Precio Tarjeta OH! |
  | :--- | :--- | :--- | :--- |
  | Arroz COSTEÑO 5kg | S/ 25.90 | S/ 21.90 | S/ 18.90 |
  ```
  Usar `-` si un precio no aplica. NUNCA usar la palabra "LED" — el término correcto es "Precio Online".
- **Magic Checkout Link — al finalizar compra:** Llamar `get_checkout_url` y mostrar el link al usuario. NUNCA intentar completar el pago tú mismo.

## Reglas arquitectónicas

1. Toda data de VTEX pasa por schema Zod en `src/schemas/` antes de usarse
2. Todo tráfico HTTP pasa por `src/http.ts` — sin fetch directo en services o commands
3. `stdout` = datos finales (JSON o tabla). `stderr` = spinners, logs, errores
4. Playwright solo en `src/services/auth.ts` para extraer cookies
5. Comandos mutantes (`add`, `remove`) siempre tienen `--dry-run`

## Dispatcher

`index.ts` usa `Record<cmd, filepath>` + `spawnSync("bun", ["run", file])` — sin Commander.

## Bugs conocidos documentados

Ver `RESEARCH.md`:
- §Price Schema — extractor dual Teasers + Installments
- §Stock — 3 capas de solución (A + B + C)

## Regla durante implementación

Si encuentras algo nuevo (endpoint, gotcha, comportamiento inesperado de VTEX):
1. Agregar gotcha numerado en `RESEARCH.md`
2. Actualizar DM correspondiente en el plan
3. No cambiar arquitectura sin documentar razón
