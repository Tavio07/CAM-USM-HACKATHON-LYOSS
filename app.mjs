import { CENTRO_CAMPUS, LIMITACIONES, LUGARES, ORIGENES_QR, buscarRutas } from './rutas.mjs';

const el = id => document.getElementById(id);
const lugares = new Map(LUGARES.map(lugar => [lugar.id, lugar]));
const nombresLimitaciones = new Map(Object.values(LIMITACIONES).flat());
const estados = {
  VERDE: { color: '#198754', texto: 'Verde · Viable' },
  AMARILLO: { color: '#A15A00', texto: 'Amarillo · Precaución' },
  ROJO: { color: '#C92A2A', texto: 'Rojo · Bloqueada' },
};
const leaflet = window.L;
let mapaRutas;
let capasRutas;
let viaje;

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
  return seleccionar;
}

const elegirOrigen = prepararSelector('origen');
prepararSelector('destino');
const idQr = new URLSearchParams(location.search).get('origen');
if (idQr) {
  const alias = Object.hasOwn(ORIGENES_QR, idQr) ? ORIGENES_QR[idQr] : [idQr];
  if (lugares.has(alias[0])) elegirOrigen(...alias);
  else el('aviso-origen').textContent = 'El enlace indica un punto desconocido. Puedes seleccionar tu origen.';
}

function invalidarResultados() {
  viaje = undefined;
  el('resultados').hidden = true;
  el('confirmacion').hidden = true;
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
  estado.textContent = estados[ruta.estado].texto + ' · ' + ruta.minutos + ' min aprox.' +
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
  viaje = { origen: leerPunto('origen'), destino: leerPunto('destino'), limitaciones, comentarios: el('comentarios').value.trim() };
  const opciones = buscarRutas(viaje.origen, viaje.destino, limitaciones);
  const recomendada = opciones.find(ruta => ruta.estado !== 'ROJO')?.id;
  const mismoPunto = viaje.origen.id === viaje.destino.id && viaje.origen.piso === viaje.destino.piso;
  el('aviso-rutas').textContent = recomendada ? '' : mismoPunto ? 'El origen y el destino coinciden.'
    : opciones.length ? 'Ninguna de las rutas es viable con las condiciones seleccionadas.'
    : 'No hay un recorrido de demo para estos puntos o pisos.';
  el('alternativas').replaceChildren(...opciones.map(ruta => tarjetaRuta(ruta, ruta.id === recomendada, opciones)));
  el('confirmacion').hidden = true;
  el('resultados').hidden = false;
  mostrarAlternativas(opciones, recomendada ?? opciones[0]?.id);
  el('titulo-resultados').focus();
});

function describirPunto(punto) {
  return [punto.nombre, punto.piso === null ? '' : 'Piso ' + punto.piso, punto.referencia].filter(Boolean).join(' · ');
}

el('solicitar').addEventListener('click', () => {
  if (!viaje) return;
  const resumen = el('resumen');
  resumen.replaceChildren();
  for (const [titulo, valor] of [
    ['Origen', describirPunto(viaje.origen)],
    ['Destino', describirPunto(viaje.destino)],
    ['Limitaciones y condiciones', viaje.limitaciones.map(id => nombresLimitaciones.get(id)).join(' · ') || 'Ninguna indicada'],
    ['Comentarios extra', viaje.comentarios || 'Sin comentarios'],
  ]) {
    const termino = document.createElement('dt');
    const contenido = document.createElement('dd');
    termino.textContent = titulo;
    contenido.textContent = valor;
    resumen.append(termino, contenido);
  }
  el('confirmacion').hidden = false;
  el('titulo-confirmacion').focus();
});
