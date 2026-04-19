import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Configuración directa de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAyRyntcT4HcD7EJ-plxgJkbpj9kvG-CLY",
  authDomain: "seniortrack-pro-2026.firebaseapp.com",
  projectId: "seniortrack-pro-2026",
  storageBucket: "seniortrack-pro-2026.firebasestorage.app",
  messagingSenderId: "781412647001",
  appId: "1:781412647001:web:ffc77ed655727231d3b148"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore (Base de datos)
export const db = initializeFirestore(app, {});

export const auth = getAuth(app);

// Persistencia para que no se cierre la sesión al recargar
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Error setting persistence:", err);
});

export const googleProvider = new GoogleAuthProvider();

// Funciones de Autenticación
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, pass: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: name });
    return result.user;
  } catch (error) {
    console.error("Error signing up with email:", error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error("Error signing in with email:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Manejo de Errores y Tipos
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  console.error(`Error en Firestore (${operationType}) en ${path}:`, error);
  if (!auth.currentUser && error?.message?.includes('permission')) {
    return;
  }
  throw error;
}

export function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  let date: Date;
  if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp && timestamp.toDate) {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return '...';
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? `hoy a las ${timeStr}` : `${date.toLocaleDateString()} a las ${timeStr}`;
}
