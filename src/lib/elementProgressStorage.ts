const STORAGE_KEY = 'photovault_element_progress';

/**
 * Carga el mapa de porcentajes de avance persistidos localmente.
 */
export function getAllElementProgress(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn('Error reading photovault_element_progress from localStorage:', err);
    return {};
  }
}

/**
 * Guarda el porcentaje de avance de un elemento específico.
 */
export function saveElementProgress(elementId: string, progress: number): void {
  if (typeof window === 'undefined' || !elementId) return;
  try {
    const map = getAllElementProgress();
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    map[elementId] = clamped;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Error saving element progress to localStorage:', err);
  }
}

/**
 * Guarda múltiples porcentajes de avance en lote.
 */
export function saveMultipleElementProgress(updates: Record<string, number>): void {
  if (typeof window === 'undefined' || !updates) return;
  try {
    const map = getAllElementProgress();
    Object.entries(updates).forEach(([id, progress]) => {
      if (id && typeof progress === 'number' && !Number.isNaN(progress)) {
        map[id] = Math.max(0, Math.min(100, Math.round(progress)));
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Error saving multiple element progress to localStorage:', err);
  }
}

/**
 * Obtiene el porcentaje de avance guardado para un elemento.
 */
export function getElementProgress(elementId: string): number | undefined {
  if (!elementId) return undefined;
  const map = getAllElementProgress();
  return typeof map[elementId] === 'number' ? map[elementId] : undefined;
}

const AVANCE_TAG_REGEX = /\[AVANCE:\s*(\d+)%\]/i;
const GLOBAL_AVANCE_TAG_REGEX = /\s*\[AVANCE:\s*\d+%\]\s*/gi;

/**
 * Inserta o actualiza la etiqueta [AVANCE: X%] en las notas de campo para sincronización bidireccional con Supabase.
 */
export function encodeProgressInFieldNotes(fieldNotes: string | undefined, progress: number): string {
  const baseNotes = (fieldNotes || '').replace(GLOBAL_AVANCE_TAG_REGEX, '').trim();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const tag = `[AVANCE: ${clamped}%]`;
  return baseNotes ? `${baseNotes}\n${tag}` : tag;
}

/**
 * Extrae el porcentaje de avance incrustado en field_notes y retorna las notas limpias para visualización del usuario.
 */
export function decodeProgressFromFieldNotes(fieldNotes: string | undefined): {
  cleanFieldNotes: string;
  progress?: number;
} {
  if (!fieldNotes) return { cleanFieldNotes: '', progress: undefined };
  const match = fieldNotes.match(AVANCE_TAG_REGEX);
  const progress = match ? parseInt(match[1], 10) : undefined;
  const cleanFieldNotes = fieldNotes.replace(GLOBAL_AVANCE_TAG_REGEX, '').trim();
  return {
    cleanFieldNotes,
    progress: progress !== undefined && !Number.isNaN(progress) ? Math.max(0, Math.min(100, progress)) : undefined,
  };
}
