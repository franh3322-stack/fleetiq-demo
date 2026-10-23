import { detalleCobro } from '../ui/formato.js';

export function opcionesViajesCobro(viajes, clienteId) {
  return viajes
    .filter((v) => clienteId && v.clienteId === clienteId && v.estado === 'hecho' && !v.anulado)
    .map((v) => [v.id, v.origen + ' → ' + v.destino]);
}

import * as M from '../dominio/vencimientos.js';
import * as V from '../dominio/viajes-cobros.js';

import { moneda, cuentaCliente } from '../datos.js';
// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarCobros(app) {
  const opcionesReemplazo = cid => app.datos.cobros.filter(c=>c.clienteId===cid && c.empresaId===app.espacio && !c.anulado && V.estadoCheque(c)==='rechazado' && !app.datos.cobros.some(x=>!x.anulado && x.reemplazaCobroId===c.id)).map(c=>[c.id,detalleCobro(c)+' · '+M.formatoFecha(c.fecha)]);
  const palabras = c => c.anulado ? 'Anulado · carga sin efecto' : ({recibido:'Recibido · todavía no lo cobraste',depositado:'Depositado · esperando la plata',acreditado:'Cobrado · la plata ya está en tu cuenta',rechazado:'Rechazado · el cliente sigue debiendo '+moneda(Math.max(0,app.cuenta(app.datos.clientes.find(x=>x.id===c.clienteId)).saldoCentavos))})[V.estadoCheque(c)] ?? '';
  const opcionesRetencion = [['vigente','Sí'],['sin-efecto','No'],['por-confirmar','No sé, lo consulto']];
  function paso(c, titulo, fn, campos = [], texto = '') {
    const id=app.id(),target=app.abrirDialogo(titulo);
    if(texto)target.append(app.e('p',texto));
    app.formulario(target,[app.fecha(),...campos],titulo,v=>app.cambiar(d=>{
      const i=d.cobros.findIndex(x=>x.id===c.id),antes=d.cobros[i];
      const nuevo=fn(antes,v,id);
      if(JSON.stringify(nuevo)!==JSON.stringify(antes)){app.historial(d,'cobros',antes,titulo==='Ya lo deposité'?'Cheque depositado':v.motivo || titulo);d.cobros[i]=nuevo;}
    }));
  }
  const motivo = (obligatorio=true) => app.campo('motivo',obligatorio?'Motivo':'Motivo (opcional)','textarea',null,obligatorio);
  function cambiarEstado(c,estado,titulo){
    if(estado==='rechazado') {
      const cl=app.datos.clientes.find(x=>x.id===c.clienteId),s=app.cuenta(cl);
      const retencion=c.retencionCentavos ?? 0;
      const sin=s.saldoCentavos+(['sin-efecto','por-confirmar'].includes(c.estadoRetencion)?0:retencion),con=sin-retencion;
      paso(c,'Me lo rechazaron',(item,v,id)=>V.cambiarEstadoCheque(item,estado,v.fecha,{id,motivo:v.motivo,estadoRetencion:v.estadoRetencion}),[
        ...(c.retencionCentavos ? [app.campo('estadoRetencion','¿La retención de '+moneda(c.retencionCentavos)+' sigue valiendo?','select',opcionesRetencion)] : []),motivo(false),
      ],app.cliente(c.clienteId)+' vuelve a deber '+moneda(Math.max(0,con))+(c.retencionCentavos?' si la retención sigue vigente; '+moneda(Math.max(0,sin))+' si no vale o queda por confirmar.':'.')+' El cheque todavía no había descontado deuda.');
    } else paso(c,titulo,(item,v,id)=>V.cambiarEstadoCheque(item,estado,v.fecha,{id}));
  }
  function botonesCheque(c) {
    if(c.anulado || !V.esCheque(c))return [];
    const estado=V.estadoCheque(c), botones=[];
    for(const [destino,texto] of estado==='recibido' ? [['depositado','Ya lo deposité'],['acreditado','Lo cobré por ventanilla'],['rechazado','Me lo rechazaron']] : estado==='depositado' ? [['acreditado','Ya está la plata'],['rechazado','Me lo rechazaron']] : estado==='rechazado' ? [['depositado','Lo volví a depositar']] : [])botones.push(app.btn(texto,()=>cambiarEstado(c,destino,texto)));
    if(estado==='rechazado') {
      if(!c.resuelto)botones.push(app.btn('Ya lo resolví',()=>paso(c,'Ya lo resolví',(item,v,id)=>V.resolverCheque(item,v.fecha,v.motivo,id),[motivo()], 'Cierra el aviso y no mueve plata.')));
    }
    if(c.retencionCentavos && c.eventos?.some(e=>e.despues.estadoCheque==='rechazado'))botones.push(app.btn('Cambiar retención',()=>paso(c,'Cambiar retención',(item,v,id)=>V.cambiarRetencion(item,v.estadoRetencion,v.fecha,v.motivo,id),[app.campo('estadoRetencion','¿La retención sigue valiendo?','select',opcionesRetencion),motivo()])));
    if(c.eventos?.length>1)botones.push(app.btn('Deshacer último paso',()=>paso(c,'Deshacer último paso',(item,v,id)=>V.deshacerUltimoPaso(item,v.fecha,v.motivo,id),[motivo()])));
    if(c.revisarCheque || !c.eventos?.length)botones.push(app.btn('Ya revisé este cheque',()=>paso(c,'Ya revisé este cheque',(item,v,id)=>V.confirmarRevisionCheque(V.migrarCheque(item),v.fecha,id))));
    botones.push(app.btn('Ver pasos del cheque',()=>{const t=app.abrirDialogo('Pasos del cheque');for(const e of c.eventos ?? [])t.append(app.e('p',M.formatoFecha(e.fecha)+' · '+e.tipo+' · '+(e.despues.estadoCheque ?? '')+' · '+(e.despues.estadoRetencion ?? '')+' · '+(e.motivo ?? '')));}));
    return botones;
  }
  function editarCliente(r = null) {
    app.formulario(
      app.abrirDialogo(r ? 'Corregir cliente' : 'Agregar cliente'),
      [
        app.campo('nombre', 'Nombre'),
        app.campo('cuit', 'CUIT (opcional)', 'text', null, false),
        app.campo('plazoDias', 'Días para cobrar desde el viaje', 'number'),
        app.monto('saldoInicialCentavos', 'Deuda al empezar (0 si no debía)'),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar cliente',
      (v) =>
        app.cambiar((d) => {
          if (
            v.cuit &&
            d.clientes.some(
              (c) => c.id !== r?.id && c.cuit?.replace(/\D/g, '') === v.cuit.replace(/\D/g, ''),
            ) &&
            !confirm('Ya hay un cliente con ese CUIT. ¿Querés guardarlo igual?')
          )
            throw Error('Revisá el CUIT.');
          const c = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            nombre: v.nombre,
            cuit: v.cuit,
            plazoDias: v.plazoDias,
            saldoInicialCentavos: v.saldoInicialCentavos,
          };
          if (r) {
            app.historial(d, 'clientes', r, v.motivo);
            Object.assign(
              d.clientes.find((x) => x.id === r.id),
              c,
            );
          } else d.clientes.push(c);
        }),
      r ?? {
        plazoDias: 30,
        saldoInicialCentavos: 0,
      },
    );
  }
  function editarCobro(r = null, cid = null) {
    if(r?.anulado)throw Error('No se puede cambiar un cobro anulado.');
    if(r?.eventos?.length>1)throw Error('Este cheque tiene pasos guardados. Para corregir sus datos de carga, anulalo y registralo de nuevo. Los pasos se conservan.');
    const f = app.formulario(
      app.abrirDialogo(r ? 'Corregir cobro' : 'Registrar cobro parcial o anticipo'),
      [
        app.clientes(),
        app.fecha(),
        app.monto(),
        app.campo('medio', 'Cómo te pagó', 'select', [
          ['transferencia', 'Transferencia'],
          ['cheque', 'Cheque'],
          ['echeq', 'E-cheq'],
          ['efectivo', 'Efectivo'],
          ['otro', 'Otro'],
        ]),
        app.campo('cobrableDesde', 'Se puede cobrar desde (opcional)', 'date', null, false),
        app.campo('tieneRetencion', '¿Te hicieron retención?', 'select', [['si','Sí'],['no','No']]),
        app.campo('retencionCentavos', 'Monto de la retención', 'monto', null, false),
        app.campo('retencionTipo', 'Tipo de retención', 'select', [['iibb','Ingresos Brutos'],['otra','Otra']]),
        app.campo('archivo', 'Certificado de retención (opcional)', 'file', null, false),
        app.campo('reemplazaCobroId','Reemplaza un cheque rechazado (opcional)','select',opcionesReemplazo(r?.clienteId ?? cid),false),
        app.campo(
          'viajeId',
          'Asignar a un viaje (opcional)',
          'select',
          opcionesViajesCobro(app.datos.viajes, r?.clienteId ?? cid),
          false,
        ),
        ...(r ? [app.campo('motivo', 'Motivo de la corrección', 'textarea')] : []),
      ],
      'Guardar cobro',
      (v) =>
        app.cambiar(async (d) => {
          if (v.importeCentavos <= 0) throw Error('Escribí un monto mayor a cero.');
          let c = {
            id: r?.id ?? app.id(),
            empresaId: app.espacio,
            clienteId: v.clienteId,
            fecha: v.fecha,
            importeCentavos: v.importeCentavos,
            medio: v.medio,
            viajeId: v.viajeId || undefined,
            cobrableDesde: ['cheque','echeq'].includes(v.medio) ? v.cobrableDesde || undefined : undefined,
            retencionCentavos: v.tieneRetencion === 'si' ? v.retencionCentavos : undefined,
            retencionTipo: v.tieneRetencion === 'si' ? v.retencionTipo || undefined : undefined,
            archivoId: v.tieneRetencion === 'si' ? r?.archivoId : undefined,
            depositadoFecha: r?.depositadoFecha,
            reemplazaCobroId: v.reemplazaCobroId || undefined,
          };
          c=V.iniciarCheque(c);
          if(c.reemplazaCobroId && c.reemplazaCobroId!==r?.reemplazaCobroId)c=V.vincularReemplazo(c,d.cobros.find(x=>x.id===c.reemplazaCobroId));
          if (v.tieneRetencion === 'si' && !(c.retencionCentavos > 0)) throw Error('Escribí un monto de retención mayor a cero.');
          if (v.tieneRetencion === 'si') await app.ponerArchivo(d, v.archivo, c);
          const cl = d.clientes.find((x) => x.id === v.clienteId);
          const estado = cuentaCliente(
            {
              ...d,
              cobros: d.cobros.filter((x) => x.id !== r?.id),
            },
            cl,
            app.hoy(),
          );
          const revision = V.revisarCobro(c, estado);
          if (
            revision.requiereConfirmacion &&
            !confirm(
              moneda(revision.aFavorCentavos) + ' quedan a favor del cliente. ¿Lo confirmás?',
            )
          )
            throw Error('Revisá el monto antes de guardar.');
          if (r) {
            app.historial(d, 'cobros', r, v.motivo);
            Object.assign(
              d.cobros.find((x) => x.id === r.id),
              c,
            );
          } else d.cobros.push(c);
        }),
      { ...r, clienteId: r?.clienteId ?? cid ?? '', tieneRetencion: r?.retencionCentavos ? 'si' : 'no', retencionTipo: r?.retencionTipo ?? 'iibb' },
    );
    const actualizar = () => {
      const retiene = f.entradas.tieneRetencion.input.value === 'si';
      for (const n of ['retencionCentavos','retencionTipo','archivo']) f.entradas[n].input.parentElement.hidden = !retiene;
      f.entradas.cobrableDesde.input.parentElement.hidden = !['cheque','echeq'].includes(f.entradas.medio.input.value);
    };
    f.entradas.tieneRetencion.input.onchange = actualizar;
    f.entradas.medio.input.onchange = actualizar;
    actualizar();
    f.entradas.clienteId.input.onchange = () => {
      const reemplazo=f.entradas.reemplazaCobroId.input;
      reemplazo.replaceChildren(new Option('Sin reemplazo',''));
      for(const [id,texto] of opcionesReemplazo(f.entradas.clienteId.input.value))reemplazo.append(new Option(texto,id));
      reemplazo.value='';app.actualizarOpciones(f,'reemplazaCobroId');
      const input = f.entradas.viajeId.input;
      input.replaceChildren(new Option('Sin asignar a un viaje', ''));
      for (const [id, texto] of opcionesViajesCobro(app.datos.viajes, f.entradas.clienteId.input.value))
        input.append(new Option(texto, id));
      input.value = '';
      app.actualizarOpciones(f, 'viajeId');
    };
  }
  function cobros() {
    app.root.append(
      app.btn('Registrar cobro', () => app.editarCobro(), 'principal'),
      app.btn('Agregar cliente', () => app.editarCliente()),
    );
    app.root.append(
      app.e(
        'p',
        'La deuda se calcula con viajes hechos. Si elegís un viaje, el cobro se aplica primero a ese viaje; el resto, a los más viejos; los anticipos quedan a favor.',
        'ayuda',
      ),
    );
    for (const c of app.datos.clientes) {
      const s = app.cuenta(c);
      const tarjeta = app.filaRegistro(
        app.root,
        c.nombre,
        '',
        [
          app.btn('Registrar cobro', () => app.editarCobro(null, c.id)),
          app.btn('Corregir cliente', () => app.editarCliente(c)),
        ],
      );
      const resumen = tarjeta.querySelector('p');
      resumen.append(app.e('strong', 'Debe ' + moneda(Math.max(0, s.saldoCentavos))));
      for (const texto of [
        ...(s.chequesSinCobrarCentavos>0 ? ['Cheques sin cobrar '+moneda(s.chequesSinCobrarCentavos),'Falta que te entregue '+moneda(s.faltaEntregarCentavos)] : []),
        ...(app.datos.cobros.some(x=>x.clienteId===c.id && !x.anulado && x.estadoRetencion==='por-confirmar') ? ['Retención por confirmar'] : []),
        ...(s.vencidoCentavos > 0 ? ['Vencido ' + moneda(s.vencidoCentavos)] : []),
        ...(s.aFavorCentavos > 0 ? ['A favor ' + moneda(s.aFavorCentavos)] : []),
        'Plazo: ' + (c.plazoDias ?? 30) + ' días',
        ...(s.retenidoCentavos > 0 ? ['Retenciones: ' + moneda(s.retenidoCentavos)] : []),
      ]) resumen.append(app.e('br'), app.e('span', texto));
    }
    for(const [estado,titulo] of [['recibido','Cheques para depositar'],['depositado','Depositados · esperando la plata'],['rechazado','Rechazados']]) {
      const seccion=app.seccion(titulo);
      const lista=estado==='recibido' ? V.chequesEnCartera(app.datos.cobros) : app.datos.cobros.filter(c=>!c.anulado && V.estadoCheque(c)===estado);
      for(const c of lista)app.filaRegistro(seccion,app.cliente(c.clienteId)+' · '+detalleCobro(c),palabras(c)+' · '+(c.cobrableDesde?'Se puede cobrar desde '+M.formatoFecha(c.cobrableDesde):'Sin fecha de cobro')+(c.resuelto?' · Resuelto':'')+(app.datos.cobros.some(x=>!x.anulado && x.reemplazaCobroId===c.id)?' · Reemplazado':''),botonesCheque(c));
    }
    const h = app.seccion('Cobros cargados');
    for (const c of [...app.datos.cobros].reverse())
      app.filaRegistro(
        h,
        app.cliente(c.clienteId) + ' · ' + detalleCobro(c),
        M.formatoFecha(c.fecha) + ' · '+palabras(c)+(c.estadoRetencion?' · Retención '+c.estadoRetencion:'') + (c.anulado ? ' · Cobro anulado · ' + c.anulado.motivo : ''),
        [...(c.eventos?.length>1 && !c.anulado ? [app.btn('Anular',()=>app.anular('cobros',c),'peligro'),...app.verArchivo(c)] : app.acciones('cobros', c, app.editarCobro)),...botonesCheque(c)],
      );
  }
  app.editarCliente = editarCliente;
  app.editarCobro = editarCobro;
  app.cobros = cobros;
}
