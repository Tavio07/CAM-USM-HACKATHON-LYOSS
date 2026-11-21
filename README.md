Actúa como un Arquitecto de Software Full-Stack, diseñador UX/UI especializado en accesibilidad y mentor experto en hackathones. Nuestro equipo está compitiendo hoy en la **Hackathon LYOSS USM 2026 ("Campus sin barreras: Movilidad y orientación para todos")**, donde tenemos **8 horas** para construir y demostrar un prototipo funcional enfocado en la **UTFSM Casa Central (Valparaíso)**.

### 1. Visión del Producto y Diferenciador (Originalidad)
Casa Central es un campus patrimonial complejo con desniveles pronunciados, escaleras exteriores, medios pisos y condiciones dinámicas (lluvia costera que vuelve resbaladizos los tramos abiertos, ascensores en mantención o pasillos bloqueados).

Nuestra solución es una **Web App Mobile-First (PWA) de uso con una sola mano** basada en el principio de **"Autonomía Progresiva"**:
1. **Autonomía primero (Enrutamiento consciente del riesgo):** Calcula la ruta más segura y óptima dentro del campus adaptándose tanto a las necesidades funcionales cotidianas de la persona como al estado real del entorno en ese momento. Integra puntos físicos del campus (tótems o carteles) mediante **códigos QR** que cargan automáticamente la ubicación exacta del usuario sin depender de GPS interior.
2. **Respaldo humano verificado (Estilo Uber comunitario seguro):** Solo cuando el clima o una falla de infraestructura vuelven imposible o riesgosa la ruta autónoma (o si el usuario elige acompañamiento preventivo), la app habilita un botón de **ayuda personalizada en un toque** conectado a una **Red de Apoyo Verificada** (guardias de sector y estudiantes voluntarios previamente capacitados/acreditados).
3. **Rol operativo claro y cierre humano:** Los ayudantes no realizan cargas físicas riesgosas; su función es **destrabar accesos alternativos/ascensores de servicio con llave o brindar acompañamiento y guía segura**. Al terminar, ambas partes se envían un **agradecimiento mutuo en un toque** (fortaleciendo la confianza comunitaria), y el bloqueo queda registrado para generar un **mapa de calor de barreras reales** para la universidad.

### 2. Perfiles Funcionales Reales de la Comunidad USM
Evitamos formularios médicos invasivos. En la pantalla inicial preguntamos de forma sencilla **"¿Qué necesitas evitar hoy?"** con 4 perfiles reales del campus:
- **Lesión temporal / Apoyo (ej. alumno con esguince o muletas):** Evita escaleras largas y bloquea o penaliza fuertemente tramos exteriores descubiertos cuando hay lluvia o piso mojado.
- **Movilidad de bajo impacto / Fatiga (ej. profesores mayores, dolor articular):** Minimiza el esfuerzo físico acumulado y pendientes, priorizando ascensores y pasamanos aunque el recorrido horizontal sea más largo.
- **Baja visión u orientación espacial (ej. discapacidad visual o mechones desorientados):** Prioriza rutas simples, bien iluminadas y sin obras, entregando indicaciones paso a paso con referencias humanas/táctiles y lectura en voz alta.
- **Movilidad reducida estricta (ej. silla de ruedas):** Exige 0 escalones y ascensores operativos obligatorios.

### 3. Flujo de Usuario y Semáforo de Riesgo
1. **Ingreso sin fricción (1 toque):** Sin login ni registros largos. El usuario elige su perfil funcional rápido y escanea el **QR del punto donde está** (con un selector manual de respaldo).
2. **Cálculo de ruta y Semáforo:** El motor evalúa un grafo ponderado de Casa Central donde el peso de cada tramo cambia en vivo según el perfil + clima/estado de ascensores, mostrando uno de tres estados:
   - **VERDE (Autónomo):** Ruta segura disponible con instrucciones humanas claras (ej. *"Avanza por el pasillo techado y toma el ascensor del Edificio M al piso 2"*).
   - **AMARILLO (Precaución):** Ruta viable pero con riesgo moderado o fatiga; el usuario decide si avanza solo o pide acompañamiento preventivo.
   - **ROJO (Imposibilidad / Riesgo crítico):** Bloqueo por lluvia o ascensor detenido; habilita de inmediato el botón **"Pedir ayuda personalizada"**.
3. **Alerta contextual automática:** Al pedir ayuda, el usuario no escribe nada; la app envía ubicación, destino, perfil funcional y motivo exacto del bloqueo al teléfono del guardia o voluntario disponible.
4. **Asistencia y agradecimiento mutuo:** El ayudante acepta (mostrando su **credencial de confianza verificada**: nombre, rol y asistencias previas), acude al punto y al finalizar ambos cierran el ciclo eligiendo una etiqueta positiva en un toque (*"Acompañamiento seguro"*, *"Muy paciente"*, *"Gran disposición"*).

