import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument } from '@/services/firestore';
import { CattleProfile, NutritionCalculation } from '@/types/models';

const activityOptions: NutritionCalculation['activityLevel'][] = ['low', 'moderate', 'high'];
const stageOptions: NutritionCalculation['productionStage'][] = ['maintenance', 'lactating', 'pregnant', 'working'];

// Recipe suggestions data (matching meals.tsx)
type RecipeSuggestion = {
  id: string;
  name: string;
  calories: number;
  icon: keyof typeof Ionicons.glyphMap;
  dietType: string;
};

const horseRecipes: RecipeSuggestion[] = [
  { id: 'horse-raj-1', name: 'Sewan Grass Hay', calories: 4400, icon: 'leaf-outline', dietType: 'maintenance' },
  { id: 'horse-raj-2', name: 'Bajra Grain', calories: 3200, icon: 'flash-outline', dietType: 'performance' },
  { id: 'horse-raj-3', name: 'Wheat Bran', calories: 2700, icon: 'nutrition-outline', dietType: 'maintenance' },
  { id: 'horse-pun-1', name: 'Wheat Straw', calories: 1400, icon: 'fitness-outline', dietType: 'weightLoss' },
  { id: 'horse-pun-2', name: 'Rice Bran', calories: 2400, icon: 'flash-outline', dietType: 'performance' },
  { id: 'horse-pun-3', name: 'Lucerne Hay', calories: 1900, icon: 'trending-up-outline', dietType: 'weightGain' },
  { id: 'horse-guj-1', name: 'Bajra Grain', calories: 3200, icon: 'flash-outline', dietType: 'performance' },
  { id: 'horse-guj-2', name: 'Groundnut Cake', calories: 2200, icon: 'trending-up-outline', dietType: 'weightGain' },
  { id: 'horse-guj-3', name: 'Guar Fodder', calories: 1800, icon: 'leaf-outline', dietType: 'maintenance' },
  { id: 'horse-mah-1', name: 'Jowar Grain', calories: 3200, icon: 'flash-outline', dietType: 'performance' },
  { id: 'horse-mah-2', name: 'Soybean Cake', calories: 2400, icon: 'trending-up-outline', dietType: 'weightGain' },
  { id: 'horse-mah-3', name: 'Sugarcane Tops', calories: 800, icon: 'fitness-outline', dietType: 'weightLoss' },
];

const cowRecipes: RecipeSuggestion[] = [
  { id: 'cow-m1', name: 'Maintenance Grazing Blend', calories: 2800, icon: 'leaf-outline', dietType: 'maintenance' },
  { id: 'cow-m2', name: 'Balanced Daily Ration', calories: 2600, icon: 'scale-outline', dietType: 'maintenance' },
  { id: 'cow-m3', name: 'Summer Pasture Support', calories: 2500, icon: 'sunny-outline', dietType: 'maintenance' },
  { id: 'cow-g1', name: 'Weight Gain Formula', calories: 4200, icon: 'trending-up-outline', dietType: 'weightGain' },
  { id: 'cow-g2', name: 'High Calorie Booster', calories: 4500, icon: 'barbell-outline', dietType: 'weightGain' },
  { id: 'cow-g3', name: 'Calf Growth Starter', calories: 3800, icon: 'nutrition-outline', dietType: 'weightGain' },
  { id: 'cow-l1', name: 'Low Calorie Hay Diet', calories: 1800, icon: 'trending-down-outline', dietType: 'weightLoss' },
  { id: 'cow-l2', name: 'Fiber Rich Slim Mix', calories: 1600, icon: 'fitness-outline', dietType: 'weightLoss' },
  { id: 'cow-l3', name: 'Controlled Grazing Plan', calories: 2000, icon: 'timer-outline', dietType: 'weightLoss' },
  { id: 'cow-p1', name: 'High-Energy Lactation Mix', calories: 3500, icon: 'water-outline', dietType: 'performance' },
  { id: 'cow-p2', name: 'Show Cattle Premium', calories: 3800, icon: 'trophy-outline', dietType: 'performance' },
  { id: 'cow-p3', name: 'Working Cattle Energy', calories: 3600, icon: 'flash-outline', dietType: 'performance' },
];

