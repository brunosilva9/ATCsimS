/**
 * El pie del sitio.
 *
 * Sale de App.tsx porque dejo de ser una linea: son dos cosas distintas que conviene no
 * mezclar —que es esta herramienta y de donde salen sus numeros— y cada una tiene un lector
 * distinto.
 *
 * La segunda columna no es decorativa. En un proyecto cuya regla es "los numeros salen de las
 * planillas o no salen", el pie es el sitio natural para decir CUANTAS planillas hay detras y
 * que parte todavia es provisional. Las cifras se cuentan de la base en tiempo de render: si
 * manana se reimporta y hay un fijo mas, el pie lo dice solo. Un numero escrito a mano aqui se
 * quedaria viejo en la primera correccion y estariamos presumiendo de una base que no es.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { PROVISIONAL_SOURCE } from '@atcsims/core';

import { useNavdataStore } from '../state/navdata.js';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  const fixes = useNavdataStore((s) => s.fixes);
  const procedures = useNavdataStore((s) => s.procedures);
  const airways = useNavdataStore((s) => s.airways);
  const holdings = useNavdataStore((s) => s.holdings);

  // Se cuentan de nuevo solo cuando cambia la base (recien cargada, o el instructor la edito
  // desde /admin y refresco) — no en cada render.
  const COUNTS = useMemo(
    () => ({
      fixes: fixes.length,
      stars: procedures.filter((p) => p.type === 'STAR').length,
      sids: procedures.filter((p) => p.type === 'SID').length,
      airways: airways.length,
      holdings: holdings.length,
    }),
    [fixes, procedures, airways, holdings]
  );

  return (
    <footer className={styles.footer}>
      <div className={styles.columns}>
        <section className={styles.column}>
          <h2 className={styles.columnTitle}>ATCsimS</h2>
          <p className={styles.body}>
            Simulador didáctico de ejercicios APP y ACC para el TMA Santiago. Reemplaza el
            ejercicio de papel que el instructor prepara a mano.
          </p>
          <p className={styles.body}>
            Corre entero en el navegador: no hay servidor propio, solo un login para restringir
            quién entra. Salvo por eso, ningún dato sale de este equipo.
          </p>
          <p className={styles.meta}>
            Prototipo · configuración SUR, RWY 17L ·{' '}
            <a href="https://github.com/brunosilva9/ATCsimS" target="_blank" rel="noreferrer">
              código fuente
            </a>
          </p>
        </section>

        <section className={styles.column}>
          <h2 className={styles.columnTitle}>De dónde salen los números</h2>
          <p className={styles.body}>
            De las planillas de la dependencia, importadas y validadas. Cuando un dato falta, el
            motor se niega a calcular y dice por qué, en vez de rellenar el hueco.
          </p>
          <dl className={styles.counts}>
            <div>
              <dt>Fijos</dt>
              <dd>{COUNTS.fixes}</dd>
            </div>
            <div>
              <dt>STAR</dt>
              <dd>{COUNTS.stars}</dd>
            </div>
            <div>
              <dt>SID</dt>
              <dd>{COUNTS.sids}</dd>
            </div>
            <div>
              <dt>Aerovías</dt>
              <dd>{COUNTS.airways}</dd>
            </div>
            <div>
              <dt>Esperas</dt>
              <dd>{COUNTS.holdings}</dd>
            </div>
          </dl>
          <p className={styles.warnLine}>
            Las mínimas de separación en ruta son <strong>provisionales</strong> y no son dato de
            la dependencia: {PROVISIONAL_SOURCE}.
          </p>
          <p className={styles.meta}>
            <Link to="/navdata">Ver todo lo que se importó</Link>
          </p>
        </section>
      </div>

      {/*
        El repositorio es publico: alguien que llegue de fuera no tiene por que distinguir una
        herramienta docente en desarrollo de doctrina publicada. Cuesta una linea decirlo.
      */}
      <p className={styles.legal}>
        Herramienta docente en desarrollo. No sustituye la documentación aeronáutica vigente
        (AIP Chile).
      </p>
    </footer>
  );
}
