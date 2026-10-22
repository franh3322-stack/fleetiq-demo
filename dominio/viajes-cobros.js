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
function validarCobro(c       )       {
  fechaValida(c.fecha); monto(c.importeCentavos, `Cobro ${c.id}`);
  if (!['transferencia', 'cheque', 'efectivo', 'otro'].includes(c.medio)) throw new Error(`Cobro ${c.id}: medio inválido.`);
  if (c.anulado) motivoValido(c.anulado.fecha, c.anulado.motivo);
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
  // SUPUESTO S-01: facturado por fecha del viaje hecho; no por fecha de cobro.
  const hechos = propios.filter(v => v.estado === 'hecho').sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  const facturadoCentavos = hechos.reduce((s, v) => suma(s, v.tarifaCentavos), 0);
  const cobradoCentavos = pagos.filter(c => !c.anulado).reduce((s, c) => suma(s, c.importeCentavos), 0);
  const saldoCentavos = suma(suma(inicial, facturadoCentavos), -cobradoCentavos);
  // Sin fecha del saldo inicial no se presume vencido. Se cancela primero esa deuda previa.
  // SUPUESTO S-13: primero el viaje indicado; excedentes a la deuda más vieja.
  const pendientes = new Map(hechos.map(v => [v.id, v.tarifaCentavos]));
  let resto = 0;
  for (const c of pagos.filter(c => !c.anulado)) {
    let importe = c.importeCentavos;
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
  return { facturadoCentavos, cobradoCentavos, saldoCentavos, vencidoCentavos, aFavorCentavos: Math.max(0, -saldoCentavos), ...(proximoVencimiento ? { proximoVencimiento } : {}) };
}

export function revisarCobro(cobro       , estadoCuenta              )                                                             {
  validarCobro(cobro);
  if (!Number.isSafeInteger(estadoCuenta.saldoCentavos)) throw new Error('Saldo de cuenta inválido.');
  if (cobro.anulado) throw new Error(`Cobro ${cobro.id}: está anulado.`);
  const deuda = Math.max(0, estadoCuenta.saldoCentavos);
  return cobro.importeCentavos > deuda
    ? { requiereConfirmacion: true, aFavorCentavos: suma(cobro.importeCentavos - deuda, Math.max(0, -estadoCuenta.saldoCentavos)) }
    : { requiereConfirmacion: false };
}
export function anularCobro(cobro       , fecha        , motivo        )        {
  validarCobro(cobro); motivoValido(fecha, motivo);
  if (cobro.anulado) throw new Error(`Cobro ${cobro.id}: ya está anulado.`);
  return { ...cobro, anulado: { fecha, motivo } };
}
export function viajesAMovimientos(viajes                  )               {
  sinRepetidos(viajes, 'Viaje');
  viajes.forEach(validarViaje);
  // SUPUESTO S-01: el ingreso usa la fecha del viaje, configurable al elegir este adaptador.
  return viajes.filter(v => v.estado === 'hecho').map(v => ({ id: `ingreso-viaje-${v.id}`, empresaId: v.empresaId,
    camionId: v.camionId, fecha: v.fecha, tipo: 'ingreso', importeCentavos: v.tarifaCentavos }));
}
