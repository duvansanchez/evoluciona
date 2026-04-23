/**
 * Servicio API para conectar con el backend FastAPI
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function deriveServiceApiUrl(port: number, fallback: string): string {
  try {
    const apiUrl = new URL(API_BASE_URL);
    return `${apiUrl.protocol}//${apiUrl.hostname}:${port}/api`;
  } catch {
    return fallback;
  }
}

const FINANCE_HUB_API_URL = import.meta.env.VITE_FINANCE_HUB_API_URL || deriveServiceApiUrl(3005, 'http://localhost:3005/api');
const MINDFUL_STUDY_API_URL = import.meta.env.VITE_MINDFUL_STUDY_API_URL || deriveServiceApiUrl(3002, 'http://localhost:3002/api');

// Tipos para respuestas paginadas
interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: T[];
}

/**
 * Goals API
 */
export const goalsAPI = {
  getGoals: async (page = 1, page_size = 50) => {
    const response = await fetch(`${API_BASE_URL}/goals?page=${page}&page_size=${page_size}`);
    if (!response.ok) throw new Error('Error fetching goals');
    return response.json() as Promise<PaginatedResponse<any>>;
  },

  getSkippedGoals: async (date: string) => {
    const response = await fetch(`${API_BASE_URL}/goals/skips?fecha=${date}&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error fetching skipped goals (${response.status})`);
    }
    return response.json() as Promise<number[]>;
  },

  getSkippedGoalsDetails: async (date: string) => {
    const response = await fetch(`${API_BASE_URL}/goals/skips/details?fecha=${date}&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error fetching skipped goal details (${response.status})`);
    }
    return response.json() as Promise<Array<{ goal_id: number; fecha: string; reason?: string | null }>>;
  },

  getCompletedGoals: async (date: string) => {
    const response = await fetch(`${API_BASE_URL}/goals/completions?fecha=${date}&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Error fetching completed goals');
    return response.json() as Promise<Array<{ goal_id: number; fecha: string; completed_at?: string }>>;
  },

  skipGoalForDate: async (goalId: number | string, date: string, reason?: string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/skip?fecha=${date}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error skipping goal for date (${response.status})`);
    }
    return response.json() as Promise<{ goal_id: number; fecha: string; reason?: string | null }>;
  },

  unskipGoalForDate: async (goalId: number | string, date: string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/skip?fecha=${date}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error removing skipped goal for date (${response.status})`);
    }
    return response.json();
  },

  completeGoalForDate: async (goalId: number | string, date: string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/complete?fecha=${date}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Error completing recurring goal for date');
    return response.json() as Promise<{ goal_id: number; fecha: string; completed_at?: string }>;
  },

  uncompleteGoalForDate: async (goalId: number | string, date: string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/complete?fecha=${date}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error removing recurring goal completion for date');
    return response.json();
  },
  
  createGoal: async (goalData: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goalData),
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Error creating goal: ${response.status} ${errorData}`);
    }
    const data = await response.json();
    console.log('🎯 Goal API Response:', data);
    return data;
  },
  
  updateGoal: async (goalId: number | string, updates: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Error updating goal ${goalId}:`, response.status, errorData);
      throw new Error(`Error updating goal: ${response.status} ${errorData}`);
    }
    const data = await response.json();
    console.log('✅ Goal updated successfully:', data);
    return data;
  },
  
  deleteGoal: async (goalId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('Error deleting goal');
    return response.json();
  },
  
  getSubGoals: async (goalId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/subgoals`);
    if (!response.ok) throw new Error('Error fetching subgoals');
    return response.json();
  },
  getSkippedSubGoals: async (date: string) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/skips?fecha=${date}&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error fetching skipped subgoals (${response.status})`);
    }
    return response.json() as Promise<number[]>;
  },
  getSkippedSubGoalsDetails: async (date: string) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/skips/details?fecha=${date}&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error fetching skipped subgoal details (${response.status})`);
    }
    return response.json() as Promise<Array<{ subgoal_id: number; fecha: string; reason?: string | null }>>;
  },
  updateSubGoal: async (subGoalId: number | string, updates: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/${subGoalId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Error updating subgoal');
    return response.json();
  },

  createSubGoal: async (goalId: number | string, subGoalData: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/subgoals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subGoalData),
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Error creating subgoal: ${response.status} ${errorData}`);
    }
    const data = await response.json();
    console.log('✅ SubGoal created:', data);
    return data;
  },

  deleteSubGoal: async (subGoalId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/${subGoalId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('Error deleting subgoal');
    return response.json();
  },
  skipSubGoalForDate: async (subGoalId: number | string, date: string, reason?: string) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/${subGoalId}/skip?fecha=${date}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error skipping subgoal for date (${response.status})`);
    }
    return response.json() as Promise<{ subgoal_id: number; fecha: string; reason?: string | null }>;
  },
  unskipSubGoalForDate: async (subGoalId: number | string, date: string) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/${subGoalId}/skip?fecha=${date}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error removing skipped subgoal for date (${response.status})`);
    }
    return response.json();
  },
};

/**
 * Phrases API
 */
export const phrasesAPI = {
  getPhrases: async (
    page = 1,
    page_size = 50,
    categoryId?: number | string,
    subcategoryId?: number | string,
    active?: boolean,
  ) => {
    let url = `${API_BASE_URL}/phrases?page=${page}&page_size=${page_size}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (subcategoryId) url += `&subcategory_id=${subcategoryId}`;
    if (typeof active === 'boolean') url += `&active=${active}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching phrases');
    return response.json() as Promise<PaginatedResponse<any>>;
  },

  getCategories: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories`);
    if (!response.ok) throw new Error('Error fetching phrase categories');
    return response.json();
  },

  getCategoriesTree: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories-tree`);
    if (!response.ok) throw new Error('Error fetching phrase categories tree');
    return response.json();
  },

  createPhrase: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating phrase');
    return response.json();
  },

  updatePhrase: async (phraseId: number | string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/${phraseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating phrase');
    return response.json();
  },

  deletePhrase: async (phraseId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/phrases/${phraseId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting phrase');
    return response.json();
  },

  getCategoriesAdmin: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories-admin`);
    if (!response.ok) throw new Error('Error fetching categories admin');
    return response.json();
  },

  createCategory: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating category');
    return response.json();
  },

  updateCategory: async (categoryId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating category');
    return response.json();
  },

  deleteCategory: async (categoryId: string) => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories/${categoryId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting category');
    return response.json();
  },

  createSubcategory: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating subcategory');
    return response.json();
  },

  updateSubcategory: async (subcategoryId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/subcategories/${subcategoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating subcategory');
    return response.json();
  },

  deleteSubcategory: async (subcategoryId: string) => {
    const response = await fetch(`${API_BASE_URL}/phrases/subcategories/${subcategoryId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting subcategory');
    return response.json();
  },

  reviewPhrase: async (phraseId: number | string, payload?: { review_plan_id?: number; session_label?: string }) => {
    const response = await fetch(`${API_BASE_URL}/phrases/${phraseId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });
    if (!response.ok) throw new Error('Error reviewing phrase');
    return response.json();
  },

  getReviewLogs: async (
    page = 1,
    page_size = 50,
    startDate?: string,
    endDate?: string,
    reviewPlanId?: number,
  ) => {
    let url = `${API_BASE_URL}/phrases/review-logs?page=${page}&page_size=${page_size}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    if (typeof reviewPlanId === 'number') url += `&review_plan_id=${reviewPlanId}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching phrase review logs');
    return response.json() as Promise<PaginatedResponse<any>>;
  },

  getReport: async (mode: 'weekly' | 'monthly', referenceDate?: string) => {
    let url = `${API_BASE_URL}/phrases/report?mode=${mode}`;
    if (referenceDate) url += `&reference_date=${referenceDate}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching phrase report');
    return response.json() as Promise<PhraseReportData>;
  },

  sendReportEmail: async (mode: 'weekly' | 'monthly', referenceDate?: string) => {
    let url = `${API_BASE_URL}/phrases/report/send-email?mode=${mode}`;
    if (referenceDate) url += `&reference_date=${referenceDate}`;

    const response = await fetch(url, {
      method: 'POST',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error sending phrase report email');
    }
    return response.json();
  },

  downloadReport: async (mode: 'weekly' | 'monthly', referenceDate?: string) => {
    let url = `${API_BASE_URL}/phrases/report/download?mode=${mode}`;
    if (referenceDate) url += `&reference_date=${referenceDate}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error downloading phrase report');
    }
    return response.blob();
  },

  getAudioStatus: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/audio/status`);
    if (!response.ok) throw new Error('Error fetching phrase audio status');
    return response.json() as Promise<PhraseAudioStatus>;
  },

  getAudioPreferences: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/audio/preferences`);
    if (!response.ok) throw new Error('Error fetching phrase audio preferences');
    return response.json() as Promise<PhraseAudioPreferences>;
  },

  updateAudioPreferences: async (payload: Partial<PhraseAudioPreferences>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/audio/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating phrase audio preferences');
    return response.json() as Promise<PhraseAudioPreferences>;
  },

  generateAudio: async (text: string, options?: { rate?: number; pitch?: number }) => {
    const response = await fetch(`${API_BASE_URL}/phrases/audio/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        rate: options?.rate,
        pitch: options?.pitch,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || errorText || 'Error generating phrase audio');
      } catch {
        throw new Error(errorText || 'Error generating phrase audio');
      }
    }
    return response.blob();
  },
};

/**
 * Questions API
 */
export const questionsAPI = {
  getQuestions: async (page = 1, page_size = 50, category?: string, active?: boolean, frequency?: string) => {
    let url = `${API_BASE_URL}/questions?page=${page}&page_size=${page_size}`;
    if (category) url += `&category=${category}`;
    if (typeof active === 'boolean') url += `&active=${active}`;
    if (frequency) url += `&frequency=${frequency}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching questions');
    return response.json() as Promise<PaginatedResponse<any>>;
  },
  createQuestion: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating question');
    return response.json();
  },
  updateQuestion: async (questionId: number | string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating question');
    return response.json();
  },
  deleteQuestion: async (questionId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting question');
  },
  getDailySession: async (date: string) => {
    const response = await fetch(`${API_BASE_URL}/daily-sessions/${date}`);
    if (!response.ok) throw new Error('Error fetching daily session');
    return response.json();
  },
  saveDailyResponses: async (date: string, payload: { responses: { question_id: string; response: string }[] }) => {
    const response = await fetch(`${API_BASE_URL}/daily-sessions/${date}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error saving daily responses');
    return response.json();
  },
  saveSingleResponse: async (date: string, questionId: string, response: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/responses/${questionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    });
    if (!r.ok) throw new Error('Error saving response');
    return r.json();
  },
  getCalendarSummary: async (year: number, month: number) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/calendar?year=${year}&month=${month}`);
    if (!r.ok) throw new Error('Error fetching calendar');
    return r.json();
  },
  getHistorySession: async (date: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/history`);
    if (!r.ok) throw new Error('Error fetching history');
    return r.json();
  },
  getQuestionFeedbacks: async (date: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/feedbacks`);
    if (!r.ok) throw new Error('Error fetching question feedbacks');
    return r.json();
  },
  saveQuestionFeedback: async (date: string, questionId: string, text: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/feedbacks/${questionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(errorText || 'Error saving question feedback');
    }
    return r.json();
  },
  deleteQuestionFeedback: async (date: string, questionId: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/feedbacks/${questionId}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(errorText || 'Error deleting question feedback');
    }
    return r.json();
  },
  getSkippedQuestions: async (date: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/skips`);
    if (!r.ok) throw new Error('Error fetching skipped questions');
    return r.json() as Promise<number[]>;
  },
  skipQuestionForDate: async (date: string, questionId: number | string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/skips/${questionId}`, {
      method: 'POST',
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(errorText || 'Error skipping question for date');
    }
    return r.json();
  },
  unskipQuestionForDate: async (date: string, questionId: number | string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/skips/${questionId}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(errorText || 'Error removing skipped question for date');
    }
    return r.json();
  },
};

