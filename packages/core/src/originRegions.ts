/**
 * CORREDORES DE LLEGADA. NO ES DATO DE LA PLANILLA.
 * ===================================================
 *
 * `Procedure.entryAirways` (de la hoja CIRC-STAR-SID) dice que aerovia real alimenta cada STAR.
 * Eso SI es dato de ATC. Lo que sigue —de que direccion del mundo viene esa aerovia, y a que
 * region pertenece el aeropuerto de origen de un vuelo— no esta en ninguna planilla de TMA
 * Santiago y nunca lo va a estar: es geografia de ruteo internacional, no algo que describa el
 * espacio aereo local. Es dato real y publico (lo confirma cualquier carta AIP o el propio
 * controlador al toque), pero no sale de ningun Excel de ATC Chile.
 *
 * Se usa solo para que el generador de trafico (generator.ts) no le asigne a una llegada una
 * STAR de un corredor geograficamente imposible — un vuelo que entra desde Europa jamas por una
 * STAR que solo alimenta una aerovia trasandina. Nunca para bloquear ni para el editor manual:
 * ahi el instructor puede seguir armando cualquier combinacion a mano.
 *
 * Si algo de esto esta mal, se corrige esta tabla. No hay ninguna planilla donde ir a buscarlo.
 *
 * PENDIENTE: `UL322`/`UM799`/`UM529` (ASIMO7D) y `L405` (UMKAL7C) quedan sin region a propósito
 * — falta confirmar con un controlador antes de asignarles una. Lo mismo con `SB`/`SK` en la
 * tabla de prefijos ICAO: son los mas dudosos de esta primera pasada.
 */

import type { Procedure } from './types.js';

export type ArrivalRegion = 'NORTE' | 'ESTE' | 'SUR';

/** Solo las aerovias que ya aparecen en `entryAirways` de alguna STAR de SCEL. */
export const AIRWAY_REGION: Readonly<Partial<Record<string, ArrivalRegion>>> = {
  UQ802: 'NORTE', // EROLO6E/7F/8A — corredor costero norte (ELABA/ENSER/CHI/BOLOK)
  UQ808: 'NORTE',
  UQ810: 'NORTE',
  UV200: 'NORTE', // VENTANAS1D, via OPTAN
  UT200: 'NORTE',
  UL302: 'ESTE', // SIMOK7B — trasandino, via Argentina (MORMI/OGROS/ARSUS)
  UQ803: 'ESTE',
  UV208: 'ESTE', // ANDES1
  V551: 'ESTE',
  T112: 'ESTE',
  UV204: 'ESTE',
  // UL322, UM799, UM529 (ASIMO7D) y L405 (UMKAL7C): pendiente confirmar con el controlador.
};

/**
 * Prefijo ICAO del aeropuerto de origen -> region. Coincidencia por el prefijo mas largo
 * conocido (2 letras) antes que por el mas corto (1 letra), porque "S" solo alcanza para decir
 * "Sudamerica" y ahi adentro cada pais entra por un corredor distinto.
 */
export const ICAO_PREFIX_REGION: Readonly<Partial<Record<string, ArrivalRegion>>> = {
  K: 'NORTE', // Estados Unidos (CONUS)
  C: 'NORTE', // Canada
  M: 'NORTE', // Centroamerica y Mexico
  E: 'NORTE', // Europa (Reino Unido, Alemania, Holanda...)
  L: 'NORTE', // Europa del sur (España, Francia, Italia...)
  O: 'NORTE', // Medio Oriente
  SA: 'ESTE', // Argentina — trasandino
  SB: 'ESTE', // Brasil — via este, cruzando Argentina
  // SC (Chile) se deja fuera a proposito: vuelo domestico, no aplica un corredor internacional.
  // SK (Colombia): pendiente confirmar si entra por el norte (costa) o por el este.
};

/** Region de un origen, o null si no se conoce (domestico o prefijo sin mapear). */
export function regionForIcao(icao: string): ArrivalRegion | null {
  const code = icao.toUpperCase();
  return ICAO_PREFIX_REGION[code.slice(0, 2)] ?? ICAO_PREFIX_REGION[code.slice(0, 1)] ?? null;
}

/** Las regiones que alimentan una STAR, segun sus `entryAirways`. Vacio = sin corredor conocido. */
export function starRegions(procedure: Procedure): ReadonlySet<ArrivalRegion> {
  const regions = (procedure.entryAirways ?? [])
    .map((airway) => AIRWAY_REGION[airway])
    .filter((region): region is ArrivalRegion => region !== undefined);
  return new Set(regions);
}
