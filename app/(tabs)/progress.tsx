import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument } from '@/services/firestore';
import { CattleProfile, ProgressLog } from '@/types/models';

const initialForm = {
  cattleId: '',
  periodType: 'weekly' as ProgressLog['periodType'],
  periodLabel: '',
  nutritionScore: '',
  mealCompliance: '',
  exerciseMinutes: '',
  observations: '',
};

export default function ProgressScreen() {
  const { user } = useAuth();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: logs, loading } = useUserCollection<ProgressLog>('progress', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const trend = useMemo(() => {
    if (logs.length === 0) {
      return null;
    }
    const byType = logs.reduce(
      (acc, log) => {
        const key = log.periodType;
        acc[key].nutrition += log.nutritionScore;
        acc[key].meal += log.mealCompliance;
        acc[key].exercise += log.exerciseMinutes;
        acc[key].count += 1;
        return acc;
      },
      {
        weekly: { nutrition: 0, meal: 0, exercise: 0, count: 0 },
        monthly: { nutrition: 0, meal: 0, exercise: 0, count: 0 },
      },
    );
    return (['weekly', 'monthly'] as ProgressLog['periodType'][]).map((type) => {
      const data = byType[type];
      if (data.count === 0) return { type, nutrition: 0, meal: 0, exercise: 0 };
      return {
        type,
        nutrition: Math.round(data.nutrition / data.count),
        meal: Math.round(data.meal / data.count),
        exercise: Math.round(data.exercise / data.count),
      };
    });
  }, [logs]);

  const handleChange = (field: keyof typeof initialForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!user || !form.cattleId || !form.periodLabel) {
      setError('Select a cattle and add period label.');
      return;
    }
    setError('');
    setSaving(true);
    const cattleMeta = herd.find((cattle) => cattle.id === form.cattleId);
    try {
      await addUserDocument(user.uid, 'progress', {
        cattleId: form.cattleId,
        cattleName: cattleMeta?.name ?? 'Unnamed',
        periodType: form.periodType,
        periodLabel: form.periodLabel,
        nutritionScore: Number(form.nutritionScore) || 0,
        mealCompliance: Number(form.mealCompliance) || 0,
        exerciseMinutes: Number(form.exerciseMinutes) || 0,
        observations: form.observations,
      });
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setError('Unable to save log. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionCard title="Progress tracker">
          <Text style={styles.helper}>Track weekly or monthly nutrition, meal and movement progress.</Text>

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

          <View style={styles.toggleRow}>
            {(['weekly', 'monthly'] as ProgressLog['periodType'][]).map((type) => (
              <Pressable key={type} style={[styles.periodChip, form.periodType === type && styles.periodChipActive]} onPress={() => handleChange('periodType', type)}>
                <Text style={[styles.periodText, form.periodType === type && styles.periodTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>

          <FormField label="Period label" placeholder="Week 32 or January" value={form.periodLabel} onChangeText={(text) => handleChange('periodLabel', text)} />
          <View style={styles.row}>
            <FormField
              label="Nutrition score"
              placeholder="80"
              keyboardType="numeric"
              value={form.nutritionScore}
              onChangeText={(text) => handleChange('nutritionScore', text)}
              style={{ flex: 1 }}
            />
            <View style={{ width: 12 }} />
            <FormField
              label="Meal compliance %"
              placeholder="90"
              keyboardType="numeric"
              value={form.mealCompliance}
              onChangeText={(text) => handleChange('mealCompliance', text)}
              style={{ flex: 1 }}
            />
          </View>
          <FormField
            label="Exercise minutes"
            placeholder="120"
            keyboardType="numeric"
            value={form.exerciseMinutes}
            onChangeText={(text) => handleChange('exerciseMinutes', text)}
          />
          <FormField
            label="Observations"
            placeholder="Energy is up, coat is shiny..."
            value={form.observations}
            onChangeText={(text) => handleChange('observations', text)}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save log'}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard title="Weekly vs monthly trend">
          {trend ? (
            trend.map((item) => (
              <View key={item.type} style={styles.trendRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendTitle}>{item.type === 'weekly' ? 'Weekly averages' : 'Monthly averages'}</Text>
                  <Text style={styles.trendSubtitle}>Nutrition • Meal • Exercise</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <ProgressBar label="Nutrition" value={item.nutrition} tone="#0a7ea4" />
                  <ProgressBar label="Meal" value={item.meal} tone="#22c55e" />
                  <ProgressBar label="Exercise" value={Math.min(item.exercise, 200)} tone="#f97316" max={200} />
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.helper}>Add a log to see insights.</Text>
          )}
        </SectionCard>

        <SectionCard title="Timeline">
          {loading ? (
            <ActivityIndicator />
          ) : logs.length === 0 ? (
            <Text style={styles.helper}>No progress logs yet.</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.timelineCard}>
                <View style={styles.timelineHeader}>
                  <View>
                    <Text style={styles.timelineTitle}>{log.cattleName}</Text>
                    <Text style={styles.timelineSubtitle}>
                      {log.periodLabel} • {log.periodType}
                    </Text>
                  </View>
                  <Tag label={`${log.nutritionScore}% nutrition`} tone="success" />
                </View>
                <View style={styles.metricsRow}>
                  <Metric label="Meal" value={`${log.mealCompliance}%`} />
                  <Metric label="Exercise" value={`${log.exerciseMinutes} min`} />
                </View>
                <Text style={styles.timelineNote}>{log.observations}</Text>
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const ProgressBar = ({ label, value, tone, max = 100 }: { label: string; value: number; tone: string; max?: number }) => {
  const width = Math.min((value / max) * 100, 100);
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${width}%`, backgroundColor: tone }]} />
      </View>
    </View>
  );
};

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
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
  },
  cattleChipActive: {
    backgroundColor: '#E2E8F0',
  },
  cattleChipText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  cattleChipTextActive: {
    color: '#0a7ea4',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#0a7ea4',
  },
  periodText: {
    textTransform: 'capitalize',
    color: '#475569',
  },
  periodTextActive: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    marginTop: 6,
  },
  trendRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  trendSubtitle: {
    color: '#475569',
  },
  progressLabel: {
    fontSize: 12,
    color: '#475569',
  },
  progressValue: {
    fontSize: 12,
    color: '#0F172A',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  timelineCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineSubtitle: {
    color: '#475569',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F8FAFE',
  },
  metricLabel: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineNote: {
    color: '#0F172A',
  },
});

