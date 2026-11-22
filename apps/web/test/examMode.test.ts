/**
 * Modo prueba por defecto y barra de prueba (N-10).
 */

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { findProcedure, holdings, performance } from '@atcsims/navdata';

import { ExamSession } from '../src/routes/ExamSession.js';
import type { BuildContext } from '../src/scenarios/build.js';
import { emptyDraft, sampleCopy } from '../src/scenarios/drafts.js';
import { SAMPLE_DRAFT, buildSampleScenario } from '../src/scenarios/sample.js';

const ctx: BuildContext = { findProcedure, holdings, performance };

describe('modo con que nace un ejercicio', () => {
  it('un ejercicio nuevo es una prueba', () => {
    const draft = emptyDraft('ej-1');
    expect(draft.mode).toBe('exam');
    expect(draft.id).toBe('ej-1');
    expect(draft.flights).toHaveLength(0);
  });

  it('la copia del ejemplo tambien es una prueba, con sus vuelos marcados como del ejemplo', () => {
    const draft = sampleCopy('ej-2');
    expect(draft.mode).toBe('exam');
    expect(draft.id).toBe('ej-2');
    expect(draft.name).toBe(`${SAMPLE_DRAFT.name} (copia)`);
    expect(draft.flights).toHaveLength(SAMPLE_DRAFT.flights.length);
    expect(draft.flights.every((f) => f.source === 'sample')).toBe(true);
  });

  it('el ejemplo que abre /exercise sin enlace sigue en practica', () => {
    expect(SAMPLE_DRAFT.mode).toBe('practice');
  });
});

describe('barra de prueba', () => {
  const { scenario } = buildSampleScenario(ctx);
  const html = renderToString(
    createElement(ExamSession, { scenario, allowInstructions: false, assumptions: [] })
  );
  const total = scenario.flights.reduce((n, f) => n + Math.max(0, f.legs.length - 1), 0);

  it('rotula el modo y avisa que el sistema no ayuda', () => {
    expect(html).toContain('aria-label="Modo prueba"');
    expect(html).toContain('Modo prueba');
    expect(html).toContain('Sin ayudas del sistema');
  });

  it('lleva el avance y la entrega', () => {
    expect(html).toMatch(new RegExp(`0(<!-- -->)? de (<!-- -->)?${total}`));
    expect(html).toContain('puntos con hora');
    expect(html).toContain('Entregar');
    expect(html).toContain('id="exam-student"');
  });
});
