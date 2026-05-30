# Customer Journey — Plaza Vea nativo vs CLI/MCP

## El carrito es de la CUENTA, no del browser

El orderForm VTEX está asociado a la **cuenta del usuario** (cookie `VtexIdclientAutCookie`),
no al dispositivo ni al browser.

- Lo que Claude agrega con el CLI aparece en tu app móvil → canal bidireccional real.
- Si otra persona abre el browser sin tu sesión → ve un carrito anónimo vacío (orderFormId distinto).
- Si entrás desde otro dispositivo con tu cuenta → ves el mismo carrito.
- Si borrás cookies del browser → VTEX crea un carrito anónimo nuevo, pero el tuyo en tu cuenta sigue intacto.

---

## Journey Plaza Vea nativo (hoy, sin CLI)

```
1. Abrís el browser o la app
2. Buscás el producto manualmente
3. Ves precio (pero no sabés si hay stock en TU local)
4. Agregás al carrito
5. Vas al checkout
6. Elegís dirección de envío
7. VTEX verifica stock en tu local → AHÍ te enterás si no hay
   → Si no hay: carrito roto, empezás de nuevo ← DOLOR CENTRAL
8. Pagás
```

**Gap que no resuelve la app:**
- No avisa stock por local ANTES del checkout
- No muestra cuánto gastaste en el mes / año
- No hay canal para que Claude opere en tu nombre

---

## Journey con plazavea-cli / MCP (propuesto)

```
1. Claude (o vos en terminal) buscás el producto
   → plaza search "arroz" --output json

2. Claude verifica stock en TU local ANTES de agregar
   → plaza simulate --sku X --address 1
   → "Disponible en Rímac — entrega hoy" ← CHECKOUT LIMPIO GARANTIZADO

3. Claude agrega al carrito
   → plaza add X
   → aparece en tu app al instante (misma cuenta)

4. Confirmás en terminal o app
   → plaza cart

5. (Opcional) Cuánto gasté este mes?
   → plaza analytics --month 2026-05
   → "S/239 en mayo, tu top: Huevos La Calera x4"

6. (Opcional) ¿Bajó el precio del arroz integral?
   → plaza track check
   → "Arroz Integral BELL'S bajó a S/18.90 (alerta: S/19.00) ← alertado"
```

**Lo que el CLI agrega que la app no tiene:**
- Verificación de stock local ANTES del checkout (no al final)
- Historial de gasto por período (la app solo muestra órdenes, no suma)
- Canal para que Claude opere las compras sin que abras el browser
- Radar de precios con alertas

---

## Diferencia clave: cuándo te enterás del stock

| | Plaza Vea nativo | CLI/MCP |
|---|---|---|
| Stock global | Al buscar ✅ | Al buscar ✅ |
| Stock en TU local | Al hacer checkout ❌ (demasiado tarde) | Con `simulate` ✅ (antes de agregar) |
| Si no hay stock | Carrito roto, rehacer todo | Warning antes de agregar |

---

## Modelo de sesiones VTEX (importante para debuggear)

```
Usuario A (vos)        → VtexIdclientAutCookie_A → orderFormId_A → carrito_A
Usuario B (otra cuenta)→ VtexIdclientAutCookie_B → orderFormId_B → carrito_B
Visitante anónimo      → sin cookie auth         → orderFormId_anónimo → carrito vacío
```

El CLI opera siempre con TU cookie → TU orderForm → TU carrito.
Si ves el carrito vacío desde otro browser: ese browser no tiene tu cookie → carrito anónimo distinto.
