const respuesta = await fetch(new URL('../data/directorio-usm.json', import.meta.url));
if (!respuesta.ok) throw new Error('No se pudo cargar el directorio de demostración.');
const directorio = await respuesta.json();

export function usuarioPorRol(rol) {
  const registro = directorio.find(usuario => usuario.rol === rol);
  if (!registro) return null;
  const { password, historialAyudas, ...usuario } = registro;
  return { ...usuario, nombre: usuario.nombreCompleto, rolUsm: usuario.rol };
}

export function autenticar(rol, password) {
  const normalizado = rol.replace(/\s/g, '').toUpperCase();
  const registro = directorio.find(usuario => usuario.rol === normalizado && usuario.password === password);
  return registro ? usuarioPorRol(registro.rol) : null;
}

export const accesosDemo = directorio.slice(0, 2).map(({ rol, nombreCompleto, password }) => ({ rol, nombreCompleto, password }));

export const historialInstitucional = directorio.flatMap(usuario => usuario.historialAyudas.map((evento, indice) => ({
  id: 'demo-' + usuario.rol + '-' + indice,
  estado: 'completada',
  creadaEn: evento.fecha,
  ayudante: { nombre: usuario.nombreCompleto, rolUsm: usuario.rol },
  origen: { id: 'edificio-p', nombre: 'Edificio P', piso: 1 },
  destino: { id: 'edificio-c', nombre: 'Edificio C', piso: 1 },
  calificacion: { estrellas: evento.estrellas, etiquetas: evento.etiquetas, creadaEn: evento.fecha },
})));
