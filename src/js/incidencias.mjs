import { incidenciaAfectaRuta, LUGARES } from './rutas.mjs';
import { cambiarIncidencia, listarIncidencias, listarHistorialIncidencias, sincronizarExpiracionReportes } from './solicitudes.mjs';
import { REPORT_TTL_MINUTES, estiloReporte, tituloReporte } from './ttl.mjs';

const el = id => document.getElementById(id);
const lugares = new Map(LUGARES.map(({ id, nombre }) => [id, nombre]));
const TIPOS = [
  { id: 'superficie', categoria: 'superficie' },
  { id: 'obstaculo', categoria: 'obstaculo' },
  { id: 'construccion', categoria: 'construccion' },
  { id: 'aglomeracion', categoria: 'aglomeracion' },
  { id: 'ascensor-p', categoria: 'ascensor', lugar: 'edificio-p' },
  { id: 'rampa-c', categoria: 'obstaculo', lugar: 'edificio-c' },
];
const hora = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' });

function nodo(tipo, texto, clase) {
  const elemento = document.createElement(tipo);
  if (texto) elemento.textContent = texto;
  if (clase) elemento.className = clase;
  return elemento;
}

function actualizarReloj(reloj) {
  const ms = Number(reloj.dataset.expira) - Date.now();
  const minutos = Math.floor(ms / 60000);
  reloj.textContent = ms <= 0 ? 'Expirado' : minutos < 1 ? 'Expira en < 1 min'
    : 'Expira en ' + (minutos >= 60 ? Math.floor(minutos / 60) + ' h ' + minutos % 60 : minutos) + ' min';
}

function contenidoReporte(item, tipo = 'li') {
  const tarjeta = nodo(tipo, '', 'tarjeta-reporte');
  tarjeta.dataset.tipoReporte = estiloReporte(item).id;
  tarjeta.append(nodo('strong', lugares.get(item.lugar) ?? item.lugar, 'lugar-reporte'),
    nodo('span', tituloReporte(item), 'tipo-reporte'));
  if (item.activa && Date.now() < item.expiraEn) {
    const reloj = nodo('small', '', 'reloj-incidencia');
    reloj.dataset.expira = item.expiraEn;
    actualizarReloj(reloj);
    tarjeta.append(reloj);
  }
  return tarjeta;
}

