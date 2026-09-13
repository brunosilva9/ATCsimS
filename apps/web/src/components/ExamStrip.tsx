/**
 * La ficha en blanco: lo que el alumno rellena en una prueba.
 *
 * Misma anatomia que FlightProgressStrip (la ficha calculada de practica), fix por fix: el
 * nombre arriba, borde por debajo, el dato abajo. Antes esto era una `<table>` con una columna
 * "HORA/NIVEL/GS" aparte y una linea de grilla en cada celda — se leia como una planilla de
 * calculo, no como la misma tira de papel. Ahora cada fix es su propia caja, igual que en la
 * calculada, solo que con tres filas en vez de una (hora, nivel y velocidad: los tres datos que
 * pide una prueba) y sin las lineas de grilla entre ellas.
 *
 * Lo que viene dado no se pregunta: el punto de entrada al sector, con su hora, su nivel y su
 * velocidad, es el enunciado del problema. Sale impreso en negro, como en la hoja, con la misma
 * tipografia de hora y de nivel que usa la strip calculada (StripPrimitives).
 *
 * Aqui no hay ni un solo indicio de si va bien. Ni colores, ni avisos, ni recalculo. Es
 * deliberado: el sistema no ayuda a resolver.
 *
 * `entries`/`onChange` son opcionales: sin ellos la ficha sale para PAPEL, no para pantalla.
 * Una casilla interactiva no tiene sentido en una hoja impresa —nadie va a escribirle a un
 * `<input>` con lapiz— y un input vacio a veces imprime su placeholder ("hhmm") segun el
 * navegador, que en papel se leeria como parte del enunciado. Por eso en modo impreso se
 * dibuja un casillero inerte del mismo tamaño, en vez de reusar el input y ocultarlo con CSS.
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

      {given ? (
        <div className={styles.entry}>
          <div className={styles.entryFix}>
            {given.fix}
            <span className={styles.givenTag}>dado</span>
          </div>
          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.rowTag}>H</span>
              <Hhmm time={given.eto} tone="printed" />
            </div>
            <div className={styles.row}>
              <span className={styles.rowTag}>N</span>
              {given.levelFt === null ? '—' : <LevelBadge valueFt={given.levelFt} />}
            </div>
            <div className={styles.row}>
              <span className={styles.rowTag}>V</span>
              <span className={styles.gsValue}>{given.gsKt}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.fixes}>
        {toFill.map((leg) => (
          <div key={leg.seq} className={styles.fixCell}>
            <div className={styles.fixName}>{leg.fix}</div>
            <div className={styles.rows}>
              <div className={styles.row}>
                <span className={styles.rowTag}>H</span>
                {printable ? (
                  <span className={styles.blank} />
                ) : (
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
                )}
              </div>
              <div className={styles.row}>
                <span className={styles.rowTag}>N</span>
                {printable ? (
                  <span className={styles.blank} />
                ) : (
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
                )}
              </div>
              <div className={styles.row}>
                <span className={styles.rowTag}>V</span>
                {printable ? (
                  <span className={styles.blank} />
                ) : (
                  <input
                    id={`gs-${flight.id}-${leg.fix}`}
                    className={styles.cell}
                    inputMode="numeric"
                    placeholder="kt"
                    aria-label={`Velocidad de ${flight.callsign} hasta ${leg.fix}`}
                    defaultValue={entries?.get(leg.fix)?.gsKt?.toString() ?? ''}
                    onChange={(e) => change(leg.fix, { gsKt: toNumber(e.target.value) })}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.route}>{routeLabel}</div>
    </article>
  );
}
