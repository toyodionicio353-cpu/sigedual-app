// Vocabularios compartidos para el sistema de compatibilidad estudiante ↔ centro dual.
// RASGOS_ESTUDIANTE se mantiene con los mismos valores que ya existían en
// EstudianteForm.tsx para no romper datos ya guardados en Firestore.

export const RASGOS_ESTUDIANTE = [
  "Tranquilo/a", "Nervioso/a", "Tímido/a", "Extrovertido/a", "Ansioso/a",
  "Seguro/a de sí mismo/a", "Sensible", "Resiliente", "Paciente", "Impulsivo/a",
  "Buena comunicación", "Trabajo en equipo", "Liderazgo", "Responsable", "Puntual",
  "Proactivo/a", "Autónomo/a", "Necesita supervisión constante",
  "Buena tolerancia a la presión", "Baja tolerancia a la presión",
  "Adaptable a cambios", "Dificultad para adaptarse a cambios",
  "Orientado/a al detalle", "Creativo/a",
];

export const AMBIENTES_CENTRO = [
  "Ambiente tranquilo",
  "Ritmo acelerado",
  "Ritmo moderado",
  "Alta exigencia técnica",
  "Supervisión cercana",
  "Trabajo autónomo",
  "Trabajo estructurado",
  "Trabajo en equipo",
  "Trabajo individual",
  "Atención directa al público",
  "Ambiente dinámico y cambiante",
];

// Áreas dentro del centro en las que un estudiante podría desempeñarse
// durante su práctica dual. Esta lista general se usa cuando todavía no se
// sabe la especialidad — por ejemplo en el formulario público que completa
// la empresa, donde el liceo asigna las especialidades después.
export const AREAS_DESEMPENO = [
  "Administración",
  "Recursos Humanos",
  "Atención al cliente",
  "Contabilidad",
  "Logística",
  "Bodega",
  "Informática",
  "Ventas",
  "Producción",
];

/**
 * Áreas que tienen sentido en cualquier centro, sea cual sea la
 * especialidad: un estudiante de Mecánica igual puede atender público o
 * llevar la bodega de repuestos.
 */
const AREAS_TRANSVERSALES = [
  "Atención al cliente",
  "Bodega e inventario",
  "Administración",
  "Prevención de riesgos",
];

interface GrupoAreas {
  /** Palabras que se buscan dentro del nombre de la especialidad. Se
   * compara por texto y no por id porque cada liceo crea su propio
   * catálogo y los nombres varían ("Contabilidad", "Contabilidad y
   * Administración"). */
  claves: string[];
  areas: string[];
  /** Habilidades técnicas propias de la especialidad. Comparten vocabulario
   * con las del estudiante: la compatibilidad compara los textos tal cual,
   * así que una habilidad solo sirve si ambos formularios la ofrecen. */
  habilidades: string[];
}

/**
 * Áreas propias de cada familia de especialidad Técnico Profesional.
 *
 * Curado a mano, igual que EQUIVALENCIAS_RASGO_AMBIENTE: no inventa datos
 * de ningún centro, solo propone opciones razonables para que nadie tenga
 * que elegir "Producción" para un estudiante de Enfermería. Se amplía acá
 * cuando aparezca una especialidad nueva.
 */
