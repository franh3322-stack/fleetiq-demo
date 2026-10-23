// Generado desde src/: ejecutar npm run construir.
                                                     

                          
                                                               
                                                    
 
                        
                                                                                      
                                                                                                
                                                
                                                                                        
                                                  
 
                        
                                                                                           
                                                                                      
                                                              
                                                                                                 
                                              
                                                                 
                                                            
                                                
 
                                                                                  
                                                                         
                                                                                                                                                                                     
                                                                                                                                                                                                                   
                               
                                                                                                      
                                                                               
                                                                                                    
 

function fechaValida(fecha        )         {
  const ms = Date.parse(`${fecha}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== fecha) throw new Error(`Fecha inválida: ${fecha}; se espera AAAA-MM-DD.`);
  return ms;
}
function monto(n        , registro        )       {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${registro}: importe inválido; debe ser un entero no negativo dentro del rango seguro.`);
}
function suma(a        , b        )         {
  const r = a + b;
  if (!Number.isSafeInteger(r)) throw new Error('La suma excede el rango seguro.');
  return r;
}
function motivoValido(fecha        , motivo        )       {
  fechaValida(fecha);
  if (typeof motivo !== 'string' || !motivo.trim()) throw new Error('Indicá un motivo.');
}
function validarViaje(v       )       {
  fechaValida(v.fecha); monto(v.tarifaCentavos, `Viaje ${v.id}`);
  if (!['planificado', 'hecho', 'cancelado'].includes(v.estado)) throw new Error(`Viaje ${v.id}: estado inválido.`);
  if (typeof v.camionId !== 'string' || !v.camionId.trim()) throw new Error(`Viaje ${v.id}: falta el camión.`);
  if (v.kmRecorridos !== undefined) monto(v.kmRecorridos, `Viaje ${v.id}, km`);
  for (const h of v.historialTarifa) { motivoValido(h.fecha, h.motivo); monto(h.tarifaCentavos, `Viaje ${v.id}, historial`); }
}
export function validarCobro(c       )       {
  fechaValida(c.fecha); monto(c.importeCentavos, `Cobro ${c.id}`);
  if (!['transferencia', 'cheque', 'echeq', 'efectivo', 'otro'].includes(c.medio)) throw new Error(`Cobro ${c.id}: medio inválido.`);
  if (c.retencionCentavos !== undefined) monto(c.retencionCentavos, 'Retención del cobro ' + c.id);
  if ((c.retencionCentavos ?? 0) > 0) {
    if (!['iibb', 'otra'].includes(c.retencionTipo )) throw Error('Elegí el tipo de retención: Ingresos Brutos u Otra.');
  } else if (c.retencionTipo !== undefined) throw Error('No corresponde tipo sin retención.');
  suma(c.importeCentavos, c.retencionCentavos ?? 0);
  for (const campo of ['cobrableDesde', 'depositadoFecha', 'acreditadoFecha']         ) if (c[campo] !== undefined) {
    if (!['cheque', 'echeq'].includes(c.medio)) throw Error('La fecha del cheque solo corresponde a Cheque o E-cheq.');
    fechaValida(c[campo] );
    if (c[campo]  < c.fecha) throw Error('La fecha del cheque no puede ser anterior a la fecha del cobro.');
  }
  if (c.anulado) motivoValido(c.anulado.fecha, c.anulado.motivo);
  validarEventos(c);
}
function sinRepetidos(registros                                              , nombre        )       {
  const empresas = new Map                     ();
  for (const r of registros) {
    const ids = empresas.get(r.empresaId) ?? new Set        ();
    if (ids.has(r.id)) throw new Error(`${nombre} ${r.id}: id repetido en la empresa.`);
    ids.add(r.id); empresas.set(r.empresaId, ids);
  }
}
function copiarViaje(v       )        {
  return { ...v, historialTarifa: v.historialTarifa.map(h => ({ ...h })), ...(v.cancelacion ? { cancelacion: { ...v.cancelacion } } : {}) };
}
export function cambiarTarifa(viaje       , nuevaTarifaCentavos        , fecha        , motivo        )        {
  validarViaje(viaje); monto(nuevaTarifaCentavos, `Viaje ${viaje.id}`); motivoValido(fecha, motivo);
  return { ...copiarViaje(viaje), tarifaCentavos: nuevaTarifaCentavos,
    historialTarifa: [...viaje.historialTarifa.map(h => ({ ...h })), { fecha, tarifaCentavos: viaje.tarifaCentavos, motivo }] };
}
export function cancelarViaje(viaje       , fecha        , motivo        )        {
  validarViaje(viaje); motivoValido(fecha, motivo);
  if (viaje.estado === 'cancelado') throw new Error(`Viaje ${viaje.id}: ya está cancelado.`);
  return { ...copiarViaje(viaje), estado: 'cancelado', cancelacion: { fecha, motivo } };
}

