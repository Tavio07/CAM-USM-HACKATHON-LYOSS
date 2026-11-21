import { usuarioPorRol, autenticar, accesosDemo } from './directorio.mjs';
import { CENTRO_CAMPUS, LIMITACIONES, LUGARES, ORIGENES_QR, buscarRutas } from './rutas.mjs';
import { prepararCuenta } from './cuenta.mjs';
import { prepararIncidencias } from './incidencias.mjs';
import { iniciarAsistencia, suscribirAsistencia, listarSolicitudes, prepararSolicitud, crearSolicitud, cambiarSolicitud, claveAyudante, ETIQUETAS_CALIFICACION, listarIncidencias, suscribirIncidencias, sincronizarExpiracionReportes } from './solicitudes.mjs';

const el = id => document.getElementById(id);
const lugares = new Map(LUGARES.map(lugar => [lugar.id, lugar]));
const nombresLimitaciones = new Map(Object.values(LIMITACIONES).flat());
const estados = {
  VERDE: { color: '#198754', texto: 'Verde · Viable' },
  AMARILLO: { color: '#A15A00', texto: 'Amarillo · Precaución' },
  ROJO: { color: '#C92A2A', texto: 'Rojo · Bloqueada' },
};
const leaflet = window.L;
const mapasCampus = new Map();
let mapaRutas;
let capasRutas;
let viaje;
let rutaElegida;
let borrador;
let enviando = false;
let respondiendo = false;
let listo = false;
const CLAVE_SESION = 'cae-sesion-usm';
let sesion = leerSesion();
let solicitudId = sesion ? sessionStorage.getItem(claveSolicitud()) : null;
let qrAplicado = false;

function leerSesion() {
  try {
    const valor = JSON.parse(sessionStorage.getItem(CLAVE_SESION));
    const usuario = usuarioPorRol(valor?.rol);
    return usuario ? { ...usuario, modo: ['estudiante', 'ayudante'].includes(valor.modo) ? valor.modo : null } : null;
  } catch {
    return null;
  }
}

function guardarSesion() {
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ rol: sesion.rol, modo: sesion.modo }));
}

function identidad() {
  return { nombre: sesion.nombre, rolUsm: sesion.rolUsm };
}

function propioAyudante(ayudante) {
  if (!sesion || !ayudante) return false;
  return ayudante.rolUsm ? ayudante.rolUsm === sesion.rolUsm
    : claveAyudante(ayudante.nombre) === claveAyudante(sesion.nombre);
}

function claveSolicitud() {
  return 'cae-solicitud-activa:' + sesion.rolUsm;
}
let mapaAyudante;
let capaAyudante;
let idDibujado;
let asistenciaEnVista;

for (const [grupo, opciones] of Object.entries(LIMITACIONES)) {
  for (const [id, nombre] of opciones) {
    const etiqueta = document.createElement('label');
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.name = 'limitaciones';
    casilla.value = id;
    etiqueta.append(casilla, nombre);
    el(grupo).append(etiqueta);
  }
}

function crearMapa(id) {
  if (!leaflet) {
    el(id).textContent = 'Mapa no disponible. Las listas y las indicaciones siguen disponibles.';
    return null;
  }
  const mapa = leaflet.map(id, { scrollWheelZoom: false }).setView(CENTRO_CAMPUS, 17);
  const tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  const aviso = document.createElement('span');
  aviso.className = 'aviso-mapa';
  aviso.hidden = true;
  aviso.textContent = 'Mapa base temporalmente no disponible';
  el(id).append(aviso);
  tiles.on('tileerror', () => { aviso.hidden = false; });
  tiles.on('tileload', () => { aviso.hidden = true; });
  mapasCampus.set(id, mapa);
  return mapa;
}

