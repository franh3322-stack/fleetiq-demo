import * as C from '../dominio/camiones.js';
import * as M from '../dominio/vencimientos.js';
import * as V from '../dominio/viajes-cobros.js';
import { nombreMedio } from './formato.js';
import { moneda, papelVigente } from '../datos.js';

// El dominio recibe solo cargas vigentes y kilómetros aceptados de esta sesión.
export function avisosParaMostrar(datos, hoy) {
  datos={...datos,cobros:datos.cobros.filter(c=>c.empresaId===datos.empresaId)};
  // La fecha base es común a todas las cuentas: preparar una vez por pantalla.
  const viajes = datos.viajes.map((v) => v.fechaBaseCobro ? { ...v, fecha: v.fechaBaseCobro } : v);
  const avisos = M.avisos({
    // Un papel renovado ya no avisa: avisa su renovación.
    papeles: datos.papeles.filter((p) => papelVigente(p, datos.papeles)),
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
      vencidoCentavos: V.estadoCuentaCliente(c, viajes, datos.cobros, hoy).vencidoSinCubrirCentavos,
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
  for (const c of datos.cobros.filter(c=>c.empresaId===datos.empresaId && V.esCheque(c) && !c.anulado)) {
    const estado=V.estadoCheque(c);
    const agregar=(tipo,titulo)=>avisos.push({clave:tipo+':'+c.id,refId:c.id,gravedad:1,tipo:'cobro',titulo,detalle:(datos.clientes.find(x=>x.id===c.clienteId)?.nombre ?? '')+' · '+nombreMedio(c.medio)+' '+moneda(c.importeCentavos),estado:'vencido'});
    if(estado==='depositado' && Date.parse(hoy+'T00:00:00Z')-Date.parse(c.depositadoFecha+'T00:00:00Z') > (datos.config.diasAcreditacion ?? 3)*86400000)agregar('acreditacion','¿Ya se acreditó?');
    if(estado==='rechazado' && !c.resuelto && !datos.cobros.some(x=>!x.anulado && x.empresaId===c.empresaId && x.clienteId===c.clienteId && x.reemplazaCobroId===c.id))agregar('rechazado','Cheque rechazado');
    if(c.estadoRetencion==='por-confirmar')agregar('retencion','Retención por confirmar');
    if(c.revisarCheque || !c.eventos?.length)agregar('revision-cheque','Revisá este cheque');
  }
  for(const a of avisos)if(a.tipo==='cobro') {
    const cliente=datos.clientes.find(c=>a.clave==='cobro:'+c.id);
    if(cliente){const s=V.estadoCuentaCliente(cliente,viajes,datos.cobros,hoy);if(s.chequesSinCobrarCentavos)a.detalle+=' · Tiene '+moneda(s.chequesSinCobrarCentavos)+' en cheques sin cobrar';}
  }
  return [...new Map(avisos.map(a=>[a.clave,a])).values()].sort((a,b)=>a.gravedad-b.gravedad || a.titulo.localeCompare(b.titulo,'es') || a.clave.localeCompare(b.clave));
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
