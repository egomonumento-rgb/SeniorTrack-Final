export type UserRole = 'caregiver' | 'family';

export interface SeniorInfo {
  name: string;
  age: number;
  bloodType: string;
  chronicDiseases: string[];
  allergies: string[];
  lastUpdate?: any;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  relationship?: string; // For family members: 'Hijo/a', 'Cónyuge', etc.
  seniorInfo?: SeniorInfo;
  linkedSeniorId?: string; // The UID of the caregiver who manages the senior
  pairingCode?: string; // Unique code for caregivers to share with family
  linkedFamilyUids?: string[]; // List of family members linked to this caregiver (max 2)
  emergencyContacts?: {
    police: string;
    medical: string;
  };
}

export type MedicationStatus = 'pending' | 'completed' | 'skipped';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;
  status: MedicationStatus;
  lastAdministered?: any; // Firestore Timestamp
  inventoryCount?: number;
  notes?: string;
}

export interface Appointment {
  id: string;
  doctor: string;
  specialty: string;
  date: any; // Firestore Timestamp
  time: string;
  location?: string;
  notes?: string;
  attended?: boolean;
}

export type VitalType = 'bp' | 'heart' | 'oxygen' | 'temp' | 'weight' | 'glucose' | 'sleep';

export interface VitalSign {
  id: string;
  type: VitalType;
  value: string;
  timestamp: any; // Firestore Timestamp
  unit?: string;
  isAlert?: boolean;
  alertMessage?: string;
}

export interface GeofenceStatus {
  center?: { lat: number; lng: number };
  radius?: number;
  status: 'safe' | 'unsafe';
  lastUpdate?: any; // Firestore Timestamp
  statusText?: string;
  distance?: number;
  currentLat?: number;
  currentLng?: number;
  currentLocation?: {
    lat: number;
    lng: number;
    address: string;
  };
  medsReplenishmentRequested?: boolean;
}

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
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
