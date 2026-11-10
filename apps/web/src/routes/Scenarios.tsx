/**
 * El banco de ejercicios de los instructores.
 *
 * Vive en Firestore y es uno solo para todos los instructores (ver lib/storage.ts): lo que guarda
 * uno lo ven y lo pueden editar los demas. Al alumno el ejercicio le llega por enlace o archivo.
 *
 * Si en este navegador quedaron ejercicios del banco anterior (localStorage), la pagina lo dice
 * y ofrece subirlos: no se suben solos, porque pasan a verlos todos los instructores.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { formatHhmm } from '@atcsims/core';

import { OriginTag } from '../components/OriginTag.js';
import { downloadPayload, encodePayload, parsePayload } from '../lib/share.js';
import {
  deleteDraft,
  listDrafts,
  localDrafts,
  newDraftId,
  saveDraft,
  uploadLocalDrafts,
} from '../lib/storage.js';
import type { StoredDraft } from '../lib/storage.js';
import { buildScenario } from '../scenarios/build.js';
import type { ScenarioDraft } from '../scenarios/build.js';
import { draftOrigin } from '../scenarios/origin.js';
import { useBuildContext } from '../state/buildContext.js';
import { useNavdataStore } from '../state/navdata.js';
import { formatUpdatedAt } from './AdminSchema.js';
import shared from './shared.module.css';
import styles from './Scenarios.module.css';

export function Scenarios() {
  const navigate = useNavigate();
  const buildCtx = useBuildContext();
  const sampleFlights = useNavdataStore((s) => s.sampleFlights);
  /** Los indicativos del catalogo: para deducir el origen de los vuelos guardados sin `source`. */
  const catalogue = useMemo(() => new Set(sampleFlights.map((f) => f.callsign)), [sampleFlights]);
  const [drafts, setDrafts] = useState<StoredDraft[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState(() => localDrafts().length);
  const [uploading, setUploading] = useState(false);
  const [uploadedNote, setUploadedNote] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setDrafts(await listDrafts());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudo leer el banco.');
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  /**
   * El mismo payload para exportar y para imprimir, con el modo incluido: exportar sin el modo
   * era un bug pequeño y silencioso, porque el instructor solo lo notaba si volvia a abrir el
   * archivo — una prueba exportada asi se reabria como practica.
   */
  const payloadOf = (draft: ScenarioDraft) => {
    const built = buildScenario(draft, buildCtx);
    return {
      version: 1 as const,
      scenario: built.scenario,
      instructions: [],
      mode: draft.mode ?? 'practice',
      allowInstructions: draft.allowInstructions ?? false,
      assumptions: built.assumptions.map((a) => ({ flightId: a.flightId, note: a.note })),
    };
  };

  const exportOne = (draft: ScenarioDraft) => {
    downloadPayload(payloadOf(draft), `${draft.id}.json`);
  };

  const importFile = async (file: File) => {
    const parsed = parsePayload(await file.text());
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    // Un archivo trae el ejercicio ya calculado, no la receta. Se guarda reconstruyendo la
    // receta a partir de los vuelos, que es lo que el editor sabe editar.
    const s = parsed.payload.scenario;
    const draft: ScenarioDraft = {
      id: newDraftId(),
      name: s.name,
      configuration: s.configuration,
      runwayInUse: s.runwayInUse,
      sivigats: s.sivigats,
      objective: s.objective,
      weather: s.weather,
      flights: s.flights.map((f) => ({
        id: f.id,
        callsign: f.callsign,
        ssr: f.ssr,
        icaoType: f.icaoType,
        registration: f.registration,
        tasKt: f.tasKt,
        adep: f.adep,
        ades: f.ades,
        operator: f.operator,
        kind: f.kind,
        procedureIdent: f.procedureIdent ?? '',
        entryTime: f.entryTime,
        levelFl: Math.round(f.cruiseLevelFt / 100),
      })),
    };
    try {
      await saveDraft(draft);
      setError(null);
      navigate(`/scenarios/${draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar en el banco.');
    }
  };

  // El banco es de todos los instructores: borrar uno lo borra para los demas.
  const remove = async (draft: StoredDraft) => {
    if (!window.confirm(`¿Borrar "${draft.name}" del banco? Lo deja de ver todo instructor.`)) return;
    try {
      await deleteDraft(draft.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
    }
    await refresh();
  };

  const uploadLocal = async () => {
    setUploading(true);
    try {
      const n = await uploadLocalDrafts();
      setPendingLocal(localDrafts().length);
      setUploadedNote(
        n === 0
          ? 'Ya estaban todos en el banco.'
          : `Se ${n === 1 ? 'subió 1 ejercicio' : `subieron ${n} ejercicios`} al banco.`
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron subir.');
    }
    setUploading(false);
    await refresh();
  };

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Instructor</p>
          <h2 className={shared.pageTitle}>Banco de ejercicios</h2>
          <p className={shared.lead}>
            Un solo banco para todos los instructores: lo que guardas aquí lo ven y lo pueden editar
            los demás, desde cualquier equipo. Al alumno le llega por enlace o archivo, no ve el
            banco.
          </p>
        </div>
        <div className={styles.actions}>
          <Link to="/scenarios/nuevo" className={styles.primary}>
            Ejercicio nuevo
          </Link>
          <Link to="/scenarios/ejemplo" className={styles.secondary}>
            Partir del ejemplo
          </Link>
          <label className={styles.secondary}>
            Importar…
            <input
              type="file"
              id="import-scenario"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
              }}
            />
          </label>
        </div>
      </header>

      {pendingLocal > 0 ? (
        <div className={shared.notice}>
          <strong>
            {pendingLocal === 1
              ? 'Hay 1 ejercicio guardado solo en este navegador'
              : `Hay ${pendingLocal} ejercicios guardados solo en este navegador`}
          </strong>{' '}
          (del banco anterior, que no salía de cada equipo). Súbelos para que queden en el banco
          compartido; la copia local no se borra.{' '}
          <button
            type="button"
            className={styles.link}
            onClick={() => void uploadLocal()}
            disabled={uploading}
          >
            {uploading ? 'Subiendo…' : 'Subir al banco'}
          </button>
        </div>
      ) : null}

      {uploadedNote !== null ? <p className={shared.note}>{uploadedNote}</p> : null}

      {error !== null ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo completar.</strong> {error}
        </div>
      ) : null}

      {loadError !== null ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo leer el banco.</strong> {loadError}{' '}
          <button type="button" className={styles.link} onClick={() => void refresh()}>
            Reintentar
          </button>
        </div>
      ) : drafts === null ? (
        <p className={shared.note}>Cargando el banco…</p>
      ) : drafts.length === 0 ? (
        <div className={styles.empty}>
          <p>Todavía no hay ejercicios en el banco.</p>
          <p className={shared.note}>
            <Link to="/scenarios/ejemplo">Parte del ejemplo</Link> si quieres ver cómo se arma
            uno: cuatro llegadas que confluyen en TEGEB, con un conflicto puesto a propósito.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {drafts.map((draft) => {
            const built = buildScenario(draft, buildCtx);
            const origin = draftOrigin(draft, catalogue);
            // Reusa el `built` de arriba en vez de llamar a payloadOf: la lista ya recalcula
            // cada ejercicio para mostrar la ventana, y no hace falta hacerlo dos veces por fila
            // solo para armar el enlace de impresion.
            const printPayload = {
              version: 1 as const,
              scenario: built.scenario,
              instructions: [],
              mode: draft.mode ?? ('practice' as const),
              allowInstructions: draft.allowInstructions ?? false,
              assumptions: built.assumptions.map((a) => ({ flightId: a.flightId, note: a.note })),
            };
            return (
              <li key={draft.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <div className={styles.itemTitle}>
                    <Link to={`/scenarios/${draft.id}`} className={styles.itemName}>
                      {draft.name}
                    </Link>
                    <OriginTag kind={origin.kind} title={origin.detail}>
                      {origin.label}
                    </OriginTag>
                  </div>
                  <p className={styles.itemMeta}>
                    {draft.flights.length} vuelo{draft.flights.length === 1 ? '' : 's'} ·{' '}
                    {draft.configuration} RWY {draft.runwayInUse} ·{' '}
                    {built.scenario.flights.length > 0
                      ? `${formatHhmm(built.scenario.startTime)}–${formatHhmm(
                          built.scenario.startTime + built.scenario.durationMin
                        )}`
                      : 'sin tráfico'}
                    {built.rejected.length > 0
                      ? ` · ${built.rejected.length} sin calcular`
                      : ''}
                  </p>
                  {draft.updatedAt !== undefined ? (
                    <p className={styles.itemMeta}>
                      Guardado {formatUpdatedAt(draft.updatedAt)}
                      {draft.updatedBy ? ` por ${draft.updatedBy}` : ''}
                    </p>
                  ) : null}
                </div>
                <div className={styles.itemActions}>
                  <a
                    className={styles.link}
                    href={`#/print?e=${encodePayload(printPayload)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Imprimir
                  </a>
                  <button type="button" className={styles.link} onClick={() => exportOne(draft)}>
                    Exportar
                  </button>
                  <button type="button" className={styles.link} onClick={() => void remove(draft)}>
                    Borrar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
