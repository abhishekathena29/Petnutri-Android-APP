import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument } from '@/services/firestore';
import { CattleProfile, MealPlan } from '@/types/models';

const dietTypes: MealPlan['dietType'][] = ['maintenance', 'weightGain', 'weightLoss', 'performance'];

const initialForm = {
  cattleId: '',
  recipeName: '',
  dietType: 'maintenance' as MealPlan['dietType'],
  feedingTime: '',
  calories: '',
  ingredients: '',
  nutritionBreakdown: '',
  day: '',
};

export default function MealsScreen() {
  const { user } = useAuth();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: meals, loading } = useUserCollection<MealPlan>('meals', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cattleOptions = herd.map((cattle) => ({ label: cattle.name, value: cattle.id! }));

  const groupedMeals = useMemo(() => {
    const map = new Map<string, MealPlan[]>();
    meals.forEach((meal) => {
      const key = meal.cattleId;
      const existing = map.get(key) ?? [];
      existing.push(meal);
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([cattleId, cattleMeals]) => {
      const meta = herd.find((cattle) => cattle.id === cattleId);
      return {
        cattleId,
        cattleName: meta?.name ?? cattleMeals[0]?.cattleName ?? 'Unnamed',
        type: meta?.type,
        meals: cattleMeals,
      };
    });
  }, [herd, meals]);

  const handleChange = (field: keyof typeof initialForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!user || !form.cattleId || !form.recipeName) {
      setError('Select a cattle and add a recipe name.');
      return;
    }
    setSaving(true);
    setError('');
    const cattleMeta = herd.find((cattle) => cattle.id === form.cattleId);
    try {
      await addUserDocument(user.uid, 'meals', {
        ...form,
        calories: Number(form.calories) || 0,
        cattleName: cattleMeta?.name ?? 'Unnamed',
      });
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setError('Unable to save meal plan. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionCard title="Daily meal planner">
          <Text style={styles.helper}>Pick a cattle to manage their recipe and nutrient split.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
            {cattleOptions.length === 0 ? (
              <Text style={styles.helper}>Create a cattle profile first.</Text>
            ) : (
              cattleOptions.map((option) => (
                <Pressable key={option.value} style={[styles.cattleChip, form.cattleId === option.value && styles.cattleChipActive]} onPress={() => handleChange('cattleId', option.value)}>
                  <Text style={[styles.cattleChipText, form.cattleId === option.value && styles.cattleChipTextActive]}>{option.label}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <FormField label="Recipe / Diet name" placeholder="High fibre mash" value={form.recipeName} onChangeText={(text) => handleChange('recipeName', text)} />

          <Text style={styles.label}>Diet focus</Text>
          <View style={styles.toggleRow}>
            {dietTypes.map((type) => (
              <Pressable key={type} style={[styles.dietChip, form.dietType === type && styles.dietChipActive]} onPress={() => handleChange('dietType', type)}>
                <Text style={[styles.dietChipText, form.dietType === type && styles.dietChipTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <FormField
              label="Feeding time"
              placeholder="06:30 AM"
              value={form.feedingTime}
              onChangeText={(text) => handleChange('feedingTime', text)}
              style={{ flex: 1 }}
            />
            <View style={{ width: 12 }} />
            <FormField
              label="Calories"
              placeholder="3200"
              keyboardType="numeric"
              value={form.calories}
              onChangeText={(text) => handleChange('calories', text)}
              style={{ flex: 1 }}
            />
          </View>

          <FormField label="Day / schedule note" placeholder="Morning routine" value={form.day} onChangeText={(text) => handleChange('day', text)} />
          <FormField label="Ingredients" placeholder="Oats, alfalfa, flaxseed..." value={form.ingredients} onChangeText={(text) => handleChange('ingredients', text)} multiline />
          <FormField
            label="Nutrition breakdown"
            placeholder="Protein 18%, fibre 22%, minerals A & D"
            value={form.nutritionBreakdown}
            onChangeText={(text) => handleChange('nutritionBreakdown', text)}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save meal'}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard title="Meal library">
          {loading ? (
            <ActivityIndicator />
          ) : groupedMeals.length === 0 ? (
            <Text style={styles.helper}>No meals logged yet.</Text>
          ) : (
            groupedMeals.map((group) => (
              <View key={group.cattleId} style={styles.mealGroup}>
                <View style={styles.groupHeader}>
                  <View>
                    <Text style={styles.groupTitle}>{group.cattleName}</Text>
                    <Text style={styles.groupSubtitle}>{group.type === 'horse' ? 'Horse' : 'Cow'} meals</Text>
                  </View>
                  <Tag label={`${group.meals.length} recipes`} />
                </View>
                {group.meals.map((meal) => (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealHeader}>
                      <Text style={styles.mealName}>{meal.recipeName}</Text>
                      <Tag label={meal.dietType} tone="success" />
                    </View>
                    <Text style={styles.mealMeta}>
                      {meal.day || 'Daily'} • {meal.feedingTime || 'Flexible'} • {meal.calories} kcal
                    </Text>
                    <Text style={styles.mealBody}>{meal.ingredients}</Text>
                    <Text style={styles.mealNutrition}>{meal.nutritionBreakdown}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  cattleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    marginRight: 12,
  },
  cattleChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0a7ea4',
  },
  cattleChipText: {
    color: '#475569',
    fontWeight: '600',
  },
  cattleChipTextActive: {
    color: '#0a7ea4',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dietChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
  dietChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  dietChipText: {
    textTransform: 'capitalize',
    color: '#475569',
  },
  dietChipTextActive: {
    color: '#166534',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#0a7ea4',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    marginTop: 6,
  },
  mealGroup: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupSubtitle: {
    color: '#64748B',
  },
  mealCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  mealMeta: {
    color: '#475569',
    marginBottom: 6,
  },
  mealBody: {
    color: '#334155',
    marginBottom: 4,
  },
  mealNutrition: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
});