function prepararSelector(tipo) {
  const lista = el(tipo);
  const piso = el('piso-' + tipo);
  const grupoPiso = el('grupo-piso-' + tipo);
  const mapa = crearMapa('mapa-' + tipo);
  const marcadores = new Map();

  function seleccionar(id, pisoQr) {
    const lugar = lugares.get(id);
    lista.value = lugar?.id ?? '';
    piso.replaceChildren();
    grupoPiso.hidden = !lugar?.pisos;
    piso.disabled = grupoPiso.hidden;
    for (const numero of lugar?.pisos ?? []) piso.add(new Option('Piso ' + numero, numero));
    if (lugar?.pisos) piso.value = lugar.pisos.includes(pisoQr) ? pisoQr : 1;
    for (const [clave, marcador] of marcadores) {
      const activo = clave === id;
      marcador.getElement()?.classList.toggle('marcador-activo', activo);
      if (activo) {
        marcador.openTooltip();
        mapa.panTo(marcador.getLatLng());
      } else marcador.closeTooltip();
    }
  }

  for (const lugar of LUGARES) {
    lista.add(new Option(lugar.nombre, lugar.id));
    if (!mapa) continue;
    const marcador = leaflet.marker([lugar.lat, lugar.lng], {
      title: lugar.nombre,
      alt: lugar.nombre,
    }).addTo(mapa).bindTooltip(lugar.nombre);
    marcador.on('click', () => {
      seleccionar(lugar.id, lista.value === lugar.id ? Number(piso.value) : undefined);
      invalidarResultados();
    });
    marcadores.set(lugar.id, marcador);
  }
  lista.addEventListener('change', () => seleccionar(lista.value));
  return {
    seleccionar,
    encuadrar() {
      if (!mapa) return;
      mapa.invalidateSize();
      mapa.fitBounds(LUGARES.map(({ lat, lng }) => [lat, lng]), {
        padding: [24, 28], maxZoom: 17, animate: false,
      });
    },
  };
}

const selectorOrigen = prepararSelector('origen');
const selectorDestino = prepararSelector('destino');
const idQr = new URLSearchParams(location.search).get('origen');

function aplicarOrigenQr() {
  if (qrAplicado || !idQr) return;
  qrAplicado = true;
  const alias = Object.hasOwn(ORIGENES_QR, idQr) ? ORIGENES_QR[idQr] : [idQr];
  if (lugares.has(alias[0])) selectorOrigen.seleccionar(...alias);
  else el('aviso-origen').textContent = 'El enlace indica un punto desconocido. Puedes seleccionar tu origen.';
}

function invalidarResultados() {
  viaje = undefined;
  borrador = undefined;
  el('resultados').hidden = true;
}

function leerPunto(tipo) {
  const lugar = lugares.get(el(tipo).value);
  return {
    id: lugar.id,
    nombre: lugar.nombre,
    piso: lugar.pisos ? Number(el('piso-' + tipo).value) : null,
    referencia: el('referencia-' + tipo).value.trim(),
  };
}

function mostrarMapa(opciones, origen, destino, seleccion) {
  mapaRutas ??= crearMapa('mapa-rutas');
  if (!mapaRutas) return;
  mapaRutas.invalidateSize();
  reportes.renderizarMarcadores();
  capasRutas ??= leaflet.layerGroup().addTo(mapaRutas);
  capasRutas.clearLayers();
  const coordenadas = [];
  const orden = [...opciones.filter(ruta => ruta.id !== seleccion), ...opciones.filter(ruta => ruta.id === seleccion)];
  for (const ruta of orden) {
    const activa = ruta.id === seleccion;
    const duplicada = opciones.some(otra => otra.id !== ruta.id && otra.trazado.every(
      (punto, indice) => punto === ruta.trazado[indice],
    ) && otra.trazado.length === ruta.trazado.length);
    const desfase = duplicada && ruta.variante === 'ascensor' ? .000032 : 0;
    const trazado = ruta.trazado.map(([lat, lng], indice) =>
      indice > 0 && indice < ruta.trazado.length - 1 ? [lat + desfase, lng] : [lat, lng],
    );
    coordenadas.push(...trazado);
    leaflet.polyline(trazado, {
      color: estados[ruta.estado].color,
      weight: activa ? 8 : 5,
      opacity: activa ? 1 : .75,
      dashArray: ruta.estado === 'ROJO' ? '7 7' : null,
    }).addTo(capasRutas).on('click', () => mostrarAlternativas(opciones, ruta.id));
  }
  for (const [punto, etiqueta] of [[origen, 'Origen'], [destino, 'Destino']]) {
    const lugar = lugares.get(punto.id);
    const coordenada = [lugar.lat, lugar.lng];
    coordenadas.push(coordenada);
    leaflet.marker(coordenada, { alt: etiqueta + ': ' + lugar.nombre })
      .addTo(capasRutas).bindTooltip(etiqueta + ': ' + lugar.nombre);
  }
  const bounds = leaflet.latLngBounds(coordenadas);
  if (!mapaRutas.getBounds().contains(bounds) || seleccion === opciones[0]?.id || !opciones.length) {
    mapaRutas.fitBounds(bounds, { padding: [24, 24], maxZoom: 18, animate: false });
  }
}

