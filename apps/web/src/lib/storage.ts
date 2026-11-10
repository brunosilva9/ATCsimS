/**
 * El banco de ejercicios, en Firestore (coleccion `scenarios`, doc ID = `draft.id`).
 *
 * Es UN banco compartido entre instructores: lo leen y lo escriben las cuentas con rol
 * `instructor` o `admin` en `users` (reglas en firestore.rules). Un alumno no lo ve, para que no
 * conozca la prueba antes de rendirla. Al alumno el ejercicio le sigue llegando por enlace o por
 * archivo, igual que antes.
 *
 * Se guarda la RECETA (`ScenarioDraft`), no el ejercicio calculado. Si manana se corrige una
 * distancia en la base, los ejercicios guardados se recalculan solos.
 *
 * Antes el banco vivia en el localStorage de cada navegador. Lo que haya quedado ahi se sube con
 * `uploadLocalDrafts` (boton en /scenarios); este modulo ya no escribe en localStorage.
 */

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

import { auth, db } from './firebase.js';
import type { ScenarioDraft } from '../scenarios/build.js';

const COLLECTION = 'scenarios';

/** La receta mas quien la toco por ultima vez: en un banco compartido eso importa. */
export interface StoredDraft extends ScenarioDraft {
  /** Epoch ms del ultimo guardado. */
  readonly updatedAt?: number;
  /** Email de la cuenta que guardo por ultima vez. */
  readonly updatedBy?: string;
}

/**
 * Firestore rechaza `undefined` (un `generator` o un `mode` que quedaron sin valor). Un viaje
 * por JSON los saca, y la receta ya es JSON puro: es lo mismo que viaja en el enlace.
 */
function toFirestore(draft: ScenarioDraft): Record<string, unknown> {
  const { updatedAt: _a, updatedBy: _b, ...recipe } = draft as StoredDraft;
  return {
    ...(JSON.parse(JSON.stringify(recipe)) as Record<string, unknown>),
    updatedAt: Date.now(),
    updatedBy: auth.currentUser?.email ?? null,
  };
}

export async function listDrafts(): Promise<StoredDraft[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((d) => d.data() as StoredDraft)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getDraft(id: string): Promise<StoredDraft | undefined> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? (snap.data() as StoredDraft) : undefined;
}

/** Guarda o reemplaza. Lanza si Firestore no deja escribir (sin rol, sin red). */
export async function saveDraft(draft: ScenarioDraft): Promise<void> {
  await setDoc(doc(db, COLLECTION, draft.id), toFirestore(draft));
}

export async function deleteDraft(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Identificador de un ejercicio nuevo. Legible, porque aparece en el nombre del archivo, y con
 * un sufijo al azar: en un banco compartido dos instructores pueden crear uno en el mismo
 * minuto, y sin el sufijo el segundo pisaria al primero.
 */
export function newDraftId(): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `ej-${stamp}-${crypto.randomUUID().slice(0, 4)}`;
}

// ------------------------------------------------------------- lo que quedo en el navegador

/** La clave con que el banco vivia en localStorage, antes de Firestore. */
const LOCAL_KEY = 'atcsims.scenarios.v1';
/** Donde queda la copia local despues de subirla: no se borra, por si acaso. */
const LOCAL_BACKUP_KEY = 'atcsims.scenarios.v1.subidos';

/**
 * `localStorage` puede fallar o venir vacio (ventana privada, datos borrados, permisos): se
 * trata como "no hay nada" en vez de romper.
 */
export function localDrafts(): ScenarioDraft[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScenarioDraft[]) : [];
  } catch {
    return [];
  }
}

/** JSON con las claves ordenadas: Firestore no devuelve los campos en el orden en que se guardaron. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => v !== undefined && k !== 'updatedAt' && k !== 'updatedBy')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Sube al banco los ejercicios guardados en este navegador y devuelve cuantos subio.
 *
 * - Mismo ID y mismo contenido ya en Firestore: ya estaba subido, se salta (subir dos veces no
 *   duplica).
 * - Mismo ID con OTRO contenido: los IDs viejos son solo la hora, y otro navegador pudo usar el
 *   mismo. Se le da un ID nuevo en vez de pisar el ejercicio ajeno.
 *
 * Al terminar, la copia local pasa a otra clave: no se vuelve a ofrecer, pero tampoco se borra.
 */
export async function uploadLocalDrafts(): Promise<number> {
  let uploaded = 0;
  for (const draft of localDrafts()) {
    const existing = await getDraft(draft.id);
    if (existing !== undefined && stableJson(existing) === stableJson(draft)) continue;
    await saveDraft(existing !== undefined ? { ...draft, id: newDraftId() } : draft);
    uploaded += 1;
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw !== null) window.localStorage.setItem(LOCAL_BACKUP_KEY, raw);
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Si el navegador no deja moverla, se seguira ofreciendo subirla; volver a hacerlo se salta
    // lo que ya esta en el banco.
  }
  return uploaded;
}
