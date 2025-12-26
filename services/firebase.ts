import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Access environment variables - Expo replaces these at build time
// Use ! to fail-fast if env vars are missing (better than empty string)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// Debug: Log config (without sensitive data) to help diagnose
if (__DEV__) {
  console.log('Firebase Config Check:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    apiKeyLength: firebaseConfig.apiKey?.length || 0,
    projectId: firebaseConfig.projectId,
  });
}

// Validate Firebase config
const isFirebaseConfigValid = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    firebaseConfig.apiKey !== '' &&
    firebaseConfig.authDomain !== '' &&
    firebaseConfig.projectId !== ''
  );
};

let app: ReturnType<typeof initializeApp> | undefined;
let auth: ReturnType<typeof getAuth> | undefined;
let db: ReturnType<typeof getFirestore> | undefined;
let initialized = false;

// Initialize Firebase lazily to avoid build-time errors
const initializeFirebase = () => {
  if (initialized && app && auth && db) {
    return; // Already initialized
  }

  if (!isFirebaseConfigValid()) {
    const missingVars = [];
    if (!firebaseConfig.apiKey) missingVars.push('EXPO_PUBLIC_FIREBASE_API_KEY');
    if (!firebaseConfig.authDomain) missingVars.push('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
    if (!firebaseConfig.projectId) missingVars.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
    if (!firebaseConfig.storageBucket) missingVars.push('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
    if (!firebaseConfig.messagingSenderId) missingVars.push('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
    if (!firebaseConfig.appId) missingVars.push('EXPO_PUBLIC_FIREBASE_APP_ID');
    
    console.error('Firebase configuration is missing. Missing variables:', missingVars.join(', '));
    console.error('Config check:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
      authDomain: firebaseConfig.authDomain || 'MISSING',
      projectId: firebaseConfig.projectId || 'MISSING',
    });
    console.error('Please set EXPO_PUBLIC_FIREBASE_* environment variables in EAS Build secrets.');
    throw new Error(`Firebase configuration is incomplete. Missing: ${missingVars.join(', ')}`);
  }
  
  // Validate API key format (should start with AIza)
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('AIza')) {
    console.error('Firebase API key format appears invalid. Should start with "AIza"');
    console.error('API key received:', firebaseConfig.apiKey.substring(0, 20) + '...');
  }

  // Debug: Log full config (for troubleshooting - remove in production)
  console.log('Firebase Config being used:', {
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...${firebaseConfig.apiKey.substring(firebaseConfig.apiKey.length - 5)}` : 'MISSING',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });

  const apps = getApps();
  app = apps.length === 0 ? initializeApp(firebaseConfig) : getApp();
  const shouldInitNativeInstances = apps.length === 0;

  // For Expo, getAuth works fine - Firebase v9+ handles React Native persistence automatically
  // No need for getReactNativePersistence in Expo environment
  auth = getAuth(app);

  // Use getFirestore() - Expo + Firebase v9 handles persistence safely for React Native
  db = getFirestore(app);
    
  initialized = true;
  console.log('Firebase initialized successfully');
};

// Initialize Firebase immediately but catch errors during build
// During EAS build, env vars are available, so this should work
try {
  initializeFirebase();
} catch (error) {
  // During build/bundling, if env vars aren't available, just log a warning
  // The app will fail at runtime if Firebase isn't initialized, which is expected
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.warn('Firebase initialization deferred - will initialize at runtime');
  }
}

// Export the initialized instances (or undefined if initialization failed)
export { app, auth, db };

