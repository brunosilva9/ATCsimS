/**
 * El backlog dentro de la app (N-09): docs/BACKLOG.md separado en items, y los comentarios que
 * deja el ATC agrupados por item.
 *
 * El texto sale del archivo del repositorio, incorporado al build, y no de Firestore: el backlog
 * cambia solo por commit (AGENTS.md), asi que lo que se ve en /backlog es lo que quedo en la
 * ultima publicacion del sitio. Los comentarios, en cambio, viven en Firestore
 * (lib/backlogComments.ts): son del ATC, que no hace commits.
 *
 * Este modulo no toca Firebase, para poder probarlo sin red.
 */

import { Marked, Renderer, type Tokens } from 'marked';

export type BacklogLevel = 'next' | 'maybe';

export const LEVEL_LABEL: Readonly<Record<BacklogLevel, string>> = {
  next: 'Next',
  maybe: 'Maybe',
};

export interface BacklogItem {
  /** `N-07` en Next, `M-10` en Maybe. */
  readonly id: string;
  /** El identificador que tenia en Maybe antes de pasar a Next (`M-04`), si lo tuvo. */
  readonly formerId: string | null;
  readonly title: string;
  readonly level: BacklogLevel;
  /** El cuerpo en markdown, sin el titulo. */
  readonly body: string;
}

/** `### N-07 (M-04) · Performance por categoría de aeronave` */
const HEADING = /^### ([NM]-\d+)(?: \(([NM]-\d+)\))? · (.+)$/;

/**
 * Los items de Next y Maybe, en el orden del archivo. Lo que hay antes de `## Next` ("Cómo se
 * usa") no es un item y queda fuera.
 */
export function parseBacklog(source: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  let level: BacklogLevel | null = null;
  let current: { id: string; formerId: string | null; title: string; lines: string[] } | null =
    null;

  const close = () => {
    if (current !== null && level !== null) {
      items.push({
        id: current.id,
        formerId: current.formerId,
        title: current.title,
        level,
        body: trimBody(current.lines),
      });
    }
    current = null;
  };

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      close();
      const name = line.slice(3).trim().toLowerCase();
      level = name === 'next' ? 'next' : name === 'maybe' ? 'maybe' : null;
      continue;
    }
    if (line.startsWith('### ')) {
      close();
      const match = HEADING.exec(line.trim());
      if (match !== null && level !== null) {
        current = { id: match[1]!, formerId: match[2] ?? null, title: match[3]!.trim(), lines: [] };
      }
      continue;
    }
    current?.lines.push(line);
  }
  close();
  return items;
}

/** Sin lineas en blanco en los bordes ni el `---` que separa Next de Maybe. */
function trimBody(lines: readonly string[]): string {
  let start = 0;
  let end = lines.length;
  const blank = (l: string) => l.trim() === '' || l.trim() === '---';
  while (start < end && blank(lines[start]!)) start++;
  while (end > start && blank(lines[end - 1]!)) end--;
  return lines.slice(start, end).join('\n');
}

// --------------------------------------------------------------------------------- comentarios

export interface BacklogComment {
  readonly id: string;
  /** El item comentado (`N-07`). Se conserva aunque el item se cierre. */
  readonly itemId: string;
  readonly text: string;
  readonly authorUid: string;
  readonly authorEmail: string;
  /** Epoch ms. */
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface GroupedComments {
  /** Por item del backlog, del mas antiguo al mas nuevo: se leen como una conversacion. */
  readonly byItem: ReadonlyMap<string, readonly BacklogComment[]>;
  /**
   * Los de items que ya no estan en el archivo. Al cerrar un item se borra del backlog, pero las
   * fuentes que dejo el ATC siguen sirviendo, asi que no se esconden.
   */
  readonly closed: ReadonlyMap<string, readonly BacklogComment[]>;
}

export function groupComments(
  comments: readonly BacklogComment[],
  itemIds: readonly string[]
): GroupedComments {
  const known = new Set(itemIds);
  const byItem = new Map<string, BacklogComment[]>();
  const closed = new Map<string, BacklogComment[]>();
  const sorted = [...comments].sort((a, b) => a.createdAt - b.createdAt);
  for (const c of sorted) {
    const target = known.has(c.itemId) ? byItem : closed;
    const list = target.get(c.itemId);
    if (list === undefined) target.set(c.itemId, [c]);
    else list.push(c);
  }
  const closedSorted = new Map(
    [...closed.entries()].sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
  );
  return { byItem, closed: closedSorted };
}

export type TextPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly href: string };

const URL_PATTERN = /https?:\/\/[^\s<>"«»]+/g;

/**
 * El texto de un comentario con sus URL separadas, para mostrarlas como enlace. La referencia que
 * deja el ATC suele ser un enlace a la AIP o a un documento, y copiarlo a mano es donde se rompe.
 * El comentario no se interpreta como markdown ni como HTML: lo escribe una persona en un
 * formulario y se muestra tal cual.
 */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    let href = match[0];
    // El punto o el parentesis que cierra la frase no es parte del enlace.
    while (/[.,;:!?]$/.test(href) || (href.endsWith(')') && !href.includes('('))) {
      href = href.slice(0, -1);
    }
    const start = match.index;
    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) });
    parts.push({ kind: 'link', href });
    last = start + href.length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

// ----------------------------------------------------------------------------------- markdown

/** Donde viven en GitHub los documentos a los que enlaza el backlog (`PLAN_MAPA.md`). */
const DOCS_URL = 'https://github.com/brunosilva9/ATCsimS/blob/main/docs/';

const markdown = new Marked({
  gfm: true,
  // Un enlace relativo del backlog apunta a otro archivo de docs/, que el sitio no publica: se
  // lleva a GitHub, donde si se puede abrir.
  walkTokens(token) {
    if (token.type === 'link') {
      const link = token as Tokens.Link;
      if (!/^([a-z][a-z0-9+.-]*:|#)/i.test(link.href)) link.href = new URL(link.href, DOCS_URL).href;
    }
  },
  renderer: {
    // En pestaña nueva: el sitio rutea por el hash, y salir de /backlog es perder lo que se
    // estaba escribiendo.
    link(token) {
      const html = Renderer.prototype.link.call(this, token);
      return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
    },
  },
});

/**
 * El cuerpo de un item en HTML. Se inserta sin sanear porque el origen es docs/BACKLOG.md del
 * propio repositorio, fijado en el build: no hay texto de usuarios aqui (los comentarios pasan
 * por linkify, nunca por esto).
 */
export function renderBacklogMarkdown(body: string): string {
  return markdown.parse(body, { async: false });
}
