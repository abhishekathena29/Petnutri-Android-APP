import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const apps = getApps();
const app = apps.length === 0 ? initializeApp(firebaseConfig) : getApp();
const shouldInitNativeInstances = apps.length === 0;

// For Expo, getAuth works fine - Firebase v9+ handles React Native persistence automatically
// No need for getReactNativePersistence in Expo environment
const auth = getAuth(app);

const db = shouldInitNativeInstances
  ? initializeFirestore(app, {
      localCache: persistentLocalCache(),
    })
  : getFirestore(app);

export { app, auth, db };

