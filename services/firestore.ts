import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '@/services/firebase';

const userCollectionPath = (uid: string, collectionName: string) => collection(db, 'users', uid, collectionName);

export const addUserDocument = async <T extends Record<string, unknown>>(uid: string, collectionName: string, payload: T) => {
  // Remove undefined values to avoid Firestore errors
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined)
  );
  
  return addDoc(userCollectionPath(uid, collectionName), {
    ...cleanPayload,
    createdAt: serverTimestamp(),
  });
};

export const updateUserDocument = async <T extends Record<string, unknown>>(uid: string, collectionName: string, docId: string, payload: T) => {
  // Remove undefined values to avoid Firestore errors
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined)
  );
  
  console.log('Updating document:', {
    path: `users/${uid}/${collectionName}/${docId}`,
    payload: cleanPayload
  });
  
  return updateDoc(doc(db, 'users', uid, collectionName, docId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
};

export const deleteUserDocument = async (uid: string, collectionName: string, docId: string) => {
  return deleteDoc(doc(db, 'users', uid, collectionName, docId));
};

