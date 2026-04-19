export type GoalCategory = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'general';
export type GoalPriority = 'high' | 'medium' | 'low';
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'none';

export interface GoalFolder {
  id: number;
  nombre: string;
  icono?: string;
  color?: string;
}

export interface SubGoal {
  id: string;
  title: string;
  completed: boolean;
  skipped?: boolean;
  notes?: string;
  completedAt?: string;
  priority?: GoalPriority;
  focusTimeSeconds?: number; // Tiempo acumulado en modo focus
  folderId?: number;
}

export interface Goal {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  category: GoalCategory;
  priority: GoalPriority;
  recurring: boolean;
  dayPart?: DayPart;
  estimatedHours?: number;
  estimatedMinutes?: number;
  reward?: string;
  isParent: boolean;
  parentGoalId?: string;
  startDate?: string;
  endDate?: string;
  subGoals: SubGoal[];
  completed: boolean;
  completedAt?: string;
  focusTimeSeconds?: number;
  focusNotes?: string;
  skipped: boolean;
  createdAt: string;
  scheduledFor?: string;
  scheduledType?: 'today' | 'tomorrow' | 'specific';
}

export interface PhraseCategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  subcategories: PhraseSubcategory[];
}

export interface PhraseSubcategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface Phrase {
  id: string;
  text: string;
  author?: string;
  categoryId: string;
  subcategoryId: string;
  notes?: string;
  active: boolean;
  reviewCount: number;
  lastReviewedAt?: string;
  createdAt: string;
}

// Question types
export type QuestionType = 'text' | 'select' | 'checkbox' | 'radio';
export type QuestionCategory = 'personal' | 'work' | 'health' | 'habits' | 'goals' | 'general';

export interface QuestionOption {
  id: string;
  value: string;
  label: string;
  order: number;
}

export interface Question {
  id: string;
  title: string;
  description?: string;
  type: QuestionType;
  category: QuestionCategory;
  options?: QuestionOption[]; // Para select, checkbox, radio
  required: boolean;
  active: boolean;
  order: number;
  assignedToUsers?: string[]; // IDs de usuarios (para futuro)
  createdAt: string;
  updatedAt?: string;
  skipped?: boolean;
}

export interface QuestionResponse {
  id: string;
  questionId: string;
  userId?: string; // Para futuro
  response: string | string[]; // string para text/select/radio, string[] para checkbox
  answeredAt: string;
  date: string; // Fecha del día (YYYY-MM-DD)
}

export interface DailyQuestionsSession {
  id: string;
  date: string; // YYYY-MM-DD
  userId?: string;
  responses: QuestionResponse[];
  completedAt?: string;
  totalQuestions: number;
  answeredQuestions: number;
}

export interface QuestionFeedback {
  id: string;
  questionId: string;
  date: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
}
