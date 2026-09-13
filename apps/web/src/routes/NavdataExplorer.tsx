/**
 * Explorador de la base de navegacion.
 *
 * Sirve para dos cosas: que el instructor compruebe que el dato que va a usar existe, y que
 * quien revise el proyecto vea exactamente que se importo de las planillas y que no.
 */

import { useMemo, useState } from 'react';

import {
  EXCLUSIONS,
  aircraftTypes,
  airways,
  fixes,
  holdings,
  performance,
  procedures,
  separation,
} from '@atcsims/navdata';

import shared from './shared.module.css';
import styles from './NavdataExplorer.module.css';

type TabId =
  | 'fixes'
  | 'procedures'
  | 'airways'
  | 'performance'
  | 'holdings'
  | 'separation'
  | 'types';

const TABS: readonly { id: TabId; label: string; total: number }[] = [
  { id: 'fixes', label: 'Fixes', total: fixes.length },
  { id: 'procedures', label: 'Procedimientos', total: procedures.length },
  { id: 'airways', label: 'Aerovías', total: airways.length },
  { id: 'performance', label: 'Performance', total: performance.length },
  { id: 'holdings', label: 'Esperas', total: holdings.length },
  { id: 'separation', label: 'Espaciamiento', total: separation.length },
  { id: 'types', label: 'Tipos', total: aircraftTypes.length },
];

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

const fl = (ft: number | null) =>
  ft === null ? '—' : `FL${String(Math.round(ft / 100)).padStart(3, '0')}`;

