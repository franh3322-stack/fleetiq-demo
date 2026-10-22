import * as V from '../dominio/viajes-cobros.js';

import { moneda } from '../datos.js';

// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarCargas(app) {
  function cargarMenu() {
    const n = app.seccion('¿Qué querés cargar?');
    n.classList.add('menu');
    for (const [texto, accion] of [
      [
        'Gasto',
        () => {
          app.cambiarPagina('Registrar gasto');
          app.gasto();
        },
      ],
      ['Viaje', () => app.editarViaje()],
      ['Cobro', () => app.editarCobro()],
      ['Papel', () => app.editarPapel()],
      ['Service', () => app.nuevoService()],
    ])
      n.append(app.btn(texto, accion));
  }
  function gasto(r = null, target = app.abrirDialogo(r ? 'Corregir gasto' : 'Registrar gasto')) {
    if (target === app.root && !app.datos.camiones.length)
      app.root.append(
        app.aviso('Podés cargar un gasto general o agregar un camión desde Camiones.'),
      );
    const cats = [
      ['combustible', 'Combustible'],
      ['peaje', 'Peaje'],
      ['reparacion', 'Reparación'],
      ['mantenimiento', 'Mantenimiento'],
      ['cubiertas', 'Cubiertas'],
      ['otro', 'Otro'],
    ];
    const f = app.formulario(
      target,
      [
        app.camion(true),
        app.campo('categoria', '¿Qué gasto es?', 'select', cats),
        app.monto(),
        app.fecha(),
        app.campo(
          'viajeId',
          'Viaje (opcional)',
          'select',
          app.datos.viajes
            .filter((v) => v.estado !== 'cancelado')
            .map((v) => [v.id, `${v.origen} → ${v.destino} · ${app.nombreCamion(v.camionId)}`]),
          false,
        ),
        app.archivo(),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      r ? 'Guardar corrección' : 'Guardar gasto',
      async (v) =>
        app.cambiar(async (d) => {
          if (v.importeCentavos <= 0) throw Error('Escribí un monto mayor a cero.');
          const g = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            camionId: v.camionId === 'general' ? null : v.camionId,
            tipo: 'gasto',
            categoria: v.categoria,
            fecha: v.fecha,
            importeCentavos: v.importeCentavos,
            viajeId: v.viajeId || undefined,
            archivoId: r?.archivoId,
          };
          if (v.viajeId && d.viajes.find((x) => x.id === v.viajeId).camionId !== g.camionId)
            throw Error('El viaje es de otro camión. Revisá la elección.');
          await app.ponerArchivo(d, v.archivo, g);
          if (r) {
            app.historial(d, 'gastos', r, v.motivo);
            Object.assign(
              d.gastos.find((x) => x.id === r.id),
              g,
            );
          } else d.gastos.push(g);
        }),
      r
        ? {
            ...r,
            camionId: r.camionId ?? 'general',
          }
        : {},
    );
    app.opcionesGrandes(
      f,
      'camionId',
      Array.from(f.entradas.camionId.input.options)
        .filter((o) => o.value)
        .map((o) => [o.value, o.text]),
    );
    app.opcionesGrandes(f, 'categoria', cats);
  }
  function gastos() {
    app.root.append(app.btn('Registrar gasto', () => app.gasto(), 'principal'));
    const h = app.seccion('Gastos cargados');
    for (const g of [...app.datos.gastos].reverse())
      app.filaRegistro(
        h,
        app.nombreCamion(g.camionId) + ' · ' + moneda(g.importeCentavos),
        g.fecha +
          ' · ' +
          {
            reparacion: 'Reparación',
            combustible: 'Combustible',
            peaje: 'Peaje',
            mantenimiento: 'Mantenimiento',
            cubiertas: 'Cubiertas',
            otro: 'Otro',
          }[g.categoria] +
          (g.anulado ? ' · Carga anulada · ' + g.anulado.motivo : ''),
        app.acciones('gastos', g, (r) => app.gasto(r, app.abrirDialogo('Corregir gasto'))),
      );
  }
  function editarViaje(r = null) {
    const campos = [
      app.clientes(),
      app.camion(),
      app.fecha(),
      app.campo(
        'fechaBaseCobro',
        'Fecha base para el plazo de cobro (opcional; si falta se usa la del viaje)',
        'date',
        null,
        false,
      ),
      app.campo('origen', 'Origen'),
      app.campo('destino', 'Destino'),
      app.campo('chofer', 'Chofer (opcional)', 'text', null, false),
      app.monto('tarifaCentavos', 'Tarifa acordada'),
      app.campo('kmRecorridos', 'Kilómetros del viaje (opcional)', 'number', null, false),
      app.campo('numeroPapel', 'Número de carta de porte (opcional)', 'text', null, false),
      app.archivo(),
      ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
    ];
    app.formulario(
      app.abrirDialogo(r ? 'Corregir viaje' : 'Nuevo viaje'),
      campos,
      'Guardar viaje',
      (v) =>
        app.cambiar(async (d) => {
          let viaje = {
            ...r,
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            clienteId: v.clienteId,
            camionId: v.camionId,
            fecha: v.fecha,
            fechaBaseCobro: v.fechaBaseCobro || undefined,
            origen: v.origen,
            destino: v.destino,
            chofer: v.chofer,
            tarifaCentavos: v.tarifaCentavos,
            kmRecorridos: v.kmRecorridos,
            numeroPapel: v.numeroPapel,
            estado: r?.estado ?? 'planificado',
            historialTarifa: r?.historialTarifa ?? [],
          };
          if (r) {
            app.historial(d, 'viajes', r, v.motivo);
            if (r.tarifaCentavos !== v.tarifaCentavos)
              viaje = {
                ...viaje,
                ...V.cambiarTarifa(
                  {
                    ...viaje,
                    tarifaCentavos: r.tarifaCentavos,
                  },
                  v.tarifaCentavos,
                  app.hoy(),
                  v.motivo,
                ),
              };
          }
          await app.ponerArchivo(d, v.archivo, viaje);
          if (r)
            Object.assign(
              d.viajes.find((x) => x.id === r.id),
              viaje,
            );
          else d.viajes.push(viaje);
        }),
      r ?? {},
    );
  }
  function viajes() {
    app.root.append(
      app.btn('Nuevo viaje', () => app.editarViaje(), 'principal'),
      app.btn('Agregar cliente', () => app.editarCliente()),
    );
    if (!app.datos.clientes.length || !app.datos.camiones.length)
      app.root.append(app.aviso('Primero agregá un cliente y un camión.'));
    for (const v of [...app.datos.viajes].reverse()) {
      const a = app.acciones('viajes', v, app.editarViaje);
      if (v.estado === 'planificado')
        a.unshift(
          app.btn(
            'Marcar hecho',
            app.ejecutar(async () => {
              await app.cambiar((d) => {
                d.viajes.find((x) => x.id === v.id).estado = 'hecho';
              });
              app.pintar();
            }),
          ),
        );
      if (v.estado !== 'cancelado')
        a.push(
          app.btn('Constancia de entrega', () =>
            app.formulario(
              app.abrirDialogo('Guardar entrega'),
              [app.archivo(), app.campo('nota', 'Detalle de la entrega', 'textarea')],
              'Guardar entrega',
              (x) =>
                app.cambiar(async (d) => {
                  const item = d.viajes.find((r) => r.id === v.id);
                  app.historial(d, 'viajes', item, x.nota);
                  item.entrega = x.nota;
                  const entrega = {};
                  await app.ponerArchivo(d, x.archivo, entrega);
                  if (entrega.archivoId) item.entregaArchivoId = entrega.archivoId;
                }),
            ),
          ),
          app.btn('Ver resultado del viaje', () => {
            const movimientosViaje = app.datos.gastos.filter(
              (g) => app.activo(g) && g.viajeId === v.id,
            );
            const gastos = movimientosViaje.reduce((s, g) => s + g.importeCentavos, 0);
            app
              .abrirDialogo('Resultado del viaje')
              .append(
                app.e('p', 'Ingreso ' + moneda(v.estado === 'hecho' ? v.tarifaCentavos : 0)),
                app.e('p', 'Gastos asignados ' + moneda(gastos)),
                app.e(
                  'p',
                  moneda((v.estado === 'hecho' ? v.tarifaCentavos : 0) - gastos),
                  'numero',
                ),
                app.e(
                  'p',
                  'Solo incluye los gastos asignados a este viaje. No es la ganancia contable.',
                ),
              );
          }),
        );
      app.filaRegistro(
        app.root,
        app.nombreCamion(v.camionId) + ' · ' + v.origen + ' → ' + v.destino,
        app.cliente(v.clienteId) +
          ' · ' +
          v.fecha +
          ' · ' +
          moneda(v.tarifaCentavos) +
          ' · ' +
          {
            hecho: 'Viaje hecho',
            planificado: 'Viaje por hacer',
            cancelado: 'Viaje cancelado · ' + v.cancelacion?.motivo,
          }[v.estado],
        a,
      );
    }
  }
  app.cargarMenu = cargarMenu;
  app.gasto = gasto;
  app.gastos = gastos;
  app.editarViaje = editarViaje;
  app.viajes = viajes;
}
