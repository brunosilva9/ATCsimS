/**
 * Las strips en papel.
 *
 * El ejercicio se sigue haciendo sobre la hoja: esta vista existe para imprimir las tiras y que
 * el alumno escriba encima, como en basedatos/referencia.jpeg. Todo lo que no sea la tira
 * desaparece al imprimir.
 */

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { formatHhmm } from '@atcsims/core';

import { FlightProgressStrip } from '../components/FlightProgressStrip.js';
import { decodePayload } from '../lib/share.js';
import { buildSampleScenario } from '../scenarios/sample.js';
import styles from './Print.module.css';

export function Print() {
  const [params] = useSearchParams();
  const encoded = params.get('e');

  const scenario = useMemo(() => {
    if (encoded !== null) {
      const decoded = decodePayload(encoded);
      if (decoded.ok) return decoded.payload.scenario;
    }
    return buildSampleScenario().scenario;
  }, [encoded]);

  useEffect(() => {
    document.title = `${scenario.name} — strips`;
  }, [scenario.name]);

  return (
    <div className={styles.sheet}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.print} onClick={() => window.print()}>
          Imprimir
        </button>
        <span className={styles.hint}>A4 apaisado, sin márgenes de navegador.</span>
      </div>

      <h1 className={styles.title}>
        {scenario.name.toUpperCase()} · {scenario.configuration} · RWY {scenario.runwayInUse} ·{' '}
        {formatHhmm(scenario.startTime)}
      </h1>

      <div className={styles.strips}>
        {scenario.flights.map((flight) => (
          <FlightProgressStrip key={flight.id} flight={flight} variant="APP" />
        ))}
      </div>

      {/* Segunda tanda: la copia del sector siguiente, como en la hoja de referencia. */}
      <h2 className={styles.subtitle}>Sector siguiente</h2>
      <div className={styles.strips}>
        {scenario.flights.map((flight) => (
          <FlightProgressStrip
            key={flight.id}
            flight={flight}
            variant="ACC"
            {...(flight.transferFix !== null ? { fromFix: flight.transferFix } : {})}
          />
        ))}
      </div>
    </div>
  );
}
