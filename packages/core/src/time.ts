/**
 * Horas del ejercicio. Se guardan como minutos desde medianoche UTC porque las strips
 * trabajan en HHMM y un ejercicio nunca cruza un huso horario.
 */

import type { UtcMinutes } from './types.js';

const MINUTES_PER_DAY = 24 * 60;

/** "1125" o "11:25" -> 685. Lanza si el formato no es reconocible. */
export function parseHhmm(text: string): UtcMinutes {
  const m = text.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) throw new Error(`Hora no reconocida: "${text}". Se espera HHMM o HH:MM.`);
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Hora fuera de rango: "${text}".`);
  return hours * 60 + minutes;
}

/** 685 -> "1125". Es como se escribe en la strip. */
export function formatHhmm(time: UtcMinutes): string {
  const t = normalize(time);
  const hours = Math.floor(t / 60);
  const minutes = t % 60;
  return String(hours).padStart(2, '0') + String(minutes).padStart(2, '0');
}

/** 685 -> { hours: "11", minutes: "25" }. La strip escribe la hora grande y los minutos arriba. */
export function splitHhmm(time: UtcMinutes): { hours: string; minutes: string } {
  const text = formatHhmm(time);
  return { hours: text.slice(0, 2), minutes: text.slice(2) };
}

/** Envuelve al dia para que un ejercicio que pasa medianoche no de horas negativas. */
export function normalize(time: UtcMinutes): UtcMinutes {
  return ((Math.round(time) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Diferencia en minutos entre dos horas, tomando el camino corto del reloj.
 * Devuelve siempre un valor positivo: para conflictos solo importa cuanto se separan.
 */
export function gapMinutes(a: UtcMinutes, b: UtcMinutes): number {
  const diff = Math.abs(normalize(a) - normalize(b));
  return Math.min(diff, MINUTES_PER_DAY - diff);
}

/** Tiempo en minutos para recorrer una distancia a una velocidad dada. */
export function minutesFor(distanceNm: number, groundSpeedKt: number): number {
  if (groundSpeedKt <= 0) throw new Error(`Velocidad invalida: ${groundSpeedKt} kt.`);
  return (distanceNm / groundSpeedKt) * 60;
}