// Helper function to get suggested recipes based on daily calories
const getSuggestedRecipes = (dailyCalories: number, animalType: 'cow' | 'horse'): RecipeSuggestion[] => {
  const recipes = animalType === 'horse' ? horseRecipes : cowRecipes;
  
  // Calculate how much feed (kg) needed per day for each recipe
  // Daily calories / calories per kg = kg needed per day
  const recipesWithQuantity = recipes.map(recipe => ({
    ...recipe,
    kgPerDay: dailyCalories / recipe.calories,
  }));
  
  // Filter recipes where 1-10 kg per day is reasonable (not too much or too little)
  const reasonableRecipes = recipesWithQuantity.filter(r => r.kgPerDay >= 1 && r.kgPerDay <= 10);
  
  // Sort by closest match to 3-5 kg per day (ideal range)
  reasonableRecipes.sort((a, b) => {
    const idealRange = 4; // 4 kg per day is ideal
    const aDiff = Math.abs(a.kgPerDay - idealRange);
    const bDiff = Math.abs(b.kgPerDay - idealRange);
    return aDiff - bDiff;
  });
  
  // Return top 3 suggestions
  return reasonableRecipes.slice(0, 3).map(({ kgPerDay, ...recipe }) => recipe);
};

const getRecipeSuggestionNote = (dailyCalories: number, recipeCaloriesPerKg: number): string => {
  const kgPerDay = (dailyCalories / recipeCaloriesPerKg).toFixed(1);
  return `~${kgPerDay} kg/day needed`;
};

const initialForm = {
  cattleId: '',
  weightKg: '',
  activityLevel: 'moderate' as NutritionCalculation['activityLevel'],
  productionStage: 'maintenance' as NutritionCalculation['productionStage'],
};

