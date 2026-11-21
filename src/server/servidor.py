import argparse
import json
import mimetypes
import re
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit
from uuid import UUID

ROOT = Path(__file__).resolve().parents[2]
ARCHIVOS = {
    "/": "index.html", "/index.html": "index.html", "/ayudante": "index.html",
    "/src/js/mapa-rutas.mjs": "src/js/mapa-rutas.mjs",
    "/src/js/app.mjs": "src/js/app.mjs", "/src/js/solicitudes.mjs": "src/js/solicitudes.mjs",
    "/src/js/ttl.mjs": "src/js/ttl.mjs", "/src/data/report-ttl.json": "src/data/report-ttl.json",
    "/src/js/directorio.mjs": "src/js/directorio.mjs", "/src/data/directorio-usm.json": "src/data/directorio-usm.json",
    "/src/js/incidencias.mjs": "src/js/incidencias.mjs", "/src/js/cuenta.mjs": "src/js/cuenta.mjs", "/src/js/rutas.mjs": "src/js/rutas.mjs", "/src/styles/campus.css": "src/styles/campus.css", "/src/assets/logo-usm.png": "src/assets/logo-usm.png",
}
API = "/api/solicitudes"
API_LOGIN = "/api/login"
DIRECTORIO = {usuario["rol"]: usuario for usuario in json.loads((ROOT / "src/data/directorio-usm.json").read_text(encoding="utf-8"))}
SOLICITUDES = {}
INCIDENCIAS = {}
API_INCIDENCIAS = '/api/incidencias'
REPORT_TTL_MINUTES = json.loads((ROOT / 'src/data/report-ttl.json').read_text(encoding='utf-8'))
LUGARES = {'entrada', 'edificio-a', 'edificio-b', 'edificio-c', 'edificio-p', 'entrada-placeres', 'casino', 'biblioteca'}
RAPIDAS = {
    'ascensor-p': ('edificio-p', 'Ascensor Edificio P fuera de servicio'),
    'rampa-c': ('edificio-c', 'Rampa Edificio C bloqueada'),
    'acceso-humedo': ('entrada-placeres', 'Acceso húmedo / resbaloso'),
}
CANDADO = Lock()
ARCHIVO_ESTADO = None

TRANSICIONES = {
    "aceptar": ("pendiente", "aceptada"),
    "rechazar": ("pendiente", "rechazada"),
    "cancelar": ("pendiente", "rechazada"),
    "finalizar": ("aceptada", "pendiente_confirmacion"),
    "confirmar": ("pendiente_confirmacion", "pendiente_confirmacion"),
    "calificar": ("pendiente_confirmacion", "completada"),
}
ETIQUETAS_CALIFICACION = ("Amable", "Paciente", "Puntual")


def guardar(ident, registro, incidencia=False):
    destino = INCIDENCIAS if incidencia else SOLICITUDES
    if ARCHIVO_ESTADO is not None:
        temporal = ARCHIVO_ESTADO.with_suffix(ARCHIVO_ESTADO.suffix + ".tmp")
        estado = {"solicitudes": SOLICITUDES, "incidencias": INCIDENCIAS}
        campo = "incidencias" if incidencia else "solicitudes"
        estado[campo] = {**destino, ident: registro}
        temporal.write_text(json.dumps(estado, ensure_ascii=False), encoding="utf-8")
        temporal.replace(ARCHIVO_ESTADO)
    destino[ident] = registro


def ahora_ms():
    return time.time_ns() // 1_000_000


def categoria_incidencia(tipo, categoria):
    rapidas = {"ascensor-p": "ascensor", "rampa-c": "obstaculo", "acceso-humedo": "superficie"}
    if tipo in rapidas:
        return rapidas[tipo]
    return categoria if isinstance(categoria, str) and categoria in REPORT_TTL_MINUTES and categoria != "extensionMinutos" else "default"


def normalizar_incidencia(aviso, ahora):
    categoria = categoria_incidencia(aviso.get("tipo"), aviso.get("categoria"))
    creado = aviso.get("creadoEn")
    if creado is None:
        try:
            creado = int(datetime.fromisoformat(aviso.get("reportadaEn", "")).timestamp() * 1000)
        except (ValueError, TypeError):
            creado = ahora
    duracion = aviso.get("duracionMinutos", REPORT_TTL_MINUTES[categoria])
    expira = aviso.get("expiraEn", creado + duracion * 60000)
    activa = aviso.get("activa", aviso.get("activo", True))
    return {**aviso, "categoria": categoria, "creadoEn": creado, "duracionMinutos": duracion,
            "expiraEn": expira, "activo": activa, "activa": activa,
            "creadoPorNombre": aviso.get("creadoPorNombre", aviso.get("reportadaPor")),
            "creadoPorRol": aviso.get("creadoPorRol", aviso.get("rolReportante"))}


