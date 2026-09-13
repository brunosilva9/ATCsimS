import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Exercise } from './routes/Exercise.js';
import { NavdataExplorer } from './routes/NavdataExplorer.js';
import { Print } from './routes/Print.js';
import { Runs } from './routes/Runs.js';
import { ScenarioEditor } from './routes/ScenarioEditor.js';
import { Scenarios } from './routes/Scenarios.js';
import { StripGallery } from './routes/StripGallery.js';
import styles from './App.module.css';

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
        Prototipo. Los datos salen de las planillas de ATC importadas en <code>data/</code>. Las
        mínimas de separación en ruta son provisionales: ver el aviso en la lista de conflictos.
      </footer>
    </div>
  );
}
