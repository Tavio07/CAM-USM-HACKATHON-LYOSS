import { tituloReporte } from './ttl.mjs';

export const CENTRO_CAMPUS = [-33.0345, -71.5950];

export const LUGARES = [
  { id: 'entrada', nombre: 'Entrada Principal', lat: -33.034237, lng: -71.595714 },
  { id: 'edificio-a', nombre: 'Edificio A', lat: -33.034815, lng: -71.595569, pisos: [1, 2, 3] },
  { id: 'edificio-b', nombre: 'Edificio B · Sector piscina', lat: -33.03556, lng: -71.59532, pisos: [1, 2] },
  { id: 'edificio-c', nombre: 'Edificio C', lat: -33.036256, lng: -71.594543, pisos: [1, 2, 3] },
  { id: 'edificio-p', nombre: 'Edificio P', lat: -33.036857, lng: -71.594280, pisos: [-1, 1, 2, 3, 4] },
  { id: 'entrada-placeres', nombre: 'Entrada Placeres', lat: -33.036601, lng: -71.595232 },
  { id: 'casino', nombre: 'Casino', lat: -33.035475, lng: -71.596091 },
  { id: 'biblioteca', nombre: 'Biblioteca · Edificio U', lat: -33.034954, lng: -71.595094, pisos: [1, 2, 3] },
];

export const LIMITACIONES = {
  fisicas: [
    ['sin-escaleras', 'Sin escaleras (silla de ruedas o muletas)'],
    ['fatiga', 'Fatiga o mareo'],
    ['movilidad', 'Movilidad reducida'],
    ['visibilidad', 'Baja visibilidad'],
  ],
  neuro: [
    ['menos-estimulos', 'Menos estímulos · Reducir exposición al tránsito'],
    ['recorrido-simple', 'Recorrido predecible · Menos cambios y cruces'],
    ['orientacion-clara', 'Orientación clara · Evitar tramos oscuros'],
  ],
  entorno: [
    ['lluvia', 'Lluvia'],
    ['viento', 'Viento fuerte'],
    ['poca-luz', 'Poca luz'],
  ],
};

export const INCIDENCIAS_RAPIDAS = [
  { id: 'ascensor-p', lugar: 'edificio-p', descripcion: 'Ascensor Edificio P fuera de servicio' },
  { id: 'rampa-c', lugar: 'edificio-c', descripcion: 'Rampa Edificio C bloqueada' },
  { id: 'acceso-humedo', lugar: 'entrada-placeres', descripcion: 'Acceso húmedo / resbaloso' },
];

export const ORIGENES_QR = {
  p4: ['edificio-p', 4],
  p1: ['edificio-p', 1],
  'p-subsuelo': ['edificio-p', -1],
  'salida-p': ['edificio-p', 1],
  'hall-a': ['edificio-a', 1],
  a101: ['edificio-a', 1],
  'acceso-b': ['biblioteca', 1],
};

const puntos = Object.fromEntries(LUGARES.map(lugar => [lugar.id, [lugar.lat, lugar.lng]]));
const tunel = {
  forma: [[-33.036644, -71.594450], [-33.036438, -71.594484]],
  etiquetas: ['Techada', 'Escaleras al final'],
  escaleras: 4,
  resbaladiza: true,
  oscuro: true,
  ida: ['Sigue el túnel subterráneo hasta el final.', 'Sube la escalera corta para llegar al exterior del Edificio C.'],
  vuelta: ['Baja la escalera corta frente al Edificio C.', 'Sigue el túnel hasta el piso −1 del Edificio P.'],
};
const placeres = {
  forma: [[-33.036710, -71.594790], [-33.036584, -71.594844], puntos['entrada-placeres'], [-33.036485, -71.595174], [-33.036309, -71.594515]],
  etiquetas: ['Al aire libre', 'Cruce de calle'],
  escaleras: 0,
  exterior: true,
  cruce: true,
  rampaC: true,
  viaPlaceres: true,
  ida: ['Sal por la puerta principal del Edificio P.', 'Cruza la calle y vuelve a entrar por Entrada Placeres.', 'Gira a la derecha y sigue hasta el exterior del Edificio C.'],
  vuelta: ['Desde el Edificio C, vuelve hacia Entrada Placeres.', 'Sal por la portería y cruza hacia la puerta principal del Edificio P.'],
};

