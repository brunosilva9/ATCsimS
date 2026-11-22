/**
 * El backlog del proyecto, solo para admin (N-09).
 *
 * El texto es docs/BACKLOG.md incorporado al build: se ve lo que quedo en la ultima publicacion y
 * no se edita desde aqui, porque el backlog cambia solo por commit. Lo que si se escribe aqui son
 * los comentarios de cada item, donde el ATC deja sus referencias.
 *
 * Se carga bajo demanda (App.tsx): el markdown y su conversor no los necesita nadie mas.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import backlogSource from '../../../../docs/BACKLOG.md?raw';
import {
  LEVEL_LABEL,
  groupComments,
  parseBacklog,
  renderBacklogMarkdown,
  type BacklogComment,
  type BacklogItem,
} from '../lib/backlog.js';
import { listComments } from '../lib/backlogComments.js';
import { useAuthStore } from '../state/auth.js';
import { BacklogThread } from './BacklogThread.js';
import shared from './shared.module.css';
import styles from './Backlog.module.css';

type CommentsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly list: readonly BacklogComment[] }
  | { readonly status: 'error'; readonly message: string };

const ITEMS: readonly BacklogItem[] = parseBacklog(backlogSource);

export function Backlog() {
  const user = useAuthStore((s) => s.user);
  const [params, setParams] = useSearchParams();
  const [comments, setComments] = useState<CommentsState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      setComments({ status: 'ready', list: await listComments() });
    } catch (err) {
      setComments({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(
    () =>
      groupComments(
        comments.status === 'ready' ? comments.list : [],
        ITEMS.map((i) => i.id)
      ),
    [comments]
  );

  const selectedId = params.get('item') ?? ITEMS[0]?.id ?? null;
  const item = ITEMS.find((i) => i.id === selectedId) ?? null;
  const html = useMemo(() => (item === null ? '' : renderBacklogMarkdown(item.body)), [item]);

  const select = (id: string) => setParams({ item: id }, { replace: true });

  const entry = (id: string, title: string | null) => {
    const count = (grouped.byItem.get(id) ?? grouped.closed.get(id) ?? []).length;
    return (
      <li key={id}>
        <button
          type="button"
          className={id === selectedId ? styles.entryOn : styles.entry}
          aria-current={id === selectedId ? 'true' : undefined}
          onClick={() => select(id)}
        >
          <span className={styles.entryId}>{id}</span>
          <span className={styles.entryTitle}>{title ?? 'Ítem cerrado'}</span>
          {count > 0 ? (
            <span className={styles.entryCount} aria-label={`${count} comentarios`}>
              {count}
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  const closedSelected = item === null && selectedId !== null && grouped.closed.has(selectedId);

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Administración</p>
          <h2 className={shared.pageTitle}>Backlog</h2>
          <p className={shared.lead}>
            Lo planificado para ATCsimS, tal como quedó en la última publicación del sitio. En
            cada ítem se dejan las fuentes, los valores y las observaciones que sirven para
            trabajarlo: quien lo implemente los lee antes de empezar.
          </p>
        </div>
      </header>

      {comments.status === 'error' ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudieron leer los comentarios.</strong> {comments.message}. Si dice
          «permission», falta publicar <code>firestore.rules</code> en Consola Firebase ›
          Firestore › Reglas: la regla de <code>backlogComments</code> es nueva.
        </div>
      ) : null}

      <div className={styles.layout}>
        <nav className={styles.index} aria-label="Ítems del backlog">
          {(['next', 'maybe'] as const).map((level) => (
            <div key={level} className={styles.group}>
              <h3 className={styles.groupTitle}>
                {LEVEL_LABEL[level]}
                <span className={styles.groupHint}>
                  {level === 'next' ? 'comprometido' : 'evaluado, no comprometido'}
                </span>
              </h3>
              <ul className={styles.entries}>
                {ITEMS.filter((i) => i.level === level).map((i) => entry(i.id, i.title))}
              </ul>
            </div>
          ))}
          {grouped.closed.size > 0 ? (
            <div className={styles.group}>
              <h3 className={styles.groupTitle}>
                Cerrados
                <span className={styles.groupHint}>con comentarios</span>
              </h3>
              <ul className={styles.entries}>
                {[...grouped.closed.keys()].map((id) => entry(id, null))}
              </ul>
            </div>
          ) : null}
        </nav>

        <article className={styles.detail}>
          {item !== null ? (
            <>
              <header className={styles.detailHead}>
                <p className={styles.detailId}>
                  {item.id}
                  {item.formerId !== null ? ` (${item.formerId})` : ''}
                  <span className={item.level === 'next' ? styles.levelNext : styles.levelMaybe}>
                    {LEVEL_LABEL[item.level]}
                  </span>
                </p>
                <h3 className={styles.detailTitle}>{item.title}</h3>
              </header>
              <div className={styles.markdown} dangerouslySetInnerHTML={{ __html: html }} />
            </>
          ) : closedSelected ? (
            <header className={styles.detailHead}>
              <p className={styles.detailId}>{selectedId}</p>
              <h3 className={styles.detailTitle}>Ítem cerrado</h3>
              <p className={shared.note}>
                Ya no está en el backlog: se completó o se descartó, y su registro quedó en el
                commit que lo cerró. Sus comentarios se conservan.
              </p>
            </header>
          ) : (
            <p className={shared.note}>
              {selectedId === null
                ? 'El backlog está vacío.'
                : `${selectedId} no está en el backlog. Elige un ítem de la lista.`}
            </p>
          )}

          {user !== null && selectedId !== null && (item !== null || closedSelected) ? (
            comments.status === 'loading' ? (
              <p className={shared.note}>Cargando comentarios…</p>
            ) : comments.status === 'ready' ? (
              <BacklogThread
                key={selectedId}
                itemId={selectedId}
                comments={grouped.byItem.get(selectedId) ?? grouped.closed.get(selectedId) ?? []}
                user={{ uid: user.uid, email: user.email }}
                onChanged={load}
                canAdd={item !== null}
              />
            ) : null
          ) : null}
        </article>
      </div>
    </div>
  );
}
