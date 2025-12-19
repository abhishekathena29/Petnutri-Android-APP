import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument } from '@/services/firestore';
import { CattleProfile, NutritionCalculation } from '@/types/models';

const activityOptions: NutritionCalculation['activityLevel'][] = ['low', 'moderate', 'high'];
const stageOptions: NutritionCalculation['productionStage'][] = ['maintenance', 'lactating', 'pregnant', 'working'];

const initialForm = {
  cattleId: '',
  weightKg: '',
  activityLevel: 'moderate' as NutritionCalculation['activityLevel'],
  productionStage: 'maintenance' as NutritionCalculation['productionStage'],
};

export default function CalculatorScreen() {
  const { user } = useAuth();
  const { selectedCattle: contextSelectedCattle } = useSelectedCattle();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: records, loading } = useUserCollection<NutritionCalculation>('calculations', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);
  const [calculating, setCalculating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Filter records by selected cattle
  const filteredRecords = useMemo(() => {
    if (!contextSelectedCattle) return [];
    return records.filter((r) => r.cattleId === contextSelectedCattle.id);
  }, [records, contextSelectedCattle]);

  // Auto-select cattle from context
  React.useEffect(() => {
    if (contextSelectedCattle && !form.cattleId) {
      setForm((prev) => ({
        ...prev,
        cattleId: contextSelectedCattle.id,
        weightKg: `${contextSelectedCattle.weightKg || ''}`,
      }));
    }
  }, [contextSelectedCattle]);

  const selectedCattle = useMemo(() => herd.find((item) => item.id === form.cattleId), [form.cattleId, herd]);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'cattleId' && value) {
      const meta = herd.find((item) => item.id === value);
      if (meta) {
        setForm((prev) => ({ ...prev, weightKg: `${meta.weightKg || ''}`, cattleId: value }));
      }
    }
  };

  const calculate = async () => {
    if (!user) return;
    if (!selectedCattle && !form.weightKg) {
      setError('Select a cattle or enter weight manually.');
      return;
    }
    setError('');
    setCalculating(true);

    const type = selectedCattle?.type ?? 'cow';
    const weight = Number(form.weightKg || selectedCattle?.weightKg || 0);
    
    // Activity level multipliers
    const activityMultiplier = form.activityLevel === 'low' ? 1 : form.activityLevel === 'moderate' ? 1.2 : 1.4;
    
    // Production stage multipliers
    const stageMultiplier = (() => {
      switch (form.productionStage) {
        case 'lactating':
          return 1.35;
        case 'pregnant':
          return 1.2;
        case 'working':
          return 1.45;
        default:
          return 1;
      }
    })();

    // Base calories calculation (different for cow vs horse)
    const baseCaloriesPerKg = type === 'cow' ? 55 : 60;
    const baseCalories = weight * baseCaloriesPerKg;
    const totalCalories = Math.round(baseCalories * activityMultiplier * stageMultiplier);

    // Protein calculation (grams per kg body weight, adjusted for stage)
    const baseProteinPerKg = type === 'cow' ? 1.1 : 1.2;
    const proteinGrams = Number((weight * baseProteinPerKg * stageMultiplier).toFixed(1));

    // Fiber calculation (grams per kg body weight)
    const baseFiberPerKg = type === 'cow' ? 0.8 : 0.9;
    const fiberGrams = Number((weight * baseFiberPerKg).toFixed(1));

    // Calcium calculation (grams per kg body weight, adjusted for stage)
    const baseCalciumPerKg = type === 'cow' ? 0.06 : 0.05;
    let calciumMultiplier = 1;
    if (form.productionStage === 'lactating') {
      calciumMultiplier = 1.5; // Higher calcium for lactating
    } else if (form.productionStage === 'pregnant') {
      calciumMultiplier = 1.3; // Higher calcium for pregnant
    }
    const calciumGrams = Number((weight * baseCalciumPerKg * calciumMultiplier).toFixed(2));

    const minerals = form.productionStage === 'lactating' 
      ? 'Boost calcium & phosphorus' 
      : form.productionStage === 'pregnant' 
      ? 'Add selenium + vitamin E' 
      : 'Standard mineral mix';

    const payload: NutritionCalculation = {
      cattleId: selectedCattle?.id ?? 'manual',
      cattleName: selectedCattle?.name ?? 'Manual entry',
      type,
      weightKg: weight,
      activityLevel: form.activityLevel,
      productionStage: form.productionStage,
      totalCalories,
      proteinGrams,
      fiberGrams,
      calciumGrams,
      minerals,
    };

    try {
      await addUserDocument(user.uid, 'calculations', payload);
      setForm(initialForm);
      // Show success message
      Alert.alert('Success', 'Calculation saved to history!');
    } catch (err) {
      console.error(err);
      setError('Something went wrong while saving calculation.');
    } finally {
      setCalculating(false);
    }
  };

  const handleDelete = async (recordId: string, cattleName: string) => {
    if (!user) return;

    Alert.alert('Delete Calculation', `Are you sure you want to delete the calculation for ${cattleName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(recordId);
          try {
            await deleteUserDocument(user.uid, 'calculations', recordId);
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to delete. Please try again.');
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionCard title="Daily Nutrition Calculator">
          <Text style={styles.helper}>Calculate daily calories, protein, fiber, and calcium requirements based on activity level and production stage.</Text>
          
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Cattle Name</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller}>
              {herd.length === 0 ? (
                <Text style={styles.helper}>Create cattle first.</Text>
              ) : (
                herd.map((cattle) => (
                  <Pressable
                    key={cattle.id}
                    style={[styles.cattleChip, form.cattleId === cattle.id && styles.cattleChipActive]}
                    onPress={() => handleChange('cattleId', cattle.id!)}
                  >
                    <Text style={[styles.cattleChipText, form.cattleId === cattle.id && styles.cattleChipTextActive]}>
                      {cattle.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>

          <FormField
            label="Weight (kg)"
            placeholder="600"
            keyboardType="numeric"
            value={form.weightKg}
            onChangeText={(text) => setForm((prev) => ({ ...prev, weightKg: text }))}
            editable={!form.cattleId}
            style={!form.cattleId ? undefined : styles.disabledInput}
          />

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Activity Level</Text>
            <View style={styles.toggleRow}>
              {activityOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.optionChip, form.activityLevel === option && styles.optionChipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, activityLevel: option }))}
                >
                  <Text style={[styles.optionText, form.activityLevel === option && styles.optionTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Production Stage</Text>
            <View style={styles.toggleRow}>
              {stageOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.optionChip, form.productionStage === option && styles.optionChipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, productionStage: option }))}
                >
                  <Text style={[styles.optionText, form.productionStage === option && styles.optionTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, calculating && { opacity: 0.6 }]} onPress={calculate} disabled={calculating}>
            <Text style={styles.primaryText}>{calculating ? 'Calculating…' : 'Calculate'}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard title="History">
          {loading ? (
            <ActivityIndicator />
          ) : !contextSelectedCattle ? (
            <Text style={styles.helper}>Please select a cattle profile to view calculations.</Text>
          ) : filteredRecords.length === 0 ? (
            <Text style={styles.helper}>No calculations stored yet.</Text>
          ) : (
            filteredRecords.map((entry) => (
              <View key={entry.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyName}>{entry.cattleName}</Text>
                    <Text style={styles.historyMeta}>
                      {entry.type} • {entry.weightKg} kg • {entry.activityLevel} activity • {entry.productionStage}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => entry.id && handleDelete(entry.id, entry.cattleName)}
                    disabled={deleting === entry.id}
                  >
                    {deleting === entry.id ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    )}
                  </Pressable>
                </View>
                <View style={styles.metricsRow}>
                  <Metric 
                    label="Calories" 
                    value={`${entry.totalCalories} kcal`} 
                    description="Daily energy requirement for metabolism and activity"
                  />
                  <Metric 
                    label="Protein" 
                    value={`${entry.proteinGrams} g`} 
                    description="Essential for muscle maintenance and growth"
                  />
                </View>
                <View style={styles.metricsRow}>
                  <Metric 
                    label="Fiber" 
                    value={`${entry.fiberGrams} g`} 
                    description="Supports digestive health and gut function"
                  />
                  <Metric 
                    label="Calcium" 
                    value={`${entry.calciumGrams || 0} g`} 
                    description="Critical for bone strength and milk production"
                  />
                </View>
                <Text style={styles.historyMineral}>{entry.minerals}</Text>
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const Metric = ({ label, value, description }: { label: string; value: string; description?: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    {description && <Text style={styles.metricDescription}>{description}</Text>}
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
    paddingBottom: 60,
  },
  helper: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 12,
  },
  labelContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#312E81',
  },
  scroller: {
    marginVertical: 8,
  },
  cattleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A5B4FC',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  cattleChipActive: {
    backgroundColor: '#E0E7FF',
  },
  cattleChipText: {
    color: '#4338CA',
    fontWeight: '600',
  },
  cattleChipTextActive: {
    color: '#312E81',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  optionChipActive: {
    backgroundColor: '#EEF2FF',
  },
  optionText: {
    color: '#4338CA',
  },
  optionTextActive: {
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#4338CA',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    marginTop: 6,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  historyMeta: {
    color: '#4338CA',
    fontSize: 13,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6366F1',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 4,
  },
  metricDescription: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 14,
  },
  historyMineral: {
    color: '#312E81',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 8,
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
});
