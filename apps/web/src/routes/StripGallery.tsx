/**
 * Banco de pruebas de la strip.
 *
 * Muestra la ficha en los estados que tiene en la hoja real, para poder compararla contra
 * basedatos/referencia.jpeg sin montar un ejercicio entero. Las variantes de esta pagina estan
 * fabricadas a mano: sirven para mirar el componente, no son un ejercicio.
 */

import type { Flight, FlightLeg } from '@atcsims/core';

import { FlightProgressStrip } from '../components/FlightProgressStrip.js';
import type { StripLevel } from '../components/FlightProgressStrip.js';
import { buildSampleScenario } from '../scenarios/sample.js';
import { useBuildContext } from '../state/buildContext.js';
import shared from './shared.module.css';
import styles from './StripGallery.module.css';

/** Atrasa la estimada de un fix en adelante, como lo haria una instruccion de velocidad. */
function withRevisedEto(flight: Flight, fromSeq: number, delayMin: number): Flight {
  const legs: FlightLeg[] = flight.legs.map((leg) =>
    leg.seq >= fromSeq ? { ...leg, revisedEto: leg.eto + delayMin } : leg
  );
  return { ...flight, legs };
}

export function StripGallery() {
  const buildCtx = useBuildContext();
  const { scenario } = buildSampleScenario(buildCtx);
  const flight = scenario.flights[0];

  if (!flight) {
    return (
      <div className={shared.page}>
        <p className={shared.note}>No hay vuelos calculables en el escenario de ejemplo.</p>
      </div>
    );
  }

  const reassigned: readonly StripLevel[] = [
    { valueFt: flight.cruiseLevelFt, superseded: true },
    { valueFt: 16000, superseded: false },
  ];

  const cases: readonly { title: string; note: string; node: React.ReactNode }[] = [
    {
      title: 'Impresa',
      note: 'Como sale del sistema, antes de que nadie escriba nada.',
      node: <FlightProgressStrip flight={flight} variant="APP" />,
    },
    {
      title: 'Nivel reasignado',
      note: 'El nivel del plan queda tachado y debajo va el autorizado. No se borra: se tacha.',
      node: <FlightProgressStrip flight={flight} variant="APP" levels={reassigned} />,
    },
    {
      title: 'Estimadas revisadas',
      note: 'Tras una restricción de velocidad en UGOLA: arriba la estimada original tachada, debajo la nueva.',
      node: <FlightProgressStrip flight={withRevisedEto(flight, 4, 2)} variant="APP" />,
    },
    {
      title: 'Tramo ACC, destacada',
      note: 'El sector siguiente recibe su propia ficha. El destacador marca el vuelo del ejercicio.',
      node: (
        <FlightProgressStrip
          flight={flight}
          variant="ACC"
          fromFix="UGOLA"
          route={`${flight.procedureIdent ?? ''} · transfiere APP SCEL`}
          highlighted
        />
      ),
    },
  ];

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Componente</p>
          <h2 className={shared.pageTitle}>La ficha de progreso, estado por estado</h2>
          <p className={shared.lead}>
            La retícula es la de la hoja: identificación, fix anterior con la hora en grande y los
            minutos en exponente, casilla de nivel, casillas de los fixes siguientes y la ruta al
            final. Compárala con <code>basedatos/referencia.jpeg</code>.
          </p>
        </div>
      </header>

      {cases.map((c) => (
        <section key={c.title} className={styles.case}>
          <h3 className={shared.sectionTitle}>{c.title}</h3>
          <p className={shared.note}>{c.note}</p>
          <div className={styles.stage}>{c.node}</div>
        </section>
      ))}
    </div>
  );
}
