import { sincronizarLecturaGasto } from '../datos.js';
import * as V from '../dominio/viajes-cobros.js';

import { adjunto } from '../almacen.js';
// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarRegistros(app) {
  async function ponerArchivo(d, file, registro) {
    if (file?.size || file?.blob) {
      const a = file.blob ? file : await adjunto(file, d.empresaId);
      d.archivos.push(a);
      registro.archivoId = a.id;
    }
  }
  function verArchivo(r) {
    return ['archivoId', 'entregaArchivoId']
      .filter((key) => r[key])
      .map((key) =>
        app.btn(
          key === 'entregaArchivoId' ? 'Abrir constancia de entrega' : 'Abrir archivo',
          () => {
            const original = app.datos.archivos.find((a) => a.id === r[key]);
            const a = {
              ...original,
              datos: original.datos ?? URL.createObjectURL(original.blob),
            };
            const w = app.abrirDialogo(a.nombre);
            const link = app.e('a', 'Descargar archivo');
            link.href = a.datos;
            link.download = a.nombre;
            w.append(link);
            if (original.blob?.type.startsWith('image/') || a.datos.startsWith('data:image/')) {
              const img = app.e('img');
              img.src = a.datos;
              img.alt = a.nombre;
              img.style.maxWidth = '100%';
              w.append(img);
            } else {
              const frame = app.e('iframe');
              frame.src = a.datos;
              frame.title = a.nombre;
              frame.style = 'width:100%;height:60vh';
              w.append(frame);
            }
          },
        ),
      );
  }
  function historial(d, tipo, antes, motivo) {
    d.historial.push({
      id: app.id(),
      empresaId: d.empresaId,
      fecha: app.hoy(),
      tipo,
      registroId: antes.id,
      motivo,
      antes: structuredClone(antes),
    });
  }
  function anular(lista, r, extra = null) {
    const target = app.abrirDialogo('Anular carga');
    target.append(app.e('p', 'La carga y su motivo quedan en el historial.'));
    if (
      lista === 'viajes' &&
      app.datos.cobros.some((c) => !c.anulado && c.clienteId === r.clienteId)
    )
      target.append(
        app.aviso(
          'Este cliente tiene cobros cargados. Se conservan: al cancelar el viaje, pueden quedar como saldo a favor. Revisá su cuenta en Cobros.',
        ),
      );
    if (lista === 'services')
      target.append(
        app.aviso(
          'Al anular el service se retira su gasto y los planes de esas tareas quedan para revisar. Después confirmá el próximo vencimiento en Corregir plan.',
        ),
      );
    app.formulario(target, [app.campo('motivo', 'Motivo', 'textarea')], 'Anular carga', async (v) =>
      app.cambiar((d) => {
        const item = d[lista].find((x) => x.id === r.id);
        app.historial(d, lista, item, v.motivo);
        if (lista === 'cobros') Object.assign(item, V.anularCobro(item, app.hoy(), v.motivo));
        else if (lista === 'viajes') {
          Object.assign(item, V.cancelarViaje(item, app.hoy(), v.motivo));
        } else {
          item.anulado = {
            fecha: app.hoy(),
            motivo: v.motivo,
          };
          if (lista==='gastos') sincronizarLecturaGasto(d,item);
          if (extra) extra(d, item);
        }
      }),
    );
  }
  function acciones(lista, r, editar, extra = null) {
    if (r.anulado || r.estado === 'cancelado') return app.verArchivo(r);
    return [
      app.btn('Corregir', () => editar(r)),
      app.btn('Anular', () => app.anular(lista, r, extra), 'peligro'),
      ...app.verArchivo(r),
    ];
  }
  app.ponerArchivo = ponerArchivo;
  app.verArchivo = verArchivo;
  app.historial = historial;
  app.anular = anular;
  app.acciones = acciones;
}