/**
 * Reports API
 */
export const reportsAPI = {
  getHistory: async (limit = 5) => {
    const response = await fetch(`${API_BASE_URL}/reports/history?limit=${limit}`);
    if (!response.ok) throw new Error('Error fetching reports history');
    return response.json();
  },
  getSchedule: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/schedule`);
    if (!response.ok) throw new Error('Error fetching report schedule');
    return response.json();
  },
  updateSchedule: async (payload: {
    enabled?: boolean;
    day_of_week?: string;
    hour?: number;
    minute?: number;
  }) => {
    const response = await fetch(`${API_BASE_URL}/reports/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error updating report schedule');
    }
    return response.json();
  },
  sendCurrentWeekReport: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/send-current-week`, {
      method: 'POST',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error sending current week report');
    }
    return response.json();
  },
  sendPreviousWeekReport: async (weekOf?: string) => {
    let url = `${API_BASE_URL}/reports/send-weekly`;
    if (weekOf) url += `?week_of=${weekOf}`;
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error sending previous week report');
    }
    return response.json();
  },
  sendCurrentMonthReport: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/send-current-month`, {
      method: 'POST',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error sending current month report');
    }
    return response.json();
  },
  sendPreviousMonthReport: async (monthOf?: string) => {
    let url = `${API_BASE_URL}/reports/send-monthly`;
    if (monthOf) url += `?month_of=${monthOf}`;
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error sending previous month report');
    }
    return response.json();
  },

  downloadCurrentWeekReport: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/download-current-week`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error downloading current week report');
    }
    return response.blob();
  },
  downloadPreviousWeekReport: async (weekOf?: string) => {
    let url = `${API_BASE_URL}/reports/download-weekly`;
    if (weekOf) url += `?week_of=${weekOf}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error downloading previous week report');
    }
    return response.blob();
  },
  downloadCurrentMonthReport: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/download-current-month`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error downloading current month report');
    }
    return response.blob();
  },
  downloadPreviousMonthReport: async (monthOf?: string) => {
    let url = `${API_BASE_URL}/reports/download-monthly`;
    if (monthOf) url += `?month_of=${monthOf}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error downloading previous month report');
    }
    return response.blob();
  },
  getWeeklyConclusion: async (referenceDate?: string) => {
    let url = `${API_BASE_URL}/reports/weekly-conclusions`;
    if (referenceDate) url += `?reference_date=${referenceDate}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching weekly conclusion');
    return response.json() as Promise<WeeklyConclusion>;
  },
  getWeeklyConclusionsHistory: async (limit = 8) => {
    const response = await fetch(`${API_BASE_URL}/reports/weekly-conclusions/history?limit=${limit}`);
    if (!response.ok) throw new Error('Error fetching weekly conclusions history');
    return response.json() as Promise<WeeklyConclusion[]>;
  },
  saveWeeklyConclusion: async (referenceDate: string, content: string) => {
    const response = await fetch(`${API_BASE_URL}/reports/weekly-conclusions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reference_date: referenceDate, content }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error saving weekly conclusion');
    }
    return response.json() as Promise<WeeklyConclusion>;
  },
  deleteWeeklyConclusion: async (referenceDate: string) => {
    const response = await fetch(`${API_BASE_URL}/reports/weekly-conclusions?reference_date=${referenceDate}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error deleting weekly conclusion');
    }
    return response.json() as Promise<{ message: string; week_start: string; week_end: string }>;
  },
  getDuvanConclusions: async (limit = 20) => {
    const response = await fetch(`${API_BASE_URL}/reports/duvan-conclusions?limit=${limit}`);
    if (!response.ok) throw new Error('Error fetching duvan conclusions');
    return response.json() as Promise<DuvanConclusion[]>;
  },
  saveDuvanConclusion: async (conclusionType: 'emocional' | 'trabajo' | 'vida' | 'personas', content: string) => {
    const response = await fetch(`${API_BASE_URL}/reports/duvan-conclusions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conclusion_type: conclusionType, content }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error saving duvan conclusion');
    }
    return response.json() as Promise<DuvanConclusion>;
  },
  deleteDuvanConclusion: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/reports/duvan-conclusions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error deleting duvan conclusion');
    }
    return response.json() as Promise<{ message: string; id: number }>;
  },
};