function mostrarAlternativas(opciones, seleccion) {
  rutaElegida = opciones.find(ruta => ruta.id === seleccion);
  if (!solicitudId) borrador = undefined;
  mostrarMapa(opciones, viaje.origen, viaje.destino, seleccion);
  const listado = el('alternativas');
  for (const tarjeta of listado.children) {
    const activa = tarjeta.dataset.ruta === seleccion;
    tarjeta.querySelector('button').setAttribute('aria-expanded', String(activa));
    tarjeta.querySelector('ol').hidden = !activa;
  }
}

function tarjetaRuta(ruta, recomendada, opciones) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'alternativa';
  tarjeta.dataset.ruta = ruta.id;
  tarjeta.dataset.estado = ruta.estado;
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.setAttribute('aria-controls', 'pasos-' + ruta.id);
  boton.textContent = ruta.titulo;
  const estado = document.createElement('p');
  estado.className = 'estado';
  estado.textContent = estados[ruta.estado].texto + ' · ' + ruta.minutos + ' min aprox. · ' + (ruta.peso === null ? 'Sin paso' : ruta.peso + ' puntos de dificultad') +
    (recomendada ? ' · Recomendada' : '');
  const etiquetas = document.createElement('ul');
  etiquetas.className = 'etiquetas';
  for (const texto of ruta.etiquetas) {
    const item = document.createElement('li');
    item.textContent = texto;
    etiquetas.append(item);
  }
  const detalle = document.createElement('ol');
  detalle.id = 'pasos-' + ruta.id;
  detalle.hidden = true;
  for (const paso of ruta.pasos) {
    const item = document.createElement('li');
    item.textContent = paso;
    detalle.append(item);
  }
  boton.addEventListener('click', () => mostrarAlternativas(opciones, ruta.id));
  tarjeta.append(boton, estado, etiquetas);
  if (ruta.motivo) {
    const aviso = document.createElement('p');
    aviso.textContent = ruta.motivo;
    tarjeta.append(aviso);
  }
  tarjeta.append(detalle);
  return tarjeta;
}

el('viaje').addEventListener('input', invalidarResultados);
el('viaje').addEventListener('submit', event => {
  event.preventDefault();
  const limitaciones = new FormData(el('viaje')).getAll('limitaciones');
  viaje = {
    origen: leerPunto('origen'), destino: leerPunto('destino'),
    limitaciones: limitaciones.filter(id => [...LIMITACIONES.fisicas, ...LIMITACIONES.neuro].some(([clave]) => clave === id)),
    entorno: limitaciones.filter(id => LIMITACIONES.entorno.some(([clave]) => clave === id)),
    comentarios: el('comentarios').value.trim(),
  };
  mostrarResultados();
  el('titulo-resultados').focus();
});

