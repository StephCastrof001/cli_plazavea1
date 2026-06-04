# Decision Log — Plaza Vea CLI

> Registro de decisiones arquitectónicas y de producto.
> Propósito: defender decisiones en entrevistas, onboarding de colaboradores, y auditorías técnicas.

| Fecha | Decisión | Alternativas Consideradas | Por Qué Esta | Trade-offs Aceptados |
|-------|----------|--------------------------|--------------|----------------------|
| 2026-06 | **Bun como runtime** | Node.js, Deno | Velocidad nativa, TypeScript sin transpilación, test runner integrado | Ecosistema menor que Node, algunos paquetes incompatibles |
| 2026-06 | **MCP sobre Function Calling directo** | OpenAI Function Calling, REST puro | Estándar abierto, agnóstico al LLM, compatible con Claude/Cursor/Windsurf | Requiere cliente MCP (no funciona en cualquier chat) |
| 2026-06 | **Browser Handoff para pago (Guardrail Financiero)** | Integración directa de pago, Stripe Connect | Seguridad financiera innegociable: ningún agente IA ejecuta transacciones monetarias | El checkout no es automatizable end-to-end |
| 2026-06 | **Zod para validación de schemas** | io-ts, yup, TypeBox | Inferencia de tipos en runtime, errores claros, ecosistema maduro | Algo más verboso que alternativas |
| 2026-06 | **Hono para REST API** | Express, Fastify, Elysia | Ultraligero, compatible con Bun nativo, tipado con TypeScript sin config extra | Ecosistema más pequeño que Express |
| 2026-06 | **Funciones puras separadas del HTTP** | Lógica dentro del service con fetch | Testeables sin red, sin mocks de HTTP | Más archivos, más indirección |
| 2026-06 | **Máquina de 4 estados para checkout VTEX** | Flujo libre, sin restricciones de orden | VTEX tiene restricciones reales (CHK0041 con carrito vacío). Los estados previenen errores cíclicos | El agente IA debe respetar el orden; no puede saltarse estados |
| 2026-06 | **simulate_stock como único validador de stock local** | search_products con filtro de región | VTEX search es global (CDN cacheado). Solo simulate_stock accede al orderForm con región real | El usuario debe llamar simulate antes de add_to_cart |

---

## Decisiones Pendientes de Tomar

| Decisión | Opciones | Deadline |
|----------|----------|----------|
| Almacenamiento de credenciales | Texto plano (actual) vs node-keytar (Keychain OS) | Cuando escale a usuarios externos |
| Rate limiting en REST server | Sin límite (actual) vs middleware Hono | Cuando se exponga a red pública |
| Memoria entre sesiones | Sin memoria (actual) vs UserMemory en config.ts | Cuando el agente necesite personalización |