const escaleraHallC = [-33.036071, -71.594703, 'Mini escalera del Hall C'];
const ciac = [-33.036178, -71.595574, 'CIAC'];
const patio = [-33.035474, -71.595779, 'Patio Central'];
const kiosco = [-33.035381, -71.595604, 'Paso detrás del kiosco'];
const gimnasio = [-33.035230, -71.595402, 'Gimnasio 1'];
const piscina = [-33.035572, -71.595195, 'Acceso a la piscina'];
const vestidores = [-33.035396, -71.595176, 'Vestidores'];
const granArbol = [-33.035618, -71.594918, 'Plaza del Gran Árbol'];
const tramoCentral = [
  'Avanza hacia el mar hasta el Patio Central.',
  'Frente al Aula Magna, entra por detrás del kiosco, junto al pañol de deportes y la sala de ocio.',
  'Sigue el pasillo junto al Gimnasio 1 hasta la Biblioteca.',
];
const retornoCentral = [
  'Desde la Biblioteca, toma el pasillo junto al Gimnasio 1.',
  'Pasa detrás del kiosco y cruza el Patio Central hacia el CIAC.',
];
const alternativasBiblioteca = [
  {
    numero: 1, id: 'c-biblioteca-ciac', titulo: 'Ruta 1 · CIAC y Patio Central',
    hitos: [escaleraHallC, ciac, patio, kiosco, gimnasio],
    escaleras: 4, minutos: 7, etiquetas: ['Mini escaleras', 'Patio exterior', 'Pasillo junto al Gimnasio 1'],
    ida: ['Desde el Hall C, avanza hacia el mar y baja la mini escalera.', 'Gira a la izquierda hasta el CIAC.', ...tramoCentral],
    vuelta: [...retornoCentral, 'Desde el CIAC, vuelve a la mini escalera del Hall C y súbela.'],
  },
  {
    numero: 2, id: 'c-biblioteca-piscina', titulo: 'Ruta 2 · Piscina y vestidores',
    hitos: [escaleraHallC, piscina, vestidores], lugaresIntermedios: ['edificio-b'],
    escaleras: 28, minutos: 4, fatigaAlta: true, oscuro: true,
    etiquetas: ['Varios tramos de escaleras', 'Ruta directa', 'Vestidores'],
    ida: ['Desde el Hall C, avanza hacia el mar y baja la mini escalera.', 'Sigue derecho y toma las escaleras de la puerta hacia la piscina.',
      'Avanza hasta los vestidores y baja la escalera de ese sector.', 'Gira a la derecha en el pasillo y sigue hasta la Biblioteca.'],
    vuelta: ['Desde la Biblioteca, vuelve por el pasillo hasta la escalera de los vestidores.', 'Sube junto a los vestidores y vuelve al acceso de la piscina.',
      'Toma las escaleras del acceso y sube la mini escalera para regresar al Hall C.'],
  },
  {
    numero: 3, id: 'c-biblioteca-arbol', titulo: 'Ruta 3 · Plaza del Gran Árbol',
    hitos: [escaleraHallC, granArbol, [-33.035380, -71.594941, 'Escaleras de la plaza'], [-33.035102, -71.595018, 'Exterior de la Biblioteca']],
    escaleras: 16, minutos: 5, etiquetas: ['Mini escaleras sucesivas', 'Plaza al aire libre'],
    ida: ['Desde el Hall C, avanza hacia el mar y baja la mini escalera.', 'Gira a la derecha hasta la plaza del Gran Árbol.',
      'Baja una mini escalera y sigue recto por las otras dos.', 'Gira a la derecha para quedar frente a la Biblioteca.'],
    vuelta: ['Desde la Biblioteca, dirígete a las escaleras de la plaza y sube los tres tramos.', 'Pasa por el Gran Árbol y vuelve hacia el Hall C.',
      'Sube la mini escalera para regresar al hall.'],
  },
  {
    numero: 4, id: 'c-biblioteca-placeres', titulo: 'Ruta 4 · Entrada Placeres y CIAC',
    hitos: [[-33.036309, -71.594515, 'Salida del Edificio C'], [...puntos['entrada-placeres'], 'Entrada Placeres'],
      ciac, patio, kiosco, gimnasio],
    escaleras: 0, pendiente: true, rampaC: true, viaPlaceres: true, minutos: 9,
    etiquetas: ['Evita la escalera inicial', 'Bajada exterior', 'Accesibilidad por confirmar'],
    ida: ['Desde el Hall C, vuelve hacia la salida que da al Edificio P.', 'Al salir, gira a la derecha y avanza hasta Entrada Placeres.',
      'Baja por el acceso hacia el CIAC.', ...tramoCentral],
    vuelta: [...retornoCentral, 'Sube desde el CIAC hasta Entrada Placeres.',
      'Sigue hacia la salida del Edificio C frente al P y entra al hall.'],
  },
].map(ruta => ({ ...ruta, desde: 'edificio-c', hasta: 'biblioteca', exterior: true,
  forma: ruta.hitos.map(([lat, lng]) => [lat, lng]) }));

