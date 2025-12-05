import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument } from '@/services/firestore';
import { CattleProfile, PregnancyPlan } from '@/types/models';

const trimesters: PregnancyPlan['trimester'][] = ['early', 'mid', 'late'];

const initialForm = {
  cattleId: '',
  dueDate: '',
  trimester: 'early' as PregnancyPlan['trimester'],
  blockedMonth: '',
  calendarDate: '',
  todo: '',
  nutritionFocus: '',
};

export default function PregnancyScreen() {
  const { user } = useAuth();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: plans, loading } = useUserCollection<PregnancyPlan>('pregnancy', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const groupedPlans = useMemo(() => {
    const byCattle = new Map<string, PregnancyPlan[]>();
    plans.forEach((plan) => {
      const arr = byCattle.get(plan.cattleId) ?? [];
      arr.push(plan);
      byCattle.set(plan.cattleId, arr);
    });
    return Array.from(byCattle.entries()).map(([cattleId, entries]) => {
      const cattleMeta = herd.find((item) => item.id === cattleId);
      return {
        cattleId,
        cattleName: cattleMeta?.name ?? entries[0]?.cattleName ?? 'Unnamed',
        type: cattleMeta?.type,
        entries,
      };
    });
  }, [plans, herd]);

  const handleChange = (field: keyof typeof initialForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!user || !form.cattleId) {
      setError('Select a cattle to track pregnancy.');
      return;
    }
    setSaving(true);
    setError('');
    const cattleMeta = herd.find((item) => item.id === form.cattleId);
    try {
      await addUserDocument(user.uid, 'pregnancy', {
        ...form,
        cattleName: cattleMeta?.name ?? 'Unnamed',
      });
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setError('Unable to save plan. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionCard title="Pregnant cattle board">
          <Text style={styles.helper}>Block months, add to-do items and nutrition focus per stage.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cattleScroller}>
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

          <View style={styles.toggleRow}>
            {trimesters.map((trimester) => (
              <Pressable key={trimester} style={[styles.triChip, form.trimester === trimester && styles.triChipActive]} onPress={() => handleChange('trimester', trimester)}>
                <Text style={[styles.triChipText, form.trimester === trimester && styles.triChipTextActive]}>{trimester} trimester</Text>
              </Pressable>
            ))}
          </View>

          <FormField label="Due date" placeholder="2025-09-12" value={form.dueDate} onChangeText={(text) => handleChange('dueDate', text)} />
          <FormField label="Month to block" placeholder="September" value={form.blockedMonth} onChangeText={(text) => handleChange('blockedMonth', text)} />
          <View style={styles.row}>
            <FormField label="Calendar date" placeholder="2025-08-03" value={form.calendarDate} onChangeText={(text) => handleChange('calendarDate', text)} style={{ flex: 1 }} />
            <View style={{ width: 12 }} />
            <FormField label="Nutrition focus" placeholder="Increase calcium" value={form.nutritionFocus} onChangeText={(text) => handleChange('nutritionFocus', text)} style={{ flex: 1 }} />
          </View>
          <FormField
            label="To-do / action"
            placeholder="Ultrasound, hoof check, add mineral mix"
            value={form.todo}
            onChangeText={(text) => handleChange('todo', text)}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Add to board'}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard title="Calendar & tracker">
          {loading ? (
            <ActivityIndicator />
          ) : groupedPlans.length === 0 ? (
            <Text style={styles.helper}>No pregnancy plans stored yet.</Text>
          ) : (
            groupedPlans.map((group) => (
              <View key={group.cattleId} style={styles.board}>
                <View style={styles.groupHeader}>
                  <View>
                    <Text style={styles.groupTitle}>{group.cattleName}</Text>
                    <Text style={styles.groupSubtitle}>{group.type === 'horse' ? 'Horse' : 'Cow'}</Text>
                  </View>
                  <Tag label={`${group.entries.length} reminders`} />
                </View>
                {group.entries.map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryMonth}>{entry.blockedMonth || 'Month'}</Text>
                      <Tag label={`${entry.trimester} tri`} tone="warning" />
                    </View>
                    <Text style={styles.entryDue}>Due {entry.dueDate || '—'}</Text>
                    <Text style={styles.entryTodo}>{entry.todo}</Text>
                    <View style={styles.entryFooter}>
                      <Text style={styles.entryDate}>{entry.calendarDate || 'No date'}</Text>
                      <Text style={styles.entryNutrition}>{entry.nutritionFocus || 'Nutrition TBD'}</Text>
                    </View>
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
  cattleScroller: {
    marginVertical: 12,
  },
  cattleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    marginRight: 10,
  },
  cattleChipActive: {
    backgroundColor: '#FDE68A',
    borderColor: '#EAB308',
  },
  cattleChipText: {
    color: '#475569',
    fontWeight: '600',
  },
  cattleChipTextActive: {
    color: '#92400E',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  triChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  triChipActive: {
    backgroundColor: '#FEF9C3',
  },
  triChipText: {
    color: '#92400E',
  },
  triChipTextActive: {
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#D97706',
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
  board: {
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
    color: '#78350F',
  },
  groupSubtitle: {
    color: '#9A3412',
  },
  entryCard: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFBEB',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  entryMonth: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  entryDue: {
    color: '#B45309',
    fontWeight: '600',
    marginBottom: 4,
  },
  entryTodo: {
    color: '#78350F',
    marginBottom: 8,
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  entryDate: {
    color: '#B45309',
  },
  entryNutrition: {
    color: '#92400E',
    fontWeight: '600',
  },
});

