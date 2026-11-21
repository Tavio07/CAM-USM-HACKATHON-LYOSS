# CAM USM

Prototipo de movilidad y acompañamiento en la UTFSM Casa Central, Valparaíso. La app muestra rutas aproximadas, permite compartir incidencias del campus y conecta a quien necesita apoyo con una persona que puede acompañarla.

## Equipo

- Octavio Pereira Navarro
- Maximilaino Martinez
- Dary Andaur

## Problema y relación con el desafío

En la UTFSM Casa Central, una escalera, un ascensor detenido o un acceso resbaloso pueden impedir que un estudiante complete un recorrido habitual. La dificultad concreta es saber, antes de salir, qué alternativas se ajustan a las necesidades de ese viaje y dónde pedir ayuda si las opciones disponibles quedan bloqueadas.

## Solución propuesta

CAM USM compara corredores precargados del campus según las necesidades y condiciones seleccionadas. Los reportes de la comunidad actualizan el mapa y la viabilidad de las rutas. Si hace falta acompañamiento, el estudiante puede compartir su punto de encuentro con un ayudante y confirmar la llegada al finalizar.

## Funcionalidades implementadas

- Acceso USM simulado y dos vistas para solicitar u ofrecer acompañamiento.
- Selección de origen por mapa, lista o enlace QR, y comparación de rutas por semáforo y peso.
- Reportes de lugar, tipo y duración, con historial personal y actualización automática del mapa al retirar o expirar un aviso.
- Solicitud de asistencia, aceptación, doble confirmación de cierre y calificación con estrellas.
- Perfil, historial de ayudas y ranking comunitario.

## Tecnologías y dependencias

| Componente | Tecnología |
| --- | --- |
| Interfaz | HTML5, CSS y JavaScript con módulos ES, sin framework ni etapa de compilación. |
| Mapa | Leaflet 1.9.4 cargado desde el CDN unpkg y teselas de OpenStreetMap. |
| Servidor | Python 3 con la biblioteca estándar. Sirve la aplicación y expone una API REST para el login simulado, solicitudes e incidencias. |
| Sincronización | BroadcastChannel y localStorage entre pestañas. La API REST se consulta cada 1,5 segundos mientras la vista está visible en modo servidor. |
| Datos | JSON para el catálogo y la configuración de la demo, más un archivo JSON local para persistir el estado del servidor. |

## Recursos externos y atribuciones

