import { INCIDENCIAS_RAPIDAS, LUGARES } from './rutas.mjs';
import { cambiarIncidencia, listarIncidencias, sincronizarExpiracionReportes } from './solicitudes.mjs';
import { CATEGORIAS, REPORT_TTL_MINUTES } from './ttl.mjs';
import { usuarioPorRol } from './directorio.mjs';

const el = id => document.getElementById(id);
const lugares = new Map(LUGARES.map(({ id, nombre }) => [id, nombre]));
const hora = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' });

export function prepararIncidencias(obtenerSesion, servicioListo, mapas) {
  const pendientes = new Set();
  const controles = new Map();
  const form = el('publicar-incidencia');
  const categoria = el('categoria-incidencia');
  const duracion = el('duracion-incidencia');
  const capas = new Map();
  for (const [id, titulo] of Object.entries(CATEGORIAS)) categoria.add(new Option(titulo, id));
  const ajustarDuracion = () => { duracion.value = REPORT_TTL_MINUTES[categoria.value]; };
  categoria.addEventListener('change', ajustarDuracion);
  ajustarDuracion();
  for (const minutos of [5, 15, 30, 60, 120, 240]) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = minutos < 60 ? minutos + ' min' : minutos / 60 + ' h';
    boton.addEventListener('click', () => { duracion.value = minutos; });
    el('duraciones-rapidas').append(boton);
  }
  const panel = el('panel-incidencias');
  const abrir = el('abrir-incidencias');
  abrir.addEventListener('click', () => {
    if (!obtenerSesion()?.modo) return;
    panel.showModal();
    el('titulo-incidencias').focus();
  });
  el('cerrar-incidencias').addEventListener('click', () => panel.close());
  const soloMios = el('solo-mis-incidencias');
  soloMios.addEventListener('change', renderizar);
  for (const [id, nombre] of lugares) el('lugar-incidencia').add(new Option(nombre, id));
  for (const item of INCIDENCIAS_RAPIDAS) {
    const fila = document.createElement('label');
    const control = document.createElement('input');
    control.type = 'checkbox';
    control.setAttribute('role', 'switch');
    control.addEventListener('change', () => publicar({ id: item.id, activa: control.checked }));
    fila.append(control, item.descripcion);
    el('incidencias-rapidas').append(fila);
    controles.set(item.id, control);
  }

  async function publicar(datos) {
    const sesion = obtenerSesion();
    const clave = datos.id ?? 'personalizada';
    if (!sesion?.modo || !servicioListo() || pendientes.has(clave)) return false;
    pendientes.add(clave);
    renderizar();
    el('error-incidencias').textContent = '';
    try {
      await cambiarIncidencia({ ...datos, actor: { nombre: sesion.nombre, rolUsm: sesion.rolUsm } });
      el('estado-incidencias').textContent = datos.accion ? 'Tiempo actualizado.' : datos.activa ? 'Aviso publicado.' : datos.retirada ? 'Tu aviso fue retirado.' : 'Incidencia resuelta.';
      return true;
    } catch (error) {
      el('error-incidencias').textContent = error.message;
      return false;
    } finally {
      pendientes.delete(clave);
      renderizar();
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const descripcion = el('descripcion-incidencia').value.trim();
    if (!descripcion) {
      el('error-incidencias').textContent = 'Escribe una descripción para publicar el aviso.';
      return;
    }
    if (await publicar({
      lugar: el('lugar-incidencia').value, descripcion, categoria: categoria.value,
      duracionMinutos: Number(duracion.value), activa: true,
    })) {
      form.reset();
      ajustarDuracion();
    }
  });

  function autor(item) {
    return usuarioPorRol(item.creadoPorRol)?.nombreCompleto ?? item.creadoPorNombre ?? item.reportadaPor ?? 'Autor desconocido';
  }

  function actualizarRelojes() {
    for (const reloj of document.querySelectorAll('[data-expira]')) {
      const ms = Number(reloj.dataset.expira) - Date.now();
      const minutos = Math.floor(ms / 60000);
      reloj.textContent = ms <= 0 ? 'Expirado' : minutos < 1 ? 'Expira en < 1 min'
        : 'Expira en ' + (minutos >= 60 ? Math.floor(minutos / 60) + ' h ' + minutos % 60 : minutos) + ' min';
    }
  }

  function tarjeta(item, popup = false) {
    const fila = document.createElement(popup ? 'div' : 'li');
    const texto = document.createElement('p');
    texto.textContent = item.descripcion;
    const detalle = document.createElement('small');
    detalle.textContent = (lugares.get(item.lugar) ?? item.lugar) + ' · ' + autor(item) + ' · ' +
      hora.format(new Date(item.creadoEn));
    const reloj = document.createElement('small');
    reloj.dataset.expira = item.expiraEn;
    reloj.className = 'reloj-incidencia';
    fila.append(texto, detalle, reloj);
    const sesion = obtenerSesion();
    if (!sesion?.modo) return fila;
    const propia = item.creadoPorRol ? item.creadoPorRol === sesion.rolUsm : autor(item) === sesion.nombre;
    const acciones = document.createElement('div');
    acciones.className = 'acciones-tiempo';
    const extender = document.createElement('button');
    extender.type = 'button';
    extender.textContent = '+' + REPORT_TTL_MINUTES.extensionMinutos + ' min';
    extender.disabled = !servicioListo() || pendientes.has(item.id);
    extender.addEventListener('click', () => publicar({ id: item.id, accion: 'extender' }));
    const edicion = document.createElement('details');
    const titulo = document.createElement('summary');
    titulo.textContent = 'Editar tiempo';
    const campo = document.createElement('input');
    campo.type = 'number';
    campo.min = 1;
    campo.step = 1;
    campo.required = true;
    campo.setAttribute('aria-label', 'Nueva duración en minutos');
    campo.value = Math.max(1, Math.ceil((item.expiraEn - Date.now()) / 60000));
    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.textContent = 'Guardar';
    guardar.disabled = extender.disabled;
    guardar.addEventListener('click', () => {
      if (campo.reportValidity()) publicar({ id: item.id, accion: 'editar', duracionMinutos: Number(campo.value) });
    });
    edicion.append(titulo, campo, guardar);
    const retirar = document.createElement('button');
    retirar.type = 'button';
    retirar.textContent = propia ? 'Retirar mi aviso' : 'Marcar como resuelto';
    retirar.disabled = extender.disabled;
    retirar.addEventListener('click', async () => {
      if (await publicar({ id: item.id, activa: false, retirada: propia }) && !popup) soloMios.focus({ preventScroll: true });
    });
    acciones.append(extender, edicion, retirar);
    fila.append(acciones);
    return fila;
  }

  function renderizarMarcadores() {
    if (!window.L) return;
    const avisos = listarIncidencias();
    const sesion = obtenerSesion();
    const perfil = (sesion?.modo ? sesion.rolUsm : '') + ':' + servicioListo();
    for (const [id, mapa] of mapas) {
      if (!capas.has(id)) capas.set(id, { capa: window.L.layerGroup().addTo(mapa), marcadores: new Map() });
      const { capa, marcadores } = capas.get(id);
      for (const [clave, registro] of marcadores) {
        if (!avisos.some(aviso => aviso.id === clave)) {
          capa.removeLayer(registro.marcador);
          marcadores.delete(clave);
        }
      }
      for (const item of avisos) {
        const previo = marcadores.get(item.id);
        if (previo?.revision === item.revision && previo.perfil === perfil) continue;
        const lugar = LUGARES.find(punto => punto.id === item.lugar);
        if (!lugar) continue;
        const marcador = previo?.marcador ?? window.L.marker([lugar.lat, lugar.lng], {
          title: 'Incidencia: ' + item.descripcion, alt: 'Incidencia: ' + item.descripcion, zIndexOffset: 500,
          icon: window.L.divIcon({ className: 'marca-incidencia', html: '<span aria-hidden="true">!</span>', iconSize: [25, 25], iconAnchor: [-5, 22] }),
        }).addTo(capa);
        if (previo) marcador.setPopupContent(tarjeta(item, true));
        else marcador.bindPopup(tarjeta(item, true), { maxWidth: 225 }).on('popupopen', actualizarRelojes);
        marcadores.set(item.id, { marcador, revision: item.revision, perfil });
      }
    }
    actualizarRelojes();
  }

  function renderizar() {
    const lista = listarIncidencias();
    const idsActivos = new Set(lista.map(item => item.id));
    for (const [id, control] of controles) {
      control.checked = idsActivos.has(id);
      control.disabled = !servicioListo() || pendientes.has(id);
    }
    el('publicar-aviso').disabled = !servicioListo() || pendientes.has('personalizada');
    const sesion = obtenerSesion();
    const visibles = soloMios.checked ? lista.filter(item => sesion && (item.creadoPorRol ?
      item.creadoPorRol === sesion.rolUsm : autor(item) === sesion.nombre)) : lista;
    el('lista-incidencias').replaceChildren(...visibles.map(item => tarjeta(item)));
    const vacio = el('sin-incidencias');
    vacio.hidden = Boolean(visibles.length);
    vacio.textContent = soloMios.checked ? 'No tienes avisos activos.' : 'No hay incidencias activas.';

    for (const id of ['avisos-campus', 'avisos-campus-resultados']) {
      const banner = el(id);
      banner.hidden = !lista.length;
      const avisos = banner.querySelector('ul');
      avisos.replaceChildren(...lista.map(item => {
        const fila = document.createElement('li');
        fila.textContent = item.descripcion + ' — reportado por ' + autor(item);
        return fila;
      }));
    }
    renderizarMarcadores();
  }

  setInterval(() => { sincronizarExpiracionReportes(); actualizarRelojes(); }, 10000);
  return { renderizar, renderizarMarcadores, abierta: () => panel.open, alCerrar: callback => panel.addEventListener('close', callback) };
}