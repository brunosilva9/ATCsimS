/**
 * El formulario de un documento, renderizado segun su CollectionSchema (AdminSchema.ts).
 *
 * Antes de guardar en una de las 6 colecciones de las que depende el motor de calculo
 * (fixes/procedures/airways/holdings/performance/separation), se comprueba con
 * packages/core/src/integrity.ts si el cambio introduce un problema NUEVO — no si la base ya
 * tenia uno de antes, que no es culpa de esta edicion. Si lo introduce, no se guarda.
 */

import { type FormEvent, useState } from 'react';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';

import { checkIntegrity, newIssues } from '@atcsims/core';
import type { IntegrityIssue } from '@atcsims/core';

import { db } from '../lib/firebase.js';
import { useNavdataStore } from '../state/navdata.js';
import type { CollectionSchema, FieldSchema } from './AdminSchema.js';
import { computeDocId } from './AdminSchema.js';
import { datasetFrom, datasetWithEdit, isIntegritySlot } from './AdminValidation.js';
import shared from './shared.module.css';
import styles from './AdminRecordForm.module.css';

type Draft = Record<string, unknown>;

function toDraft(schema: CollectionSchema, initial: Draft | null): Draft {
  const draft: Draft = { ...initial };
  for (const field of schema.fields) {
    if (draft[field.key] === undefined) {
      draft[field.key] = field.type === 'boolean' ? false : field.type === 'stringArray' || field.type === 'segments' ? [] : field.type === 'nestedArray' ? [] : field.type === 'stringArrayMap' ? {} : null;
    }
  }
  return draft;
}

function linesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  readonly field: FieldSchema;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <input
          className={styles.input}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' && field.nullable ? null : e.target.value)}
        />
      );

    case 'number':
      return (
        <input
          className={styles.input}
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            if (e.target.value === '') return onChange(field.nullable ? null : 0);
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? n : value);
          }}
        />
      );

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );

    case 'select': {
      const options = (field as Extract<FieldSchema, { type: 'select' }>).options;
      // separation.withDepartures es boolean|null, representado como texto en el <select>.
      const current = value === null || value === undefined ? '' : String(value);
      return (
        <select
          className={styles.input}
          value={current}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === 'true') return onChange(true);
            if (raw === 'false') return onChange(false);
            if (raw === '') return onChange(field.nullable ? null : raw);
            onChange(raw);
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o === '' ? '— (sin dato)' : o === 'true' ? 'Sí' : o === 'false' ? 'No' : o}
            </option>
          ))}
        </select>
      );
    }

    case 'stringArray':
      return (
        <textarea
          className={styles.textarea}
          rows={3}
          value={linesOf(value).join('\n')}
          placeholder="Una línea por valor"
          onChange={(e) => {
            const lines = e.target.value.split('\n').map((l) => l.trim()).filter((l) => l !== '');
            onChange(field.numericArray ? lines.map(Number) : lines);
          }}
        />
      );

    case 'segments': {
      const segments = Array.isArray(value) ? (value as readonly (readonly string[])[]) : [];
      const text = segments.map((seg) => seg.join(', ')).join('\n');
      return (
        <textarea
          className={styles.textarea}
          rows={3}
          value={text}
          placeholder="fix, fix, fix (una línea por tramo)"
          onChange={(e) => {
            const lines = e.target.value.split('\n').map((l) => l.trim()).filter((l) => l !== '');
            onChange(lines.length === 0 ? null : lines.map((l) => l.split(',').map((f) => f.trim()).filter(Boolean)));
          }}
        />
      );
    }

    case 'stringArrayMap': {
      const map = (value ?? {}) as Record<string, readonly string[]>;
      const text = Object.entries(map)
        .map(([k, v]) => `${k}: ${v.join(', ')}`)
        .join('\n');
      return (
        <textarea
          className={styles.textarea}
          rows={3}
          value={text}
          placeholder="CLAVE: valor, valor"
          onChange={(e) => {
            const next: Record<string, string[]> = {};
            for (const line of e.target.value.split('\n')) {
              const [k, rest] = line.split(':');
              if (!k || rest === undefined) continue;
              next[k.trim()] = rest.split(',').map((v) => v.trim()).filter(Boolean);
            }
            onChange(next);
          }}
        />
      );
    }

    case 'nestedArray': {
      const itemFields = (field as Extract<FieldSchema, { type: 'nestedArray' }>).itemFields;
      const rows = Array.isArray(value) ? (value as Draft[]) : [];
      const patchRow = (i: number, key: string, v: unknown) => {
        const next = rows.map((row, idx) => (idx === i ? { ...row, [key]: v } : row));
        onChange(next);
      };
      const addRow = () => {
        const blank: Draft = {};
        for (const f of itemFields) blank[f.key] = f.type === 'boolean' ? false : null;
        onChange([...rows, blank]);
      };
      const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

      return (
        <div className={styles.nested}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {itemFields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {itemFields.map((f) => (
                      <td key={f.key}>
                        <FieldEditor field={f} value={row[f.key]} onChange={(v) => patchRow(i, f.key, v)} />
                      </td>
                    ))}
                    <td>
                      <button type="button" className={styles.remove} onClick={() => removeRow(i)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className={styles.secondary} onClick={addRow}>
            Añadir fila
          </button>
        </div>
      );
    }

    default:
      return null;
  }
}

