import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  type Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ChatMessage {
  id?: string;
  uid: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Timestamp;
}

export const chatService = {
  async saveMessage(uid: string, role: 'user' | 'assistant', content: string) {
    try {
      await addDoc(collection(db, 'chats'), {
        uid,
        role,
        content,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving chat message:", error);
    }
  },

  subscribeToUserChats(uid: string, callback: (messages: ChatMessage[]) => void) {
    const q = query(
      collection(db, 'chats'),
      where('uid', '==', uid),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      callback(messages);
    }, (error) => {
      console.error("Error subscribing to user chats:", error);
    });
  },

  subscribeToAllChats(callback: (messages: ChatMessage[]) => void) {
    const q = query(
      collection(db, 'chats'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      callback(messages);
    }, (error) => {
      console.error("Error subscribing to all chats:", error);
    });
  }
};
