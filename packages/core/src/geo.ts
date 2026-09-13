/**
 * Geometria minima: distancia entre dos fixes.
 *
 * Solo hace falta para una instruccion, el directo: cortar de un punto a otro acorta la ruta y
 * la planilla no tabula esa distancia porque no es parte del procedimiento publicado.
 *
 * 46 de los 107 fixes traen coordenada y 61 no (ver data/README.md). Por eso la funcion
 * devuelve `null` en vez de un numero: quien la llame tiene que decidir que hacer con el hueco,
 * y en este proyecto la decision es negarse a calcular, no estimar.
 */

const EARTH_RADIUS_NM = 3440.065;

export interface Coordinates {
  readonly lat: number | null;
  readonly lon: number | null;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Distancia ortodromica en millas nauticas. `null` si a alguno de los dos puntos le falta la
 * coordenada.
 */
export function distanceNm(from: Coordinates, to: Coordinates): number | null {
  if (from.lat === null || from.lon === null || to.lat === null || to.lon === null) return null;

  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}
