import { nombreMedio } from '../ui/formato.js';

export function opcionesViajesCobro(viajes, clienteId) {
  return viajes
    .filter((v) => clienteId && v.clienteId === clienteId && v.estado === 'hecho' && !v.anulado)
    .map((v) => [v.id, v.origen + ' → ' + v.destino]);
}

import * as V from '../dominio/viajes-cobros.js';

import { moneda, cuentaCliente } from '../datos.js';
// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarCobros(app) {
  function editarCliente(r = null) {
    app.formulario(
      app.abrirDialogo(r ? 'Corregir cliente' : 'Agregar cliente'),
      [
        app.campo('nombre', 'Nombre'),
        app.campo('cuit', 'CUIT (opcional)', 'text', null, false),
        app.campo('plazoDias', 'Días para cobrar desde el viaje', 'number'),
        app.monto('saldoInicialCentavos', 'Deuda al empezar (0 si no debía)'),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar cliente',
      (v) =>
        app.cambiar((d) => {
          if (
            v.cuit &&
            d.clientes.some(
              (c) => c.id !== r?.id && c.cuit?.replace(/\D/g, '') === v.cuit.replace(/\D/g, ''),
            ) &&
            !confirm('Ya hay un cliente con ese CUIT. ¿Querés guardarlo igual?')
          )
            throw Error('Revisá el CUIT.');
          const c = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            nombre: v.nombre,
            cuit: v.cuit,
            plazoDias: v.plazoDias,
            saldoInicialCentavos: v.saldoInicialCentavos,
          };
          if (r) {
            app.historial(d, 'clientes', r, v.motivo);
            Object.assign(
              d.clientes.find((x) => x.id === r.id),
              c,
            );
          } else d.clientes.push(c);
        }),
      r ?? {
        plazoDias: 30,
        saldoInicialCentavos: 0,
      },
    );
  }
  function editarCobro(r = null, cid = null) {
    const f = app.formulario(
      app.abrirDialogo(r ? 'Corregir cobro' : 'Registrar cobro parcial o anticipo'),
      [
        app.clientes(),
        app.fecha(),
        app.monto(),
        app.campo('medio', 'Cómo te pagó', 'select', [
          ['transferencia', 'Transferencia'],
          ['efectivo', 'Efectivo'],
          ['cheque', 'Cheque'],
          ['otro', 'Otro'],
        ]),
        app.campo(
          'viajeId',
          'Asignar a un viaje (opcional)',
          'select',
          opcionesViajesCobro(app.datos.viajes, r?.clienteId ?? cid),
          false,
        ),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar cobro',
      (v) =>
        app.cambiar((d) => {
          if (v.importeCentavos <= 0) throw Error('Escribí un monto mayor a cero.');
          const c = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            clienteId: v.clienteId,
            fecha: v.fecha,
            importeCentavos: v.importeCentavos,
            medio: v.medio,
            viajeId: v.viajeId || undefined,
          };
          const cl = d.clientes.find((x) => x.id === v.clienteId);
          const estado = cuentaCliente(
            {
              ...d,
              cobros: d.cobros.filter((x) => x.id !== r?.id),
            },
            cl,
            app.hoy(),
          );
          const revision = V.revisarCobro(c, estado);
          if (
            revision.requiereConfirmacion &&
            !confirm(
              moneda(revision.aFavorCentavos) + ' quedan a favor del cliente. ¿Lo confirmás?',
            )
          )
            throw Error('Revisá el monto antes de guardar.');
          if (r) {
            app.historial(d, 'cobros', r, v.motivo);
            Object.assign(
              d.cobros.find((x) => x.id === r.id),
              c,
            );
          } else d.cobros.push(c);
        }),
      r ?? {
        clienteId: cid ?? '',
      },
    );
    f.entradas.clienteId.input.onchange = () => {
      const input = f.entradas.viajeId.input;
      input.replaceChildren(new Option('Sin asignar a un viaje', ''));
      for (const [id, texto] of opcionesViajesCobro(app.datos.viajes, f.entradas.clienteId.input.value))
        input.append(new Option(texto, id));
      input.value = '';
      app.actualizarOpciones(f, 'viajeId');
    };
  }
  function cobros() {
    app.root.append(
      app.btn('Registrar cobro', () => app.editarCobro(), 'principal'),
      app.btn('Agregar cliente', () => app.editarCliente()),
    );
    app.root.append(
      app.e(
        'p',
        'La deuda se calcula con viajes hechos. Si elegís un viaje, el cobro se aplica primero a ese viaje; el resto, a los más viejos; los anticipos quedan a favor.',
        'ayuda',
      ),
    );
    for (const c of app.datos.clientes) {
      const s = app.cuenta(c);
      app.filaRegistro(
        app.root,
        c.nombre,
        'Saldo ' +
          moneda(s.saldoCentavos) +
          ' · Vencido ' +
          moneda(s.vencidoCentavos) +
          ' · A favor ' +
          moneda(s.aFavorCentavos) +
          ' · Plazo ' +
          (c.plazoDias ?? 30) +
          ' días',
        [
          app.btn('Registrar cobro', () => app.editarCobro(null, c.id)),
          app.btn('Corregir cliente', () => app.editarCliente(c)),
        ],
      );
    }
    const h = app.seccion('Cobros cargados');
    for (const c of [...app.datos.cobros].reverse())
      app.filaRegistro(
        h,
        app.cliente(c.clienteId) + ' · ' + moneda(c.importeCentavos),
        c.fecha + ' · ' + nombreMedio(c.medio) + (c.anulado ? ' · Cobro anulado · ' + c.anulado.motivo : ''),
        app.acciones('cobros', c, app.editarCobro),
      );
  }
  app.editarCliente = editarCliente;
  app.editarCobro = editarCobro;
  app.cobros = cobros;
}
