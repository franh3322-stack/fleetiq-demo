// Generado desde src/: ejecutar npm run construir.
                                                                                                        

                          
             
                    
                
                          
 

// Unión discriminada: un ingreso siempre tiene camión y un gasto siempre tiene categoría.
// Node solo quita los tipos y no los verifica, así que las mismas reglas se validan también al ejecutar.
                                                 
                  
                   
 

                                               
                
                          
                       
 

                                         

                               
                   
              
                           
                         
                                                
                        
 

                               
              
                           
                                                          
                                                                                       
 

const categorias                       = ['combustible', 'peaje', 'reparacion', 'mantenimiento', 'cubiertas', 'otro'];

function validarMes(mes        )       {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new Error('Mes inválido: se espera AAAA-MM.');
  }
}

function validarFecha(fecha        )          {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= dias[mes - 1];
}

// Otras empresas se ignoran por completo. En la empresa pedida, los ids repetidos y las fechas
// inválidas se rechazan en todos los meses: sin una fecha válida no se sabe a qué mes pertenece el
// movimiento. El resto de las validaciones se aplica solo al mes pedido, para que un error de otro
// mes no le impida al dueño ver este.
function seleccionar(empresaId        , mes        , movimientos                       )               {
  validarMes(mes);
  const ids = new Set        ();
  const seleccionados               = [];
  for (const movimiento of movimientos) {
    if (movimiento.empresaId !== empresaId) continue;
    const error = (detalle        )        => { throw new Error(`Movimiento ${movimiento.id}: ${detalle}`); };
    if (ids.has(movimiento.id)) error('id repetido dentro de la misma empresa.');
    ids.add(movimiento.id);
    if (!validarFecha(movimiento.fecha)) error('fecha inválida o imposible; se espera AAAA-MM-DD.');
    if (movimiento.fecha.slice(0, 7) !== mes) continue;
    if (!Number.isSafeInteger(movimiento.importeCentavos) || movimiento.importeCentavos < 0) {
      error('importe inválido: debe ser un entero no negativo dentro del rango seguro.');
    }
    if (movimiento.tipo !== 'ingreso' && movimiento.tipo !== 'gasto') error('tipo inválido.');
    if (movimiento.tipo === 'gasto' && !categorias.includes(movimiento.categoria)) {
      error('gasto sin categoría válida.');
    }
    // El camión puede venir omitido (undefined) en datos reales aunque el tipo lo exija.
    const camionId          = movimiento.camionId;
    const camionValido = typeof camionId === 'string' && camionId !== '';
    if (movimiento.tipo === 'ingreso' && !camionValido) error('ingreso sin camión.');
    if (movimiento.tipo === 'gasto' && !camionValido && camionId !== null) {
      error('camión no indicado: para un gasto sin camión usar null.');
    }
    seleccionados.push(movimiento);
  }
  return seleccionados;
}

function sumar(actual        , importe        , id        )         {
  const suma = actual + importe;
  if (!Number.isSafeInteger(suma)) throw new Error(`Movimiento ${id}: la suma excede el rango seguro.`);
  return suma;
}

function vacio(camionId        , mes        )               {
  return {
    camionId, mes, ingresosCentavos: 0, gastosCentavos: 0,
    gastosPorCategoria: { combustible: 0, peaje: 0, reparacion: 0, mantenimiento: 0, cubiertas: 0, otro: 0 },
    saldoCentavos: 0,
  };
}

function agregar(saldo              , movimiento            )       {
  const { importeCentavos: importe, id } = movimiento;
  if (movimiento.tipo === 'ingreso') {
    saldo.ingresosCentavos = sumar(saldo.ingresosCentavos, importe, id);
  } else {
    saldo.gastosCentavos = sumar(saldo.gastosCentavos, importe, id);
    const { categoria } = movimiento;
    saldo.gastosPorCategoria[categoria] = sumar(saldo.gastosPorCategoria[categoria], importe, id);
  }
  saldo.saldoCentavos = saldo.ingresosCentavos - saldo.gastosCentavos;
}

export function saldoMensualCamion(empresaId        , camionId        , mes        , movimientos                       )               {
  const saldo = vacio(camionId, mes);
  for (const movimiento of seleccionar(empresaId, mes, movimientos)) {
    if (movimiento.camionId === camionId) agregar(saldo, movimiento);
  }
  return saldo;
}

export function resumenFlota(empresaId        , mes        , camionIds                   , movimientos                       )               {
  const seleccionados = seleccionar(empresaId, mes, movimientos);
  const porCamion = new Map                      ();
  for (const id of camionIds) {
    if (porCamion.has(id)) throw new Error(`Camión repetido en camionIds: ${id}.`);
    porCamion.set(id, vacio(id, mes));
  }
  const sinCamion = { gastosCentavos: 0, cantidad: 0 };
  const totales = { ingresosCentavos: 0, gastosCentavos: 0, saldoCentavos: 0 };
  for (const movimiento of seleccionados) {
    if (movimiento.camionId === null) {
      sinCamion.gastosCentavos = sumar(sinCamion.gastosCentavos, movimiento.importeCentavos, movimiento.id);
      sinCamion.cantidad++;
    } else {
      const saldo = porCamion.get(movimiento.camionId);
      if (!saldo) throw new Error(`Movimiento ${movimiento.id}: camión ${movimiento.camionId} no incluido en camionIds.`);
      agregar(saldo, movimiento);
    }
    const campo = movimiento.tipo === 'ingreso' ? 'ingresosCentavos' : 'gastosCentavos';
    totales[campo] = sumar(totales[campo], movimiento.importeCentavos, movimiento.id);
  }
  totales.saldoCentavos = totales.ingresosCentavos - totales.gastosCentavos;
  const camiones = [...porCamion.values()].sort((a, b) =>
    a.saldoCentavos - b.saldoCentavos || (a.camionId < b.camionId ? -1 : a.camionId > b.camionId ? 1 : 0));
  return { mes, camiones, sinCamion, totales };
}
