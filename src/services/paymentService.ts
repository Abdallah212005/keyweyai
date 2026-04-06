import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Tier } from './userService';

export enum PaymentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export interface PaymentRequest {
  id?: string;
  uid: string;
  amount: number;
  tier: Tier;
  walletNumber: string;
  status: PaymentStatus;
  receiptUrl?: string;
  createdAt: any;
}

export const paymentService = {
  async createPaymentRequest(uid: string, tier: Tier, walletNumber: string, amount: number): Promise<string> {
    const paymentData: Omit<PaymentRequest, 'id'> = {
      uid,
      tier,
      walletNumber,
      amount,
      status: PaymentStatus.PENDING,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);
    return docRef.id;
  },

  async getUserPayments(uid: string): Promise<PaymentRequest[]> {
    const q = query(
      collection(db, 'payments'), 
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRequest));
  },

  async getAllPendingPayments(): Promise<PaymentRequest[]> {
    const q = query(
      collection(db, 'payments'), 
      where('status', '==', PaymentStatus.PENDING),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRequest));
  },

  async verifyPayment(paymentId: string): Promise<void> {
    const docRef = doc(db, 'payments', paymentId);
    await updateDoc(docRef, { status: PaymentStatus.VERIFIED });
  },

  async rejectPayment(paymentId: string): Promise<void> {
    const docRef = doc(db, 'payments', paymentId);
    await updateDoc(docRef, { status: PaymentStatus.REJECTED });
  }
};
