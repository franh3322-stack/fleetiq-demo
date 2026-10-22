// Generado desde src/: ejecutar npm run construir.
                         
             
                    
                  
                  
                   
 

                                                                               
                            
             
                    
                   
                
             
                           
                               
 

export function normalizarPatente(texto        )         {
  const patente = typeof texto === 'string' ? texto.replace(/[\s-]/g, '').toUpperCase() : '';
  if (!/^(?:[A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/.test(patente)) {
    throw new Error('Patente inválida. Ejemplos: AB 123 CD o ABC 123.');
  }
  return patente;
}

export function mostrarPatente(patente        )         {
  const p = normalizarPatente(patente);
  return p.length === 7 ? `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}` : `${p.slice(0, 3)} ${p.slice(3)}`;
}

export function validarNuevoCamion(camion        , existentes                   )       {
  const patente = normalizarPatente(camion.patente);
  if (existentes.some(c => c.empresaId === camion.empresaId && normalizarPatente(c.patente) === patente)) {
    throw new Error(`Ya existe un camión con la patente ${mostrarPatente(patente)}.`);
  }
}

function textoBusqueda(texto        )         {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').replace(/[\s-]/g, '').toUpperCase();
}

// La lista debe venir limitada a la empresa que puede consultar quien llama.
export function buscarCamiones(camiones                   , consulta        , { incluirInactivos = false } = {})           {
  const buscado = textoBusqueda(consulta);
  return camiones.filter(c => (incluirInactivos || c.activo !== false)
    && [c.patente, c.nombre ?? ''].some(t => textoBusqueda(t).includes(buscado)))
    .sort((a, b) => normalizarPatente(a.patente).localeCompare(normalizarPatente(b.patente)));
}

function dia(fecha        )         {
  const ms = Date.parse(`${fecha}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== fecha) {
    throw new Error(`Fecha inválida: ${fecha}; se espera AAAA-MM-DD.`);
  }
  return ms / 86400000;
}

function validarLectura(l           )       {
  dia(l.fecha);
  if (!Number.isSafeInteger(l.km) || l.km < 0) throw new Error(`Lectura ${l.id}: km inválidos; deben ser enteros no negativos seguros.`);
  if (l.resultado !== undefined && !['aceptada', 'aceptada-historica', 'a-revisar'].includes(l.resultado)) {
    throw new Error(`Lectura ${l.id}: resultado inválido.`);
  }
}

export function registrarLecturaKm(lecturas                      , nueva           , { kmPorDiaMax = 1500 } = {})                                                         {
  // SUPUESTO S-10: umbral configurable, no una distancia máxima comprobada del negocio.
  if (!Number.isFinite(kmPorDiaMax) || kmPorDiaMax <= 0) throw new Error('El límite de km por día debe ser positivo y finito.');
  validarLectura(nueva);
  const propias = lecturas.filter(l => l.empresaId === nueva.empresaId && l.camionId === nueva.camionId);
  propias.forEach(validarLectura);
  if (lecturas.some(l => l.empresaId === nueva.empresaId && l.id === nueva.id)) throw new Error(`Lectura ${nueva.id}: id repetido.`);
  const aceptadas = propias.filter(l => l.resultado !== 'a-revisar').sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (aceptadas.some(l => l.fecha === nueva.fecha)) throw new Error(`Lectura ${nueva.id}: ya existe una lectura aceptada en esa fecha.`);
  const anterior = aceptadas.filter(l => l.fecha < nueva.fecha).at(-1);
  const siguiente = aceptadas.find(l => l.fecha > nueva.fecha);
  if (anterior && nueva.km < anterior.km && !nueva.cambioOdometro) throw new Error(`Lectura ${nueva.id}: los km son menores a la lectura anterior; indicá el cambio de odómetro si corresponde.`);
  if (siguiente && nueva.km > siguiente.km && !siguiente.cambioOdometro) throw new Error(`Lectura ${nueva.id}: los km superan la lectura siguiente.`);
  let resultado                   = siguiente ? 'aceptada-historica' : 'aceptada';
  if (anterior && !nueva.cambioOdometro && (nueva.km - anterior.km) / (dia(nueva.fecha) - dia(anterior.fecha)) > kmPorDiaMax) resultado = 'a-revisar';
  return { lecturas: [...lecturas.map(l => ({ ...l })), { ...nueva, resultado }].sort((a, b) => a.fecha.localeCompare(b.fecha)), resultado };
}

// Recibe lecturas de un solo camión y empresa; mezclar identidades sería ambiguo.
export function kmActual(lecturas                      )                                       {
  if (lecturas.some(l => l.empresaId !== lecturas[0].empresaId || l.camionId !== lecturas[0].camionId)) throw new Error('Consultá los km de un solo camión y empresa por vez.');
  lecturas.forEach(validarLectura);
  const ultima = lecturas.filter(l => l.resultado !== 'a-revisar').sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
  return ultima ? { km: ultima.km, fecha: ultima.fecha } : null;
}
