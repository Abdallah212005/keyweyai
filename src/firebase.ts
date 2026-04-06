import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log('Firestore connected successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore connection failed: client is offline. Check configuration.');
    }
  }
}

testConnection();
