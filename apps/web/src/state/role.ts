/**
 * El rol del usuario logueado, de la coleccion `users` (doc ID = uid de Firebase Auth).
 *
 * `admin` habilita /admin. `instructor` (y `admin`) habilita el banco de ejercicios, que es
 * compartido y no lo debe ver un alumno antes de la prueba (ver lib/storage.ts). `student`, o no
 * tener documento en `users`, deja el resto de la app: ejercicio, navegacion, strips.
 *
 * No hay pantalla para asignar el rol: el primer admin se crea a mano en Consola Firebase
 * (Firestore Database > coleccion `users` > documento con ID = el uid, `{ role: "admin" }") — ver
 * README.md > Acceso.
 */

import { doc, getDoc } from 'firebase/firestore';
import { create } from 'zustand';

import { db } from '../lib/firebase.js';

export type Role = 'admin' | 'instructor' | 'student';

/** Quien puede leer y escribir el banco de ejercicios. Mismo criterio que isInstructor() en firestore.rules. */
export const canUseBank = (role: Role | null): boolean => role === 'instructor' || role === 'admin';

export interface RoleState {
  readonly role: Role | null;
  readonly loading: boolean;
  readonly load: (uid: string) => Promise<void>;
  readonly clear: () => void;
}

export const useRoleStore = create<RoleState>((set) => ({
  role: null,
  loading: true,

  load: async (uid) => {
    set({ loading: true });
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const data = snap.exists() ? (snap.data() as { role?: Role }) : null;
      set({ role: data?.role ?? null, loading: false });
    } catch {
      set({ role: null, loading: false });
    }
  },

  clear: () => set({ role: null, loading: true }),
}));
