/**
 * La strip tenia dos problemas en la misma zona del componente, encontrados juntos al revisar
 * uno reportado con una captura: el segundo fix vivia partido en dos casillas (su nombre pegado
 * al fix de entrada, su hora sola al lado), y las casillas siguientes, al revisarse una
 * estimada, mostraban solo la hora NUEVA tachada en vez de la original tachada y la nueva en
 * limpio debajo. Este archivo fija el comportamiento correcto para que ninguno de los dos
 * vuelva sin que un test lo note.
 */

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { formatHhmm } from '@atcsims/core';

import { FlightProgressStrip } from '../src/components/FlightProgressStrip.js';
import { buildSampleScenario } from '../src/scenarios/sample.js';

const { scenario } = buildSampleScenario();
const flight = scenario.flights.find((f) => f.callsign === 'LAN705')!; // UMKAL7C

const render = (f: typeof flight) =>
  renderToString(createElement(FlightProgressStrip, { flight: f, variant: 'APP' }));

describe('FlightProgressStrip — el segundo fix', () => {
  it('el segundo fix (LOSAN) usa la misma casilla nombre+hora que los que le siguen', () => {
    const html = render(flight);
    const losanBox = html.slice(html.indexOf('_nextTime_'), html.indexOf('_nextTime_') + 400);
    expect(losanBox).toContain('LOSAN');
    // Antes vivia en su propia clase (.entryNext / caja separada sin nombre); ahora comparte
    // la misma casilla que SAFEL, UGOLA, etc.
    expect(losanBox).toContain('_onwardFix_');
    expect(losanBox).toContain('_onwardTime_');
  });

  it('ya no existe una casilla .entryNext separada', () => {
    const html = render(flight);
    expect(html).not.toContain('_entryNext_');
  });
});

describe('FlightProgressStrip — el nivel va pegado a la entrada', () => {
  it('el orden es: fix de entrada, su nivel, y recien despues el fix siguiente', () => {
    const html = render(flight);
    const iEntry = html.indexOf('UMKAL');
    const iLevel = html.indexOf('_level_');
    const iNext = html.indexOf('LOSAN');
    expect(iEntry).toBeGreaterThan(-1);
    expect(iEntry).toBeLessThan(iLevel);
    expect(iLevel).toBeLessThan(iNext);
  });

  it('sin `levels` explicito, muestra el nivel YA CALCULADO en la entrada, no el crucero pedido', () => {
    // UMKAL7C exige 24000 ft sobre UMKAL sea cual sea el crucero con que se armo el vuelo: si
    // alguien lo arma a FL320, la entrada real sigue siendo FL240, y es eso lo que tiene que
    // decir la casilla — no el 320 que se pidio y que el procedimiento no deja usar ahi.
    const withMismatchedCruise = { ...flight, cruiseLevelFt: 32000 };
    const html = render(withMismatchedCruise);
    expect(flight.legs[0]!.fix).toBe('UMKAL');
    expect(flight.legs[0]!.levelFt).toBe(24000); // el nivel real que calculo el motor
    const level = html.match(/_level_[^"]*">(\d+)</)?.[1];
    expect(level).toBe('240');
    expect(level).not.toBe('320');
  });
});

describe('FlightProgressStrip — estimada revisada', () => {
  const revised = {
    ...flight,
    legs: flight.legs.map((leg) => (leg.seq >= 3 ? { ...leg, revisedEto: leg.eto + 2 } : leg)),
  };

  it('muestra la original tachada Y la nueva, no solo la nueva tachada', () => {
    const html = render(revised);
    const safel = revised.legs.find((l) => l.fix === 'SAFEL')!;

    const box = html.slice(html.indexOf('SAFEL'), html.indexOf('SAFEL') + 500);
    // Las dos horas concretas tienen que estar: la que ya se habia dado y la que la reemplaza.
    expect(box).toContain(`title="${formatHhmm(safel.eto)}"`);
    expect(box).toContain(`title="${formatHhmm(safel.revisedEto!)}"`);

    // La original va tachada (struck): ese tono no se toca aunque se revise, es la evidencia
    // de que hubo un cambio.
    const struckIndex = box.indexOf('_struck_');
    const penIndex = box.indexOf('_pen_');
    expect(struckIndex).toBeGreaterThan(-1);
    expect(penIndex).toBeGreaterThan(-1);
    // La tachada va PRIMERO (arriba), la nueva DESPUES (debajo): asi se lee de arriba hacia
    // abajo como "esto se dijo, esto vale ahora".
    expect(struckIndex).toBeLessThan(penIndex);
  });

  it('sin revisar, se muestra una sola hora, en tono pen', () => {
    const html = render(flight); // sin revisedEto en ningun leg
    const box = html.slice(html.indexOf('SAFEL'), html.indexOf('SAFEL') + 400);
    expect(box).toContain('_pen_');
    expect(box).not.toContain('_struck_');
  });

  it('el fix de entrada siempre en tono impreso (dado), nunca en pen ni struck', () => {
    const html = render(revised);
    const entryBox = html.slice(html.indexOf('_entryTime_'), html.indexOf('_entryTime_') + 200);
    expect(entryBox).toContain('_printed_');
    expect(entryBox).not.toContain('_pen_');
    expect(entryBox).not.toContain('_struck_');
  });
});
