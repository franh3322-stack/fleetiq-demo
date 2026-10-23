import { leerDecimal } from '../dominio/operacion.js';
import { leerMonto } from '../datos.js';

export function mensajeFaltante(campo) {
  const especiales = {
    fecha: 'Elegí la fecha',
    medio: 'Elegí cómo te pagó',
    camionId: 'Elegí el camión (o General)',
    categoria: 'Elegí qué gasto es',
    motivo: 'Contá por qué se corrige',
    patente: 'Escribí la patente',
    plazoDias: 'Escribí cuántos días hay para cobrar',
    saldoInicialCentavos: 'Escribí la deuda al empezar (0 si no debía)',
  };
  return especiales[campo.nombre] ?? pedidoCampo(campo);
}

export function pedidoCampo(campo) {
  return (
    (campo.tipo === 'select' || campo.tipo === 'date' ? 'Elegí ' : 'Escribí ') +
    (campo.tipo === 'monto' ? 'el ' : '') +
    campo.etiqueta.toLowerCase()
  );
}

// Los campos numéricos opcionales vacíos siguen siendo ausentes, no cero.
export function valorFormulario(campo, texto) {
  const valor = texto.trim();
  if (campo.decimales) return leerDecimal(valor,campo.decimales);
  if (campo.tipo === 'monto') return valor ? leerMonto(valor) : undefined;
  if (campo.tipo !== 'number') return valor;
  if (valor === '') return undefined;
  // Se acepta el punto de miles ("160.000"); nunca se lee como decimal ni se descarta en silencio.
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)$/.test(valor))
    throw Error('Escribí solo números enteros, con o sin punto de miles. Por ejemplo: 160.000.');
  const numero = Number(valor.replaceAll('.', ''));
  if (!Number.isSafeInteger(numero)) throw Error('El número es demasiado grande.');
  return numero;
}
