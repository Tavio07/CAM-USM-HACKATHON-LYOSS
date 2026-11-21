# CAM USM

Prototipo de movilidad y acompañamiento en la UTFSM Casa Central, Valparaíso. La app muestra rutas aproximadas, permite compartir incidencias del campus y conecta a quien necesita apoyo con una persona que puede acompañarla.

## Cómo ejecutar la demo

- **Dos pestañas:** abre `index.html` con Live Server y usa la misma URL en ambas. Inicia sesión con dos ROL USM distintos.
- **Dos dispositivos en la misma red Wi-Fi:** desde la raíz, ejecuta `py -3 src/server/servidor.py --host 0.0.0.0 --port 8000` en Windows o `python3 src/server/servidor.py --host 0.0.0.0 --port 8000` en macOS o Linux. Abre `http://IP_DEL_EQUIPO:8000/` en ambos.
- **GitHub Pages:** publica la raíz del proyecto. Este modo usa el almacenamiento del navegador para la demo entre pestañas. La sincronización entre dispositivos usa el servidor Python.

El acceso consulta un directorio ficticio del repositorio, incluso sin servidor. Usa **202373045-2** (Daniela, con historial) o **202473018-K** (Octavio, sin historial), con la contraseña de demo **usm2026**. Los accesos rápidos completan e ingresan con esas cuentas. Usa solamente estas credenciales ficticias. Cada pestaña conserva su sesión al recargar. Un enlace como `?origen=p4` precarga el piso 4 del Edificio P al elegir **Necesito ayuda**.

## Cómo se recomiendan las rutas

El motor describe el campus como un **multigrafo de corredores precargados**. Los lugares de `src/js/rutas.mjs` son nodos con coordenadas y, cuando corresponde, pisos. Cada alternativa registrada es una conexión bidireccional que agrupa un corredor conocido y sus indicaciones. Entre el Edificio P y el C hay conexiones paralelas por el túnel o por Entrada Placeres, con variantes de escalera y ascensor. La geometría dibujada en Leaflet es aproximada.

El motor consulta las conexiones registradas entre el origen y destino, y ajusta el cambio de nivel al piso elegido. Si la combinación de puntos o pisos carece de un recorrido registrado, ofrece solicitar ayuda. El catálogo de la demo no encadena corredores para inventar recorridos.

Para cada alternativa se calcula un semáforo y un peso:

| Factor | Efecto |
| --- | --- |
| Tiempo aproximado | Un punto por minuto estimado |
| Escaleras | Un punto por cada bloque de hasta 16 escalones |
| Precauciones por condiciones o necesidades del viaje | Dos puntos por cada advertencia que coincide con el recorrido |
| Incidencia activa en la ruta | Tres puntos por aviso pertinente y su descripción en la tarjeta |
| Paso incompatible o acceso indispensable bloqueado | Ruta roja, excluida de las recomendaciones |

Primero se prefieren las rutas verdes, después las amarillas. Entre rutas del mismo estado se recomienda la de menor peso. Por ejemplo, un aviso de ascensor P fuera de servicio bloquea las variantes que lo necesitan para cambiar de piso. Un aviso personalizado sobre ruido en Entrada Placeres agrega una advertencia al corredor que pasa por ese lugar.

## Apoyos para el recorrido

En **Necesito ayuda**, los filtros se eligen para cada viaje. Además de las necesidades físicas y el clima, hay apoyos opcionales para personas con TEA, TDAH u otras neurodivergencias:

- **Menos estímulos:** penaliza los cruces vehiculares identificados.
- **Recorrido predecible:** penaliza cruces y recorridos con varios cambios de dirección.
- **Orientación clara:** advierte sobre tramos identificados con poca luz.

El usuario elige lo que le sirve ese día. La aplicación guarda esas selecciones en la solicitud del viaje si se pide ayuda. El perfil conserva solo los datos de la sesión y las estadísticas de acompañamiento.

## Reportes y asistencia en vivo

1. En la primera pestaña, entra a **Necesito ayuda**. Selecciona **Sin escaleras**, calcula del piso 4 del Edificio P al Edificio C y deja el resultado abierto.
2. En la otra, entra a **Quiero ayudar** y pulsa **Reportar**, junto a **Ranking**. Activa **Ascensor Edificio P fuera de servicio**. En ambas secciones también puedes publicar avisos sobre ruido, iluminación, obstáculos u otras condiciones con un lugar y una descripción.
3. En la primera pestaña verás la alerta y la ruta de ascensor en rojo. Desde **Reportar → Mostrar solo mis avisos → Retirar mi aviso**, el autor puede retirar su reporte y la ruta se recalcula.
4. Para probar el acompañamiento, solicita ayuda en la primera pestaña. En la segunda, acepta y finaliza. El estudiante confirma la llegada y califica con estrellas. Los puntos, el historial y el ranking se actualizan con esa asistencia.

Las pestañas comparten cambios mediante `BroadcastChannel` y `localStorage` en modo local. Con el servidor también se consulta la API REST cada 1,5 segundos mientras la vista está visible. El servidor guarda los datos en `asistencia-datos.json`, configurable con `--datos`.

## Duración de los reportes

La duración por categoría y el incremento para renovar se configuran en `src/data/report-ttl.json`. En **Reportar**, elige una categoría y conserva la duración inicial o escribe minutos. Los avisos vigentes muestran un marcador, el autor y el tiempo restante. Puedes usar **+15 min**, **Editar tiempo** o retirar el aviso. Al vencer, desaparecen el marcador y la alerta, y las rutas abiertas se recalculan automáticamente.

## Estructura

- `index.html` es la entrada web.
- `src/js/` contiene los módulos de interfaz, rutas, cuenta y sincronización.
- `src/styles/` contiene el CSS, `src/assets/` el logo y `src/data/` los datos de referencia del campus.
- `src/server/servidor.py` sirve la API y el frontend, sin dependencias externas.
