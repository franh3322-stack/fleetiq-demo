import { detalleCobro } from '../ui/formato.js';

export function opcionesViajesCobro(viajes, clienteId) {
  return viajes
    .filter((v) => clienteId && v.clienteId === clienteId && v.estado === 'hecho' && !v.anulado)
    .map((v) => [v.id, v.origen + ' → ' + v.destino]);
}

import * as M from '../dominio/vencimientos.js';
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
          ['cheque', 'Cheque'],
          ['echeq', 'E-cheq'],
          ['efectivo', 'Efectivo'],
          ['otro', 'Otro'],
        ]),
        app.campo('cobrableDesde', 'Se puede cobrar desde (opcional)', 'date', null, false),
        app.campo('tieneRetencion', '¿Te hicieron retención?', 'select', [['si','Sí'],['no','No']]),
        app.campo('retencionCentavos', 'Monto de la retención', 'monto', null, false),
        app.campo('retencionTipo', 'Tipo de retención', 'select', [['iibb','Ingresos Brutos'],['otra','Otra']]),
        app.campo('archivo', 'Certificado de retención (opcional)', 'file', null, false),
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
        app.cambiar(async (d) => {
          if (v.importeCentavos <= 0) throw Error('Escribí un monto mayor a cero.');
          const c = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            clienteId: v.clienteId,
            fecha: v.fecha,
            importeCentavos: v.importeCentavos,
            medio: v.medio,
            viajeId: v.viajeId || undefined,
            cobrableDesde: ['cheque','echeq'].includes(v.medio) ? v.cobrableDesde || undefined : undefined,
            retencionCentavos: v.tieneRetencion === 'si' ? v.retencionCentavos : undefined,
            retencionTipo: v.tieneRetencion === 'si' ? v.retencionTipo || undefined : undefined,
            archivoId: v.tieneRetencion === 'si' ? r?.archivoId : undefined,
            depositadoFecha: r?.depositadoFecha,
          };
          if (v.tieneRetencion === 'si' && !(c.retencionCentavos > 0)) throw Error('Escribí un monto de retención mayor a cero.');
          if (v.tieneRetencion === 'si') await app.ponerArchivo(d, v.archivo, c);
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
      { ...r, clienteId: r?.clienteId ?? cid ?? '', tieneRetencion: r?.retencionCentavos ? 'si' : 'no', retencionTipo: r?.retencionTipo ?? 'iibb' },
    );
    const actualizar = () => {
      const retiene = f.entradas.tieneRetencion.input.value === 'si';
      for (const n of ['retencionCentavos','retencionTipo','archivo']) f.entradas[n].input.parentElement.hidden = !retiene;
      f.entradas.cobrableDesde.input.parentElement.hidden = !['cheque','echeq'].includes(f.entradas.medio.input.value);
    };
    f.entradas.tieneRetencion.input.onchange = actualizar;
    f.entradas.medio.input.onchange = actualizar;
    actualizar();
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
      const tarjeta = app.filaRegistro(
        app.root,
        c.nombre,
        '',
        [
          app.btn('Registrar cobro', () => app.editarCobro(null, c.id)),
          app.btn('Corregir cliente', () => app.editarCliente(c)),
        ],
      );
      const resumen = tarjeta.querySelector('p');
      resumen.append(app.e('strong', 'Debe ' + moneda(Math.max(0, s.saldoCentavos))));
      for (const texto of [
        ...(s.vencidoCentavos > 0 ? ['Vencido ' + moneda(s.vencidoCentavos)] : []),
        ...(s.aFavorCentavos > 0 ? ['A favor ' + moneda(s.aFavorCentavos)] : []),
        'Plazo: ' + (c.plazoDias ?? 30) + ' días',
        ...(s.retenidoCentavos > 0 ? ['Retenciones: ' + moneda(s.retenidoCentavos)] : []),
      ]) resumen.append(app.e('br'), app.e('span', texto));
    }
    const cartera = app.seccion('Cheques para depositar');
    for (const c of V.chequesEnCartera(app.datos.cobros)) app.filaRegistro(cartera,
      app.cliente(c.clienteId) + ' · ' + detalleCobro(c),
      c.cobrableDesde ? 'Se puede cobrar desde ' + M.formatoFecha(c.cobrableDesde) : 'Sin fecha de cobro',
      [app.btn('Ya lo deposité', async () => { try { await app.cambiar(d => {
        const item = d.cobros.find(x => x.id === c.id);
        const nuevo = V.depositarCheque(item, app.hoy());
        app.historial(d, 'cobros', item, 'Cheque depositado');
        Object.assign(item, nuevo);
      }); app.pintar(); } catch (err) { app.fallo(err); } })]);
    const h = app.seccion('Cobros cargados');
    for (const c of [...app.datos.cobros].reverse())
      app.filaRegistro(
        h,
        app.cliente(c.clienteId) + ' · ' + detalleCobro(c),
        M.formatoFecha(c.fecha) + (c.depositadoFecha ? ' · Depositado ' + M.formatoFecha(c.depositadoFecha) : '') + (c.anulado ? ' · Cobro anulado · ' + c.anulado.motivo : ''),
        app.acciones('cobros', c, app.editarCobro),
      );
  }
  app.editarCliente = editarCliente;
  app.editarCobro = editarCobro;
  app.cobros = cobros;
}
