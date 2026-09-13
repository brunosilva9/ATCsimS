/**
 * Diagrama tiempo x punto, la vista de la planilla BUSES_horario_ver5.
 *
 * Filas = minuto del ejercicio, columnas = vuelo, celda = el fix que cruza ese minuto.
 * Se construye solo con horas, asi que no depende de las 61 coordenadas que faltan en la base.
 *
 * Lo que marca son *coincidencias*: dos vuelos sobre el mismo fix en el mismo minuto. Eso es un
 * hecho, no un juicio de separacion: las minimas en ruta todavia no estan en la base (P-03), y
 * mientras no esten el diagrama senala donde mirar, no si hay perdida.
 */

import { useMemo } from 'react';

import type { Flight, UtcMinutes } from '@atcsims/core';
import { formatHhmm, normalize } from '@atcsims/core';

import styles from './TimeFixDiagram.module.css';

export interface TimeFixDiagramProps {
  readonly flights: readonly Flight[];
  readonly startTime: UtcMinutes;
  readonly durationMin: number;
  /**
   * Marcar las coincidencias. Se apaga en modo prueba: senalar donde mirar es ayudar a
   * resolver, y ahi el alumno tiene que verlo solo.
   */
  readonly showCoincidences?: boolean;
  /**
   * Para imprimir: sin el recorte a 70vh con scroll (`.wrapper` esta pensado para la pantalla,
   * donde un diagrama largo no puede empujar el resto de la pagina). En papel no hay scroll:
   * todas las filas tienen que quedar en el flujo normal para que se corten entre paginas donde
   * corresponda, no adentro de una caja que en la hoja impresa se ve vacia salvo por 70vh.
   */
  readonly printable?: boolean;
}

interface Cell {
  readonly fix: string;
  readonly levelFt: number | null;
  readonly revised: boolean;
}

/** Clave de celda: minuto absoluto + vuelo. */
const key = (minute: number, flightId: string) => `${minute}|${flightId}`;

export function TimeFixDiagram({
  flights,
  startTime,
  durationMin,
  showCoincidences = true,
  printable = false,
}: TimeFixDiagramProps) {
  const { cells, active, coincident } = useMemo(() => {
    const cells = new Map<string, Cell>();
    // Rango de minutos en que cada vuelo esta dentro del ejercicio, para dibujar la linea de ruta.
    const active = new Map<string, { from: number; to: number }>();
    // fix|minuto -> vuelos que lo cruzan
    const atFix = new Map<string, string[]>();

    for (const flight of flights) {
      if (flight.legs.length === 0) continue;
      let from = Infinity;
      let to = -Infinity;

      for (const leg of flight.legs) {
        const minute = normalize(leg.revisedEto ?? leg.eto);
        from = Math.min(from, minute);
        to = Math.max(to, minute);
        cells.set(key(minute, flight.id), {
          fix: leg.fix,
          levelFt: leg.levelFt,
          revised: leg.revisedEto !== null,
        });
        const fixKey = `${leg.fix}|${minute}`;
        atFix.set(fixKey, [...(atFix.get(fixKey) ?? []), flight.id]);
      }
      active.set(flight.id, { from, to });
    }

    const coincident = new Set<string>();
    for (const [fixKey, ids] of atFix) {
      if (ids.length < 2) continue;
      const minute = Number(fixKey.slice(fixKey.indexOf('|') + 1));
      for (const id of ids) coincident.add(key(minute, id));
    }

    return { cells, active, coincident };
  }, [flights]);

  const minutes = Array.from({ length: durationMin + 1 }, (_, i) => normalize(startTime + i));

  return (
    <div className={printable ? styles.wrapperPrintable : styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Diagrama tiempo × punto — {formatHhmm(startTime)} a{' '}
          {formatHhmm(startTime + durationMin)} UTC
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.timeHead}>
              UTC
            </th>
            {flights.map((flight) => (
              <th key={flight.id} scope="col" className={styles.flightHead}>
                <span className={styles.flightCallsign}>{flight.callsign}</span>
                <span className={styles.flightType}>{flight.icaoType}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {minutes.map((minute) => (
            <tr key={minute} className={minute % 5 === 0 ? styles.markRow : undefined}>
              <th scope="row" className={styles.timeCell}>
                {formatHhmm(minute)}
              </th>
              {flights.map((flight) => {
                const cell = cells.get(key(minute, flight.id));
                const span = active.get(flight.id);
                const enRoute = span !== undefined && minute >= span.from && minute <= span.to;
                const classes = [
                  styles.cell,
                  enRoute ? styles.enRoute : '',
                  cell ? styles.atFix : '',
                  showCoincidences && coincident.has(key(minute, flight.id))
                    ? styles.coincident
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <td key={flight.id} className={classes}>
                    {cell ? (
                      <>
                        <span className={cell.revised ? styles.fixRevised : styles.fix}>
                          {cell.fix}
                        </span>
                        {cell.levelFt !== null ? (
                          <span className={styles.level}>
                            {String(Math.round(cell.levelFt / 100)).padStart(3, '0')}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