function mostrarResultados(seleccionAnterior) {
  if (!viaje) return;
  sincronizarExpiracionReportes();
  const opciones = buscarRutas(viaje.origen, viaje.destino, [...viaje.limitaciones, ...viaje.entorno], listarIncidencias());
  const recomendada = opciones.find(ruta => ruta.estado !== 'ROJO')?.id;
  const mismoPunto = viaje.origen.id === viaje.destino.id && viaje.origen.piso === viaje.destino.piso;
  el('aviso-rutas').textContent = recomendada ? '' : mismoPunto ? 'El origen y el destino coinciden.'
    : opciones.length ? 'Ninguna ruta es viable con las limitaciones e incidencias actuales.'
    : 'No hay un recorrido de demo para estos puntos o pisos.';
  const tarjetaConFoco = document.activeElement.closest('.alternativa')?.dataset.ruta;
  el('alternativas').replaceChildren(...opciones.map(ruta => tarjetaRuta(ruta, ruta.id === recomendada, opciones)));
  const previa = opciones.find(ruta => ruta.id === seleccionAnterior && ruta.estado !== 'ROJO');
  el('resultados').hidden = false;
  mostrarAlternativas(opciones, previa?.id ?? recomendada ?? opciones[0]?.id);
  if (tarjetaConFoco) {
    [...el('alternativas').children].find(tarjeta => tarjeta.dataset.ruta === tarjetaConFoco)
      ?.querySelector('button').focus({ preventScroll: true });
  }
}

function describirPunto(punto) {
  return [punto.nombre, punto.piso === null ? '' : 'Piso ' + punto.piso, punto.referencia].filter(Boolean).join(' · ');
}

const entrada = el('solicitud-entrante');
const cuenta = prepararCuenta(renderizarSolicitudes);
const reportes = prepararIncidencias(() => sesion, () => listo, mapasCampus);
reportes.alCerrar(renderizarSolicitudes);
const esAyudante = () => sesion?.modo === 'ayudante';
const esEstudiante = () => sesion?.modo === 'estudiante';
const enCurso = solicitud => ['pendiente', 'aceptada', 'pendiente_confirmacion'].includes(solicitud?.estado);
let idCalificando;

function resumir(id, solicitud) {
  const lista = el(id);
  const nombres = ids => ids.map(clave => nombresLimitaciones.get(clave) ?? clave).join(' · ') || 'Ninguna indicada';
  lista.replaceChildren();
  for (const [titulo, valor] of [
    ['Solicitante', solicitud.solicitante ? solicitud.solicitante.nombre + ' · ' + solicitud.solicitante.rolUsm : 'Solicitud anterior sin identificación'],
    ['Origen · Punto de encuentro', describirPunto(solicitud.origen)],
    ['Destino', describirPunto(solicitud.destino)],
    ['Limitaciones', nombres(solicitud.limitaciones)],
    ['Entorno y clima', nombres(solicitud.entorno)],
    ['Ruta seleccionada', solicitud.rutaSeleccionada ? solicitud.rutaSeleccionada.titulo + ' · ' +
      (estados[solicitud.rutaSeleccionada.estado]?.texto ?? solicitud.rutaSeleccionada.estado) : 'Por definir con el ayudante'],
    ['Comentarios extra', solicitud.comentarios || 'Sin comentarios'],
  ]) {
    const termino = document.createElement('dt');
    const contenido = document.createElement('dd');
    termino.textContent = titulo;
    contenido.textContent = valor;
    lista.append(termino, contenido);
  }
}

function dibujarAsistencia(solicitud) {
  if (idDibujado === solicitud.id) return;
  mapaAyudante ??= crearMapa('mapa-ayudante');
  if (!mapaAyudante) return;
  idDibujado = solicitud.id;
  mapaAyudante.invalidateSize();
  capaAyudante ??= leaflet.layerGroup().addTo(mapaAyudante);
  capaAyudante.clearLayers();
  reportes.renderizarMarcadores();
  const puntos = [];
  for (const [punto, etiqueta] of [[solicitud.origen, 'Encuentro'], [solicitud.destino, 'Destino']]) {
    const lugar = lugares.get(punto.id);
    if (!lugar) continue;
    const coordenada = [lugar.lat, lugar.lng];
    puntos.push(coordenada);
    leaflet.marker(coordenada, { alt: etiqueta + ': ' + lugar.nombre })
      .addTo(capaAyudante).bindTooltip(etiqueta + ': ' + lugar.nombre);
  }
  const ruta = buscarRutas(solicitud.origen, solicitud.destino, [...solicitud.limitaciones, ...solicitud.entorno])
    .find(opcion => opcion.id === solicitud.rutaSeleccionada?.id && opcion.estado !== 'ROJO');
  if (ruta) {
    leaflet.polyline(ruta.trazado, { color: estados[ruta.estado].color, weight: 6 }).addTo(capaAyudante);
    puntos.push(...ruta.trazado);
  }
  if (puntos.length) mapaAyudante.fitBounds(puntos, { padding: [24, 24], maxZoom: 18 });
}

