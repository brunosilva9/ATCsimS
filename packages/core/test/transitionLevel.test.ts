import { describe, expect, it } from 'vitest';

import { transitionLevelFor } from '../src/transitionLevel.js';

describe('transitionLevelFor', () => {
  it('FL110 con QNH estandar o mas alto', () => {
    expect(transitionLevelFor(1013)).toBe('FL110');
    expect(transitionLevelFor(1020)).toBe('FL110');
  });

  it('FL115 por debajo de 1013', () => {
    expect(transitionLevelFor(1012)).toBe('FL115');
    expect(transitionLevelFor(990)).toBe('FL115');
  });
});
