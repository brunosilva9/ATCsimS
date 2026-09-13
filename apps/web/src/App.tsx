import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Exercise } from './routes/Exercise.js';
import { NavdataExplorer } from './routes/NavdataExplorer.js';
import { Print } from './routes/Print.js';
import { Runs } from './routes/Runs.js';
import { ScenarioEditor } from './routes/ScenarioEditor.js';
import { Scenarios } from './routes/Scenarios.js';
import { StripGallery } from './routes/StripGallery.js';
import styles from './App.module.css';

/**
 * Las redes y los datos de contacto del Colegio, tal como estan publicados en atcchile.cl.
 * Van aqui y no repartidos por la interfaz para que se corrijan en un solo sitio si cambian.
 */
const SOCIAL = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/Colegio_atc_chile',
    // Iconos dibujados a mano, no una libreria: son cuatro y no compensa cargar un paquete.
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

/** Las dos columnas del menu son los dos roles del documento funcional. */
const LINKS = [
  { to: '/exercise', label: 'Ejercicio', role: 'Alumno', hint: 'Controlar: instruir y separar' },
  { to: '/scenarios', label: 'Ejercicios', role: 'Instructor', hint: 'Armar, guardar y compartir' },
  { to: '/runs', label: 'Corrección', role: 'Instructor', hint: 'Revisar una entrega' },
  { to: '/navdata', label: 'Navegación', role: null, hint: 'Fixes, procedimientos, performance' },
  { to: '/strips', label: 'Strips', role: null, hint: 'La ficha aislada' },
] as const;

export function App() {
  const { pathname } = useLocation();
  // La vista de impresion es papel: no lleva ni cabecera ni pie.
  const bare = pathname.startsWith('/print');

  if (bare) {
    return (
      <Routes>
        <Route path="/print" element={<Print />} />
      </Routes>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logo} src="./logo.png" alt="ATC Chile" width={64} height={48} />
          <div>
            <h1 className={styles.title}>ATCsimS</h1>
            <p className={styles.subtitle}>
              Simulador de ejercicios APP/ACC — TMA Santiago, configuración SUR
            </p>
          </div>
        </div>
        <nav className={styles.nav}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              title={link.hint}
              className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
            >
              {link.label}
              {link.role !== null ? <span className={styles.role}>{link.role}</span> : null}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/exercise" replace />} />
          <Route path="/exercise" element={<Exercise />} />
          <Route path="/scenarios" element={<Scenarios />} />
          <Route path="/scenarios/:id" element={<ScenarioEditor />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/navdata" element={<NavdataExplorer />} />
          <Route path="/strips" element={<StripGallery />} />
          <Route path="*" element={<Navigate to="/exercise" replace />} />
        </Routes>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.org}>
            <p className={styles.orgName}>
              Colegio de Controladores de Tránsito Aéreo de Chile
            </p>
            <p className={styles.orgLine}>
              Román Díaz 1913, Ñuñoa, Santiago · <a href="tel:+56222257489">+56 2 2225 7489</a> ·{' '}
              <a href="mailto:atcchile@atcchile.cl">atcchile@atcchile.cl</a>
              <br />
              Miembro de <a href="http://www.ifatca.org">IFATCA</a> desde 1998 ·{' '}
              <a href="https://www.atcchile.cl">atcchile.cl</a>
            </p>
          </div>

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
        </div>

        <p className={styles.footerNotes}>
          Prototipo de entrenamiento. Los datos salen de las planillas de ATC importadas en{' '}
          <code>data/</code>. Las mínimas de separación en ruta son provisionales: ver el aviso en
          la lista de conflictos.
        </p>
        {/*
          El logo y los colores son del Colegio y la herramienta se hace para ellos, pero esto no
          es su sitio y no publica nada oficial. Decirlo aqui cuesta una linea y evita que alguien
          que llegue de fuera lo tome por doctrina publicada.
        */}
        <p className={styles.footerNotes}>
          Herramienta docente en desarrollo; no es un sitio oficial del Colegio ni sustituye la
          documentación aeronáutica vigente.
        </p>
      </footer>
    </div>
  );
}
