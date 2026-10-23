import * as M from '../dominio/vencimientos.js';
import { papelVigente, versionesAnteriores } from '../datos.js';
export function registrarPapeles(app) {
  // renovar: el papel anterior queda guardado y deja de contar para los avisos.
  function editarPapel(r = null, renovar = null) {
    const base = r ?? renovar;
    const target = app.abrirDialogo(r ? 'Corregir papel' : renovar ? 'Renovar ' + renovar.tipo : 'Agregar papel');
    if (renovar)
      target.append(
        app.e('p', 'El papel anterior queda guardado en "Versiones anteriores". Cargá el vencimiento y la foto del nuevo.', 'ayuda'),
      );
    const f = app.formulario(
      target,
      [
        app.camion(true),
        app.campo('tipo', 'Tipo de papel', 'select', [
          ['Seguro', 'Seguro'],
          ['RTO', 'RTO'],
          ['Cédula', 'Cédula'],
          ['Licencia', 'Licencia del chofer'],
          ['Otro', 'Otro'],
        ]),
        app.choferCampo(base?.choferId),
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
            chofer: v.choferId ? undefined : v.chofer,
            choferId: v.tipo==='Licencia' ? v.choferId || undefined : undefined,
            fechaCarga: r?.fechaCarga ?? (r ? undefined : app.hoy()),
            vence: v.vence || null,
            archivoId: r?.archivoId,
            ...(renovar ? { renuevaA: renovar.id } : {}),
          };
          if(p.tipo==='Licencia' && !p.choferId && !base?.chofer) throw Error('Elegí un chofer para la licencia.');
          M.estadoPapel(p, app.hoy(), d.config);
          await app.ponerArchivo(d, v.archivo, p);
          if (r) {
            app.historial(d, 'papeles', r, v.motivo);
            Object.assign(
              d.papeles.find((x) => x.id === r.id),
              p,
            );
          } else {
            if (renovar) {
              const anterior = d.papeles.find((x) => x.id === renovar.id);
              if (!papelVigente(anterior, d.papeles)) throw Error('Ese papel ya fue renovado.');
              app.historial(d, 'papeles', anterior, 'Renovado');
              anterior.reemplazadoPor = p.id;
            }
            d.papeles.push(p);
          }
        }),
      base
        ? {
            ...base,
            camionId: base.camionId ?? 'general',
            ...(renovar ? { vence: '', archivoId: undefined } : {}),
          }
        : {
            camionId: app.camionElegido ?? '',
          },
    );
    const tipo=()=>{f.entradas.choferId.input.parentElement.hidden=f.entradas.tipo.input.value!=='Licencia';};f.entradas.tipo.input.onchange=tipo;tipo();
  }
  function verAnteriores(p) {
    const w = app.abrirDialogo('Versiones anteriores · ' + p.tipo);
    for (const a of versionesAnteriores(p, app.datos.papeles))
      app.filaRegistro(
        w,
        a.tipo + (a.vence ? ' · vencía el ' + M.formatoFecha(a.vence) : ' · sin vencimiento'),
        'Cargado el ' + (a.fechaCarga ? M.formatoFecha(a.fechaCarga) : 'sin fecha'),
        app.verArchivo(a),
      );
  }
  // Corregir y anular de siempre, más Renovar y las versiones anteriores del papel.
  function accionesPapel(p) {
    const anteriores = versionesAnteriores(p, app.datos.papeles).length;
    return [
      ...app.acciones('papeles', p, app.editarPapel),
      ...(papelVigente(p, app.datos.papeles) ? [app.btn('Renovar', () => app.editarPapel(null, p))] : []),
      ...(anteriores ? [app.btn(`Versiones anteriores (${anteriores})`, () => verAnteriores(p))] : []),
    ];
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
      // Los renovados no se repiten: se ven desde "Versiones anteriores" del papel nuevo.
      const ps = app.datos.papeles
        .filter(
          (p) =>
            (p.anulado || papelVigente(p, app.datos.papeles)) &&
            (!app.camionElegido || p.camionId === app.camionElegido) &&
            (!select.value || p.tipo === select.value),
        )
        .sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999'));
      if (!ps.length) list.append(app.e('p', 'Todavía no hay papeles para esta selección.'));
      for (const p of ps)
        app.filaRegistro(
          list,
          p.tipo + ' · ' + app.nombreCamion(p.camionId),
          (app.nombreChofer(p) ? app.nombreChofer(p) + ' · ' : '') +
            (p.vence ? 'Vence ' + M.formatoFecha(p.vence) : 'Sin vencimiento') +
            (p.anulado ? ' · Carga anulada · ' + p.anulado.motivo : ''),
          app.accionesPapel(p),
        );
    }
    select.onchange = pintarPapeles;
    pintarPapeles();
  }
  app.editarPapel = editarPapel;
  app.accionesPapel = accionesPapel;
  app.papeles = papeles;
}