function mostrarSolicitud(propia) {
  const tarjeta = el('estado-solicitud');
  tarjeta.hidden = !propia;
  el('solicitar').disabled = !listo || enviando || enCurso(propia);
  if (!propia) {
    el('titulo-solicitud').textContent = '';
    return;
  }
  const nombre = propia.ayudante?.nombre;
  const mensajes = {
    pendiente: 'Notificando al ayudante de turno... Esperando respuesta',
    aceptada: nombre + ' ha aceptado tu solicitud, espera un momento',
    pendiente_confirmacion: propia.llegadaConfirmada ? 'Llegada confirmada · Califica la asistencia'
      : nombre + ' marcó la asistencia como finalizada. ¿Confirmas que llegaste bien?',
    rechazada: propia.ultimaAccion === 'cancelar' ? 'Solicitud cancelada' : 'El ayudante no puede atender en este momento',
    completada: propia.calificacion ? 'Calificación enviada · Asistencia completada' : 'Asistencia completada',
  };
  const titulo = el('titulo-solicitud');
  if (titulo.textContent !== mensajes[propia.estado]) titulo.textContent = mensajes[propia.estado];
  if (tarjeta.dataset.id !== propia.id) {
    resumir('resumen', propia);
    el('error-cierre').textContent = '';
  }
  tarjeta.dataset.id = propia.id;
  tarjeta.dataset.estado = propia.estado;
  const pendiente = propia.estado === 'pendiente_confirmacion';
  const calificar = pendiente && propia.llegadaConfirmada;
  el('resumen').hidden = Boolean(calificar);
  el('confirmar-llegada').hidden = !pendiente || calificar;
  el('confirmar-llegada').disabled = enviando;
  el('calificacion').hidden = !calificar;
  for (const estrella of el('estrellas').children) estrella.disabled = enviando;
  if (calificar && idCalificando !== propia.id) {
    idCalificando = propia.id;
    el('calificacion').reset();

  }
  el('cancelar').hidden = propia.estado !== 'pendiente';
  el('cancelar').disabled = enviando;
  el('cerrar-estado').hidden = enCurso(propia);
}

function ultimaCalificacion(lista) {
  return lista.filter(solicitud => solicitud.estado === 'completada' && solicitud.calificacion &&
    propioAyudante(solicitud.ayudante))
    .reduce((ultima, solicitud) => !ultima ||
      Date.parse(solicitud.calificacion.creadaEn) >= Date.parse(ultima.calificacion.creadaEn) ? solicitud : ultima, null);
}

