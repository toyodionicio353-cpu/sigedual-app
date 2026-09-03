import type { PlantillaDocumento } from "@/types/plantillas";
import type { SegmentoDocumento } from "@/types";
import { estudianteTieneCentroDualAsignado } from "./resolverCampos";

/** Regla de elegibilidad por defecto para plantillas de Convenios: el estudiante debe tener un centro dual asignado. */
export const elegibilidadConvenio: PlantillaDocumento["elegibilidad"] = (ctx, estudiante) =>
  estudianteTieneCentroDualAsignado(estudiante.id, ctx);

function p(texto: string): SegmentoDocumento {
  return { tipo: "protegido", texto };
}
function c(clave: string): SegmentoDocumento {
  return { tipo: "campo", texto: "", clave };
}

const CONVENIO_APRENDIZAJE: PlantillaDocumento = {
  id: "convenio-aprendizaje",
  tipoModulo: "convenio",
  nombre: "Convenio de Aprendizaje",
  descripcion: "Convenio entre la empresa dual y el estudiante, según el formato oficial de SIGEDUAL.",
  previewLineas: [
    "CONVENIO DE APRENDIZAJE",
    "En (Comuna), con fecha (Fecha de convenio) entre la Empresa (Nombre de la empresa)…",
  ],
  requiereEstudiante: true,
  elegibilidad: elegibilidadConvenio,
  camposRequeridos: [
    "documento.fechaCreacion",
    "liceo.comuna",
    "liceo.nombre",
    "centro.nombre",
    "centro.contactoNombre",
    "centro.contactoCargo",
    "centro.domicilio",
    "centro.ciudad",
    "estudiante.nombreCompleto",
    "especialidad.nombre",
    "estudiante.run",
    "estudiante.fechaNacimiento",
    "estudiante.domicilio",
    "estudiante.ciudad",
    "estudiante.apoderadoNombre",
    "estudiante.apoderadoRun",
    "asignacion.fechaInicio",
    "asignacion.fechaTermino",
  ],
  parrafos: [
    [p("CONVENIO DE APRENDIZAJE")],
    [
      p("En "), c("liceo.comuna"), p(", con fecha "), c("documento.fechaCreacion"),
      p(" entre la Empresa "), c("centro.nombre"),
      p(" representada para estos efectos por don/ña "), c("centro.contactoNombre"),
      p(", en su calidad de "), c("centro.contactoCargo"),
      p(" con domicilio en "), c("centro.domicilio"),
      p(" de la ciudad de "), c("centro.ciudad"),
      p(" y el alumno(a) "), c("estudiante.nombreCompleto"),
      p(", estudiante de la especialidad de \""), c("especialidad.nombre"),
      p("\" del "), c("liceo.nombre"),
      p(", nacionalidad "), c("estudiante.nacionalidad"),
      p(", RUT "), c("estudiante.run"),
      p(", nacido el "), c("estudiante.fechaNacimiento"),
      p(", con domicilio en "), c("estudiante.domicilio"),
      p(" de la ciudad de "), c("estudiante.ciudad"),
      p(", siendo su representante legal don/ña "), c("estudiante.apoderadoNombre"),
      p(" RUN "), c("estudiante.apoderadoRun"),
      p(" con domicilio en "), c("estudiante.apoderadoDomicilio"),
      p(", ciudad de "), c("estudiante.apoderadoCiudad"),
      p(", se ha convenido lo siguiente:"),
    ],
    [
      p("PRIMERO : La Empresa "), c("centro.nombre"),
      p(" a petición del Liceo \""), c("liceo.nombre"),
      p("\", acepta como Aprendiz Dual al(a) alumno(a) "), c("estudiante.nombreCompleto"),
      p(" durante el tiempo y condiciones que más adelante se señalan, a fin de dar cumplimiento al requisito curricular de formación profesional según Plan de Aprendizaje."),
    ],
    [
      p("SEGUNDO : El alumno (a) se sujetará y deberá cumplir con las instrucciones y reglamento internos de la Empresa."),
    ],
    [
      p("TERCERO : El alumno (a) desarrollará su práctica educacional durante el siguiente periodo: desde el "),
      c("asignacion.fechaInicio"), p(" hasta el "), c("asignacion.fechaTermino"), p("."),
    ],
    [
      p("CUARTO : Se conviene, que la Empresa, podrá poner término a este convenio si el estudiante no se comporta satisfactoriamente, en especial en cuanto a puntualidad, asistencia y sujeción a las normas internas, de lo cual se informará al Liceo."),
    ],
    [
      p("QUINTO : Los accidentes que puedan ocurrir al estudiante durante su práctica o con ocasión de ésta, serán cubiertos por el Seguro Establecido en el artículo 3° de la Ley 16.744 sobre Accidentes del Trabajo y Enfermedades Profesionales, reglamentadas por el Decreto N° 313 de la Subsecretaría de Previsión Social del Trabajo, publicada en el Diario Oficial el "),
      c("documento.fechaPublicacionDecreto"), p("."),
    ],
  ],
};

/**
 * Plantillas de Convenios. La primera plantilla real (Convenio de
 * Aprendizaje) fue entregada por el usuario; nuevas plantillas se agregan
 * acá como entradas nuevas, sin tocar el resto del sistema.
 */
export const PLANTILLAS_CONVENIOS: PlantillaDocumento[] = [CONVENIO_APRENDIZAJE];