export const RUTAS_PREHECHAS = [
  ...alternativasBiblioteca,
  { ...tunel, id: 'tunel-escalera', titulo: 'Escalera principal y túnel', desde: 'edificio-p', hasta: 'edificio-c', pisoP: -1, acceso: 'escalera', minutos: 2 },
  { ...tunel, id: 'tunel-ascensor', titulo: 'Ascensor y túnel', desde: 'edificio-p', hasta: 'edificio-c', pisoP: -1, acceso: 'ascensor', minutos: 3 },
  { ...placeres, id: 'placeres-escalera', titulo: 'Escalera y Entrada Placeres', desde: 'edificio-p', hasta: 'edificio-c', pisoP: 1, acceso: 'escalera', minutos: 3 },
  { ...placeres, id: 'placeres-ascensor', titulo: 'Ascensor y Entrada Placeres', desde: 'edificio-p', hasta: 'edificio-c', pisoP: 1, acceso: 'ascensor', minutos: 4 },
  { id: 'entrada-a', titulo: 'Escalinata principal', desde: 'entrada', hasta: 'edificio-a', forma: [[-33.034446, -71.595724], [-33.034681, -71.595626]], escaleras: 34, exterior: true, pendiente: true, minutos: 3, etiquetas: ['Escaleras', 'Pendiente'], ida: ['Desde la entrada, sube la escalinata hacia el Edificio A.'], vuelta: ['Desde el Edificio A, baja por la escalinata hacia Entrada Principal.'] },
  { id: 'a-b', titulo: 'Paso entre los edificios A y B', desde: 'edificio-a', hasta: 'edificio-b', forma: [[-33.035156, -71.595598], [-33.035364, -71.595446]], escaleras: 0, pendiente: true, exterior: true, minutos: 3, etiquetas: ['Pendiente', 'Al aire libre'], ida: ['Desde el acceso del Edificio A, sigue el paso exterior hacia el Edificio B.'], vuelta: ['Desde el acceso del Edificio B, vuelve por el paso exterior hacia el Edificio A.'] },
  { id: 'casino-biblioteca', titulo: 'Paso exterior a la Biblioteca', desde: 'casino', hasta: 'biblioteca', forma: [[-33.035387, -71.595834], [-33.035142, -71.595535]], escaleras: 0, pendiente: true, exterior: true, minutos: 4, etiquetas: ['Pendiente', 'Al aire libre'], ida: ['Desde el Casino, toma el paso exterior hasta el acceso de la Biblioteca.'], vuelta: ['Desde la Biblioteca, sigue el paso exterior hacia el Casino.'] },
  { id: 'placeres-c', titulo: 'Portería Placeres y Edificio C', desde: 'entrada-placeres', hasta: 'edificio-c', forma: placeres.forma.slice(3), rampaC: true, viaPlaceres: true, escaleras: 0, exterior: true, minutos: 2, etiquetas: ['Al aire libre'], ida: [placeres.ida[2]], vuelta: ['Sigue el paso exterior hasta la portería de Entrada Placeres.'] },
];

