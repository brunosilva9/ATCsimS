/**
 * Antes de guardar un cambio del panel, se comprueba si INTRODUCE un problema nuevo (no si la
 * base ya tenia uno) — ver packages/core/src/integrity.ts. Solo 6 de las 16 colecciones
 * participan de esos chequeos (las que usa el motor de calculo); las otras 10 se guardan sin
 * pasar por aca, porque ningun chequeo existente les aplica.
 */

import type { IntegrityDataset } from '@atcsims/core';

import type { NavdataState } from '../state/navdata.js';
import { computeDocId, schemaFor } from './AdminSchema.js';

const INTEGRITY_SLOTS = ['fixes', 'procedures', 'airways', 'holdings', 'performance', 'separation'] as const;
export type IntegritySlot = (typeof INTEGRITY_SLOTS)[number];

export function isIntegritySlot(collection: string): collection is IntegritySlot {
  return (INTEGRITY_SLOTS as readonly string[]).includes(collection);
}

export function datasetFrom(navdata: NavdataState): IntegrityDataset {
  return {
    fixes: navdata.fixes,
    procedures: navdata.procedures,
    airways: navdata.airways,
    holdings: navdata.holdings,
    performance: navdata.performance,
    separation: navdata.separation,
  };
}

/**
 * El dataset como quedaria si se guardara `edited` (o se borrara, si es null) en `docId` de
 * `collection`. Se identifica el registro reemplazado por el mismo ID que usaria Firestore, asi
 * que sirve igual para las colecciones con clave natural y para `separation` (clave compuesta).
 */
export function datasetWithEdit(
  base: IntegrityDataset,
  collection: IntegritySlot,
  docId: string,
  edited: Record<string, unknown> | null
): IntegrityDataset {
  const schema = schemaFor(collection);
  if (!schema) return base;

  const arr = base[collection] as unknown as readonly Record<string, unknown>[];
  const filtered = arr.filter((r) => computeDocId(schema, r) !== docId);
  const next = edited === null ? filtered : [...filtered, edited];
  return { ...base, [collection]: next };
}
