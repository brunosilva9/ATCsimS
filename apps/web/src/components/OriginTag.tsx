/**
 * La etiqueta de origen del trafico: generado (lo sorteo el generador), a mano (lo eligio un
 * instructor) o mezcla. Es la misma pastilla para el ejercicio entero, en el banco y en el
 * editor, y para cada vuelo de la tabla de trafico.
 */

import type { ReactNode } from 'react';

import type { OriginKind } from '../scenarios/origin.js';
import styles from './OriginTag.module.css';

const CLASS: Readonly<Record<OriginKind, string | undefined>> = {
  generated: styles.generated,
  hand: styles.hand,
  mixed: styles.mixed,
  empty: styles.hand,
};

export function OriginTag({
  kind,
  title,
  children,
}: {
  readonly kind: OriginKind;
  readonly title?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <span className={CLASS[kind]} title={title}>
      {children}
    </span>
  );
}