const conexiones = new Map();
for (const ruta of RUTAS_PREHECHAS) {
  for (const [origen, destino] of [[ruta.desde, ruta.hasta], [ruta.hasta, ruta.desde]]) {
    const clave = origen + ':' + destino;
    if (!conexiones.has(clave)) conexiones.set(clave, []);
    conexiones.get(clave).push(ruta);
  }
}

function evaluar(ruta, escaleras, minutos, restricciones) {
  const avisos = [];
  if (escaleras && restricciones.has('sin-escaleras')) {
    return { estado: 'ROJO', motivo: 'El recorrido incluye escalones.' };
  }
  if (ruta.fatigaAlta && restricciones.has('fatiga')) {
    return { estado: 'ROJO', motivo: 'Las escaleras de la piscina y los vestidores exigen esfuerzo alto.' };
  }
  if (ruta.resbaladiza && restricciones.has('lluvia')) {
    return { estado: 'ROJO', motivo: 'El túnel y su escalera se simulan resbalosos con lluvia.' };
  }
  if (ruta.exterior && restricciones.has('lluvia')) avisos.push('Tramos expuestos a lluvia');
  if (ruta.exterior && restricciones.has('viento')) avisos.push('Tramos expuestos a viento fuerte');
  if ((ruta.oscuro || ruta.exterior) && restricciones.has('poca-luz')) avisos.push('Visibilidad reducida en el recorrido');
  if (restricciones.has('visibilidad') && (ruta.oscuro || ruta.cruce || escaleras)) avisos.push('El trayecto exige atención al cruce, al túnel o a los escalones');
  if (restricciones.has('fatiga') && (escaleras || ruta.pendiente || minutos >= 4)) avisos.push('Recorrido de mayor esfuerzo o duración');
  if (restricciones.has('sin-escaleras') && ruta.pendiente && ruta.numero === 4) avisos.push('Confirma en terreno la continuidad sin peldaños de la bajada por Placeres');
  if (restricciones.has('movilidad') && (escaleras || ruta.pendiente)) avisos.push('Escalones o pendiente que dificultan el desplazamiento');
  if (restricciones.has('menos-estimulos') && ruta.cruce) avisos.push('Cruce vehicular con posibles estímulos intensos');
  if (restricciones.has('recorrido-simple') && (ruta.cruce || ruta.ida.length > 2)) avisos.push('El recorrido tiene cruces o varios cambios de dirección');
  if (restricciones.has('orientacion-clara') && ruta.oscuro) avisos.push('Hay un tramo con poca luz para orientarse');
  return { estado: avisos.length ? 'AMARILLO' : 'VERDE', motivo: avisos.join(' · '), penalizacion: 2 * avisos.length };
}

export function incidenciaAfectaRuta(aviso, ruta) {
  return ruta.lugaresIncidencia.includes(aviso.lugar) &&
    (aviso.tipo !== 'ascensor-p' || ruta.usaAscensor) &&
    (aviso.tipo !== 'rampa-c' || ruta.rampaC);
}

