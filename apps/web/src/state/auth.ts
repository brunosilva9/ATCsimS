/**
 * Quien esta logueado, via Firebase Auth (email y contraseña).
 *
 * Por ahora esto es solo control de acceso: cualquier cuenta valida entra igual, sin distincion
 * de rol (eso lo sigue eligiendo el menu, como siempre). Las cuentas las crea el instructor a
 * mano desde la Consola Firebase > Authentication > Users > Add user — no hay pantalla de
 * registro propia todavia.
 */

import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { create } from 'zustand';

import { auth } from '../lib/firebase.js';

export interface AuthState {
  readonly user: User | null;
  /** true hasta que Firebase confirma si hay sesion guardada. Evita un parpadeo al login. */
  readonly loading: boolean;
  readonly error: string | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly resetPassword: (email: string) => Promise<void>;
  readonly clearError: () => void;
}

function authErrorMessage(err: unknown): string {
  const code = err instanceof Object && 'code' in err ? String(err.code) : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Probá de nuevo en unos minutos.';
    default:
      return 'No se pudo completar la operación. Probá de nuevo.';
  }
}

export const useAuthStore = create<AuthState>((set) => {
  onAuthStateChanged(auth, (user) => set({ user, loading: false }));

  return {
    user: null,
    loading: true,
    error: null,

    async signIn(email, password) {
      set({ error: null });
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        set({ error: authErrorMessage(err) });
        throw err;
      }
    },

    async signOut() {
      await firebaseSignOut(auth);
    },

    async resetPassword(email) {
      set({ error: null });
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (err) {
        set({ error: authErrorMessage(err) });
        throw err;
      }
    },

    clearError() {
      set({ error: null });
    },
  };
});
