export const perfiles = Object.freeze({
  apoyo: 'Lesión temporal / Apoyo',
  fatiga: 'Movilidad de bajo impacto / Fatiga',
  orientacion: 'Baja visión u orientación espacial',
  estricta: 'Movilidad reducida estricta',
});

function evaluar(tramo, perfil, estado, opciones) {
  const { distancia, escalones, pendiente: pendienteOriginal, esTechado, requiereAscensor } = tramo;
  const pendiente = ({ baja: 2, media: 5, alta: 9 })[pendienteOriginal] ?? pendienteOriginal;
  if (estado.tramosBloqueados?.includes(tramo.id)) return { bloqueo: tramo.acceso === 'pasillo-a' ? 'Pasillo A bloqueado' : 'Tramo cerrado' };
  if (requiereAscensor && estado.ascensoresDetenidos?.includes(requiereAscensor)) {
    const nombre = requiereAscensor === 'ascensor-p' ? 'Ascensor P' : 'Ascensor M';
    return { bloqueo: nombre + ' en mantención' };
  }
  if ((opciones.escalonesPermitidos ?? (perfil === 'estricta' ? 0 : Infinity)) < escalones) return { bloqueo: 'Escalones incompatibles con el perfil' };
  if ((opciones.evitarEscalonesLargos ?? (perfil === 'apoyo')) && escalones > 20) return { bloqueo: 'Escalera larga' };
  const riesgoLluvia = tramo.riesgoLluvia ?? (esTechado ? 'ninguno' : 'alto');
  const mojado = riesgoLluvia !== 'ninguno' && (estado.lluviaIntensa || estado.pisoMojado);
  const avisoLluvia = tramo.avisoLluvia ?? (esTechado ? 'Escalera resbalosa por lluvia' : 'Pavimento exterior mojado');
  if (mojado && riesgoLluvia === 'alto' && estado.lluviaIntensa
      && (opciones.bloqueaExteriorConLluvia ?? (perfil === 'apoyo'))) {
    return { bloqueo: esTechado ? avisoLluvia : 'Tramo descubierto bajo lluvia intensa' };
  }

  const esfuerzo = escalones * 3 + distancia * pendiente / 10;
  const penalizacionLluvia = riesgoLluvia === 'alto' ? distancia * 3 : distancia * 0.5;
  let costo = distancia + (mojado ? penalizacionLluvia : 0);
  const avisos = [];
  if (opciones.priorizaAscensor) costo += escalones * 2;
  if (requiereAscensor) costo += 45;
  // El cambio de piso pesa más por escalera que por ascensor.
  costo += (tramo.pisosRecorridos ?? 0) * (escalones > 0 ? 2 : 1);
  if (mojado) avisos.push(avisoLluvia);
  if (perfil === 'apoyo' || perfil === 'fatiga') {
    costo += esfuerzo * 2 * (tramo.pasamanos ? 0.75 : 1);
    if (escalones >= 8 || pendiente >= 5) avisos.push('Esfuerzo elevado en el tramo');
  }
  if (perfil === 'orientacion') {
    costo += (tramo.iluminado ? 0 : 60) + (tramo.esSimple ? 0 : 40);
    if (!tramo.iluminado || !tramo.esSimple) avisos.push('Tramo con orientación más difícil');
  }
  return { costo, avisos, esfuerzo };
}

export function calcularRuta(grafo, origen, destino, perfil, estado = {}, opciones = {}) {
  const nodos = new Map(grafo.nodos.map(nodo => [nodo.id, nodo.nombre]));
  if (!nodos.has(origen) || !nodos.has(destino)) throw new RangeError('Origen o destino desconocido');
  if (!Object.hasOwn(perfiles, perfil)) throw new RangeError('Perfil desconocido');

  const vecinos = new Map([...nodos.keys()].map(id => [id, []]));
  for (const tramo of grafo.aristas) {
    const evaluacion = evaluar(tramo, perfil, estado, opciones);
    vecinos.get(tramo.origen).push({ tramo, hacia: tramo.destino, ...evaluacion });
    vecinos.get(tramo.destino).push({ tramo, hacia: tramo.origen, ...evaluacion });
  }

  // Primero busca una ruta viable. Si falla, identifica los bloqueos en un recorrido
  // diagnóstico que minimiza la cantidad de tramos bloqueados.
  function buscar(diagnostico = false) {
    const pendientes = new Set(nodos.keys());
    const costos = new Map([[origen, { bloqueos: 0, peso: 0 }]]);
    const anteriores = new Map();
    function menor(a, b) {
      return a && (!b || a.bloqueos < b.bloqueos || (a.bloqueos === b.bloqueos && a.peso < b.peso));
    }
    while (pendientes.size) {
      let actual;
      for (const id of pendientes) {
        if (menor(costos.get(id), costos.get(actual))) actual = id;
      }
      if (actual === undefined) return null;
      if (actual === destino) {
        const pasos = [];
        for (let id = destino; id !== origen;) {
          const paso = anteriores.get(id);
          pasos.push(paso);
          id = paso.desde;
        }
        return pasos.reverse();
      }
      pendientes.delete(actual);
      for (const paso of vecinos.get(actual)) {
        if (!pendientes.has(paso.hacia) || (paso.bloqueo && !diagnostico)) continue;
        const previo = costos.get(actual);
        const candidato = {
          bloqueos: previo.bloqueos + Number(Boolean(paso.bloqueo)),
          peso: previo.peso + (paso.costo ?? paso.tramo.distancia),
        };
        if (menor(candidato, costos.get(paso.hacia))) {
          costos.set(paso.hacia, candidato);
          anteriores.set(paso.hacia, { ...paso, desde: actual });
        }
      }
    }
    return null;
  }

  const ruta = buscar();
  if (!ruta) {
    const bloqueos = (buscar(true) ?? []).filter(paso => paso.bloqueo).map(paso => ({
      tramoId: paso.tramo.id,
      motivo: paso.bloqueo,
      desde: nodos.get(paso.desde),
      hacia: nodos.get(paso.hacia),
    }));
    return {
      semaforo: 'rojo',
      pasos: [],
      distancia: null,
      pesoTotal: null,
      motivo: bloqueos.map(paso => paso.motivo).filter((motivo, i, todos) => todos.indexOf(motivo) === i).join(' · ')
        || 'No hay conexión registrada entre estos puntos',
      bloqueos,
    };
  }

  const avisos = new Set(ruta.flatMap(paso => paso.avisos));
  const maxFatiga = opciones.maxFatiga ?? (perfil === 'fatiga' ? 40 : Infinity);
  if (ruta.reduce((total, paso) => total + paso.esfuerzo, 0) >= maxFatiga) {
    avisos.add('Esfuerzo acumulado elevado');
  }
  return {
    semaforo: avisos.size ? 'amarillo' : 'verde',
    pasos: ruta.map(paso => ({
      tramoId: paso.tramo.id,
      desde: nodos.get(paso.desde),
      hacia: nodos.get(paso.hacia),
      instruccion: paso.desde === paso.tramo.origen
        ? paso.tramo.instruccionHumana
        : paso.tramo.instruccionRegreso ?? `Recorre el tramo en sentido inverso hacia ${nodos.get(paso.hacia)}.`,
    })),
    pesoTotal: ruta.reduce((total, paso) => total + paso.costo, 0),
    distancia: ruta.reduce((total, paso) => total + paso.tramo.distancia, 0),
    motivo: [...avisos].join(' · '),
    bloqueos: [],
  };
}