export interface WeeklyConclusion {
  id?: number | null;
  week_start: string;
  week_end: string;
  period_label: string;
  content: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DuvanConclusion {
  id: number;
  conclusion_type: 'emocional' | 'trabajo' | 'vida' | 'personas';
  content: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PhraseReportPhraseItem {
  id: number;
  text: string;
  author?: string | null;
  category_name?: string;
  count?: number;
  last_reviewed_at?: string | null;
  days_since_last_review?: number | null;
}

export interface PhraseReportCountItem {
  category_name?: string;
  name?: string;
  count: number;
}

export interface PhraseReportDayItem {
  date: string;
  count: number;
}

export interface PhraseReportData {
  mode: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  period_label: string;
  total_reviews: number;
  days_with_review: number;
  top_phrases: PhraseReportPhraseItem[];
  unreviewed_phrases: PhraseReportPhraseItem[];
  category_usage: PhraseReportCountItem[];
  daily_distribution: PhraseReportDayItem[];
  streaks: {
    current: number;
    max: number;
  };
  plans_used: PhraseReportCountItem[];
  excluded_phrases: PhraseReportPhraseItem[];
  ignored_phrases: PhraseReportPhraseItem[];
  coverage: {
    active_phrases: number;
    reviewed_active_phrases: number;
    percent: number;
  };
}

export interface PhraseAudioStatus {
  enabled: boolean;
  provider: 'browser' | 'elevenlabs' | 'edge';
  voice_id?: string | null;
  voice_name?: string | null;
  model_id?: string | null;
}

export interface PhraseAudioPreferences {
  selected_voice_name: string | null;
  rate: number;
  pitch: number;
  pause_ms: number;
  updated_at?: string | null;
}

export interface ReviewPlanConfig {
  shuffle: boolean;
  daily_limit: number | null;
  excluded_phrase_ids: number[];
}

export interface ReviewPlanData {
  id: number;
  name: string;
  targets: string[];
  config: ReviewPlanConfig;
  created_at?: string;
}

export interface ReviewPlanUpdatePayload {
  name?: string;
  targets?: string[];
  config?: ReviewPlanConfig;
}

/**
 * Review Plans API
 */
export const reviewPlansAPI = {
  getPlans: async (): Promise<ReviewPlanData[]> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans`);
    if (!response.ok) throw new Error('Error fetching review plans');
    return response.json();
  },

  createPlan: async (data: { name: string; targets: string[] }): Promise<ReviewPlanData> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error creating review plan');
    return response.json();
  },

  updatePlan: async (id: number, data: ReviewPlanUpdatePayload): Promise<ReviewPlanData> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error updating review plan');
    return response.json();
  },

  deletePlan: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting review plan');
  },
};

/**
 * Rutinas API
 */
export interface GoalSimple {
  id: number;
  titulo: string;
  icono?: string;
  categoria?: string;
  frecuencia?: string;
  parte_dia?: 'morning' | 'afternoon' | 'evening' | null;
}

export interface RutinaBloque {
  id: number;
  rutina_id: number;
  nombre: string;
  orden: number;
  hora_inicio?: string;
  duracion_minutos?: number;
  notas?: string;
}

export interface Rutina {
  id: number;
  nombre: string;
  parte_dia: 'morning' | 'afternoon' | 'evening';
  color?: string;
  categoria?: string;
  descripcion?: string;
  dias_semana: number[];
  activa: boolean;
  fecha_creacion?: string;
  bloques: RutinaBloque[];
  objetivos: GoalSimple[];
}

export interface RutinaAsignacion {
  id: number;
  fecha: string;
  parte_dia: string;
  rutina_id: number;
  completada: boolean;
  es_automatica: boolean;
  objetivo_ids: number[];
  rutina: Rutina;
}

export interface DiaSemana {
  fecha: string;
  asignaciones: RutinaAsignacion[];
}

export interface RutinaReportRoutineItem {
  id: number;
  name: string;
  day_part?: string | null;
  assigned: number;
  completed: number;
  completion_rate: number;
}

export interface RutinaReportDayPartItem {
  day_part: string;
  label: string;
  assigned: number;
  completed: number;
  completion_rate: number;
}

export interface RutinaReportDayItem {
  date: string;
  weekday: string;
  assigned: number;
  completed: number;
  completion_rate: number;
  day_parts: Array<{
    day_part: string;
    label: string;
    assigned: number;
    completed: number;
  }>;
}

export interface RutinaReportGoalLogGoalItem {
  id: number;
  title: string;
  icon?: string | null;
  completed_at?: string | null;
  routine_names: string[];
}

export interface RutinaReportGoalLogDayItem {
  date: string;
  count: number;
  goals: RutinaReportGoalLogGoalItem[];
}

export interface RutinaReportRoutineBreakdownGoalItem {
  id: number;
  title: string;
  icon?: string | null;
  status: 'completed' | 'skipped' | 'pending';
  skip_reason?: string | null;
}

export interface RutinaReportRoutineBreakdownDayItem {
  date: string;
  completed_assignment: boolean;
  progress_percent: number | null;
  progress_label: string;
  is_neutral: boolean;
  goal_count: number;
  completed_count: number;
  skipped_count: number;
  pending_count: number;
  goals: RutinaReportRoutineBreakdownGoalItem[];
}

export interface RutinaReportRoutineBreakdownItem {
  id: number;
  name: string;
  day_part?: string | null;
  day_part_label: string;
  assigned: number;
  completed: number;
  failed_days: number;
  neutral_days: number;
  linked_goals: number;
  average_progress_percent: number;
  days: RutinaReportRoutineBreakdownDayItem[];
}

export interface RutinaReportData {
  mode: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  period_label: string;
  total_assignments: number;
  completed_assignments: number;
  completion_rate: number;
  days_with_routines: number;
  completed_days: number;
  top_routines: RutinaReportRoutineItem[];
  day_part_usage: RutinaReportDayPartItem[];
  daily_distribution: RutinaReportDayItem[];
  goal_completion_summary?: {
    total_completions: number;
    days_with_completions: number;
    distinct_goals: number;
  };
  goal_completion_log?: RutinaReportGoalLogDayItem[];
  routine_breakdown?: RutinaReportRoutineBreakdownItem[];
  streaks: {
    current: number;
    max: number;
  };
  coverage: {
    active_routines: number;
    assigned_active_routines: number;
    percent: number;
  };
}

function normalizeRutinaReportData(data: any): RutinaReportData {
  return {
    ...data,
    top_routines: Array.isArray(data?.top_routines) ? data.top_routines : [],
    day_part_usage: Array.isArray(data?.day_part_usage) ? data.day_part_usage : [],
    daily_distribution: Array.isArray(data?.daily_distribution) ? data.daily_distribution : [],
    goal_completion_summary: {
      total_completions: Number(data?.goal_completion_summary?.total_completions ?? 0),
      days_with_completions: Number(data?.goal_completion_summary?.days_with_completions ?? 0),
      distinct_goals: Number(data?.goal_completion_summary?.distinct_goals ?? 0),
    },
    goal_completion_log: Array.isArray(data?.goal_completion_log) ? data.goal_completion_log : [],
    routine_breakdown: Array.isArray(data?.routine_breakdown)
      ? data.routine_breakdown.map((routine: any) => ({
          ...routine,
          failed_days: Number(routine?.failed_days ?? 0),
          neutral_days: Number(routine?.neutral_days ?? 0),
          average_progress_percent: Number(routine?.average_progress_percent ?? 0),
          days: Array.isArray(routine?.days)
            ? routine.days.map((day: any) => ({
                ...day,
                progress_percent: day?.progress_percent == null ? null : Number(day.progress_percent),
                is_neutral: Boolean(day?.is_neutral),
                completed_count: Number(day?.completed_count ?? 0),
                skipped_count: Number(day?.skipped_count ?? 0),
                pending_count: Number(day?.pending_count ?? 0),
                goal_count: Number(day?.goal_count ?? 0),
                goals: Array.isArray(day?.goals) ? day.goals : [],
              }))
            : [],
        }))
      : [],
    streaks: {
      current: Number(data?.streaks?.current ?? 0),
      max: Number(data?.streaks?.max ?? 0),
    },
    coverage: {
      active_routines: Number(data?.coverage?.active_routines ?? 0),
      assigned_active_routines: Number(data?.coverage?.assigned_active_routines ?? 0),
      percent: Number(data?.coverage?.percent ?? 0),
    },
  };
}

export const rutinasAPI = {
  getRutinas: async (): Promise<Rutina[]> => {
    const r = await fetch(`${API_BASE_URL}/rutinas`);
    if (!r.ok) throw new Error('Error fetching rutinas');
    return r.json();
  },

  createRutina: async (data: {
    nombre: string;
    parte_dia: string;
    color?: string;
    categoria?: string;
    descripcion?: string;
    dias_semana: number[];
    bloques: Omit<RutinaBloque, 'id' | 'rutina_id'>[];
  }): Promise<Rutina> => {
    const r = await fetch(`${API_BASE_URL}/rutinas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error creating rutina');
    return r.json();
  },

  updateRutina: async (id: number, data: {
    nombre?: string;
    parte_dia?: string;
    color?: string;
    categoria?: string;
    descripcion?: string;
    dias_semana?: number[];
    bloques?: Omit<RutinaBloque, 'id' | 'rutina_id'>[];
  }): Promise<Rutina> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error updating rutina');
    return r.json();
  },

