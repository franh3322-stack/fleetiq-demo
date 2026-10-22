import { validarDatos } from './datos.js';
export const entidades = ['camiones','viajes','clientes','cobros','gastos','papeles','planes','services','reparaciones','lecturas','historial','archivos'];
const cache = new WeakMap();
const pedir = r => new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.errorBloqueado || r.error);});
const terminar = tx => new Promise((ok,no)=>{tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error || Error('Se canceló el guardado.'));});
export function convertirArchivo(a) {
  if(a.blob instanceof Blob)return a;
  const [cabecera,base64]=a.datos.split(',');const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const {datos,...resto}=a;return {...resto,blob:new Blob([bytes],{type:cabecera.slice(5).split(';')[0]})};
}
export function preparar(d){return {...d,archivos:d.archivos.map(convertirArchivo)};}
// La comparación evita escribir entidades o archivos que no cambiaron.
// Los Blob son inmutables: la app conserva su identidad entre cargas.
export function cambios(antes,despues){
  const resultado=[];
  for(const entidad of entidades){
    const prev=new Map((antes?.[entidad]??[]).map((r,i)=>[r.id,{registro:r,orden:i}]));
    despues[entidad].forEach((r,i)=>{
      const anterior=prev.get(r.id),a=anterior?.registro;
      if(!a || anterior.orden!==i || (entidad==='archivos'?a.blob!==r.blob || a.nombre!==r.nombre:JSON.stringify(a)!==JSON.stringify(r)))resultado.push({entidad,accion:'put',registro:r});
      prev.delete(r.id);
    });
    for(const id of prev.keys())resultado.push({entidad,accion:'delete',registro:{id}});
  }
  const meta=d=>Object.fromEntries(Object.entries(d??{}).filter(([k])=>!entidades.includes(k)));
  if(JSON.stringify(meta(antes))!==JSON.stringify(meta(despues)))resultado.push({entidad:'meta',accion:'put',registro:meta(despues)});
  return resultado;
}
export async function abrir(espacio){
  const r=indexedDB.open('fleetiq-etapa1-'+espacio,2);
  r.onupgradeneeded=()=>{for(const n of [...entidades,'meta','ops'])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n);};
  r.onblocked=()=>{r.errorBloqueado=Error('Cerrá las otras pestañas de FleetIQ y volvé a abrir para actualizar el guardado.');r.onerror?.();};
  const db=await pedir(r);db.onversionchange=()=>db.close();
  try { if(db.objectStoreNames.contains('estado')){
    const viejo=await pedir(db.transaction('estado').objectStore('estado').get('datos'));
    const existe=await pedir(db.transaction('meta').objectStore('meta').get('datos'));
    if(viejo && !existe){validarDatos(viejo,espacio);const d=preparar(viejo);await escribir(db,d,null,true);}
  }
  return db;
  } catch(err){db.close();throw err;}
}
async function escribir(db,d,antes,migracion=false){
 const delta=cambios(antes,d);if(!delta.length)return;
 const stores=[...new Set([...delta.map(c=>c.entidad),'ops',...(migracion?['estado']:[])])];
 const tx=db.transaction(stores,'readwrite');const fin=terminar(tx);
 for(const c of delta){
   const key=c.entidad==='meta'?'datos':c.registro.id;
   // Orden separado del registro de negocio: getAll() ordena por clave en IndexedDB.
   const fila=c.entidad==='meta'?c.registro:{registro:c.registro,orden:d[c.entidad].findIndex(r=>r.id===key)};
   tx.objectStore(c.entidad)[c.accion](...(c.accion==='put'?[fila,key]:[key]));
   const opId=crypto.randomUUID();
   // Los bytes se obtienen del almacén archivos; nunca se duplican en la cola.
   tx.objectStore('ops').put({id:opId,opId,empresaId:d.empresaId,entidad:c.entidad,registroId:key,accion:c.accion,fecha:new Date().toISOString(),estado:'pendiente',registro:c.entidad==='archivos'?{id:key,nombre:c.registro.nombre}:c.registro},opId);
 }
 if(migracion)tx.objectStore('estado').delete('datos');await fin;cache.set(db,{...structuredClone({...d,archivos:[]}),archivos:d.archivos.map(a=>({...a}))});
}
export async function leer(db){const tx=db.transaction([...entidades,'meta']);const requests=[pedir(tx.objectStore('meta').get('datos')),...entidades.map(n=>pedir(tx.objectStore(n).getAll()))];const [meta,...listas]=await Promise.all(requests);if(!meta)return undefined;const d={...meta};entidades.forEach((n,i)=>d[n]=listas[i].sort((a,b)=>a.orden-b.orden).map(r=>r.registro));cache.set(db,d);return d;}
export async function guardar(db,datos){const d=preparar(datos);await escribir(db,d,cache.get(db));datos.archivos=d.archivos;}
export async function paraRespaldo(d){return {...d,archivos:await Promise.all(d.archivos.map(async a=>{if(a.datos)return a;const bytes=new Uint8Array(await a.blob.arrayBuffer());let bin='';for(const b of bytes)bin+=String.fromCharCode(b);const {blob,...resto}=a;return {...resto,datos:'data:'+blob.type+';base64,'+btoa(bin)};}))};}
export async function adjunto(file, empresaId) {
  if (!file?.size) return null;
  if (file.size > 30 * 1024 * 1024) throw Error('El archivo es muy grande. Elegí uno de hasta 30 MB.');
  let blob = file;
  if (file.type.startsWith('image/')) {
    const image = await createImageBitmap(file);
    const ratio = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .7));
    if (!blob) throw Error('No se pudo preparar la foto. Probá con otra.');
  } else if (file.type !== 'application/pdf' || new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== '%PDF-') throw Error('Elegí una foto o un PDF.');
  return { id: crypto.randomUUID(), empresaId, blob, nombre: file.type.startsWith('image/') ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name };
}
