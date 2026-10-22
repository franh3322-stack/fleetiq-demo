import * as M from '../dominio/vencimientos.js';

// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarElementos(app) {
  app.e = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = M.formatoFecha(String(text));
    if (cls) n.className = cls;
    return n;
  };
  app.btn = (text, fn, cls) => {
    const b = app.e('button', text, cls);
    b.type = 'button';
    b.onclick = fn;
    return b;
  };

  function aviso(text) {
    const n = app.e('p', text, 'aviso');
    n.setAttribute('role', 'alert');
    return n;
  }
  function seccion(titulo, target = app.root) {
    const n = app.e('section', undefined, 'tarjeta');
    n.append(app.e('h2', titulo));
    target.append(n);
    return n;
  }
  function filaRegistro(target, titulo, texto, acciones = []) {
    const n = app.e('article', undefined, 'tarjeta');
    n.append(app.e('h3', titulo), app.e('p', texto));
    const a = app.e('div', undefined, 'acciones');
    a.append(...acciones);
    n.append(a);
    target.append(n);
    return n;
  }
  function asociar(label, input) {
    input.id = 'campo-' + ++app.campoId;
    label.setAttribute('for', input.id);
  }
  app.aviso = aviso;
  app.seccion = seccion;
  app.filaRegistro = filaRegistro;
  app.asociar = asociar;
}
