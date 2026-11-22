/**
 * Los comentarios de un item del backlog (N-09).
 *
 * Es donde el ATC deja la fuente de un valor, una observacion o una duda sobre un punto del
 * alcance, para que quien implemente el item la lea antes de empezar. Cada autor edita o borra
 * solo lo suyo; firestore.rules lo exige, esta pantalla solo no ofrece el boton.
 */

import { type FormEvent, useState } from 'react';

import { linkify, type BacklogComment } from '../lib/backlog.js';
import { COMMENT_MAX_LENGTH, addComment, editComment, removeComment } from '../lib/backlogComments.js';
import styles from './BacklogThread.module.css';

export interface BacklogThreadProps {
  readonly itemId: string;
  readonly comments: readonly BacklogComment[];
  /** Quien esta logueado. */
  readonly user: { readonly uid: string; readonly email: string | null };
  /** Se llama despues de cada escritura, para volver a leer la coleccion. */
  readonly onChanged: () => Promise<void>;
  /** false para un item cerrado: se leen sus comentarios, pero ya no se agregan. */
  readonly canAdd: boolean;
}

const DATE = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

export function BacklogThread({ itemId, comments, user, onChanged, canAdd }: BacklogThreadProps) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Corre una escritura y avisa si falla, con la causa mas probable. */
  const write = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        /permission/i.test(message)
          ? 'Firestore no dejó guardar: falta publicar firestore.rules con la regla de backlogComments, o la cuenta no tiene rol admin.'
          : `No se pudo guardar el comentario: ${message}`
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text === '') return;
    if (await write(() => addComment(itemId, text, user))) setDraft('');
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (editing === null || editing.text.trim() === '') return;
    const { id, text } = editing;
    if (await write(() => editComment(id, text.trim()))) setEditing(null);
  };

  const remove = async (c: BacklogComment) => {
    if (!window.confirm('¿Borrar este comentario? No se puede deshacer.')) return;
    await write(() => removeComment(c.id));
  };

  return (
    <section className={styles.thread} aria-labelledby={`thread-${itemId}`}>
      <h4 id={`thread-${itemId}`} className={styles.heading}>
        Comentarios <span className={styles.count}>{comments.length}</span>
      </h4>

      {comments.length === 0 ? (
        <p className={styles.empty}>
          {canAdd
            ? 'Sin comentarios. Deja aquí la fuente de un valor, una observación o una duda, e indica el punto del alcance al que se refiere.'
            : 'Sin comentarios.'}
        </p>
      ) : (
        <ol className={styles.list}>
          {comments.map((c) => {
            const own = c.authorUid === user.uid;
            const isEditing = editing?.id === c.id;
            return (
              <li key={c.id} className={styles.comment}>
                <div className={styles.meta}>
                  <span className={styles.author}>{c.authorEmail || 'sin autor'}</span>
                  <time dateTime={new Date(c.createdAt).toISOString()}>
                    {DATE.format(c.createdAt)}
                  </time>
                  {c.updatedAt - c.createdAt > 1000 ? (
                    <span title={DATE.format(c.updatedAt)}>· editado</span>
                  ) : null}
                </div>

                {isEditing ? (
                  <form className={styles.form} onSubmit={(e) => void saveEdit(e)}>
                    <label className={styles.srOnly} htmlFor={`edit-${c.id}`}>
                      Editar comentario
                    </label>
                    <textarea
                      id={`edit-${c.id}`}
                      className={styles.textarea}
                      rows={4}
                      maxLength={COMMENT_MAX_LENGTH}
                      value={editing.text}
                      onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                    />
                    <div className={styles.formActions}>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={busy}
                        onClick={() => setEditing(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className={styles.primary}
                        disabled={busy || editing.text.trim() === ''}
                      >
                        Guardar
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className={styles.text}>
                    {linkify(c.text).map((part, i) =>
                      part.kind === 'link' ? (
                        <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">
                          {part.href}
                        </a>
                      ) : (
                        <span key={i}>{part.text}</span>
                      )
                    )}
                  </p>
                )}

                {own && !isEditing ? (
                  <div className={styles.commentActions}>
                    <button
                      type="button"
                      className={styles.link}
                      disabled={busy}
                      onClick={() => setEditing({ id: c.id, text: c.text })}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={styles.linkDanger}
                      disabled={busy}
                      onClick={() => void remove(c)}
                    >
                      Borrar
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {canAdd ? (
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          <label className={styles.label} htmlFor={`new-${itemId}`}>
            Nuevo comentario
          </label>
          <textarea
            id={`new-${itemId}`}
            className={styles.textarea}
            rows={4}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Fuente, valor u observación, con el punto del alcance al que se refiere."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className={styles.formActions}>
            <span className={styles.chars}>
              {draft.length} / {COMMENT_MAX_LENGTH}
            </span>
            <button type="submit" className={styles.primary} disabled={busy || draft.trim() === ''}>
              {busy ? 'Guardando…' : 'Comentar'}
            </button>
          </div>
        </form>
      ) : null}

      {error !== null ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
