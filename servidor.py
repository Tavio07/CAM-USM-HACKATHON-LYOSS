import argparse
import json
import mimetypes
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit
from uuid import UUID

ROOT = Path(__file__).resolve().parent
ARCHIVOS = {
    "/": "index.html", "/index.html": "index.html", "/ayudante": "index.html",
    "/app.mjs": "app.mjs", "/solicitudes.mjs": "solicitudes.mjs",
    "/cuenta.mjs": "cuenta.mjs", "/rutas.mjs": "rutas.mjs", "/campus.css": "campus.css", "/logo-usm.png": "logo-usm.png",
}
API = "/api/solicitudes"
SOLICITUDES = {}
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


def guardar(ident, solicitud):
    if ARCHIVO_ESTADO is not None:
        temporal = ARCHIVO_ESTADO.with_suffix(ARCHIVO_ESTADO.suffix + ".tmp")
        temporal.write_text(json.dumps({**SOLICITUDES, ident: solicitud}, ensure_ascii=False), encoding="utf-8")
        temporal.replace(ARCHIVO_ESTADO)
    SOLICITUDES[ident] = solicitud


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
    return {"nombre": nombre, "rolUsm": rol}


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
                lista = list(SOLICITUDES.values())
            self.json(200, {"solicitudes": lista})
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
        if ruta != API and not ruta.startswith(API + "/"):
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
            with CANDADO:
                if ruta == API:
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
        SOLICITUDES.update(json.loads(ARCHIVO_ESTADO.read_text(encoding="utf-8")))
    with ThreadingHTTPServer((args.host, args.port), Servidor) as http:
        print(f"CAE USM en http://{args.host}:{args.port}", flush=True)
        try:
            http.serve_forever()
        except KeyboardInterrupt:
            pass