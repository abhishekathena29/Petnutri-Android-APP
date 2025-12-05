import { useEffect, useMemo, useState } from 'react';
import { DocumentData, QueryConstraint, collection, onSnapshot, orderBy, query } from 'firebase/firestore';

import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/services/firebase';

interface Options {
  orderByField?: string;
  constraints?: QueryConstraint[];
}

export const useUserCollection = <T extends DocumentData>(collectionName: string, options?: Options) => {
  const { user } = useAuth();
  const [data, setData] = useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = useState(true);

  const queryConstraints = useMemo(() => {
    const base: QueryConstraint[] = [];
    if (options?.orderByField) {
      base.push(orderBy(options.orderByField, 'desc'));
    }
    if (options?.constraints) {
      base.push(...options.constraints);
    }
    return base;
  }, [options?.orderByField, options?.constraints]);

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, 'users', user.uid, collectionName);
    const q = queryConstraints.length ? query(ref, ...queryConstraints) : ref;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as T) })));
        setLoading(false);
      },
      (error) => {
        console.error(`Failed to subscribe to ${collectionName}`, error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [collectionName, queryConstraints, user]);

  return { data, loading };
};

