/**
 * Servicio API para conectar con el backend FastAPI
 */

const API_BASE_URL = 'http://127.0.0.1:3001/api';

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
  
  getSubGoals: async (goalId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/subgoals`);
    if (!response.ok) throw new Error('Error fetching subgoals');
    return response.json();
  },
};

/**
 * Phrases API
 */
export const phrasesAPI = {
  getPhrases: async (page = 1, page_size = 50, categoryId?: number, subcategoryId?: number) => {
    let url = `${API_BASE_URL}/phrases?page=${page}&page_size=${page_size}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (subcategoryId) url += `&subcategory_id=${subcategoryId}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching phrases');
    return response.json() as Promise<PaginatedResponse<any>>;
  },

  getCategories: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories`);
    if (!response.ok) throw new Error('Error fetching phrase categories');
    return response.json();
  },
};

/**
 * Questions API
 */
export const questionsAPI = {
  getQuestions: async (page = 1, page_size = 50, category?: string) => {
    let url = `${API_BASE_URL}/questions?page=${page}&page_size=${page_size}`;
    if (category) url += `&category=${category}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching questions');
    return response.json() as Promise<PaginatedResponse<any>>;
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
