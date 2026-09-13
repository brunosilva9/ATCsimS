/**
 * Escenario de ejemplo: cuatro llegadas convergiendo a TEGEB y una salida.
 *
 * Esta armado a mano, como los arma hoy el instructor. Lo unico que no se escribe a mano son
 * las horas: salen del motor, igual que en el ejercicio real.
 *
 * Las cuatro llegadas comparten la cola UGOLA > EL220 > PUMAR > TEGEB, asi que el diagrama
 * muestra por que un ejercicio de APP es un problema de secuencia y no de rutas. LAN705 y
 * SKU621 estan puestos a proposito sobre los mismos puntos al mismo minuto: es el conflicto
 * que el alumno tiene que resolver. Los otros dos van espaciados, para que se vea la
 * diferencia entre un par que hay que separar y uno que ya lo esta.
 */

import { parseHhmm } from '@atcsims/core';

import { buildScenario } from './build.js';
import type { BuiltScenario, ScenarioDraft } from './build.js';

export const SAMPLE_DRAFT: ScenarioDraft = {
  id: 'sample-tegeb',
  name: 'Secuencia a TEGEB — cuatro llegadas y una salida',
  configuration: 'SUR',
  runwayInUse: '17L',
  sivigats: true,
  objective:
    'Secuenciar cuatro llegadas que comparten la cola UGOLA › EL220 › PUMAR › TEGEB y ' +
    'coordinar la salida sin perder el espaciamiento en aproximación.',
  weather: {
    qnhHpa: 1014,
    transitionLevel: 'FL150',
    vmc: true,
    visibilityM: 9999,
    ceilingFt: null,
    lvp: false,
  },
  flights: [
    {
      id: 'f1', callsign: 'LAN705', ssr: '2506', icaoType: 'A320', registration: null,
      tasKt: 440, adep: 'SCFA', ades: 'SCEL', kind: 'ARRIVAL',
      procedureIdent: 'UMKAL7C', entryTime: parseHhmm('1100'), levelFl: 240,
    },
    {
      id: 'f2', callsign: 'LXP903', ssr: '4341', icaoType: 'A321', registration: null,
      tasKt: 450, adep: 'SCIE', ades: 'SCEL', kind: 'ARRIVAL',
      procedureIdent: 'SIMOK7B', entryTime: parseHhmm('1050'), levelFl: 260,
    },
    {
      id: 'f3', callsign: 'CCPVE', ssr: '5060', icaoType: 'B738', registration: null,
      tasKt: 450, adep: 'SAEZ', ades: 'SCEL', kind: 'ARRIVAL',
      procedureIdent: 'EROLO7F', entryTime: parseHhmm('1050'), levelFl: 280,
    },
    {
      id: 'f4', callsign: 'SKU621', ssr: '3355', icaoType: 'A319', registration: null,
      tasKt: 430, adep: 'SCVM', ades: 'SCEL', kind: 'ARRIVAL',
      procedureIdent: 'VENTANAS1D', entryTime: parseHhmm('1103'), levelFl: 200,
    },
    {
      id: 'f5', callsign: 'DSM142', ssr: '5427', icaoType: 'DH8D', registration: null,
      tasKt: 360, adep: 'SCEL', ades: 'SCSE', kind: 'DEPARTURE',
      procedureIdent: 'ANGOD8B', entryTime: parseHhmm('1105'), levelFl: 230,
    },
  ],
};

export function buildSampleScenario(): BuiltScenario {
  return buildScenario(SAMPLE_DRAFT);
}

export type { BuiltScenario, FlightAssumption, RejectedFlight } from './build.js';
