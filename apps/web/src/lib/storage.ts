/**
 * El banco de ejercicios, en el navegador.
 *
 * Sin servidor, esto es todo el almacenamiento que hay: lo que guarda un instructor vive en SU
 * navegador y no llega a nadie mas. Por eso todo lo que sale de aqui tiene salida por enlace o
 * por archivo — es la unica forma de que un ejercicio viaje.
 *
 * Se guarda la RECETA (`ScenarioDraft`), no el ejercicio calculado. Si manana se corrige una
 * distancia en las planillas, los ejercicios guardados se recalculan solos.
 */

import type { ScenarioDraft } from '../scenarios/build.js';

const KEY = 'atcsims.scenarios.v1';

/**
 * `localStorage` puede fallar o venir vacio (ventana privada, datos borrados, permisos), asi
 * que cada lectura y cada escritura va protegida y el banco se queda vacio en vez de romper.
 */
function read(): ScenarioDraft[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScenarioDraft[]) : [];
  } catch {
    return [];
  }
}

function write(drafts: readonly ScenarioDraft[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

export function listDrafts(): ScenarioDraft[] {
  return read().sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function getDraft(id: string): ScenarioDraft | undefined {
  return read().find((d) => d.id === id);
}

/** Guarda o reemplaza. Devuelve false si el navegador no dejo escribir. */
export function saveDraft(draft: ScenarioDraft): boolean {
  const all = read();
  const at = all.findIndex((d) => d.id === draft.id);
  if (at === -1) all.push(draft);
  else all[at] = draft;
  return write(all);
}

export function deleteDraft(id: string): boolean {
  return write(read().filter((d) => d.id !== id));
}

/** Identificador de un ejercicio nuevo. Legible, porque aparece en el nombre del archivo. */
export function newDraftId(): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `ej-${stamp}`;
}
