// Generado desde src/: ejecutar npm run construir.
/** Presentación local sin convertir zona horaria ni modificar los datos guardados. */
export function formatoFecha(texto        )         {
  return texto.replace(/\b(\d{4})-(\d{2})-(\d{2})(?=\b|T)/g, '$3/$2/$1');
}

// Papeles, mantenimiento y avisos (T-014). Contrato: src/CONTRATO.md. Funciones puras, sin dependencias.
                                                     

// ---------- Fechas ----------
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
function diaUTC(fecha        , campo        )         {
  const m = FECHA.exec(fecha ?? '');
  if (!m) throw new Error(`${campo}: fecha inválida, se espera AAAA-MM-DD.`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const base = new Date(0);
  base.setUTCFullYear(a, mes - 1, d);
  const t = base.getTime();
  const v = new Date(t);
  if (v.getUTCFullYear() !== a || v.getUTCMonth() !== mes - 1 || v.getUTCDate() !== d) throw new Error(`${campo}: la fecha ${fecha} no existe.`);
  return t / 86400000;
}
/** Suma meses de calendario; si el día no existe, usa el último día del mes. */
export function sumarMeses(fecha        , meses        )         {
  diaUTC(fecha, 'Fecha'); entero(meses, 'Meses', 1);
  const [a, m, d] = fecha.split('-').map(Number);
  const destino = a * 12 + m - 1 + meses;
  const anio = Math.floor(destino / 12), mes = destino % 12;
  if (!Number.isSafeInteger(destino) || anio > 9999) throw new Error('La próxima fecha queda fuera del rango AAAA-MM-DD.');
  const fin = new Date(0); fin.setUTCFullYear(anio, mes + 1, 0);
  const resultado = new Date(0); resultado.setUTCFullYear(anio, mes, Math.min(d, fin.getUTCDate()));
  return resultado.toISOString().slice(0, 10);
}
export function diasDeMeses(fecha        , meses        )         {
  return diasEntre(fecha, sumarMeses(fecha, meses));
}
const diasEntre = (desde        , hasta        , campo = 'Fecha') => diaUTC(hasta, campo) - diaUTC(desde, campo);
function sumarDias(fecha        , dias        )         {
  const resultado = new Date((diaUTC(fecha, 'Fecha') + dias) * 86400000);
  if (!Number.isFinite(resultado.getTime()) || resultado.getUTCFullYear() > 9999 || resultado.getUTCFullYear() < 0) throw new Error('La próxima fecha queda fuera del rango AAAA-MM-DD (años 0000 a 9999).');
  return resultado.toISOString().slice(0, 10);
}
const entero = (n         , campo        , min = 0) => {
  if (!Number.isSafeInteger(n) || (n          ) < min) throw new Error(`${campo}: tiene que ser un número entero${min > 0 ? ` mayor o igual a ${min}` : ' sin signo'}.`);
  return n          ;
};

// ---------- Papeles ----------
                                                                                                                       
                                                                                             

export function estadoPapel(papel       , hoy        , { anticipacionDias = 30 /* SUPUESTO S-08 */ } = {})              {
  diaUTC(hoy, 'Hoy');
  entero(anticipacionDias, 'Anticipación de papeles');
  if (!papel.vence) return 'sin-vencimiento';
  const dias = diasEntre(hoy, papel.vence, `Papel ${papel.id}`);
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'vence-hoy';
  return dias <= anticipacionDias ? 'proximo' : 'al-dia';
}

// ---------- Mantenimiento ----------
                       
                                                                 
                                                                                       
                                                                                                                         
                                                        
                                                                                           
                                                     
 
                                                        
                                                                                                             
                                                                                                                                                     

const GRAVEDAD                             = { vencido: 0, alcanzado: 1, 'km-incierto': 2, proximo: 3, 'al-dia': 4, 'sin-programacion': 5 };
const kmFmt = (n        ) => new Intl.NumberFormat('es-AR').format(n);

function validarPlan(plan      )       {
  for (const campo of ['cadaKm', 'cadaDias', 'cadaMeses', 'ultimoKm', 'proximoKm', 'anticipacionKm', 'anticipacionDias']         ) {
    if (plan[campo] != null) entero(plan[campo], `Plan ${plan.id}: ${campo}`, campo === 'ultimoKm' || campo === 'proximoKm' ? 0 : 1);
  }
  if (plan.ultimaFecha != null) diaUTC(plan.ultimaFecha, `Plan ${plan.id}`);
  if (plan.proximaFecha != null) diaUTC(plan.proximaFecha, `Plan ${plan.id}`);
}

export function limitesPlan(plan      )                                              {
  validarPlan(plan);
  // null: sugerencia pendiente de confirmación; undefined: cálculo inicial del contrato.
  const limiteKm = plan.proximoKm === null ? undefined : plan.proximoKm ?? (plan.ultimoKm != null && plan.cadaKm ? entero(plan.ultimoKm + plan.cadaKm, `Plan ${plan.id}: límite km`) : undefined);
  const limiteFecha = plan.proximaFecha === null ? undefined : plan.proximaFecha ?? (plan.ultimaFecha && (plan.cadaMeses || plan.cadaDias) ? sumarDias(plan.ultimaFecha, plan.cadaMeses ? diasDeMeses(plan.ultimaFecha, plan.cadaMeses) : plan.cadaDias ) : undefined);
  return { limiteKm: limiteKm ?? undefined, limiteFecha: limiteFecha ?? undefined };
}

export function estadoPlan(plan      , lectura                  , hoy        , { maxDiasLectura = 15 /* SUPUESTO S-09 */ } = {})                {
  diaUTC(hoy, 'Hoy');
  entero(maxDiasLectura, 'Antigüedad máxima de la lectura');
  if (lectura) { entero(lectura.km, `Plan ${plan.id}: lectura km`); diaUTC(lectura.fecha, 'Lectura de km'); }
  const antKm = plan.anticipacionKm ?? 1000, antDias = plan.anticipacionDias ?? 30;   // SUPUESTO S-08
  const { limiteKm, limiteFecha } = limitesPlan(plan);
  if (limiteKm == null && limiteFecha == null) return { estado: 'sin-programacion', motivo: 'Todavía no tiene próximo service programado.' };
  const candidatos                  = [];
  if (limiteFecha != null) {
    const dias = diasEntre(hoy, limiteFecha, `Plan ${plan.id}`);
    if (dias < 0) candidatos.push({ estado: 'vencido', motivo: `Venció por fecha el ${formatoFecha(limiteFecha)}.`, faltanDias: dias });
    else if (dias === 0) candidatos.push({ estado: 'alcanzado', motivo: 'Vence hoy por fecha.', faltanDias: 0 });
    else candidatos.push({ estado: dias <= antDias ? 'proximo' : 'al-dia', motivo: `Vence el ${formatoFecha(limiteFecha)}.`, faltanDias: dias });
  }
  if (limiteKm != null) {
    if (!lectura) candidatos.push({ estado: 'km-incierto', motivo: 'No hay kilometraje cargado. Actualizalo para saber cuánto falta.' });
    else {
      const vieja = diasEntre(lectura.fecha, hoy, 'Lectura de km') > maxDiasLectura;
      // Un km ya superado prueba el vencimiento aunque la lectura sea vieja (caso 8); uno por debajo, con lectura vieja, no prueba nada (caso 7).
      if (lectura.km > limiteKm) candidatos.push({ estado: 'vencido', motivo: `Pasó el límite de ${kmFmt(limiteKm)} km.`, faltaKm: limiteKm - lectura.km });
      else if (lectura.km === limiteKm) candidatos.push({ estado: 'alcanzado', motivo: `Llegó a los ${kmFmt(limiteKm)} km.`, faltaKm: 0 });
      else if (vieja) candidatos.push({ estado: 'km-incierto', motivo: `El último kilometraje es del ${formatoFecha(lectura.fecha)}. Actualizalo para saber cuánto falta.` });
      else {
        const falta = limiteKm - lectura.km;
        candidatos.push({ estado: falta <= antKm ? 'proximo' : 'al-dia', motivo: `Faltan ${kmFmt(falta)} km.`, faltaKm: falta });
      }
    }
  }
  candidatos.sort((a, b) => GRAVEDAD[a.estado] - GRAVEDAD[b.estado]);
  const peor = { ...candidatos[0], limiteKm, limiteFecha };
  // Si hay dos límites y ninguno venció, se dice "lo que llegue primero".
  if (candidatos.length === 2 && GRAVEDAD[peor.estado] >= GRAVEDAD.proximo) {
    const otro = candidatos[1];
    peor.motivo = `${candidatos[0].motivo.replace(/\.$/, '')} o ${otro.motivo.charAt(0).toLowerCase()}${otro.motivo.slice(1).replace(/\.$/, '')}, lo que llegue primero.`;
  }
  return peor;
}

                          
                                                                             
                                                                                                        
                                                                              
 
                                                                                       

function validarService(s         , planes                 ) {
  if (!s?.id) throw new Error('Al service le falta el id.');
  diaUTC(s.fecha, `Service ${s.id}`);
  entero(s.km, `Service ${s.id}: kilómetros`);
  entero(s.costoCentavos, `Service ${s.id}: costo`);
  if (!Array.isArray(s.planIds) || s.planIds.length === 0) throw new Error(`Service ${s.id}: marcá al menos una tarea hecha.`);
  if (new Set(s.planIds).size !== s.planIds.length) throw new Error(`Service ${s.id}: una tarea está repetida.`);
  for (const id of s.planIds) {
    const p = planes.find(x => x.id === id && x.empresaId === s.empresaId && x.camionId === s.camionId);
    if (!p && planes.some(x => x.id === id)) throw new Error(`Service ${s.id}: la tarea ${id} es de otro camión o empresa.`);
    if (!p) throw new Error(`Service ${s.id}: la tarea ${id} no existe.`);
    validarPlan(p);
    if (p.empresaId !== s.empresaId || p.camionId !== s.camionId) throw new Error(`Service ${s.id}: la tarea ${id} es de otro camión.`);
  }
}

export const gastoDeService = (s         )             => ({
  id: `gasto-service-${s.id}`, empresaId: s.empresaId, camionId: s.camionId, fecha: s.fecha,
  tipo: 'gasto', categoria: 'mantenimiento', importeCentavos: s.costoCentavos,
});

/** Completa un service programado. Solo cierra las tareas hechas; no hace retroceder un plan; un solo gasto, con id estable. */
export function completarService(planes                 , service         , historial                     = []) {
  validarService(service, planes);
  const previo = historial.find(h => h.id === service.id && h.empresaId === service.empresaId);
  if (previo) {
    if (previo.camionId !== service.camionId) throw new Error(`Service ${service.id}: el id corresponde a otro camión.`);
    return { planes: [...planes], gasto: gastoDeService(previo), sugeridos: []              , duplicado: true };
  }
  const sugeridos             = [];
  const nuevos = planes.map(p => {
    if (p.empresaId !== service.empresaId || p.camionId !== service.camionId || !service.planIds.includes(p.id)) return p; // solo tareas propias hechas
    if (p.ultimaFecha && diasEntre(p.ultimaFecha, service.fecha) < 0) return p;   // service más viejo que el último: solo historial (caso 14)
    const sug           = { planId: p.id };
    if (p.cadaKm) sug.proximoKm = entero(service.km + p.cadaKm, `Plan ${p.id}: próximo km`);
    if (p.cadaMeses || p.cadaDias) sug.proximaFecha = sumarDias(service.fecha, p.cadaMeses ? diasDeMeses(service.fecha, p.cadaMeses) : p.cadaDias );
    sugeridos.push(sug);
    // El próximo queda como sugerencia hasta que el usuario lo confirme.
    return { ...p, ...(p.cadaMeses ? { cadaDias: diasDeMeses(service.fecha, p.cadaMeses) } : {}), ultimoKm: service.km, ultimaFecha: service.fecha, proximoKm: null, proximaFecha: null };
  });
  return { planes: nuevos, gasto: gastoDeService(service), sugeridos, duplicado: false };
}

export function confirmarProximo(plan      , { proximoKm, proximaFecha }                                                             )       {
  if (proximoKm != null) entero(proximoKm, `Plan ${plan.id}: próximo km`);
  if (proximaFecha != null) diaUTC(proximaFecha, `Plan ${plan.id}: próxima fecha`);
  if (proximoKm == null && proximaFecha == null) throw new Error(`Plan ${plan.id}: indicá un próximo kilometraje, una fecha o los dos.`);
  return { ...plan, proximoKm: proximoKm ?? null, proximaFecha: proximaFecha ?? null };
}

/** Corrige el costo de un service: el gasto conserva su id (no se duplica) y queda el historial del cambio (caso 16). */
export function corregirCostoService(service         , costoCentavos        , fecha        , motivo        )                                          {
  entero(costoCentavos, `Service ${service.id}: costo`);
  diaUTC(fecha, 'Fecha de la corrección');
  if (!motivo?.trim()) throw new Error('Contá brevemente por qué se corrige el costo.');
  const corregido          = { ...service, costoCentavos,
    historialCosto: [...(service.historialCosto ?? []), { fecha, costoCentavos: service.costoCentavos, motivo: motivo.trim() }] };
  return { service: corregido, gasto: gastoDeService(corregido) };
}

/** Reparación por falla: es un gasto de categoría reparación y NO toca los planes (caso 13). */
                                                                                                                                                           
export function gastoDeReparacion(r            )             {
  diaUTC(r.fecha, `Reparación ${r.id}`);
  entero(r.costoCentavos, `Reparación ${r.id}: costo`);
  if (!r.descripcion?.trim()) throw new Error(`Reparación ${r.id}: contá qué se reparó.`);
  return { id: `gasto-reparacion-${r.id}`, empresaId: r.empresaId, camionId: r.camionId, fecha: r.fecha, tipo: 'gasto', categoria: 'reparacion', importeCentavos: r.costoCentavos };
}

// ---------- Avisos ("Para atender") ----------
                                                                                                                                                                                               
                                                                                             

export function avisos({ papeles = [], planes = [], kmPorCamion = {}, cuentas = [], hoy, config = {} }   
                                                                                                       
                                                                                                                   
 )          {
  diaUTC(hoy, 'Hoy');
  const porClave = new Map               ();                       // una clave por cosa: nunca dos avisos de lo mismo
  const poner = (a       ) => { const previo = porClave.get(a.clave); if (!previo || a.gravedad < previo.gravedad) porClave.set(a.clave, a); };
  const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  for (const p of papeles) {
    const e = estadoPapel(p, hoy, { anticipacionDias: config.anticipacionDias });
    if (e === 'al-dia' || e === 'sin-vencimiento') continue;
    poner({ clave: `papel:${p.id}`, tipo: 'papel', gravedad: e === 'proximo' ? 3 : 1, estado: e, refId: p.id, camionId: p.camionId ?? null,
      titulo: p.tipo, detalle: e === 'vencido' ? `Venció el ${formatoFecha(p.vence ?? "")}.` : e === 'vence-hoy' ? 'Vence hoy.' : `Vence el ${formatoFecha(p.vence ?? "")}.` });
  }
  for (const pl of planes) {
    const r = estadoPlan(pl, kmPorCamion[pl.camionId] ?? null, hoy, { maxDiasLectura: config.maxDiasLectura });
    if (r.estado === 'al-dia' || r.estado === 'sin-programacion') continue;
    poner({ clave: `mantenimiento:${pl.id}`, tipo: 'mantenimiento', gravedad: r.estado === 'proximo' ? 3 : r.estado === 'km-incierto' ? 2 : 1,
      estado: r.estado, refId: pl.id, camionId: pl.camionId, titulo: pl.tarea, detalle: r.motivo });
  }
  for (const c of cuentas) {
    if (!(c.vencidoCentavos > 0)) continue;
    poner({ clave: `cobro:${c.clienteId}`, tipo: 'cobro', gravedad: 1, estado: 'vencido', refId: c.clienteId,
      titulo: `Cobro vencido: ${c.nombre}`, detalle: `Debe ${moneda.format(c.vencidoCentavos / 100).replace(/\s/g, ' ')} ya vencidos.` });
  }
  return [...porClave.values()].sort((a, b) => a.gravedad - b.gravedad || a.titulo.localeCompare(b.titulo, 'es') || a.clave.localeCompare(b.clave));
}
