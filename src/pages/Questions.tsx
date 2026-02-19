import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleQuestion, Settings, CheckCircle2, Clock } from 'lucide-react';
import { questionsAPI } from '@/services/api';
import type { Question } from '@/types';

// Mapear datos del backend al formato frontend
const mapBackendQuestion = (item: any): Question => {
  let parsedOptions = [] as Question['options'];
  if (item.options) {
    try {
      parsedOptions = JSON.parse(item.options);
    } catch {
      parsedOptions = [];
    }
  }

  return {
    id: item.id.toString(),
    title: item.text,
    description: item.descripcion || undefined,
    type: (item.type || 'text') as any,
    category: item.categoria || 'general',
    required: item.is_required || false,
    active: item.active,
    createdAt: item.created_at,
    order: 0,
    options: parsedOptions,
  };
};

const isDailyQuestion = (item: any): boolean => {
  const frequency = (item?.frecuencia ?? '').toString().trim().toLowerCase();
  if (!frequency) return true;
  return frequency === 'diaria' || frequency === 'diario' || frequency === 'daily';
};

export default function Questions() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailySession, setDailySession] = useState<{ answered_questions: number; total_questions: number } | null>(null);

  // Cargar preguntas del backend
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const response = await questionsAPI.getQuestions(1, 100, undefined, true, 'diaria');
        const dailyItems = response.items.filter(isDailyQuestion);
        const mappedQuestions = dailyItems.map(mapBackendQuestion);
        setQuestions(mappedQuestions);

        const todayKey = new Date().toISOString().split('T')[0];
        const session = await questionsAPI.getDailySession(todayKey);
        setDailySession(session);
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const activeQuestions = questions.filter(q => q.active);
  
  const answeredCount = dailySession?.answered_questions ?? 0;
  const totalCount = dailySession?.total_questions ?? activeQuestions.length;
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;
  const isComplete = answeredCount === totalCount && totalCount > 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <MessageCircleQuestion className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Preguntas Diarias
          </h1>
          <p className="text-muted-foreground">
            Reflexiona sobre tu día respondiendo preguntas significativas
          </p>
        </div>

        {/* Progress card */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Progreso de Hoy</h2>
              <p className="text-sm text-muted-foreground">
                {isComplete ? '¡Completado!' : `${answeredCount} de ${totalCount} respondidas`}
              </p>
            </div>
            {isComplete ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-semibold">100%</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">{Math.round(progress)}%</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-full ${
                isComplete ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Action cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Answer questions */}
          <button
            onClick={() => navigate('/questions/answer')}
            className="group bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-left transition-all hover:scale-105 hover:shadow-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                <MessageCircleQuestion className="h-6 w-6 text-white" />
              </div>
              {!isComplete && (
                <span className="px-2 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                  {totalCount - answeredCount} pendientes
                </span>
              )}
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2">
              Responder Preguntas
            </h3>
            <p className="text-white/80 text-sm">
              {isComplete 
                ? 'Revisa tus respuestas del día'
                : 'Completa las preguntas diarias de reflexión'
              }
            </p>
          </button>

          {/* Admin */}
          <button
            onClick={() => navigate('/questions/admin')}
            className="group bg-card rounded-2xl p-6 border-2 border-border text-left transition-all hover:scale-105 hover:border-primary/50 hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-muted">
                <Settings className="h-6 w-6 text-foreground" />
              </div>
              <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                {activeQuestions.length} activas
              </span>
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-2">
              Administrar Preguntas
            </h3>
            <p className="text-muted-foreground text-sm">
              Crea, edita y organiza tus preguntas diarias
            </p>
          </button>
        </div>

        {/* Info section */}
        <div className="bg-accent/50 rounded-xl p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-3">¿Por qué preguntas diarias?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Fomenta la reflexión y el autoconocimiento</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Ayuda a identificar patrones en tu comportamiento</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Mantiene un registro de tu evolución personal</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Personaliza las preguntas según tus necesidades</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
