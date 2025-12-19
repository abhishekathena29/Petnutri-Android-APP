import { useUserCollection } from '@/hooks/use-user-collection';
import { CattleProfile } from '@/types/models';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { useAuth } from './AuthContext';

interface SelectedCattleContextShape {
  selectedCattle: (CattleProfile & { id: string }) | null;
  setSelectedCattle: (cattle: (CattleProfile & { id: string }) | null) => void;
  cattle: Array<CattleProfile & { id: string }>;
  loading: boolean;
}

const SelectedCattleContext = createContext<SelectedCattleContextShape | undefined>(undefined);

export const SelectedCattleProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { data: cattle, loading } = useUserCollection<CattleProfile>('cattle', { orderByField: 'createdAt' });
  const [selectedCattle, setSelectedCattleState] = useState<(CattleProfile & { id: string }) | null>(null);

  // Don't auto-load selected cattle - user must explicitly select on select-profile page
  // This ensures users always see the profile selection page after login

  const setSelectedCattle = useCallback(async (cattle: (CattleProfile & { id: string }) | null) => {
    setSelectedCattleState(cattle);
    if (user) {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (cattle) {
          await AsyncStorage.setItem(`selectedCattle_${user.uid}`, cattle.id);
        } else {
          await AsyncStorage.removeItem(`selectedCattle_${user.uid}`);
        }
      } catch (error) {
        console.error('Error saving selected cattle:', error);
      }
    }
  }, [user]);

  const value: SelectedCattleContextShape = {
    selectedCattle,
    setSelectedCattle,
    cattle: cattle as Array<CattleProfile & { id: string }>,
    loading,
  };

  return <SelectedCattleContext.Provider value={value}>{children}</SelectedCattleContext.Provider>;
};

export const useSelectedCattle = () => {
  const context = useContext(SelectedCattleContext);
  if (!context) {
    throw new Error('useSelectedCattle must be used within a SelectedCattleProvider');
  }
  return context;
};
