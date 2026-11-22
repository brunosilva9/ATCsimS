/**
 * El backlog en la app (N-09): el archivo separado en items, los comentarios agrupados y lo que
 * se muestra de cada uno.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  groupComments,
  linkify,
  parseBacklog,
  renderBacklogMarkdown,
  type BacklogComment,
} from '../src/lib/backlog.js';

const SAMPLE = [
  '# Backlog',
  '',
  'Intro que no es un item.',
  '',
  '## Cómo se usa',
  '',
  '### Esto tampoco es un item',
  '',
  '## Next',
  '',
  '### N-02 · Primero',
  '',
  '**Contexto.** Algo.',
  '',
  '### N-05 (M-01) · Promovido',
  '',
  'Cuerpo.',
  '',
  '---',
  '',
  '## Maybe',
  '',
  '### M-03 · Idea',
  '',
  'Valor esperado.',
  '',
].join('\r\n');

describe('separar el backlog en items', () => {
  const items = parseBacklog(SAMPLE);

  it('toma solo los items de Next y Maybe, en orden', () => {
    expect(items.map((i) => [i.id, i.level])).toEqual([
      ['N-02', 'next'],
      ['N-05', 'next'],
      ['M-03', 'maybe'],
    ]);
  });

  it('separa el identificador anterior y el titulo', () => {
    expect(items[1]).toMatchObject({ id: 'N-05', formerId: 'M-01', title: 'Promovido' });
    expect(items[0]!.formerId).toBeNull();
  });

  it('el cuerpo no lleva el titulo, los bordes en blanco ni el separador', () => {
    expect(items[0]!.body).toBe('**Contexto.** Algo.');
    expect(items[1]!.body).toBe('Cuerpo.');
  });

  it('el archivo real se separa entero, sin items repetidos', () => {
    const path = fileURLToPath(new URL('../../../docs/BACKLOG.md', import.meta.url));
    const source = readFileSync(path, 'utf8');
    const real = parseBacklog(source);
    const after = source.split(/\r?\n/).slice(source.split(/\r?\n/).indexOf('## Next'));
    const headings = after.filter((l) => l.startsWith('### '));
    expect(real).toHaveLength(headings.length);
    expect(new Set(real.map((i) => i.id)).size).toBe(real.length);
    for (const item of real) expect(item.body.trim(), item.id).not.toBe('');
  });
});

const comment = (id: string, itemId: string, createdAt: number): BacklogComment => ({
  id,
  itemId,
  text: id,
  authorUid: 'u1',
  authorEmail: 'atc@example.com',
  createdAt,
  updatedAt: createdAt,
});

describe('agrupar los comentarios', () => {
  const grouped = groupComments(
    [comment('b', 'N-07', 20), comment('a', 'N-07', 10), comment('c', 'N-10', 5), comment('d', 'N-3', 1)],
    ['N-07', 'N-08']
  );

  it('por item, del mas antiguo al mas nuevo', () => {
    expect(grouped.byItem.get('N-07')!.map((c) => c.id)).toEqual(['a', 'b']);
    expect(grouped.byItem.has('N-08')).toBe(false);
  });

  it('los de un item que ya no esta en el archivo quedan aparte, en orden de identificador', () => {
    expect([...grouped.closed.keys()]).toEqual(['N-3', 'N-10']);
  });
});

describe('enlaces en un comentario', () => {
  it('separa la URL sin el punto que cierra la frase', () => {
    expect(linkify('Ver https://aip.dgac.gob.cl/ad2. Gracias')).toEqual([
      { kind: 'text', text: 'Ver ' },
      { kind: 'link', href: 'https://aip.dgac.gob.cl/ad2' },
      { kind: 'text', text: '. Gracias' },
    ]);
  });

  it('deja fuera el parentesis que no abrio la URL', () => {
    expect(linkify('(fuente: https://example.com/a)')).toEqual([
      { kind: 'text', text: '(fuente: ' },
      { kind: 'link', href: 'https://example.com/a' },
      { kind: 'text', text: ')' },
    ]);
  });

  it('un texto sin URL queda igual', () => {
    expect(linkify('Punto 2: valor del manual.')).toEqual([
      { kind: 'text', text: 'Punto 2: valor del manual.' },
    ]);
  });
});

describe('el cuerpo en pantalla', () => {
  it('lleva a GitHub los enlaces relativos y los abre en otra pestaña', () => {
    const html = renderBacklogMarkdown('Ver [el plan](PLAN_MAPA.md) y [el readme](../README.md).');
    expect(html).toContain(
      'href="https://github.com/brunosilva9/ATCsimS/blob/main/docs/PLAN_MAPA.md"'
    );
    expect(html).toContain('href="https://github.com/brunosilva9/ATCsimS/blob/main/README.md"');
    expect(html).toContain('target="_blank"');
  });

  it('dibuja las tablas', () => {
    const html = renderBacklogMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });
});
