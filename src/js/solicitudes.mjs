import { REPORT_TTL_MINUTES, categoriaIncidencia, normalizarIncidencia, minutosValidos } from './ttl.mjs';
import { historialInstitucional, usuarioPorRol } from './directorio.mjs';
import { INCIDENCIAS_RAPIDAS, LUGARES } from './rutas.mjs';

const API = './api/solicitudes';
const CLAVE = 'cae-usm-asistencia-v2';
const canal = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CLAVE) : null;
const registros = new Map();
const CLAVE_INCIDENCIAS = 'cam-usm-incidencias-v1';
const incidencias = new Map();
const oyentesIncidencias = new Set();
const TRANSICIONES = {
  aceptar: ['pendiente', 'aceptada'],
  rechazar: ['pendiente', 'rechazada'],
  cancelar: ['pendiente', 'rechazada'],
  finalizar: ['aceptada', 'pendiente_confirmacion'],
  confirmar: ['pendiente_confirmacion', 'pendiente_confirmacion'],
  calificar: ['pendiente_confirmacion', 'completada'],
};
export const ETIQUETAS_CALIFICACION = ['Amable', 'Paciente', 'Puntual'];

export function claveAyudante(nombre) {
  return nombre.trim().normalize('NFC').toLocaleLowerCase('es-CL');
}

function clavePerfil(ayudante) {
  return ayudante.rolUsm ? 'rol:' + ayudante.rolUsm : 'nombre:' + claveAyudante(ayudante.nombre);
}

export function obtenerRanking(solicitudes) {
  const filas = new Map();
  for (const { estado, ayudante, calificacion } of solicitudes) {
    const puntos = calificacion?.estrellas;
    if (estado !== 'completada' || !ayudante?.nombre || !Number.isInteger(puntos) || puntos < 1 || puntos > 5) continue;
    const clave = clavePerfil(ayudante);
    const fila = filas.get(clave) ?? { ...ayudante, puntajeTotal: 0, ayudasCompletadas: 0 };
    const usuario = usuarioPorRol(ayudante.rolUsm);
    fila.nombre = usuario?.nombreCompleto ?? ayudante.nombre;
    fila.carrera = usuario?.carrera;
    fila.puntajeTotal += puntos;
    fila.ayudasCompletadas += 1;
    filas.set(clave, fila);
  }
  return [...filas.values()].map(fila => ({ ...fila, promedio: fila.puntajeTotal / fila.ayudasCompletadas }))
    .sort((a, b) => b.ayudasCompletadas - a.ayudasCompletadas || b.promedio - a.promedio || a.nombre.localeCompare(b.nombre, 'es'));
}
const oyentes = new Set();
let modo;
let encuesta;

function fusionar(registro, datos) {
  let cambios = false;
  for (const actual of datos) {
    if (!registro.has(actual.id) || registro.get(actual.id).revision < actual.revision) {
      registro.set(actual.id, actual);
      cambios = true;
    }
  }
  return cambios;
}

function notificar(datos) {
  if (fusionar(registros, datos)) for (const oyente of oyentes) oyente();
}

let firmaIncidencias = '';
let limpiandoLocal = false;

function notificarIncidencias(datos) {
  fusionar(incidencias, datos.map(item => normalizarIncidencia(item)));
  sincronizarExpiracionReportes();
}

