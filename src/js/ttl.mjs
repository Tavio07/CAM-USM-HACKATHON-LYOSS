const respuesta = await fetch(new URL('../data/report-ttl.json', import.meta.url));
if (!respuesta.ok) throw new Error('No se pudo cargar la configuración de duración.');
export const REPORT_TTL_MINUTES = Object.freeze(await respuesta.json());
export const CATEGORIAS = {
  default: 'Otro aviso',
  aglomeracion: 'Aglomeración',
  superficie: 'Piso o superficie',
  obstaculo: 'Obstáculo',
  ascensor: 'Ascensor',
};

export function categoriaIncidencia(tipo, categoria) {
  if (tipo === 'ascensor-p') return 'ascensor';
  if (tipo === 'rampa-c') return 'obstaculo';
  if (tipo === 'acceso-humedo') return 'superficie';
  return Object.hasOwn(CATEGORIAS, categoria) ? categoria : 'default';
}

export function normalizarIncidencia(aviso, ahora = Date.now()) {
  const categoria = categoriaIncidencia(aviso.tipo, aviso.categoria);
  const fechaAnterior = Date.parse(aviso.reportadaEn);
  const creadoEn = aviso.creadoEn ?? (Number.isFinite(fechaAnterior) ? fechaAnterior : ahora);
  const duracionMinutos = aviso.duracionMinutos ?? REPORT_TTL_MINUTES[categoria];
  const expiraEn = aviso.expiraEn ?? creadoEn + duracionMinutos * 60000;
  const activa = aviso.activa ?? aviso.activo ?? true;
  return { ...aviso, categoria, creadoEn, duracionMinutos, expiraEn, activa, activo: activa,
    creadoPorRol: aviso.creadoPorRol ?? aviso.rolReportante ?? null,
    creadoPorNombre: aviso.creadoPorNombre ?? aviso.reportadaPor };
}

export function minutosValidos(minutos) {
  return Number.isSafeInteger(minutos) && minutos >= 1 && Date.now() + minutos * 60000 <= 8.64e15;
}
