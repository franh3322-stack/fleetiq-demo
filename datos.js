import { resumenFlota } from './dominio/saldo-mensual.js';
import { validarNuevoCamion, registrarLecturaKm } from './dominio/camiones.js';
import { estadoCuentaCliente, viajesAMovimientos, totalCobro, validarCobro } from './dominio/viajes-cobros.js';
import { estadoPapel, limitesPlan, gastoDeReparacion, completarService } from './dominio/vencimientos.js';

export function leerMonto(texto        )         {
  const t = texto.trim();
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(t)) throw Error('Revisá el monto. Usá punto para miles y coma para centavos: 85.000,50.');
  const [pesos, decimal = ''] = t.replaceAll('.', '').split(',');
  const n = Number(pesos) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n < 0) throw Error('El monto es demasiado grande.');
  return n;
}
export const moneda = (centavos        , decimales = false)         => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: decimales ? 2 : 0, maximumFractionDigits: decimales ? 2 : 0,
}).format(centavos / 100).replace(/\s/g, ' ');

export function vacio(espacio        ) {
  if (!['demo', 'real'].includes(espacio)) throw Error('Elegí un espacio válido.');
  return { version: 1, espacio, empresaId: espacio, camiones: [], lecturas: [], clientes: [], viajes: [], cobros: [], gastos: [], papeles: [], planes: [], services: [], reparaciones: [], archivos: [], historial: [], soporte: [],
    config: { anticipacionDias: 30, anticipacionKm: 1000, maxDiasLectura: 15, kmPorDiaMax: 1500, criterio: 'viaje' } };
}
export function demostracion(hoy        ) {
  const d      = vacio('demo'), empresaId = 'demo';
  const mes = hoy.slice(0, 7);
  d.camiones = [{ id: 'c1', empresaId, patente: 'AB123CD', nombre: 'Azul · Ejemplo' }, { id: 'c2', empresaId, patente: 'ABC456', nombre: 'Blanco · Ejemplo' }];
  d.clientes = [{ id: 'cl1', empresaId, nombre: 'Cargas del Sur · Ficticio', plazoDias: 5, saldoInicialCentavos: 0 }];
  d.viajes = [{ id: 'v1', empresaId, camionId: 'c1', clienteId: 'cl1', fecha: mes + '-01', origen: 'Rosario', destino: 'Buenos Aires', tarifaCentavos: 150000000, estado: 'hecho', historialTarifa: [] }];
  d.gastos = [{ id: 'g1', empresaId, camionId: 'c1', fecha: mes + '-02', tipo: 'gasto', categoria: 'combustible', importeCentavos: 50000000 }, { id: 'g2', empresaId, camionId: 'c2', fecha: mes + '-02', tipo: 'gasto', categoria: 'reparacion', importeCentavos: 18000000 }];
  d.cobros = [{ id: 'co1', empresaId, clienteId: 'cl1', fecha: mes + '-03', importeCentavos: 30000000, retencionCentavos: 1000000, retencionTipo: 'iibb', medio: 'transferencia' }, { id: 'co2', empresaId, clienteId: 'cl1', fecha: hoy, importeCentavos: 9000000, medio: 'echeq', cobrableDesde: new Date(Date.parse(hoy + 'T00:00:00Z') + 10 * 86400000).toISOString().slice(0,10) }];
  d.lecturas = d.camiones.map((c     , i        ) => ({ id: 'l' + i, empresaId, camionId: c.id, fecha: mes + '-01', km: 152300 + i * 10000, resultado: 'aceptada' }));
  d.papeles = [{ id: 'p1', empresaId, camionId: 'c1', tipo: 'Seguro · Ejemplo', vence: mes + '-05' }];
  d.planes = [{ id: 'pl1', empresaId, camionId: 'c1', tarea: 'Aceite · Ejemplo', cadaKm: 30000, cadaDias: 365, ultimoKm: 123000, ultimaFecha: mes + '-01', proximoKm: 153000 }];
  return d;
}
export function movimientos(d     ) {
  const ingresos = viajesAMovimientos(d.viajes);
  // S-01 configurable: por cobro exige imputación explícita a un viaje/camión.
  return [...(d.config.criterio === 'cobro' ? d.cobros.filter((c     ) => !c.anulado && c.viajeId).map((c     ) => ({ id: 'ingreso-cobro-' + c.id, empresaId: d.empresaId, camionId: d.viajes.find((v     ) => v.id === c.viajeId).camionId, fecha: c.fecha, tipo: 'ingreso', importeCentavos: totalCobro(c) })) : ingresos),
    ...d.gastos.filter((g     ) => !g.anulado), ...d.services.filter((s     ) => !s.anulado).map((s     ) => ({ id: 'gasto-service-' + s.id, empresaId: d.empresaId, camionId: s.camionId, fecha: s.fecha, tipo: 'gasto', categoria: 'mantenimiento', importeCentavos: s.costoCentavos })),
    ...d.reparaciones.filter((r     ) => !r.anulado).map(gastoDeReparacion)];
}
// S-02: se puede elegir una fecha base por viaje sin cambiar la fecha de su ingreso.
export function cuentaCliente(d     , cliente     , hoy        ) {
  return estadoCuentaCliente(cliente, d.viajes.map((v     ) => ({ ...v, fecha: v.fechaBaseCobro || v.fecha })), d.cobros, hoy);
}
export function validarDatos(d     , espacio        ) {
  if (!d || d.version !== 1 || d.espacio !== espacio || d.empresaId !== espacio) throw Error('El respaldo debe ser de este mismo espacio. Demostración y Mi empresa van separados.');
  const listas = ['camiones','lecturas','clientes','viajes','cobros','gastos','papeles','planes','services','reparaciones','archivos','historial','soporte'];
  for (const k of listas) {
    if (!Array.isArray(d[k])) throw Error('El respaldo está incompleto.');
    const ids = new Set();
    for (const r of d[k]) {
      if (k === 'soporte') { if (!r || typeof r.fecha !== 'string' || typeof r.detalle !== 'string') throw Error('El registro de soporte no se puede leer.'); continue; }
      if (!r || typeof r.id !== 'string' || !r.id || ids.has(r.id) || r.empresaId !== espacio) throw Error('El respaldo tiene registros repetidos o de otro espacio.');
      ids.add(r.id);
      if (k === 'historial' && r.antes?.empresaId && r.antes.empresaId !== espacio) throw Error('El historial pertenece a otro espacio.');
      if (r.camionId && !d.camiones.some((c     ) => c.id === r.camionId)) throw Error('Falta un camión del respaldo.');
      if (r.clienteId && !d.clientes.some((c     ) => c.id === r.clienteId)) throw Error('Falta un cliente del respaldo.');
      if (r.viajeId && !d.viajes.some((v     ) => v.id === r.viajeId && (!r.clienteId || v.clienteId === r.clienteId))) throw Error('La referencia al viaje no coincide.');
      if (r.archivoId && !d.archivos.some((a     ) => a.id === r.archivoId)) throw Error('Falta un archivo del respaldo.');
      if (r.entregaArchivoId && !d.archivos.some((a     ) => a.id === r.entregaArchivoId)) throw Error('Falta la constancia de entrega del respaldo.');
    }
  }
  d.cobros.forEach(validarCobro);
  const c = d.config;
  if (!c || !['viaje','cobro'].includes(c.criterio)) throw Error('Revisá el criterio del resultado.');
  for (const k of ['anticipacionDias','anticipacionKm','maxDiasLectura','kmPorDiaMax']) if (!Number.isSafeInteger(c[k]) || c[k] < (k === 'kmPorDiaMax' ? 1 : 0)) throw Error('Revisá las anticipaciones y los kilómetros en Ajustes.');
  d.camiones.forEach((v     , i        ) => validarNuevoCamion(v, d.camiones.slice(0, i)));
  for (const l of d.lecturas) {
    registrarLecturaKm([], l, c);
    if (!l.anulado && l.resultado !== 'a-revisar') registrarLecturaKm(d.lecturas.filter((r     ) => r.id !== l.id && !r.anulado && r.resultado !== 'a-revisar'), l, c);
  }
  d.clientes.forEach((v     ) => { if (typeof v.nombre !== 'string' || !v.nombre.trim()) throw Error('Falta el nombre de un cliente.'); estadoCuentaCliente(v, d.viajes, d.cobros, '2026-10-21'); cuentaCliente(d,v,'2026-10-21'); });
  d.papeles.forEach((v     ) => { if (typeof v.tipo !== 'string' || !v.tipo.trim()) throw Error('Falta el tipo de un papel.'); estadoPapel(v, '2026-10-21', c); });
  d.planes.forEach((p     ) => { if (typeof p.tarea !== 'string' || !p.tarea.trim()) throw Error('Falta la tarea de un plan.'); limitesPlan(p); });
  for (const g of d.gastos) {
    if (g.tipo !== 'gasto') throw Error('Hay un gasto que no se puede leer.');
    resumenFlota(espacio, g.fecha.slice(0, 7), d.camiones.map((c     ) => c.id), [g]);
  }
  d.services.forEach((s     ) => completarService(d.planes, s));
  for (const a of d.archivos) if (typeof a.nombre !== 'string' || !(a.blob instanceof Blob && ['image/jpeg','application/pdf'].includes(a.blob.type)) && !/^data:(image\/jpeg|application\/pdf);base64,[A-Za-z0-9+/]*={0,2}$/.test(a.datos)) throw Error('Un archivo del respaldo no se puede abrir.');
  const movs = movimientos(d);
  const meses = new Set(movs.map((m     ) => m.fecha.slice(0, 7)));
  for (const mes of meses) resumenFlota(espacio, mes, d.camiones.map((c     ) => c.id), movs);
  return d;
}
export const exportar = (d     )         => JSON.stringify(validarDatos(d, d.espacio), null, 2);
export function importar(texto        , espacio        ) { let d; try { d = JSON.parse(texto); } catch { throw Error('No se pudo leer el respaldo. Elegí el archivo exportado por FleetIQ.'); } return validarDatos(d, espacio); }
