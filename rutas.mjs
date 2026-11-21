export const CENTRO_CAMPUS = [-33.0345, -71.5950];

export const LUGARES = [
  { id: 'entrada', nombre: 'Entrada Principal', lat: -33.03424, lng: -71.59704 },
  { id: 'edificio-a', nombre: 'Edificio A', lat: -33.03471, lng: -71.59671, pisos: [1, 2, 3] },
  { id: 'edificio-b', nombre: 'Edificio B', lat: -33.03488, lng: -71.59629, pisos: [1, 2] },
  { id: 'edificio-c', nombre: 'Edificio C', lat: -33.03527, lng: -71.59433, pisos: [1, 2, 3] },
  { id: 'edificio-p', nombre: 'Edificio P', lat: -33.03551, lng: -71.59418, pisos: [-1, 1, 2, 3, 4] },
  { id: 'entrada-placeres', nombre: 'Entrada Placeres', lat: -33.03544, lng: -71.59452 },
  { id: 'casino', nombre: 'Casino', lat: -33.03511, lng: -71.59564 },
  { id: 'biblioteca', nombre: 'Biblioteca · Edificio U', lat: -33.03492, lng: -71.59495, pisos: [1, 2, 3] },
];

export const LIMITACIONES = {
  fisicas: [
    ['sin-escaleras', 'Sin escaleras (silla de ruedas o muletas)'],
    ['fatiga', 'Fatiga o mareo'],
    ['movilidad', 'Movilidad reducida'],
    ['visibilidad', 'Baja visibilidad'],
  ],
  entorno: [
    ['lluvia', 'Lluvia'],
    ['viento', 'Viento fuerte'],
    ['poca-luz', 'Poca luz'],
  ],
};

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
  forma: [[-33.03543, -71.59426], [-33.03536, -71.59431]],
  etiquetas: ['Techada', 'Escaleras al final'],
  escaleras: 4,
  resbaladiza: true,
  oscuro: true,
  ida: ['Sigue el túnel subterráneo hasta el final.', 'Sube la escalera corta para llegar al exterior del Edificio C.'],
  vuelta: ['Baja la escalera corta frente al Edificio C.', 'Sigue el túnel hasta el piso −1 del Edificio P.'],
};
const placeres = {
  forma: [[-33.03556, -71.59435], puntos['entrada-placeres'], [-33.03536, -71.59448]],
  etiquetas: ['Al aire libre', 'Cruce de calle'],
  escaleras: 0,
  exterior: true,
  cruce: true,
  ida: ['Sal por la puerta principal del Edificio P.', 'Cruza la calle y vuelve a entrar por Entrada Placeres.', 'Gira a la derecha y sigue hasta el exterior del Edificio C.'],
  vuelta: ['Desde el Edificio C, vuelve hacia Entrada Placeres.', 'Sal por la portería y cruza hacia la puerta principal del Edificio P.'],
};

