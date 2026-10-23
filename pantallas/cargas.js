import * as V from '../dominio/viajes-cobros.js';

import { moneda, tarifaTonelada, sincronizarLecturaGasto, coincidenciaChofer, validarChofer } from '../datos.js';
import { valorFormulario } from '../ui/validacion.js';

// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarCargas(app) {
  function cargarMenu() {
    const n = app.seccion('¿Qué querés cargar?');
    n.classList.add('menu');
    for (const [texto, accion] of [
      [
        'Gasto',
        () => {
          app.cambiarPagina('Registrar gasto');
          app.gasto();
        },
      ],
      ['Viaje', () => app.editarViaje()],
      ['Cobro', () => app.editarCobro()],
      ['Papel', () => app.editarPapel()],
      ['Service', () => app.nuevoService()],
    ])
      n.append(app.btn(texto, accion));
  }
  function gasto(r = null, target = app.abrirDialogo(r ? 'Corregir gasto' : 'Registrar gasto')) {
    if (target === app.root && !app.datos.camiones.length)
      app.root.append(
        app.aviso('Podés cargar un gasto general o agregar un camión desde Camiones.'),
      );
    const cats = [
      ['combustible', 'Combustible'],
      ['peaje', 'Peaje'],
      ['reparacion', 'Reparación'],
      ['mantenimiento', 'Mantenimiento'],
      ['cubiertas', 'Cubiertas'],
      ['otro', 'Otro'],
    ];
    const f = app.formulario(
      target,
      [
        app.camion(true),
        app.campo('categoria', '¿Qué gasto es?', 'select', cats),
        app.monto(),
        {...app.campo('litrosCentesimas','Litros (opcional)','text',null,false),decimales:2},
        app.campo('km','Km del odómetro (opcional)','number',null,false),
        app.fecha(),
        app.campo(
          'viajeId',
          'Viaje (opcional)',
          'select',
          app.datos.viajes
            .filter((v) => v.estado !== 'cancelado')
            .map((v) => [v.id, `${v.origen} → ${v.destino} · ${app.nombreCamion(v.camionId)}`]),
          false,
        ),
        app.archivo(),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      r ? 'Guardar corrección' : 'Guardar gasto',
      async (v) =>
        app.cambiar(async (d) => {
          if (v.importeCentavos <= 0) throw Error('Escribí un monto mayor a cero.');
          const g = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            camionId: v.camionId === 'general' ? null : v.camionId,
            tipo: 'gasto',
            categoria: v.categoria,
            litrosCentesimas: v.categoria==='combustible' ? v.litrosCentesimas : undefined,
            km: v.categoria==='combustible' ? v.km : undefined,
            fecha: v.fecha,
            importeCentavos: v.importeCentavos,
            viajeId: v.viajeId || undefined,
            archivoId: r?.archivoId,
          };
          if (v.viajeId && d.viajes.find((x) => x.id === v.viajeId).camionId !== g.camionId)
            throw Error('El viaje es de otro camión. Revisá la elección.');
          sincronizarLecturaGasto(d,g);
          await app.ponerArchivo(d, v.archivo, g);
          if (r) {
            app.historial(d, 'gastos', r, v.motivo);
            Object.assign(
              d.gastos.find((x) => x.id === r.id),
              g,
            );
          } else d.gastos.push(g);
        }),
      r
        ? {
            ...r,
            camionId: r.camionId ?? 'general',
          }
        : {},
    );
    app.opcionesGrandes(
      f,
      'camionId',
      Array.from(f.entradas.camionId.input.options)
        .filter((o) => o.value)
        .map((o) => [o.value, o.text]),
    );
    app.opcionesGrandes(f, 'categoria', cats);
    const combustible=()=>{for(const n of ['litrosCentesimas','km']) f.entradas[n].input.parentElement.hidden=f.entradas.categoria.input.value!=='combustible';};
    f.entradas.categoria.input.onchange=combustible; combustible();
  }
  function gastos() {
    app.root.append(app.btn('Registrar gasto', () => app.gasto(), 'principal'));
    const h = app.seccion('Gastos cargados');
    for (const g of [...app.datos.gastos].reverse())
      app.filaRegistro(
        h,
        app.nombreCamion(g.camionId) + ' · ' + moneda(g.importeCentavos),
        g.fecha +
          ' · ' +
          {
            reparacion: 'Reparación',
            combustible: 'Combustible',
            peaje: 'Peaje',
            mantenimiento: 'Mantenimiento',
            cubiertas: 'Cubiertas',
            otro: 'Otro',
          }[g.categoria] +
          (g.anulado ? ' · Carga anulada · ' + g.anulado.motivo : ''),
        app.acciones('gastos', g, (r) => app.gasto(r, app.abrirDialogo('Corregir gasto'))),
      );
  }
  function editarViaje(r = null) {
    const campos = [
      app.clientes(),
      app.camion(),
      app.fecha(),
      app.campo(
        'fechaBaseCobro',
        'Fecha base para el plazo de cobro (opcional; si falta se usa la del viaje)',
        'date',
        null,
        false,
      ),
      app.campo('origen', 'Origen'),
      app.campo('destino', 'Destino'),
      app.choferCampo(r?.choferId),
      ...(r?.chofer ? [app.campo('chofer','Chofer anterior (texto)','text',null,false)] : []),
      app.campo('modalidadTarifa','Cómo se cobra','select',[['cerrado','Precio cerrado'],['tonelada','Por tonelada']]),
      {...app.campo('precioToneladaMilesimas','$ por tonelada'),decimales:3},
      {...app.campo('toneladasMilesimas','Toneladas'),decimales:3},
      app.monto('tarifaCentavos', 'Tarifa acordada'),
      app.campo('kmRecorridos', 'Kilómetros del viaje (opcional)', 'number', null, false),
      app.campo('numeroPapel', 'Número de carta de porte (opcional)', 'text', null, false),
      app.archivo(),
      ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
    ];
    const f = app.formulario(
      app.abrirDialogo(r ? 'Corregir viaje' : 'Nuevo viaje'),
      campos,
      'Guardar viaje',
      (v) =>
        app.cambiar(async (d) => {
          if(v.modalidadTarifa==='tonelada') v.tarifaCentavos=tarifaTonelada(v.precioToneladaMilesimas,v.toneladasMilesimas);
          let viaje = {
            ...r,
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            clienteId: v.clienteId,
            camionId: v.camionId,
            fecha: v.fecha,
            fechaBaseCobro: v.fechaBaseCobro || undefined,
            origen: v.origen,
            destino: v.destino,
            chofer: v.choferId ? undefined : v.chofer,
            choferId: v.choferId || undefined,
            modalidadTarifa: v.modalidadTarifa,
            precioToneladaMilesimas: v.modalidadTarifa==='tonelada' ? v.precioToneladaMilesimas : undefined,
            toneladasMilesimas: v.modalidadTarifa==='tonelada' ? v.toneladasMilesimas : undefined,
            tarifaCentavos: v.tarifaCentavos,
            kmRecorridos: v.kmRecorridos,
            numeroPapel: v.numeroPapel,
            estado: r?.estado ?? 'planificado',
            historialTarifa: r?.historialTarifa ?? [],
          };
          if (r) {
            app.historial(d, 'viajes', r, v.motivo);
            if (r.tarifaCentavos !== v.tarifaCentavos || r.precioToneladaMilesimas !== viaje.precioToneladaMilesimas || r.toneladasMilesimas !== viaje.toneladasMilesimas || (r.modalidadTarifa ?? 'cerrado') !== viaje.modalidadTarifa)
              viaje = {
                ...viaje,
                ...V.cambiarTarifa(
                  {
                    ...viaje,
                    tarifaCentavos: r.tarifaCentavos,
                  },
                  v.tarifaCentavos,
                  app.hoy(),
                  v.motivo,
                ),
              };
          }
          await app.ponerArchivo(d, v.archivo, viaje);
          if (r)
            Object.assign(
              d.viajes.find((x) => x.id === r.id),
              viaje,
            );
          else d.viajes.push(viaje);
        }),
      {modalidadTarifa:'cerrado',...r},
    );
    const modalidad=()=>{const por=f.entradas.modalidadTarifa.input.value==='tonelada'; f.entradas.tarifaCentavos.input.parentElement.hidden=por; f.entradas.tarifaCentavos.c.requerido=!por; for(const n of ['precioToneladaMilesimas','toneladasMilesimas']){f.entradas[n].input.parentElement.hidden=!por; f.entradas[n].c.requerido=por;}};
    // Antes de guardar se ve la cuenta que va a quedar: $/t × toneladas = tarifa.
    const ecoTonelada=app.e('p','','eco');ecoTonelada.setAttribute('aria-live','polite');
    f.entradas.toneladasMilesimas.input.parentElement.append(ecoTonelada);
    const verTonelada=()=>{
      const [pr,t]=['precioToneladaMilesimas','toneladasMilesimas'].map(n=>f.entradas[n]);
      if(f.entradas.modalidadTarifa.input.value!=='tonelada' || !pr.input.value || !t.input.value){ecoTonelada.textContent='';return;}
      try{
        const v={modalidadTarifa:'tonelada',precioToneladaMilesimas:valorFormulario(pr.c,pr.input.value),toneladasMilesimas:valorFormulario(t.c,t.input.value)};
        ecoTonelada.textContent=app.textoTarifa({...v,tarifaCentavos:tarifaTonelada(v.precioToneladaMilesimas,v.toneladasMilesimas)});
      }catch{ecoTonelada.textContent='Revisá el precio por tonelada o las toneladas.';}
    };
    for(const n of ['precioToneladaMilesimas','toneladasMilesimas'])f.entradas[n].input.oninput=verTonelada;
    f.entradas.modalidadTarifa.input.onchange=()=>{modalidad();verTonelada();};modalidad();verTonelada();
    const coincide=r?.chofer && coincidenciaChofer(r.chofer,app.datos.choferes ?? []);
    if(coincide && !r.choferId) f.form.append(app.btn('Elegir a '+coincide.nombre+' de la lista',()=>{f.entradas.choferId.input.value=coincide.id;app.actualizarOpciones(f,'choferId');app.borrador=true;}));
  }
  function viajes() {
    app.root.append(
      app.btn('Nuevo viaje', () => app.editarViaje(), 'principal'),
      app.btn('Agregar cliente', () => app.editarCliente()),
    );
    if (!app.datos.clientes.length || !app.datos.camiones.length)
      app.root.append(app.aviso('Primero agregá un cliente y un camión.'));
    for (const v of [...app.datos.viajes].reverse()) {
      const a = app.acciones('viajes', v, app.editarViaje);
      if (v.estado === 'planificado')
        a.unshift(
          app.btn(
            'Marcar hecho',
            app.ejecutar(async () => {
              await app.cambiar((d) => {
                d.viajes.find((x) => x.id === v.id).estado = 'hecho';
              });
              app.pintar();
            }),
          ),
        );
      if (v.estado !== 'cancelado')
        a.push(
          app.btn('Constancia de entrega', () =>
            app.formulario(
              app.abrirDialogo('Guardar entrega'),
              [app.archivo(), app.campo('nota', 'Detalle de la entrega', 'textarea')],
              'Guardar entrega',
              (x) =>
                app.cambiar(async (d) => {
                  const item = d.viajes.find((r) => r.id === v.id);
                  app.historial(d, 'viajes', item, x.nota);
                  item.entrega = x.nota;
                  const entrega = {};
                  await app.ponerArchivo(d, x.archivo, entrega);
                  if (entrega.archivoId) item.entregaArchivoId = entrega.archivoId;
                }),
            ),
          ),
          app.btn('Ver resultado del viaje', () => {
            const movimientosViaje = app.datos.gastos.filter(
              (g) => app.activo(g) && g.viajeId === v.id,
            );
            const gastos = movimientosViaje.reduce((s, g) => s + g.importeCentavos, 0);
            app
              .abrirDialogo('Resultado del viaje')
              .append(
                app.e('p', 'Ingreso ' + moneda(v.estado === 'hecho' ? v.tarifaCentavos : 0)),
                app.e('p', 'Gastos asignados ' + moneda(gastos)),
                app.e(
                  'p',
                  moneda((v.estado === 'hecho' ? v.tarifaCentavos : 0) - gastos),
                  'numero',
                ),
                app.e(
                  'p',
                  'Solo incluye los gastos asignados a este viaje. No incluye todos los costos contables.',
                ),
              );
          }),
        );
      app.filaRegistro(
        app.root,
        app.nombreCamion(v.camionId) + ' · ' + v.origen + ' → ' + v.destino,
        app.cliente(v.clienteId) +
          ' · ' +
          v.fecha +
          ' · ' +
          app.textoTarifa(v) +
          (v.choferId || v.chofer ? ' · '+app.nombreChofer(v) : '') +
          ' · ' +
          {
            hecho: 'Viaje hecho',
            planificado: 'Viaje por hacer',
            cancelado: 'Viaje cancelado · ' + v.cancelacion?.motivo,
          }[v.estado],
        a,
      );
    }
  }
  app.choferCampo = (actual) => app.campo('choferId','Chofer (opcional)','select',(app.datos.choferes ?? []).filter(c=>c.activo!==false || c.id===actual).map(c=>[c.id,c.nombre+(c.activo===false?' · Inactivo':'')]),false);
  app.nombreChofer = v => (app.datos.choferes ?? []).find(c=>c.id===v.choferId)?.nombre ?? v.chofer ?? '';
  app.textoTarifa = v => v.modalidadTarifa==='tonelada' ? new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:3}).format(v.precioToneladaMilesimas/1000).replace(/\s/g,' ')+'/t × '+(v.toneladasMilesimas/1000).toLocaleString('es-AR',{minimumFractionDigits:3,maximumFractionDigits:3})+' t = '+moneda(v.tarifaCentavos,v.tarifaCentavos%100!==0) : moneda(v.tarifaCentavos);
  app.editarChofer = (r=null, padre=null) => {
    const target=padre ? app.e('section',undefined,'tarjeta') : app.abrirDialogo(r?'Corregir chofer':'Nuevo chofer');
    if(padre) padre.form.parentElement.append(target);
    app.formulario(target,[app.campo('nombre','Nombre'),app.campo('telefono','Teléfono (opcional)','text',null,false),...(r?[app.campo('motivo','Motivo','textarea')]:[])],'Guardar chofer',async v=>{
      const nuevo={id:r?.id ?? app.id(),empresaId:app.espacio,nombre:v.nombre,telefono:v.telefono,activo:r?.activo ?? true};
      const ok=await app.cambiar(d=>{d.choferes ??=[];validarChofer(nuevo,d.choferes);if(r){app.historial(d,'choferes',r,v.motivo);Object.assign(d.choferes.find(c=>c.id===r.id),nuevo);}else d.choferes.push(nuevo);});
      if(!ok)return false;
      if(padre){const i=padre.entradas.choferId.input;i.append(new Option(nuevo.nombre,nuevo.id));i.value=nuevo.id;app.actualizarOpciones(padre,'choferId');app.borrador=true;target.remove();return false;}
    },r ?? {});
  };
  app.choferes = () => {
    app.root.append(app.btn('Nuevo chofer',()=>app.editarChofer(), 'principal'));
    for(const c of app.datos.choferes ?? []) {
      const n=app.filaRegistro(app.root,c.nombre,(c.activo===false?'Inactivo':'Activo')+(c.telefono?' · '+c.telefono:''),[app.btn('Corregir',()=>app.editarChofer(c)),app.btn(c.activo===false?'Activar':'Dejar inactivo',()=>app.formulario(app.abrirDialogo('Cambiar disponibilidad'),[app.campo('motivo','Motivo','textarea')],'Guardar cambio',v=>app.cambiar(d=>{const x=d.choferes.find(x=>x.id===c.id);app.historial(d,'choferes',x,v.motivo);x.activo=x.activo===false;})))]);
      const licencias=app.datos.papeles.filter(p=>p.choferId===c.id && p.tipo==='Licencia' && !p.anulado && !app.datos.papeles.some(x=>x.id===p.reemplazadoPor && !x.anulado));
      n.append(app.e('h3','Licencia'));
      if(!licencias.length)n.append(app.e('p','Todavía no hay una licencia cargada.'));
      for(const p of licencias)n.append(app.e('p',p.vence ? 'Vence '+p.vence.split('-').reverse().join('/') : 'Sin vencimiento'),...app.accionesPapel(p));
      n.append(app.e('h3','Viajes'));
      const viajes=app.datos.viajes.filter(v=>v.choferId===c.id);
      if(!viajes.length)n.append(app.e('p','Todavía no tiene viajes elegidos de la lista.'));
      for(const v of viajes)n.append(app.e('p',v.fecha.split('-').reverse().join('/')+' · '+v.origen+' · '+v.destino+' · '+app.textoTarifa(v)));
    }
  };
  app.cargarMenu = cargarMenu;
  app.gasto = gasto;
  app.gastos = gastos;
  app.editarViaje = editarViaje;
  app.viajes = viajes;
}
