/**
 * Los comentarios del backlog, en Firestore (coleccion `backlogComments`, ID automatico). N-09.
 *
 * Los lee y escribe solo admin, y cada autor modifica o borra solo los suyos: lo exige
 * firestore.rules, no esta pantalla. Desde el repositorio se leen con tools/backlog-comments.js.
 *
 * No es parte de la base de navegacion: no se carga con loadAll, asi que si las reglas de esta
 * coleccion faltan, falla solo /backlog y no la app entera.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';

import type { BacklogComment } from './backlog.js';
import { db } from './firebase.js';

const COLLECTION = 'backlogComments';

/** El mismo tope que firestore.rules: una referencia, no un documento entero. */
export const COMMENT_MAX_LENGTH = 4000;

function toComment(id: string, data: DocumentData): BacklogComment {
  return {
    id,
    itemId: String(data.itemId ?? ''),
    text: String(data.text ?? ''),
    authorUid: String(data.authorUid ?? ''),
    authorEmail: String(data.authorEmail ?? ''),
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? data.createdAt ?? 0),
  };
}

export async function listComments(): Promise<BacklogComment[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => toComment(d.id, d.data()));
}

export async function addComment(
  itemId: string,
  text: string,
  author: { readonly uid: string; readonly email: string | null }
): Promise<void> {
  const now = Date.now();
  await addDoc(collection(db, COLLECTION), {
    itemId,
    text,
    authorUid: author.uid,
    authorEmail: author.email ?? '',
    createdAt: now,
    updatedAt: now,
  });
}

/** Solo cambia el texto: el item, el autor y la fecha de creacion no se tocan (las reglas tampoco lo dejan). */
export async function editComment(id: string, text: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { text, updatedAt: Date.now() });
}

export async function removeComment(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
