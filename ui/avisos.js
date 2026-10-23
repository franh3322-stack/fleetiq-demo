import * as C from '../dominio/camiones.js';
import * as M from '../dominio/vencimientos.js';
import * as V from '../dominio/viajes-cobros.js';
import { nombreMedio } from './formato.js';
import { moneda } from '../datos.js';

// El dominio recibe solo cargas vigentes y kilómetros aceptados de esta sesión.
export function avisosParaMostrar(datos, hoy) {
  // La fecha base es común a todas las cuentas: preparar una vez por pantalla.
  const viajes = datos.viajes.map((v) => v.fechaBaseCobro ? { ...v, fecha: v.fechaBaseCobro } : v);
  const avisos = M.avisos({
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
  const limite = new Date(Date.parse(hoy + 'T00:00:00Z') + 7 * 86400000).toISOString().slice(0,10);
  const ids = new Set();
  for (const c of V.chequesEnCartera(datos.cobros)) if (c.cobrableDesde && c.cobrableDesde <= limite && !ids.has(c.id)) {
    ids.add(c.id);
    avisos.push({ clave: 'cheque:' + c.id, refId: c.id, gravedad: c.cobrableDesde <= hoy ? 1 : 3, tipo: 'cobro', titulo: nombreMedio(c.medio) + ' ' + moneda(c.importeCentavos), detalle: (datos.clientes.find(x=>x.id===c.clienteId)?.nombre ?? '') + ' · desde ' + M.formatoFecha(c.cobrableDesde), estado: c.cobrableDesde < hoy ? 'vencido' : 'proximo' });
  }
  return avisos.sort((a,b)=>a.gravedad-b.gravedad || a.titulo.localeCompare(b.titulo,'es') || a.clave.localeCompare(b.clave));
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
