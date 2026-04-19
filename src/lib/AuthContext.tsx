import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  linkedSeniorProfile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  justRegistered: boolean;
  setJustRegistered: (val: boolean) => void;
  setRole: (role: UserRole, pairingCode?: string, name?: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  linkByCode: (code: string) => Promise<{ success: boolean; message: string; seniorName?: string; caregiverName?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [linkedSeniorProfile, setLinkedSeniorProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubSenior: (() => void) | null = null;

    // Safety timeout for loading state to prevent hanging on connection issues
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn("AuthContext: Loading timeout reached. Proceeding with current state.");
        setLoading(false);
      }
    }, 10000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      // Clean up previous listeners
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubSenior) {
        unsubSenior();
        unsubSenior = null;
      }

      if (firebaseUser) {
        // Small delay to allow Firestore connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const profileRef = doc(db, 'users', firebaseUser.uid);
        unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            setProfile(userData);

            // If family member, listen to linked senior's profile
            if (userData.role === 'family' && userData.linkedSeniorId) {
              // Clean up previous senior listener if it changed
              if (unsubSenior) unsubSenior();
              
              const seniorRef = doc(db, 'users', userData.linkedSeniorId);
              unsubSenior = onSnapshot(seniorRef, (seniorSnap) => {
                if (seniorSnap.exists()) {
                  setLinkedSeniorProfile(seniorSnap.data() as UserProfile);
                }
              }, (error) => {
                // Only log if we still have a user (ignore errors during logout)
                if (auth.currentUser) {
                  handleFirestoreError(error, OperationType.GET, `users/${userData.linkedSeniorId}`);
                }
              });
            } else {
              setLinkedSeniorProfile(null);
            }
          } else {
            setProfile(null);
            setLinkedSeniorProfile(null);
          }
          setLoading(false);
        }, (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLinkedSeniorProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      clearTimeout(loadingTimeout);
      if (unsubProfile) unsubProfile();
      if (unsubSenior) unsubSenior();
    };
  }, []);

  const generatePairingCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const setRole = async (role: UserRole, pairingCode?: string, name?: string) => {
    if (!user) return;
    const profileRef = doc(db, 'users', user.uid);
    let familyDocRef: any = null;
    try {
      // If caregiver and code provided, validate code
      if (role === 'caregiver' && pairingCode) {
        const q = query(
          collection(db, 'users'), 
          where('role', '==', 'family'),
          where('pairingCode', '==', pairingCode.toUpperCase()),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          throw new Error('Código de vinculación inválido');
        }
        familyDocRef = querySnapshot.docs[0].ref;
      }
    } catch (error: any) {
      if (error.message === 'Código de vinculación inválido') {
        throw error;
      }
      handleFirestoreError(error, OperationType.LIST, 'users_pairing_query');
      throw error;
    }

    try {
      const docSnap = await getDoc(profileRef);
      
      const finalName = name || user.displayName || profile?.name || 'Usuario';

      if (docSnap.exists()) {
        await setDoc(profileRef, { 
          role,
          name: finalName
        }, { merge: true });
      } else {
        const newProfile: any = {
          uid: user.uid,
          name: finalName,
          email: user.email || '',
          role,
          photoURL: user.photoURL || '',
          seniorInfo: {
            name: finalName, // Use the name for the senior info too if it's a caregiver
            age: 82,
            bloodType: 'O+',
            chronicDiseases: ['Diabetes Tipo 2', 'Hipertensión Arterial'],
            allergies: ['Penicilina', 'Mariscos']
          }
        };

        if (role === 'family') {
          newProfile.pairingCode = generatePairingCode();
        } else if (role === 'caregiver' && familyDocRef) {
          newProfile.linkedFamilyUids = [familyDocRef.id];
        }

        await setDoc(profileRef, newProfile);
        setJustRegistered(true);

        // If caregiver, complete the link on the family side too
        if (role === 'caregiver' && familyDocRef) {
          await updateDoc(familyDocRef, {
            linkedSeniorId: user.uid
          });
        }

      }
    } catch (error: any) {
      if (error.message === 'Código de vinculación inválido') {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const profileRef = doc(db, 'users', user.uid);
    try {
      await setDoc(profileRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const linkByCode = async (code: string): Promise<{ success: boolean; message: string; seniorName?: string; caregiverName?: string }> => {
    if (!user || !profile || profile.role !== 'caregiver') {
      return { success: false, message: 'Usuario no autorizado' };
    }

    try {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'family'),
        where('pairingCode', '==', code.toUpperCase()),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, message: 'Código de vinculación inválido' };
      }

      const familyDoc = querySnapshot.docs[0];
      const familyData = familyDoc.data() as UserProfile;
      const familyName = familyData.name || 'Familiar';
      const seniorName = profile.seniorInfo?.name || 'Paciente';

      if (profile.linkedFamilyUids && profile.linkedFamilyUids.length >= 2) {
        return { success: false, message: 'Ya tienes el máximo de familiares vinculados (2)' };
      }

      // Link family to caregiver
      await updateDoc(familyDoc.ref, {
        linkedSeniorId: user.uid
      });

      // Link caregiver to family
      await updateDoc(doc(db, 'users', user.uid), {
        linkedFamilyUids: arrayUnion(familyDoc.id)
      });

      return { success: true, message: 'Vinculación exitosa', seniorName, caregiverName: familyName };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users/link');
      return { success: false, message: 'Error al procesar la vinculación' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      linkedSeniorProfile,
      loading, 
      isAuthReady, 
      justRegistered,
      setJustRegistered,
      setRole, 
      updateProfile, 
      linkByCode 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