export function prepararIncidencias(obtenerSesion, servicioListo, mapas) {
  const pendientes = new Set();
  const capas = new Map();
  const panel = el('panel-incidencias');
  const historial = el('panel-historial-reportes');
  const lugar = el('lugar-incidencia');
  const categoria = el('categoria-incidencia');
  const duracion = el('duracion-incidencia');
  const form = el('publicar-incidencia');
  let rutasVisibles = [];
  let temporizador;

  for (const [id, nombre] of lugares) lugar.add(new Option(nombre, id));

  function ajustarDuracion() {
    const tipo = TIPOS.find(item => item.id === categoria.value);
    duracion.value = REPORT_TTL_MINUTES[tipo?.categoria ?? 'default'];
    categoria.dataset.tipoReporte = estiloReporte(tipo ?? {}).id;
  }

  function ajustarTipos() {
    const antes = categoria.value;
    const opciones = TIPOS.filter(tipo => !tipo.lugar || tipo.lugar === lugar.value);
    categoria.replaceChildren(...opciones.map(tipo => new Option(tituloReporte({ ...tipo, tipo: tipo.id }), tipo.id)));
    if (opciones.some(tipo => tipo.id === antes)) categoria.value = antes;
    ajustarDuracion();
  }

  lugar.addEventListener('change', ajustarTipos);
  categoria.addEventListener('change', ajustarDuracion);
  ajustarTipos();

  for (const minutos of [15, 30, 60, 120, 240]) {
    const boton = nodo('button', minutos < 60 ? minutos + ' min' : minutos / 60 + ' h');
    boton.type = 'button';
    boton.addEventListener('click', () => { duracion.value = minutos; });
    el('duraciones-rapidas').append(boton);
  }

  function abrir(dialogo, titulo) {
    if (!obtenerSesion()?.modo || dialogo.open) return;
    dialogo.showModal();
    el(titulo).focus();
  }

  el('abrir-incidencias').addEventListener('click', () => abrir(panel, 'titulo-incidencias'));
  el('cerrar-incidencias').addEventListener('click', () => panel.close());
  el('abrir-historial-reportes').addEventListener('click', () => {
    renderizarHistorial();
    abrir(historial, 'titulo-historial-reportes');
  });
  el('cerrar-historial-reportes').addEventListener('click', () => historial.close());
  historial.addEventListener('close', () => el('abrir-bandeja').focus({ preventScroll: true }));

  async function publicar(datos, errorId = 'error-incidencias') {
    const sesion = obtenerSesion();
    const clave = datos.id ?? 'nuevo';
    if (!sesion?.modo || !servicioListo() || pendientes.has(clave)) return false;
    pendientes.add(clave);
    el('publicar-aviso').disabled = pendientes.has('nuevo');
    el(errorId).textContent = '';
    try {
      await cambiarIncidencia({ ...datos, actor: { nombre: sesion.nombre, rolUsm: sesion.rolUsm } });
      return true;
    } catch (error) {
      el(errorId).textContent = error.message;
      return false;
    } finally {
      pendientes.delete(clave);
      el('publicar-aviso').disabled = !servicioListo();
      if (historial.open) renderizarHistorial();
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const tipo = TIPOS.find(item => item.id === categoria.value);
    if (!tipo) return;
    const datos = { lugar: lugar.value, categoria: tipo.categoria, tipo: tipo.lugar ? tipo.id : 'personalizada',
      duracionMinutos: Number(duracion.value), descripcion: tituloReporte({ ...tipo, tipo: tipo.id }), activa: true };
    if (!await publicar(datos)) return;
    form.reset();
    ajustarTipos();
    panel.close();
    const aviso = el('confirmacion-reporte');
    clearTimeout(temporizador);
    aviso.textContent = 'Reporte generado';
    temporizador = setTimeout(() => { aviso.textContent = ''; }, 3500);
  });

  function tarjetaHistorial(item) {
    const tarjeta = contenidoReporte(item);
    const vigente = item.activa && Date.now() < item.expiraEn;
    const estado = vigente ? 'Activo' : item.estadoAviso === 'retirado' ? 'Finalizado'
      : item.estadoAviso === 'expirado' || Date.now() >= item.expiraEn ? 'Expirado' : 'Finalizado';
    tarjeta.append(nodo('small', estado + ' · ' + hora.format(new Date(item.creadoEn))));
    if (!vigente) return tarjeta;

    const acciones = nodo('div', '', 'acciones-tiempo');
    const extender = nodo('button', '+' + REPORT_TTL_MINUTES.extensionMinutos + ' min');
    extender.type = 'button';
    extender.disabled = pendientes.has(item.id);
    extender.addEventListener('click', () => publicar({ id: item.id, accion: 'extender' }, 'error-historial-reportes'));
    const edicion = nodo('details');
    const campo = nodo('input');
    campo.type = 'number';
    campo.min = 1;
    campo.step = 1;
    campo.required = true;
    campo.value = Math.max(1, Math.ceil((item.expiraEn - Date.now()) / 60000));
    campo.setAttribute('aria-label', 'Nueva duración en minutos');
    const guardar = nodo('button', 'Guardar');
    guardar.type = 'button';
    guardar.disabled = extender.disabled;
    guardar.addEventListener('click', () => {
      if (campo.reportValidity()) publicar({ id: item.id, accion: 'editar', duracionMinutos: Number(campo.value) }, 'error-historial-reportes');
    });
    edicion.append(nodo('summary', 'Editar tiempo'), campo, guardar);
    const retirar = nodo('button', 'Sacar reporte', 'sacar-reporte');
    retirar.type = 'button';
    retirar.disabled = extender.disabled;
    retirar.addEventListener('click', () => publicar({ id: item.id, activa: false, accion: 'retirar' }, 'error-historial-reportes'));
    acciones.append(extender, edicion, retirar);
    tarjeta.append(acciones);
    return tarjeta;
  }

  function renderizarHistorial() {
    const sesion = obtenerSesion();
    const propios = listarHistorialIncidencias().filter(item => sesion && (item.creadoPorRol ?
      item.creadoPorRol === sesion.rolUsm : item.creadoPorNombre === sesion.nombre));
    el('lista-incidencias').replaceChildren(...propios.map(tarjetaHistorial));
    el('sin-incidencias').hidden = Boolean(propios.length);
  }

  function renderizarMarcadores() {
    if (!window.L) return;
    const avisos = listarIncidencias();
    for (const [id, mapa] of mapas) {
      if (!capas.has(id)) capas.set(id, { capa: window.L.layerGroup().addTo(mapa), marcadores: new Map() });
      const { capa, marcadores } = capas.get(id);
      const visibles = id === 'mapa-rutas' && rutasVisibles.length
        ? avisos.filter(aviso => rutasVisibles.some(ruta => incidenciaAfectaRuta(aviso, ruta))) : avisos;
      const ids = new Set(visibles.map(aviso => aviso.id));
      for (const [clave, registro] of marcadores) {
        if (!ids.has(clave)) {
          capa.removeLayer(registro.marcador);
          marcadores.delete(clave);
        }
      }
      const posiciones = new Map();
      for (const item of visibles) {
        const slot = posiciones.get(item.lugar) ?? 0;
        posiciones.set(item.lugar, slot + 1);
        const previo = marcadores.get(item.id);
        if (previo?.revision === item.revision && previo.slot === slot) continue;
        const punto = LUGARES.find(lugarCampus => lugarCampus.id === item.lugar);
        if (!punto) continue;
        const estilo = estiloReporte(item);
        const icono = nodo('span', estilo.simbolo);
        icono.setAttribute('aria-hidden', 'true');
        const icon = window.L.divIcon({
          className: 'marca-incidencia marca-reporte-' + estilo.id, html: icono, iconSize: [25, 25],
          iconAnchor: [-5 - slot % 3 * 27, 22 + Math.floor(slot / 3) * 27],
        });
        const texto = punto.nombre + ' — ' + tituloReporte(item);
        const marcador = previo?.marcador ?? window.L.marker([punto.lat, punto.lng], {
          title: texto, alt: texto, zIndexOffset: 500, icon,
        }).addTo(capa);
        if (previo) marcador.setIcon(icon).setPopupContent(contenidoReporte(item, 'div'));
        else marcador.bindPopup(contenidoReporte(item, 'div'), { maxWidth: 225 });
        marcadores.set(item.id, { marcador, slot, revision: item.revision });
      }
    }
  }

  function renderizar() {
    const lista = listarIncidencias();
    el('publicar-aviso').disabled = !servicioListo() || pendientes.has('nuevo');
    for (const id of ['avisos-campus', 'avisos-campus-resultados']) {
      const banner = el(id);
      banner.hidden = !lista.length;
      banner.querySelector('ul').replaceChildren(...lista.map(item => contenidoReporte(item)));
    }
    if (historial.open) renderizarHistorial();
    renderizarMarcadores();
  }

  function filtrarRutas(opciones, seleccion) {
    rutasVisibles = seleccion === 'all' ? opciones : opciones.filter(ruta => ruta.id === seleccion);
    renderizarMarcadores();
  }

  setInterval(() => {
    sincronizarExpiracionReportes();
    for (const reloj of document.querySelectorAll('[data-expira]')) actualizarReloj(reloj);
  }, 10000);

  return {
    renderizar, renderizarMarcadores, filtrarRutas,
    abierta: () => panel.open || historial.open,
    alCerrar(callback) {
      panel.addEventListener('close', callback);
      historial.addEventListener('close', callback);
    },
  };
}
