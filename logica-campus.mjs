import { calcularRuta } from './rutas.mjs';

export const PERFILES_USUARIO = [
  { id: 'muletas', titulo: 'Evitar escaleras', subtitulo: 'Muletas / Lesión temporal',
    evitarEscalonesLargos: true, bloqueaExteriorConLluvia: true, maxFatiga: 60, umbralAyuda: 125 },
  { id: 'fatiga', titulo: 'Minimizar fatiga', subtitulo: 'Movilidad reducida leve / Adulto mayor',
    priorizaAscensor: true, bloqueaExteriorConLluvia: false, maxFatiga: 40, umbralAyuda: 145 },
  { id: 'baja_vision', titulo: 'Guía por voz', subtitulo: 'Baja visión / Orientación',
    modoAltoContrasteSugerido: true, lecturaAutomatica: true, umbralAyuda: 90 },
  { id: 'silla_ruedas', titulo: 'Sin peldaños', subtitulo: 'Silla de ruedas (0 escalones)',
    escalonesPermitidos: 0, requiereAscensor: true, umbralAyuda: 165 },
];

export const ESTADO_CAMPUS_INICIAL = Object.freeze({
  lluviaActiva: false,
  ascensorMBloqueado: false,
  ascensorPBloqueado: false,
  pasilloABloqueado: false,
});

const perfilesMotor = {
  muletas: 'apoyo',
  fatiga: 'fatiga',
  baja_vision: 'orientacion',
  silla_ruedas: 'estricta',
};

export function crearMotorRutas(grafo) {
  return (origenId, destinoId, perfilObj, estadoCampus = ESTADO_CAMPUS_INICIAL) => {
    const ruta = calcularRuta(grafo, origenId, destinoId, perfilesMotor[perfilObj?.id], {
      lluviaIntensa: estadoCampus.lluviaActiva,
      ascensoresDetenidos: [
        ...(estadoCampus.ascensorMBloqueado ? ['ascensor-m'] : []),
        ...(estadoCampus.ascensorPBloqueado ? ['ascensor-p'] : []),
      ],
      tramosBloqueados: estadoCampus.pasilloABloqueado
        ? grafo.aristas.filter(arista => arista.acceso === 'pasillo-a').map(arista => arista.id)
        : [],
    }, perfilObj);

    // Estimación para la demo: 45 metros por minuto y un minuto por ascensor.
    const ascensores = new Set(grafo.aristas.filter(arista => arista.requiereAscensor).map(arista => arista.id));
    const esperas = ruta.pasos.filter(paso => ascensores.has(paso.tramoId)).length;
    const umbralAyuda = perfilObj.umbralAyuda
      ?? PERFILES_USUARIO.find(perfil => perfil.id === perfilObj.id).umbralAyuda;
    const superaUmbral = ruta.pesoTotal !== null && ruta.pesoTotal > umbralAyuda;
    const estado = superaUmbral && ruta.semaforo === 'verde' ? 'AMARILLO' : ruta.semaforo.toUpperCase();
    const motivoComplejidad = superaUmbral ? 'La dificultad de la ruta supera el umbral de tu perfil' : '';
    return {
      estado,
      pesoTotal: ruta.pesoTotal,
      umbralAyuda,
      recomiendaAyuda: superaUmbral || estado === 'ROJO',
      tiempoMinutos: ruta.distancia === null ? null : Math.ceil(ruta.distancia / 45 + esperas),
      tramos: ruta.pasos.map(paso => paso.tramoId),
      pasos: ruta.pasos.map(paso => paso.instruccion + ' Siguiente punto: ' + paso.hacia + '.'),
      motivoAlerta: [ruta.motivo, motivoComplejidad].filter(Boolean).join(' · '),
    };
  };
}

export function crearSolicitudAyuda({ id = globalThis.crypto.randomUUID(), origen, destino, perfil, motivoBloqueo }) {
  return {
    id, origen, destino, perfil, motivoBloqueo,
    estado: 'pendiente',
    ayudante: null,
    agradecimientoEstudiante: null,
    agradecimientoAyudante: null,
  };
}

export function aceptarSolicitud(solicitud, { nombre, rol, asistencias }) {
  if (solicitud.estado !== 'pendiente') throw new Error('La solicitud ya fue atendida');
  return { ...solicitud, estado: 'en_camino', ayudante: { nombre, rol, asistencias } };
}

export function completarSolicitud(solicitud) {
  if (solicitud.estado !== 'en_camino') throw new Error('Primero se debe aceptar la solicitud');
  return { ...solicitud, estado: 'completada' };
}

export function agradecerSolicitud(solicitud, participante, etiqueta) {
  const campos = { estudiante: 'agradecimientoEstudiante', ayudante: 'agradecimientoAyudante' };
  if (solicitud.estado !== 'completada' || !Object.hasOwn(campos, participante) || !etiqueta?.trim()) {
    throw new Error('El agradecimiento requiere una solicitud completada, un participante y una etiqueta');
  }
  return { ...solicitud, [campos[participante]]: etiqueta.trim() };
}
