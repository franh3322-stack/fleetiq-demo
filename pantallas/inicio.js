import { avisosParaMostrar, presentarAviso } from '../ui/avisos.js';
import { resumenFlota } from '../dominio/saldo-mensual.js';
import { moneda, movimientos } from '../datos.js';

// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarInicio(app) {
  function inicio() {
    const selector = app.e('div', undefined, 'mes-selector');
    const input = app.e('input');
    input.type = 'month';
    input.value = app.mesResultado;
    input.setAttribute('aria-label', 'Mes del resultado');
    function mover(delta) {
      const [a, m] = input.value.split('-').map(Number);
      const d = new Date(a, m - 1 + delta, 1);
      input.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      calcular();
    }
    const anterior = app.btn('◀', () => mover(-1));
    anterior.setAttribute('aria-label', 'Mes anterior');
    const siguiente = app.btn('▶', () => mover(1));
    siguiente.setAttribute('aria-label', 'Mes siguiente');
    selector.append(anterior, input, siguiente);
    app.root.append(selector);
    const aclaracion = app.e('details', undefined, 'aclaracion');
    aclaracion.append(
      app.e('summary', 'Según lo cargado · Qué incluye'),
      app.e(
        'p',
        'Resultado según los ingresos y gastos cargados, en pesos de cada mes, sin ajuste por inflación. No incluye todos los costos contables. Revisá si faltan ingresos o gastos. IVA incluido, sin separarlo.',
      ),
    );
    const output = app.e('div');
    app.root.append(output);
    function calcular() {
      if (!input.value) return;
      app.mesResultado = input.value;
      output.replaceChildren();
      const r = resumenFlota(
        app.espacio,
        input.value,
        app.datos.camiones.map((c) => c.id),
        movimientos(app.datos),
      );
      const total = app.seccion('Resultado del mes', output);
      total.classList.add('resultado-total');
      total.append(
        app.e(
          'p',
          moneda(r.totales.saldoCentavos),
          'numero ' + app.claseResultado(r.totales.saldoCentavos),
        ),
        app.e('p', 'Ingresos cargados: ' + moneda(r.totales.ingresosCentavos)),
        app.e('p', 'Gastos cargados: ' + moneda(r.totales.gastosCentavos)),
      );
      aclaracion.querySelector('.criterio')?.remove();
      aclaracion.append(
        app.e(
          'p',
          app.datos.config.criterio === 'viaje'
            ? 'Los ingresos cuentan por fecha del viaje hecho.'
            : 'Los cheques cuentan cuando se acreditan; los demás pagos y la retención vigente, en fecha del cobro asignado a un viaje. Los anticipos sin viaje se ven en Cobros.',
          'criterio',
        ),
      );
      const max = Math.max(1, ...r.camiones.map((c) => Math.abs(c.saldoCentavos)));
      for (const c of r.camiones) {
        const n = app.seccion(app.nombreCamion(c.camionId), output);
        const neg = c.saldoCentavos < 0;
        n.append(
          app.e(
            'p',
            (c.saldoCentavos === 0
              ? 'Resultado'
              : neg
                ? 'Resultado negativo'
                : 'Resultado positivo') +
              ' · ' +
              moneda(c.saldoCentavos),
            app.claseResultado(c.saldoCentavos),
          ),
        );
        const barra = app.e('div', undefined, 'barra');
        barra.setAttribute('aria-hidden', 'true');
        for (const lado of [true, false]) {
          const span = app.e('span');
          if (c.saldoCentavos !== 0 && neg === lado) {
            const i = app.e('i');
            i.style.width = (Math.abs(c.saldoCentavos) / max) * 100 + '%';
            i.style.background = neg ? 'var(--rojo)' : 'var(--verde)';
            i.style[neg ? 'right' : 'left'] = '0';
            span.append(i);
          }
          barra.append(span);
        }
        n.append(
          barra,
          app.e(
            'p',
            'Ingresos ' + moneda(c.ingresosCentavos) + ' · Gastos ' + moneda(c.gastosCentavos),
          ),
          app.btn('Ver camión', () => app.cambiarPagina('Camiones', c.camionId)),
        );
      }
      if (r.sinCamion.cantidad)
        output.append(
          app.aviso(
            'Gastos generales: ' +
              moneda(r.sinCamion.gastosCentavos) +
              '. Se incluyen en el total, sin repartir por camión.',
          ),
        );
    }
    input.onchange = calcular;
    calcular();
    app.root.insertBefore(aclaracion, output);
    mostrarAvisos();
  }
  app.inicio = inicio;
  function mostrarAvisos() {
    const atender = app.seccion('Para atender');
    const avisos = avisosParaMostrar(app.datos, app.hoy());
    const pendiente = app.datos.clientes.reduce(
      (s, c) => s + Math.max(0, app.cuenta(c).saldoCentavos),
      0,
    );
    atender.append(
      app.e('p', 'Pendiente de cobrar: ' + moneda(pendiente)),
      app.e('p', 'En cheques sin cobrar: ' + moneda(app.datos.clientes.reduce((s,c)=>s+app.cuenta(c).chequesSinCobrarCentavos,0))),
      app.btn('Ver cobros', () => app.cambiarPagina('Cobros')),
    );
    if (!avisos.length) atender.append(app.e('p', 'No hay avisos con lo cargado.'));
    for (const a of avisos) {
      const fila = app.e('div');
      const aviso = presentarAviso(a);
      fila.append(app.btn(aviso.texto, () => app.cambiarPagina(aviso.pagina, aviso.camionId)));
      if (aviso.actualizarKm)
        fila.append(app.btn('Actualizar kilómetros', () => app.editarKm(aviso.camionId)));
      atender.append(fila);
    }
    for (const p of app.datos.planes.filter(
      (p) =>
        !p.anulado &&
        p.revisar &&
        !avisos.some((a) => a.tipo === 'mantenimiento' && a.refId === p.id),
    ))
      atender.append(
        app.btn(p.tarea + ' · Necesita revisión: confirmá el próximo service.', () =>
          app.cambiarPagina('Mantenimiento', p.camionId),
        ),
      );
    for (const l of app.datos.lecturas.filter((l) => !l.anulado && l.resultado === 'a-revisar'))
      atender.append(
        app.btn(
          app.nombreCamion(l.camionId) +
            ' · Necesita revisión: revisá los kilómetros del ' +
            l.fecha,
          () => app.cambiarPagina('Camiones', l.camionId),
        ),
      );
  }
}
