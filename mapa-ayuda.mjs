import { crearSolicitudAyuda, aceptarSolicitud, completarSolicitud, agradecerSolicitud } from './logica-campus.mjs';

const el = id => document.getElementById(id);
const clave = 'campus-solicitudes-v1';
const claveEstudiante = 'campus-estudiante-solicitud';
const etiquetas = ['Acompañamiento seguro', 'Muy paciente', 'Gran disposición'];
const ayudantes = [
  { nombre: 'Camila Soto', rol: 'Tutora par', asistencias: 14 },
  { nombre: 'Diego Rojas', rol: 'Guardia de sector', asistencias: 8 },
];

const puntos = {
  p4: [165, 33, 'Piso 4 · P'],
  'p-subsuelo': [72, 105, 'Piso −1'],
  p1: [260, 105, 'Piso 1'],
  'tunel-fin': [72, 194, 'Fin del túnel'],
  'salida-p': [260, 166, 'Salida P'],
  'entrada-placeres': [260, 225, 'Placeres'],
  'edificio-c': [165, 284, 'Edificio C'],
};

function svgElemento(tipo, atributos) {
  const nodo = document.createElementNS('http://www.w3.org/2000/svg', tipo);
  for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, valor);
  return nodo;
}

export function mostrarMapa(grafo, ruta, origen, destino) {
  const mapa = el('mapa');
  const disponible = puntos[origen] && puntos[destino];
  mapa.hidden = !disponible;
  if (!disponible) return;

  const dibujo = el('tramos-mapa');
  dibujo.replaceChildren();
  const activos = new Set(ruta.tramos);
  const trazos = [];
  for (const tramo of grafo.aristas) {
    const inicio = puntos[tramo.origen];
    const fin = puntos[tramo.destino];
    if (!inicio || !fin) continue;
    const [x1, y1] = inicio;
    const [x2, y2] = fin;
    const curva = tramo.requiereAscensor ? 17 : tramo.pisosRecorridos ? -17 : 0;
    const linea = svgElemento('path', {
      d: 'M ' + x1 + ' ' + y1 + ' Q ' + ((x1 + x2) / 2 + curva) + ' ' + ((y1 + y2) / 2) + ' ' + x2 + ' ' + y2,
      class: (activos.has(tramo.id) ? 'tramo-activo' : 'tramo-alterno') + (tramo.requiereAscensor ? ' ascensor' : ''),
    });
    trazos.push({ linea, activo: activos.has(tramo.id) });
  }
  trazos.sort((a, b) => Number(a.activo) - Number(b.activo));
  dibujo.append(...trazos.map(trazo => trazo.linea));
  for (const [id, [x, y, nombre]] of Object.entries(puntos)) {
    const punto = svgElemento('circle', { cx: x, cy: y, r: 5, class: id === origen || id === destino ? 'punto-activo' : '' });
    const texto = svgElemento('text', { x, y: y - 12, 'text-anchor': 'middle' });
    texto.textContent = nombre;
    dibujo.append(punto, texto);
  }
  el('descripcion-mapa').textContent = ruta.estado === 'ROJO'
    ? 'Mapa de conexiones. No hay una ruta disponible para este perfil.'
    : 'Línea gruesa: ruta elegida. Línea discontinua: ascensor. Las demás líneas muestran conexiones alternativas.';
}

let contexto;
function solicitudes() {
  return JSON.parse(localStorage.getItem(clave) ?? '[]');
}

function operar(accion) {
  const guardar = () => {
    const lista = solicitudes();
    accion(lista);
    localStorage.setItem(clave, JSON.stringify(lista));
    renderizar();
    el('estado-ayuda').textContent = '';
  };
  Promise.resolve().then(() => navigator.locks ? navigator.locks.request(clave, guardar) : guardar())
    .catch(error => {
      el('estado-ayuda').textContent = 'No se pudo guardar: ' + error.message;
      renderizar();
    });
}

function cambiarSolicitud(id, actualizar) {
  operar(lista => {
    const indice = lista.findIndex(solicitud => solicitud.id === id);
    if (indice < 0) throw new Error('La solicitud ya no está disponible');
    lista[indice] = actualizar(lista[indice]);
  });
}

function boton(texto, accion) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = texto;
  control.addEventListener('click', accion);
  return control;
}

