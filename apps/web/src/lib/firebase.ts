/**
 * Inicializa el SDK web de Firebase, una sola vez para toda la app.
 *
 * La config (apiKey, projectId...) no es secreta: identifica el proyecto, no da permisos por si
 * sola, y de todos modos termina en el bundle del navegador. Sale de apps/web/.env.local (ver
 * .env.example), nunca a mano en el codigo, para poder tener un proyecto de prueba y otro real
 * sin tocar una linea.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(firebaseApp);
