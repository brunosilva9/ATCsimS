/**
 * La definicion de cada coleccion en /admin (N-08).
 *
 * El tipo ya obliga a que exista; esto comprueba que este completa y que sus relaciones apunten a
 * colecciones reales, para que una coleccion nueva no llegue con la explicacion vacia o con un
 * enlace a una pestaña que no existe.
 */

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AdminDefinition } from '../src/routes/AdminDefinition.js';
import { ADMIN_SCHEMAS, IMPACT_LABEL, schemaFor } from '../src/routes/AdminSchema.js';

describe('definicion de cada coleccion', () => {
  for (const schema of ADMIN_SCHEMAS) {
    it(`${schema.collection} tiene su definicion completa`, () => {
      const { impact, contains, usedFor, onEdit, relations } = schema.definition;
      expect(Object.keys(IMPACT_LABEL)).toContain(impact);
      for (const text of [contains, usedFor, onEdit]) {
        expect(text.trim().length).toBeGreaterThan(20);
      }
      for (const r of relations) {
        expect(schemaFor(r.collection), `${schema.collection} → ${r.collection}`).toBeDefined();
        expect(r.collection).not.toBe(schema.collection);
        expect(r.how.trim()).not.toBe('');
      }
      expect(new Set(relations.map((r) => r.collection)).size).toBe(relations.length);
    });
  }
});

describe('la definicion en pantalla', () => {
  it('muestra el impacto, los cuatro apartados y las relaciones por su nombre', () => {
    const html = renderToString(
      createElement(AdminDefinition, { schema: schemaFor('holdings')!, onOpen: () => {} })
    );
    expect(html).toContain('Afecta el cálculo');
    expect(html).toContain('Qué contiene');
    expect(html).toContain('Para qué se usa');
    expect(html).toContain('Al editarla');
    expect(html).toContain('Se relaciona con');
    expect(html).toContain('Procedimientos');
  });
});
