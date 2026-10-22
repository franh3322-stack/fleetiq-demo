import * as M from '../dominio/vencimientos.js';
export function registrarPapeles(app) {
  function editarPapel(r = null) {
    app.formulario(
      app.abrirDialogo(r ? 'Corregir papel' : 'Agregar papel'),
      [
        app.camion(true),
        app.campo('tipo', 'Tipo de papel', 'select', [
          ['Seguro', 'Seguro'],
          ['RTO', 'RTO'],
          ['Cédula', 'Cédula'],
          ['Licencia', 'Licencia del chofer'],
          ['Otro', 'Otro'],
        ]),
        app.campo('chofer', 'Chofer o detalle (opcional)', 'text', null, false),
        app.campo('vence', 'Vencimiento (opcional)', 'date', null, false),
        app.archivo(),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar papel',
      (v) =>
        app.cambiar(async (d) => {
          const p = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            camionId: v.camionId === 'general' ? null : v.camionId,
            tipo: v.tipo,
            chofer: v.chofer,
            fechaCarga: r?.fechaCarga ?? (r ? undefined : app.hoy()),
            vence: v.vence || null,
            archivoId: r?.archivoId,
          };
          M.estadoPapel(p, app.hoy(), d.config);
          await app.ponerArchivo(d, v.archivo, p);
          if (r) {
            app.historial(d, 'papeles', r, v.motivo);
            Object.assign(
              d.papeles.find((x) => x.id === r.id),
              p,
            );
          } else d.papeles.push(p);
        }),
      r
        ? {
            ...r,
            camionId: r.camionId ?? 'general',
          }
        : {
            camionId: app.camionElegido ?? '',
          },
    );
  }
  function papeles() {
    app.root.append(app.btn('Agregar papel', () => app.editarPapel(), 'principal'));
    const filtro = app.e('label', 'Filtrar por tipo');
    const select = app.e('select');
    select.append(
      new Option('Todos', ''),
      ...['Seguro', 'RTO', 'Cédula', 'Licencia', 'Otro'].map((t) => new Option(t, t)),
    );
    app.asociar(filtro, select);
    filtro.append(select);
    app.root.append(filtro);
    if (app.camionElegido)
      app.root.append(app.btn('Ver todos los camiones', () => app.cambiarPagina('Papeles')));
    const list = app.e('div');
    app.root.append(list);
    function pintarPapeles() {
      list.replaceChildren();
      const ps = app.datos.papeles
        .filter(
          (p) =>
            (!app.camionElegido || p.camionId === app.camionElegido) &&
            (!select.value || p.tipo === select.value),
        )
        .sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999'));
      if (!ps.length) list.append(app.e('p', 'Todavía no hay papeles para esta selección.'));
      for (const p of ps)
        app.filaRegistro(
          list,
          p.tipo + ' · ' + app.nombreCamion(p.camionId),
          (p.chofer ? p.chofer + ' · ' : '') +
            (p.vence ? 'Vence ' + p.vence : 'Sin vencimiento') +
            (p.anulado ? ' · Carga anulada · ' + p.anulado.motivo : ''),
          app.acciones('papeles', p, app.editarPapel),
        );
    }
    select.onchange = pintarPapeles;
    pintarPapeles();
  }
  app.editarPapel = editarPapel;
  app.papeles = papeles;
}
