/**
 * El pie del sitio.
 *
 * Sale de App.tsx porque dejo de ser una linea: son tres cosas distintas que conviene no
 * mezclar —que es esta herramienta, de donde salen sus numeros, y de quien es la dependencia—
 * y cada una tiene un lector distinto.
 *
 * La columna del medio no es decorativa. En un proyecto cuya regla es "los numeros salen de las
 * planillas o no salen", el pie es el sitio natural para decir CUANTAS planillas hay detras y
 * que parte todavia no es dato de ATC. Las cifras se cuentan de la base en tiempo de render: si
 * manana se reimporta y hay un fijo mas, el pie lo dice solo. Un numero escrito a mano aqui se
 * quedaria viejo en la primera correccion y estariamos presumiendo de una base que no es.
 */

import { Link } from 'react-router-dom';

import { PROVISIONAL_SOURCE } from '@atcsims/core';
import { airways, fixes, holdings, procedures } from '@atcsims/navdata';

import styles from './SiteFooter.module.css';

/** Las redes y el contacto del Colegio, tal como estan publicados en atcchile.cl. */
const SOCIAL = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/Colegio_atc_chile',
    // Iconos dibujados a mano: son cuatro y no compensa cargar un paquete de iconos por ellos.
    path: 'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.05 1.8.25 2.2.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.4.37 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.4.17-1 .37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.17-.4-.37-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.4-.17 1-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 3.05a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5Zm0 11.14a4.39 4.39 0 1 1 0-8.78 4.39 4.39 0 0 1 0 8.78Zm8.6-11.4a1.58 1.58 0 1 1-3.15 0 1.58 1.58 0 0 1 3.15 0Z',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/atcchile',
    path: 'M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z',
  },
  {
    label: 'X',
    href: 'https://twitter.com/ColegioATCChile',
    path: 'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UC6XgH_SQ63cAqTZmcO18Now',
    path: 'M23.5 6.5a3 3 0 0 0-2.12-2.12C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.38.52A3 3 0 0 0 .5 6.5C0 8.38 0 12 0 12s0 3.62.5 5.5a3 3 0 0 0 2.12 2.12c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.12C24 15.62 24 12 24 12s0-3.62-.5-5.5ZM9.6 15.6V8.4l6.24 3.6-6.24 3.6Z',
  },
] as const;

/** Se cuentan una vez: la base se carga en tiempo de build y no cambia mientras corre la app. */
const COUNTS = {
  fixes: fixes.length,
  stars: procedures.filter((p) => p.type === 'STAR').length,
  sids: procedures.filter((p) => p.type === 'SID').length,
  airways: airways.length,
  holdings: holdings.length,
};

export function SiteFooter() {
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
            Corre entero en el navegador: no hay servidor, no hay cuentas y ningún dato sale de
            este equipo.
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
            De las planillas de ATC, importadas y validadas. Cuando un dato falta, el motor se
            niega a calcular y dice por qué, en vez de rellenar el hueco.
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

        <section className={styles.column}>
          <h2 className={styles.columnTitle}>
            Colegio de Controladores de Tránsito Aéreo de Chile
          </h2>
          <address className={styles.address}>
            Román Díaz 1913, Ñuñoa, Santiago
            <br />
            <a href="tel:+56222257489">+56 2 2225 7489</a> ·{' '}
            <a href="tel:+56993250697">+56 9 9325 0697</a>
            <br />
            <a href="mailto:atcchile@atcchile.cl">atcchile@atcchile.cl</a>
            <br />
            <a href="https://www.atcchile.cl" target="_blank" rel="noreferrer">
              atcchile.cl
            </a>{' '}
            · miembro de{' '}
            <a href="https://www.ifatca.org" target="_blank" rel="noreferrer">
              IFATCA
            </a>{' '}
            desde 1998
          </address>

          <nav className={styles.social} aria-label="Redes del Colegio ATC Chile">
            {SOCIAL.map((network) => (
              <a
                key={network.label}
                className={styles.socialLink}
                href={network.href}
                target="_blank"
                rel="noreferrer"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d={network.path} />
                </svg>
                {network.label}
              </a>
            ))}
          </nav>
        </section>
      </div>

      {/*
        El logo y los colores son del Colegio y la herramienta se hace para ellos, pero el
        repositorio es publico: alguien que llegue de fuera no tiene por que distinguir una
        herramienta docente en desarrollo de doctrina publicada. Cuesta una linea decirlo.
      */}
      <p className={styles.legal}>
        Herramienta docente en desarrollo. No es un sitio oficial del Colegio ni sustituye la
        documentación aeronáutica vigente (AIP Chile).
      </p>
    </footer>
  );
}