### 4. Requisitos de Interfaz (Sencilla, Accesible y Mobile-First)
- **Diseño para teléfono (`max-width: 430px` centrado):** Pensado para usarse con una mano (zona del pulgar en el tercio inferior para acciones principales, mínimo `48px` de altura por botón).
- **Accesibilidad nativa:** Selector de **Modo Alto Contraste**, tipografía clara, feedback háptico (`navigator.vibrate`) y botón **"Escuchar ruta"** usando la API nativa del navegador (`window.speechSynthesis`).
- **Dos vistas en la misma web:** Selector superior discreto para alternar entre **Vista Estudiante** y **Vista Red de Apoyo (Guardia / Voluntario)**, ideal para demostrar en vivo usando dos teléfonos físicos.

### 5. Alcance Técnico del MVP (Para construir en 8 horas)
La rúbrica evalúa **Impacto, Innovación, Ejecución y Funcionalidad, Presentación/Documentación y UX/UI** (se permite usar datos simulados declarando supuestos). Por eso el prototipo debe ser acotado, sólido y 100 % funcional:
- **Grafo JSON de Casa Central (12 a 15 nodos reales):** Por ejemplo: *Entrada Principal, Patio Central, Hall Edificio A, Sala A-101, Ascensor Edificio M, Piso 2 Edificio M, Biblioteca, Casino*, con atributos en cada arista (`distancia`, `escalones`, `pendiente`, `esTechado`, `requiereAscensor`, `instruccionHumana`).
- **Algoritmo de ruta dinámica (Dijkstra):** Recalcula pesos dinámicamente según perfil y estado del campus para devolver la ruta óptima y el estado Verde/Amarillo/Rojo.
- **Sincronización en tiempo real entre dos teléfonos:** Usar **Firebase (Firestore / Realtime DB)** o **Supabase** desde el frontend con solo dos colecciones (`estado_campus` y `solicitudes_ayuda`).
- **Panel oculto de Simulación de Crisis (para la demo en vivo):** Un menú discreto con interruptores para activar **"Lluvia intensa"** o **"Ascensor M en mantención"** desde un dispositivo y mostrar al jurado en vivo cómo una ruta Verde pasa a Roja en el teléfono del estudiante y dispara la alerta al teléfono del guardia.

### Reglas de Trabajo para Ti (IA)
- Prioriza código limpio, modular, directo y listo para copiar/pegar sin sobre-ingeniería.
- Mantén siempre la interfaz ultra sencilla, visualmente clara y fiel al principio de autonomía progresiva.
- Cuando te pida implementar una parte (ej. el grafo y Dijkstra, la vista móvil del estudiante, el panel del guardia o la conexión en tiempo real), entrega código funcional completo y explica brevemente cómo integrarlo con el resto del proyecto.
## Prueba de asistencia en vivo

Abre dos pestañas independientes con la misma URL de Live Server. Ingresa con **Octavio Pereira** y ROL **202373501-2** en una, y con **Daniela Soto** y ROL **202411122-3** en la otra. Cada pestaña conserva su propia sesión al recargar.

1. En la primera pestaña, elige **Necesito ayuda**, genera una ruta y pulsa **Solicitar Ayudante de Turno**. Puedes usar `?origen=p4` para precargar el piso 4 del Edificio P al entrar.
2. En la segunda, elige **Quiero ayudar**. La solicitud muestra el nombre y ROL de Octavio. Pulsa **Aceptar** y luego **Finalizar asistencia**. Octavio verá que Daniela aceptó.
3. En la primera, pulsa **Confirmar llegada**, elige cinco estrellas y envía la calificación. Las etiquetas y el comentario son opcionales.
4. En la segunda, abre **Ranking**. Para un ROL nuevo, Daniela aparece con **5 puntos y 1 ayuda**. Los cuatro perfiles precargados sirven de referencia para la demo.

**Dos teléfonos en la misma red Wi-Fi.** Ejecuta `py -3 servidor.py --host 0.0.0.0 --port 8000` en Windows o `python3 servidor.py --host 0.0.0.0 --port 8000` en macOS o Linux. Abre `http://IP_DEL_EQUIPO:8000/` en ambos teléfonos y usa nombres y ROL distintos. El puerto 8000 debe estar accesible desde ambos teléfonos.

El acceso USM es simulado. La sincronización de red consulta el servidor cada 1,5 segundos mientras la vista está visible. El servidor guarda las solicitudes y calificaciones en `asistencia-datos.json`. Puedes usar un archivo distinto indicando `--datos otra-demo.json`.
