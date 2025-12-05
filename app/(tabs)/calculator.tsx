import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument } from '@/services/firestore';
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
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: records, loading } = useUserCollection<NutritionCalculation>('calculations', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<NutritionCalculation | null>(null);
  const [error, setError] = useState('');

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
    const activityMultiplier = form.activityLevel === 'low' ? 1 : form.activityLevel === 'moderate' ? 1.2 : 1.4;
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

    const baseCalories = weight * (type === 'cow' ? 55 : 60);
    const totalCalories = Math.round(baseCalories * activityMultiplier * stageMultiplier);
    const proteinGrams = Number((weight * 1.1 * stageMultiplier).toFixed(1));
    const fiberGrams = Number((weight * 0.8).toFixed(1));
    const minerals = form.productionStage === 'lactating' ? 'Boost calcium & phosphorus' : form.productionStage === 'pregnant' ? 'Add selenium + vitamin E' : 'Standard mineral mix';

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
      minerals,
    };

    try {
      await addUserDocument(user.uid, 'calculations', payload);
      setResult(payload);
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setError('Something went wrong while saving calculation.');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionCard title="Nutrition calculator">
          <Text style={styles.helper}>Use herd data to auto-fill weight or enter it manually.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller}>
            {herd.length === 0 ? (
              <Text style={styles.helper}>Create cattle first.</Text>
            ) : (
              herd.map((cattle) => (
                <Pressable key={cattle.id} style={[styles.cattleChip, form.cattleId === cattle.id && styles.cattleChipActive]} onPress={() => handleChange('cattleId', cattle.id!)}>
                  <Text style={[styles.cattleChipText, form.cattleId === cattle.id && styles.cattleChipTextActive]}>{cattle.name}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <FormField
            label="Weight (kg)"
            placeholder="600"
            keyboardType="numeric"
            value={form.weightKg}
            onChangeText={(text) => setForm((prev) => ({ ...prev, weightKg: text }))}
          />

          <Text style={styles.label}>Activity level</Text>
          <View style={styles.toggleRow}>
            {activityOptions.map((option) => (
              <Pressable key={option} style={[styles.optionChip, form.activityLevel === option && styles.optionChipActive]} onPress={() => setForm((prev) => ({ ...prev, activityLevel: option }))}>
                <Text style={[styles.optionText, form.activityLevel === option && styles.optionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Production stage</Text>
          <View style={styles.toggleRow}>
            {stageOptions.map((option) => (
              <Pressable key={option} style={[styles.optionChip, form.productionStage === option && styles.optionChipActive]} onPress={() => setForm((prev) => ({ ...prev, productionStage: option }))}>
                <Text style={[styles.optionText, form.productionStage === option && styles.optionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, calculating && { opacity: 0.6 }]} onPress={calculate} disabled={calculating}>
            <Text style={styles.primaryText}>{calculating ? 'Calculating…' : 'Calculate requirement'}</Text>
          </Pressable>

          {result ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Latest calculation</Text>
              <Text style={styles.resultSubtitle}>{result.cattleName}</Text>
              <View style={styles.metricsRow}>
                <Metric label="Calories" value={`${result.totalCalories} kcal`} />
                <Metric label="Protein" value={`${result.proteinGrams} g`} />
                <Metric label="Fiber" value={`${result.fiberGrams} g`} />
              </View>
              <Text style={styles.resultNote}>{result.minerals}</Text>
            </View>
          ) : null}
        </SectionCard>

        <SectionCard title="History">
          {loading ? (
            <ActivityIndicator />
          ) : records.length === 0 ? (
            <Text style={styles.helper}>No calculations stored yet.</Text>
          ) : (
            records.map((entry) => (
              <View key={entry.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyName}>{entry.cattleName}</Text>
                  <Tag label={entry.productionStage} tone="primary" />
                </View>
                <Text style={styles.historyMeta}>
                  {entry.type} • {entry.activityLevel} activity
                </Text>
                <View style={styles.metricsRow}>
                  <Metric label="Calories" value={`${entry.totalCalories} kcal`} />
                  <Metric label="Protein" value={`${entry.proteinGrams} g`} />
                  <Metric label="Fiber" value={`${entry.fiberGrams} g`} />
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

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
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
  },
  scroller: {
    marginVertical: 12,
  },
  cattleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A5B4FC',
    marginRight: 10,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
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
  resultCard: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    backgroundColor: '#EEF2FF',
    padding: 16,
  },
  resultTitle: {
    fontSize: 14,
    color: '#4338CA',
    fontWeight: '700',
  },
  resultSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 12,
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
    backgroundColor: '#fff',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6366F1',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  resultNote: {
    color: '#4338CA',
    fontWeight: '600',
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
    alignItems: 'center',
    marginBottom: 4,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  historyMeta: {
    color: '#4338CA',
    marginBottom: 8,
  },
  historyMineral: {
    color: '#312E81',
    fontWeight: '600',
  },
});

