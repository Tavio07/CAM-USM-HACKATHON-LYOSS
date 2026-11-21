# CAM USM

Prototipo de movilidad y acompañamiento en la UTFSM Casa Central, Valparaíso. La app muestra rutas aproximadas, permite compartir incidencias del campus y conecta a quien necesita apoyo con una persona que puede acompañarla.

## Cómo ejecutar la demo

- **Dos pestañas:** abre `index.html` con Live Server y usa la misma URL en ambas. Inicia sesión con dos ROL USM distintos.
- **Dos dispositivos en la misma red Wi-Fi:** desde la raíz, ejecuta `py -3 src/server/servidor.py --host 0.0.0.0 --port 8000` en Windows o `python3 src/server/servidor.py --host 0.0.0.0 --port 8000` en macOS o Linux. Abre `http://IP_DEL_EQUIPO:8000/` en ambos.
- **GitHub Pages:** publica la raíz del proyecto. Este modo usa el almacenamiento del navegador para la demo entre pestañas. La sincronización entre dispositivos usa el servidor Python.

El acceso consulta un directorio ficticio del repositorio, incluso sin servidor. Usa **202373045-2** (Daniela, con historial) o **202473018-K** (Octavio, sin historial), con la contraseña de demo **usm2026**. Los accesos rápidos completan e ingresan con esas cuentas. Usa solamente estas credenciales ficticias. Cada pestaña conserva su sesión al recargar. Un enlace como `?origen=p4` precarga el piso 4 del Edificio P al elegir **Necesito ayuda**.

## Cómo se recomiendan las rutas

El campus se representa como un **multigrafo de corredores precargados**. En [rutas.mjs](src/js/rutas.mjs), los nodos son ubicaciones del campus con coordenadas y, cuando corresponde, pisos. Las conexiones son bidireccionales y llevan sus propios pasos, barreras y trazado. Puede haber varias conexiones entre los mismos puntos.

- **Edificio P ↔ Edificio C:** variantes por el túnel y por Entrada Placeres, con escalera o ascensor según el piso.
- **Edificio C ↔ Biblioteca:** cuatro corredores por CIAC y Patio Central, piscina y vestidores, Plaza del Gran Árbol o Entrada Placeres. Esta última opción evita la escalera inicial del Hall C. Su continuidad sin peldaños sigue pendiente de verificar en terreno.

El motor compara únicamente las alternativas registradas para los puntos y pisos elegidos. Los trazados, tiempos y cantidades de escalones son estimaciones del prototipo. Si no hay un recorrido registrado o todas las alternativas quedan bloqueadas, la app ofrece pedir ayuda.

### Semáforo y peso

El **semáforo determina la viabilidad**. El **peso compara la dificultad** entre rutas que tienen el mismo color. Se ordenan primero las verdes, después las amarillas y al final las rojas. Dentro de cada grupo se prioriza el menor peso y, en caso de empate, el menor tiempo estimado.

| Factor | Efecto |
| --- | --- |
| Tiempo estimado | +1 punto por minuto |
| Escaleras | +1 punto por cada bloque de hasta 16 escalones, redondeado hacia arriba |
| Advertencia por clima o necesidades del viaje | +2 puntos por cada advertencia aplicable |
| Reporte activo que afecta el recorrido | +3 puntos por reporte. Una ruta verde pasa a amarilla si el reporte añade una precaución |
| Restricción incompatible o acceso indispensable bloqueado | Ruta roja, sin peso comparable y fuera de la recomendación |

El peso se expresa en **puntos de dificultad**. El tiempo estimado se muestra por separado. Los puntos de ruta tampoco intervienen en el ranking de ayudantes, que se actualiza con las calificaciones de las asistencias.

**Ejemplo.** Del piso 4 del P al C, la variante por Entrada Placeres con ascensor estima **4 minutos y 4 puntos** en condiciones normales. Con lluvia suma **2 puntos** por exposición. Si además hay un reporte activo de piso resbaloso en Entrada Placeres, suma otros **3 puntos** y queda en **amarillo con 9 puntos**. Si el ascensor P está detenido, la variante queda **roja** porque depende de ese ascensor.