export function sincronizarExpiracionReportes() {
  const ahora = Date.now();
  const activas = [...incidencias.values()].filter(item => item.activa && ahora < item.expiraEn);
  const firma = activas.map(item => item.id + ':' + item.revision).join('|');
  if (firma !== firmaIncidencias) {
    firmaIncidencias = firma;
    for (const oyente of oyentesIncidencias) oyente();
  }
  if (modo !== 'local' || limpiandoLocal ||
      ![...incidencias.values()].some(item => item.activa && ahora >= item.expiraEn)) return;
  limpiandoLocal = true;
  conBloqueoIncidencias(() => {
    const lista = leerIncidencias().map(item => normalizarIncidencia(item, ahora));
    const expiradas = [];
    for (const item of lista) {
      if (item.activa && ahora >= item.expiraEn) {
        item.activa = item.activo = false;
        item.estadoAviso = 'expirado';
        item.revision += 1;
        expiradas.push(item);
      }
    }
    if (expiradas.length) {
      localStorage.setItem(CLAVE_INCIDENCIAS, JSON.stringify(lista));
      notificarIncidencias(expiradas);
      canal?.postMessage({ modo, incidencias: expiradas });
    }
  }).finally(() => { limpiandoLocal = false; }).catch(() => {});
}

function leerLocal() {
  return JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
}

async function pedir(ruta, datos) {
  const respuesta = await fetch(ruta, {
    cache: 'no-store',
    signal: AbortSignal.timeout(4500),
    ...(datos ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) } : {}),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({}));
    const error = new Error(detalle.error ?? 'No se pudo conectar al servicio de asistencia.');
    error.codigo = respuesta.status;
    throw error;
  }
  return respuesta.json();
}

async function consultar() {
  if (encuesta) return encuesta;
  encuesta = pedir(API).then(datos => {
    notificar(datos.solicitudes);
    notificarIncidencias(datos.incidencias ?? []);
  }).finally(() => { encuesta = null; });
  return encuesta;
}

export async function iniciarAsistencia() {
  if (!document.querySelector('meta[name="cae-api"]')) {
    modo = 'local';
    notificar(leerLocal());
    const anteriores = await conBloqueoIncidencias(() => {
      const guardadas = leerIncidencias();
      const actuales = guardadas.map(item => normalizarIncidencia(item));
      if (JSON.stringify(guardadas) !== JSON.stringify(actuales)) {
        localStorage.setItem(CLAVE_INCIDENCIAS, JSON.stringify(actuales));
      }
      return actuales;
    });
    notificarIncidencias(anteriores);
    return modo;
  }
  await consultar();
  modo = 'red';
  setInterval(() => { if (!document.hidden) consultar().catch(() => {}); }, 1500);
  window.addEventListener('focus', () => consultar().catch(() => {}));
  return modo;
}

export function suscribirAsistencia(oyente) {
  oyentes.add(oyente);
}

export function listarSolicitudes() {
  return [...registros.values(), ...historialInstitucional].sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
}

function guardarLocal(operar) {
  const guardar = () => {
    const lista = leerLocal();
    const nuevo = operar(lista);
    localStorage.setItem(CLAVE, JSON.stringify(lista));
    notificar(lista);
    canal?.postMessage({ modo, datos: [nuevo] });
    return nuevo;
  };
  return navigator.locks ? navigator.locks.request(CLAVE, guardar) : Promise.resolve().then(guardar);
}

function idSolicitud() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export function prepararSolicitud(viaje) {
  return { ...viaje, id: idSolicitud(), estado: 'pendiente', ayudante: null, revision: 0, creadaEn: new Date().toISOString() };
}

async function enviar(ruta, datos) {
  try {
    const nuevo = await pedir(ruta, datos);
    notificar([nuevo]);
    canal?.postMessage({ modo, datos: [nuevo] });
    return nuevo;
  } catch (error) {
    if (error.codigo === 409) await consultar().catch(() => {});
    throw error;
  }
}

export function crearSolicitud(nueva) {
  if (modo === 'red') return enviar(API, nueva);
  return guardarLocal(lista => {
    const existente = lista.find(item => item.id === nueva.id);
    if (existente) return existente;
    lista.push(nueva);
    return nueva;
  });
}

