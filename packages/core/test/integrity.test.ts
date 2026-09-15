import { describe, expect, it } from 'vitest';

import { checkIntegrity, newIssues } from '../src/integrity.js';
import type { IntegrityDataset } from '../src/integrity.js';
import type { Fix, HoldingPattern, Procedure, SeparationMinimum } from '../src/types.js';

function fix(ident: string): Fix {
  return {
    id: null,
    ident,
    name: ident,
    type: 'WAYPOINT',
    lat: null,
    lon: null,
    elevationFt: null,
    scope: 'TMA',
    meaFt: null,
    mclFt: null,
  };
}

function baseDataset(): IntegrityDataset {
  return {
    fixes: [fix('AAA'), fix('BBB'), fix('CCC')],
    procedures: [
      {
        ident: 'TEST1',
        type: 'STAR',
        runway: '17L',
        configuration: 'SUR',
        requiresSivigats: false,
        entryFix: 'AAA',
        exitFix: 'CCC',
        totalDistNm: 20,
        legs: [
          { seq: 1, fix: 'AAA', distToEndNm: 20, legDistNm: null },
          { seq: 2, fix: 'BBB', distToEndNm: 10, legDistNm: 10 },
          { seq: 3, fix: 'CCC', distToEndNm: 0, legDistNm: 10 },
        ],
      } satisfies Procedure,
    ],
    airways: [],
    holdings: [{ fix: 'CCC', lowerLevelFt: 5000, upperLevelFt: 10000, mclFt: null, note: null }],
    performance: [],
    separation: [
      { runway: '17L', sivigats: false, withDepartures: true, lvp: false, value: 5, unit: 'MIN' },
    ],
  };
}

describe('checkIntegrity', () => {
  it('no reporta nada sobre una base sana', () => {
    expect(checkIntegrity(baseDataset()).filter((i) => i.level === 'fail')).toEqual([]);
  });

  it('detecta un leg que referencia un fix inexistente', () => {
    const dataset = baseDataset();
    const bad: Procedure = {
      ...dataset.procedures[0]!,
      legs: [...dataset.procedures[0]!.legs, { seq: 4, fix: 'ZZZ', distToEndNm: -5, legDistNm: 5 }],
    };
    const issues = checkIntegrity({ ...dataset, procedures: [bad] });
    expect(issues.some((i) => i.level === 'fail' && i.message.includes('ZZZ'))).toBe(true);
  });

  it('detecta que la distancia restante no decrece', () => {
    const dataset = baseDataset();
    const bad: Procedure = {
      ...dataset.procedures[0]!,
      legs: [
        { seq: 1, fix: 'AAA', distToEndNm: 20, legDistNm: null },
        { seq: 2, fix: 'BBB', distToEndNm: 25, legDistNm: 10 }, // sube en vez de bajar
        { seq: 3, fix: 'CCC', distToEndNm: 0, legDistNm: 10 },
      ],
    };
    const issues = checkIntegrity({ ...dataset, procedures: [bad] });
    expect(issues.some((i) => i.level === 'fail' && i.message.includes('no decrece'))).toBe(true);
  });

  it('detecta un holding con el nivel inferior por encima del superior', () => {
    const dataset = baseDataset();
    const bad: HoldingPattern = { fix: 'CCC', lowerLevelFt: 15000, upperLevelFt: 10000, mclFt: null, note: null };
    const issues = checkIntegrity({ ...dataset, holdings: [bad] });
    expect(issues.some((i) => i.level === 'fail' && i.message.includes('holding CCC'))).toBe(true);
  });

  it('detecta una tupla de separation duplicada', () => {
    const dataset = baseDataset();
    const dup: SeparationMinimum = { ...dataset.separation[0]! };
    const issues = checkIntegrity({ ...dataset, separation: [dataset.separation[0]!, dup] });
    expect(issues.some((i) => i.level === 'fail' && i.message.includes('duplicada'))).toBe(true);
  });
});

describe('newIssues', () => {
  it('no marca como nuevo un problema que ya existia antes del cambio', () => {
    const dataset = baseDataset();
    const dup: SeparationMinimum = { ...dataset.separation[0]! };
    const withDup = { ...dataset, separation: [dataset.separation[0]!, dup] };

    const before = checkIntegrity(withDup);
    const after = checkIntegrity(withDup); // "el mismo" cambio, nada nuevo
    expect(newIssues(before, after, 'fail')).toEqual([]);
  });

  it('marca como nuevo un problema que el cambio introdujo', () => {
    const dataset = baseDataset();
    const before = checkIntegrity(dataset);

    const bad: Procedure = {
      ...dataset.procedures[0]!,
      legs: [...dataset.procedures[0]!.legs, { seq: 4, fix: 'ZZZ', distToEndNm: -5, legDistNm: 5 }],
    };
    const after = checkIntegrity({ ...dataset, procedures: [bad] });

    const fresh = newIssues(before, after, 'fail');
    expect(fresh.some((i) => i.message.includes('ZZZ'))).toBe(true);
  });
});
