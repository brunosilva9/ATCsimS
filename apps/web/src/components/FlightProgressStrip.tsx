/**
 * Ficha de progreso de vuelo (FPV), la "strip".
 *
 * Reproduce la tira de papel de basedatos/referencia.jpeg. La reticula es la misma:
 *
 *   +--------------+---------+-------+-------+-------+-------+--------+
 *   | CALLSIGN     | fix ant |       |       | fix   | fix   |        |
 *   | A: SSR       |     mm  | hora  | nivel +-------+-------+ ruta   |
 *   | TIPO  N0450  |  hh     | sig.  |       | hora  | hora  |        |
 *   | ADEP  ADES   | fix sig |       |       |       |       |        |
 *   +--------------+---------+-------+-------+-------+-------+--------+
 *
 * Lo impreso es lo que genera el sistema; lo que en la hoja va a mano (las estimadas de los
 * fixes siguientes, las reasignaciones de nivel) se dibuja en azul, como el lapiz del
 * instructor. Asi el alumno distingue de un vistazo el dato dado del dato trabajado.
 */

import type { Flight, FlightLeg } from '@atcsims/core';
import { formatHhmm, splitHhmm } from '@atcsims/core';

import styles from './FlightProgressStrip.module.css';

/** Un nivel escrito en la casilla. Los superados van tachados, no borrados. */
export interface StripLevel {
  readonly valueFt: number;
  readonly superseded: boolean;
}

export interface FlightProgressStripProps {
  readonly flight: Flight;
  /** APP trabaja la llegada dentro del TMA; ACC el tramo en ruta. Cambia el rotulo y el ancho. */
  readonly variant: 'APP' | 'ACC';
  /** Primer fix de este sector. Por defecto, el primero del plan. */
  readonly fromFix?: string;
  /** Ultimo fix de este sector, el de transferencia. Por defecto, el ultimo del plan. */
  readonly toFix?: string;
  /** Historial de niveles. Si no se pasa, se muestra el nivel de crucero del plan. */
  readonly levels?: readonly StripLevel[];
  /** Lo que va en la casilla final: aerovia, procedimiento o los fixes fuera del sector. */
  readonly route?: string;
  /** Marcado con destacador, como el EJERCITOC de la hoja. */
  readonly highlighted?: boolean;
}

/** Nivel de vuelo a como se escribe en la strip: 24000 -> "240". */
function levelLabel(valueFt: number): string {
  return String(Math.round(valueFt / 100)).padStart(3, '0');
}

/** La hora como la escribe el controlador: hora grande, minutos en exponente. */
function Hhmm({ time, tone }: { time: number; tone: 'printed' | 'pen' | 'struck' }) {
  const { hours, minutes } = splitHhmm(time);
  return (
    <span className={`${styles.time} ${styles[tone]}`} title={formatHhmm(time)}>
      <span className={styles.timeHours}>{hours}</span>
      <sup className={styles.timeMinutes}>{minutes}</sup>
    </span>
  );
}

export function FlightProgressStrip(props: FlightProgressStripProps) {
  const { flight, variant, highlighted = false } = props;

  const all = flight.legs;
  const start = props.fromFix ? all.findIndex((l) => l.fix === props.fromFix) : 0;
  const endExclusive = props.toFix
    ? all.findIndex((l) => l.fix === props.toFix) + 1
    : all.length;

  // Si el fix pedido no esta en el plan, se muestra el plan entero antes que una strip vacia.
  const legs: readonly FlightLeg[] =
    start >= 0 && endExclusive > start ? all.slice(start, endExclusive) : all;

  const entry = legs[0];
  const next = legs[1];
  const onward = legs.slice(2);

  const levels: readonly StripLevel[] =
    props.levels ?? [{ valueFt: flight.cruiseLevelFt, superseded: false }];

  const route = props.route ?? flight.procedureIdent ?? flight.airway ?? '';

  return (
    <article
      className={`${styles.strip} ${highlighted ? styles.highlighted : ''}`}
      aria-label={`Ficha de progreso de ${flight.callsign}`}
    >
      <div className={styles.ident}>
        <div className={styles.callsign}>
          <span>{flight.callsign}</span>
          <span className={styles.sector}>{variant}</span>
        </div>
        <div className={styles.identRow}>
          <span className={styles.identKey}>A:</span>
          <span className={styles.ssr}>{flight.ssr}</span>
        </div>
        <div className={styles.identRow}>
          <span>{flight.icaoType}</span>
          <span className={styles.tas}>N{String(flight.tasKt).padStart(4, '0')}</span>
        </div>
        <div className={styles.identRow}>
          <span>{flight.adep}</span>
          <span>{flight.ades}</span>
        </div>
      </div>

      <div className={styles.entry}>
        <div className={styles.entryFix}>{entry?.fix ?? '—'}</div>
        <div className={styles.entryTime}>
          {entry ? <Hhmm time={entry.eto} tone="printed" /> : null}
        </div>
        <div className={styles.entryNext}>{next?.fix ?? ''}</div>
      </div>

      <div className={styles.nextTime}>
        {next ? (
          <>
            <Hhmm time={next.eto} tone={next.revisedEto === null ? 'pen' : 'struck'} />
            {next.revisedEto !== null ? <Hhmm time={next.revisedEto} tone="pen" /> : null}
          </>
        ) : null}
      </div>

      <div className={styles.levels}>
        {levels.map((level, i) => (
          <span
            key={`${level.valueFt}-${i}`}
            className={level.superseded ? styles.levelStruck : styles.level}
          >
            {levelLabel(level.valueFt)}
          </span>
        ))}
      </div>

      <div className={styles.onward}>
        {onward.map((leg) => (
          <div key={leg.seq} className={styles.onwardCell}>
            <div className={styles.onwardFix}>{leg.fix}</div>
            <div className={styles.onwardTime}>
              <Hhmm
                time={leg.revisedEto ?? leg.eto}
                tone={leg.revisedEto === null ? 'pen' : 'struck'}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.route}>{route}</div>
    </article>
  );
}