function validarCalificacion(datos) {
  const { estrellas, etiquetas = [], comentario = '' } = datos;
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5 ||
      !Array.isArray(etiquetas) || etiquetas.some(etiqueta => !ETIQUETAS_CALIFICACION.includes(etiqueta)) ||
      typeof comentario !== 'string' || comentario.length > 200) {
    throw new Error('La calificación debe tener entre 1 y 5 estrellas y opciones válidas.');
  }
  return { estrellas, etiquetas: [...new Set(etiquetas)], comentario: comentario.trim(), creadaEn: new Date().toISOString() };
}

function actorValido(actor) {
  if (typeof actor?.nombre !== 'string' || !actor.nombre.trim() || actor.nombre.length > 80 ||
      typeof actor.rolUsm !== 'string' || actor.rolUsm.length > 24 || !/^[0-9]+(?:-[0-9K])?$/.test(actor.rolUsm)) {
    throw new Error('La acción requiere una sesión USM válida.');
  }
  const usuario = usuarioPorRol(actor.rolUsm);
  if (!usuario) throw new Error('El ROL no está en el directorio USM.');
  return { nombre: usuario.nombreCompleto, rolUsm: usuario.rol };
}

function verificarActor(solicitud, accion, actor) {
  if (['aceptar', 'rechazar'].includes(accion) && solicitud.solicitante?.rolUsm === actor.rolUsm) {
    throw new Error('La solicitud pertenece a tu sesión de estudiante.');
  }
  const titular = ['cancelar', 'confirmar', 'calificar'].includes(accion) ? solicitud.solicitante
    : accion === 'finalizar' || (accion === 'aceptar' && solicitud.ultimaAccion === 'aceptar') ? solicitud.ayudante : null;
  if (titular?.rolUsm && titular.rolUsm !== actor.rolUsm) {
    throw new Error('La acción corresponde a otro participante.');
  }
}

export function cambiarSolicitud(id, accion, datos = {}) {
  if (modo === 'red') return enviar(API + '/' + id, { ...datos, accion });
  return guardarLocal(lista => {
    const indice = lista.findIndex(item => item.id === id);
    const anterior = lista[indice];
    if (!anterior) throw new Error('La solicitud ya no está disponible.');
    const actor = actorValido(datos.actor);
    verificarActor(anterior, accion, actor);
    if (anterior.ultimaAccion === accion) return anterior;
    const transicion = Object.hasOwn(TRANSICIONES, accion) ? TRANSICIONES[accion] : null;
    if (!transicion || anterior.estado !== transicion[0] || (accion === 'calificar' && !anterior.llegadaConfirmada)) {
      notificar([anterior]);
      throw new Error('La acción no corresponde al estado de la solicitud.');
    }
    const nuevo = { ...anterior, estado: transicion[1], ultimaAccion: accion, revision: anterior.revision + 1 };
    if (accion === 'aceptar') nuevo.ayudante = actor;
    if (accion === 'confirmar') nuevo.llegadaConfirmada = true;
    if (accion === 'calificar') nuevo.calificacion = validarCalificacion(datos);
    lista[indice] = nuevo;
    return nuevo;
  });
}

function leerIncidencias() {
  return JSON.parse(localStorage.getItem(CLAVE_INCIDENCIAS) ?? '[]');
}

export function listarIncidencias() {
  return [...incidencias.values()].filter(item => item.activa && Date.now() < item.expiraEn).sort((a, b) => b.creadoEn - a.creadoEn);
}

export function listarHistorialIncidencias() {
  return [...incidencias.values()].sort((a, b) => b.creadoEn - a.creadoEn);
}

export function suscribirIncidencias(oyente) {
  oyentesIncidencias.add(oyente);
}

function conBloqueoIncidencias(operar) {
  return navigator.locks ? navigator.locks.request(CLAVE_INCIDENCIAS, operar) : Promise.resolve().then(operar);
}

