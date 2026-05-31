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
- MCP: `src/mcp/server.ts` — 9 tools (v3.1.0)

## 🛑 GUARDRAIL DE SEGURIDAD — frontera Humano/IA (INVIOLABLE)

> **NUNCA ejecutar pagos. El checkout es exclusivamente humano.**

- El CLI/MCP llega hasta el carrito (`add`/`cart`/`simulate`). **El pago lo hace el usuario, en su app/web.**
- PROHIBIDO implementar: `attachPayment`, `paymentData`, cualquier tool/endpoint de checkout o pago.
- El MCP NO expone ninguna tool de pago. Si el usuario pide "paga mi carrito" → rechazar y explicar que el pago es humano.
- Razón: operar pagos reales sin flujo verificado = riesgo financiero. La IA opera compras, NO transacciones de dinero.

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