def sincronizar_expiracion_reportes(ahora):
    for ident, previa in list(INCIDENCIAS.items()):
        actual = normalizar_incidencia(previa, ahora)
        if actual["activa"] and ahora >= actual["expiraEn"]:
            actual.update(activa=False, activo=False, estadoAviso="expirado", revision=actual["revision"] + 1)
        if actual != previa:
            guardar(ident, actual, incidencia=True)


def validar_duracion(valor, ahora):
    if type(valor) is not int or valor < 1 or ahora + valor * 60000 > 8_640_000_000_000_000:
        raise ValueError("Ingresa una duración válida de al menos 1 minuto")
    return valor


def gestionar_incidencia(datos):
    actor = identidad(datos.get("actor"))
    ident = texto(datos.get("id"), 50)
    rapida = RAPIDAS.get(ident)
    if rapida is None:
        validar_id(ident)
    tipo_rapido = datos.get("tipo")
    if not rapida and isinstance(tipo_rapido, str):
        rapida = RAPIDAS.get(tipo_rapido)
    ahora = ahora_ms()
    sincronizar_expiracion_reportes(ahora)
    anterior = INCIDENCIAS.get(ident)
    revision = anterior["revision"] + 1 if anterior else 0
    accion = datos.get("accion")
    if accion in ("editar", "extender", "retirar") and anterior:
        rol = anterior.get("creadoPorRol")
        es_propio = rol == actor["rolUsm"] if rol else anterior.get("creadoPorNombre") == actor["nombre"]
        if not es_propio:
            raise RuntimeError("Solo puedes gestionar tus propios reportes")
    if accion in ("editar", "extender"):
        if not anterior or not anterior["activa"]:
            raise RuntimeError("Este aviso ya no está activo")
        if accion == "extender":
            extension = REPORT_TTL_MINUTES["extensionMinutos"]
            duracion = validar_duracion(anterior["duracionMinutos"] + extension, ahora)
            expira = anterior["expiraEn"] + extension * 60000
        else:
            duracion = validar_duracion(datos.get("duracionMinutos"), ahora)
            expira = ahora + duracion * 60000
        actual = {**anterior, "duracionMinutos": duracion, "expiraEn": expira, "revision": revision}
    else:
        activa = datos.get("activa")
        if type(activa) is not bool:
            raise ValueError("Estado de incidencia inválido")
        if anterior is None and not activa:
            raise KeyError(ident)
        if anterior and anterior["activa"] == activa:
            return anterior
        if activa:
            lugar, descripcion = rapida or (texto(datos.get("lugar"), 40), texto(datos.get("descripcion"), 140))
            if lugar not in LUGARES or not descripcion:
                raise ValueError("Selecciona un lugar e ingresa una descripción")
            if rapida and datos.get("lugar") not in (None, lugar):
                raise ValueError("El tipo no corresponde al lugar")
            tipo = (ident if ident in RAPIDAS else tipo_rapido) if rapida else "personalizada"
            categoria = categoria_incidencia(tipo, datos.get("categoria"))
            duracion = validar_duracion(datos.get("duracionMinutos", REPORT_TTL_MINUTES[categoria]), ahora)
            actual = {"id": ident, "lugar": lugar, "descripcion": descripcion, "tipo": tipo, "categoria": categoria,
                      "activa": True, "activo": True, "revision": revision,
                      "reportadaPor": actor["nombre"], "rolReportante": actor["rolUsm"],
                      "creadoPorNombre": actor["nombre"], "creadoPorRol": actor["rolUsm"],
                      "reportadaEn": datetime.now(timezone.utc).isoformat(), "creadoEn": ahora,
                      "duracionMinutos": duracion, "expiraEn": ahora + duracion * 60000}
        else:
            actual = {**anterior, "activa": False, "activo": False, "estadoAviso": "retirado", "revision": revision}
    guardar(ident, actual, incidencia=True)
    return actual