- [Leaflet](https://leafletjs.com/) para el mapa y sus capas. La versión 1.9.4 se carga desde [unpkg](https://unpkg.com/leaflet@1.9.4/dist/leaflet.js).
- [OpenStreetMap y sus colaboradores](https://www.openstreetmap.org/copyright) para el mapa base.
- [Google Fonts](https://fonts.google.com/) para las fuentes Inter y Plus Jakarta Sans.
- [Fotografía de Casa Central de Alexxxos](https://commons.wikimedia.org/wiki/File:Central_Building,_Universidad_T%C3%A9cnica_Federico_Santa_Mar%C3%ADa,_Valpara%C3%ADso,_Chile.jpg), bajo [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

## Uso de herramientas de IA

Se utilizó **OpenAI Codex** durante el desarrollo. El asistente generó y refactorizó partes sustanciales del frontend, el motor de rutas y el servidor Python. También ayudó a integrar el mapa, la sincronización de solicitudes e incidencias, el historial y el ranking, a ejecutar pruebas de navegador y a redactar el README. El equipo proporcionó el contexto y los recorridos de Casa Central y definió los casos de uso del prototipo.

## Instalación, configuración y ejecución

### Requisitos

- Un navegador actualizado. El frontend usa HTML, CSS y módulos JavaScript.
- Conexión a Internet para cargar Leaflet, el mapa base de OpenStreetMap y los recursos visuales externos.
- Live Server para la demo estática o Python 3 para compartir datos entre dispositivos. El servidor usa la biblioteca estándar de Python.

Abre la aplicación mediante HTTP con una de las opciones siguientes. Los módulos y los archivos JSON se cargan desde el servidor web.

### Opción A · Live Server y dos pestañas

1. Abre la carpeta del repositorio en VS Code.
2. Sobre `index.html`, elige **Open with Live Server**.
3. Abre esa misma URL en dos pestañas independientes del mismo navegador. Conserva la misma dirección y puerto en ambas.
4. En la primera pestaña, ingresa como Octavio y elige **Necesito ayuda**. En la segunda, ingresa como Daniela y elige **Quiero ayudar**.
5. La barra de estado debe indicar **Modo local · Sincronización entre pestañas**.

### Opción B · Servidor Python y dos dispositivos

Ejecuta el comando desde la raíz del repositorio.

**Windows**

```powershell
py -3 src/server/servidor.py --host 0.0.0.0 --port 8000
```

**macOS o Linux**

```bash
python3 src/server/servidor.py --host 0.0.0.0 --port 8000
```

En el equipo donde se ejecuta el servidor, abre `http://127.0.0.1:8000/`. En cada teléfono de la misma red Wi-Fi, abre `http://IP_LOCAL_DEL_EQUIPO:8000/`, sustituyendo el marcador por la dirección del equipo anfitrión. En Windows puedes consultarla con `ipconfig`, en la línea **Dirección IPv4** del adaptador conectado. La barra de estado debe indicar **Conectado al servicio de asistencia** en ambos dispositivos.

El servidor guarda las solicitudes y reportes en `asistencia-datos.json`. Para preparar una ronda de prueba vacía sin tocar el historial anterior, inicia el servidor con un nombre de archivo nuevo:

```powershell
py -3 src/server/servidor.py --host 0.0.0.0 --port 8000 --datos demo-nueva.json
```

Los ejemplos precargados del directorio seguirán visibles. Detén el servidor con `Ctrl+C`.

### Opción C · GitHub Pages

Publica la raíz del repositorio, donde está `index.html`. Las rutas de los recursos son relativas y funcionan también bajo un subdirectorio. Esta modalidad permite probar el flujo entre pestañas del mismo navegador. Para compartir solicitudes y reportes entre dispositivos, usa el servidor Python.

### Credenciales ficticias

| Cuenta | ROL USM | Contraseña de demo | Uso sugerido |
| --- | --- | --- | --- |
| Octavio Pereira | `202473018-K` | `usm2026` | Estudiante que solicita ayuda |
| Daniela Soto | `202373045-2` | `usm2026` | Ayudante con historial de ejemplo |

También puedes usar **Accesos de demostración** en el login. Cada pestaña conserva su propia sesión al recargar. Desde ese mismo entorno, agrega `?origen=p4` a la URL para precargar el **Edificio P, piso 4** al elegir **Necesito ayuda**. Ejemplo con el servidor Python:

```text
http://127.0.0.1:8000/?origen=p4
```


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

## Ejemplos reproducibles

### 1. Comparar las cuatro rutas del Edificio C a la Biblioteca

1. En **Necesito ayuda**, elige **Edificio C**, piso **1**, como origen y **Biblioteca · Edificio U**, piso **1**, como destino.
2. Pulsa **Generar solicitud / Ver rutas**. Usa **1**, **2**, **3**, **4** o **Todas** para mostrar las alternativas en el mapa.
3. Marca **Sin escaleras** y vuelve a calcular. Las tres variantes con escalones quedan rojas. La opción por **Entrada Placeres y CIAC** queda amarilla porque falta confirmar en terreno la continuidad sin peldaños.

**Resultado esperado:** los botones cambian las capas del mapa y las tarjetas siguen disponibles debajo. Los reportes en el mapa de resultados se limitan a los que afectan a las rutas mostradas.

### 2. Ver cómo un reporte cambia la ruta del piso 4 del P al C

1. En la pestaña del estudiante, elige **Edificio P, piso 4**, y **Edificio C, piso 1**. Marca **Sin escaleras** y deja el resultado abierto. Para reproducir los números del ejemplo, parte sin avisos previos que afecten el trayecto.
2. Si quieres comprobar el peso, marca **Lluvia** y recalcula. La variante **Ascensor y Entrada Placeres** pasa de **4 a 6 puntos**.
3. En la pestaña del ayudante, pulsa **Reportar**. Elige **Entrada Placeres → Piso resbaloso** y publica. Con lluvia, la variante pasa a **9 puntos**. La tarjeta muestra el motivo y el mapa un marcador pertinente.
4. Publica otro aviso en **Edificio P → Infraestructura · Ascensor detenido**. La variante que depende de ese ascensor queda roja, sin peso comparable.
5. En la cuenta que publicó cada aviso, abre **Mis reportes → Sacar reporte**. Retira primero el aviso de ascensor y luego el de piso resbaloso. La alternativa recupera la viabilidad y el peso que corresponda a los filtros y avisos restantes.

**Resultado esperado:** el estudiante ve los cambios sin volver a calcular manualmente. En la vista pública aparece el lugar, el tipo y el tiempo restante del reporte.

### 3. Solicitar acompañamiento, cerrar la asistencia y calificar

1. Con un trayecto calculado, en la pestaña del estudiante pulsa **Solicitar Ayudante de Turno**.
2. En la pestaña del ayudante, pulsa **Aceptar** en el aviso entrante. La vista del estudiante muestra quién aceptó y el punto de encuentro.
3. En la pestaña del ayudante, pulsa **Finalizar asistencia**.
4. En la pestaña del estudiante, pulsa **Confirmar llegada**. Si quieres, marca una etiqueta o escribe un comentario antes de tocar las estrellas. Tocar una calificación la envía.
5. Abre **Ranking**, **Ver mi perfil** o **Historial de ayudas** desde la cuenta del ayudante.

**Resultado esperado:** si otorgas cinco estrellas, Daniela gana **5 puntos** y registra **una ayuda completada**. Los puntos se suman una vez, al calificar. El ranking ordena por ayudas completadas y desempata por evaluación promedio.

### 4. Comprobar la caducidad automática

1. Con una ruta abierta, publica desde otra pestaña un aviso en un lugar que la afecte. En **Tiempo aproximado del reporte**, escribe **1 minuto** y pulsa **Publicar reporte**.
2. Comprueba que el aviso aparezca en el navegador del estudiante y espera a que venza. Mantén visible la vista que quieres verificar.
3. Desde la cuenta que lo publicó, abre **Mis reportes** y busca la entrada.

**Resultado esperado:** el aviso desaparece de las alertas y del mapa, se recalcula la ruta y la entrada conserva el estado **Expirado**. Si quieres probar **+15 min** o **Editar tiempo**, hazlo con otro aviso para no prolongar este ejemplo.

### Cómo se sincroniza

En modo local, las pestañas comparten cambios mediante `BroadcastChannel` y `localStorage`. En modo servidor, el navegador consulta la API REST cada **1,5 segundos** mientras la vista está visible. Los reportes, asistencias y calificaciones del servidor persisten en el archivo configurado mediante `--datos`.

## Solución de problemas

| Situación | Qué revisar |
| --- | --- |
| El mapa base aparece vacío | Comprueba la conexión a Internet y que los recursos externos estén disponibles. |
| Las pestañas no comparten eventos | Usa el mismo navegador, dirección y puerto. En modo servidor, confirma el estado de conexión en ambas vistas. |
| Los teléfonos no se conectan | Confirma que estén en la misma red, que el comando use `--host 0.0.0.0` y que estén abriendo la IP local del equipo anfitrión. El puerto debe permitir conexiones entrantes. |
| No aparece ninguna ruta | Comprueba el origen, el destino y sus pisos. El catálogo cubre corredores precargados. Para una demo rápida usa C, piso 1, hacia Biblioteca, piso 1. |
| El peso no coincide con el ejemplo | Revisa los filtros activos y las incidencias previas. Ambos cambian el cálculo. |
| El ayudante no recibe la solicitud | Comprueba que cada pestaña use un ROL distinto y que la segunda esté en **Quiero ayudar**. En esa vista también puedes pulsar **Ver solicitudes pendientes**. |


## Duración de los reportes

La duración por categoría y el incremento para renovar se configuran en `src/data/report-ttl.json`. En **Reportar**, elige el lugar, el tipo y la duración. Los valores iniciales son 20 min para aglomeración, 90 min para piso resbaloso, 240 min para infraestructura general o construcción y 720 min para ascensor detenido. Los avisos públicos muestran lugar, tipo y tiempo restante. Los marcadores del mapa de resultados se filtran según las rutas visibles. Desde **Mis reportes** puedes usar **+15 min**, **Editar tiempo** o **Sacar reporte**. Al vencer, desaparecen el marcador y la alerta, y las rutas abiertas se recalculan automáticamente.

## Estructura

- `index.html` es la entrada web.
- `src/js/` contiene los módulos de interfaz, rutas, cuenta y sincronización.
- `src/styles/` contiene el CSS, `src/assets/` el logo y `src/data/` los datos de referencia del campus.
- `src/server/servidor.py` sirve la API y el frontend, sin dependencias externas.


## Licencia

El código original de CAM USM se distribuye bajo la [licencia MIT](LICENSE). Los recursos de terceros conservan sus licencias y atribuciones. La fotografía de Casa Central es de [Alexxxos](https://commons.wikimedia.org/wiki/File:Central_Building,_Universidad_T%C3%A9cnica_Federico_Santa_Mar%C3%ADa,_Valpara%C3%ADso,_Chile.jpg) y se usa bajo [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). La licencia MIT del código no concede derechos sobre los nombres, logotipos ni marcas de terceros.
