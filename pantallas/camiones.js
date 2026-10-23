import * as C from '../dominio/camiones.js';

import * as M from '../dominio/vencimientos.js';
import { resumenFlota } from '../dominio/saldo-mensual.js';
import { moneda, movimientos, papelVigente, consumoCombustible } from '../datos.js';

// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarCamiones(app) {
  function editarCamion(r = null) {
    app.formulario(
      app.abrirDialogo(r ? 'Corregir camión' : 'Agregar camión'),
      [
        app.campo('patente', 'Patente'),
        app.campo('nombre', 'Nombre (opcional)', 'text', null, false),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar camión',
      async (v) =>
        app.cambiar((d) => {
          const nuevo = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            patente: C.normalizarPatente(v.patente),
            nombre: v.nombre,
            activo: r?.activo ?? true,
          };
          C.validarNuevoCamion(
            nuevo,
            d.camiones.filter((c) => c.id !== nuevo.id),
          );
          if (r) {
            app.historial(d, 'camiones', r, v.motivo);
            Object.assign(
              d.camiones.find((c) => c.id === r.id),
              nuevo,
            );
          } else d.camiones.push(nuevo);
        }),
      r ?? {},
    );
  }
  function camiones() {
    if (app.camionElegido) {
      const c = app.datos.camiones.find((c) => c.id === app.camionElegido);
      if (!c) return;
      app.root.append(app.btn('Volver a la lista', () => app.cambiarPagina('Camiones')));
      const n = app.seccion(app.nombreCamion(c.id) + ' · ' + (c.nombre ?? ''));
      const k = app.km(c.id);
      n.append(
        app.e(
          'p',
          k ? `${k.km.toLocaleString('es-AR')} km` : 'Todavía no hay kilómetros cargados.',
          'numero',
        ),
        ...(k ? [app.e('p', 'Lectura del ' + M.formatoFecha(k.fecha), 'ayuda')] : []),
        app.btn('Actualizar kilómetros', () => app.editarKm(c.id)),
        app.btn('Corregir camión', () => app.editarCamion(c)),
        app.btn(c.activo === false ? 'Activar camión' : 'Dejar inactivo', () => {
          app.formulario(
            app.abrirDialogo('Cambiar disponibilidad'),
            [app.campo('motivo', 'Motivo', 'textarea')],
            'Guardar cambio',
            (v) =>
              app.cambiar((d) => {
                app.historial(d, 'camiones', c, v.motivo);
                d.camiones.find((x) => x.id === c.id).activo = c.activo === false;
              }),
          );
        }),
      );
      const consumo=consumoCombustible(app.datos,c.id,app.mesResultado);
      const panelConsumo=app.seccion('Consumo');
      const litros=n=>n.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})+' L/100 km';
      panelConsumo.append(app.e('p',consumo.ultimo===null?'Faltan dos cargas con litros y km válidos para calcular el consumo.':'Último: '+litros(consumo.ultimo)),app.e('p',consumo.promedioMes===null?'Todavía no hay datos suficientes para el promedio del mes.':'Promedio de '+new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(app.mesResultado+'-01T12:00:00Z'))+': '+litros(consumo.promedioMes)),app.e('p','Estimación entre cargas. El promedio usa litros totales sobre km totales; compará cargas similares.','ayuda'));
      papelesDelCamion(c, k);
      mantenimientoDelCamion(c, k);
      resultadoDelCamion(c, k);
      historialDelCamion(c, k);
      return;
    }
    app.root.append(app.btn('Agregar camión', () => app.editarCamion(), 'principal'));
    const l = app.e('label', 'Buscar por patente o nombre');
    const input = app.e('input');
    input.type = 'search';
    app.asociar(l, input);
    l.append(input);
    const chk = app.e('input');
    chk.type = 'checkbox';
    const lc = app.e('label', ' Incluir inactivos');
    app.asociar(lc, chk);
    lc.prepend(chk);
    app.root.append(l, lc);
    const lista = app.e('div');
    app.root.append(lista);
    function mostrar() {
      lista.replaceChildren();
      const cs = C.buscarCamiones(app.datos.camiones, input.value, {
        incluirInactivos: chk.checked,
      });
      if (!cs.length) lista.append(app.e('p', 'No hay camiones. Agregá uno para empezar.'));
      for (const c of cs)
        app.filaRegistro(lista, app.nombreCamion(c.id), c.nombre ?? '', [
          app.btn('Ver ficha' + (c.activo === false ? ' · Inactivo' : ''), () =>
            app.cambiarPagina('Camiones', c.id),
          ),
        ]);
    }
    input.oninput = mostrar;
    chk.onchange = mostrar;
    mostrar();
  }
  function editarKm(cid, r = null) {
    const target = app.abrirDialogo(r ? 'Corregir kilómetros' : 'Actualizar kilómetros');
    const campos = [
      app.fecha(),
      app.campo('km', 'Kilómetros', 'number'),
      app.campo('cambio', '¿Cambió el odómetro?', 'select', [
        ['no', 'No'],
        ['si', 'Sí'],
      ]),
      ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
    ];
    app.formulario(
      target,
      campos,
      'Guardar kilómetros',
      (v) =>
        app.cambiar((d) => {
          const lectura = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            camionId: cid,
            fecha: v.fecha,
            km: v.km,
            cambioOdometro: v.cambio === 'si',
          };
          const result = C.registrarLecturaKm(
            d.lecturas.filter((l) => !l.anulado && l.id !== r?.id),
            lectura,
            d.config,
          );
          if (r) {
            app.historial(d, 'lecturas', r, v.motivo);
            d.lecturas = d.lecturas.map((l) =>
              l.id === r.id ? result.lecturas.find((x) => x.id === r.id) : l,
            );
          } else d.lecturas.push(result.lecturas.find((x) => x.id === lectura.id));
          if (result.resultado === 'a-revisar')
            setTimeout(() => {
              app.$('#estado').textContent = 'Necesita revisión';
            }, 0);
        }),
      {
        ...(r ?? {}),
        cambio: r?.cambioOdometro ? 'si' : 'no',
      },
    );
  }
  app.editarCamion = editarCamion;
  app.camiones = camiones;
  app.editarKm = editarKm;
  function papelesDelCamion(c, k) {
    const pap = app.seccion('Papeles del camión');
    for (const p of app.datos.papeles.filter((p) => papelVigente(p, app.datos.papeles) && p.camionId === c.id)) {
      const estado = M.estadoPapel(p, app.hoy(), app.datos.config);
      app.filaRegistro(
        pap,
        p.tipo,
        {
          vencido: 'Vencido',
          'vence-hoy': 'Vence hoy',
          proximo: 'Vence pronto',
          'al-dia': 'Al día',
          'sin-vencimiento': 'Sin vencimiento',
        }[estado] + (p.vence ? ' · ' + M.formatoFecha(p.vence) : ''),
        app.accionesPapel(p),
      );
    }
    pap.append(app.btn('Agregar papel', () => app.editarPapel()));
  }

  function mantenimientoDelCamion(c, k) {
    const mant = app.seccion('Mantenimiento programado');
    for (const p of app.planes().filter((p) => p.camionId === c.id)) {
      const estado = M.estadoPlan(p, k, app.hoy(), app.datos.config);
      app.filaRegistro(
        mant,
        p.tarea,
        {
          vencido: 'Vencido',
          alcanzado: 'Llegó al límite',
          'km-incierto': 'Actualizar kilómetros',
          proximo: 'Se acerca',
          'al-dia': 'Al día',
          'sin-programacion': 'Sin programación',
        }[estado.estado] +
          ' · ' +
          app.textoProximo(p),
        [
          app.btn('Marcar service hecho', () => app.nuevoService()),
          ...app.acciones('planes', p, app.editarPlan),
          ...(estado.estado === 'km-incierto'
            ? [app.btn('Actualizar kilómetros', () => app.editarKm(c.id))]
            : []),
        ],
      );
    }
    mant.append(app.btn('Agregar plan', () => app.editarPlan()));
  }

  function resultadoDelCamion(c, k) {
    const resultado = resumenFlota(
      app.espacio,
      app.mesResultado,
      app.datos.camiones.map((c) => c.id),
      movimientos(app.datos),
    ).camiones.find((x) => x.camionId === c.id);
    const res = app.seccion('Resultado del camión en el mes');
    res.append(
      app.e(
        'p',
        new Intl.DateTimeFormat('es-AR', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(app.mesResultado + '-01T12:00:00Z')),
      ),
      app.e('p', moneda(resultado.saldoCentavos), app.claseResultado(resultado.saldoCentavos)),
      app.e(
        'p',
        'Ingresos ' +
          moneda(resultado.ingresosCentavos) +
          ' · Gastos ' +
          moneda(resultado.gastosCentavos),
      ),
      app.e('p', 'Según lo cargado. No incluye todos los costos contables.'),
    );
  }

  function historialDelCamion(c, k) {
    const hist = app.seccion('Historial del camión');
    const eventos = [];
    for (const l of app.datos.lecturas.filter((l) => l.camionId === c.id))
      eventos.push({
        fecha: l.fecha,
        nodo: app.filaRegistro(
          app.e('div'),
          l.fecha + ' · Kilómetros · ' + l.km.toLocaleString('es-AR') + ' km',
          l.anulado
            ? 'Carga anulada · ' + l.anulado.motivo
            : l.resultado === 'a-revisar'
              ? 'Necesita revisión'
              : 'Guardado',
          [],
        ),
      });
    const categorias = {
      combustible: 'Combustible',
      peaje: 'Peaje',
      reparacion: 'Reparación por falla',
      mantenimiento: 'Mantenimiento',
      cubiertas: 'Cubiertas',
      otro: 'Otro',
    };
    for (const [lista, etiqueta] of [
      ['gastos', 'Gasto'],
      ['services', 'Service'],
      ['reparaciones', 'Reparación por falla'],
      ['viajes', 'Viaje'],
      ['papeles', 'Papel'],
    ])
      for (const r of app.datos[lista].filter((r) => r.camionId === c.id)) {
        const importe = r.importeCentavos ?? r.costoCentavos ?? r.tarifaCentavos;
        const detalle =
          lista === 'gastos'
            ? categorias[r.categoria]
            : lista === 'services'
              ? r.planIds
                  .map((pid) => app.datos.planes.find((p) => p.id === pid)?.tarea ?? '')
                  .join(', ') +
                ' · ' +
                r.km.toLocaleString('es-AR') +
                ' km'
              : (r.tipo ?? r.descripcion ?? r.origen ?? '');
      // El vencimiento no es un hecho del historial. Sin fecha de carga no se inventa una.
      const fecha = lista === 'papeles' ? (r.fechaCarga ?? '') : (r.fecha ?? '');
        eventos.push({
          fecha,
          nodo: app.e(
            'p',
            (fecha || 'Sin fecha de carga') +
              ' · ' +
              etiqueta +
              ' · ' +
              detalle +
              (lista === 'papeles'
                ? r.vence
                  ? ' · Vence el ' + M.formatoFecha(r.vence)
                  : ' · Sin vencimiento'
                : '') +
              (importe != null ? ' · ' + moneda(importe) : '') +
              (r.anulado ? ' · Carga anulada · ' + r.anulado.motivo : ''),
          ),
        });
      }
    for (const h of app.datos.historial.filter(
      (h) => h.antes?.camionId === c.id || (h.tipo === 'camiones' && h.registroId === c.id),
    ))
      eventos.push({
        fecha: h.fecha,
        nodo: app.e('p', 'Correcci\u00f3n \u00b7 ' + h.fecha + ' \u00b7 ' + h.motivo),
      });
    for (const evento of eventos.sort((a, b) => b.fecha.localeCompare(a.fecha)))
      hist.append(evento.nodo);
  }
}