export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
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
    if (contextSelectedCattle) {
      setForm((prev) => ({
        ...prev,
        cattleId: contextSelectedCattle.id,
        weightKg: `${contextSelectedCattle.weightValue || ''}`,
      }));
    }
  }, [contextSelectedCattle]);

  const selectedCattle = useMemo(() => {
    if (contextSelectedCattle) return contextSelectedCattle;
    return herd.find((item) => item.id === form.cattleId);
  }, [form.cattleId, herd, contextSelectedCattle]);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'cattleId' && value) {
      const meta = herd.find((item) => item.id === value);
      if (meta) {
        setForm((prev) => ({ ...prev, weightKg: `${meta.weightValue || ''}`, cattleId: value }));
      }
    }
  };

  const calculate = async () => {
    if (!user) return;
    if (!contextSelectedCattle) {
      setError('Please select a cattle profile first.');
      return;
    }
    if (!selectedCattle && !form.weightKg) {
      setError('Select a cattle or enter weight manually.');
      return;
    }
    setError('');
    setCalculating(true);

    const type = selectedCattle?.type ?? 'cow';
    const weight = Number(form.weightKg || selectedCattle?.weightValue || 0);
    
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
      await addUserDocument(user.uid, 'calculations', payload as unknown as Record<string, unknown>);
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.container} 
        keyboardShouldPersistTaps="handled"
      >
        {!contextSelectedCattle ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Profile Selected</Text>
            <Text style={styles.emptySubtitle}>Please select a cattle profile from the home tab to use the calculator</Text>
          </View>
        ) : (
          <>
          <SectionCard title="Daily Nutrition Calculator">
            <Text style={styles.helper}>Calculate daily calories, protein, fiber, and calcium requirements based on activity level and production stage.</Text>
            
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Selected Cattle</Text>
              <View style={styles.selectedCattleCard}>
                <View style={styles.selectedCattleInfo}>
                  <Ionicons name={contextSelectedCattle.type === 'cow' ? 'logo-octocat' : 'git-branch-outline'} size={24} color={contextSelectedCattle.type === 'cow' ? '#0a7ea4' : '#D97706'} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.selectedCattleName}>{contextSelectedCattle.name}</Text>
                    <Text style={styles.selectedCattleMeta}>
                      {contextSelectedCattle.type === 'cow' ? 'Cow' : 'Horse'} • {contextSelectedCattle.weightValue || '—'} {contextSelectedCattle.weightUnit || 'kg'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

          <FormField
            label={`Weight (${contextSelectedCattle?.weightUnit || 'kg'})`}
            placeholder={contextSelectedCattle?.weightUnit === 'lbs' ? '1212' : '600'}
            keyboardType="numeric"
            value={form.weightKg}
            onChangeText={(text) => setForm((prev) => ({ ...prev, weightKg: text }))}
            editable={false}
            style={styles.disabledInput}
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
            <View style={styles.emptyHistoryState}>
              <Ionicons name="document-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyHistoryText}>No calculations stored yet.</Text>
              <Text style={styles.emptyHistorySubtext}>Create your first calculation above</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={true}
              style={styles.tableScrollContainer}
              contentContainerStyle={styles.tableScrollContent}
            >
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableHeaderCellCattle]}>Cattle</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableHeaderCellNumeric]}>Calories</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableHeaderCellNumeric]}>Protein</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableHeaderCellNumeric]}>Fiber</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableHeaderCellNumeric]}>Calcium</Text>
                  <View style={[styles.tableHeaderCellEmpty]} />
                </View>
                
                {/* Table Rows */}
                {filteredRecords.map((entry) => (
                  <View key={entry.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.tableCellCattle]}>
                      <Text style={styles.tableCellName}>{entry.cattleName}</Text>
                      <Text style={styles.tableCellMeta}>
                        {entry.type} • {entry.weightKg} kg • {entry.activityLevel} • {entry.productionStage}
                      </Text>
                    </View>
                    <View style={[styles.tableCell, styles.tableCellNumeric]}>
                      <Text style={styles.tableCellValue}>{entry.totalCalories}</Text>
                      <Text style={styles.tableCellUnit}>kcal</Text>
                    </View>
                    <View style={[styles.tableCell, styles.tableCellNumeric]}>
                      <Text style={styles.tableCellValue}>{entry.proteinGrams}</Text>
                      <Text style={styles.tableCellUnit}>g</Text>
                    </View>
                    <View style={[styles.tableCell, styles.tableCellNumeric]}>
                      <Text style={styles.tableCellValue}>{entry.fiberGrams}</Text>
                      <Text style={styles.tableCellUnit}>g</Text>
                    </View>
                    <View style={[styles.tableCell, styles.tableCellNumeric]}>
                      <Text style={styles.tableCellValue}>{entry.calciumGrams || 0}</Text>
                      <Text style={styles.tableCellUnit}>g</Text>
                    </View>
                    <View style={[styles.tableCell, styles.tableCellAction]}>
                      <Pressable
                        style={styles.tableDeleteButton}
                        onPress={() => entry.id && handleDelete(entry.id, entry.cattleName)}
                        disabled={deleting === entry.id}
                      >
                        {deleting === entry.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </SectionCard>

        {/* Recipe Suggestions */}
        {filteredRecords.length > 0 && (
          <SectionCard title="Suggested Recipes">
            <Text style={styles.helper}>Recommended recipes based on your latest calculation</Text>
            {(() => {
              const latestRecord = filteredRecords[filteredRecords.length - 1];
              const suggestedRecipes = getSuggestedRecipes(latestRecord.totalCalories, latestRecord.type);
              
              if (suggestedRecipes.length === 0) {
                return (
                  <View style={styles.emptyHistoryState}>
                    <Ionicons name="restaurant-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyHistoryText}>No recipes available</Text>
                  </View>
                );
              }
              
              return (
                <View style={styles.recipeSuggestionsGrid}>
                  {suggestedRecipes.map((recipe) => (
                    <View key={recipe.id} style={styles.recipeSuggestionCard}>
                      <View style={styles.recipeSuggestionIcon}>
                        <Ionicons name={recipe.icon} size={24} color="#D97706" />
                      </View>
                      <Text style={styles.recipeSuggestionName} numberOfLines={2}>{recipe.name}</Text>
                      <Text style={styles.recipeSuggestionCalories}>{recipe.calories} kcal/kg</Text>
                      <Text style={styles.recipeSuggestionNote}>
                        {getRecipeSuggestionNote(latestRecord.totalCalories, recipe.calories)}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </SectionCard>
        )}
        </>
        )}
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  selectedCattleCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E0F2FE',
    marginTop: 8,
  },
  selectedCattleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedCattleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  selectedCattleMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyHistoryState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  // Table Styles
  tableScrollContainer: {
    marginHorizontal: -20,
  },
  tableScrollContent: {
    paddingHorizontal: 20,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    overflow: 'hidden',
    minWidth: 600,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#C7D2FE',
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
    textTransform: 'uppercase',
    paddingHorizontal: 12,
  },
  tableHeaderCellCattle: {
    minWidth: 180,
    width: 180,
  },
  tableHeaderCellNumeric: {
    minWidth: 100,
    width: 100,
  },
  tableHeaderCellEmpty: {
    minWidth: 60,
    width: 60,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
    alignItems: 'center',
  },
  tableCell: {
    paddingHorizontal: 12,
  },
  tableCellCattle: {
    minWidth: 180,
    width: 180,
  },
  tableCellNumeric: {
    minWidth: 100,
    width: 100,
  },
  tableCellAction: {
    minWidth: 60,
    width: 60,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  tableCellName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  tableCellMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  tableCellValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  tableCellUnit: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  tableDeleteButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  // Recipe Suggestions Styles
  recipeSuggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  recipeSuggestionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    minWidth: 150,
  },
  recipeSuggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipeSuggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    minHeight: 36,
  },
  recipeSuggestionCalories: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  recipeSuggestionNote: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
});
