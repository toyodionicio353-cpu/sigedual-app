export interface PreguntaBaseVisita {
  id: string;
  categoria: string;
  texto: string;
}

/**
 * Preguntas base del formulario de visita, transcritas literal del pedido
 * original — organizadas en las 3 categorías que pide. Plantilla fija por
 * ahora (constante TS, no Firestore); el editor para que el liceo las
 * modifique/agregue queda para una entrega aparte. Una visita ya iniciada
 * guarda su propia copia (snapshot) de estas preguntas — cambiar esta
 * constante después no afecta visitas ya iniciadas.
 */
export const PREGUNTAS_BASE_VISITA: PreguntaBaseVisita[] = [
  {
    id: "a-1", categoria: "Situación del estudiante",
    texto: "¿Cómo ha sido el desempeño general del estudiante durante su permanencia en el Centro Dual?",
  },
  {
    id: "a-2", categoria: "Situación del estudiante",
    texto: "¿Cómo ha sido el comportamiento y actitud del estudiante?",
  },
  {
    id: "a-3", categoria: "Situación del estudiante",
    texto: "¿El estudiante está cumpliendo adecuadamente con las tareas y responsabilidades asignadas?",
  },
  {
    id: "a-4", categoria: "Situación del estudiante",
    texto: "¿Existen dificultades que estén afectando el proceso de formación del estudiante?",
  },
  {
    id: "a-5", categoria: "Situación del estudiante",
    texto: "¿Qué aspectos positivos se destacan del desempeño del estudiante?",
  },
  {
    id: "a-6", categoria: "Situación del estudiante",
    texto: "¿Qué aspectos del desempeño del estudiante deberían mejorar?",
  },
  {
    id: "b-1", categoria: "Relación con el Centro Dual",
    texto: "¿Cómo ha sido la adaptación del estudiante al ambiente de trabajo?",
  },
  {
    id: "b-2", categoria: "Relación con el Centro Dual",
    texto: "¿Existe una comunicación adecuada entre el estudiante, el Maestro Guía y el Centro Dual?",
  },
  {
    id: "b-3", categoria: "Relación con el Centro Dual",
    texto: "¿El Centro Dual considera que las actividades realizadas son pertinentes para la formación del estudiante?",
  },
  {
    id: "c-1", categoria: "Maestro Guía / Empresa",
    texto: "¿El Maestro Guía ha podido realizar adecuadamente el acompañamiento del estudiante?",
  },
  {
    id: "c-2", categoria: "Maestro Guía / Empresa",
    texto: "¿Existen dificultades o necesidades que el Centro Dual quiera comunicar al establecimiento?",
  },
  {
    id: "c-3", categoria: "Maestro Guía / Empresa",
    texto: "¿Qué aspectos del proceso de formación dual podrían mejorarse?",
  },
];

export const CATEGORIAS_PREGUNTAS_VISITA = [
  "Situación del estudiante",
  "Relación con el Centro Dual",
  "Maestro Guía / Empresa",
];
