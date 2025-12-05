import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/services/firebase';

interface UserData {
  uid: string;
  email: string;
  fullName: string;
  createdAt: Date;
}

export const useUserData = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setUserData(snapshot.data() as UserData);
        } else {
          setUserData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Failed to fetch user data', error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  return { userData, loading };
};

