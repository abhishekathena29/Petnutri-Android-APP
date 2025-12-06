import { User, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { auth, db } from '@/services/firebase';

interface AuthContextShape {
  user: User | null;
  initializing: boolean;
  isSigningUp: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (params: { email: string; password: string; fullName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email ?? 'null');
      setUser(firebaseUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    console.log('Login attempt:', email);
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    console.log('Login success:', result.user.email);
  }, []);

  const signup = useCallback(async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
    console.log('Signup attempt:', email);
    setIsSigningUp(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      if (fullName) {
        await updateProfile(credential.user, { displayName: fullName });
      }

      await setDoc(
        doc(db, 'users', credential.user.uid),
        {
          uid: credential.user.uid,
          email: credential.user.email,
          fullName,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      console.log('Signup success, signing out for login');
      // Sign out after signup so user can login with their new credentials
      await signOut(auth);
    } finally {
      setIsSigningUp(false);
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('Logout attempt');
    await signOut(auth);
    console.log('Logout success');
  }, []);

  const value: AuthContextShape = {
    user,
    initializing,
    isSigningUp,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