function renderizarSolicitudes() {
  const lista = listarSolicitudes();
  cuenta.actualizar(sesion, lista);
  if (esEstudiante()) {
    const propia = lista.find(solicitud => solicitud.id === solicitudId && solicitud.solicitante?.rolUsm === sesion.rolUsm);
    mostrarSolicitud(propia ?? (enviando ? borrador : undefined));
  }
  const ultima = esAyudante() ? ultimaCalificacion(lista) : null;
  const reciente = ultima && Date.now() - Date.parse(ultima.calificacion.creadaEn) < 120000;
  if (!esAyudante()) {
    if (entrada.open) entrada.close();
    delete entrada.dataset.id;
    return;
  }
  const aviso = el('aviso-puntos');
  const mensaje = reciente ? '¡Asistencia completada! Recibiste +' + ultima.calificacion.estrellas + ' puntos' : '';
  if (aviso.textContent !== mensaje) aviso.textContent = mensaje;
  aviso.hidden = !mensaje;
  const asistencias = lista.filter(solicitud => ['aceptada', 'pendiente_confirmacion'].includes(solicitud.estado) &&
    propioAyudante(solicitud.ayudante));
  const activa = asistencias.find(solicitud => solicitud.id === asistenciaEnVista) ?? asistencias.at(-1);
  const selector = el('asistencia-en-vista');
  el('selector-asistencia').hidden = asistencias.length < 2;
  selector.replaceChildren(...asistencias.map(solicitud => new Option(
    solicitud.origen.nombre + ' → ' + solicitud.destino.nombre + ' · ' +
      (solicitud.estado === 'aceptada' ? 'En curso' : 'Por confirmar o calificar'),
    solicitud.id,
  )));
  selector.value = activa?.id ?? '';
  const pendientes = lista.filter(solicitud => solicitud.estado === 'pendiente' && solicitud.solicitante?.rolUsm !== sesion.rolUsm);
  const nueva = pendientes[0];
  el('ver-pendientes').hidden = !nueva;
  el('ver-pendientes').textContent = 'Ver solicitudes pendientes (' + pendientes.length + ')';
  el('asistencia-activa').hidden = !activa;
  const estado = activa?.estado === 'pendiente_confirmacion'
    ? activa.llegadaConfirmada ? 'Llegada confirmada. Esperando calificación del estudiante...'
      : 'Esperando confirmación del estudiante...'
    : activa ? 'Asistencia en curso' : 'Esperando solicitudes de acompañamiento.';
  if (el('estado-ayudante').textContent !== estado) el('estado-ayudante').textContent = estado;
  if (activa && idDibujado !== activa.id) {
    resumir('resumen-activo', activa);
    dibujarAsistencia(activa);
  }
  el('finalizar').hidden = activa?.estado !== 'aceptada';
  el('finalizar').dataset.id = activa?.id ?? '';
  if (!nueva) {
    if (entrada.open) entrada.close();
    delete entrada.dataset.id;
    return;
  }
  if (!cuenta.abierta() && !reportes.abierta() && entrada.dataset.id !== nueva.id) {
    entrada.dataset.id = nueva.id;
    el('error-entrante').textContent = '';
    resumir('resumen-entrante', nueva);
    if (!entrada.open) entrada.showModal();
  }
}

function cambiarVista() {
  reportes.renderizar();
  el('inicio-sesion').hidden = Boolean(sesion);

  el('elegir-seccion').hidden = !sesion || Boolean(sesion.modo);
  el('vista-estudiante').hidden = !esEstudiante();
  el('vista-ayudante').hidden = !esAyudante();

  el('conexion').hidden = !sesion?.modo;
  el('error-asistencia').hidden = !sesion?.modo;
  if (sesion) {

    el('saludo').textContent = 'Hola, ' + sesion.primerNombre;
    el('carrera-sesion').textContent = sesion.carrera;
  }
  idDibujado = undefined;
  if (esEstudiante()) {
    selectorOrigen.encuadrar();
    selectorDestino.encuadrar();
    aplicarOrigenQr();
    if (mapaRutas && !el('resultados').hidden) mostrarResultados(rutaElegida?.id);
  }
  renderizarSolicitudes();
}

el('login').addEventListener('submit', async event => {
  event.preventDefault();
  const boton = el('ingresar');
  if (boton.disabled) return;
  const rol = el('login-rol').value.replace(/\s/g, '').toUpperCase();
  const password = el('login-password').value;
  el('error-login').textContent = '';
  boton.disabled = true;
  try {
    let usuario;
    if (document.querySelector('meta[name="cae-api"]')) {
      const respuesta = await fetch('./api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rol, password }),
      });
      if (respuesta.status === 401) usuario = null;
      else if (!respuesta.ok) throw new Error('El servicio de inicio de sesión no está disponible.');
      else usuario = await respuesta.json();
    } else usuario = autenticar(rol, password);
    if (!usuario) {
      el('error-login').textContent = 'El ROL USM o la contraseña no coinciden.';
      return;
    }
    sesion = { ...usuario, modo: null };
    solicitudId = sessionStorage.getItem(claveSolicitud());
    guardarSesion();
    el('login').reset();
    ocultarClave();
    cambiarVista();
    el('saludo').focus();
  } catch {
    el('error-login').textContent = 'No se pudo iniciar sesión. Intenta de nuevo.';
  } finally {
    boton.disabled = false;
  }
});

