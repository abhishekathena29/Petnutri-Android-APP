export type CattleCategory = 'cow' | 'horse';

export interface CattleProfile {
  id?: string;
  name: string;
  type: CattleCategory;
  breed: string;
  ageYears: number;
  sex: 'male' | 'female';
  weightUnit: 'kg' | 'lbs';
  weightValue: number;
  heightUnit: 'hands' | 'cm';
  heightValue: number;
  vaccinated: boolean;
  femaleStatus?: 'pregnant' | 'notPregnant' | 'lactating'; // Only if sex === 'female'
  activityLevel: 'maintenance' | 'lightWork' | 'moderateWork' | 'heavyWork';
  climateRegion: string;
  createdAt?: Date;
}

export interface MealPlan {
  id?: string;
  cattleId: string;
  cattleName: string;
  recipeName: string;
  dietType: 'maintenance' | 'weightGain' | 'weightLoss' | 'performance';
  feedingTime: string;
  calories: number;
  ingredients: string;
  nutritionBreakdown: string;
  day?: string;
  createdAt?: Date;
}

export interface PregnancyPlan {
  id?: string;
  cattleId: string;
  cattleName: string;
  dueDate: string;
  trimester: 'early' | 'mid' | 'late';
  blockedMonth: string;
  todo: string;
  nutritionFocus: string;
  calendarDate: string;
  completed?: boolean;
  createdAt?: Date;
}

export interface NutritionCalculation {
  id?: string;
  cattleId: string;
  cattleName: string;
  type: CattleCategory;
  weightKg: number;
  activityLevel: 'low' | 'moderate' | 'high';
  productionStage: 'maintenance' | 'lactating' | 'pregnant' | 'working';
  totalCalories: number;
  proteinGrams: number;
  fiberGrams: number;
  calciumGrams: number;
  minerals: string;
  createdAt?: Date;
}

export interface ProgressLog {
  id?: string;
  cattleId: string;
  cattleName: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  periodLabel: string;
  logDate: string;
  nutritionScore: number;
  mealCompliance: number;
  exerciseMinutes: number;
  observations: string;
  observationRating?: number;
  mealTake?: boolean;
  exercise?: 'normal' | 'moderate' | 'hard';
  water?: number; // liters
  activity?: 'normal' | 'moderate' | 'hard';
  createdAt?: Date;
}

