import type { Goal, Phrase, PhraseCategory } from '@/types';

export const mockGoals: Goal[] = [
  {
    id: '1', title: 'Meditar 15 minutos', description: 'Sesión de meditación guiada por la mañana',
    category: 'daily', priority: 'high', recurring: true, dayPart: 'morning',
    subGoals: [
      { id: 's1', title: 'Preparar espacio', completed: true, completedAt: '2026-02-18T07:00:00' },
      { id: 's2', title: 'Meditación guiada', completed: false },
    ],
    completed: false, skipped: false, createdAt: '2026-02-01T08:00:00',
  },
  {
    id: '2', title: 'Leer 30 páginas', description: 'Continuar con el libro actual',
    category: 'daily', priority: 'medium', recurring: true, dayPart: 'evening',
    subGoals: [], completed: true, completedAt: '2026-02-18T21:00:00', skipped: false, createdAt: '2026-02-01T08:00:00',
  },
  {
    id: '3', title: 'Ejercicio cardiovascular', description: '30 min de cardio',
    category: 'daily', priority: 'high', recurring: true, dayPart: 'morning',
    subGoals: [], completed: false, skipped: false, createdAt: '2026-02-01T08:00:00',
  },
  {
    id: '4', title: 'Escribir en diario', description: 'Reflexión del día',
    category: 'daily', priority: 'low', recurring: true, dayPart: 'evening',
    subGoals: [], completed: false, skipped: true, createdAt: '2026-02-01T08:00:00',
  },
  {
    id: '5', title: 'Revisar finanzas semanales', description: 'Revisar gastos e ingresos de la semana',
    category: 'weekly', priority: 'medium', recurring: true,
    subGoals: [
      { id: 's3', title: 'Revisar extracto bancario', completed: true },
      { id: 's4', title: 'Actualizar presupuesto', completed: false },
      { id: 's5', title: 'Planificar semana siguiente', completed: false },
    ],
    completed: false, skipped: false, createdAt: '2026-02-10T08:00:00',
  },
  {
    id: '6', title: 'Llamar a un amigo', description: 'Mantener contacto social',
    category: 'weekly', priority: 'low', recurring: true,
    subGoals: [], completed: true, completedAt: '2026-02-16T15:00:00', skipped: false, createdAt: '2026-02-10T08:00:00',
  },
  {
    id: '7', title: 'Curso de React avanzado', description: 'Completar módulo 5',
    category: 'monthly', priority: 'high', recurring: false,
    subGoals: [
      { id: 's6', title: 'Ver videos del módulo', completed: true },
      { id: 's7', title: 'Hacer ejercicios prácticos', completed: false },
      { id: 's8', title: 'Proyecto final del módulo', completed: false },
    ],
    completed: false, skipped: false, createdAt: '2026-02-01T08:00:00',
  },
  {
    id: '8', title: 'Correr una media maratón', description: 'Entrenar para completar 21km',
    category: 'yearly', priority: 'high', recurring: false, estimatedHours: 200,
    subGoals: [
      { id: 's9', title: 'Completar plan de 12 semanas', completed: false },
      { id: 's10', title: 'Inscribirse en carrera', completed: true },
    ],
    completed: false, skipped: false, createdAt: '2026-01-01T08:00:00',
  },
  {
    id: '9', title: 'Aprender a tocar guitarra', description: 'Nivel básico-intermedio',
    category: 'general', priority: 'medium', recurring: false,
    subGoals: [], completed: false, skipped: false, createdAt: '2026-01-15T08:00:00',
  },
];

export const mockPhraseCategories: PhraseCategory[] = [
  {
    id: 'cat1', name: 'Desarrollo Interior', description: 'Frases sobre crecimiento personal y autoconocimiento', active: true,
    subcategories: [
      { id: 'sub1', name: 'Virtudes', description: 'Cultivar las mejores cualidades', active: true },
      { id: 'sub2', name: 'Defectos', description: 'Reconocer y trabajar en nuestras debilidades', active: true },
      { id: 'sub3', name: 'Creencias limitantes', description: 'Identificar y superar pensamientos que nos frenan', active: true },
    ],
  },
  {
    id: 'cat2', name: 'Motivación', description: 'Frases para inspirar acción', active: true,
    subcategories: [
      { id: 'sub4', name: 'Acción', description: 'Impulso para actuar', active: true },
      { id: 'sub5', name: 'Reflexión', description: 'Pensamientos profundos', active: true },
    ],
  },
  {
    id: 'cat3', name: 'Relaciones', description: 'Frases sobre conexiones humanas', active: true,
    subcategories: [
      { id: 'sub6', name: 'Familia', active: true },
      { id: 'sub7', name: 'Amistades', active: true },
    ],
  },
];

export const mockPhrases: Phrase[] = [
  {
    id: 'p1', text: 'El único modo de hacer un gran trabajo es amar lo que haces.',
    author: 'Steve Jobs', categoryId: 'cat2', subcategoryId: 'sub4',
    active: true, reviewCount: 12, lastReviewedAt: '2026-02-18T08:00:00', createdAt: '2026-01-01',
  },
  {
    id: 'p2', text: 'No es valiente quien no tiene miedo, sino quien sabe conquistarlo.',
    author: 'Nelson Mandela', categoryId: 'cat1', subcategoryId: 'sub1',
    active: true, reviewCount: 8, lastReviewedAt: '2026-02-17T10:00:00', createdAt: '2026-01-05',
  },
  {
    id: 'p3', text: 'La disciplina es el puente entre las metas y los logros.',
    author: 'Jim Rohn', categoryId: 'cat2', subcategoryId: 'sub4',
    active: true, reviewCount: 15, lastReviewedAt: '2026-02-18T09:00:00', createdAt: '2026-01-03',
  },
  {
    id: 'p4', text: 'Conocerse a sí mismo es el principio de toda sabiduría.',
    author: 'Aristóteles', categoryId: 'cat1', subcategoryId: 'sub1',
    notes: 'Reflexionar sobre esto cada mañana',
    active: true, reviewCount: 5, lastReviewedAt: '2026-02-15T08:00:00', createdAt: '2026-01-10',
  },
  {
    id: 'p5', text: 'La familia no es algo importante. Es todo.',
    author: 'Michael J. Fox', categoryId: 'cat3', subcategoryId: 'sub6',
    active: true, reviewCount: 3, lastReviewedAt: '2026-02-10T20:00:00', createdAt: '2026-01-15',
  },
  {
    id: 'p6', text: 'Nuestras creencias limitantes son solo historias que nos contamos.',
    categoryId: 'cat1', subcategoryId: 'sub3',
    active: false, reviewCount: 1, createdAt: '2026-01-20',
  },
];