export function NavdataExplorer() {
  const [tab, setTab] = useState<TabId>('fixes');
  const [query, setQuery] = useState('');
  const needle = query.trim().toUpperCase();

  const visible = useMemo(() => {
    const has = (...parts: readonly unknown[]) =>
      needle === '' || parts.some((p) => String(p ?? '').toUpperCase().includes(needle));

    return {
      fixes: fixes.filter((f) => has(f.ident, f.name, f.type, f.scope)),
      procedures: procedures.filter((p) =>
        has(p.ident, p.type, p.legs.map((l) => l.fix).join(' '))
      ),
      airways: airways.filter((a) => has(a.ident, a.fixes?.join(' '))),
      performance: performance.filter((p) => has(p.level, p.fixes.join(' '))),
      holdings: holdings.filter((h) => has(h.fix, h.note)),
      separation: separation.filter((s) => has(s.runway, s.unit)),
      types: aircraftTypes.filter((t) => has(t.icao, t.name)),
    };
  }, [needle]);

  const active = TABS.find((t) => t.id === tab);
  const shown = visible[tab].length;

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Base de navegación</p>
          <h2 className={shared.pageTitle}>Lo que se importó de las planillas</h2>
          <p className={shared.lead}>
            Generado desde <code>basedatos/</code> con <code>tools/build-db.js</code> y verificado
            con <code>tools/validate.js</code>. Si un dato está mal, se corrige en el Excel y se
            vuelve a importar.
          </p>
        </div>
        <label className={styles.search} htmlFor="navdata-search">
          <span className={styles.searchLabel}>Buscar</span>
          <input
            type="search"
            id="navdata-search"
            value={query}
            placeholder="UMKAL, TEGEB, UQ802…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      {EXCLUSIONS.length > 0 ? (
        <div className={shared.notice}>
          <strong>Excluido a propósito.</strong> Estos registros no se cargan porque la planilla de
          origen está incompleta o se contradice. Cada línea se borra cuando ATC resuelva el punto.
          <ul>
            {EXCLUSIONS.map((e) => (
              <li key={`${e.kind}-${e.id}`}>
                <code>{e.id}</code> ({e.kind}) — {e.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? styles.tabOn : styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className={styles.tabCount}>{t.total}</span>
          </button>
        ))}
      </div>

      <p className={shared.note}>
        {shown} de {active?.total ?? 0} registros
        {needle === '' ? '' : ` que contienen “${query.trim()}”`}.
      </p>

      <div className={styles.tableWrap}>
        {tab === 'fixes' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ident</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Lat</th>
                <th>Lon</th>
                <th>MEA</th>
                <th>MCL</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {visible.fixes.map((f) => (
                <tr key={f.ident}>
                  <td className={styles.ident}>{f.ident}</td>
                  <td>{dash(f.name)}</td>
                  <td>{f.type}</td>
                  <td className={styles.num}>{f.lat === null ? '—' : f.lat.toFixed(4)}</td>
                  <td className={styles.num}>{f.lon === null ? '—' : f.lon.toFixed(4)}</td>
                  <td className={styles.num}>{dash(f.meaFt)}</td>
                  <td className={styles.num}>{dash(f.mclFt)}</td>
                  <td>
                    {f._inferred === true ? (
                      <span className={styles.flag}>inferido</span>
                    ) : (
                      <span className={styles.muted}>base</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === 'procedures' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Designador</th>
                <th>Tipo</th>
                <th>Dist.</th>
                <th>Tiempo planilla</th>
                <th>Ruta</th>
              </tr>
            </thead>
            <tbody>
              {visible.procedures.map((p) => (
                <tr key={p.ident}>
                  <td className={styles.ident}>{p.ident}</td>
                  <td>{p.type}</td>
                  <td className={styles.num}>
                    {p.totalDistNm === null ? '—' : `${p.totalDistNm} NM`}
                  </td>
                  <td className={styles.num}>
                    {p.sourceTotalTimeMin === undefined
                      ? '—'
                      : `${p.sourceTotalTimeMin.toFixed(2)} min`}
                  </td>
                  <td className={styles.route}>
                    {p.legs.map((l) => l.fix).join(' › ')}
                    {p._review !== undefined ? <span className={styles.flag}>revisar</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === 'airways' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Designador</th>
                <th>Niveles</th>
                <th>Fixes</th>
              </tr>
            </thead>
            <tbody>
              {visible.airways.map((a) => (
                <tr key={a.ident}>
                  <td className={styles.ident}>{a.ident}</td>
                  <td>{a.levels}</td>
                  <td className={styles.route}>{a.fixes?.join(' › ') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === 'performance' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Altitud</th>
                <th>IAS</th>
                <th>GS</th>
                <th>NM/min</th>
                <th>ft/min</th>
                <th>Fixes donde se exige</th>
              </tr>
            </thead>
            <tbody>
              {visible.performance.map((p) => (
                <tr key={p.level}>
                  <td className={styles.ident}>{p.level}</td>
                  <td className={styles.num}>{p.altFt} ft</td>
                  <td className={styles.num}>{dash(p.iasKt)}</td>
                  <td className={styles.num}>{dash(p.gsKt)}</td>
                  <td className={styles.num}>{dash(p.nmPerMin)}</td>
                  <td className={styles.num}>{dash(p.ftPerMin)}</td>
                  <td className={styles.route}>{p.fixes.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === 'holdings' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fix</th>
                <th>Inferior</th>
                <th>Superior</th>
                <th>MCL</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {visible.holdings.map((h) => (
                <tr key={h.fix}>
                  <td className={styles.ident}>{h.fix}</td>
                  <td className={styles.num}>{fl(h.lowerLevelFt)}</td>
                  <td className={styles.num}>{fl(h.upperLevelFt)}</td>
                  <td className={styles.num}>{dash(h.mclFt)}</td>
                  <td>{dash(h.note)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === 'separation' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Pista</th>
                <th>SIVIGATS</th>
                <th>Con salidas</th>
                <th>LVP</th>
                <th>Mínima</th>
              </tr>
            </thead>
            <tbody>
              {visible.separation.map((s, i) => (
                <tr key={`${s.runway}-${s.unit}-${i}`}>
                  <td className={styles.ident}>{s.runway}</td>
                  <td>{s.sivigats ? 'Sí' : 'No'}</td>
                  <td>{s.withDepartures === null ? '—' : s.withDepartures ? 'Sí' : 'No'}</td>
                  <td>{s.lvp ? 'Sí' : 'No'}</td>
                  <td className={styles.num}>
                    {s.value} {s.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === 'types' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>OACI</th>
                <th>Nombre</th>
                <th>Vel. mín.</th>
                <th>Vel. máx.</th>
                <th>Estela</th>
              </tr>
            </thead>
            <tbody>
              {visible.types.map((t) => (
                <tr key={t.icao}>
                  <td className={styles.ident}>{t.icao}</td>
                  <td>{dash(t.name)}</td>
                  <td className={styles.num}>{t.minSpeedKt} kt</td>
                  <td className={styles.num}>{t.maxSpeedKt} kt</td>
                  <td>{dash(t.wake)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
