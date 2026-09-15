/**
 * Puerta de entrada: sin sesión, no se ve ninguna otra pantalla (ver App.tsx). No hay registro
 * propio — las cuentas las crea el instructor a mano en la Consola Firebase.
 */

import { type FormEvent, useState } from 'react';

import { useAuthStore } from '../state/auth.js';
import styles from './Login.module.css';

export function Login() {
  const { signIn, resetPassword, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResetSent(false);
    try {
      await signIn(email, password);
    } catch {
      // el error ya queda en el store; no hay nada mas que hacer aca
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) {
      clearError();
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      // el error ya queda en el store
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <img className={styles.logo} src="./logo.png" alt="ATC Chile" width={64} height={48} />
        <h1 className={styles.title}>ATCsimS</h1>
        <p className={styles.subtitle}>Simulador de ejercicios APP/ACC — TMA Santiago</p>

        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}
        {resetSent ? (
          <p className={styles.notice}>Te mandamos un email para restablecer la contraseña.</p>
        ) : null}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        <button type="button" className={styles.link} onClick={handleReset} disabled={busy}>
          Olvidé mi contraseña
        </button>

        <p className={styles.hint}>
          ¿No tenés cuenta? Pedile al instructor que te cree una.
        </p>
      </form>
    </div>
  );
}
