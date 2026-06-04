# Definition of Done — Plaza Vea CLI

> Un release solo se considera "terminado" cuando **todos** los items están marcados.
> Versión: 1.0 | Fecha: 2026-06

---

## Checklist por Release

### Código
- [ ] `bun run typecheck` → 0 errores
- [ ] `bun run lint` → 0 warnings
- [ ] `bun test` → todos los tests pasan (actualmente 68+)
- [ ] Nuevas funciones de negocio tienen función pura separada del HTTP
- [ ] Nuevas funciones puras tienen al menos 3 tests unitarios

### Integración
- [ ] `bun run smoke:mcp` → 18/18 tools responden
- [ ] `bun run smoke:checkout` → flujo de 4 estados completo sin CHK0041
- [ ] Login manual verificado (browser abre y captura cookie)

### Seguridad
- [ ] `session.json` está en `.gitignore` ✓
- [ ] `.mcp.json` está en `.gitignore` ✓
- [ ] CORS configurado en `server.ts` (solo localhost)
- [ ] Ningún dato de pago o contraseña pasa por el CLI

### Gobernanza
- [ ] `DECISIONS.md` actualizado si se tomó alguna decisión arquitectónica
- [ ] `GOVERNANCE.md` actualizado si cambia qué datos van al LLM
- [ ] Descriptions de tools MCP incluyen versión y fecha si fueron modificados
- [ ] Audit trail activo en tools MCP modificados

### README
- [ ] Versión en el header coincide con `package.json`
- [ ] Número de tools en el badge coincide con tools reales
- [ ] Todo lo que dice el README fue verificado en el smoke test
- [ ] Escrito en español neutro (no voseo)
- [ ] Sección de seguridad refleja el estado actual

### Git
- [ ] Un solo branch de trabajo (no carpetas duplicadas del proyecto)
- [ ] Commit message describe QUÉ cambió y POR QUÉ
- [ ] Tag de versión creado: `git tag vX.Y.Z`

---

## Criterio de Salida para MVP

Un CLI nuevo está listo para compartir públicamente cuando:
1. Fase 1 (Ingeniería inversa) → `RESEARCH.md` con endpoints documentados
2. Fase 2 (Schemas) → al menos 1 schema Zod que valida la respuesta principal de la API
3. Fase 3 (Services) → al menos 1 función pura testeable
4. Fase 4 (Interface) → CLI funcional O servidor MCP funcional (no requiere ambos)
5. Fase 5 (Seguridad) → `.gitignore` correcto, advertencia de seguridad en README
6. Fase 6 (Tests) → al menos 3 tests unitarios y 1 smoke test
7. Fase 7 (README) → refleja la realidad, versión correcta, sección de seguridad honesta