export const RUTAS_PREHECHAS = [
  { ...tunel, id: 'tunel-escalera', titulo: 'Escalera principal y túnel', desde: 'edificio-p', hasta: 'edificio-c', pisoP: -1, acceso: 'escalera', minutos: 2 },
  { ...tunel, id: 'tunel-ascensor', titulo: 'Ascensor y túnel', desde: 'edificio-p', hasta: 'edificio-c', pisoP: -1, acceso: 'ascensor', minutos: 3 },
  { ...placeres, id: 'placeres-escalera', titulo: 'Escalera y Entrada Placeres', desde: 'edificio-p', hasta: 'edificio-c', pisoP: 1, acceso: 'escalera', minutos: 3 },
  { ...placeres, id: 'placeres-ascensor', titulo: 'Ascensor y Entrada Placeres', desde: 'edificio-p', hasta: 'edificio-c', pisoP: 1, acceso: 'ascensor', minutos: 4 },
  { id: 'entrada-a', titulo: 'Escalinata principal', desde: 'entrada', hasta: 'edificio-a', forma: [[-33.03447, -71.59690]], escaleras: 34, exterior: true, pendiente: true, minutos: 3, etiquetas: ['Escaleras', 'Pendiente'], ida: ['Desde la entrada, sube la escalinata hacia el Edificio A.'], vuelta: ['Desde el Edificio A, baja por la escalinata hacia Entrada Principal.'] },
  { id: 'a-b', titulo: 'Paso entre los edificios A y B', desde: 'edificio-a', hasta: 'edificio-b', forma: [[-33.03479, -71.59647]], escaleras: 0, pendiente: true, exterior: true, minutos: 3, etiquetas: ['Pendiente', 'Al aire libre'], ida: ['Desde el acceso del Edificio A, sigue el paso exterior hacia el Edificio B.'], vuelta: ['Desde el acceso del Edificio B, vuelve por el paso exterior hacia el Edificio A.'] },
  { id: 'casino-biblioteca', titulo: 'Paso exterior a la Biblioteca', desde: 'casino', hasta: 'biblioteca', forma: [[-33.03504, -71.59536]], escaleras: 0, pendiente: true, exterior: true, minutos: 4, etiquetas: ['Pendiente', 'Al aire libre'], ida: ['Desde el Casino, toma el paso exterior hasta el acceso de la Biblioteca.'], vuelta: ['Desde la Biblioteca, sigue el paso exterior hacia el Casino.'] },
  { id: 'placeres-c', titulo: 'Portería Placeres y Edificio C', desde: 'entrada-placeres', hasta: 'edificio-c', forma: [placeres.forma[2]], escaleras: 0, exterior: true, minutos: 2, etiquetas: ['Al aire libre'], ida: [placeres.ida[2]], vuelta: ['Sigue el paso exterior hasta la portería de Entrada Placeres.'] },
];

function evaluar(ruta, escaleras, minutos, restricciones) {
  const avisos = [];
  if (escaleras && restricciones.has('sin-escaleras')) {
    return { estado: 'ROJO', motivo: 'El recorrido incluye escalones.' };
  }
  if (ruta.resbaladiza && restricciones.has('lluvia')) {
    return { estado: 'ROJO', motivo: 'El túnel y su escalera se simulan resbalosos con lluvia.' };
  }
  if (ruta.exterior && restricciones.has('lluvia')) avisos.push('Tramos expuestos a lluvia');
  if (ruta.exterior && restricciones.has('viento')) avisos.push('Tramos expuestos a viento fuerte');
  if ((ruta.oscuro || ruta.exterior) && restricciones.has('poca-luz')) avisos.push('Visibilidad reducida en el recorrido');
  if (restricciones.has('visibilidad') && (ruta.oscuro || ruta.cruce || escaleras)) avisos.push('El trayecto exige atención al cruce, al túnel o a los escalones');
  if (restricciones.has('fatiga') && (escaleras || ruta.pendiente || minutos >= 4)) avisos.push('Recorrido de mayor esfuerzo o duración');
  if (restricciones.has('movilidad') && (escaleras || ruta.pendiente)) avisos.push('Escalones o pendiente que dificultan el desplazamiento');
  return { estado: avisos.length ? 'AMARILLO' : 'VERDE', motivo: avisos.join(' · ') };
}

export function buscarRutas(origen, destino, limitaciones) {
  if (origen.id === destino.id && origen.piso === destino.piso) return [];
  const restricciones = new Set(limitaciones);
  const opciones = [];

  for (const ruta of RUTAS_PREHECHAS) {
    const ida = ruta.desde === origen.id && ruta.hasta === destino.id;
    if (!ida && !(ruta.hasta === origen.id && ruta.desde === destino.id)) continue;
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
    opciones.push({
      id: ruta.id,
      titulo: diferencia || ruta.pisoP === undefined ? ruta.titulo : ruta.pisoP === -1 ? 'Túnel subterráneo' : 'Entrada Placeres',
      minutos,
      etiquetas: [...new Set([...ruta.etiquetas, ...(usaAscensor ? ['Con ascensor'] : []), ...(escaleras ? ['Escaleras'] : [])])],
      pasos: ida ? [cambio, ...ruta.ida].filter(Boolean) : [...ruta.vuelta, cambio].filter(Boolean),
      trazado: ida ? trazado : trazado.reverse(),
      variante: ruta.acceso,
      ...evaluar(ruta, escaleras, minutos, restricciones),
    });
  }

  const prioridad = { VERDE: 0, AMARILLO: 1, ROJO: 2 };
  return opciones.sort((a, b) => prioridad[a.estado] - prioridad[b.estado] || a.minutos - b.minutos);
}
