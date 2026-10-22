import { adjunto } from '../almacen.js';

// La preparación termina antes de permitir el guardado; quitar libera la URL de vista previa.
export function configurarAdjunto(app, input, l, falta) {
  if (input.type !== 'file') return;

  input.accept = 'image/*,application/pdf';
  const preview = app.e('div');
  l.append(preview);
  let url;
  input.onchange = async () => {
    app.borrador = true;
    if (url) URL.revokeObjectURL(url);
    preview.replaceChildren();
    input.preparado = null;
    input.preparando = true;
    try {
      if (input.files?.[0]) {
        const a = await adjunto(input.files[0], app.espacio);
        input.preparado = a;
        url = URL.createObjectURL(a.blob);
        preview.append(
          app.e(
            'p',
            a.nombre +
              ' \u00b7 ' +
              (a.blob.size / 1024).toLocaleString('es-AR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }) +
              ' KB',
          ),
        );
        const mini = app.e(a.blob.type.startsWith('image/') ? 'img' : 'iframe');
        mini.src = url;
        mini.alt = a.nombre;
        mini.title = a.nombre;
        mini.style = 'max-width:100%;height:140px';
        preview.append(
          mini,
          app.btn('Quitar', () => {
            input.value = '';
            input.preparado = null;
            preview.replaceChildren();
            URL.revokeObjectURL(url);
          }),
        );
      }
      falta.hidden = true;
    } catch (err) {
      falta.textContent = app.mensajeUsuario(err);
      falta.hidden = false;
      input.value = '';
      input.setAttribute('aria-invalid', 'true');
    } finally {
      input.preparando = false;
    }
  };
}
