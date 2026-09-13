/**
 * Piezas compartidas entre las dos fichas: la calculada (FlightProgressStrip) y la en blanco
 * (ExamStrip). Antes cada una tenia su propio `Hhmm` y su propio numero de nivel, con el mismo
 * CSS copiado a mano en dos archivos — bastaba con tocar uno para que se desalinearan. Aqui hay
 * un solo lugar que decide como se escribe una hora o un nivel en cualquier strip.
 */

import { formatHhmm, splitHhmm } from '@atcsims/core';

import styles from './StripPrimitives.module.css';

export type TimeTone = 'printed' | 'pen' | 'struck';

/** Nivel de vuelo a como se escribe en la strip: 24000 -> "240". */
export function levelLabel(valueFt: number): string {
  return String(Math.round(valueFt / 100)).padStart(3, '0');
}

/**
 * La hora como la escribe el controlador: hora grande, minutos en exponente. El tooltip explica
 * como se calculo — la distancia, la GS y de donde salio, no solo repetir la hora que ya se lee.
 */
export function Hhmm({
  time,
  tone,
  detail,
}: {
  readonly time: number;
  readonly tone: TimeTone;
  readonly detail?: string | undefined;
}) {
  const { hours, minutes } = splitHhmm(time);
  return (
    <span className={`${styles.time} ${styles[tone]}`} title={detail ?? formatHhmm(time)}>
      <span className={styles.timeHours}>{hours}</span>
      <sup className={styles.timeMinutes}>{minutes}</sup>
    </span>
  );
}

/** El nivel escrito en la strip, en la misma tipografia en cualquiera de las dos fichas. */
export function LevelBadge({
  valueFt,
  superseded = false,
}: {
  readonly valueFt: number;
  readonly superseded?: boolean;
}) {
  return (
    <span className={superseded ? styles.levelStruck : styles.level}>{levelLabel(valueFt)}</span>
  );
}
