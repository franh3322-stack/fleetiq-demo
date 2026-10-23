import * as C from '../dominio/camiones.js';

import { vacio, demostracion, cuentaCliente, validarDatos } from '../datos.js';
import { abrir, leer, guardar } from '../almacen.js';

import { espacioInicial, mensajeUsuario, claseResultado } from './formato.js';
import { SOLO_DEMOSTRACION } from './modo.js';

// Cada pantalla usa este mismo objeto; guardar reemplaza datos solo tras confirmar la transacción.
export async function iniciarSesion(app) {
  app.soloDemostracion = SOLO_DEMOSTRACION;
  app.espacioInicial = () => (SOLO_DEMOSTRACION ? 'demo' : espacioInicial());
  app.$ = (s) => document.querySelector(s);
  app.hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  app.id = () => crypto.randomUUID();

  app.espacio = 'demo';
  app.db = undefined;
  app.datos = undefined;
  app.pagina = 'Inicio';
  app.camionElegido = null;
  app.ocupado = false;
  app.root = app.$('#contenido');
  app.dialog = app.$('#dialogo');
  app.detalle = app.$('#detalle');
  app.espacioInput = document.querySelector('#espacio');
  app.selectorEspacio = app.$('#selector-espacio');
  app.selectorEspacio.remove();
  app.mesResultado = app.hoy().slice(0, 7);
  app.estadoPwa = 'Preparando la apertura sin señal…';
  app.activo = (x) => !x.anulado;
  app.estadoLocal = (d) =>
    d.lecturas.some((l) => !l.anulado && l.resultado === 'a-revisar') ||
    d.planes.some((p) => !p.anulado && p.revisar)
      ? 'Necesita revisión'
      : 'Guardado';
  app.nombreCamion = (cid) =>
    cid ? C.mostrarPatente(app.datos.camiones.find((c) => c.id === cid)?.patente ?? '') : 'General';
  app.cliente = (cid) => app.datos.clientes.find((c) => c.id === cid)?.nombre ?? '';
  app.km = (cid) => C.kmActual(app.datos.lecturas.filter((l) => l.camionId === cid && !l.anulado));
  app.planes = () =>
    app.datos.planes.filter(app.activo).map((p) => ({
      ...p,
      anticipacionDias: p.anticipacionDias ?? app.datos.config.anticipacionDias,
      anticipacionKm: p.anticipacionKm ?? app.datos.config.anticipacionKm,
    }));
  app.cuenta = (c) => cuentaCliente(app.datos, c, app.hoy());
  app.borrador = false;
  app.dialog.oncancel = (event) => {
    event.preventDefault();
    app.volverCarga();
  };

  app.mensajeUsuario = mensajeUsuario;
  function informar(text) {
    app.abrirDialogo('Revisá antes de seguir').append(app.aviso(text));
  }
  app.informar = informar;
  function fallo(error) {
    app.$('#estado').textContent = 'Necesita revisión';
    console.error(error);
    if (app.datos)
      app.datos.soporte.push({
        fecha: new Date().toISOString(),
        detalle: String(error?.stack ?? error),
      });
    app.informar(
      app.mensajeUsuario(error) + ' Lo anterior sigue guardado.',
    );
  }
  app.fallo = fallo;
  async function cambiar(fn) {
    if (app.ocupado) return false;
    app.ocupado = true;
    app.espacioInput.disabled = true;
    const siguiente = structuredClone({
      ...app.datos,
      archivos: [],
    });
    siguiente.archivos = [...app.datos.archivos];
    try {
      await fn(siguiente);
      validarDatos(siguiente, app.espacio);
      await guardar(app.db, siguiente);
      app.datos = siguiente;
      app.$('#estado').textContent = app.estadoLocal(app.datos);
      return true;
    } finally {
      app.ocupado = false;
      app.espacioInput.disabled = false;
    }
  }
  app.cambiar = cambiar;
  function ejecutar(fn) {
    return async () => {
      try {
        await fn();
      } catch (err) {
        app.fallo(err);
      }
    };
  }
  app.ejecutar = ejecutar;
  app.confirmacion = '';
  app.campoId = 0;
  app.claseResultado = claseResultado;

  async function cargar(nuevoEspacio) {
    if (app.ocupado) return;
    // La copia pública nunca abre "Mi empresa", aunque se fuerce el selector.
    if (SOLO_DEMOSTRACION && nuevoEspacio !== 'demo') {
      app.espacioInput.value = app.espacio;
      return;
    }
    app.ocupado = true;
    app.espacioInput.disabled = true;
    try {
      const nuevaDb = await abrir(nuevoEspacio);
      let nuevos = await leer(nuevaDb);
      if (!nuevos) {
        nuevos = nuevoEspacio === 'demo' ? demostracion(app.hoy()) : vacio('real');
        await guardar(nuevaDb, nuevos);
      }
      validarDatos(nuevos, nuevoEspacio);
      app.db?.close();
      app.db = nuevaDb;
      app.datos = nuevos;
      app.espacio = nuevoEspacio;
      try {
        globalThis.localStorage?.setItem('fleetiq-espacio', app.espacio);
      } catch {}
      app.$('#demo').hidden = app.espacio !== 'demo';
      document.body.classList.toggle('es-demo', app.espacio === 'demo');
      app.espacioInput.value = app.espacio;
      app.pagina = 'Inicio';
      app.camionElegido = null;
      app.$('#estado').textContent = app.estadoLocal(app.datos);
      app.pintar();
    } catch (err) {
      app.fallo(err);
      app.espacioInput.value = app.espacio;
    } finally {
      app.ocupado = false;
      app.espacioInput.disabled = false;
    }
  }
  app.cargar = cargar;
  app.espacioInput.onchange = () => app.cargar(app.espacioInput.value);
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    app.fallo(event.reason);
  });
  await app.cargar(app.espacioInicial());
  app.iniciarHistorial();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        app.estadoPwa = 'App lista para abrir sin señal en este equipo.';
        const n = app.$('#estado-pwa');
        if (n) n.textContent = app.estadoPwa;
      })
      .catch(() => {
        app.estadoPwa = 'No se pudo preparar la apertura sin señal. Volvé a abrir con conexión.';
        const n = app.$('#estado-pwa');
        if (n) n.textContent = app.estadoPwa;
      });
  } else {
    app.estadoPwa = 'Este navegador no permite preparar la apertura sin señal.';
  }
}
