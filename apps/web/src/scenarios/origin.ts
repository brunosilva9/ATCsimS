/**
 * De donde salio el trafico de un ejercicio: elegido a mano (del catalogo de Vuelos de ejemplo,
 * armado con «Vuelo nuevo» o copiado del ejemplo) o sorteado por el generador.
 *
 * Importa porque no se revisan igual: un ejercicio armado a mano ya lo penso alguien; uno
 * generado es un BORRADOR que acierta el numero de encuentros pero no sabe si enseña algo (ver
 * TrafficGenerator.tsx). Y en un banco compartido, quien abre el ejercicio no es siempre quien
 * lo armo.
 */

import type { FlightDraft, FlightSource, ScenarioDraft } from './build.js';

export const SOURCE_LABEL: Readonly<Record<FlightSource, string>> = {
  catalogue: 'Catálogo',
  manual: 'Vuelo nuevo',
  generator: 'Generador',
  sample: 'Ejemplo',
};

/**
 * El origen de un vuelo. Las recetas guardadas antes de que existiera `source` no lo traen y se
 * deduce: si el ejercicio tiene semilla, el generador reemplazo el trafico entero; si no, el
 * indicativo dice si estaba en el catalogo o se armo con «Vuelo nuevo».
 */
export function flightSource(
  flight: FlightDraft,
  draft: ScenarioDraft,
  catalogue: ReadonlySet<string>
): FlightSource {
  if (flight.source !== undefined) return flight.source;
  if (draft.generator !== undefined) return 'generator';
  return catalogue.has(flight.callsign) ? 'catalogue' : 'manual';
}

export type OriginKind = 'generated' | 'hand' | 'mixed' | 'empty';

export interface DraftOrigin {
  readonly kind: OriginKind;
  /** Lo que se lee primero: «Generado automáticamente», «Armado a mano»... */
  readonly label: string;
  /** El desglose: «semilla 7K2Q · 5 del generador», «3 del catálogo, 1 vuelo nuevo». */
  readonly detail: string;
}

const COUNT_TEXT: Readonly<Record<FlightSource, (n: number) => string>> = {
  generator: (n) => `${n} del generador`,
  catalogue: (n) => `${n} del catálogo`,
  sample: (n) => `${n} del ejemplo`,
  manual: (n) => (n === 1 ? '1 vuelo nuevo' : `${n} vuelos nuevos`),
};

const ORDER: readonly FlightSource[] = ['generator', 'catalogue', 'sample', 'manual'];

export function draftOrigin(draft: ScenarioDraft, catalogue: ReadonlySet<string>): DraftOrigin {
  if (draft.flights.length === 0) return { kind: 'empty', label: 'Sin tráfico', detail: '' };

  const counts = new Map<FlightSource, number>();
  for (const f of draft.flights) {
    const source = flightSource(f, draft, catalogue);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  const generated = counts.get('generator') ?? 0;
  const byHand = draft.flights.length - generated;
  const breakdown = ORDER.filter((s) => counts.has(s))
    .map((s) => COUNT_TEXT[s](counts.get(s)!))
    .join(', ');
  const seed = generated > 0 && draft.generator !== undefined ? `semilla ${draft.generator.seed} · ` : '';

  if (byHand === 0) return { kind: 'generated', label: 'Generado automáticamente', detail: seed + breakdown };
  if (generated === 0) return { kind: 'hand', label: 'Armado a mano', detail: breakdown };
  return { kind: 'mixed', label: 'Generado y retocado a mano', detail: seed + breakdown };
}
