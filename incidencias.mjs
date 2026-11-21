import { INCIDENCIAS_RAPIDAS, LUGARES } from './rutas.mjs';
import { cambiarIncidencia, listarIncidencias } from './solicitudes.mjs';

const el = id => document.getElementById(id);
const lugares = new Map(LUGARES.map(({ id, nombre }) => [id, nombre]));
const hora = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' });

export function prepararIncidencias(obtenerSesion, servicioListo) {
  const pendientes = new Set();
  const controles = new Map();
  const form = el('publicar-incidencia');
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
    if (sesion?.modo !== 'ayudante' || !servicioListo() || pendientes.has(clave)) return false;
    pendientes.add(clave);
    renderizar();
    el('error-incidencias').textContent = '';
    try {
      await cambiarIncidencia({ ...datos, actor: { nombre: sesion.nombre, rolUsm: sesion.rolUsm } });
      el('estado-incidencias').textContent = datos.activa ? 'Aviso publicado.' : 'Incidencia resuelta.';
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
    if (await publicar({ lugar: el('lugar-incidencia').value, descripcion, activa: true })) form.reset();
  });

  function renderizar() {
    const lista = listarIncidencias();
    const idsActivos = new Set(lista.map(item => item.id));
    for (const [id, control] of controles) {
      control.checked = idsActivos.has(id);
      control.disabled = !servicioListo() || pendientes.has(id);
    }
    el('publicar-aviso').disabled = !servicioListo() || pendientes.has('personalizada');
    el('lista-incidencias').replaceChildren(...lista.map(item => {
      const fila = document.createElement('li');
      const texto = document.createElement('p');
      texto.textContent = item.descripcion;
      const detalle = document.createElement('small');
      detalle.textContent = (lugares.get(item.lugar) ?? item.lugar) + ' · ' + item.reportadaPor + ' · ' +
        hora.format(new Date(item.reportadaEn));
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = 'Marcar como resuelto';
      boton.disabled = !servicioListo() || pendientes.has(item.id);
      boton.addEventListener('click', () => publicar({ id: item.id, activa: false }));
      fila.append(texto, detalle, boton);
      return fila;
    }));
    el('sin-incidencias').hidden = Boolean(lista.length);

    for (const id of ['avisos-campus', 'avisos-campus-resultados']) {
      const banner = el(id);
      banner.hidden = !lista.length;
      const avisos = banner.querySelector('ul');
      avisos.replaceChildren(...lista.map(item => {
        const fila = document.createElement('li');
        fila.textContent = item.descripcion + ' — reportado por ' + item.reportadaPor;
        return fila;
      }));
    }
  }

  return renderizar;
}
