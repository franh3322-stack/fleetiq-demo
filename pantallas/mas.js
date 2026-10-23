import { exportar, importar } from '../datos.js';
import { paraRespaldo } from '../almacen.js';
// Comparte el estado de la sesión; las acciones se resuelven al usarlas.
export function registrarMas(app) {
  function mas() {
    const n = app.seccion('Espacio de trabajo');
    if (app.soloDemostracion)
      n.append(app.e('p', 'Esta es la demostración pública: solo tiene datos ficticios para practicar.', 'ayuda'));
    else n.append(app.selectorEspacio);
    const links = app.seccion('Ver y administrar');
    links.classList.add('menu');
    for (const p of ['Viajes', 'Choferes', 'Papeles', 'Mantenimiento', 'Ajustes', 'Soporte', 'Ayuda'])
      links.append(app.btn(p, () => app.cambiarPagina(p)));
    const ayuda = app.seccion('Instalar en el celular');
    ayuda.append(
      app.e(
        'p',
        'Abrí FleetIQ con conexión e instalala en la pantalla de inicio. Después abrila una vez y esperá el aviso de que está lista sin señal.',
      ),
    );
    ayuda.append(
      app.e('h3', 'Android'),
      app.e(
        'p',
        'En Chrome, abrí el menú ⋮, tocá “Agregar a pantalla principal” o “Instalar app” y confirmá.',
      ),
    );
    ayuda.append(
      app.e('h3', 'iPhone'),
      app.e(
        'p',
        'En Safari, tocá Compartir, elegí “Agregar a inicio” y tocá “Agregar”. Después abrí FleetIQ desde ese ícono.',
      ),
    );
    ayuda.append(
      app.e(
        'p',
        'Los datos quedan en este equipo. Exportá respaldos desde Ajustes. Para instalar desde un celular hace falta una dirección HTTPS; la dirección local de esta computadora no alcanza.',
        'ayuda',
      ),
    );
    const estado = app.e('p', app.estadoPwa, 'ayuda');
    estado.id = 'estado-pwa';
    ayuda.append(estado);
  }
  function ajustes() {
    app.root.append(
      app.e(
        'p',
        'Los datos quedan en este navegador. Exportá una copia para conservarlos si cambiás de equipo o se borra el navegador.',
        'aviso',
      ),
    );
    app.formulario(
      app.root,
      [
        app.campo(
          'anticipacionDias',
          'Avisar papeles y services con cuántos días de anticipación',
          'number',
        ),
        app.campo('anticipacionKm', 'Avisar service con cuántos km de anticipación', 'number'),
        app.campo(
          'maxDiasLectura',
          'Considerar vieja una lectura después de cuántos días',
          'number',
        ),
        app.campo('kmPorDiaMax', 'Revisar saltos mayores a cuántos km por día', 'number'),
        app.campo('diasAcreditacion', 'Preguntar por cheques depositados después de cuántos días', 'number'),
        app.campo('criterio', 'Cuándo contar el ingreso en el resultado', 'select', [
          ['viaje', 'Por fecha del viaje hecho (supuesto inicial)'],
          ['cobro', 'Cuando entra la plata (cheques al acreditarse)'],
        ]),
      ],
      'Guardar ajustes',
      (v) =>
        app.cambiar((d) => {
          d.config = {
            ...d.config,
            ...v,
          };
          for (const p of d.planes) {
            delete p.anticipacionDias;
            delete p.anticipacionKm;
          }
        }),
      {diasAcreditacion:3,...app.datos.config},
    );
    const respaldo = app.seccion('Respaldo');
    respaldo.append(
      app.btn(
        'Exportar respaldo',
        app.ejecutar(async () => {
          const blob = new Blob([exportar(await paraRespaldo(app.datos))], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = app.e('a');
          a.href = url;
          a.download = 'FleetIQ-' + app.espacio + '-' + app.hoy() + '.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }),
      ),
    );
    respaldo.append(
      app.e(
        'p',
        'La copia incluye archivos e historial. Importar reemplaza este espacio; el otro queda separado.',
        'ayuda',
      ),
    );
    app.formulario(
      respaldo,
      [app.campo('respaldo', 'Archivo de respaldo', 'file')],
      'Revisar respaldo para importar',
      async (v) => {
        if (!v.respaldo) throw Error('Elegí el archivo de respaldo.');
        const nuevo = importar(await v.respaldo.text(), app.espacio);
        const t = app.abrirDialogo('Confirmar restauración');
        t.append(
          app.e(
            'p',
            `Este respaldo tiene ${nuevo.camiones.length} camiones, ${nuevo.viajes.length} viajes y ${nuevo.archivos.length} archivos. Reemplaza los datos de ${app.espacio === 'demo' ? 'Demostración' : 'Mi empresa'}. Exportá antes una copia si querés conservar lo actual.`,
          ),
          app.btn(
            'Confirmar importación',
            app.ejecutar(async () => {
              await app.cambiar((d) => {
                for (const k of Object.keys(d)) delete d[k];
                Object.assign(d, nuevo);
              });
              app.dialog.close();
              app.pintar();
            }),
            'principal',
          ),
        );
        return false;
      },
    );
    respaldo.querySelector('input[type=file]').accept = '.json,application/json';
  }
  function soporte() {
    app.root.append(
      app.e(
        'p',
        'Contacto y horario de soporte: pendientes de definir con Francisco. Si perdés el celular, recuperá el último respaldo en otro equipo desde Ajustes. Lo que estaba solo en el equipo perdido no se puede recuperar.',
      ),
    );
    app.root.append(
      app.btn('Ver registro técnico', () =>
        app
          .abrirDialogo('Registro técnico')
          .append(app.e('pre', JSON.stringify(app.datos.soporte, null, 2))),
      ),
      app.btn('Ver historial de correcciones', () => {
        const t = app.abrirDialogo('Historial de correcciones');
        if (!app.datos.historial.length) t.append(app.e('p', 'Todavía no hay correcciones.'));
        for (const h of app.datos.historial)
          t.append(
            app.e('p', h.fecha + ' · ' + h.tipo + ' · ' + h.motivo),
            app.e('pre', JSON.stringify(h.antes, null, 2)),
          );
      }),
    );
  }
  function ayuda() {
    app.root.append(
      app.e('p', 'Practicá en Demostración: los ejemplos están separados de Mi empresa.'),
    );
    for (const [titulo, texto] of [
      [
        '1. Registrar un gasto',
        'Entrá en Cargar → Gasto. Elegí el camión y qué gasto es, escribí el monto y revisá la fecha. Podés agregar una foto. Tocá Guardar gasto.',
      ],
      [
        '2. Cargar un viaje hecho',
        'Entrá en Cargar → Viaje. Elegí cliente y camión, escribí origen, destino y tarifa y revisá la fecha. Guardá. En Más → Viajes, buscá ese viaje y tocá Marcar hecho.',
      ],
      [
        '3. Ver el resultado de un camión',
        'Entrá en Inicio y elegí el mes con las flechas. Buscá el camión: vas a ver sus ingresos, gastos y resultado según lo cargado. No incluye todos los costos contables.',
      ],
    ])
      app.seccion(titulo).append(app.e('p', texto));
    app.root.append(
      app.e(
        'p',
        'Si tocás Volver con cambios sin guardar, elegí Seguir cargando para conservarlos. Para corregir una carga guardada, usá Corregir o Anular e indicá el motivo. Exportá tu respaldo desde Ajustes.',
      ),
    );
  }
  app.mas = mas;
  app.ajustes = ajustes;
  app.soporte = soporte;
  app.ayuda = ayuda;
}