export function estadoCuentaCliente(cliente         , viajes                  , cobros                  , hoy        )               {
  fechaValida(hoy);
  const plazo = cliente.plazoDias ?? 30; // SUPUESTO S-02: configurable por cliente.
  const inicial = cliente.saldoInicialCentavos ?? 0; // SUPUESTO S-03: demostración sin deuda previa.
  monto(inicial, `Cliente ${cliente.id}, saldo inicial`);
  if (!Number.isSafeInteger(plazo) || plazo < 0) throw new Error('El plazo debe ser un entero no negativo de días.');
  // Los ids son únicos en toda la empresa, incluso entre distintos clientes.
  sinRepetidos(viajes.filter(v => v.empresaId === cliente.empresaId), 'Viaje');
  sinRepetidos(cobros.filter(c => c.empresaId === cliente.empresaId), 'Cobro');
  const propios = viajes.filter(v => v.empresaId === cliente.empresaId && v.clienteId === cliente.id);
  const pagos = cobros.filter(c => c.empresaId === cliente.empresaId && c.clienteId === cliente.id);
  propios.forEach(validarViaje); pagos.forEach(validarCobro);
  // S-01 confirmado por el cliente (22/10/2026): fecha del viaje hecho.
  const hechos = propios.filter(v => v.estado === 'hecho').sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  const facturadoCentavos = hechos.reduce((s, v) => suma(s, v.tarifaCentavos), 0);
  validarReemplazos(pagos);
  const partes = pagos.flatMap(c => partesCobro(c)).filter(p => p.fecha <= hoy);
  const cobradoCentavos = partes.filter(p => p.tipo === 'dinero').reduce((s,p) => suma(s,p.importeCentavos),0);
  const retenidoCentavos = partes.filter(p => p.tipo === 'retencion').reduce((s,p) => suma(s,p.importeCentavos),0);
  const chequesSinCobrarCentavos = pagos.filter(c => !c.anulado && c.fecha <= hoy && esCheque(c) && ['recibido','depositado'].includes(fotoEnFecha(c,hoy).estadoCheque )).reduce((s,c) => suma(s,c.importeCentavos),0);
  const saldoCentavos = suma(suma(inicial, facturadoCentavos), -suma(cobradoCentavos, retenidoCentavos));
  // Sin fecha del saldo inicial no se presume vencido. Se cancela primero esa deuda previa.
  // SUPUESTO S-13: primero el viaje indicado; excedentes a la deuda más vieja.
  const pendientes = new Map(hechos.map(v => [v.id, v.tarifaCentavos]));
  let resto = 0;
  for (const c of pagos.filter(c => !c.anulado)) {
    let importe = partes.filter(p => p.cobroId === c.id).reduce((s,p) => suma(s,p.importeCentavos),0);
    if (c.viajeId) {
      const v = propios.find(v => v.id === c.viajeId);
      if (!v) throw new Error(`Cobro ${c.id}: el viaje indicado no existe o es de otro cliente o empresa.`);
      if (v.estado !== 'hecho') throw new Error(`Cobro ${c.id}: el viaje indicado está cancelado o todavía no está hecho.`);
      const aplicado = Math.min(importe, pendientes.get(v.id) );
      pendientes.set(v.id, pendientes.get(v.id)  - aplicado); importe -= aplicado;
    }
    resto = suma(resto, importe);
  }
  let disponible = Math.max(0, resto - inicial);
  let vencidoCentavos = 0;
  let proximoVencimiento                    ;
  for (const v of hechos) {
    const aplicado = Math.min(disponible, pendientes.get(v.id) );
    disponible -= aplicado;
    const pendiente = pendientes.get(v.id)  - aplicado;
    const ms = fechaValida(v.fecha) + plazo * 86400000;
    if (!Number.isFinite(ms) || ms > fechaValida('9999-12-31')) throw new Error(`Viaje ${v.id}: vencimiento fuera del rango de fechas.`);
    const vence = new Date(ms).toISOString().slice(0, 10);
    if (pendiente > 0) {
      if (vence < hoy) vencidoCentavos = suma(vencidoCentavos, pendiente);
      else if (!proximoVencimiento || vence < proximoVencimiento) proximoVencimiento = vence;
    }
  }
  return { facturadoCentavos, cobradoCentavos, retenidoCentavos, saldoCentavos, vencidoCentavos, chequesSinCobrarCentavos, faltaEntregarCentavos: Math.max(0,saldoCentavos-chequesSinCobrarCentavos), vencidoSinCubrirCentavos: Math.max(0,vencidoCentavos-chequesSinCobrarCentavos), aFavorCentavos: Math.max(0, -saldoCentavos), ...(proximoVencimiento ? { proximoVencimiento } : {}) };
}

