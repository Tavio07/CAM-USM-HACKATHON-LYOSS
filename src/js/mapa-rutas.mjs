const ESTILOS = [
  { weight: 6, opacity: .95, dashArray: null },
  { weight: 5, opacity: .85, dashArray: '10, 8' },
  { weight: 5, opacity: .8, dashArray: '3, 8' },
  { weight: 5, opacity: .8, dashArray: '12, 6, 3, 6' },
];

export function prepararCapasRutas({ leaflet, contenedor, obtenerMapa, color, alSeleccionar }) {
  const capas = new Map();
  let opciones = [];
  let seleccion;
  let mapa;
  let extremos;
  let limitesExtremos;

  function limpiar() {
    if (mapa) {
      for (const { capa } of capas.values()) mapa.removeLayer(capa);
      if (extremos) mapa.removeLayer(extremos);
    }
    extremos = null;
    limitesExtremos = null;
    capas.clear();
    contenedor.replaceChildren();
    contenedor.hidden = true;
    opciones = [];
  }

  function enfocar(animar = false) {
    for (const boton of contenedor.children) {
      boton.setAttribute('aria-pressed', String(boton.dataset.ruta === seleccion));
    }
    if (!mapa) return;
    const limites = leaflet.latLngBounds(limitesExtremos);
    for (const [id, { capa, trazo, individual, conjunto }] of capas) {
      if (seleccion === 'all' || seleccion === id) {
        trazo.setLatLngs(seleccion === 'all' ? conjunto : individual);
        capa.addTo(mapa);
        if (seleccion === 'all') capa.eachLayer(elemento => elemento.bringToFront?.());
        limites.extend(capa.getBounds());
      } else mapa.removeLayer(capa);
    }
    if (limites.isValid()) mapa.fitBounds(limites, {
      padding: [24, 24], maxZoom: 18,
      animate: animar && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  }

  function seleccionar(id, animar = false) {
    seleccion = id;
    enfocar(animar);
    alSeleccionar(id);
  }

  function boton(id, texto, etiqueta) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = texto;
    control.dataset.ruta = id;
    control.setAttribute('aria-label', etiqueta);
    control.addEventListener('click', () => seleccionar(id, true));
    return control;
  }

  function cargar(rutas, origen, destino, conservar) {
    const foco = contenedor.contains(document.activeElement) ? document.activeElement.dataset.ruta : null;
    const anterior = seleccion;
    limpiar();
    opciones = rutas;
    mapa = obtenerMapa();
    seleccion = conservar && (opciones.some(ruta => ruta.id === anterior) ||
      (anterior === 'all' && opciones.length > 1)) ? anterior : opciones[0]?.id;
    for (const [indice, ruta] of opciones.entries()) {
      const numero = ruta.numero ?? indice + 1;
      contenedor.append(boton(ruta.id, String(numero), 'Mostrar ruta ' + numero));
    }
    if (opciones.length > 1) contenedor.append(boton('all', 'Todas', 'Mostrar todas las rutas'));
    contenedor.hidden = !opciones.length;
    if (mapa) {
      mapa.invalidateSize();
      limitesExtremos = [[origen.lat, origen.lng], [destino.lat, destino.lng]];
      extremos = leaflet.layerGroup([
        leaflet.marker(limitesExtremos[0], { alt: 'Origen: ' + origen.nombre }).bindTooltip('Origen: ' + origen.nombre),
        leaflet.marker(limitesExtremos[1], { alt: 'Destino: ' + destino.nombre }).bindTooltip('Destino: ' + destino.nombre),
      ]).addTo(mapa);
      const repeticiones = new Map();
      for (const ruta of rutas) {
        for (const clave of new Set(ruta.trazado.map(punto => punto.join(',')))) {
          repeticiones.set(clave, (repeticiones.get(clave) ?? 0) + 1);
        }
      }
      for (const [indice, ruta] of rutas.entries()) {
        const desplazamiento = [0, 1, -1, 2][indice % 4] * .000025;
        const conjunto = ruta.trazado.map(([lat, lng], posicion) => {
          const compartido = repeticiones.get([lat, lng].join(',')) > 1;
          if (!compartido || posicion === 0 || posicion === ruta.trazado.length - 1) return [lat, lng];
          return [lat + desplazamiento, lng - desplazamiento * .6];
        });
        const trazo = leaflet.polyline(ruta.trazado, { ...ESTILOS[indice % ESTILOS.length], color: color(ruta.estado) });
        trazo.on('click', () => seleccionar(ruta.id, true));
        const hitos = ruta.hitos.map(([lat, lng, nombre]) => leaflet.circleMarker([lat, lng], {
          radius: 4, weight: 2, color: color(ruta.estado), fillColor: '#fff', fillOpacity: 1,
        }).bindTooltip(nombre));
        capas.set(ruta.id, { capa: leaflet.featureGroup([trazo, ...hitos]), trazo, individual: ruta.trazado, conjunto });
      }
    }
    enfocar();
    alSeleccionar(seleccion);
    if (foco) [...contenedor.children].find(control => control.dataset.ruta === foco)?.focus({ preventScroll: true });
  }

  return { cargar, limpiar, seleccionar };
}
