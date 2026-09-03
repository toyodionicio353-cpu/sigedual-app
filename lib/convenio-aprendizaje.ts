import type { CentroDual, ConvenioParrafo, ConvenioSegmento, Especialidad, Estudiante, Liceo } from "@/types";

export const PLANTILLA_ID = "convenio-aprendizaje";
export const PLANTILLA_NOMBRE = "Convenio de Aprendizaje";

// Etiqueta legible -> clave interna del token. El texto de la plantilla se
// escribe tal cual con las etiquetas entre corchetes (ej. "[Nombre Empresa]")
// y se parsea automáticamente a segmentos de texto/token — así el texto
// literal del convenio queda como única fuente de verdad, sin transcribirlo
// dos veces.
const ETIQUETA_A_CLAVE: Record<string, string> = {
  "Comuna Enlace": "comunaEnlace",
  "Fecha Convenio": "fechaConvenio",
  "Nombre Empresa": "nombreEmpresa",
  "Nombre Representante Empresa": "nombreRepresentanteEmpresa",
  "Cargo Representante": "cargoRepresentante",
  "Domicilio Empresa": "domicilioEmpresa",
  "Ciudad Empresa": "ciudadEmpresa",
  "Nombre Estudiante": "nombreEstudiante",
  "Especialidad": "especialidad",
  "Nombre Liceo": "nombreLiceo",
  "Nacionalidad Estudiante": "nacionalidadEstudiante",
  "RUT Estudiante": "rutEstudiante",
  "Fecha Nacimiento Estudiante": "fechaNacimientoEstudiante",
  "Domicilio Estudiante": "domicilioEstudiante",
  "Ciudad Estudiante": "ciudadEstudiante",
  "Nombre Rep Legal": "nombreRepLegal",
  "RUN Rep Legal": "runRepLegal",
  "Domicilio Rep Legal": "domicilioRepLegal",
  "Ciudad Rep Legal": "ciudadRepLegal",
  "Fecha Inicio Práctica": "fechaInicioPractica",
  "Fecha Término Práctica": "fechaTerminoPractica",
  "RUT Director Liceo": "rutDirectorLiceo",
  "RUT Empresa": "rutEmpresa",
};

export const CLAVE_A_ETIQUETA: Record<string, string> = Object.fromEntries(
  Object.entries(ETIQUETA_A_CLAVE).map(([etiqueta, clave]) => [clave, etiqueta])
);

function parsearParrafo(id: string, texto: string, esTitulo = false): ConvenioParrafo {
  const segmentos: ConvenioSegmento[] = [];
  const partes = texto.split(/\[([^\]]+)\]/g);
  partes.forEach((parte, i) => {
    if (i % 2 === 0) {
      if (parte) segmentos.push({ tipo: "texto", valor: parte });
    } else {
      const clave = ETIQUETA_A_CLAVE[parte];
      segmentos.push({ tipo: "token", valor: clave ?? parte });
    }
  });
  return { id, esTitulo, segmentos };
}

