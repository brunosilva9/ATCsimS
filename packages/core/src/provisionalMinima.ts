/**
 * VALORES PROVISIONALES. NO SON DATO DE ATC.
 * ==========================================
 *
 * Las planillas solo traen minimas de espaciamiento **en aproximacion** (data/separation.json).
 * Las de separacion en ruta —vertical, longitudinal, radar— no estan en ninguna fuente. Es el
 * punto P-03 del informe de revision.
 *
 * Mientras no lleguen, el prototipo usa los valores de abajo, que son los minimos genericos de
 * OACI (Doc 4444) y no los de la dependencia. Estan aqui, en un archivo con este nombre y con
 * este encabezado, por una razon concreta: un alumno podria aprenderse un numero equivocado.
 * Repartidos por el codigo serian invisibles; aqui son imposibles de confundir con dato real.
 *
 * Todo lo que los use tiene que marcar el resultado como provisional: por eso cada valor viaja
 * con su `source`, y `ConflictReport.coverage` vale 'approachOnly' mientras esto siga en uso.
 *
 * CUANDO ATC RESPONDA EL P-03: se reemplazan por la tabla real, se mueven a data/ como el resto
 * y este archivo desaparece.
 */

export const PROVISIONAL_SOURCE = 'Provisional (OACI Doc 4444) — pendiente P-03 con ATC';

export interface Minimum {
  readonly value: number;
  readonly unit: 'NM' | 'MIN';
  readonly source: string;
}

/** Por debajo de esto dos vuelos no estan separados verticalmente. */
export const PROVISIONAL_VERTICAL_FT = 1000;

/** Separacion longitudinal en ruta entre vuelos que siguen la misma derrota. */
export const PROVISIONAL_EN_ROUTE: Minimum = {
  value: 5,
  unit: 'MIN',
  source: PROVISIONAL_SOURCE,
};

/** Separacion radar dentro del TMA cuando hay vigilancia disponible. */
export const PROVISIONAL_RADAR: Minimum = {
  value: 5,
  unit: 'NM',
  source: PROVISIONAL_SOURCE,
};

/** Margen sobre la minima por debajo del cual el caso se marca como justo, no como perdida. */
export const MARGINAL_FACTOR = 1.2;