function ocultarClave() {
  el('login-password').type = 'password';
  el('ver-clave').textContent = 'Mostrar';
  el('ver-clave').setAttribute('aria-pressed', 'false');
}

el('ver-clave').addEventListener('click', () => {
  if (el('login-password').type === 'text') ocultarClave();
  else {
    el('login-password').type = 'text';
    el('ver-clave').textContent = 'Ocultar';
    el('ver-clave').setAttribute('aria-pressed', 'true');
  }
});

el('login').addEventListener('input', () => { el('error-login').textContent = ''; });
for (const acceso of accesosDemo) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = acceso.nombreCompleto + ' · ' + acceso.rol;
  boton.addEventListener('click', () => {
    el('login-rol').value = acceso.rol;
    el('login-password').value = acceso.password;
    el('login').requestSubmit();
  });
  el('accesos-demo').append(boton);
}

function elegirSeccion(modo) {
  if (!sesion) return;
  sesion.modo = modo;
  guardarSesion();
  cambiarVista();
  const titulo = el(modo === 'estudiante' ? 'titulo-filtros' : 'titulo-ayudante');
  if (!entrada.open) titulo.focus();
}

el('necesito-ayuda').addEventListener('click', () => elegirSeccion('estudiante'));
el('quiero-ayudar').addEventListener('click', () => elegirSeccion('ayudante'));
el('cambiar-seccion').addEventListener('click', () => {
  sesion.modo = null;
  guardarSesion();
  cambiarVista();
  el('saludo').focus();
});
el('cerrar-sesion').addEventListener('click', () => {
  sessionStorage.removeItem(CLAVE_SESION);
  sesion = null;
  solicitudId = undefined;
  asistenciaEnVista = undefined;
  idCalificando = undefined;
  qrAplicado = false;
  el('login').reset();
  el('viaje').reset();
  el('calificacion').reset();
  selectorOrigen.seleccionar('');
  selectorDestino.seleccionar('');
  el('aviso-origen').textContent = '';
  el('viaje').dispatchEvent(new Event('input'));
  el('titulo-solicitud').textContent = '';
  el('error-asistencia').textContent = '';
  cambiarVista();
  el('titulo-login').focus();
});
async function ejecutar(operacion, errorId = 'error-asistencia') {
  el(errorId).textContent = '';
  try {
    await operacion();
    return true;
  } catch (error) {
    el(errorId).textContent = error.message || 'No se pudo completar la acción. Intenta de nuevo.';
    return false;
  }
}

el('solicitar').addEventListener('click', async () => {
  if (!esEstudiante() || !viaje || enviando || !listo) return;
  const propia = listarSolicitudes().find(solicitud => solicitud.id === solicitudId);
  if (enCurso(propia)) return;
  if (propia) borrador = undefined;
  borrador ??= prepararSolicitud({ ...viaje, solicitante: identidad(), rutaSeleccionada: rutaElegida ? {
    id: rutaElegida.id, titulo: rutaElegida.titulo, estado: rutaElegida.estado,
  } : null });
  solicitudId = borrador.id;
  sessionStorage.setItem(claveSolicitud(), solicitudId);
  enviando = true;
  renderizarSolicitudes();
  const enviado = await ejecutar(() => crearSolicitud(borrador));
  enviando = false;
  renderizarSolicitudes();
  if (enviado && esEstudiante()) el('titulo-solicitud').focus();
});

el('cancelar').addEventListener('click', async () => {
  if (!esEstudiante() || enviando) return;
  enviando = true;
  renderizarSolicitudes();
  await ejecutar(() => cambiarSolicitud(solicitudId, 'cancelar', { actor: identidad() }));
  enviando = false;
  renderizarSolicitudes();
});

el('cerrar-estado').addEventListener('click', () => {
  if (!esEstudiante()) return;
  solicitudId = undefined;
  borrador = undefined;
  sessionStorage.removeItem(claveSolicitud());
  renderizarSolicitudes();
  const destino = el('resultados').hidden ? el('origen') : el('solicitar');
  destino.focus();
});