export async function cambiarIncidencia(datos) {
  if (!modo) throw new Error('El servicio todavía se está conectando.');
  const actor = actorValido(datos.actor);
  const id = datos.id ?? idSolicitud();
  let nuevo;
  if (modo === 'red') {
    nuevo = await pedir('./api/incidencias', { ...datos, id, actor });
  } else {
    nuevo = await conBloqueoIncidencias(() => {
      const lista = leerIncidencias().map(item => normalizarIncidencia(item));
      const indice = lista.findIndex(item => item.id === id);
      const anterior = lista[indice];
      const ahora = Date.now();
      const vigente = anterior?.activa && ahora < anterior.expiraEn;
      const revision = (anterior?.revision ?? -1) + 1;
      let actual;
      if (['editar', 'extender', 'retirar'].includes(datos.accion) && anterior &&
          (anterior.creadoPorRol ? anterior.creadoPorRol !== actor.rolUsm : anterior.creadoPorNombre !== actor.nombre)) {
        throw new Error('Solo puedes gestionar tus propios reportes.');
      }
      if (datos.accion === 'editar' || datos.accion === 'extender') {
        if (!vigente) throw new Error('Este aviso ya no está activo.');
        const duracionMinutos = datos.accion === 'extender'
          ? anterior.duracionMinutos + REPORT_TTL_MINUTES.extensionMinutos : datos.duracionMinutos;
        if (!minutosValidos(duracionMinutos)) throw new Error('Ingresa una duración válida de al menos 1 minuto.');
        actual = { ...anterior, duracionMinutos, revision, expiraEn: datos.accion === 'extender'
          ? anterior.expiraEn + REPORT_TTL_MINUTES.extensionMinutos * 60000 : ahora + duracionMinutos * 60000 };
      } else if (!datos.activa) {
        if (!anterior || !anterior.activa) return anterior;
        actual = { ...anterior, activa: false, activo: false, estadoAviso: 'retirado', revision };
      } else {
        if (vigente) return anterior;
        const rapida = INCIDENCIAS_RAPIDAS.find(item => item.id === id || item.id === datos.tipo);
        const lugar = rapida?.lugar ?? datos.lugar;
        const descripcion = (rapida?.descripcion ?? datos.descripcion ?? '').trim();
        if (rapida && datos.lugar && datos.lugar !== rapida.lugar) throw new Error('El tipo no corresponde al lugar.');
        const tipo = rapida?.id ?? 'personalizada';
        const categoria = categoriaIncidencia(tipo, datos.categoria);
        const duracionMinutos = datos.duracionMinutos ?? REPORT_TTL_MINUTES[categoria];
        if (!LUGARES.some(item => item.id === lugar) || !descripcion || descripcion.length > 140 ||
            !minutosValidos(duracionMinutos)) {
          throw new Error('Revisa el lugar, la descripción y la duración del aviso.');
        }
        actual = { id, lugar, descripcion, tipo, categoria, activa: true, activo: true, revision,
          reportadaPor: actor.nombre, rolReportante: actor.rolUsm, reportadaEn: new Date(ahora).toISOString(),
          creadoPorNombre: actor.nombre, creadoPorRol: actor.rolUsm,
          creadoEn: ahora, duracionMinutos, expiraEn: ahora + duracionMinutos * 60000 };
      }
      if (indice < 0) lista.push(actual);
      else lista[indice] = actual;
      localStorage.setItem(CLAVE_INCIDENCIAS, JSON.stringify(lista));
      return actual;
    });
  }
  if (nuevo) {
    notificarIncidencias([nuevo]);
    canal?.postMessage({ modo, incidencias: [nuevo] });
  }
}

canal?.addEventListener('message', event => {
  if (!modo || event.data?.modo !== modo) return;
  if (event.data.datos) notificar(event.data.datos);
  if (event.data.incidencias) notificarIncidencias(event.data.incidencias);
});
window.addEventListener('storage', event => {
  if (modo !== 'local') return;
  if (event.key === CLAVE) notificar(leerLocal());
  if (event.key === CLAVE_INCIDENCIAS) notificarIncidencias(leerIncidencias());
});