### Cuándo afecta un reporte

El motor compara el lugar del reporte con el origen, el destino y los puntos intermedios registrados para cada alternativa. Un reporte ajeno al recorrido no modifica su peso. El aviso de ascensor detenido afecta únicamente a las variantes que lo usan. El bloqueo de la rampa C afecta a las variantes que pasan por esa rampa y las vuelve rojas si se seleccionó **Sin escaleras** o **Movilidad reducida**.

El selector **1 / 2 / 3 / 4 / Todas** controla las capas del mapa. Una ruta individual muestra únicamente sus marcadores pertinentes. **Todas** muestra la unión de los reportes que afectan a las rutas dibujadas. Las tarjetas de descripción siguen disponibles debajo y el selector no cambia el cálculo de la recomendación.


## Apoyos para el recorrido

En **Necesito ayuda**, los filtros se eligen para cada viaje. Además de las necesidades físicas y el clima, hay apoyos opcionales para personas con TEA, TDAH u otras neurodivergencias:

- **Menos estímulos:** penaliza los cruces vehiculares identificados.
- **Recorrido predecible:** penaliza cruces y recorridos con varios cambios de dirección.
- **Orientación clara:** advierte sobre tramos identificados con poca luz.

El usuario elige lo que le sirve ese día. La aplicación guarda esas selecciones en la solicitud del viaje si se pide ayuda. El perfil conserva solo los datos de la sesión y las estadísticas de acompañamiento.

## Reportes y asistencia en vivo

1. En la primera pestaña, entra a **Necesito ayuda**. Selecciona **Sin escaleras**, calcula del piso 4 del Edificio P al Edificio C y deja el resultado abierto.
2. En la otra, entra a **Quiero ayudar** y pulsa **Reportar**, junto a **Ranking**. Elige **Edificio P** y **Infraestructura · Ascensor detenido**, ajusta el tiempo y publica. Tanto estudiantes como ayudantes pueden crear avisos seleccionando lugar, tipo y duración.
3. En la primera pestaña verás la alerta y la ruta de ascensor en rojo. Desde **Bandeja de cuenta → Mis reportes → Sacar reporte**, el autor puede retirar su reporte y la ruta se recalcula.
4. Para probar el acompañamiento, solicita ayuda en la primera pestaña. En la segunda, acepta y finaliza. El estudiante confirma la llegada y califica con estrellas. Los puntos, el historial y el ranking se actualizan con esa asistencia.

Las pestañas comparten cambios mediante `BroadcastChannel` y `localStorage` en modo local. Con el servidor también se consulta la API REST cada 1,5 segundos mientras la vista está visible. El servidor guarda los datos en `asistencia-datos.json`, configurable con `--datos`.

## Duración de los reportes

La duración por categoría y el incremento para renovar se configuran en `src/data/report-ttl.json`. En **Reportar**, elige el lugar, el tipo y la duración. Los valores iniciales son 20 min para aglomeración, 90 min para piso resbaloso, 240 min para infraestructura general o construcción y 720 min para ascensor detenido. Los avisos públicos muestran lugar, tipo y tiempo restante. Los marcadores del mapa de resultados se filtran según las rutas visibles. Desde **Mis reportes** puedes usar **+15 min**, **Editar tiempo** o **Sacar reporte**. Al vencer, desaparecen el marcador y la alerta, y las rutas abiertas se recalculan automáticamente.

## Estructura

- `index.html` es la entrada web.
- `src/js/` contiene los módulos de interfaz, rutas, cuenta y sincronización.
- `src/styles/` contiene el CSS, `src/assets/` el logo y `src/data/` los datos de referencia del campus.
- `src/server/servidor.py` sirve la API y el frontend, sin dependencias externas.