const AREAS_POR_ESPECIALIDAD: GrupoAreas[] = [
  {
    claves: ["contabilidad", "administracion", "finanzas", "secretariado"],
    areas: [
      "Contabilidad", "Tesorería", "Remuneraciones", "Facturación y cobranza",
      "Recursos Humanos", "Oficina de partes", "Ventas", "Informática y ofimática",
    ],
    habilidades: [
      "Manejo de libros contables",
      "Facturación electrónica",
      "Uso de planillas de cálculo",
      "Atención de proveedores",
      "Archivo y documentación",
      "Cálculo de remuneraciones",
    ],
  },
  {
    claves: ["mecanica", "automotriz", "metalmecanica", "matriceria"],
    areas: [
      "Mantenimiento mecánico", "Motor y transmisión", "Frenos y suspensión",
      "Sistema eléctrico automotriz", "Soldadura", "Torno y fresado",
      "Diagnóstico y escáner", "Bodega de repuestos",
    ],
    habilidades: [
      "Lectura de manuales técnicos",
      "Diagnóstico de fallas",
      "Soldadura",
      "Mantenimiento preventivo",
      "Manejo de instrumentos de medición",
      "Orden y limpieza del taller",
    ],
  },
  {
    claves: ["agropecuaria", "agricola", "pecuaria", "forestal"],
    areas: [
      "Producción agrícola", "Producción pecuaria", "Manejo de ganado", "Lechería",
      "Riego", "Maquinaria agrícola", "Invernadero y vivero", "Sanidad animal",
      "Registros de producción",
    ],
    habilidades: [
      "Manejo de animales",
      "Labores de cultivo",
      "Aplicación de sanidad vegetal y animal",
      "Registro de producción",
      "Trabajo a la intemperie",
      "Manejo de riego",
    ],
  },
  {
    claves: ["parvulo", "parvularia", "educacion inicial"],
    areas: [
      "Sala cuna", "Nivel medio", "Nivel de transición", "Apoyo pedagógico",
      "Material didáctico", "Alimentación y mudas", "Recreación y juego",
      "Registro de asistencia",
    ],
    habilidades: [
      "Trato con niños y niñas",
      "Preparación de material didáctico",
      "Apoyo en rutinas de higiene",
      "Animación y juego",
      "Observación y registro",
      "Comunicación con familias",
    ],
  },
  {
    claves: ["enfermeria", "salud"],
    areas: [
      "Atención de pacientes", "Toma de signos vitales", "Esterilización",
      "Apoyo en procedimientos", "Registro clínico", "Higiene y confort",
      "Admisión y recepción", "Botiquín y farmacia",
    ],
    habilidades: [
      "Toma de signos vitales",
      "Apoyo en procedimientos clínicos",
      "Manejo de insumos estériles",
      "Registro clínico",
      "Trato con pacientes",
      "Higiene y confort del paciente",
    ],
  },
  {
    claves: ["electricidad", "electronica", "electrico"],
    areas: [
      "Instalaciones eléctricas", "Mantenimiento eléctrico", "Tableros y automatización",
      "Lectura de planos", "Montaje de equipos",
    ],
    habilidades: [
      "Lectura de planos eléctricos",
      "Instalación de circuitos",
      "Medición con instrumentos",
      "Normas de seguridad eléctrica",
    ],
  },
  {
    claves: ["gastronomia", "alimentacion", "cocina"],
    areas: [
      "Cocina caliente", "Cocina fría", "Pastelería y panadería",
      "Servicio de comedor", "Higiene y manipulación de alimentos",
      "Bodega de alimentos",
    ],
    habilidades: [
      "Manipulación de alimentos",
      "Técnicas de cocina",
      "Pastelería y panadería",
      "Servicio de comedor",
      "Control de inventario de insumos",
      "Trabajo bajo presión en cocina",
    ],
  },
  {
    claves: ["construccion", "edificacion", "obras"],
    areas: [
      "Obra gruesa", "Terminaciones", "Instalaciones sanitarias",
      "Lectura de planos", "Bodega de materiales",
    ],
    habilidades: [
      "Lectura de planos",
      "Trazado y nivelación",
      "Terminaciones",
      "Manejo de materiales de obra",
    ],
  },
  {
    claves: ["informatica", "telecomunicaciones", "conectividad", "programacion"],
    areas: [
      "Soporte técnico", "Redes y conectividad", "Mantenimiento de equipos",
      "Instalación de software", "Mesa de ayuda", "Desarrollo y sitios web",
    ],
    habilidades: [
      "Soporte a usuarios",
      "Instalación y configuración de equipos",
      "Redes y conectividad",
      "Programación básica",
      "Respaldo de información",
    ],
  },
  {
    claves: ["turismo", "hoteleria"],
    areas: [
      "Recepción", "Reservas", "Housekeeping", "Guía y atención de visitantes",
      "Eventos",
    ],
    habilidades: [
      "Manejo de reservas",
      "Orientación a visitantes",
      "Organización de eventos",
    ],
  },
  {
    claves: ["vestuario", "textil", "confeccion"],
    areas: ["Corte", "Confección", "Diseño y patronaje", "Control de calidad", "Terminaciones"],
    habilidades: [
      "Uso de máquinas de costura",
      "Corte y confección",
      "Patronaje",
      "Control de calidad",
      "Terminaciones de prendas",
    ],
  },
];

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Áreas a ofrecer según las especialidades que atiende el centro.
 *
 * Une las áreas de cada especialidad reconocida más las transversales. Si
 * no hay especialidades elegidas, o ninguna coincide con el catálogo, cae
 * en la lista general: es preferible ofrecer de más que dejar a alguien
 * sin ninguna opción porque su liceo nombró la especialidad distinto.
 *
 * `yaElegidas` se agrega siempre, aunque no pertenezca a la especialidad:
 * si un centro guardó "Producción" y después se le cambia la especialidad,
 * esa área tiene que seguir visible — si desapareciera de la lista, editar
 * el centro la borraría sin que nadie se entere.
 */
