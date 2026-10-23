import { configurarAdjunto } from './adjuntos.js';
import { mensajeFaltante, pedidoCampo, valorFormulario } from './validacion.js';
import { textoConfirmacion } from './formato.js';

import { moneda, leerMonto } from '../datos.js';

// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarFormularios(app) {
  app.fecha = () => app.campo('fecha', 'Fecha', 'date');
  app.monto = (nombre = 'importeCentavos', etiqueta = 'Monto') =>
    app.campo(nombre, etiqueta, 'monto');
  app.camion = (general = false) =>
    app.campo('camionId', 'Camión', 'select', [
      ...(general ? [['general', 'General · sin camión']] : []),
      ...app.datos.camiones
        .filter((c) => c.activo !== false)
        .map((c) => [c.id, app.nombreCamion(c.id) + ' · ' + (c.nombre ?? '')]),
    ]);
  app.clientes = () =>
    app.campo(
      'clienteId',
      'Cliente',
      'select',
      app.datos.clientes.map((c) => [c.id, c.nombre]),
    );
  app.archivo = () => app.campo('archivo', 'Foto o PDF (opcional)', 'file', null, false);

  function volverCarga() {
    if (app.ocupado) return;
    if (!app.borrador) {
      app.dialog.close();
      return;
    }
    if (app.detalle.querySelector('.salida')) return;
    const panel = app.e('section', undefined, 'salida aviso');
    panel.setAttribute('role', 'alert');
    panel.append(
      app.e('p', 'Tenés una carga sin guardar. ¿Querés seguir o descartarla?'),
      app.btn('Seguir cargando', () => panel.remove()),
      app.btn('Descartar y volver', () => {
        app.borrador = false;
        app.dialog.close();
      }),
    );
    app.detalle.prepend(panel);
  }
  function abrirDialogo(titulo) {
    app.borrador = false;
    app.detalle.replaceChildren(app.btn('Volver', app.volverCarga), app.e('h2', titulo));
    if (!app.dialog.open) {
      app.dialog.showModal();
      globalThis.history?.pushState({ fleetiq: 'dialogo' }, '');
    }
    return app.detalle;
  }
  function campo(nombre, etiqueta, tipo = 'text', opciones = null, requerido = true) {
    return {
      nombre,
      etiqueta,
      tipo,
      opciones,
      requerido,
    };
  }
  function formulario(target, campos, texto, action, inicial = {}) {
    const form = app.e('form', undefined, 'panel'),
      entradas = {},
      error = app.aviso('');
    error.hidden = true;
    form.noValidate = true;
    form.oninput = () => {
      if (target !== app.root) app.borrador = true;
    };
    form.onchange = form.oninput;
    for (const c of campos) crearEntrada(c, inicial, form, entradas);
    const submit = app.e('button', texto, 'principal');
    submit.type = 'submit';
    form.append(error, submit);
    target.append(form);
    form.onsubmit = (event) => procesarFormulario(event, entradas, error, submit, texto, action);
    const resultado = {
      form,
      entradas,
    };
    for (const [nombre, { c, input }] of Object.entries(entradas))
      if (
        c.tipo === 'select' &&
        (['camionId', 'clienteId', 'choferId', 'tipo'].includes(nombre) || c.opciones.length <= 6)
      )
        app.opcionesGrandes(
          resultado,
          nombre,
          [...input.options].filter((o) => o.value).map((o) => [o.value, o.textContent]),
        );
    if (entradas.choferId) form.insertBefore(app.btn('+ Nuevo chofer', () => app.editarChofer(null, resultado)),submit);
    if (entradas.clienteId)
      form.insertBefore(
        app.btn('+ Nuevo cliente', () => app.clienteEnFormulario(resultado)),
        submit,
      );
    return resultado;
  }
  function opcionesGrandes(container, nombre, valores) {
    const cantidad=valores.length;
    const { input } = container.entradas[nombre];
    if (input.hidden) return;
    if (!['camionId', 'clienteId', 'choferId', 'tipo'].includes(nombre) && cantidad > 6) return;
    const group = app.e('div', undefined, 'opciones');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', input.parentElement.firstChild.textContent);
    if (!container.entradas[nombre].c.requerido) valores = [['', 'Sin asignar'], ...valores];
    for (const [value, text] of valores) {
      const b = app.btn(text, () => {
        input.value = value;
        app.borrador = true;
        input.onchange?.();
        for (const child of group.children) child.setAttribute('aria-pressed', String(child === b));
      });
      b.setAttribute('aria-pressed', String(input.value === value));
      group.append(b);
    }
    if (['camionId','choferId'].includes(nombre) && cantidad > 6) {
      const busca = app.e('input');
      busca.type = 'search';
      busca.setAttribute('aria-label', nombre === 'choferId' ? 'Buscar chofer' : 'Buscar cami\u00f3n');
      busca.oninput = () => {
        for (const b of group.children)
          b.hidden = !b.textContent.toLowerCase().includes(busca.value.toLowerCase());
      };
      container.entradas[nombre].busca=busca;
      input.parentElement.append(busca);
    }
    input.parentElement.append(group);
    input.hidden = true;
    input.required = false;
  }
  function clienteEnFormulario(f) {
    const panel = app.e('section', undefined, 'tarjeta');
    f.form.parentElement.append(panel);
    app.formulario(
      panel,
      [
        app.campo('nombre', 'Nombre'),
        app.campo('plazoDias', 'D\u00edas para cobrar', 'number'),
        app.monto('saldoInicialCentavos', 'Deuda al empezar'),
      ],
      'Crear cliente',
      async (v) => {
        const nuevo = {
          ...v,
          id: app.id(),
          empresaId: app.espacio,
        };
        const ok = await app.cambiar((d) => d.clientes.push(nuevo));
        if (!ok) return false;
        const entrada = f.entradas.clienteId;
        entrada.input.append(new Option(nuevo.nombre, nuevo.id));
        entrada.input.value = nuevo.id;
        entrada.input.onchange?.();
        const grupo = entrada.input.parentElement.querySelector('.opciones');
        for (const b of grupo.children) b.setAttribute('aria-pressed', 'false');
        const b = app.btn(nuevo.nombre, () => {
          entrada.input.value = nuevo.id;
          entrada.input.onchange?.();
          for (const x of grupo.children) x.setAttribute('aria-pressed', String(x === b));
        });
        b.setAttribute('aria-pressed', 'true');
        grupo.append(b);
        panel.remove();
        return false;
      },
      {
        plazoDias: 30,
        saldoInicialCentavos: 0,
      },
    );
  }
  app.volverCarga = volverCarga;
  app.abrirDialogo = abrirDialogo;
  app.campo = campo;
  app.formulario = formulario;
  app.opcionesGrandes = opcionesGrandes;
  app.actualizarOpciones = (f, nombre) => {
    const input = f.entradas[nombre].input;
    input.parentElement.querySelector('.opciones')?.remove();
    f.entradas[nombre].busca?.remove();
    input.hidden = false;
    opcionesGrandes(f, nombre, [...input.options].filter((o) => o.value).map((o) => [o.value, o.textContent]));
  };
  app.clienteEnFormulario = clienteEnFormulario;
  function crearEntrada(c, inicial, form, entradas) {
    const l = app.e('label', c.etiqueta);
    let input;
    if (c.tipo === 'select') {
      input = app.e('select');
      input.append(new Option('Elegí una opción', ''));
      for (const [value, text] of c.opciones) input.append(new Option(text, value));
    } else if (c.tipo === 'textarea') input = app.e('textarea');
    else {
      input = app.e('input');
      // Montos y números enteros van como texto: el campo numérico del celular lee "160.000" como 160.
      input.type = ['monto', 'number'].includes(c.tipo) ? 'text' : c.tipo;
    }
    app.asociar(l, input);
    input.name = c.nombre;
    input.required = c.requerido;
    const falta = app.aviso('');
    falta.id = input.id + '-error';
    falta.hidden = true;
    input.setAttribute('aria-describedby', falta.id);
    entradas[c.nombre] = {
      input,
      c,
      falta,
    };
    configurarAdjunto(app, input, l, falta);
    if (c.decimales) { input.inputMode='decimal'; input.placeholder='Con coma, hasta '+c.decimales+' decimales'; }
    if (c.tipo === 'number') {
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
    }
    if (c.tipo === 'monto') {
      input.inputMode = 'decimal';
      input.placeholder = 'Por ejemplo: 85.000,50';
      const eco = app.e('div', 'Escribí el monto', 'eco');
      eco.setAttribute('aria-live', 'polite');
      input.oninput = () => {
        try {
          eco.textContent = moneda(leerMonto(input.value), true);
        } catch {
          eco.textContent = input.value ? 'Revisá el monto' : 'Escribí el monto';
        }
      };
      l.append(input, eco);
    } else l.append(input);
    if (
      c.nombre === 'camionId' &&
      inicial.camionId &&
      c.tipo === 'select' &&
      ![...input.options].some((o) => o.value === inicial.camionId)
    )
      input.append(
        new Option(app.nombreCamion(inicial.camionId) + ' · Inactivo', inicial.camionId),
      );
    if (c.nombre === 'fecha' && inicial[c.nombre] === undefined) input.value = app.hoy();
    if (inicial[c.nombre] !== undefined && c.tipo !== 'file')
      input.value =
        c.decimales ? (inicial[c.nombre] / 10 ** c.decimales).toLocaleString('es-AR',{useGrouping:false,minimumFractionDigits:c.decimales,maximumFractionDigits:c.decimales}) : c.tipo === 'monto'
          ? (inicial[c.nombre] / 100).toLocaleString('es-AR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
              useGrouping: false,
            })
          : (inicial[c.nombre] ?? '');
    if (c.nombre === 'patente') {
      const ayuda = app.e('small', 'Como figura en la chapa: AB 123 CD o ABC 123');
      ayuda.id = input.id + '-ayuda';
      l.append(ayuda);
      input.setAttribute('aria-describedby', ayuda.id + ' ' + falta.id);
    }
    l.append(falta);
    form.append(l);
    if (c.nombre === 'fechaBaseCobro') {
      const mas = app.e('details');
      mas.append(app.e('summary', 'M\u00e1s opciones'), l);
      form.append(mas);
    }
    if (c.tipo === 'monto' && input.value) input.oninput();
  }

  async function procesarFormulario(event, entradas, error, submit, texto, action) {
    event.preventDefault();
    event.stopPropagation?.();
    if (app.ocupado || submit.disabled) return;
    error.hidden = true;
    submit.disabled = true;
    try {
      const values = leerEntradas(entradas);
      if (values === null) return;
      const ok = await action(values);
      if (ok !== false) {
        app.confirmacion = textoConfirmacion(
          texto,
          values,
          values.camionId
            ? app.nombreCamion(values.camionId === 'general' ? null : values.camionId)
            : '',
        );
        app.dialog.close();
        app.pintar();
      }
    } catch (err) {
      error.textContent = app.mensajeUsuario(err);
      error.hidden = false;
      const textoError = error.textContent.toLowerCase();
      const candidatos = /monto|importe|costo|tarifa/.test(textoError)
        ? ['importeCentavos', 'costoCentavos', 'tarifaCentavos', 'saldoInicialCentavos']
        : /kilómetro|kilometro|km/.test(textoError)
          ? ['km', 'kmRecorridos', 'camionId']
          : /fecha|día/.test(textoError)
            ? ['fecha', 'vence', 'plazoDias']
            : /viaje/.test(textoError)
              ? ['viajeId']
              : /cliente|cuit/.test(textoError)
                ? ['cuit', 'clienteId', 'nombre']
                : [];
      const entrada =
        candidatos.map((n) => entradas[n]).find(Boolean) ?? Object.values(entradas)[0];
      if (entrada) {
        // El texto completo va junto al dato; abajo, junto a Guardar, solo se señala dónde mirar.
        entrada.falta.textContent = error.textContent;
        entrada.falta.hidden = false;
        error.textContent = 'Revisá el dato marcado más arriba.';
        entrada.input.setAttribute('aria-invalid', 'true');
        entrada.falta.scrollIntoView({
          block: 'nearest',
        });
      }
      if (app.datos)
        app.datos.soporte.push({
          fecha: new Date().toISOString(),
          detalle: String(err.stack ?? err),
        });
    } finally {
      submit.disabled = false;
    }
  }

  function leerEntradas(entradas) {
    const values = {};
    let incompleto = false;
    if (Object.values(entradas).some((x) => x.input.preparando))
      throw Error('Esperá a que termine de prepararse el archivo.');
    for (const { input, c, falta } of Object.values(entradas)) {
      if (input.parentElement.hidden) continue;
      const vacio = c.tipo === 'file' ? !input.files?.length : !input.value.trim();
      falta.hidden = true;
      input.setAttribute('aria-invalid', 'false');
      if (c.requerido && vacio) {
        falta.textContent = mensajeFaltante(c);
        falta.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        incompleto = true;
      }
    }
    if (incompleto) {
      Object.values(entradas)
        .find((x) => !x.falta.hidden)
        .falta.scrollIntoView({
          block: 'nearest',
        });
      return null;
    }
    for (const [name, { input, c }] of Object.entries(entradas)) {
      if (input.parentElement.hidden) { values[name] = undefined; continue; }
      const val = input.value.trim();
      try {
        values[name] =
          c.tipo === 'file'
            ? (input.preparado ?? input.files?.[0])
            : valorFormulario(c, input.value);
      } catch (err) {
        const falta = entradas[name].falta;
        falta.textContent = app.mensajeUsuario(err);
        falta.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        return null;
      }
      if (c.requerido && c.tipo !== 'file' && !val) throw Error(pedidoCampo(c) + '.');
    }

    return values;
  }
}
