// Mapping síntoma → categorías candidatas del catálogo fixoem.
// Las categorías vienen del body_html de fixoem y tienen variantes (mayúsculas,
// plurales, typos). El matcher en lib/catalog.ts compara case-insensitive con
// startsWith / includes para tolerar las variantes.

export type Symptom =
  | 'pantalla'
  | 'bateria'
  | 'cargador'
  | 'audio'
  | 'camara'
  | 'teclado'
  | 'sim'
  | 'tapa'
  | 'boton';

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  pantalla: 'Pantalla',
  bateria: 'Batería',
  cargador: 'Carga / cable',
  audio: 'Audio',
  camara: 'Cámara',
  teclado: 'Teclado',
  sim: 'SIM',
  tapa: 'Tapa / chasis',
  boton: 'Botones',
};

export const SYMPTOM_TO_CATEGORIES: Record<Symptom, string[]> = {
  pantalla: ['pantalla', 'display', 'lcd', 'marco', 'bisel'],
  bateria: ['batería', 'bateria', 'batería pin'],
  cargador: ['cable flex', 'centro de carga', 'centro carga', 'adaptador de corriente', 'cargador'],
  audio: ['altavoz', 'auricular', 'micrófono', 'microfono'],
  camara: ['lente cámara', 'lente camara', 'cámara', 'camara'],
  teclado: ['teclado', 'tecla'],
  sim: ['charola sim', 'bandeja sim', 'charola'],
  tapa: ['tapa trasera', 'tapa', 'tapa frontal', 'tapa superior'],
  boton: ['botón físico', 'boton fisico', 'botón', 'boton'],
};

const SYMPTOM_PATTERNS: Array<[Symptom, RegExp]> = [
  ['pantalla', /\b(pantalla|display|cristal|t[áa]ctil|touch|lcd|roto|rota|estrellad)/i],
  ['bateria', /\b(bater[íi]a|carga\s+r[áa]pid|dura|aguanta|hinchad|inflad)/i],
  ['cargador', /\b(cargador|conector|puerto\s+de\s+carga|no\s+carga|pin\s+de\s+carga|centro\s+de\s+carga)/i],
  ['audio', /\b(audio|sonido|altavoz|bocina|aud[íi]fono|aur[íi]cular|micr[óo]fono|no\s+escucha)/i],
  ['camara', /\b(c[áa]mara|foto|lente|selfie)/i],
  ['teclado', /\b(teclado|tecla)/i],
  ['sim', /\b(sim|chip|charola|bandeja)/i],
  ['tapa', /\b(tapa|chasis|cubierta\s+trasera)/i],
  ['boton', /\b(bot[óo]n|home|encendido|volumen)/i],
];

export function detectSymptom(text: string | null | undefined): Symptom | null {
  if (!text) return null;
  for (const [s, re] of SYMPTOM_PATTERNS) {
    if (re.test(text)) return s;
  }
  return null;
}