def validar_id(valor):
    if not isinstance(valor, str) or str(UUID(valor)) != valor:
        raise ValueError("Identificador inválido")
    return valor


def texto(valor, limite):
    if not isinstance(valor, str) or len(valor) > limite:
        raise ValueError("Texto inválido")
    return valor.strip()


def identidad(datos):
    if not isinstance(datos, dict):
        raise ValueError("La acción requiere una sesión USM válida")
    nombre = texto(datos.get("nombre"), 80)
    rol = texto(datos.get("rolUsm"), 24).upper()
    if not nombre or not re.fullmatch(r"[0-9]+(?:-[0-9K])?", rol):
        raise ValueError("La acción requiere una sesión USM válida")
    usuario = DIRECTORIO.get(rol)
    if not usuario:
        raise ValueError("El ROL no está en el directorio USM")
    return {"nombre": usuario["nombreCompleto"], "rolUsm": rol}


def punto(datos):
    if not isinstance(datos, dict):
        raise ValueError("Punto inválido")
    piso = datos.get("piso")
    if piso is not None and (type(piso) is not int or not -1 <= piso <= 4):
        raise ValueError("Piso inválido")
    ident = texto(datos.get("id"), 40)
    nombre = texto(datos.get("nombre"), 100)
    if not ident or not nombre:
        raise ValueError("Falta el punto del viaje")
    return {"id": ident, "nombre": nombre, "piso": piso, "referencia": texto(datos.get("referencia", ""), 140)}


def filtros(datos):
    if not isinstance(datos, list) or len(datos) > 10:
        raise ValueError("Filtros inválidos")
    return [texto(valor, 40) for valor in datos]


def crear(datos, ident):
    ruta = datos.get("rutaSeleccionada")
    if ruta is not None:
        if not isinstance(ruta, dict):
            raise ValueError("Ruta inválida")
        ruta = {"id": texto(ruta.get("id"), 80), "titulo": texto(ruta.get("titulo"), 120),
                "estado": texto(ruta.get("estado"), 20)}
    return {
        "id": ident, "origen": punto(datos.get("origen")), "destino": punto(datos.get("destino")),
        "solicitante": identidad(datos.get("solicitante")),
        "limitaciones": filtros(datos.get("limitaciones")), "entorno": filtros(datos.get("entorno")),
        "comentarios": texto(datos.get("comentarios", ""), 400), "rutaSeleccionada": ruta,
        "estado": "pendiente", "ayudante": None, "revision": 0,
        "creadaEn": datetime.now(timezone.utc).isoformat(),
    }


def calificar(datos):
    estrellas = datos.get("estrellas")
    etiquetas = datos.get("etiquetas", [])
    if type(estrellas) is not int or not 1 <= estrellas <= 5:
        raise ValueError("Selecciona entre 1 y 5 estrellas")
    if not isinstance(etiquetas, list) or len(etiquetas) > len(ETIQUETAS_CALIFICACION) or any(
        etiqueta not in ETIQUETAS_CALIFICACION for etiqueta in etiquetas
    ):
        raise ValueError("Etiquetas de calificación inválidas")
    return {
        "estrellas": estrellas, "etiquetas": list(dict.fromkeys(etiquetas)),
        "comentario": texto(datos.get("comentario", ""), 200),
        "creadaEn": datetime.now(timezone.utc).isoformat(),
    }


def actualizar(actual, datos):
    accion = datos.get("accion")
    transicion = TRANSICIONES.get(accion) if isinstance(accion, str) else None
    if transicion is None:
        raise ValueError("Acción inválida")
    actor = identidad(datos.get("actor"))
    solicitante = actual.get("solicitante") or {}
    if accion in ("aceptar", "rechazar") and solicitante.get("rolUsm") == actor["rolUsm"]:
        raise RuntimeError("La solicitud pertenece a tu sesión de estudiante")
    titular = None
    if accion in ("cancelar", "confirmar", "calificar"):
        titular = actual.get("solicitante")
    elif accion == "finalizar" or (accion == "aceptar" and actual.get("ultimaAccion") == "aceptar"):
        titular = actual.get("ayudante")
    if titular and titular.get("rolUsm") and titular["rolUsm"] != actor["rolUsm"]:
        raise RuntimeError("La acción corresponde a otro participante")
    if actual.get("ultimaAccion") == accion:
        return actual
    previo, siguiente = transicion
    if actual["estado"] != previo or (accion == "calificar" and not actual.get("llegadaConfirmada")):
        raise RuntimeError("La acción no corresponde al estado de la solicitud")
    nuevo = {**actual, "estado": siguiente, "revision": actual["revision"] + 1, "ultimaAccion": accion}
    if accion == "aceptar":
        nuevo["ayudante"] = actor
    if accion == "confirmar":
        nuevo["llegadaConfirmada"] = True
    if accion == "calificar":
        nuevo["calificacion"] = calificar(datos)
    return nuevo


