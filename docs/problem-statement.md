# Problem Statement — plazavea-cli

## QUIÉN
Usuario que compra en Plaza Vea regularmente desde Lima (frecuencia: 1-2x por semana).

## QUÉ
No existe una interfaz programática ni conversacional para Plaza Vea — solo web/app manual.

## POR QUÉ
- El flujo de compra requiere navegación manual cada vez: abrir browser, buscar, comparar, agregar
- La app muestra órdenes pero no suma ni analiza el historial de gasto (sin totales por período, sin productos más comprados, sin tendencias de precio)
- No hay canal para que Claude opere las compras en nombre del usuario

## AHA MOMENT
> Claude busca un producto, verifica si hay stock en el local del usuario, y lo agrega al carrito — sin que el usuario abra el browser.

```bash
# El flujo completo sin browser:
plaza search "arroz costeño" --output json        # Claude busca
plaza simulate --sku 10275386 --postal 15001       # verifica stock local
plaza add 10275386                                  # agrega al carrito
plaza cart                                          # confirma
```

## BENEFICIOS ADICIONALES (después del AHA moment)
- **Gasto por período** — responder "¿cuánto gasté este mes / 3m / 12m?" que la app no muestra
- **Productos más comprados** — frecuencia y tendencias de consumo (requiere endpoint de detalle de orden)
- **Tendencias de precio** — ¿el arroz que compro subió desde la última vez?
- **Integración** — conectar con n8n, alertas, listas automáticas

## DONE WHEN
`plaza search X` → `plaza simulate --sku X --postal Y` → `plaza add X` → `plaza cart` muestra el ítem añadido — todo sin abrir el browser.

## FUERA DE SCOPE (v3)
- Checkout / pago — riesgo sin flujo completo verificado
- Comparación con otros retailers (Wong, Tottus) — producto separado
- Paginación de búsqueda — `--limit 50` es suficiente para MCP

## NOTAS TÉCNICAS
- El carrito (orderForm VTEX) está asociado a la cuenta, no al browser — lo que Claude agrega se ve en la app del usuario y viceversa
- La app Plaza Vea NO tiene analytics de gasto — ese es el gap real
- Competencia directa: ninguna (Plaza Vea no expone API oficial ni tiene CLI/MCP)
