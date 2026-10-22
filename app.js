import { registrarElementos } from './ui/elementos.js';
import { registrarFormularios } from './ui/formularios.js';
import { registrarRegistros } from './ui/registros.js';
import { registrarNavegacion } from './ui/navegacion.js';
import { registrarInicio } from './pantallas/inicio.js';
import { registrarCamiones } from './pantallas/camiones.js';
import { registrarCargas } from './pantallas/cargas.js';
import { registrarCobros } from './pantallas/cobros.js';
import { registrarMantenimiento } from './pantallas/mantenimiento.js';
import { registrarMas } from './pantallas/mas.js';
import { registrarPapeles } from './pantallas/papeles.js';
import { iniciarSesion } from './ui/sesion.js';

// Las pantallas comparten una única sesión, sin imports circulares.
const app = {};
registrarElementos(app);
registrarFormularios(app);
registrarRegistros(app);
registrarNavegacion(app);
registrarInicio(app);
registrarCamiones(app);
registrarCargas(app);
registrarCobros(app);
registrarMantenimiento(app);
registrarMas(app);
registrarPapeles(app);
await iniciarSesion(app);
