import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Save, AlertCircle } from 'lucide-react';
import { questionsAPI } from '@/services/api';
import type { Question } from '@/types';

export default function QuestionsAnswer() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeQuestions = questions.filter(q => q.active).sort((a, b) => {
    const aSaved = savedQuestions.has(a.id) ? 1 : 0;
    const bSaved = savedQuestions.has(b.id) ? 1 : 0;
    if (aSaved !== bSaved) return aSaved - bSaved;
    return a.order - b.order;
  });

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const todayKey = new Date().toISOString().split('T')[0];

  const answeredCount = activeQuestions.filter(q => {
    const v = responses[q.id];
    return v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== '');
  }).length;
  const totalCount = activeQuestions.length;
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  // Preguntas que tienen respuesta en el formulario actual (para el modal de confirmación)
  const pendingToSave = activeQuestions.filter(q => {
    const v = responses[q.id];
    return v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== '');
  });

  const isDailyQuestion = (item: any): boolean => {
    const frequency = (item?.frecuencia ?? '').toString().trim().toLowerCase();
    if (!frequency) return true;
    return frequency === 'diaria' || frequency === 'diario' || frequency === 'daily';
  };

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const response = await questionsAPI.getQuestions(1, 100, undefined, true, 'diaria');
        const mapped = response.items.filter(isDailyQuestion).map((item: any): Question => {
          let parsedOptions = [] as Question['options'];
          if (item.options) {
            try { parsedOptions = JSON.parse(item.options); } catch { parsedOptions = []; }
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
        });
        setQuestions(mapped);

        // Cargar respuestas guardadas del día
        const session = await questionsAPI.getDailySession(todayKey);
const initialResponses: Record<string, string | string[]> = {};
        const alreadySaved = new Set<string>();

        session.responses?.forEach((r: any) => {
          if (!r.question_id) return;
          const raw = r.response ?? '';
          let parsed: string | string[] = raw;
          if (typeof raw === 'string' && raw.trim().startsWith('[')) {
            try { parsed = JSON.parse(raw); } catch { /* noop */ }
          }
          initialResponses[r.question_id.toString()] = parsed;
          if (raw !== '') alreadySaved.add(r.question_id.toString());
        });

        setResponses(initialResponses);
        setSavedQuestions(alreadySaved);
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  const handleResponse = (questionId: string, value: string | string[]) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    // Marcar como no guardada si el usuario modificó la respuesta
    setSavedQuestions(prev => { const s = new Set(prev); s.delete(questionId); return s; });
  };

  const handleSaveClick = () => {
    if (pendingToSave.length === 0) return;
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    try {
      setSaving(true);
      const payload = {
        responses: Object.entries(responses)
          .filter(([, v]) => v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== ''))
          .map(([questionId, value]) => ({
            question_id: questionId,
            response: Array.isArray(value) ? JSON.stringify(value) : value ?? '',
          })),
      };
      await questionsAPI.saveDailyResponses(todayKey, payload);
      // Marcar todas las respondidas como guardadas
      const newSaved = new Set<string>(payload.responses.map(r => r.question_id));
      setSavedQuestions(newSaved);
      setShowConfirm(false);
    } catch (error) {
      console.error('Error saving responses:', error);
    } finally {
      setSaving(false);
    }
  };

  const getResponseLabel = (question: Question, value: string | string[] | undefined): string => {
    if (!value) return '';
    if (Array.isArray(value)) {
      return value
        .map(v => question.options?.find(o => o.value === v)?.label ?? v)
        .join(', ');
    }
    if (question.type === 'select' || question.type === 'radio') {
      return question.options?.find(o => o.value === value)?.label ?? value;
    }
    return value.length > 60 ? value.slice(0, 60) + '…' : value;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground mb-1">
                Preguntas del Día
              </h1>
              <p className="text-sm text-muted-foreground capitalize">{today}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-semibold">{answeredCount}/{totalCount}</span>
            </div>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando preguntas...</div>
          ) : (
            activeQuestions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index + 1}
                value={responses[question.id]}
                isSaved={savedQuestions.has(question.id)}
                onChange={(value) => handleResponse(question.id, value)}
              />
            ))
          )}
        </div>

        {/* Guardar button */}
        {!loading && (
          <div className="sticky bottom-6 flex justify-center pb-2">
            <button
              onClick={handleSaveClick}
              disabled={answeredCount === 0}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white shadow-lg transition-all ${
                answeredCount > 0
                  ? 'bg-primary hover:bg-primary/90 hover:scale-105'
                  : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
              }`}
            >
              <Save className="h-5 w-5" />
              Guardar Respuestas
            </button>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md border border-border">
            {/* Modal header */}
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  ¿Guardar respuestas?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Se guardarán {pendingToSave.length} {pendingToSave.length === 1 ? 'respuesta' : 'respuestas'}
                </p>
              </div>
            </div>

            {/* List of questions to save */}
            <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
              {pendingToSave.map((q, i) => (
                <div key={q.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">{q.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {getResponseLabel(q, responses[q.id])}
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  index,
  value,
  isSaved,
  onChange,
}: {
  question: Question;
  index: number;
  value: string | string[] | undefined;
  isSaved: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const isAnswered = value !== undefined && (Array.isArray(value) ? value.length > 0 : value !== '');

  return (
    <div className={`bg-card rounded-xl p-6 border transition-all ${
      isSaved ? 'border-green-500/50 shadow-sm' : isAnswered ? 'border-primary/50 shadow-sm' : 'border-border'
    }`}>
      {/* Question header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isSaved
            ? 'bg-green-500 text-white'
            : isAnswered
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        }`}>
          {isSaved ? <CheckCircle2 className="h-4 w-4" /> : index}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground mb-1">
            {question.title}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </h3>
          {question.description && (
            <p className="text-sm text-muted-foreground">{question.description}</p>
          )}
        </div>
        {isSaved && (
          <span className="flex-shrink-0 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            Guardada
          </span>
        )}
      </div>

      {/* Question input */}
      <div className="ml-11">
        {question.type === 'text' && (
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Escribe tu respuesta..."
            className="w-full min-h-[100px] px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            maxLength={500}
          />
        )}

        {question.type === 'select' && (
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Selecciona una opción...</option>
            {question.options?.map(opt => (
              <option key={opt.id} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {question.type === 'radio' && (
          <div className="space-y-2">
            {question.options?.map(opt => (
              <label
                key={opt.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-input hover:bg-accent cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={(value as string) === opt.value}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-4 w-4 text-primary focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'checkbox' && (
          <div className="space-y-2">
            {question.options?.map(opt => {
              const selectedValues = (value as string[]) || [];
              const isChecked = selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-input hover:bg-accent cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter(v => v !== opt.value);
                      onChange(next);
                    }}
                    className="h-4 w-4 rounded text-primary focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
