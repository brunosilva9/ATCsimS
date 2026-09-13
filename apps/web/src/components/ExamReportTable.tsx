/**
 * La correccion, lado del profesor.
 *
 * Una fila por punto, y en cada celda lo que puso el alumno junto a lo que sale del motor, con
 * la desviacion. No hay nota: hay errores, blancos y desviaciones. Quien pone la nota es el
 * profesor, que es lo que se pidio.
 *
 * Las filas con la referencia marcada son aquellas en las que el numero del motor no sale
 * directo de las planillas. Ahi la palabra "error" no significa lo mismo.
 */

import { formatHhmm } from '@atcsims/core';
import type { ExamReport, FieldCheck, LegCheck } from '@atcsims/core';

import styles from './ExamReportTable.module.css';

export interface ExamReportTableProps {
  readonly report: ExamReport;
}

type Unit = 'time' | 'level' | 'speed';

function show(value: number | null, unit: Unit): string {
  if (value === null) return '—';
  if (unit === 'time') return formatHhmm(value);
  if (unit === 'level') return String(Math.round(value / 100)).padStart(3, '0');
  return String(Math.round(value));
}

function showDelta(check: FieldCheck, unit: Unit): string {
  if (check.delta === null) return '';
  const raw = unit === 'level' ? check.delta / 100 : check.delta;
  const rounded = Math.round(raw * 10) / 10;
  if (rounded === 0) return '';
  const suffix = unit === 'time' ? ' min' : unit === 'level' ? '' : ' kt';
  return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`;
}

function Cell({ check, unit }: { check: FieldCheck; unit: Unit }) {
  const className =
    check.verdict === 'CORRECT'
      ? styles.ok
      : check.verdict === 'BLANK'
        ? styles.blank
        : styles.wrong;

  return (
    <td className={className}>
      <span className={styles.answered}>{show(check.answered, unit)}</span>
      {check.verdict === 'OUT_OF_TOLERANCE' ? (
        <span className={styles.expected}>
          esperado {show(check.expected, unit)} <em>{showDelta(check, unit)}</em>
        </span>
      ) : null}
      {check.verdict === 'BLANK' ? <span className={styles.expected}>sin contestar</span> : null}
    </td>
  );
}

function Tally({
  label,
  tally,
}: {
  label: string;
  tally: { correct: number; outOfTolerance: number; blank: number };
}) {
  const total = tally.correct + tally.outOfTolerance + tally.blank;
  return (
    <div className={styles.tally}>
      <span className={styles.tallyLabel}>{label}</span>
      <span className={styles.tallyBar}>
        <span className={styles.barOk} style={{ flexGrow: tally.correct }} />
        <span className={styles.barWrong} style={{ flexGrow: tally.outOfTolerance }} />
        <span className={styles.barBlank} style={{ flexGrow: tally.blank }} />
      </span>
      <span className={styles.tallyNumbers}>
        <strong>{tally.correct}</strong>/{total} dentro de tolerancia
        {tally.outOfTolerance > 0 ? ` · ${tally.outOfTolerance} fuera` : ''}
        {tally.blank > 0 ? ` · ${tally.blank} en blanco` : ''}
      </span>
    </div>
  );
}

export function ExamReportTable({ report }: ExamReportTableProps) {
  const byFlight = new Map<string, LegCheck[]>();
  for (const leg of report.legs) {
    byFlight.set(leg.flightId, [...(byFlight.get(leg.flightId) ?? []), leg]);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tallies}>
        <Tally label="Hora de paso" tally={report.eto} />
        <Tally label="Nivel" tally={report.levelFt} />
        <Tally label="Velocidad" tally={report.gsKt} />
      </div>

      <p className={styles.tolerance}>
        Tolerancia: ±{report.tolerance.etoMin} min en la hora, ±{report.tolerance.levelFt} ft en
        el nivel, ±{report.tolerance.gsKt} kt en la velocidad.
      </p>

      {[...byFlight].map(([flightId, legs]) => (
        <section key={flightId} className={styles.flight}>
          <h4 className={styles.flightName}>{legs[0]?.callsign ?? flightId}</h4>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Punto</th>
                  <th>Hora</th>
                  <th>Nivel</th>
                  <th>GS</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={leg.fix}>
                    <th scope="row" className={styles.fix}>
                      {leg.fix}
                    </th>
                    <Cell check={leg.eto} unit="time" />
                    <Cell check={leg.levelFt} unit="level" />
                    <Cell check={leg.gsKt} unit="speed" />
                    <td className={styles.reference}>
                      {leg.referenceIsAssumed ? (
                        <span
                          className={styles.assumed}
                          title="El nivel se interpoló entre restricciones publicadas, o el vuelo arrastra un supuesto del motor."
                        >
                          supuesta
                        </span>
                      ) : (
                        <span className={styles.published}>publicada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {report.notes.map((note) => (
        <p key={note} className={styles.note}>
          {note}
        </p>
      ))}
    </div>
  );
}
