import { obtenerRanking } from './solicitudes.mjs';

const el = id => document.getElementById(id);
const promedio = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
const titulos = { ranking: 'Ranking de Ayudantes CAM USM', perfil: 'Mi perfil', historial: 'Historial de ayudas' };
const estados = {
  pendiente: 'Pendiente', aceptada: 'En curso', rechazada: 'Rechazada',
  pendiente_confirmacion: 'Pendiente de confirmación o calificación', completada: 'Completada',
};

function nodo(tipo, texto, clase) {
  const elemento = document.createElement(tipo);
  if (texto) elemento.textContent = texto;
  if (clase) elemento.className = clase;
  return elemento;
}

function definiciones(datos) {
  const listado = nodo('dl');
  for (const [titulo, valor] of datos) listado.append(nodo('dt', titulo), nodo('dd', valor));
  return listado;
}

function estrellas(valor) {
  const elemento = nodo('span', '★'.repeat(Math.round(valor)) + '☆'.repeat(5 - Math.round(valor)), 'estrellas-texto');
  elemento.setAttribute('aria-hidden', 'true');
  return elemento;
}

function fechaAsistencia(solicitud) {
  const valor = new Date(solicitud.calificacion?.creadaEn ?? solicitud.creadaEn);
  return Number.isNaN(valor.getTime()) ? 'Fecha no disponible' : fecha.format(valor);
}

function ranking(filas, rolUsm) {
  const lista = nodo('ol', '', 'ranking');
  for (const [indice, ayudante] of filas.entries()) {
    const actual = ayudante.rolUsm === rolUsm;
    const fila = nodo('li', '', 'fila-ranking');
    fila.classList.toggle('ranking-activo', actual);
    fila.dataset.posicion = indice + 1;
    const datos = nodo('div');
    datos.append(
      nodo('strong', ayudante.nombre + (actual ? ' (Tú)' : '')),
      nodo('small', [ayudante.carrera || (ayudante.rolUsm && 'ROL ' + ayudante.rolUsm),
        ayudante.ayudasCompletadas + (ayudante.ayudasCompletadas === 1 ? ' ayuda' : ' ayudas'), ayudante.puntajeTotal + ' pts',
      ].filter(Boolean).join(' · ')),
    );
    fila.append(nodo('span', '#' + (indice + 1), 'posicion'), datos,
      nodo('strong', promedio.format(ayudante.promedio) + ' ★', 'puntaje'));
    lista.append(fila);
  }
  return [lista, nodo('p', 'El ranking reconoce el voluntariado y el acompañamiento de la comunidad USM.', 'nota')];
}

function perfil(sesion, filas, solicitudes) {
  const indice = filas.findIndex(ayudante => ayudante.rolUsm === sesion.rolUsm);
  const datos = filas[indice];
  const evaluacion = nodo('p', datos ? promedio.format(datos.promedio) + ' / 5,0 ' : 'Sin evaluaciones aún');
  if (datos) evaluacion.append(estrellas(datos.promedio));
  const etiquetas = new Set(solicitudes.filter(item => item.ayudante?.rolUsm === sesion.rolUsm && item.estado === 'completada')
    .flatMap(item => item.calificacion?.etiquetas ?? []));
  const reconocimiento = nodo('ul', '', 'etiquetas');
  for (const etiqueta of etiquetas) reconocimiento.append(nodo('li', etiqueta));
  return [
    nodo('p', 'Cuenta Institucional Verificada USM', 'insignia-cuenta'),
    definiciones([['Nombre completo', sesion.nombreCompleto], ['ROL USM', sesion.rol], ['RUT', sesion.rut],
      ['Carrera', sesion.carrera], ['Sede', sesion.sede], ['Correo institucional', sesion.correoInstitucional]]),
    nodo('h3', 'Evaluación promedio'), evaluacion,
    definiciones([['Ayudas dadas', String(datos?.ayudasCompletadas ?? 0)],
      ['Posición en el ranking', datos ? '#' + (indice + 1) : 'Sin posición']]),
    nodo('h3', 'Reconocimientos'), etiquetas.size ? reconocimiento : nodo('p', 'Aún no tienes reconocimientos.', 'nota'),
  ];
}