export function plantillaConvenioAprendizaje(): ConvenioParrafo[] {
  return [
    parsearParrafo("titulo", "CONVENIO DE APRENDIZAJE", true),
    parsearParrafo(
      "intro",
      'En [Comuna Enlace], con fecha [Fecha Convenio] entre la Empresa [Nombre Empresa] representada para estos efectos por don(ña) [Nombre Representante Empresa], en su calidad de [Cargo Representante] con domicilio en [Domicilio Empresa] de la ciudad de [Ciudad Empresa] y el alumno(a) [Nombre Estudiante], estudiante de la especialidad de "[Especialidad]" del [Nombre Liceo], nacionalidad [Nacionalidad Estudiante], RUT [RUT Estudiante], nacido el [Fecha Nacimiento Estudiante], con domicilio en [Domicilio Estudiante] de la ciudad de [Ciudad Estudiante], siendo su representante legal don(ña) [Nombre Rep Legal] RUN [RUN Rep Legal] con domicilio en [Domicilio Rep Legal], ciudad de [Ciudad Rep Legal], se ha convenido lo siguiente:'
    ),
    parsearParrafo(
      "primero",
      "PRIMERO : La Empresa [Nombre Empresa] a petición del [Nombre Liceo], acepta como Aprendiz Dual al(a) alumno(a) [Nombre Estudiante] durante el tiempo y condiciones que más adelante se señalan, a fin de dar cumplimiento al requisito curricular de formación profesional según Plan de Aprendizaje."
    ),
    parsearParrafo(
      "segundo",
      "SEGUNDO : El alumno (a) se sujetará y deberá cumplir con las instrucciones y reglamento internos de la Empresa."
    ),
    parsearParrafo(
      "tercero",
      "TERCERO : El alumno (a) desarrollará su práctica educacional durante el siguiente periodo: desde el [Fecha Inicio Práctica] hasta el [Fecha Término Práctica]."
    ),
    parsearParrafo(
      "cuarto",
      "CUARTO : Se conviene, que la Empresa, podrá poner término a este convenio si el estudiante no se comporta satisfactoriamente, en especial en cuanto a puntualidad, asistencia y sujeción a las normas internas, de lo cual se informará al Liceo."
    ),
    parsearParrafo(
      "quinto",
      "QUINTO : Los accidentes que puedan ocurrir al estudiante durante su práctica o con ocasión de ésta, serán cubiertos por el Seguro Establecido en el artículo 3° de la Ley 16.744 sobre Accidentes del Trabajo y Enfermedades Profesionales, reglamentadas por el Decreto N° 313 de la Subsecretaría de Previsión Social del Trabajo, publicada en el Diario Oficial el 12 de Mayo de 1973."
    ),
  ];
}

export interface FirmaColumna {
  titulo: string;
  claveRut: string;
}

export const FIRMAS_CONVENIO: FirmaColumna[] = [
  { titulo: "Director Liceo", claveRut: "rutDirectorLiceo" },
  { titulo: "Representante Empresa", claveRut: "rutEmpresa" },
  { titulo: "Representante Legal del Alumno(a)", claveRut: "runRepLegal" },
  { titulo: "Alumno(a)", claveRut: "rutEstudiante" },
];

export function valoresDesdeEstudiante(e: Estudiante, especialidades: Especialidad[]): Record<string, string> {
  return {
    nombreEstudiante: `${e.nombres} ${e.apellidos}`.trim(),
    especialidad: especialidades.find((esp) => esp.id === e.especialidadId)?.nombre ?? "",
    nacionalidadEstudiante: e.nacionalidad ?? "",
    rutEstudiante: e.run ?? "",
    fechaNacimientoEstudiante: e.fechaNacimiento ?? "",
    domicilioEstudiante: e.direccion ?? "",
    ciudadEstudiante: e.ciudad || e.comuna || "",
    nombreRepLegal: e.apoderadoNombre ?? "",
    runRepLegal: e.apoderadoRun ?? "",
    domicilioRepLegal: e.apoderadoDomicilio ?? "",
    ciudadRepLegal: e.apoderadoCiudad ?? "",
  };
}

export function valoresDesdeCentro(c: CentroDual): Record<string, string> {
  return {
    nombreEmpresa: c.nombre ?? "",
    nombreRepresentanteEmpresa: c.contactoNombre ?? "",
    cargoRepresentante: c.contactoCargo ?? "",
    domicilioEmpresa: c.direccion ?? "",
    ciudadEmpresa: c.ciudad || c.comuna || "",
    rutEmpresa: c.rut ?? "",
  };
}

export function valoresDesdeLiceo(l: Liceo): Record<string, string> {
  return {
    nombreLiceo: l.nombre ?? "",
    comunaEnlace: l.comuna ?? "",
    rutDirectorLiceo: l.directorRut ?? "",
  };
}
