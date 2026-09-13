/**
 * Ficha de progreso de vuelo (FPV), la "strip".
 *
 * Reproduce la tira de papel de basedatos/referencia.jpeg. La reticula es la misma:
 *
 *   +--------------+---------+-------+-------+-------+-------+--------+
 *   | CALLSIGN     | fix ant | nivel |  fix  |  fix  |  fix  |        |
 *   | A: SSR       |    hora |  de   | sig.  |       |       | ruta   |
 *   | TIPO  N0450  |         |entrada| hora  | hora  | hora  |        |
 *   | ADEP  ADES   |         |       |       |       |       |        |
 *   +--------------+---------+-------+-------+-------+-------+--------+
 *
 * El nivel va pegado al fix de entrada, a su derecha: es el nivel AL QUE SE ENTRA (o al que
 * sale, en una salida), no un numero suelto en medio de la fila. Recien despues vienen los
 * fixes siguientes, que se leen de izquierda a derecha en el orden en que se cruzan.
 *
 * Cada casilla de fix, de la segunda en adelante, es igual: el nombre arriba, la hora abajo.
 *
 * Lo impreso es lo que genera el sistema; lo que en la hoja va a mano (las estimadas de los
 * fixes siguientes, las reasignaciones de nivel) se dibuja en azul, como el lapiz del
 * instructor. Asi el alumno distingue de un vistazo el dato dado del dato trabajado.
 */

import type { Flight, FlightLeg } from '@atcsims/core';
import { formatHhmm } from '@atcsims/core';

import { Hhmm, LevelBadge } from './StripPrimitives.js';
import styles from './FlightProgressStrip.module.css';

/** De donde salio la GS de un tramo, en el mismo orden de precedencia que el motor. */
function gsProvenance(leg: FlightLeg): string {
  if (leg.assignedSpeedKt !== null) return 'velocidad asignada';
  if (leg.sourceGsKt !== null) return 'GS de planilla';
  return 'GS de la tabla de performance';
}

/**
 * Como se llego a la hora de un tramo, para el tooltip. Solo tiene sentido cuando los campos
 * del tramo (legDistNm, gsKt, legTimeMin) todavia describen ese numero: tras una instruccion
 * quedan pisados con los del recalculo (ver instructions.ts, recomputeFrom), asi que este
 * detalle solo se pide para la hora VIGENTE, nunca para la tachada.
 */
function fixDetail(leg: FlightLeg, prevFix: string, prevEto: number, eto: number): string {
  const distPart =
    leg.legDistNm > 0
      ? `${leg.legDistNm.toFixed(1)} NM ÷ ${leg.gsKt} kt (${gsProvenance(leg)}) = ` +
        `${leg.legTimeMin.toFixed(1)} min`
      : 'sin tramo que recorrer';
  const delayPart = leg.delayMin > 0 ? ` + ${leg.delayMin} min de espera en ${leg.fix}` : '';
  return `${prevFix} ${formatHhmm(prevEto)} + ${distPart}${delayPart} → ${formatHhmm(eto)}`;
}

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
  /** Historial de niveles. Si no se pasa, se muestra el nivel calculado en el fix de entrada. */
  readonly levels?: readonly StripLevel[];
  /** Lo que va en la casilla final: aerovia, procedimiento o los fixes fuera del sector. */
  readonly route?: string;
  /** Marcado con destacador, como el EJERCITOC de la hoja. */
  readonly highlighted?: boolean;
}

/**
 * Una casilla de fix: el nombre arriba, la hora abajo. Es el mismo trato para el segundo fix
 * y para todos los que le siguen — antes el segundo vivia partido en dos cajas (el nombre
 * pegado al fix de entrada, la hora sola en la caja de al lado), que es dificil de leer porque
 * no queda claro que las dos cosas son del mismo punto.
 *
 * Cuando una instruccion revisa la estimada, se muestran las DOS: la original tachada arriba,
 * la nueva en azul debajo — nunca solo la nueva tachada, que borraria justo el dato que hay
 * que conservar a la vista (la estimada que se dio, para que se note que cambio).
 */
function FixCell({
  leg,
  prevFix,
  prevEto,
  className,
}: {
  leg: FlightLeg;
  prevFix: string;
  prevEto: number;
  className?: string | undefined;
}) {
  const activeEto = leg.revisedEto ?? leg.eto;
  return (
    <div className={className}>
      <div className={styles.onwardFix}>{leg.fix}</div>
      <div className={styles.onwardTime}>
        <Hhmm
          time={leg.eto}
          tone={leg.revisedEto === null ? 'pen' : 'struck'}
          detail={leg.revisedEto === null ? fixDetail(leg, prevFix, prevEto, activeEto) : undefined}
        />
        {leg.revisedEto !== null ? (
          <Hhmm time={leg.revisedEto} tone="pen" detail={fixDetail(leg, prevFix, prevEto, activeEto)} />
        ) : null}
      </div>
    </div>
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
  // Cada fix de ahi en adelante necesita el anterior para explicar como se llego a su hora.
  const chain = legs.slice(1).map((leg, i) => ({ leg, prev: legs[i]! }));
  const next = chain[0];
  const onward = chain.slice(1);

  /*
   * Sin `levels` explicito, el numero es el nivel YA CALCULADO en el fix de entrada — no
   * `flight.cruiseLevelFt` a secas. Un procedimiento puede forzar la entrada a un nivel
   * distinto del pedido (UMKAL7C exige 24000 sobre UMKAL sea cual sea el nivel de crucero que
   * se haya puesto al armar el vuelo); mostrar el pedido en vez del real diria un numero que
   * el propio motor ya sabe que no es el que rige ahi.
   */
  const levels: readonly StripLevel[] =
    props.levels ?? [{ valueFt: entry?.levelFt ?? flight.cruiseLevelFt, superseded: false }];

  // Igual que con la hora: el detalle solo se puede dar cuando el nivel es el que calcula el
  // motor por defecto. Con `levels` explicito (historial de reasignaciones) no hay restriccion
  // que citar, asi que no se inventa una.
  const levelDetail =
    props.levels === undefined && entry
      ? entry.restriction !== null
        ? `Restriccion publicada en ${entry.fix}: ${entry.restriction}.`
        : `${entry.fix}: sin restriccion publicada en la base; se mantiene el nivel de crucero pedido.`
      : undefined;

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
      </div>

      <div className={styles.levels} title={levelDetail}>
        {levels.map((level, i) => (
          <LevelBadge key={`${level.valueFt}-${i}`} valueFt={level.valueFt} superseded={level.superseded} />
        ))}
      </div>

      {next ? (
        <FixCell
          leg={next.leg}
          prevFix={next.prev.fix}
          prevEto={next.prev.revisedEto ?? next.prev.eto}
          className={styles.nextTime}
        />
      ) : (
        <div className={styles.nextTime} />
      )}

      <div className={styles.onward}>
        {onward.map(({ leg, prev }) => (
          <FixCell
            key={leg.seq}
            leg={leg}
            prevFix={prev.fix}
            prevEto={prev.revisedEto ?? prev.eto}
            className={styles.onwardCell}
          />
        ))}
      </div>

      <div className={styles.route}>{route}</div>
    </article>
  );
}
