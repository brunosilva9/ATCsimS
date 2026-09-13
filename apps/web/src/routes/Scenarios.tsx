/**
 * El banco de ejercicios del instructor.
 *
 * Vive en este navegador y en ningun otro sitio. Eso no es una limitacion que haya que
 * disimular: es la consecuencia de no tener servidor, y el instructor tiene que saberlo para
 * no perder el trabajo. Por eso la pagina lo dice y ofrece exportar.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { formatHhmm } from '@atcsims/core';

import { downloadPayload, parsePayload } from '../lib/share.js';
import { deleteDraft, listDrafts, newDraftId, saveDraft } from '../lib/storage.js';
import { buildScenario } from '../scenarios/build.js';
import type { ScenarioDraft } from '../scenarios/build.js';
import { SAMPLE_DRAFT } from '../scenarios/sample.js';
import shared from './shared.module.css';
import styles from './Scenarios.module.css';

export function Scenarios() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<ScenarioDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => setDrafts(listDrafts());
  useEffect(refresh, []);

  const exportOne = (draft: ScenarioDraft) => {
    downloadPayload(
      { version: 1, scenario: buildScenario(draft).scenario, instructions: [] },
      `${draft.id}.json`
    );
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
        kind: f.kind,
        procedureIdent: f.procedureIdent ?? '',
        entryTime: f.entryTime,
        levelFl: Math.round(f.cruiseLevelFt / 100),
      })),
    };
    setError(null);
    saveDraft(draft);
    navigate(`/scenarios/${draft.id}`);
  };

  const remove = (id: string) => {
    deleteDraft(id);
    refresh();
  };

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Instructor</p>
          <h2 className={shared.pageTitle}>Banco de ejercicios</h2>
          <p className={shared.lead}>
            Se guardan en este navegador. No hay servidor, así que no se sincronizan con otro
            equipo ni los ve nadie más: para que un ejercicio viaje, expórtalo o copia su enlace.
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

      {error !== null ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo importar.</strong> {error}
        </div>
      ) : null}

      {drafts.length === 0 ? (
        <div className={styles.empty}>
          <p>No hay ejercicios guardados en este navegador.</p>
          <p className={shared.note}>
            <Link to="/scenarios/ejemplo">Parte del ejemplo</Link> si quieres ver cómo se arma
            uno: cuatro llegadas que confluyen en TEGEB, con un conflicto puesto a propósito.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {drafts.map((draft) => {
            const built = buildScenario(draft);
            return (
              <li key={draft.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <Link to={`/scenarios/${draft.id}`} className={styles.itemName}>
                    {draft.name}
                  </Link>
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
                </div>
                <div className={styles.itemActions}>
                  <button type="button" className={styles.link} onClick={() => exportOne(draft)}>
                    Exportar
                  </button>
                  <button type="button" className={styles.link} onClick={() => remove(draft.id)}>
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