async function responder(accion, id, errorId) {
  if (!esAyudante() || !id || respondiendo) return;
  respondiendo = true;
  for (const boton of ['aceptar', 'rechazar', 'finalizar']) el(boton).disabled = true;
  renderizarSolicitudes();
  const guardado = await ejecutar(() => cambiarSolicitud(id, accion, { actor: identidad() }), errorId);
  if (guardado && accion === 'aceptar') asistenciaEnVista = id;
  respondiendo = false;
  for (const boton of ['aceptar', 'rechazar', 'finalizar']) el(boton).disabled = false;
  renderizarSolicitudes();
}

el('ver-pendientes').addEventListener('click', () => {
  if (entrada.dataset.id && !entrada.open) entrada.showModal();
});
el('asistencia-en-vista').addEventListener('change', event => {
  asistenciaEnVista = event.target.value;
  renderizarSolicitudes();
});

el('aceptar').addEventListener('click', () => responder('aceptar', entrada.dataset.id, 'error-entrante'));
el('rechazar').addEventListener('click', () => responder('rechazar', entrada.dataset.id, 'error-entrante'));
el('finalizar').addEventListener('click', () => responder('finalizar', el('finalizar').dataset.id, 'error-asistencia'));

for (let puntos = 1; puntos <= 5; puntos++) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.value = puntos;
  boton.textContent = '★'.repeat(puntos);
  boton.setAttribute('aria-label', 'Enviar ' + puntos + (puntos === 1 ? ' estrella' : ' estrellas'));
  boton.addEventListener('click', async () => {
    const datos = new FormData(el('calificacion'));
    if (await cerrarComoEstudiante('calificar', {
      estrellas: puntos,
      etiquetas: datos.getAll('etiquetas'),
      comentario: String(datos.get('comentario') ?? '').trim(),
    })) el('titulo-solicitud').focus();
  });
  el('estrellas').append(boton);
}

for (const etiqueta of ETIQUETAS_CALIFICACION) {
  const fila = document.createElement('label');
  const control = document.createElement('input');
  control.type = 'checkbox';
  control.name = 'etiquetas';
  control.value = etiqueta;
  fila.append(control, etiqueta);
  el('etiquetas-calificacion').append(fila);
}

async function cerrarComoEstudiante(accion, datos) {
  if (!esEstudiante() || enviando || !solicitudId) return false;
  enviando = true;
  renderizarSolicitudes();
  const guardado = await ejecutar(() => cambiarSolicitud(solicitudId, accion, { ...datos, actor: identidad() }), 'error-cierre');
  enviando = false;
  renderizarSolicitudes();
  return guardado;
}

el('confirmar-llegada').addEventListener('click', async () => {
  if (await cerrarComoEstudiante('confirmar')) el('estrellas').querySelector('button').focus();
});

el('calificacion').addEventListener('submit', event => event.preventDefault());

el('viaje').addEventListener('input', () => {
  const seleccionadas = new Set(new FormData(el('viaje')).getAll('limitaciones'));
  const titulos = { fisicas: 'Limitaciones y condiciones', entorno: 'Entorno y clima', neuro: 'Apoyos para neurodivergencias' };
  for (const [grupo, opciones] of Object.entries(LIMITACIONES)) {
    el('contador-' + grupo).textContent = titulos[grupo] + ' (' +
      opciones.filter(([id]) => seleccionadas.has(id)).length + ')';
  }
});

suscribirAsistencia(renderizarSolicitudes);
suscribirIncidencias(() => {
  reportes.renderizar();
  if (esEstudiante() && !el('resultados').hidden) mostrarResultados(rutaElegida?.id);
});
reportes.renderizar();
cambiarVista();
async function conectarAsistencia() {
  try {
    const modo = await iniciarAsistencia();
    listo = true;
    reportes.renderizar();
    el('error-asistencia').textContent = '';
    el('conexion').textContent = modo === 'red' ? 'Conectado al servicio de asistencia' : 'Modo local · Sincronización entre pestañas';
    renderizarSolicitudes();
  } catch {
    el('conexion').textContent = 'Reconectando al servicio de asistencia…';
    setTimeout(conectarAsistencia, 1500);
  }
}

conectarAsistencia();