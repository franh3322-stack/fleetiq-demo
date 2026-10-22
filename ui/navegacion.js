// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarNavegacion(app) {
  function cambiarPagina(p, cid = null) {
    app.pagina = p;
    app.camionElegido = cid;
    app.pintar();
    window.scrollTo(0, 0);
  }
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
          ['Viajes', 'Papeles', 'Mantenimiento', 'Ajustes', 'Soporte', 'Ayuda'].includes(
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
