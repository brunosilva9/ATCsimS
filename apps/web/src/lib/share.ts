/**
 * Compartir e intercambiar ejercicios sin servidor.
 *
 * Dos formatos, el mismo contenido:
 *
 *   - **Enlace**: el escenario comprimido en el hash de la URL. El instructor copia el enlace y
 *     el alumno lo abre. Nada sale del navegador de ninguno de los dos.
 *   - **Archivo .json**: lo que el alumno descarga al entregar y el instructor vuelve a cargar.
 *     Lleva el escenario Y la lista de instrucciones, que es lo que se corrige.
 *
 * El dia que haya servidor, este archivo es el unico que cambia.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import type { Instruction, Scenario } from '@atcsims/core';

/** Version del formato. Si cambia la forma del escenario, esto sube y se puede migrar. */
export const PAYLOAD_VERSION = 1;

export interface Payload {
  readonly version: number;
  readonly scenario: Scenario;
  readonly instructions: readonly Instruction[];
  /** Quien entrega. Vacio en un enlace del instructor. */
  readonly student?: string;
  readonly submittedAt?: string;
}

export function encodePayload(payload: Payload): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export type DecodeResult =
  | { readonly ok: true; readonly payload: Payload }
  | { readonly ok: false; readonly message: string };

export function decodePayload(encoded: string): DecodeResult {
  const json = decompressFromEncodedURIComponent(encoded);
  if (json === null || json === '') {
    return { ok: false, message: 'El enlace está incompleto o se cortó al copiarlo.' };
  }
  return parsePayload(json);
}

export function parsePayload(json: string): DecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: 'El archivo no es JSON válido.' };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'El archivo no tiene la forma de un ejercicio.' };
  }

  const payload = raw as Partial<Payload>;
  if (payload.scenario === undefined || !Array.isArray(payload.scenario.flights)) {
    return { ok: false, message: 'El archivo no contiene un escenario con vuelos.' };
  }
  if (payload.version !== PAYLOAD_VERSION) {
    return {
      ok: false,
      message:
        `El archivo es de la versión ${String(payload.version)} y esta app lee la ` +
        `${PAYLOAD_VERSION}. Vuelve a exportarlo desde la versión con la que se creó.`,
    };
  }

  return {
    ok: true,
    payload: {
      version: PAYLOAD_VERSION,
      scenario: payload.scenario,
      instructions: payload.instructions ?? [],
      ...(payload.student !== undefined ? { student: payload.student } : {}),
      ...(payload.submittedAt !== undefined ? { submittedAt: payload.submittedAt } : {}),
    },
  };
}

/** Enlace absoluto a la sesion del alumno con el ejercicio dentro. */
export function exerciseLink(payload: Payload): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/exercise?e=${encodePayload(payload)}`;
}

/** Descarga el ejercicio como archivo, que es lo que el alumno entrega. */
export function downloadPayload(payload: Payload, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
