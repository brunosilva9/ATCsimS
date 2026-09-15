import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { SiteFooter } from './components/SiteFooter.js';
import { Admin } from './routes/Admin.js';
import { Exercise } from './routes/Exercise.js';
import { Login } from './routes/Login.js';
import { NavdataExplorer } from './routes/NavdataExplorer.js';
import { Print } from './routes/Print.js';
import { Runs } from './routes/Runs.js';
import { ScenarioEditor } from './routes/ScenarioEditor.js';
import { Scenarios } from './routes/Scenarios.js';
import { StripGallery } from './routes/StripGallery.js';
import { useAuthStore } from './state/auth.js';
import { useNavdataStore } from './state/navdata.js';
import { useRoleStore } from './state/role.js';
import styles from './App.module.css';

/** Las dos columnas del menu son los dos roles del documento funcional. */
const LINKS = [
  { to: '/exercise', label: 'Ejercicio', role: 'Alumno', hint: 'Controlar: instruir y separar' },
  { to: '/scenarios', label: 'Ejercicios', role: 'Instructor', hint: 'Armar, guardar y compartir' },
  { to: '/runs', label: 'Corrección', role: 'Instructor', hint: 'Revisar una entrega' },
  { to: '/navdata', label: 'Navegación', role: null, hint: 'Fixes, procedimientos, performance' },
  { to: '/strips', label: 'Strips', role: null, hint: 'La ficha aislada' },
  { to: '/admin', label: 'Administración', role: 'Admin', hint: 'Editar toda la base de navegación' },
] as const;

export function App() {
  const { pathname } = useLocation();
  const { user, loading, signOut } = useAuthStore();
  const { status: navdataStatus, error: navdataError, loadAll } = useNavdataStore();
  const { role, loading: roleLoading, load: loadRole, clear: clearRole } = useRoleStore();

  useEffect(() => {
    if (user && navdataStatus === 'idle') void loadAll();
  }, [user, navdataStatus, loadAll]);

  useEffect(() => {
    if (user) void loadRole(user.uid);
    else clearRole();
  }, [user, loadRole, clearRole]);

  // La vista de impresion es papel: no lleva ni cabecera ni pie.
  const bare = pathname.startsWith('/print');

  // Se restringe el acceso a toda la app, impresion incluida: sin sesion no se ve nada mas.
  if (loading) return null;
  if (!user) return <Login />;

  // La base viene de Firestore: se trae entera una vez por sesion antes de mostrar cualquier
  // pantalla, mismo criterio que antes con los JSON del build, solo que ahora tarda un instante.
  if (navdataStatus === 'idle' || navdataStatus === 'loading') {
    return (
      <div className={styles.loading}>
        <p>Cargando la base de navegación…</p>
      </div>
    );
  }
  if (navdataStatus === 'error') {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingError}>No se pudo cargar la base de navegación.</p>
        <p>{navdataError}</p>
        <button type="button" onClick={() => void loadAll()}>
          Reintentar
        </button>
      </div>
    );
  }

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
          {LINKS.filter((link) => link.to !== '/admin' || role === 'admin').map((link) => (
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
        <div className={styles.account}>
          <span className={styles.accountEmail}>{user.email}</span>
          <button type="button" className={styles.signOut} onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
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
          <Route
            path="/admin"
            element={
              roleLoading ? null : role === 'admin' ? <Admin /> : <Navigate to="/exercise" replace />
            }
          />
          <Route path="*" element={<Navigate to="/exercise" replace />} />
        </Routes>
      </main>

      <SiteFooter />
    </div>
  );
}
