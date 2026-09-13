/**
 * La ficha en blanco: lo que el alumno rellena en una prueba.
 *
 * A la izquierda va el bloque de identificacion de la strip de siempre, para que se reconozca
 * como la misma ficha. A la derecha, en vez de las horas calculadas, una casilla por punto y
 * por dato: hora, nivel y velocidad.
 *
 * Lo que viene dado no se pregunta: el punto de entrada al sector, con su hora y su nivel, es
 * el enunciado del problema. Sale impreso en negro, como en la hoja.
 *
 * Aqui no hay ni un solo indicio de si va bien. Ni colores, ni avisos, ni recalculo. Es
 * deliberado: el sistema no ayuda a resolver.
 *
 * `entries`/`onChange` son opcionales: sin ellos la ficha sale para PAPEL, no para pantalla.
 * Una casilla interactiva no tiene sentido en una hoja impresa —nadie va a escribirle a un
 * `<input>` con lapiz— y un input vacio a veces imprime su placeholder ("hhmm") segun el
 * navegador, que en papel se leeria como parte del enunciado. Por eso en modo impreso se
 * dibuja un casillero inerte del mismo tamaño, en vez de reusar el input y ocultarlo con CSS.
 *
 * Se ve igual que FlightProgressStrip (la ficha calculada de practica): misma insignia de
 * sector junto al indicativo, misma celda de ruta al final, mismo peso de linea. Practica y
 * prueba son la misma ficha para el alumno; lo unico que cambia es si el numero ya esta puesto
 * o hay que calcularlo.
 */

import { formatHhmm } from '@atcsims/core';
import type { ExamEntry, Flight } from '@atcsims/core';
import { isGiven } from '@atcsims/core';

import { Hhmm, LevelBadge } from './StripPrimitives.js';
import styles from './ExamStrip.module.css';

export interface ExamStripProps {
  readonly flight: Flight;
  /** APP trabaja la llegada dentro del TMA; ACC el tramo en ruta. Igual que en la ficha calculada. */
  readonly variant: 'APP' | 'ACC';
  /** Lo que el alumno lleva escrito, por fix. Ausente = ficha para imprimir, siempre en blanco. */
  readonly entries?: ReadonlyMap<string, ExamEntry>;
  readonly onChange?: (fix: string, patch: Partial<Omit<ExamEntry, 'flightId' | 'fix'>>) => void;
  /** Lo que va en la casilla final: aerovia o procedimiento. Por defecto, el del vuelo. */
  readonly route?: string;
}

/** Texto de la casilla a numero. Vacio o ilegible = sin contestar, que no es lo mismo que cero. */
function toNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** "1114" o "11:14" a minutos desde medianoche. null mientras esta a medio escribir. */
function toMinutes(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function ExamStrip({ flight, variant, entries, onChange, route }: ExamStripProps) {
  const given = flight.legs.find((l) => isGiven(l.seq));
  const toFill = flight.legs.filter((l) => !isGiven(l.seq));

  // Sin onChange, la ficha es para imprimir: no hay casillas interactivas que llenar en React,
  // asi que esta funcion nunca llega a invocarse. Existe solo para no repetir el `if (onChange)`
  // tres veces, una por fila.
  const printable = onChange === undefined;
  const change = onChange ?? (() => undefined);
  const routeLabel = route ?? flight.procedureIdent ?? flight.airway ?? '';

  return (
    <article className={styles.strip} aria-label={`Ficha en blanco de ${flight.callsign}`}>
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

      <table className={styles.grid}>
        <thead>
          <tr>
            <th scope="col" className={styles.rowHead} />
            {given ? (
              <th scope="col" className={styles.givenHead}>
                {given.fix}
                <span className={styles.givenTag}>dado</span>
              </th>
            ) : null}
            {toFill.map((leg) => (
              <th key={leg.seq} scope="col" className={styles.fixHead}>
                {leg.fix}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className={styles.rowHead}>
              Hora
            </th>
            {given ? (
              <td className={styles.given}>
                <Hhmm time={given.eto} tone="printed" />
              </td>
            ) : null}
            {toFill.map((leg) =>
              printable ? (
                <td key={leg.seq}>
                  <span className={styles.blank} />
                </td>
              ) : (
                <td key={leg.seq}>
                  <input
                    id={`eto-${flight.id}-${leg.fix}`}
                    className={styles.cell}
                    inputMode="numeric"
                    placeholder="hhmm"
                    aria-label={`Hora de paso de ${flight.callsign} por ${leg.fix}`}
                    defaultValue={
                      entries?.get(leg.fix)?.eto != null
                        ? formatHhmm(entries.get(leg.fix)!.eto!)
                        : ''
                    }
                    onChange={(e) => change(leg.fix, { eto: toMinutes(e.target.value) })}
                  />
                </td>
              )
            )}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHead}>
              Nivel
            </th>
            {given ? (
              <td className={styles.given}>
                {given.levelFt === null ? '—' : <LevelBadge valueFt={given.levelFt} />}
              </td>
            ) : null}
            {toFill.map((leg) =>
              printable ? (
                <td key={leg.seq}>
                  <span className={styles.blank} />
                </td>
              ) : (
                <td key={leg.seq}>
                  <input
                    id={`lvl-${flight.id}-${leg.fix}`}
                    className={styles.cell}
                    inputMode="numeric"
                    placeholder="FL"
                    aria-label={`Nivel de ${flight.callsign} sobre ${leg.fix}`}
                    defaultValue={
                      entries?.get(leg.fix)?.levelFt != null
                        ? String(Math.round(entries.get(leg.fix)!.levelFt! / 100))
                        : ''
                    }
                    onChange={(e) => {
                      const fl = toNumber(e.target.value);
                      change(leg.fix, { levelFt: fl === null ? null : fl * 100 });
                    }}
                  />
                </td>
              )
            )}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHead}>
              GS
            </th>
            {given ? (
              <td className={styles.given}>
                <span className={styles.gsValue}>{given.gsKt}</span>
              </td>
            ) : null}
            {toFill.map((leg) =>
              printable ? (
                <td key={leg.seq}>
                  <span className={styles.blank} />
                </td>
              ) : (
                <td key={leg.seq}>
                  <input
                    id={`gs-${flight.id}-${leg.fix}`}
                    className={styles.cell}
                    inputMode="numeric"
                    placeholder="kt"
                    aria-label={`Velocidad de ${flight.callsign} hasta ${leg.fix}`}
                    defaultValue={entries?.get(leg.fix)?.gsKt?.toString() ?? ''}
                    onChange={(e) => change(leg.fix, { gsKt: toNumber(e.target.value) })}
                  />
                </td>
              )
            )}
          </tr>
        </tbody>
      </table>

      <div className={styles.route}>{routeLabel}</div>
    </article>
  );
}
