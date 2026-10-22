import * as C from '../dominio/camiones.js';
import * as M from '../dominio/vencimientos.js';
import * as V from '../dominio/viajes-cobros.js';

// El dominio recibe solo cargas vigentes y kilómetros aceptados de esta sesión.
export function avisosParaMostrar(datos, hoy) {
  // La fecha base es común a todas las cuentas: preparar una vez por pantalla.
  const viajes = datos.viajes.map((v) => v.fechaBaseCobro ? { ...v, fecha: v.fechaBaseCobro } : v);
  return M.avisos({
    papeles: datos.papeles.filter((p) => !p.anulado),
    planes: datos.planes
      .filter((p) => !p.anulado)
      .map((p) => ({
        ...p,
        anticipacionDias: p.anticipacionDias ?? datos.config.anticipacionDias,
        anticipacionKm: p.anticipacionKm ?? datos.config.anticipacionKm,
      })),
    kmPorCamion: Object.fromEntries(
      datos.camiones.map((c) => [
        c.id,
        C.kmActual(datos.lecturas.filter((l) => l.camionId === c.id && !l.anulado)),
      ]),
    ),
    cuentas: datos.clientes.map((c) => ({
      clienteId: c.id,
      nombre: c.nombre,
      vencidoCentavos: V.estadoCuentaCliente(c, viajes, datos.cobros, hoy).vencidoCentavos,
    })),
    hoy,
    config: datos.config,
  });
}

export function presentarAviso(aviso) {
  return {
    texto: aviso.titulo + ' · ' + aviso.detalle,
    pagina:
      aviso.tipo === 'papel' ? 'Papeles' : aviso.tipo === 'cobro' ? 'Cobros' : 'Mantenimiento',
    camionId: aviso.camionId,
    actualizarKm: Boolean(aviso.camionId && aviso.estado === 'km-incierto'),
  };
}
