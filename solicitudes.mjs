const API = './api/solicitudes';
const CLAVE = 'cae-usm-asistencia-v2';
const canal = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CLAVE) : null;
const registros = new Map();
const TRANSICIONES = {
  aceptar: ['pendiente', 'aceptada'],
  rechazar: ['pendiente', 'rechazada'],
  cancelar: ['pendiente', 'rechazada'],
  finalizar: ['aceptada', 'pendiente_confirmacion'],
  confirmar: ['pendiente_confirmacion', 'pendiente_confirmacion'],
  calificar: ['pendiente_confirmacion', 'completada'],
};
export const ETIQUETAS_CALIFICACION = ['Amable', 'Paciente', 'Puntual'];
const BASE_RANKING = [
  { nombre: 'Alma', puntajeTotal: 18, ayudasCompletadas: 4 },
  { nombre: 'Diego', puntajeTotal: 16, ayudasCompletadas: 4 },
  { nombre: 'Pepito', puntajeTotal: 14, ayudasCompletadas: 3 },
  { nombre: 'Camila', puntajeTotal: 10, ayudasCompletadas: 3 },
];

export function claveAyudante(nombre) {
  return nombre.trim().normalize('NFC').toLocaleLowerCase('es-CL');
}

function clavePerfil(ayudante) {
  return ayudante.rolUsm ? 'rol:' + ayudante.rolUsm : 'nombre:' + claveAyudante(ayudante.nombre);
}

export function obtenerRanking(solicitudes) {
  const filas = new Map(BASE_RANKING.map(ayudante => [clavePerfil(ayudante), { ...ayudante }]));
  for (const { estado, ayudante, calificacion } of solicitudes) {
    const puntos = calificacion?.estrellas;
    if (estado !== 'completada' || !ayudante?.nombre || !Number.isInteger(puntos) || puntos < 1 || puntos > 5) continue;
    const clave = clavePerfil(ayudante);
    const fila = filas.get(clave) ?? { ...ayudante, puntajeTotal: 0, ayudasCompletadas: 0 };
    fila.nombre = ayudante.nombre;
    fila.puntajeTotal += puntos;
    fila.ayudasCompletadas += 1;
    filas.set(clave, fila);
  }
  return [...filas.values()].map(fila => ({ ...fila, promedio: fila.puntajeTotal / fila.ayudasCompletadas }))
    .sort((a, b) => b.puntajeTotal - a.puntajeTotal || b.promedio - a.promedio || a.nombre.localeCompare(b.nombre, 'es'));
}
const oyentes = new Set();
let modo;
let encuesta;

function notificar(datos) {
  let cambios = false;
  for (const actual of datos) {
    if (!registros.has(actual.id) || registros.get(actual.id).revision < actual.revision) {
      registros.set(actual.id, actual);
      cambios = true;
    }
  }
  if (cambios) for (const oyente of oyentes) oyente();
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
  encuesta = pedir(API).then(datos => notificar(datos.solicitudes)).finally(() => { encuesta = null; });
  return encuesta;
}

export async function iniciarAsistencia() {
  if (!document.querySelector('meta[name="cae-api"]')) {
    modo = 'local';
    notificar(leerLocal());
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
  return [...registros.values()].sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
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
  return { nombre: actor.nombre.trim(), rolUsm: actor.rolUsm };
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

canal?.addEventListener('message', event => {
  if (modo && event.data?.modo === modo) notificar(event.data.datos);
});
window.addEventListener('storage', event => {
  if (modo === 'local' && event.key === CLAVE) notificar(leerLocal());
});