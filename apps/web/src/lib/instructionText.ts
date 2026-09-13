/**
 * Como se lee una instruccion.
 *
 * Vive aqui porque la misma linea aparece en cuatro sitios —la sesion de practica, la de
 * prueba y las dos vistas de correccion— y en los cuatro tiene que decir exactamente lo mismo.
 */

import type { Instruction, InstructionKind } from '@atcsims/core';

export const INSTRUCTION_LABEL: Record<InstructionKind, string> = {
  LEVEL_CHANGE: 'Nivel',
  SPEED_RESTRICTION: 'Velocidad',
  HOLD: 'Espera',
  VECTOR: 'Vectores',
  DIRECT: 'Directo',
  TRANSFER: 'Transferencia',
};

/** El cuerpo de la instruccion sin el indicativo: "Nivel a FL100 desde UGOLA". */
export function describeInstruction(instruction: Instruction): string {
  const parts: string[] = [INSTRUCTION_LABEL[instruction.kind] ?? instruction.kind];

  if (instruction.levelFt !== undefined) {
    parts.push(`a FL${Math.round(instruction.levelFt / 100)}`);
  }
  if (instruction.speedKt !== undefined) parts.push(`${instruction.speedKt} kt`);
  if (instruction.holdMinutes !== undefined) parts.push(`${instruction.holdMinutes} min`);
  if (instruction.extraTrackNm !== undefined) parts.push(`+${instruction.extraTrackNm} NM`);
  if (instruction.targetFix !== undefined) parts.push(`a ${instruction.targetFix}`);

  parts.push(
    instruction.fromFix !== null
      ? `desde ${instruction.fromFix}`
      : 'desde el próximo punto'
  );

  return parts.join(' ');
}