function construirHistorial(solicitudes, rolUsm, tipo) {
  const dadas = tipo === 'dadas';
  const propias = solicitudes.filter(item => (dadas ? item.ayudante : item.solicitante)?.rolUsm === rolUsm)
    .sort((a, b) => Date.parse(b.calificacion?.creadaEn ?? b.creadaEn) - Date.parse(a.calificacion?.creadaEn ?? a.creadaEn));
  return propias.length ? propias.map(item => {
    const tarjeta = nodo('article', '', 'tarjeta-historial');
    const estado = item.ultimaAccion === 'cancelar' ? 'Cancelada' : estados[item.estado] ?? item.estado;
    tarjeta.append(nodo('h3', item.origen.nombre + ' → ' + item.destino.nombre),
      nodo('p', fechaAsistencia(item), 'nota'),
      nodo('p', (dadas ? 'Ayudante' : 'Solicitante') + ' · ' + estado));
    if (item.calificacion) {
      const evaluacion = nodo('p', (dadas ? 'Calificación recibida: ' : 'Calificación otorgada: ') +
        item.calificacion.estrellas + '/5 ');
      evaluacion.append(estrellas(item.calificacion.estrellas));
      tarjeta.append(evaluacion);
      const etiquetas = nodo('ul', '', 'etiquetas');
      for (const etiqueta of item.calificacion.etiquetas ?? []) etiquetas.append(nodo('li', etiqueta));
      if (etiquetas.children.length) tarjeta.append(etiquetas);
    }
    return tarjeta;
  }) : [nodo('p', dadas ? 'Aún no has dado ayudas. Acepta tu primera solicitud desde Dar ayuda.'
    : 'Aún no has solicitado ayuda. Puedes hacerlo desde Pedir ayuda.', 'nota')];
}

export function prepararCuenta(alCerrar) {
  const panel = el('panel-cuenta');
  const bandeja = el('bandeja-cuenta');
  const botonBandeja = el('abrir-bandeja');
  let sesion;
  let solicitudes = [];
  let vista;
  let historial = 'dadas';
  let disparador;

  function toggleBandeja(visible) {
    bandeja.hidden = !visible;
    botonBandeja.setAttribute('aria-expanded', String(visible));
  }

  function actualizarPanel() {
    if (!panel.open || !sesion?.modo) return;
    const contenido = el('contenido-cuenta');
    if (vista === 'historial') {
      const filtros = nodo('div', '', 'filtros-historial');
      for (const [tipo, nombre] of [['dadas', 'Ayudas dadas'], ['solicitadas', 'Ayudas solicitadas']]) {
        const boton = nodo('button', nombre);
        boton.type = 'button';
        boton.dataset.tipo = tipo;
        boton.setAttribute('aria-pressed', String(historial === tipo));
        boton.addEventListener('click', () => {
          historial = tipo;
          actualizarPanel();
          contenido.querySelector('[data-tipo="' + tipo + '"]').focus();
        });
        filtros.append(boton);
      }
      const foco = document.activeElement?.dataset.tipo;
      contenido.replaceChildren(filtros, ...construirHistorial(solicitudes, sesion.rolUsm, historial));
      if (foco) contenido.querySelector('[data-tipo="' + foco + '"]')?.focus({ preventScroll: true });
      return;
    }
    const filas = obtenerRanking(solicitudes);
    contenido.replaceChildren(...(vista === 'ranking' ? ranking(filas, sesion.rolUsm) : perfil(sesion, filas, solicitudes)));
  }

  function abrir(tipo, boton) {
    if (!sesion?.modo) return;
    disparador = boton;
    vista = tipo;
    historial = 'dadas';
    toggleBandeja(false);
    el('titulo-cuenta').textContent = titulos[tipo];
    panel.showModal();
    panel.scrollTop = 0;
    actualizarPanel();
    el('titulo-cuenta').focus();
  }

  botonBandeja.addEventListener('click', () => toggleBandeja(bandeja.hidden));
  document.addEventListener('pointerdown', event => {
    if (!bandeja.hidden && !el('sesion-activa').contains(event.target)) toggleBandeja(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !bandeja.hidden) {
      toggleBandeja(false);
      botonBandeja.focus();
    }
  });
  bandeja.addEventListener('click', event => {
    if (event.target.closest('button')) toggleBandeja(false);
  });
  for (const tipo of ['ranking', 'perfil', 'historial']) {
    el('abrir-' + tipo).addEventListener('click', () => abrir(tipo, tipo === 'ranking' ? el('abrir-ranking') : botonBandeja));
  }
  el('cerrar-panel-cuenta').addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => {
    if (sesion?.modo) disparador?.focus({ preventScroll: true });
    alCerrar();
  });

  return {
    abierta: () => panel.open,
    actualizar(identidad, lista) {
      sesion = identidad;
      solicitudes = lista;
      el('sesion-activa').hidden = !sesion?.modo;
      const nombre = sesion?.nombre ?? '';
      el('nombre-cuenta').textContent = sesion?.primerNombre ?? '';
      botonBandeja.title = nombre;
      if (!sesion?.modo) {
        toggleBandeja(false);
        if (panel.open) panel.close();
      }
      actualizarPanel();
    },
  };
}