function conIncidencias(ruta, restricciones, base, incidencias) {
  let estado = base.estado;
  let penalizacion = base.penalizacion ?? 0;
  const motivos = base.motivo ? [base.motivo] : [];
  for (const aviso of incidencias) {
    if (!aviso.activa) continue;
    if (!incidenciaAfectaRuta(aviso, ruta)) continue;
    if (aviso.tipo === 'ascensor-p' || (aviso.tipo === 'rampa-c' &&
        (restricciones.has('sin-escaleras') || restricciones.has('movilidad')))) {
      estado = 'ROJO';
    } else if (estado === 'VERDE') {
      estado = 'AMARILLO';
    }
    const lugar = LUGARES.find(punto => punto.id === aviso.lugar)?.nombre ?? aviso.lugar;
    motivos.push(lugar + ' — ' + tituloReporte(aviso));
    penalizacion += 3;
  }
  return { estado, motivo: [...new Set(motivos)].join(' · '), penalizacion };
}

export function buscarRutas(origen, destino, limitaciones, incidencias = []) {
  if (origen.id === destino.id && origen.piso === destino.piso) return [];
  const restricciones = new Set(limitaciones);
  const opciones = [];

  for (const ruta of conexiones.get(origen.id + ':' + destino.id) ?? []) {
    const ida = ruta.desde === origen.id;
    const salida = ida ? origen : destino;
    const llegada = ida ? destino : origen;
    if ((llegada.piso ?? 1) !== 1 || (ruta.pisoP === undefined && (salida.piso ?? 1) !== 1)) continue;

    const diferencia = ruta.pisoP === undefined ? 0 : Math.abs((salida.piso ?? 1) - ruta.pisoP);
    if (!diferencia && ruta.acceso === 'ascensor') continue;
    const usaAscensor = diferencia > 0 && ruta.acceso === 'ascensor';
    const escaleras = ruta.escaleras + (diferencia && !usaAscensor ? diferencia * 16 : 0);
    const cambio = diferencia ? (usaAscensor ? 'Toma el ascensor' : 'Usa la escalera') +
      ' del Edificio P hasta el piso ' + (ida ? ruta.pisoP : salida.piso) + '.' : '';
    const minutos = Math.max(1, ruta.minutos - (!diferencia && ruta.pisoP !== undefined ? 1 : 0));
    const trazado = [puntos[ruta.desde], ...ruta.forma, puntos[ruta.hasta]];
    const contexto = { usaAscensor, rampaC: Boolean(ruta.rampaC), lugaresIncidencia: [ruta.desde, ruta.hasta,
      ...(ruta.viaPlaceres ? ['entrada-placeres'] : []), ...(ruta.lugaresIntermedios ?? [])] };
    const estado = conIncidencias(contexto, restricciones,
      evaluar(ruta, escaleras, minutos, restricciones), incidencias);
    const peso = estado.estado === 'ROJO' ? null : minutos + Math.ceil(escaleras / 16) + estado.penalizacion;
    opciones.push({
      ...contexto,
      id: ruta.id,
      numero: ruta.numero,
      hitos: ruta.hitos ?? [],
      titulo: diferencia || ruta.pisoP === undefined ? ruta.titulo : ruta.pisoP === -1 ? 'Túnel subterráneo' : 'Entrada Placeres',
      minutos,
      etiquetas: [...new Set([...ruta.etiquetas, ...(usaAscensor ? ['Con ascensor'] : []), ...(escaleras ? ['Escaleras'] : [])])],
      pasos: ida ? [cambio, ...ruta.ida].filter(Boolean) : [...ruta.vuelta, cambio].filter(Boolean),
      trazado: ida ? trazado : trazado.reverse(),
      variante: ruta.acceso,
      peso,
      estado: estado.estado,
      motivo: estado.motivo,
    });
  }

  const prioridad = { VERDE: 0, AMARILLO: 1, ROJO: 2 };
  return opciones.sort((a, b) => prioridad[a.estado] - prioridad[b.estado] || (a.peso ?? Infinity) - (b.peso ?? Infinity) || a.minutos - b.minutos);
}