import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '@/services/firebase';

const userCollectionPath = (uid: string, collectionName: string) => collection(db, 'users', uid, collectionName);

export const addUserDocument = async <T extends Record<string, unknown>>(uid: string, collectionName: string, payload: T) => {
  return addDoc(userCollectionPath(uid, collectionName), {
    ...payload,
    createdAt: serverTimestamp(),
  });
};

export const updateUserDocument = async <T extends Record<string, unknown>>(uid: string, collectionName: string, docId: string, payload: T) => {
  return updateDoc(doc(db, 'users', uid, collectionName, docId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const deleteUserDocument = async (uid: string, collectionName: string, docId: string) => {
  return deleteDoc(doc(db, 'users', uid, collectionName, docId));
};