  deleteRutina: async (id: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Error deleting rutina');
  },

  getSemana: async (fechaInicio: string): Promise<DiaSemana[]> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/semana?fecha_inicio=${fechaInicio}`);
    if (!r.ok) throw new Error('Error fetching semana');
    return r.json();
  },

  createAsignacion: async (data: {
    fecha: string;
    parte_dia: string;
    rutina_id: number;
  }): Promise<RutinaAsignacion> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/asignaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error creating asignacion');
    return r.json();
  },

  updateAsignacion: async (id: number, data: {
    rutina_id?: number;
    fecha?: string;
    parte_dia?: string;
    completada?: boolean;
    objetivo_ids?: number[];
  }): Promise<RutinaAsignacion> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/asignaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error updating asignacion');
    return r.json();
  },

  deleteAsignacion: async (id: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/asignaciones/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Error deleting asignacion');
  },

  getRecurrenteGoals: async (): Promise<GoalSimple[]> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/objetivos-recurrentes`);
    if (!r.ok) throw new Error('Error fetching objetivos recurrentes');
    return r.json();
  },

  getHistorial: async (fechaDesde: string, fechaHasta: string): Promise<RutinaAsignacion[]> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/historial?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`);
    if (!r.ok) throw new Error('Error fetching historial');
    return r.json();
  },

  getReport: async (mode: 'weekly' | 'monthly', referenceDate?: string): Promise<RutinaReportData> => {
    let url = `${API_BASE_URL}/rutinas/report?mode=${mode}`;
    if (referenceDate) url += `&reference_date=${referenceDate}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Error fetching rutina report');
    return normalizeRutinaReportData(await r.json());
  },

  sendReportEmail: async (mode: 'weekly' | 'monthly', referenceDate?: string) => {
    let url = `${API_BASE_URL}/rutinas/report/send-email?mode=${mode}`;
    if (referenceDate) url += `&reference_date=${referenceDate}`;
    const r = await fetch(url, { method: 'POST' });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(errorText || 'Error sending rutina report');
    }
    return r.json();
  },

  downloadReport: async (mode: 'weekly' | 'monthly', referenceDate?: string) => {
    let url = `${API_BASE_URL}/rutinas/report/download?mode=${mode}`;
    if (referenceDate) url += `&reference_date=${referenceDate}`;
    const r = await fetch(url);
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(errorText || 'Error downloading rutina report');
    }
    return r.blob();
  },

  addObjetivo: async (rutinaId: number, objetivoId: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${rutinaId}/objetivos/${objetivoId}`, { method: 'POST' });
    if (!r.ok) throw new Error('Error adding objetivo to rutina');
  },

  removeObjetivo: async (rutinaId: number, objetivoId: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${rutinaId}/objetivos/${objetivoId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Error removing objetivo from rutina');
  },
};

export interface DashboardData {
  rachas: { rutinas: number; preguntas: number; objetivos: number };
  hoy: {
    objetivos: { total: number; completados: number };
    rutinas: { total: number; completadas: number };
    preguntas: { respondidas: number; total: number };
  };
  frase_del_dia: { texto: string; autor: string | null } | null;
  today: string;
}

export interface ExternalGoal {
  id: string;
  title: string;
  status: string;
  category: string | null;
  description?: string | null;
  source: 'finance-hub' | 'mindful-study' | string;
  url: string | null;
}

function normalizeExternalGoals(items: any[]): ExternalGoal[] {
  return items.map((item) => ({
    id: String(item.id),
    title: String(item.title ?? ''),
    status: String(item.status ?? ''),
    category: item.category ?? null,
    description:
      typeof (item.description ?? item.descripcion) === 'string'
        ? String(item.description ?? item.descripcion)
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\r\n/g, '\n')
        : null,
    source: item.source ?? 'external',
    url: item.url ?? null,
  }));
}

export interface ReminderPartConfig { enabled: boolean; hour: number; minute: number; }
export interface ReminderConfig { manana: ReminderPartConfig; noche: ReminderPartConfig; }

export const remindersAPI = {
  getConfig: async (): Promise<ReminderConfig> => {
    const r = await fetch(`${API_BASE_URL}/reminders/config`);
    if (!r.ok) throw new Error('Error fetching reminder config');
    return r.json();
  },
  updateConfig: async (config: ReminderConfig): Promise<ReminderConfig> => {
    const r = await fetch(`${API_BASE_URL}/reminders/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!r.ok) throw new Error('Error updating reminder config');
    return r.json();
  },
  testReminder: async (parte: 'manana' | 'noche'): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/reminders/test/${parte}`, { method: 'POST' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || 'Error enviando recordatorio de prueba');
    }
  },
};

export const statsAPI = {
  getDashboard: async (): Promise<DashboardData> => {
    const r = await fetch(`${API_BASE_URL}/stats/dashboard`);
    if (!r.ok) throw new Error('Error fetching dashboard');
    return r.json();
  },
};

export const integrationsAPI = {
  getFinanceHubGoals: async (): Promise<ExternalGoal[]> => {
    const r = await fetch(`${FINANCE_HUB_API_URL}/integration/goals`);
    if (!r.ok) throw new Error('Error fetching finance-hub goals');
    return normalizeExternalGoals(await r.json());
  },
  getMindfulStudyGoals: async (): Promise<ExternalGoal[]> => {
    const r = await fetch(`${MINDFUL_STUDY_API_URL}/integration/goals`);
    if (!r.ok) throw new Error('Error fetching mindful-study goals');
    return normalizeExternalGoals(await r.json());
  },
};

/**
 * Goal Folders API
 */
export const goalFoldersAPI = {
  getFolders: async () => {
    const response = await fetch(`${API_BASE_URL}/goal-folders`);
    if (!response.ok) throw new Error('Error fetching folders');
    return response.json();
  },
  createFolder: async (data: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goal-folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error creating folder');
    return response.json();
  },
  updateFolder: async (id: number, data: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goal-folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error updating folder');
    return response.json();
  },
  deleteFolder: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/goal-folders/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Error deleting folder');
  },
};

/**
 * Función auxiliar para hacer fetch con manejo de errores
 */
export const fetchAPI = async (url: string, options?: RequestInit) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};
