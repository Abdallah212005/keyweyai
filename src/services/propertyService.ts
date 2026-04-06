import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  limit, 
  orderBy, 
  serverTimestamp,
  type DocumentData
} from 'firebase/firestore';
import { db, auth } from '../firebase';

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

export interface Property {
  id?: string;
  title: string;
  location: string;
  price: string;
  rooms: number;
  bathrooms: number;
  size: string;
  features: string[];
  imageUrl: string;
  type: 'apartment' | 'villa' | 'studio' | 'office';
  ownerUid: string;
  companyName?: string;
  createdAt?: any;
}

export const propertyService = {
  async getAllProperties(limitCount = 20): Promise<Property[]> {
    const path = 'properties';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(limitCount));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async searchProperties(criteria: {
    location?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<Property[]> {
    const path = 'properties';
    try {
      let q = query(collection(db, path), limit(20));
      
      // Basic filtering (Firestore has limitations on complex queries without indexes)
      // For now, we'll fetch and filter in memory if needed, or use simple where clauses
      if (criteria.type) {
        q = query(q, where('type', '==', criteria.type));
      }
      
      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      
      // In-memory filtering for more complex criteria
      if (criteria.location) {
        const loc = criteria.location.toLowerCase();
        results = results.filter(p => p.location.toLowerCase().includes(loc));
      }
      
      return results;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async seedInitialData(adminUid: string) {
    const path = 'properties';
    const initialData: Omit<Property, 'id'>[] = [
      {
        title: "Luxury Villa in New Cairo",
        location: "New Cairo, Fifth Settlement",
        price: "15,000,000 EGP",
        rooms: 5,
        bathrooms: 4,
        size: "450 sqm",
        features: ["Private Pool", "Garden", "Smart Home", "Security"],
        imageUrl: "https://picsum.photos/seed/villa1/800/600",
        type: "villa",
        ownerUid: adminUid,
        companyName: "MixAura Real Estate",
        createdAt: serverTimestamp()
      },
      {
        title: "Modern Apartment in Sheikh Zayed",
        location: "Sheikh Zayed, SODIC",
        price: "4,500,000 EGP",
        rooms: 3,
        bathrooms: 2,
        size: "180 sqm",
        features: ["Elevator", "Parking", "Balcony", "Clubhouse Access"],
        imageUrl: "https://picsum.photos/seed/apt1/800/600",
        type: "apartment",
        ownerUid: adminUid,
        companyName: "MixAura Real Estate",
        createdAt: serverTimestamp()
      },
      {
        title: "Cozy Studio in Maadi",
        location: "Maadi, Degla",
        price: "2,500,000 EGP",
        rooms: 1,
        bathrooms: 1,
        size: "75 sqm",
        features: ["Furnished", "City View", "Near Metro"],
        imageUrl: "https://picsum.photos/seed/studio1/800/600",
        type: "studio",
        ownerUid: adminUid,
        companyName: "MixAura Real Estate",
        createdAt: serverTimestamp()
      },
      {
        title: "Prime Office Space in New Administrative Capital",
        location: "New Capital, CBD",
        price: "8,000,000 EGP",
        rooms: 0,
        bathrooms: 2,
        size: "120 sqm",
        features: ["Central AC", "Fiber Optic", "Meeting Rooms", "Reception"],
        imageUrl: "https://picsum.photos/seed/office1/800/600",
        type: "office",
        ownerUid: adminUid,
        companyName: "MixAura Real Estate",
        createdAt: serverTimestamp()
      },
      {
        title: "Apartment in Hadayek October",
        location: "Hadayek October, Italian Quarter",
        price: "2,200,000 EGP",
        rooms: 3,
        bathrooms: 2,
        size: "135 sqm",
        features: ["Elevator", "Security", "Near Services"],
        imageUrl: "https://picsum.photos/seed/oct1/800/600",
        type: "apartment",
        ownerUid: adminUid,
        companyName: "MixAura Real Estate",
        createdAt: serverTimestamp()
      },
      {
        title: "Villa in October Gardens",
        location: "October Gardens, Green Belt",
        price: "7,500,000 EGP",
        rooms: 4,
        bathrooms: 3,
        size: "320 sqm",
        features: ["Private Garden", "Roof", "Security"],
        imageUrl: "https://picsum.photos/seed/oct2/800/600",
        type: "villa",
        ownerUid: adminUid,
        companyName: "MixAura Real Estate",
        createdAt: serverTimestamp()
      },
      {
        title: "Studio in New Cairo",
        location: "New Cairo, Lotus",
        price: "1,800,000 EGP",
        rooms: 1,
        bathrooms: 1,
        size: "65 sqm",
        features: ["Modern Finishing", "Elevator"],
        imageUrl: "https://picsum.photos/seed/nc1/800/600",
        type: "studio",
        ownerUid: adminUid,
        companyName: "MixAura Real Estate",
        createdAt: serverTimestamp()
      }
    ];

    try {
      const existing = await this.getAllProperties(1);
      if (existing.length === 0) {
        for (const item of initialData) {
          await addDoc(collection(db, path), item);
        }
        console.log('Seeded initial property data');
      }
    } catch (error) {
      console.error('Error seeding data:', error);
    }
  }
};