export function areasParaEspecialidades(
  nombresEspecialidad: string[],
  yaElegidas: string[] = []
): string[] {
  const nombres = nombresEspecialidad.map(normalizar).filter(Boolean);

  const coincidencias = AREAS_POR_ESPECIALIDAD.filter((grupo) =>
    grupo.claves.some((clave) => nombres.some((nombre) => nombre.includes(clave)))
  );

  const base = coincidencias.length === 0
    ? AREAS_DESEMPENO
    : [...coincidencias.flatMap((g) => g.areas), ...AREAS_TRANSVERSALES];

  // Set para quitar duplicados: dos especialidades pueden compartir un área.
  return Array.from(new Set([...base, ...yaElegidas]));
}

/**
 * Habilidades a ofrecer según la especialidad.
 *
 * A diferencia de las áreas, acá la lista general nunca se reemplaza: solo
 * se amplía. Comunicación, Organización o Trabajo en equipo sirven en
 * cualquier centro, sea de Mecánica o de Párvulo.
 *
 * `yaElegidas` se agrega siempre: si cambia la especialidad, una habilidad
 * ya guardada no puede desaparecer de la lista, o editar el registro la
 * borraría sin que nadie se entere.
 */
export function habilidadesParaEspecialidades(
  nombresEspecialidad: string[],
  yaElegidas: string[] = []
): string[] {
  const nombres = nombresEspecialidad.map(normalizar).filter(Boolean);

  const propias = AREAS_POR_ESPECIALIDAD
    .filter((grupo) => grupo.claves.some((clave) => nombres.some((n) => n.includes(clave))))
    .flatMap((grupo) => grupo.habilidades);

  return Array.from(new Set([...HABILIDADES, ...propias, ...yaElegidas]));
}

// Vocabulario compartido entre estudiante (habilidades) y centro (habilidades
// valoradas): al usar el mismo texto en ambos lados, la comparación es directa.
export const HABILIDADES = [
  "Comunicación",
  "Organización",
  "Atención al cliente",
  "Herramientas digitales",
  "Resolución de problemas",
  "Liderazgo",
  "Trabajo en equipo",
  "Gestión del tiempo",
  "Redacción",
  "Manejo de caja/ventas",
  "Uso de maquinaria/herramientas",
  "Idiomas",
];

// Mapea cada rasgo del estudiante a los ambientes de centro con los que es
// compatible. Es un mapeo curado (no inventa datos del estudiante ni del
// centro: solo describe qué condiciones declaradas por un centro son
// compatibles con qué rasgo declarado por un estudiante), editable acá si se
// necesita ajustar el criterio de compatibilidad más adelante.
export const EQUIVALENCIAS_RASGO_AMBIENTE: Record<string, string[]> = {
  "Tranquilo/a": ["Ambiente tranquilo", "Ritmo moderado", "Trabajo individual"],
  "Nervioso/a": ["Ambiente tranquilo", "Supervisión cercana", "Ritmo moderado"],
  "Tímido/a": ["Ambiente tranquilo", "Trabajo individual", "Supervisión cercana"],
  "Extrovertido/a": ["Atención directa al público", "Trabajo en equipo", "Ambiente dinámico y cambiante"],
  "Ansioso/a": ["Ambiente tranquilo", "Supervisión cercana", "Ritmo moderado"],
  "Seguro/a de sí mismo/a": ["Trabajo autónomo", "Atención directa al público"],
  "Sensible": ["Ambiente tranquilo", "Supervisión cercana"],
  "Resiliente": ["Ritmo acelerado", "Alta exigencia técnica", "Ambiente dinámico y cambiante"],
  "Paciente": ["Atención directa al público", "Trabajo estructurado"],
  "Impulsivo/a": ["Ambiente dinámico y cambiante", "Supervisión cercana"],
  "Buena comunicación": ["Atención directa al público", "Trabajo en equipo"],
  "Trabajo en equipo": ["Trabajo en equipo"],
  "Liderazgo": ["Trabajo en equipo", "Trabajo autónomo"],
  "Responsable": ["Trabajo estructurado", "Trabajo autónomo"],
  "Puntual": ["Trabajo estructurado"],
  "Proactivo/a": ["Trabajo autónomo", "Ambiente dinámico y cambiante"],
  "Autónomo/a": ["Trabajo autónomo"],
  "Necesita supervisión constante": ["Supervisión cercana", "Trabajo estructurado"],
  "Buena tolerancia a la presión": ["Alta exigencia técnica", "Ritmo acelerado"],
  "Baja tolerancia a la presión": ["Ambiente tranquilo", "Ritmo moderado"],
  "Adaptable a cambios": ["Ambiente dinámico y cambiante", "Ritmo acelerado"],
  "Dificultad para adaptarse a cambios": ["Trabajo estructurado", "Ritmo moderado"],
  "Orientado/a al detalle": ["Trabajo estructurado", "Alta exigencia técnica"],
  "Creativo/a": ["Ambiente dinámico y cambiante", "Trabajo autónomo"],
};
