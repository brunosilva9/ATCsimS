/**
 * Los conflictos detectados.
 *
 * Lo importante de esta lista no son los conflictos: es la nota del final. Un ejercicio que
 * sale "sin conflictos" medido con minimas provisionales no esta limpio, esta sin medir, y el
 * alumno tiene que verlo.
 */

import { formatHhmm } from '@atcsims/core';
import type { ConflictReport, Scenario } from '@atcsims/core';

import styles from './ConflictList.module.css';

const KIND_LABEL: Record<string, string> = {
  SAME_FIX: 'mismo punto',
  IN_TRAIL: 'en fila',
  CROSSING: 'cruce',
};

export interface ConflictListProps {
  readonly report: ConflictReport;
  readonly scenario: Scenario;
}

export function ConflictList({ report, scenario }: ConflictListProps) {
  const callsign = (id: string) =>
    scenario.flights.find((f) => f.id === id)?.callsign ?? id;

  const losses = report.conflicts.filter((c) => c.severity === 'LOSS').length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.summary}>
        {report.conflicts.length === 0 ? (
          <span className={styles.clean}>Sin conflictos detectados</span>
        ) : (
          <>
            <span className={losses > 0 ? styles.loss : styles.marginal}>
              {losses} pérdida{losses === 1 ? '' : 's'} de separación
            </span>
            <span className={styles.marginal}>
              {report.conflicts.length - losses} al límite
            </span>
          </>
        )}
      </div>

      {report.conflicts.length > 0 ? (
        <ul className={styles.list}>
          {report.conflicts.map((c) => (
            <li key={c.id} className={c.severity === 'LOSS' ? styles.itemLoss : styles.item}>
              <div className={styles.head}>
                <span className={styles.time}>{formatHhmm(c.time)}</span>
                <span className={styles.fix}>{c.fix}</span>
                <span className={styles.kind}>{KIND_LABEL[c.kind] ?? c.kind}</span>
                <span className={styles.pair}>
                  {callsign(c.flightIds[0])} / {callsign(c.flightIds[1])}
                </span>
              </div>
              <div className={styles.detail}>
                {c.verticalFt} ft de diferencia · {c.timeGapMin} min de separación · mínima{' '}
                {c.appliedMinimum.value} {c.appliedMinimum.unit}
              </div>
              <div className={styles.source}>{c.appliedMinimum.source}</div>
            </li>
          ))}
        </ul>
      ) : null}

      {report.notes.map((note) => (
        <p key={note} className={styles.note}>
          {note}
        </p>
      ))}
    </div>
  );
}
