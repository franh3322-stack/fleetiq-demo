import { textoProximo } from '../ui/formato.js';
import * as C from '../dominio/camiones.js';

import * as M from '../dominio/vencimientos.js';

import { moneda } from '../datos.js';
// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarMantenimiento(app) {
  app.textoProximo = textoProximo;

  function editarPlan(r = null) {
    const tareas = ['Aceite y filtros', 'Frenos', 'Cubiertas', 'Otro'];
    const inicial = {
      ...(r ?? {}),
      camionId: r?.camionId ?? app.camionElegido ?? '',
      tarea: r ? (tareas.includes(r.tarea) ? r.tarea : 'Otro') : '',
      otraTarea: r && !tareas.includes(r.tarea) ? r.tarea : '',
    };
    const f = app.formulario(
      app.abrirDialogo(r ? 'Corregir plan' : 'Agregar plan de mantenimiento'),
      [
        app.camion(),
        app.campo(
          'tarea',
          'Tarea',
          'select',
          tareas.map((t) => [t, t]),
        ),
        app.campo('otraTarea', '¿Qué tarea?', 'text', null, false),
        app.campo('cadaKm', '¿Cada cuánto? · Kilómetros', 'number', null, false),
        app.campo('cadaMeses', '¿Cada cuánto? · Meses', 'number', null, false),
        app.campo('ultimoKm', '¿Cuándo fue el último service? · Kilómetros', 'number', null, false),
        app.campo('ultimaFecha', '¿Cuándo fue el último service? · Fecha', 'date', null, false),
        app.campo('proximoKm', 'Próximo a los km', 'number', null, false),
        app.campo('proximaFecha', 'Próxima fecha', 'date', null, false),
        ...(r?.cadaDias && !r.cadaMeses
          ? [app.campo('cadaDias', 'Intervalo anterior en días', 'number', null, false)]
          : []),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar plan',
      (v) =>
        app.cambiar((d) => {
          if (!v.cadaKm && !v.cadaMeses && !v.cadaDias)
            throw Error('Indicá cada cuántos kilómetros o meses.');
          if (v.tarea === 'Otro' && !v.otraTarea) throw Error('Escribí qué tarea se hace.');
          const p = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            ...v,
            tarea: v.tarea === 'Otro' ? v.otraTarea : v.tarea,
            revisar: false,
          };
          delete p.otraTarea;
          delete p.motivo;
          if (p.cadaMeses && p.ultimaFecha) p.cadaDias = M.diasDeMeses(p.ultimaFecha, p.cadaMeses);
          if (!p.ultimaFecha) delete p.ultimaFecha;
          if (!p.proximaFecha) delete p.proximaFecha;
          const limites = M.limitesPlan(p);
          if (limites.limiteKm == null && limites.limiteFecha == null)
            throw Error('Indicá cuándo fue el último service o indicá el próximo en Más opciones.');
          if (r) {
            app.historial(d, 'planes', r, v.motivo);
            d.planes[d.planes.findIndex((x) => x.id === r.id)] = p;
          } else d.planes.push(p);
        }),
      inicial,
    );
    app.opcionesGrandes(
      f,
      'tarea',
      tareas.map((t) => [t, t]),
    );
    const otra = f.entradas.otraTarea.input;
    const elegir = () => {
      otra.parentElement.hidden = f.entradas.tarea.input.value !== 'Otro';
      otra.required = f.entradas.tarea.input.value === 'Otro';
      f.entradas.otraTarea.c.requerido = otra.required;
    };
    f.entradas.tarea.input.onchange = elegir;
    elegir();
    const mas = app.e('details');
    mas.append(app.e('summary', 'Más opciones'));
    for (const nombre of ['proximoKm', 'proximaFecha', 'cadaDias'])
      if (f.entradas[nombre]) mas.append(f.entradas[nombre].input.parentElement);
    f.form.insertBefore(mas, f.form.lastElementChild);
    const proximo = app.e('p');
    proximo.setAttribute('aria-live', 'polite');
    f.form.insertBefore(proximo, mas);
    const actualizar = () => {
      const p = {};
      for (const [n, { input, c }] of Object.entries(f.entradas))
        p[n] = input.value ? (c.tipo === 'number' ? Number(input.value) : input.value) : undefined;
      try {
        proximo.textContent = app.textoProximo(p);
      } catch (err) {
        proximo.textContent = app.mensajeUsuario(err);
      }
    };
    for (const { input } of Object.values(f.entradas)) input.oninput = actualizar;
    actualizar();
  }
  function nuevoService(r = null) {
    const target = app.abrirDialogo(r ? 'Corregir service' : 'Marcar service hecho');
    target.append(app.e('p', 'Marcá solo las tareas hechas. El costo se carga una sola vez.'));
    const f = app.formulario(
      target,
      [
        app.camion(),
        app.fecha(),
        app.campo('km', 'Kilómetros del service', 'number'),
        app.monto('costoCentavos', 'Costo total (0 si no costó)'),
        app.campo('taller', 'Taller (opcional)', 'text', null, false),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Revisar próximo service',
      async (v) => revisarService(v, r, tasks),
      r ?? {
        camionId: app.camionElegido ?? '',
        fecha: app.hoy(),
      },
    );
    const tasks = app.e('fieldset');
    tasks.append(app.e('legend', 'Tareas hechas'));
    f.form.insertBefore(tasks, f.form.lastElementChild);
    function actualizar() {
      tasks.replaceChildren(app.e('legend', 'Tareas hechas'));
      for (const p of app.datos.planes.filter(
        (p) => app.activo(p) && p.camionId === f.entradas.camionId.input.value,
      )) {
        const l = app.e('label', p.tarea);
        const i = app.e('input');
        i.type = 'checkbox';
        i.value = p.id;
        i.checked = r?.planIds.includes(p.id) ?? false;
        app.asociar(l, i);
        l.prepend(i);
        tasks.append(l);
      }
    }
    f.entradas.camionId.input.onchange = actualizar;
    actualizar();
  }
  function editarReparacion(r = null) {
    app.formulario(
      app.abrirDialogo(r ? 'Corregir reparación' : 'Registrar reparación por falla'),
      [
        app.camion(),
        app.fecha(),
        app.campo('descripcion', 'Qué se reparó', 'textarea'),
        app.monto('costoCentavos', 'Costo'),
        app.campo('taller', 'Taller (opcional)', 'text', null, false),
        app.archivo(),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar reparación',
      (v) =>
        app.cambiar(async (d) => {
          const item = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            camionId: v.camionId,
            fecha: v.fecha,
            descripcion: v.descripcion,
            costoCentavos: v.costoCentavos,
            taller: v.taller,
            archivoId: r?.archivoId,
          };
          M.gastoDeReparacion(item);
          await app.ponerArchivo(d, v.archivo, item);
          if (r) {
            app.historial(d, 'reparaciones', r, v.motivo);
            Object.assign(
              d.reparaciones.find((x) => x.id === r.id),
              item,
            );
          } else d.reparaciones.push(item);
        }),
      r ?? {
        camionId: app.camionElegido ?? '',
      },
    );
  }
  function corregirService(s) {
    app.formulario(
      app.abrirDialogo('Corregir costo del service'),
      [app.monto('costoCentavos', 'Costo correcto'), app.campo('motivo', 'Motivo', 'textarea')],
      'Guardar corrección',
      (v) =>
        app.cambiar((d) => {
          app.historial(d, 'services', s, v.motivo);
          Object.assign(
            d.services.find((x) => x.id === s.id),
            M.corregirCostoService(s, v.costoCentavos, app.hoy(), v.motivo).service,
          );
        }),
      s,
    );
  }
  function anularService(d, s) {
    for (const pid of s.planIds) {
      const p = d.planes.find((p) => p.id === pid);
      if (p) {
        p.proximoKm = null;
        p.proximaFecha = null;
        p.ultimoKm = null;
        p.ultimaFecha = null;
        p.revisar = true;
      }
    }
  }
  function mantenimiento() {
    const a = app.e('div', undefined, 'acciones');
    a.append(
      app.btn('Marcar service hecho', () => app.nuevoService(), 'principal'),
      app.btn('Agregar plan', () => app.editarPlan()),
      app.btn('Registrar reparación', () => app.editarReparacion()),
    );
    app.root.append(
      a,
      app.e('p', 'Las reparaciones por falla se cargan aparte y no cambian los planes.', 'ayuda'),
    );
    if (app.camionElegido)
      app.root.append(app.btn('Ver todos los camiones', () => app.cambiarPagina('Mantenimiento')));
    for (const p of app
      .planes()
      .filter((p) => !app.camionElegido || p.camionId === app.camionElegido)) {
      const r = M.estadoPlan(p, app.km(p.camionId), app.hoy(), app.datos.config);
      app.filaRegistro(
        app.root,
        p.tarea + ' · ' + app.nombreCamion(p.camionId),
        p.revisar
          ? 'Necesita revisión · Se anuló un service. Corregí el plan y confirmá el próximo.'
          : r.motivo,
        [
          ...app.acciones('planes', p, app.editarPlan),
          ...(r.estado === 'km-incierto'
            ? [app.btn('Actualizar kilómetros', () => app.editarKm(p.camionId))]
            : []),
        ],
      );
    }
    const h = app.seccion('Historial de mantenimiento');
    for (const s of app.datos.services.filter(
      (s) => !app.camionElegido || s.camionId === app.camionElegido,
    ))
      app.filaRegistro(
        h,
        'Service · ' + app.nombreCamion(s.camionId),
        s.fecha +
          ' · ' +
          s.km.toLocaleString('es-AR') +
          ' km · ' +
          moneda(s.costoCentavos) +
          ' · ' +
          s.planIds
            .map((pid) => app.datos.planes.find((p) => p.id === pid)?.tarea ?? '')
            .join(', ') +
          (s.anulado ? ' · Service anulado · ' + s.anulado.motivo : ''),
        app.acciones('services', s, (r) => app.nuevoService(r), app.anularService),
      );
    for (const r of app.datos.reparaciones.filter(
      (r) => !app.camionElegido || r.camionId === app.camionElegido,
    ))
      app.filaRegistro(
        h,
        'Reparación · ' + app.nombreCamion(r.camionId),
        r.fecha +
          ' · ' +
          r.descripcion +
          ' · ' +
          moneda(r.costoCentavos) +
          (r.anulado ? ' · Carga anulada · ' + r.anulado.motivo : ''),
        app.acciones('reparaciones', r, app.editarReparacion),
      );
  }

  app.editarPlan = editarPlan;
  app.nuevoService = nuevoService;
  app.editarReparacion = editarReparacion;
  app.corregirService = corregirService;
  app.anularService = anularService;
  app.mantenimiento = mantenimiento;
  function revisarService(v, r, tasks) {
    const ids = [...tasks.querySelectorAll('input:checked')].map((i) => i.value);
    const s = {
      id: r?.id ?? app.id(),
      empresaId: app.espacio,
      camionId: v.camionId,
      fecha: v.fecha,
      km: v.km,
      costoCentavos: v.costoCentavos,
      taller: v.taller,
      planIds: ids,
    };
    const lectura = lecturaParaService(s);
    const basePlanes = structuredClone(app.datos.planes.filter(app.activo));
    if (r)
      for (const p of basePlanes.filter(
        (p) => r.planIds.includes(p.id) && p.ultimaFecha === r.fecha && p.ultimoKm === r.km,
      )) {
        p.proximoKm = null;
        p.proximaFecha = null;
        p.ultimaFecha = null;
        p.ultimoKm = null;
        p.revisar = true;
      }
    const result = M.completarService(
      basePlanes,
      s,
      app.datos.services.filter((x) => x.id !== r?.id),
    );
    confirmarService(result, s, lectura, r, v.motivo, ids);
    return false;
  }

  // El service reutiliza la lectura aceptada del día; no puede contradecirla.
  function lecturaParaService(s) {
    const lecturaId = app.id();
    let lectura = app.datos.lecturas.find(
      (l) =>
        !l.anulado &&
        l.camionId === s.camionId &&
        l.fecha === s.fecha &&
        l.resultado !== 'a-revisar',
    );
    if (lectura && lectura.km !== s.km)
      throw Error(
        'Ese día guardaste otros kilómetros. Abrí la ficha del camión y corregí los kilómetros de ese día.',
      );
    if (!lectura) {
      const rr = C.registrarLecturaKm(
        app.datos.lecturas.filter(app.activo),
        {
          id: lecturaId,
          empresaId: app.espacio,
          camionId: s.camionId,
          fecha: s.fecha,
          km: s.km,
        },
        app.datos.config,
      );
      lectura = rr.lecturas.find((l) => l.id === lecturaId);
      if (rr.resultado === 'a-revisar')
        throw Error(
          'El salto de kilómetros necesita revisión. Cargalo y revisalo primero en la ficha del camión.',
        );
    }

    return lectura;
  }

  // Todavía no se escribe nada: esta segunda pantalla confirma cada próximo límite.
  function confirmarService(result, s, lectura, r, motivo, ids) {
    const next = app.abrirDialogo('Confirmar próximo service');
    app.borrador = true;
    const campos = [];
    for (const sug of result.sugeridos) {
      const p = app.datos.planes.find((p) => p.id === sug.planId);
      campos.push(
        app.campo('km_' + p.id, p.tarea + ' · Próximo km', 'number', null, false),
        app.campo('fecha_' + p.id, p.tarea + ' · Próxima fecha', 'date', null, false),
      );
    }
    const inicial = {};
    for (const sug of result.sugeridos) {
      inicial['km_' + sug.planId] = sug.proximoKm;
      inicial['fecha_' + sug.planId] = sug.proximaFecha;
    }
    next.append(
      app.e('p', 'Revisá y confirmá cada próximo vencimiento. Solo se guardará cuando confirmes.'),
    );
    if (r)
      next.append(
        app.aviso(
          'Las tareas retiradas del service que dependían de esa carga quedan para revisar. El registro anterior se conserva en el historial.',
        ),
      );
    app.formulario(
      next,
      campos,
      'Confirmar y guardar service',
      (x) =>
        app.cambiar((d) => {
          s.planesAntes = structuredClone(d.planes.filter((p) => ids.includes(p.id)));
          d.planes = d.planes.map((p) => result.planes.find((n) => n.id === p.id) ?? p);
          for (const sug of result.sugeridos) {
            const i = d.planes.findIndex((p) => p.id === sug.planId);
            d.planes[i] = {
              ...M.confirmarProximo(d.planes[i], {
                proximoKm: x['km_' + sug.planId],
                proximaFecha: x['fecha_' + sug.planId] || undefined,
              }),
              revisar: false,
            };
          }
          if (r) {
            app.historial(d, 'services', r, motivo);
            Object.assign(
              d.services.find((x) => x.id === r.id),
              s,
            );
          } else d.services.push(s);
          if (!d.lecturas.some((l) => l.id === lectura.id)) d.lecturas.push(lectura);
        }),
      inicial,
    );
  }
}
