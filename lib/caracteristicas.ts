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
// durante su práctica dual.
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
