import { mostrarMapa, prepararAyuda } from './mapa-ayuda.mjs';
import { crearMotorRutas, PERFILES_USUARIO } from './logica-campus.mjs';

const elemento = id => document.getElementById(id);
const origen = elemento('origen');
const destino = elemento('destino');
const perfil = elemento('perfil');
const aviso = elemento('aviso');
const resultado = elemento('resultado');
const video = elemento('video');
const escanear = elemento('escanear');
const codigo = elemento('codigo');
const enlace = elemento('enlace');
const notaQr = elemento('nota-qr');
const lienzo = document.createElement('canvas');
const dibujo = lienzo.getContext('2d', { willReadFrequently: true });
let grafo;
let calcularRuta;
let sesion;

function elegirOrigen(id) {
  if (!grafo.nodos.some(nodo => nodo.id === id)) return false;
  origen.value = id;
  origen.dispatchEvent(new Event('change'));
  aviso.textContent = 'Ubicación desde el QR: ' + origen.selectedOptions[0].text;
  return true;
}

function idDesdeQr(texto) {
  try {
    const url = new URL(texto);
    return ['https:', 'http:'].includes(url.protocol) ? url.searchParams.get('origen') : null;
  } catch {
    return null;
  }
}

function cerrarCamara() {
  sesion?.stream?.getTracks().forEach(pista => pista.stop());
  sesion = null;
  video.srcObject = null;
  elemento('camara').hidden = true;
  escanear.disabled = false;
  escanear.setAttribute('aria-expanded', 'false');
}

async function abrirCamara() {
  if (!navigator.mediaDevices?.getUserMedia || !window.jsQR || !dibujo) {
    aviso.textContent = 'El lector requiere HTTPS o localhost y conexión a internet. También puedes usar la cámara del teléfono o elegir el punto manualmente.';
    return;
  }
  const intento = {};
  sesion = intento;
  escanear.disabled = true;
  escanear.setAttribute('aria-expanded', 'true');
  elemento('camara').hidden = false;
  elemento('cerrar').focus();
  aviso.textContent = 'Apunta la cámara al código del campus.';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    if (sesion !== intento) {
      stream.getTracks().forEach(pista => pista.stop());
      return;
    }
    intento.stream = stream;
    video.srcObject = stream;
    await video.play();
    leerCuadro();
  } catch {
    if (sesion !== intento) return;
    cerrarCamara();
    escanear.focus();
    aviso.textContent = 'No se pudo abrir la cámara. Revisa el permiso o elige el origen manualmente.';
  }

  function leerCuadro() {
    if (sesion !== intento) return;
    if (video.videoWidth && video.videoHeight) {
      const escala = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      lienzo.width = Math.round(video.videoWidth * escala);
      lienzo.height = Math.round(video.videoHeight * escala);
      dibujo.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      const cuadro = dibujo.getImageData(0, 0, lienzo.width, lienzo.height);
      const qr = window.jsQR(cuadro.data, cuadro.width, cuadro.height);
      if (qr && elegirOrigen(idDesdeQr(qr.data))) {
        cerrarCamara();
        navigator.vibrate?.(80);
        destino.focus();
        return;
      }
      if (qr) aviso.textContent = 'Este código no identifica un punto disponible del campus.';
    }
    setTimeout(leerCuadro, 130);
  }
}

escanear.addEventListener('click', abrirCamara);
elemento('cerrar').addEventListener('click', () => {
  cerrarCamara();
  aviso.textContent = '';
  escanear.focus();
});
window.addEventListener('pagehide', () => { if (sesion) cerrarCamara(); });

elemento('contraste').addEventListener('click', event => {
  event.currentTarget.setAttribute('aria-pressed', String(document.body.classList.toggle('alto')));
});

elemento('ruta').addEventListener('change', () => { resultado.hidden = true; });
origen.addEventListener('change', () => {
  elemento('generar').disabled = !origen.value;
  codigo.hidden = enlace.hidden = notaQr.hidden = true;
  aviso.textContent = '';
});
elemento('generar').addEventListener('click', () => {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('origen', origen.value);
  enlace.href = url.href;
  enlace.hidden = false;
  notaQr.hidden = url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!window.QRCode) {
    aviso.textContent = 'No se pudo cargar el generador. Puedes abrir el enlace del punto.';
    return;
  }
  codigo.replaceChildren();
  new window.QRCode(codigo, { text: url.href, width: 216, height: 216 });
  codigo.hidden = false;
});

elemento('ruta').addEventListener('submit', event => {
  event.preventDefault();
  const perfilElegido = PERFILES_USUARIO.find(opcion => opcion.id === perfil.value);
  const ruta = calcularRuta(origen.value, destino.value, perfilElegido);
  const semaforo = ruta.estado.toLowerCase();
  const nombres = { verde: 'Verde · Ruta autónoma', amarillo: 'Amarillo · Precaución', rojo: 'Rojo · Ruta bloqueada' };
  const estado = elemento('estado');
  estado.textContent = nombres[semaforo];
  elemento('motivo').textContent = ruta.motivoAlerta || (ruta.pasos.length
    ? 'Tiempo aproximado: ' + ruta.tiempoMinutos + ' min.'
    : 'Ya estás en tu destino.');
  const complejidad = elemento('complejidad');
  complejidad.hidden = ruta.pesoTotal === null;
  const puntos = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
  complejidad.textContent = ruta.pesoTotal === null ? '' :
    'Dificultad: ' + puntos.format(ruta.pesoTotal) + ' puntos · Umbral de ayuda: ' + ruta.umbralAyuda;
  elemento('recomienda-ayuda').hidden = !ruta.recomiendaAyuda;
  const pasos = ruta.pasos.map(paso => {
    const item = document.createElement('li');
    item.textContent = paso;
    return item;
  });
  elemento('pasos').replaceChildren(...pasos);
  mostrarMapa(grafo, ruta, origen.value, destino.value);
  prepararAyuda(ruta.recomiendaAyuda || semaforo === 'amarillo' ? {
    origen: origen.selectedOptions[0].text,
    destino: destino.selectedOptions[0].text,
    perfil: perfilElegido.subtitulo,
    motivoBloqueo: ruta.motivoAlerta || 'Acompañamiento preventivo',
  } : null);
  resultado.dataset.estado = semaforo;
  resultado.hidden = false;
  estado.focus();
});

try {
  const respuesta = await fetch('./campus.json');
  if (!respuesta.ok) throw new Error('Grafo no disponible');
  grafo = await respuesta.json();
  calcularRuta = crearMotorRutas(grafo);
  for (const nodo of grafo.nodos) {
    origen.add(new Option(nodo.nombre, nodo.id));
    destino.add(new Option(nodo.nombre, nodo.id));
  }
  for (const { id, titulo, subtitulo } of PERFILES_USUARIO) {
    perfil.add(new Option(titulo + ' · ' + subtitulo, id));
  }

  const qr = new URL(location.href).searchParams.get('origen');
  destino.value = 'edificio-c';
  if (qr === null) {
    origen.value = 'p4';
    origen.dispatchEvent(new Event('change'));
  }
  aviso.textContent = '';
  if (qr !== null && !elegirOrigen(qr)) {
    aviso.textContent = 'El enlace indica un punto desconocido. Selecciona el origen manualmente.';
  }
  escanear.disabled = elemento('calcular').disabled = false;
} catch {
  aviso.textContent = 'No se pudieron cargar los puntos. Abre la página desde un servidor web y vuelve a intentarlo.';
}