class Servidor(BaseHTTPRequestHandler):
    def responder(self, codigo, tipo, contenido):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(contenido)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(contenido)

    def json(self, codigo, datos):
        self.responder(codigo, "application/json; charset=utf-8", json.dumps(datos).encode())

    def do_GET(self):
        ruta = urlsplit(self.path).path
        if ruta == API:
            with CANDADO:
                sincronizar_expiracion_reportes(ahora_ms())
                estado = {"solicitudes": list(SOLICITUDES.values()), "incidencias": list(INCIDENCIAS.values())}
            self.json(200, estado)
            return
        archivo = ARCHIVOS.get(ruta)
        if not archivo:
            self.send_error(404)
            return
        tipo = "text/javascript" if archivo.endswith(".mjs") else mimetypes.guess_type(archivo)[0]
        contenido = (ROOT / archivo).read_bytes()
        if archivo == "index.html":
            contenido = contenido.replace(b"<head>", b'<head><meta name="cae-api" content="red">', 1)
        self.responder(200, tipo, contenido)

    def do_POST(self):
        ruta = urlsplit(self.path).path
        if ruta not in (API, API_INCIDENCIAS, API_LOGIN) and not ruta.startswith(API + "/"):
            self.send_error(404)
            return
        try:
            if self.headers.get_content_type() != "application/json":
                raise ValueError("Se requiere JSON")
            largo = int(self.headers.get("Content-Length", "0"))
            if not 0 < largo <= 8192:
                raise ValueError("Tamaño de solicitud inválido")
            datos = json.loads(self.rfile.read(largo))
            if not isinstance(datos, dict):
                raise ValueError("Solicitud inválida")
            if ruta == API_LOGIN:
                rol = "".join(texto(datos.get("rol"), 24).split()).upper()
                usuario = DIRECTORIO.get(rol)
                if not usuario or usuario["password"] != datos.get("password"):
                    self.json(401, {"error": "El ROL USM o la contraseña no coinciden"})
                    return
                publico = {clave: valor for clave, valor in usuario.items() if clave not in ("password", "historialAyudas")}
                self.json(200, {**publico, "nombre": usuario["nombreCompleto"], "rolUsm": rol})
                return
            with CANDADO:
                if ruta == API_INCIDENCIAS:
                    resultado = gestionar_incidencia(datos)
                elif ruta == API:
                    ident = validar_id(datos.get("id"))
                    resultado = SOLICITUDES.get(ident)
                    if resultado is None:
                        resultado = crear(datos, ident)
                        guardar(ident, resultado)
                else:
                    ident = validar_id(ruta.removeprefix(API + "/"))
                    resultado = actualizar(SOLICITUDES[ident], datos)
                    if resultado is not SOLICITUDES[ident]:
                        guardar(ident, resultado)
            self.json(200, resultado)
        except ValueError as error:
            self.json(400, {"error": str(error)})
        except KeyError:
            self.json(404, {"error": "Solicitud no encontrada"})
        except RuntimeError as error:
            self.json(409, {"error": str(error)})
        except OSError:
            self.json(500, {"error": "No se pudo guardar el estado de asistencia"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Demo CAE USM")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--datos", type=Path, default=ROOT / "asistencia-datos.json")
    args = parser.parse_args()
    ARCHIVO_ESTADO = args.datos.resolve()
    if ARCHIVO_ESTADO.exists():
        estado = json.loads(ARCHIVO_ESTADO.read_text(encoding="utf-8"))
        SOLICITUDES.update(estado.get("solicitudes", estado))
        INCIDENCIAS.update(estado.get("incidencias", {}))
    sincronizar_expiracion_reportes(ahora_ms())
    with ThreadingHTTPServer((args.host, args.port), Servidor) as http:
        print(f"CAE USM en http://{args.host}:{args.port}", flush=True)
        try:
            http.serve_forever()
        except KeyboardInterrupt:
            pass