export function revisarCobro(cobro       , estadoCuenta              )                                                             {
  validarCobro(cobro);
  if (!Number.isSafeInteger(estadoCuenta.saldoCentavos)) throw new Error('Saldo de cuenta inválido.');
  if (cobro.anulado) throw new Error(`Cobro ${cobro.id}: está anulado.`);
  const deuda = Math.max(0, estadoCuenta.saldoCentavos);
  return totalCobro(cobro) > deuda
    ? { requiereConfirmacion: true, aFavorCentavos: suma(totalCobro(cobro) - deuda, Math.max(0, -estadoCuenta.saldoCentavos)) }
    : { requiereConfirmacion: false };
}
export function anularCobro(cobro       , fecha        , motivo        )        {
  validarCobro(cobro); motivoValido(fecha, motivo);
  if (cobro.anulado) throw new Error(`Cobro ${cobro.id}: ya está anulado.`);
  if (esCheque(cobro) && fecha < (cobro.eventos?.at(-1)?.fecha ?? cobro.fecha)) throw Error('La fecha no puede ser anterior al cobro ni al evento anterior.');
  const revisado = esCheque(cobro) ? confirmarRevisionCheque(migrarCheque(cobro),fecha) : cobro;
  return { ...revisado, anulado: { fecha, motivo } };
}
export function viajesAMovimientos(viajes                  )               {
  sinRepetidos(viajes, 'Viaje');
  viajes.forEach(validarViaje);
  // SUPUESTO S-01: el ingreso usa la fecha del viaje, configurable al elegir este adaptador.
  return viajes.filter(v => v.estado === 'hecho').map(v => ({ id: `ingreso-viaje-${v.id}`, empresaId: v.empresaId,
    camionId: v.camionId, fecha: v.fecha, tipo: 'ingreso', importeCentavos: v.tarifaCentavos }));
}

export function totalCobro(c       )         { validarCobro(c); return suma(c.importeCentavos,c.retencionCentavos ?? 0); }
export function depositarCheque(c       , fecha        )        {
 return cambiarEstadoCheque(c,'depositado',fecha);
}
export function chequesEnCartera(cobros                  )          {
 cobros.forEach(validarCobro);
 return cobros.filter(c=>esCheque(c) && !c.anulado && estadoCheque(c)==='recibido').sort((a,b)=>(a.cobrableDesde ?? '9999-99-99').localeCompare(b.cobrableDesde ?? '9999-99-99') || a.id.localeCompare(b.id));
}

