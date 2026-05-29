# Problem Statement — plazavea-cli

## QUIÉN
Usuario que compra en Plaza Vea regularmente desde Lima (frecuencia: 1-2x por semana).

## QUÉ
No existe una interfaz programática ni conversacional para Plaza Vea — solo web/app manual.

## POR QUÉ

### El journey hoy (sin el CLI)
```
buscás "arroz" en la app  →  dice "disponible ✅"  →  armás carrito (10 items)
      →  llegás al checkout  →  "no hay stock en tu local ✖"
                                      ▲
                        te enterás en el PEOR momento: el final
```

La app dice "disponible" mirando el stock general — pero cada tienda física tiene su propio stock.
Te enterás de que no hay recién cuando intentás pagar. Demasiado tarde.

### El journey con el CLI
```
Claude busca  →  verifica stock en TU local ANTES  →  solo agrega lo que sí llega
      →  checkout LIMPIO  ✅  sin sorpresa al final
```

### Otros problemas
- El flujo de compra requiere navegación manual cada vez: abrir browser, buscar, comparar, agregar
- La app muestra órdenes pero no las analiza: sin totales por período, sin productos más comprados, sin tendencias de precio
- No hay canal para que Claude opere las compras en nombre del usuario

## AHA MOMENT
> Claude busca, verifica que hay stock en el local del usuario, y agrega al carrito — sin abrir el browser. **El checkout no falla.**

```bash
plaza search "arroz costeño" --output json     # Claude busca
plaza simulate --sku 10275386 --postal 15094   # verifica stock en TU local (Rímac)
plaza add 10275386                              # agrega al carrito
plaza cart                                      # confirma — checkout limpio
```

## DONE WHEN
`plaza search X` → `plaza simulate --sku X --postal Y` → `plaza add X` → `plaza cart` muestra el ítem — sin abrir el browser. El checkout no falla por stock.

## BENEFICIOS ADICIONALES (después del AHA moment)
- **Gasto por período** — "¿cuánto gasté este mes / 3m / 12m?" que la app no muestra
- **Productos más comprados** — frecuencia y tendencias de consumo
- **Tendencias de precio** — ¿el arroz que compro subió desde la última vez?
- **Integración** — conectar con n8n, alertas, listas automáticas

## FUERA DE SCOPE (v3)
- Checkout / pago — riesgo sin flujo completo verificado
- Comparación con otros retailers (Wong, Tottus) — producto separado
- Paginación de búsqueda — `--limit 50` es suficiente para MCP

## NOTAS
- El carrito está asociado a la cuenta, no al browser — lo que Claude agrega se ve en la app y viceversa
- La app Plaza Vea NO tiene analytics de gasto — ese es el gap real
- Competencia directa: ninguna (Plaza Vea no expone API oficial ni tiene CLI/MCP)
- Detalles técnicos de implementación y bugs: ver `RESEARCH.md`
