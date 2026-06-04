# Governance — Plaza Vea CLI

> Política de privacidad de datos y gobernanza de agentes IA.
> Versión: 1.0 | Fecha: 2026-06

---

## 1. Datos que Viajan al LLM (via MCP)

Cuando el usuario conecta este servidor MCP a un cliente IA (Claude, Cursor, etc.), los datos de las respuestas se envían al modelo como contexto.

| Dato | ¿Va al LLM? | Justificación |
|------|-------------|---------------|
| Nombres de productos | ✅ Sí | Necesario para que el agente opere |
| Precios (regular, led, OH) | ✅ Sí | Core del producto |
| Stock disponible / no disponible | ✅ Sí | Core del producto |
| ID de dirección (addressId) | ✅ Sí | Necesario para simulate_stock |
| Totales del carrito | ✅ Sí | Para confirmación del usuario |
| **Dirección física completa** | ⚠️ Mínimo | Solo el campo necesario para la operación actual |
| **Historial completo de pedidos** | ⚠️ Limitado | Solo los últimos N pedidos, sin datos de envío |
| **Número de tarjeta / datos financieros** | ❌ Nunca | Este CLI nunca accede a datos de pago |
| **Contraseña / PIN** | ❌ Nunca | El login es vía browser, la contraseña no pasa por el CLI |

---

## 2. Acciones que Requieren Validación Humana (HITL)

El agente IA **nunca** puede ejecutar las siguientes acciones de forma autónoma:

| Acción | Razón | Implementación |
|--------|-------|----------------|
| **Pago / Checkout** | Transacción financiera irreversible | Browser Handoff — `open_checkout` abre el browser, el humano paga |
| **Login** | Credenciales sensibles | Browser Handoff — `open_login` abre el browser |

---

## 3. Almacenamiento Local de Credenciales

| Dato | Dónde se guarda | Riesgo | Mitigación |
|------|-----------------|--------|------------|
| Cookie de sesión VTEX | `~/.config/plazavea/session.json` (texto plano) | Legible por malware o usuario con acceso al home | Ejecutar `logout` al terminar. `chmod 600` en Unix. |
| Token MCP config | `.mcp.json` (NO subir a git) | Exposición de cookie si se hace push accidental | `.mcp.json` está en `.gitignore` |

---

## 4. Política de Versiones de Prompts MCP

Los `description` de cada tool son prompts que el LLM usa para decidir cuándo y cómo llamar a cada herramienta. Cambiarlos sin control puede romper el comportamiento del agente silenciosamente.

**Regla:** Cualquier cambio a un `description` de tool debe incluir en el commit:
- Qué cambió
- Por qué cambió
- Fecha

Ejemplo de description versionado:
```typescript
description: `[v1.1 - 2026-06-02] Verifica disponibilidad en almacén LOCAL.
IMPORTANTE: search_products es global (CDN). Este tool es el ÚNICO que regionaliza.
Requiere que haya al menos un ítem en el carrito (Estado 2 completado).`
```

---

## 5. Política de Seguridad del REST Server

El servidor REST (`bun run server.ts`) opera en `localhost:3847` con:
- ❌ Sin autenticación
- ❌ Sin rate limiting
- ✅ CORS restrictivo (solo localhost)

**Regla:** Nunca exponer el puerto 3847 a una red pública o a internet.
