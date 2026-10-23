import { moneda } from '../datos.js';
import * as M from '../dominio/vencimientos.js';

export function espacioInicial() {
  try {
    return globalThis.localStorage?.getItem('fleetiq-espacio') === 'real' ? 'real' : 'demo';
  } catch {
    return 'demo';
  }
}

export function mensajeUsuario(err) {
  if (err?.name === 'QuotaExceededError')
    return 'No hay espacio para guardar. Exportá un respaldo desde Ajustes.';
  if (err instanceof TypeError || err instanceof SyntaxError)
    return 'No pudimos leer los datos. Revisá la carga o elegí un respaldo exportado por FleetIQ.';
  if (err instanceof DOMException)
    return 'No pudimos guardar en este navegador. Probá de nuevo o exportá un respaldo desde Ajustes.';
  const texto = (err.message || 'No pudimos guardar. Probá de nuevo.').replace(
    /^(Lectura|Service|Plan|Reparación|Viaje|Cobro|Movimiento) [^:]+:\s*/,
    '',
  );
  return M.formatoFecha(texto)
    .replace(/id repetido[^.]*\.?/gi, 'Esta carga ya existe.')
    .replace(/rango seguro/g, 'tamaño que podemos guardar')
    .replace(/enteros no negativos seguros/g, 'números enteros sin signo');
}

export function textoProximo(p) {
  const l = M.limitesPlan(p);
  const partes = [];
  if (l.limiteKm != null) partes.push(l.limiteKm.toLocaleString('es-AR') + ' km');
  if (l.limiteFecha) partes.push(M.formatoFecha(l.limiteFecha));
  return partes.length
    ? 'Próximo: ' + partes.join(' o ') + (partes.length === 2 ? ', lo que llegue primero' : '')
    : 'Completá el intervalo y cuándo fue el último service para calcular el próximo.';
}

export const claseResultado = (valor) => (valor < 0 ? 'negativo' : valor > 0 ? 'positivo' : '');

export function textoConfirmacion(texto, values, nombreCamion) {
  if (texto === 'Guardar cobro' && values.medio) {
    const retiene = values.tieneRetencion === 'si';
    return 'Cobro guardado: ' + detalleCobro({ ...values, retencionCentavos: retiene ? values.retencionCentavos : undefined }) +
      (values.fecha ? ' · ' + M.formatoFecha(values.fecha) : '') +
      (['cheque', 'echeq'].includes(values.medio) && values.cobrableDesde ? ' · Se puede cobrar desde ' + M.formatoFecha(values.cobrableDesde) : '');
  }
  return (
    (/service/i.test(texto)
      ? 'Service guardado'
      : texto === 'Guardar correcci\u00f3n'
        ? 'Correcci\u00f3n guardada'
        : texto.replace(/^Guardar /, '').replace(/^./, (c) => c.toUpperCase()) + ' guardado') +
    (values.categoria
      ? ': ' +
        {
          reparacion: 'Reparaci\u00f3n',
          combustible: 'Combustible',
          peaje: 'Peaje',
          mantenimiento: 'Mantenimiento',
          cubiertas: 'Cubiertas',
          otro: 'Otro',
        }[values.categoria]
      : '') +
    (values.importeCentavos !== undefined ? ' ' + moneda(values.importeCentavos) : '') +
    (values.camionId ? ' \u00b7 ' + nombreCamion : '') +
    (values.fecha ? ' \u00b7 ' + M.formatoFecha(values.fecha) : '')
  );
}

export const nombreMedio = (medio) => ({ transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', echeq: 'E-cheq', otro: 'Otro' })[medio] ?? medio;

export const detalleCobro = c => nombreMedio(c.medio) + ' ' + moneda(c.importeCentavos) + (c.retencionCentavos ? ' + retención ' + (c.retencionTipo === 'iibb' ? 'IIBB' : 'Otra') + ' ' + moneda(c.retencionCentavos) : '');
