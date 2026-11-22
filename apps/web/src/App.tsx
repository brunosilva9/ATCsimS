import { type ReactElement, Suspense, lazy, useEffect } from 'react';
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
import { canUseBank, useRoleStore } from './state/role.js';
import styles from './App.module.css';

// Solo la abre admin y trae el markdown del backlog con su conversor: no va en la carga inicial.
const Backlog = lazy(() => import('./routes/Backlog.js').then((m) => ({ default: m.Backlog })));

/**
 * Las dos columnas del menu son los dos roles del documento funcional. `access` dice quien ve el
 * enlace; la ruta lo vuelve a exigir abajo, y firestore.rules es lo que de verdad lo impide.
 */
const LINKS = [
  { to: '/exercise', label: 'Ejercicio', role: 'Alumno', hint: 'Controlar: instruir y separar', access: 'all' },
  { to: '/scenarios', label: 'Ejercicios', role: 'Instructor', hint: 'Armar, guardar y compartir', access: 'bank' },
  { to: '/runs', label: 'Corrección', role: 'Instructor', hint: 'Revisar una entrega', access: 'all' },
  { to: '/navdata', label: 'Navegación', role: null, hint: 'Fixes, procedimientos, performance', access: 'all' },
  { to: '/strips', label: 'Strips', role: null, hint: 'La ficha aislada', access: 'all' },
  { to: '/admin', label: 'Administración', role: 'Admin', hint: 'Editar toda la base de navegación', access: 'admin' },
  { to: '/backlog', label: 'Backlog', role: 'Admin', hint: 'Lo planificado y los comentarios del ATC', access: 'admin' },
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

  // El banco de ejercicios es compartido entre instructores: sin el rol, ni el link ni la ruta.
  const bank = (element: ReactElement) =>
    roleLoading ? null : canUseBank(role) ? element : <Navigate to="/exercise" replace />;
  const adminOnly = (element: ReactElement) =>
    roleLoading ? null : role === 'admin' ? element : <Navigate to="/exercise" replace />;
  const canSee = (access: (typeof LINKS)[number]['access']) =>
    access === 'all' || (access === 'bank' ? canUseBank(role) : role === 'admin');

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
          {LINKS.filter((link) => canSee(link.access)).map((link) => (
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
          <Route path="/scenarios" element={bank(<Scenarios />)} />
          <Route path="/scenarios/:id" element={bank(<ScenarioEditor />)} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/navdata" element={<NavdataExplorer />} />
          <Route path="/strips" element={<StripGallery />} />
          <Route path="/admin" element={adminOnly(<Admin />)} />
          <Route
            path="/backlog"
            element={adminOnly(
              <Suspense fallback={null}>
                <Backlog />
              </Suspense>
            )}
          />
          <Route path="*" element={<Navigate to="/exercise" replace />} />
        </Routes>
      </main>

      <SiteFooter />
    </div>
  );
}
