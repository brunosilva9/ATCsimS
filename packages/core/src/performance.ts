/**
 * Consultas sobre la tabla de performance.
 *
 * La tabla dice, para cada nivel, a que velocidad vuela el avion y cuanto desciende por minuto.
 * Es el modelo de vuelo del sistema: la velocidad depende del NIVEL. La tabla comun es la de un
 * jet; turbohelice y piston tienen la suya (N-07, ver `profileFor`), y sobre cualquiera de ellas
 * se aplica el tope de la aeronave (N-06, ver `aircraftSpeedCap`).
 *
 * OJO (P-01 del informe a ATC): el archivo fuente trae tres tablas que no coinciden. Por eso
 * la tabla entra siempre como parametro y nunca se importa aqui dentro.
 */

import type {
  AircraftCategory,
  AircraftType,
  CategoryPerformanceLevel,
  CategoryProfile,
  PerformanceTable,
  PerformanceLevel,
  ProfileCategory,
  SpeedCap,
} from './types.js';

/**
 * El nivel de la tabla que aplica a una altitud dada.
 *
 * La tabla tiene huecos (FL230 y FL210 no traen velocidad) y bandas ("aplica hasta FL180"),
 * asi que se busca el nivel tabulado mas cercano por debajo que si tenga datos de velocidad.
 * Si la altitud queda por encima del primero, se usa el primero.
 */
export function levelFor(table: PerformanceTable, altitudeFt: number): PerformanceLevel {
  const usable = table.filter((l) => l.gsKt !== null || l.nmPerMin !== null);
  if (usable.length === 0) throw new Error('La tabla de performance no trae ninguna velocidad.');

  const sorted = [...usable].sort((a, b) => b.altFt - a.altFt);
  const first = sorted[0]!;
  if (altitudeFt >= first.altFt) return first;

  // El primero cuyo altFt sea <= la altitud pedida.
  for (const level of sorted) {
    if (level.altFt <= altitudeFt) return level;
  }
  return sorted[sorted.length - 1]!;
}

/**
 * Velocidad respecto al suelo a una altitud dada.
 *
 * Sin dato de viento, GS = el valor de la tabla. Cuando gsKt falta pero si hay nmPerMin
 * (pasa en FL150), se deriva. Ver C-04 del informe: las planillas no modelan viento.
 */
export function groundSpeedAt(table: PerformanceTable, altitudeFt: number): number {
  const level = levelFor(table, altitudeFt);
  if (level.gsKt !== null) return level.gsKt;
  if (level.nmPerMin !== null) return Math.round(level.nmPerMin * 60);
  throw new Error(`El nivel ${level.level} no trae ni gsKt ni nmPerMin.`);
}

/**
 * Rango de velocidad de un tipo, solo si esta completo: las dos velocidades cargadas, positivas
 * y en orden. Un tipo a medio cargar (creado para que el ATC lo complete) devuelve undefined y
 * el calculo lo trata como desconocido: una velocidad a medias limitaria con un dato que nadie
 * reviso.
 */
export function speedRangeOf(
  type: AircraftType | undefined
): { readonly minKt: number; readonly maxKt: number } | undefined {
  if (type === undefined) return undefined;
  const { minSpeedKt: min, maxSpeedKt: max } = type;
  if (typeof min !== 'number' || typeof max !== 'number') return undefined;
  if (min <= 0 || max <= 0 || min > max) return undefined;
  return { minKt: min, maxKt: max };
}

/**
 * El tope de velocidad de un vuelo (N-06).
 *
 * La tabla de performance y la GS de planilla describen un jet: sin tope, un DHC6 con TAS de
 * 180 kt volaria una STAR a 360 kt. El tope es la menor entre la TAS del plan de vuelo y la
 * velocidad maxima del tipo, con las que existan: ninguna de las dos se puede superar, y si no
 * coinciden la strip y la base estan en desacuerdo (el editor lo avisa).
 *
 * El tope solo baja la GS, nunca la sube: un jet rapido sigue volando el perfil publicado del
 * procedimiento, que es lo que se espera de el en una llegada o una salida.
 *
 * undefined = no hay ningun dato. Quien llama decide si lo declara como supuesto.
 */
export function aircraftSpeedCap(
  tasKt: number | null | undefined,
  type: AircraftType | undefined
): SpeedCap | undefined {
  const tas = typeof tasKt === 'number' && tasKt > 0 ? tasKt : undefined;
  const max = speedRangeOf(type)?.maxKt;
  if (tas === undefined && max === undefined) return undefined;
  if (max === undefined || (tas !== undefined && tas <= max)) return { kt: tas!, source: 'tas' };
  return { kt: max, source: 'type' };
}

