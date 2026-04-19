import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Ensure persistence is set to local (survives browser/device restart)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Error setting persistence:", err);
});

export const googleProvider = new GoogleAuthProvider();

// Listen for online/offline status
window.addEventListener('online', () => console.log('Browser is back online. Firestore will attempt to reconnect.'));
window.addEventListener('offline', () => console.warn('Browser is offline. Firestore will operate in offline mode.'));

// Test connection to Firestore with retries
async function testConnection(retries = 5) {
  // Wait a bit before testing to let the network settle
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  for (let i = 0; i < retries; i++) {
    try {
      // Try to fetch a non-existent doc to trigger a network request
      await getDocFromServer(doc(db, '_connection_test_', 'ping'));
      console.log("Firestore connection established successfully.");
      return;
    } catch (error: any) {
      // If we get a permission-denied or not-found, it means we ARE connected to the backend
      if (error.code === 'permission-denied' || error.code === 'not-found') {
        console.log("Firestore backend reached (Connection verified).");
        return;
      }

      if (error.code === 'unavailable' || error.message?.includes('backend') || error.message?.includes('unavailable')) {
        console.warn(`Firestore connection attempt ${i + 1} failed (unavailable). Retrying in ${2 * (i + 1)}s...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        continue;
      }
      
      console.error("Firestore connection test error:", error.code, error.message);
      return;
    }
  }
  console.warn("Firestore is currently operating in offline mode. It will sync automatically when the connection is restored.");
}
testConnection();

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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isUnavailable = error instanceof Error && (error.message.includes('unavailable') || error.message.includes('Could not reach Cloud Firestore'));
  
  // Ignore permission errors if the user is not authenticated (likely a cleanup race condition)
  if (!auth.currentUser && error instanceof Error && error.message.includes('permission')) {
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Don't throw for unavailable errors to avoid crashing the app during transient network issues
  if (isUnavailable) {
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
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
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  return isToday ? `hoy a las ${timeStr}` : `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} a las ${timeStr}`;
}
