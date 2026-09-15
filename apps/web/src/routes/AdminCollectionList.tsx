/**
 * La tabla de una coleccion: fila por documento, con "editar"/"nuevo". El detalle de cada
 * registro lo arma AdminRecordForm.tsx segun el mismo CollectionSchema.
 */

import { useMemo, useState } from 'react';

import { useNavdataStore } from '../state/navdata.js';
import type { NavdataState } from '../state/navdata.js';
import { AdminRecordForm } from './AdminRecordForm.js';
import type { CollectionSchema } from './AdminSchema.js';
import { computeDocId } from './AdminSchema.js';
import shared from './shared.module.css';
import styles from './AdminCollectionList.module.css';

type Draft = Record<string, unknown>;

type Editing = { readonly kind: 'list' } | { readonly kind: 'new' } | { readonly kind: 'edit'; readonly record: Draft };

function rowsFor(schema: CollectionSchema, navdata: NavdataState): readonly Draft[] {
  if (schema.collection === 'tma') {
    return navdata.tma ? [navdata.tma as unknown as Draft] : [];
  }
  const value = (navdata as unknown as Record<string, unknown>)[schema.collection];
  return Array.isArray(value) ? (value as readonly Draft[]) : [];
}

/** Un resumen de una linea: los primeros campos de texto/numero/booleano, sin listas ni tramos. */
function summaryOf(schema: CollectionSchema, record: Draft): string {
  const parts = schema.fields
    .filter((f) => f.type === 'text' || f.type === 'number' || f.type === 'boolean' || f.type === 'select')
    .slice(0, 4)
    .map((f) => {
      const v = record[f.key];
      if (v === null || v === undefined) return null;
      return typeof v === 'boolean' ? `${f.label}: ${v ? 'sí' : 'no'}` : `${f.label}: ${v}`;
    })
    .filter((s): s is string => s !== null);
  return parts.join(' · ');
}

export function AdminCollectionList({ schema }: { readonly schema: CollectionSchema }) {
  const navdata = useNavdataStore();
  const rows = useMemo(() => rowsFor(schema, navdata), [schema, navdata]);
  const [editing, setEditing] = useState<Editing>({ kind: 'list' });

  if (editing.kind !== 'list') {
    return (
      <AdminRecordForm
        schema={schema}
        initial={editing.kind === 'edit' ? editing.record : null}
        onClose={() => setEditing({ kind: 'list' })}
      />
    );
  }

  const canCreate = schema.collection !== 'tma' || rows.length === 0;

  return (
    <div className={styles.wrap}>
      <div className={shared.sectionHead}>
        <p className={shared.note}>{rows.length} registros</p>
        {canCreate ? (
          <button type="button" className={styles.primary} onClick={() => setEditing({ kind: 'new' })}>
            Nuevo
          </button>
        ) : null}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <tbody>
            {rows.map((record) => {
              const id = computeDocId(schema, record);
              return (
                <tr key={id}>
                  <td className={styles.ident}>{id}</td>
                  <td className={styles.summary}>{summaryOf(schema, record)}</td>
                  <td className={styles.actionCell}>
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => setEditing({ kind: 'edit', record })}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
