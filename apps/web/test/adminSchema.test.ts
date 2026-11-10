/**
 * Los campos opcionales que /admin dejaba en null.
 *
 * El formulario rellena con null todo campo ausente para poder editarlo, y antes lo guardaba
 * asi. En el dominio esos campos son `?:` y se preguntan con `!== undefined`: un
 * `sourceTotalTimeMin: null` hacia caer /navdata y un `maxAltFt: null` era un techo de 0 ft.
 */

import { describe, expect, it } from 'vitest';

import { omitEmptyOptionals, schemaFor } from '../src/routes/AdminSchema.js';

const procedures = schemaFor('procedures')!;

describe('omitEmptyOptionals', () => {
  it('saca los opcionales en null de un procedimiento y de sus tramos', () => {
    const clean = omitEmptyOptionals(procedures.fields, {
      ident: 'EROLO6E',
      entryFix: null,
      totalDistNm: 40,
      sourceTotalTimeMin: null,
      entryAirways: [],
      _review: null,
      legs: [
        { seq: 1, fix: 'EROLO', distToEndNm: 40, legDistNm: null, maxAltFt: null, minAltFt: 9000 },
      ],
    });

    expect(clean).not.toHaveProperty('sourceTotalTimeMin');
    expect(clean).not.toHaveProperty('entryAirways');
    expect(clean).not.toHaveProperty('_review');
    const [leg] = clean.legs as Record<string, unknown>[];
    expect(leg).not.toHaveProperty('maxAltFt');
    expect(leg).toHaveProperty('minAltFt', 9000);
  });

  it('deja los null que el dominio declara a proposito', () => {
    const clean = omitEmptyOptionals(procedures.fields, {
      ident: 'X',
      entryFix: null,
      totalDistNm: null,
      legs: [{ seq: 1, fix: 'A', distToEndNm: null, legDistNm: null }],
    });

    expect(clean).toHaveProperty('entryFix', null);
    expect(clean).toHaveProperty('totalDistNm', null);
    const [leg] = clean.legs as Record<string, unknown>[];
    expect(leg).toHaveProperty('distToEndNm', null);
    expect(leg).toHaveProperty('legDistNm', null);
  });

  it('no toca un valor cargado', () => {
    const clean = omitEmptyOptionals(procedures.fields, {
      ident: 'X',
      sourceTotalTimeMin: 0,
      _review: 'dato contradictorio',
      legs: [],
    });

    expect(clean).toHaveProperty('sourceTotalTimeMin', 0);
    expect(clean).toHaveProperty('_review', 'dato contradictorio');
  });
});
