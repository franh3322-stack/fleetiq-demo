// Generado desde src/: ejecutar npm run construir.
import { registrarLecturaKm } from './camiones.js';

export const claveNombre = (s        )         => s.replace(/\s/g, '').toLocaleLowerCase('es-AR');
export function validarChofer(c     , existentes                )       {
  if (typeof c.nombre !== 'string' || !c.nombre.trim()) throw Error('Escribí el nombre del chofer.');
  if (c.activo !== undefined && typeof c.activo !== 'boolean') throw Error('Revisá si el chofer está activo.');
  if (c.telefono !== undefined && typeof c.telefono !== 'string') throw Error('Revisá el teléfono del chofer.');
  if (existentes.some(x => x.empresaId === c.empresaId && x.id !== c.id && claveNombre(x.nombre) === claveNombre(c.nombre))) throw Error('Ya existe un chofer con ese nombre en la empresa.');
}
// Solo coincidencia literal: nunca asigna automáticamente un texto viejo.
export function coincidenciaChofer(texto        , choferes                )      {
  return choferes.find(c => c.activo !== false && c.nombre === texto);
}
export function leerDecimal(texto        , decimales        )                     {
  if (!texto.trim()) return undefined;
  const patron = new RegExp('^(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,' + decimales + '})?$');
  if (!patron.test(texto.trim())) throw Error('Usá coma para los decimales, hasta ' + decimales + ' cifras.');
  const [entero, fraccion = ''] = texto.trim().replaceAll('.', '').split(',');
  const n = Number(BigInt(entero) * 10n ** BigInt(decimales) + BigInt(fraccion.padEnd(decimales, '0')));
  if (!Number.isSafeInteger(n) || n < 0) throw Error('El número es demasiado grande.');
  return n;
}
export function tarifaTonelada(precioMilesimas        , toneladasMilesimas        )         {
  for (const n of [precioMilesimas, toneladasMilesimas]) if (!Number.isSafeInteger(n) || n <= 0) throw Error('Escribí precio y toneladas mayores a cero.');
  // Mitad hacia arriba al centavo; enteros BigInt evitan error binario y productos inseguros.
  const total = (BigInt(precioMilesimas) * BigInt(toneladasMilesimas) + 5000n) / 10000n;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('La tarifa es demasiado grande.');
  return Number(total);
}
export function validarCombustible(g     )       {
  if ((g.litrosCentesimas !== undefined || g.km !== undefined) && g.categoria !== 'combustible') throw Error('Litros y odómetro son solo para combustible.');
  if (g.litrosCentesimas !== undefined && (!Number.isSafeInteger(g.litrosCentesimas) || g.litrosCentesimas <= 0)) throw Error('Escribí litros mayores a cero, hasta dos decimales.');
  if (g.km !== undefined && (!Number.isSafeInteger(g.km) || g.km < 0 || !g.camionId)) throw Error('Para cargar km elegí un camión y un número entero sin signo.');
}
// Se llama dentro de la transacción de gasto. Conserva id, anulaciones e historial anterior.
export function sincronizarLecturaGasto(d     , g     )       {
  validarCombustible(g);
  const previa = d.lecturas.find((l     ) => l.gastoId === g.id);
  if (previa) d.historial.push({id: crypto.randomUUID(), empresaId:d.empresaId, fecha:g.fecha, tipo:'lecturas', registroId:previa.id, motivo:'Cambio del gasto de combustible', antes:structuredClone(previa)});
  if (g.anulado || g.km === undefined) {
    if (previa) previa.anulado = g.anulado ?? {fecha:g.fecha, motivo:'Se retiraron los km del gasto'};
    return;
  }
  const lectura = {id:previa?.id ?? 'combustible:' + g.id, empresaId:g.empresaId, camionId:g.camionId, fecha:g.fecha, km:g.km, gastoId:g.id};
  const resultado = registrarLecturaKm(d.lecturas.filter((l     ) => !l.anulado && l.id !== lectura.id), lectura, d.config);
  const nueva = resultado.lecturas.find(l => l.id === lectura.id);
  if (previa) d.lecturas[d.lecturas.indexOf(previa)] = nueva; else d.lecturas.push(nueva);
}
export function consumoCombustible(d     , camionId        , mes        )                                                                         {
  const cargas = d.gastos.filter((g     ) => g.empresaId === d.empresaId && g.camionId === camionId && g.categoria === 'combustible' && !g.anulado && g.km !== undefined && g.litrosCentesimas > 0).sort((a     ,b     ) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  const intervalos        = [];
  for (let i=1;i<cargas.length;i++) {
    const a=cargas[i-1], b=cargas[i];
    const lectura = (g     ) => d.lecturas.find((l     ) => l.empresaId === d.empresaId && l.camionId === camionId && l.gastoId === g.id && !l.anulado && l.resultado !== 'a-revisar' && l.km === g.km && l.fecha === g.fecha);
    const km = b.km-a.km;
    const cambio = d.lecturas.some((l     ) => !l.anulado && l.empresaId===d.empresaId && l.camionId===camionId && l.fecha>a.fecha && l.fecha<=b.fecha && l.cambioOdometro);
    if (!lectura(a) || !lectura(b) || km<=0 || cambio) continue;
    intervalos.push({fecha:b.fecha, km, litrosCentesimas:b.litrosCentesimas, consumo:b.litrosCentesimas/km});
  }
  const delMes=intervalos.filter(x=>x.fecha.slice(0,7)===mes);
  return {ultimo:intervalos.at(-1)?.consumo ?? null, promedioMes:delMes.length ? delMes.reduce((s,x)=>s+x.litrosCentesimas,0)/delMes.reduce((s,x)=>s+x.km,0) : null, intervalos};
}
