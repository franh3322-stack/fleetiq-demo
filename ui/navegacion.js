// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarNavegacion(app) {
  function cambiarPagina(p, cid = null, desdeHistorial = false) {
    // Cada pantalla queda en el historial: el botón Atrás del celular vuelve a la anterior.
    if (!desdeHistorial && (app.pagina !== p || app.camionElegido !== cid))
      globalThis.history?.pushState({ fleetiq: 'pagina', pagina: p, camionId: cid }, '');
    app.pagina = p;
    app.camionElegido = cid;
    app.pintar();
    window.scrollTo(0, 0);
  }
  // Atrás cierra primero el formulario abierto (avisando si hay una carga sin guardar) y después vuelve de pantalla.
  function iniciarHistorial() {
    const h = globalThis.history;
    if (!h) return;
    h.replaceState({ fleetiq: 'pagina', pagina: app.pagina, camionId: app.camionElegido }, '');
    // Al cerrar el formulario desde la app se saca su paso del historial. No se espera el evento
    // close porque no todos los navegadores lo disparan a tiempo.
    const cerrar = app.dialog.close.bind(app.dialog);
    app.dialog.close = (...args) => {
      cerrar(...args);
      if (h.state?.fleetiq !== 'dialogo') return;
      app.ignorarAtras = true;
      h.back();
    };
    window.addEventListener('popstate', (event) => {
      const s = event.state;
      if (app.ignorarAtras) {
        app.ignorarAtras = false;
        return;
      }
      if (app.dialog.open) {
        app.volverCarga();
        // Si quedó abierto por una carga sin guardar, el próximo Atrás vuelve a preguntar.
        if (app.dialog.open) h.pushState({ fleetiq: 'dialogo' }, '');
        return;
      }
      if (s?.fleetiq === 'dialogo') h.back();
      else if (s?.fleetiq === 'pagina' && s.pagina) cambiarPagina(s.pagina, s.camionId ?? null, true);
    });
    window.addEventListener('beforeunload', (event) => {
      if (!app.borrador) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }
  app.iniciarHistorial = iniciarHistorial;
  function pintar() {
    app.root.replaceChildren(app.e('h1', app.pagina));
    if (app.confirmacion) {
      const ok = app.e('p', app.confirmacion, 'confirmacion');
      ok.setAttribute('role', 'status');
      app.root.append(ok);
      app.confirmacion = '';
    }
    app.$('#nav').replaceChildren();
    for (const p of ['Inicio', 'Camiones', 'Cargar', 'Cobros', 'Más']) {
      const b = app.btn(p, () => app.cambiarPagina(p));
      const actual =
        app.pagina === p ||
        (p === 'Más' &&
          ['Viajes', 'Choferes', 'Papeles', 'Mantenimiento', 'Ajustes', 'Soporte', 'Ayuda'].includes(
            app.pagina,
          )) ||
        (p === 'Cargar' && app.pagina === 'Registrar gasto');
      b.setAttribute('aria-current', actual ? 'page' : 'false');
      app.$('#nav').append(b);
    }
    ({
      Inicio: app.inicio,
      Camiones: app.camiones,
      Cargar: app.cargarMenu,
      Más: app.mas,
      'Registrar gasto': app.gastos,
      Viajes: app.viajes,
      Choferes: app.choferes,
      Cobros: app.cobros,
      Papeles: app.papeles,
      Mantenimiento: app.mantenimiento,
      Ajustes: app.ajustes,
      Soporte: app.soporte,
      Ayuda: app.ayuda,
    })[app.pagina]();
  }
  app.cambiarPagina = cambiarPagina;
  app.pintar = pintar;
}