export const esCheque = (c       )          => ['cheque','echeq'].includes(c.medio);
export const estadoCheque = (c       )                           => esCheque(c) ? c.estadoCheque ?? (c.depositadoFecha && !c.anulado ? 'depositado' : 'recibido') : undefined;
const estados = ['recibido','depositado','acreditado','rechazado'];
const retenciones = ['vigente','sin-efecto','por-confirmar'];
const permite = (a              , b              )          => ({recibido:['depositado','acreditado','rechazado'],depositado:['acreditado','rechazado'],rechazado:['depositado'],acreditado:[]})[a].includes(b);
function foto(c       )            {
  const ultimo = c.eventos?.at(-1)?.despues;
  return ultimo ? {...ultimo} : JSON.parse(JSON.stringify({estadoCheque:estadoCheque(c),estadoRetencion:c.retencionCentavos ? c.estadoRetencion ?? 'vigente' : undefined,depositadoFecha:c.depositadoFecha}));
}
export function migrarCheque(c       )        {
  validarCobro(c);
  if (!esCheque(c) || c.eventos?.length) return structuredClone(c);
  const despues = {...foto(c),revisarCheque:true};
  return {...structuredClone(c),...despues,eventos:[{id:'migracion:'+c.id,tipo:'inicio',fecha:c.fecha,antes:{},despues}]};
}
export function iniciarCheque(c       )        {
  validarCobro(c);
  if (!esCheque(c)) return structuredClone(c);
  if (c.eventos?.length) return structuredClone(c);
  const despues            = c.retencionCentavos ? {estadoCheque:'recibido',estadoRetencion:'vigente'} : {estadoCheque:'recibido'};
  return {...structuredClone(c),...despues,eventos:[{id:'inicio:'+c.id,tipo:'inicio',fecha:c.fecha,antes:{},despues}]};
}
function validarEventos(c       )       {
  if (c.estadoCheque !== undefined && (!esCheque(c) || !estados.includes(c.estadoCheque))) throw Error('Estado de cheque inválido.');
  if (c.estadoRetencion !== undefined && (!c.retencionCentavos || !retenciones.includes(c.estadoRetencion))) throw Error('Estado de retención inválido.');
  if (c.reemplazaCobroId !== undefined && (typeof c.reemplazaCobroId !== 'string' || !c.reemplazaCobroId || c.reemplazaCobroId === c.id)) throw Error('Reemplazo inválido.');
  if (!c.eventos) { if (c.estadoCheque && c.estadoCheque !== (c.depositadoFecha ? 'depositado' : 'recibido')) throw Error('Falta el historial del cheque.'); return; }
  if (!esCheque(c) || !Array.isArray(c.eventos) || !c.eventos.length) throw Error('Historial del cheque inválido.');
  let anterior = c.fecha; let actual            = {}; const ids = new Set        (); const pila                = [];
  for (const [i,e] of c.eventos.entries()) {
    fechaValida(e.fecha);
    if (!e.id || ids.has(e.id) || e.fecha < anterior || !e.antes || !e.despues) throw Error('Evento de cobro inválido o fecha anterior.');
    ids.add(e.id); anterior=e.fecha;
    const a=e.antes,b=e.despues;
    if (JSON.stringify(a)!==JSON.stringify(actual)) throw Error('El historial no conserva el estado anterior.');
    if (!estados.includes(b.estadoCheque ) || (c.retencionCentavos ? !retenciones.includes(b.estadoRetencion ) : b.estadoRetencion!==undefined)) throw Error('Estado del evento inválido.');
    for (const f of [b.depositadoFecha,b.acreditadoFecha]) if(f) {fechaValida(f);if(f<c.fecha)throw Error('Fecha anterior al cobro.');}
    if (i===0) {
      if(e.tipo!=='inicio' || e.fecha!==c.fecha || !['recibido','depositado'].includes(b.estadoCheque )) throw Error('Inicio de historial inválido.');
    } else if(e.tipo==='deshacer') {
      const previo=pila.pop();
      motivoValido(e.fecha,e.motivo );
      if(!previo || e.deshace!==previo.id || JSON.stringify(b)!==JSON.stringify({...previo.antes,...(b.revisarCheque===false ? {revisarCheque:false} : {})}))throw Error('Deshacer inválido.');
    } else {
      let esperado           ;
      if(e.tipo==='estado') {
        if(!permite(a.estadoCheque ,b.estadoCheque ))throw Error('Transición de cheque no permitida.');
        esperado={...a,estadoCheque:b.estadoCheque,resuelto:false};
        if(b.estadoCheque==='depositado')esperado.depositadoFecha=e.fecha;
        if(b.estadoCheque==='acreditado')esperado.acreditadoFecha=e.fecha;
        if(b.estadoCheque==='rechazado' && c.retencionCentavos)esperado.estadoRetencion=b.estadoRetencion;
      } else if(e.tipo==='retencion') {
        motivoValido(e.fecha,e.motivo );
        if(!c.retencionCentavos || !c.eventos .slice(0,i).some(e=>e.despues.estadoCheque==='rechazado'))throw Error('Retención sin rechazo.');
        esperado={...a,estadoRetencion:b.estadoRetencion};
      } else if(e.tipo==='resuelto') {
        motivoValido(e.fecha,e.motivo );
        if(a.estadoCheque!=='rechazado')throw Error('Solo se resuelve un rechazado.');
        esperado={...a,resuelto:true};
      } else if(e.tipo==='revision') { esperado={...a,revisarCheque:false}; }
      else throw Error('Tipo de evento inválido.');
      if(b.revisarCheque===false) esperado.revisarCheque=false;
      if(JSON.stringify(b)!==JSON.stringify(esperado))throw Error('El evento altera datos ajenos al paso.');
      pila.push(e);
    }
    actual={...b};
  }
  for(const k of ['estadoCheque','estadoRetencion','depositadoFecha','acreditadoFecha','resuelto','revisarCheque']         ) if(c[k]!==actual[k])throw Error('El cobro no coincide con su historial.');
}
function agregar(c       , tipo                     , fecha        , despues           , motivo         , id         , deshace         )        {
  const base=c.eventos?.length ? c : migrarCheque(c);
  fechaValida(fecha);
  if(fecha < base.eventos .at(-1) .fecha || fecha<c.fecha)throw Error('La fecha no puede ser anterior al cobro ni al evento anterior.');
  if (base.revisarCheque || tipo==='deshacer' && base.revisarCheque===false) despues={...despues,revisarCheque:false};
  const e             ={id:id ?? c.id+':'+base.eventos .length+':'+tipo,fecha,tipo,...(motivo!==undefined ? {motivo} : {}),antes:foto(base),despues, ...(deshace ? {deshace} : {})};
  const resultado={...structuredClone(base),eventos:[...base.eventos ,e]};
  for(const k of ['estadoCheque','estadoRetencion','depositadoFecha','acreditadoFecha','resuelto','revisarCheque']         )delete resultado[k];
  Object.assign(resultado,despues);
  validarCobro(resultado);return resultado;
}
function habilitado(c       , id         )          {
  validarCobro(c);
  if(c.anulado || !esCheque(c))throw Error('Elegí un cheque vigente. No se puede actuar sobre un anulado.');
  return Boolean(id && c.eventos?.some(e=>e.id===id));
}
export function cambiarEstadoCheque(c       , estado              , fecha        , opciones                                                                 = {})        {
  if(habilitado(c,opciones.id))return structuredClone(c);
  const base=c.eventos?.length ? c : migrarCheque(c), a=foto(base);
  if(a.estadoCheque===estado)return structuredClone(c);
  if(!permite(a.estadoCheque ,estado))throw Error('Transición de cheque no permitida.');
  const b={...a,estadoCheque:estado,resuelto:false};
  if(estado==='depositado')b.depositadoFecha=fecha;
  if(estado==='acreditado')b.acreditadoFecha=fecha;
  if(estado==='rechazado' && c.retencionCentavos) {
    if(!retenciones.includes(opciones.estadoRetencion ))throw Error('Elegí si la retención sigue valiendo.');
    b.estadoRetencion=opciones.estadoRetencion;
  }
  return agregar(base,'estado',fecha,b,opciones.motivo,opciones.id);
}
export function cambiarRetencion(c       , estado                 , fecha        , motivo        , id         )        {
  if(habilitado(c,id))return structuredClone(c);
  motivoValido(fecha,motivo);
  if(!c.retencionCentavos || !c.eventos?.some(e=>e.despues.estadoCheque==='rechazado') || !retenciones.includes(estado))throw Error('Elegí una retención de cheque con rechazo registrado.');
  if(foto(c).estadoRetencion===estado)return structuredClone(c);
  return agregar(c,'retencion',fecha,{...foto(c),estadoRetencion:estado},motivo,id);
}
export function resolverCheque(c       , fecha        , nota        , id         )        {
  if(habilitado(c,id))return structuredClone(c);
  motivoValido(fecha,nota);
  if(estadoCheque(c)!=='rechazado')throw Error('Elegí un cheque rechazado.');
  if(c.resuelto)return structuredClone(c);
  return agregar(c,'resuelto',fecha,{...foto(c),resuelto:true},nota,id);
}
export function confirmarRevisionCheque(c       , fecha        , id         )        {
  if(habilitado(c,id))return structuredClone(c);
  if(!foto(c).revisarCheque)return structuredClone(c);
  return agregar(c,'revision',fecha,{...foto(c),revisarCheque:false},'Cheque revisado',id);
}
export function deshacerUltimoPaso(c       , fecha        , motivo        , id        )        {
  if(habilitado(c,id))return structuredClone(c);
  motivoValido(fecha,motivo);
  if(!id)throw Error('Falta la clave de la acción.');
  const pila               =[];
  for(const e of c.eventos ?? []) if(e.tipo==='deshacer')pila.pop();else if(e.tipo!=='inicio')pila.push(e);
  const ultimo=pila.at(-1);
  if(!ultimo)throw Error('No hay pasos para deshacer.');
  return agregar(c,'deshacer',fecha,{...ultimo.antes},motivo,id,ultimo.id);
}
function fotoEnFecha(c       , fecha        )            {
  if(!c.eventos?.length)return {...foto(c),...(c.depositadoFecha && c.depositadoFecha>fecha ? {estadoCheque:'recibido'         } : {})};
  return {...c.eventos.filter(e=>e.fecha<=fecha).at(-1)?.despues};
}
export function partesCobro(c       )                                                                                   {
  validarCobro(c);
  if(c.anulado)return [];
  const a=foto(c),partes                                =[];
  if(!esCheque(c) || a.estadoCheque==='acreditado')partes.push({cobroId:c.id,tipo:'dinero',fecha:esCheque(c) ? a.acreditadoFecha  : c.fecha,importeCentavos:c.importeCentavos});
  if(c.retencionCentavos && (a.estadoRetencion ?? 'vigente')==='vigente')partes.push({cobroId:c.id,tipo:'retencion',fecha:c.fecha,importeCentavos:c.retencionCentavos});
  return partes;
}
export function validarReemplazos(cobros                  )       {
  const usados=new Set        ();
  for(const c of cobros)if(c.reemplazaCobroId){
    const previo=cobros.find(p=>p.id===c.reemplazaCobroId && p.empresaId===c.empresaId && p.clienteId===c.clienteId);
    if(!previo || !esCheque(previo) || !(previo.eventos?.some(e=>e.despues.estadoCheque==='rechazado' && e.fecha<=c.fecha) || (!previo.eventos && estadoCheque(previo)==='rechazado')) || c.fecha < previo.fecha)throw Error('El reemplazo debe ser de un cheque rechazado del mismo cliente y empresa.');
    if(!c.anulado){if(usados.has(previo.id))throw Error('Ese cheque ya tiene un reemplazo vigente.');usados.add(previo.id);}
  }
}
export function vincularReemplazo(c       , previo       )        {
  validarCobro(c);validarCobro(previo);
  if(c.anulado || previo.anulado || c.empresaId!==previo.empresaId || c.clienteId!==previo.clienteId || estadoCheque(previo)!=='rechazado')throw Error('Elegí un cheque rechazado vigente del mismo cliente y empresa.');
  const nuevo={...structuredClone(c),reemplazaCobroId:previo.id};validarReemplazos([previo,nuevo]);return nuevo;
}
