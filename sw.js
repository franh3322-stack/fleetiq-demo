// Cambiar la versión al modificar los archivos de la app. No guarda datos ni API.
const CACHE = 'fleetiq-app-demo-e067a323e7';
const ARCHIVOS = [
  './', './index.html', './estilo.css', './app.js', './datos.js', './almacen.js',
  './dominio/camiones.js', './dominio/viajes-cobros.js', './dominio/vencimientos.js',
  './dominio/saldo-mensual.js', './manifest.webmanifest', './icono-192.png', './icono-512.png',
  './ui/sesion.js', './ui/elementos.js', './ui/formularios.js', './ui/registros.js',
  './ui/navegacion.js', './ui/formato.js', './ui/validacion.js', './ui/avisos.js', './ui/adjuntos.js',
  './pantallas/inicio.js', './pantallas/camiones.js', './pantallas/cargas.js',
  './pantallas/cobros.js', './pantallas/mantenimiento.js', './pantallas/papeles.js', './pantallas/mas.js',
];
const permitidos = new Set(ARCHIVOS.map(p => new URL(p, self.registration.scope).href));
function valida(r, url) {
  if (!r.ok || r.redirected || r.type === 'opaque') return false;
  const tipo = r.headers.get('content-type') ?? '';
  if (url.endsWith('.js')) return /^(text|application)\/javascript\b/.test(tipo);
  if (url.endsWith('.css')) return tipo.startsWith('text/css');
  if (url.endsWith('.png')) return tipo.startsWith('image/png');
  if (url.endsWith('.webmanifest')) return /^(application\/manifest\+json|application\/json)\b/.test(tipo);
  return tipo.startsWith('text/html');
}
self.addEventListener('install', event => {
  // Solo activa si la copia está completa. Una actualización fallida deja la anterior.
  event.waitUntil((async () => {
    const respuestas = await Promise.all(ARCHIVOS.map(async p => {
      const url = new URL(p, self.registration.scope).href;
      const r = await fetch(url, { cache: 'no-cache' });
      if (!valida(r, url)) throw Error('Archivo de app inválido: ' + p);
      return [url, r];
    }));
    const cache = await caches.open(CACHE);
    await Promise.all(respuestas.map(([url, r]) => cache.put(url, r)));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('fleetiq-app-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !permitidos.has(req.url)) return;
  // Una versión completa y coherente; los errores de red nunca reemplazan la copia buena.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(req);
    if (guardada) return guardada;
    const r = await fetch(req);
    if (valida(r, req.url)) await cache.put(req, r.clone());
    return r;
  })());
});
