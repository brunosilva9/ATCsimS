/**
 * Que es una coleccion, sobre su listado en /admin (N-08).
 *
 * Quien edita la base no siempre es quien la armo: el ATC entra a corregir un dato y necesita
 * saber, antes de tocarlo, si mueve horas de paso o solo cambia una lista. El texto vive en el
 * esquema de cada coleccion (AdminSchema.ts), asi que una coleccion nueva lo trae consigo.
 */

import type { CollectionSchema } from './AdminSchema.js';
import { IMPACT_LABEL, schemaFor } from './AdminSchema.js';
import styles from './AdminDefinition.module.css';

export interface AdminDefinitionProps {
  readonly schema: CollectionSchema;
  /** Abre la pestaña de una coleccion relacionada. */
  readonly onOpen: (collection: string) => void;
}

export function AdminDefinition({ schema, onOpen }: AdminDefinitionProps) {
  const { impact, contains, usedFor, onEdit, relations } = schema.definition;

  return (
    <section className={styles.card} aria-label={`Qué es ${schema.label}`}>
      <p className={styles[impact]}>{IMPACT_LABEL[impact]}</p>
      <dl className={styles.grid}>
        <div>
          <dt>Qué contiene</dt>
          <dd>{contains}</dd>
        </div>
        <div>
          <dt>Para qué se usa</dt>
          <dd>{usedFor}</dd>
        </div>
        <div>
          <dt>Al editarla</dt>
          <dd>{onEdit}</dd>
        </div>
        {relations.length > 0 ? (
          <div>
            <dt>Se relaciona con</dt>
            <dd>
              <ul className={styles.relations}>
                {relations.map((r) => (
                  <li key={r.collection}>
                    <button type="button" className={styles.link} onClick={() => onOpen(r.collection)}>
                      {schemaFor(r.collection)?.label ?? r.collection}
                    </button>
                    : {r.how}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
