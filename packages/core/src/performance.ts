/**
 * Consultas sobre la tabla de performance.
 *
 * La tabla dice, para cada nivel, a que velocidad vuela el avion y cuanto desciende por minuto.
 * Es el modelo de vuelo del sistema: la velocidad depende del NIVEL, no del tipo de aeronave.
 *
 * OJO (P-01 del informe a ATC): el archivo fuente trae tres tablas que no coinciden. Por eso
 * la tabla entra siempre como parametro y nunca se importa aqui dentro.
 */

import type { PerformanceTable, PerformanceLevel } from './types.js';

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