function tarjeta(solicitud, participante) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'panel';
  const titulo = document.createElement('h3');
  titulo.textContent = solicitud.origen + ' → ' + solicitud.destino;
  tarjeta.append(titulo);
  const estado = { pendiente: 'Pendiente', en_camino: 'En camino', completada: 'Completada' };
  for (const texto of [estado[solicitud.estado] + ' · ' + solicitud.perfil, solicitud.motivoBloqueo,
    solicitud.ayudante && ('Apoyo: ' + solicitud.ayudante.nombre + ' · ' + solicitud.ayudante.rol
      + ' · ' + solicitud.ayudante.asistencias + ' asistencias')]) {
    if (!texto) continue;
    const parrafo = document.createElement('p');
    parrafo.textContent = texto;
    tarjeta.append(parrafo);
  }
  if (participante === 'ayudante' && solicitud.estado === 'pendiente') {
    tarjeta.append(boton('Aceptar solicitud', () => {
      const perfil = ayudantes[el('perfil-apoyo').value];
      if (!perfil) {
        el('perfil-apoyo').reportValidity();
        return;
      }
      cambiarSolicitud(solicitud.id, actual => aceptarSolicitud(actual, perfil));
    }));
  }
  if (participante === 'ayudante' && solicitud.estado === 'en_camino'
      && solicitud.ayudante.nombre === ayudantes[el('perfil-apoyo').value]?.nombre) {
    tarjeta.append(boton('Completar asistencia', () => cambiarSolicitud(solicitud.id, completarSolicitud)));
  }
  const campo = participante === 'estudiante' ? 'agradecimientoEstudiante' : 'agradecimientoAyudante';
  if (solicitud.estado === 'completada' && !solicitud[campo] &&
      (participante === 'estudiante' || solicitud.ayudante.nombre === ayudantes[el('perfil-apoyo').value]?.nombre)) {
    for (const etiqueta of etiquetas) {
      tarjeta.append(boton(etiqueta, () => cambiarSolicitud(solicitud.id, actual => agradecerSolicitud(actual, participante, etiqueta))));
    }
  }
  for (const etiqueta of [solicitud.agradecimientoEstudiante, solicitud.agradecimientoAyudante].filter(Boolean)) {
    const parrafo = document.createElement('p');
    parrafo.textContent = 'Agradecimiento: ' + etiqueta;
    tarjeta.append(parrafo);
  }
  return tarjeta;
}

function renderizar() {
  const lista = solicitudes();
  const propia = lista.find(solicitud => solicitud.id === sessionStorage.getItem(claveEstudiante));
  const panel = el('mi-solicitud');
  panel.replaceChildren(...(propia ? [tarjeta(propia, 'estudiante')] : []));
  el('pedir-ayuda').disabled = Boolean(propia && propia.estado !== 'completada');
  const cola = el('cola-ayuda');
  cola.replaceChildren(...lista.slice().reverse().map(solicitud => tarjeta(solicitud, 'ayudante')));
  if (!lista.length) cola.textContent = 'Todavía no hay solicitudes.';
}

export function prepararAyuda(datos) {
  contexto = datos;
  el('pedir-ayuda').hidden = !datos;
}

for (const [indice, ayudante] of ayudantes.entries()) {
  el('perfil-apoyo').add(new Option(ayudante.nombre + ' · ' + ayudante.rol, indice));
}
el('perfil-apoyo').addEventListener('change', renderizar);
el('pedir-ayuda').addEventListener('click', () => {
  if (!contexto) return;
  const datos = contexto;
  operar(lista => {
    const activa = lista.find(item => item.id === sessionStorage.getItem(claveEstudiante) && item.estado !== 'completada');
    if (activa) return;
    const nueva = crearSolicitudAyuda(datos);
    lista.push(nueva);
    sessionStorage.setItem(claveEstudiante, nueva.id);
  });
});
el('vista').addEventListener('change', event => {
  const apoyo = event.target.value === 'apoyo';
  el('vista-estudiante').hidden = apoyo;
  el('vista-apoyo').hidden = !apoyo;
  el('estado-ayuda').textContent = '';
  renderizar();
});
window.addEventListener('storage', event => { if (event.key === clave) renderizar(); });
renderizar();