export interface AdminRecordFormProps {
  readonly schema: CollectionSchema;
  /** null = registro nuevo. */
  readonly initial: Draft | null;
  readonly onClose: () => void;
}

export function AdminRecordForm({ schema, initial, onClose }: AdminRecordFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(schema, initial));
  const [blocking, setBlocking] = useState<readonly IntegrityIssue[]>([]);
  const [warnings, setWarnings] = useState<readonly IntegrityIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const docId = computeDocId(schema, draft);
    if (docId.trim() === '') {
      setError('Falta un valor para el campo que identifica al registro.');
      return;
    }

    if (isIntegritySlot(schema.collection)) {
      const navdata = useNavdataStore.getState();
      const before = checkIntegrity(datasetFrom(navdata));
      const after = checkIntegrity(datasetWithEdit(datasetFrom(navdata), schema.collection, docId, draft));
      const fails = newIssues(before, after, 'fail');
      if (fails.length > 0) {
        setBlocking(fails);
        setWarnings(newIssues(before, after, 'warn'));
        return;
      }
      setBlocking([]);
      setWarnings(newIssues(before, after, 'warn'));
    }

    setSaving(true);
    try {
      await setDoc(doc(db, schema.collection, docId), draft);
      await useNavdataStore.getState().loadAll();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (initial === null) return;
    const docId = computeDocId(schema, initial);
    if (!window.confirm(`¿Borrar "${docId}" de ${schema.label}? No se puede deshacer.`)) return;

    setSaving(true);
    try {
      await deleteDoc(doc(db, schema.collection, docId));
      await useNavdataStore.getState().loadAll();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <div className={styles.grid}>
        {schema.fields.map((field) => (
          <label
            key={field.key}
            className={field.type === 'nestedArray' ? styles.fieldWide : styles.field}
          >
            <span className={styles.label}>{field.label}</span>
            <FieldEditor field={field} value={draft[field.key]} onChange={(v) => setField(field.key, v)} />
          </label>
        ))}
      </div>

      {blocking.length > 0 ? (
        <div className={styles.blocking} role="alert">
          <strong>No se puede guardar: rompe el motor de cálculo.</strong>
          <ul>
            {blocking.map((i) => (
              <li key={i.message}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className={shared.notice}>
          <strong>Avisos (no bloquean el guardado).</strong>
          <ul>
            {warnings.map((i) => (
              <li key={i.message}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error !== null ? (
        <div className={styles.blocking} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        {initial !== null ? (
          <button type="button" className={styles.danger} onClick={() => void handleDelete()} disabled={saving}>
            Borrar
          </button>
        ) : null}
      </div>
    </form>
  );
}
