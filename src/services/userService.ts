import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum Tier {
  FREE = 'free',
  PLUS = 'plus',
  PREMIUM = 'premium'
}

export enum Role {
  USER = 'user',
  ADMIN = 'admin'
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  tier: Tier;
  role: Role;
  createdAt?: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const userService = {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async createProfile(uid: string, email: string, displayName: string): Promise<UserProfile> {
    const path = `users/${uid}`;
    const isAdmin = email === 'aamr222382@gmail.com';
    const profile: UserProfile = {
      uid,
      email,
      displayName,
      tier: Tier.FREE,
      role: isAdmin ? Role.ADMIN : Role.USER,
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', uid), profile);
      return profile;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async upgradeUser(uid: string, tier: Tier): Promise<void> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, { tier });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }
};