/** La GS del perfil, recortada al tope si lo supera. */
export function capGroundSpeed(profileGsKt: number, capKt: number | undefined): number {
  return capKt !== undefined && profileGsKt > capKt ? capKt : profileGsKt;
}

export const CATEGORY_LABEL: Readonly<Record<AircraftCategory, string>> = {
  jet: 'jet',
  turbohelice: 'turbohélice',
  piston: 'pistón',
};

/**
 * La tabla de una categoria, solo si esta completa: al menos un nivel, y todos con GS y regimen
 * de ascenso. Una tabla a medio cargar devuelve undefined, por el mismo motivo que
 * `speedRangeOf`: mezclar niveles revisados con huecos daria un perfil que nadie valido.
 */
export function categoryProfile(
  category: ProfileCategory,
  levels: readonly CategoryPerformanceLevel[]
): CategoryProfile | undefined {
  const rows = levels.filter((l) => l.category === category);
  if (rows.length === 0) return undefined;
  const complete: CategoryProfile['levels'][number][] = [];
  for (const r of rows) {
    if (typeof r.gsKt !== 'number' || r.gsKt <= 0) return undefined;
    if (typeof r.climbFtPerMin !== 'number' || r.climbFtPerMin <= 0) return undefined;
    complete.push({ level: r.level, altFt: r.altFt, gsKt: r.gsKt, climbFtPerMin: r.climbFtPerMin });
  }
  complete.sort((a, b) => b.altFt - a.altFt);
  return { category, levels: complete };
}

/**
 * Con que tabla vuela un tipo (N-07).
 *
 * - Sin tipo, sin categoria o jet: la tabla comun, sin supuesto. Un tipo sin clasificar no se
 *   declara aqui porque hoy lo serian todos, y un supuesto en cada vuelo marca el ejercicio entero
 *   en la correccion (ver Runs.tsx); el editor lo avisa aparte.
 * - Turbohelice o piston con su tabla completa: esa tabla.
 * - Turbohelice o piston con la tabla incompleta: la de jet, y se declara, porque ahi si se sabe
 *   que el vuelo queda con un perfil que no es el suyo.
 */
export function profileFor(
  type: AircraftType | undefined,
  levels: readonly CategoryPerformanceLevel[]
): { readonly profile?: CategoryProfile; readonly assumption?: string } {
  const category = type?.category;
  if (type === undefined || category === undefined || category === 'jet') return {};
  const profile = categoryProfile(category, levels);
  if (profile !== undefined) return { profile };
  return {
    assumption:
      `La tabla de performance de ${CATEGORY_LABEL[category]} está incompleta en la base: ` +
      `el ${type.icao} se calcula con la de jet.`,
  };
}

/** La tabla de un perfil en la forma que leen `groundSpeedAt` y `verticalRateAt`. */
export function profileTable(profile: CategoryProfile): PerformanceTable {
  return profile.levels.map((l) => ({
    level: l.level,
    altFt: l.altFt,
    iasKt: null,
    gsKt: l.gsKt,
    nmPerMin: null,
    ftPerMin: l.climbFtPerMin,
    note: null,
    fixes: [],
  }));
}

/** Regimen de descenso o ascenso en pies por minuto a una altitud dada. */
export function verticalRateAt(table: PerformanceTable, altitudeFt: number): number {
  const level = levelFor(table, altitudeFt);
  if (level.ftPerMin !== null) return level.ftPerMin;
  // Sin dato, el regimen mas conservador de la tabla: no inventar uno mayor.
  const rates = table.map((l) => l.ftPerMin).filter((v): v is number => v !== null);
  if (rates.length === 0) throw new Error('La tabla de performance no trae regimenes verticales.');
  return Math.min(...rates);
}

/** Altitud a la que el nivel de vuelo o la altitud escrita en la strip corresponde en pies. */
export function toFeet(level: string | number): number {
  if (typeof level === 'number') return level < 1000 ? level * 100 : level;
  const text = level.trim().toUpperCase();
  const flMatch = text.match(/^FL\s*(\d{2,3})$/);
  if (flMatch) return Number(flMatch[1]) * 100;
  const plain = Number(text.replace(/[^\d]/g, ''));
  if (!Number.isFinite(plain)) throw new Error(`Nivel no reconocido: "${level}".`);
  // Las strips escriben "240" por FL240 y "8000" por 8000 pies.
  return plain < 1000 ? plain * 100 : plain;
}
