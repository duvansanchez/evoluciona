import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Save, AlertCircle, CalendarDays, Pencil, MessageSquare, Trash2, SkipForward } from 'lucide-react';
import { questionsAPI } from '@/services/api';
import { getLocalDateString } from '@/lib/utils';
import type { Question, QuestionFeedback } from '@/types';

export default function QuestionsAnswer() {
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [skippedQuestionIds, setSkippedQuestionIds] = useState<Set<string>>(new Set());
  const [feedbacks, setFeedbacks] = useState<Record<string, QuestionFeedback>>({});
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackQuestion, setFeedbackQuestion] = useState<Question | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const todayKey = getLocalDateString();
  const dateParam = searchParams.get('date');
  const targetDate = dateParam ?? todayKey;
  const isYesterday = targetDate !== todayKey;
  const isViewOnly = searchParams.get('view') === '1';
  const isHistory = searchParams.get('history') === '1';

  // In history mode, show all questions (including inactive); otherwise only active ones
  const displayQuestions = isHistory
    ? questions
    : questions.filter(q => q.active).sort((a, b) => {
        const aSaved = savedQuestions.has(a.id) ? 1 : 0;
        const bSaved = savedQuestions.has(b.id) ? 1 : 0;
        if (aSaved !== bSaved) return aSaved - bSaved;
        return a.order - b.order;
      });

  const targetDateLabel = new Date(targetDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const answeredCount = displayQuestions.filter(q => {
    const v = responses[q.id];
    return skippedQuestionIds.has(q.id) || (v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== ''));
  }).length;
  const totalCount = displayQuestions.length;
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  // Preguntas que tienen respuesta en el formulario actual (para el modal de confirmación)
  const pendingToSave = displayQuestions.filter(q => {
    const v = responses[q.id];
    return v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== '');
  });

  const isDailyQuestion = (item: any): boolean => {
    const frequency = (item?.frecuencia ?? '').toString().trim().toLowerCase();
    if (!frequency) return true;
    return frequency === 'diaria' || frequency === 'diario' || frequency === 'daily';
  };

  const mapFeedbacks = (items: any[]): Record<string, QuestionFeedback> => {
    return items.reduce((acc, item) => {
      const key = item.question_id?.toString?.() ?? item.questionId?.toString?.();
      if (!key) return acc;
      acc[key] = {
        id: (item.id ?? '').toString(),
        questionId: key,
        date: item.date ?? item.fecha ?? targetDate,
        text: item.text ?? item.texto ?? '',
        createdAt: item.created_at ?? item.createdAt,
        updatedAt: item.updated_at ?? item.updatedAt,
      };
      return acc;
    }, {} as Record<string, QuestionFeedback>);
  };

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);

        if (isHistory) {
          // History mode: load responses with question data from history endpoint
          const historyData = await questionsAPI.getHistorySession(targetDate);
          const entries: any[] = historyData.entries ?? [];

          const mapped = entries.map((entry: any): Question => {
            let parsedOptions = [] as Question['options'];
            if (entry.question_options) {
              try { parsedOptions = JSON.parse(entry.question_options); } catch { parsedOptions = []; }
            }
            return {
              id: entry.question_id.toString(),
              title: entry.question_text || `Pregunta ${entry.question_id}`,
              description: undefined,
              type: (entry.question_type || 'text') as any,
              category: entry.question_category || 'general',
              required: false,
              active: entry.question_active !== false,
              createdAt: entry.answered_at,
              order: 0,
              options: parsedOptions,
              skipped: Boolean(entry.skipped),
            };
          });
          setQuestions(mapped);

          const initialResponses: Record<string, string | string[]> = {};
          const alreadySaved = new Set<string>();
          const loadedFeedbacks = await questionsAPI.getQuestionFeedbacks(targetDate);
          const loadedSkips = await questionsAPI.getSkippedQuestions(targetDate);
          entries.forEach((entry: any) => {
            const qid = entry.question_id.toString();
            const raw = entry.response ?? '';
            let parsed: string | string[] = raw;
            if (typeof raw === 'string' && raw.trim().startsWith('[')) {
              try { parsed = JSON.parse(raw); } catch { /* noop */ }
            }
            initialResponses[qid] = parsed;
            if (raw !== '') alreadySaved.add(qid);
          });
          setResponses(initialResponses);
          setSavedQuestions(alreadySaved);
          setSkippedQuestionIds(new Set(loadedSkips.map(id => id.toString())));
          setFeedbacks(mapFeedbacks(loadedFeedbacks));
        } else {
          // Normal mode: load active questions + session responses
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

          // Cargar respuestas guardadas del día (hoy o ayer)
          const session = await questionsAPI.getDailySession(targetDate);
          const loadedFeedbacks = await questionsAPI.getQuestionFeedbacks(targetDate);
          const loadedSkips = await questionsAPI.getSkippedQuestions(targetDate);
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
          setSkippedQuestionIds(new Set(loadedSkips.map(id => id.toString())));
          setFeedbacks(mapFeedbacks(loadedFeedbacks));
        }
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
    setSkippedQuestionIds(prev => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    // Marcar como no guardada si el usuario modificó la respuesta
    setSavedQuestions(prev => { const s = new Set(prev); s.delete(questionId); return s; });
  };

  const handleSaveClick = () => {
    if (pendingToSave.length === 0) return;
    setShowConfirm(true);
  };

  const handleToggleSkip = async (questionId: string) => {
    const isSkipped = skippedQuestionIds.has(questionId);
    const nextSkipped = new Set(skippedQuestionIds);

    if (isSkipped) {
      nextSkipped.delete(questionId);
      setSkippedQuestionIds(nextSkipped);
      try {
        await questionsAPI.unskipQuestionForDate(targetDate, questionId);
      } catch (error) {
        console.error('Error unskipping question:', error);
        setSkippedQuestionIds(new Set(skippedQuestionIds));
      }
      return;
    }

    nextSkipped.add(questionId);
    setSkippedQuestionIds(nextSkipped);
    setResponses(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setSavedQuestions(prev => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });

    try {
      await questionsAPI.skipQuestionForDate(targetDate, questionId);
    } catch (error) {
      console.error('Error skipping question:', error);
      setSkippedQuestionIds(new Set(skippedQuestionIds));
    }
  };

  const openFeedback = (question: Question) => {
    setFeedbackQuestion(question);
    setFeedbackDraft(feedbacks[question.id]?.text ?? '');
    setFeedbackError(null);
  };

  const closeFeedback = () => {
    if (feedbackSaving) return;
    setFeedbackQuestion(null);
    setFeedbackDraft('');
    setFeedbackError(null);
  };

  const handleSaveFeedback = async () => {
    if (!feedbackQuestion) return;
    const trimmed = feedbackDraft.trim();
    if (!trimmed) {
      setFeedbackError('Escribe un feedback antes de guardar.');
      return;
    }

    try {
      setFeedbackSaving(true);
      setFeedbackError(null);
      const saved = await questionsAPI.saveQuestionFeedback(targetDate, feedbackQuestion.id, trimmed);
      setFeedbacks(prev => ({
        ...prev,
        [feedbackQuestion.id]: {
          id: saved.id.toString(),
          questionId: saved.question_id?.toString?.() ?? feedbackQuestion.id,
          date: saved.date,
          text: saved.text,
          createdAt: saved.created_at,
          updatedAt: saved.updated_at,
        },
      }));
      setFeedbackQuestion(null);
      setFeedbackDraft('');
    } catch (error) {
      console.error('Error saving feedback:', error);
      setFeedbackError('No se pudo guardar el feedback.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const handleDeleteFeedback = async () => {
    if (!feedbackQuestion) return;
    try {
      setFeedbackSaving(true);
      setFeedbackError(null);
      await questionsAPI.deleteQuestionFeedback(targetDate, feedbackQuestion.id);
      setFeedbacks(prev => {
        const next = { ...prev };
        delete next[feedbackQuestion.id];
        return next;
      });
      setFeedbackQuestion(null);
      setFeedbackDraft('');
    } catch (error) {
      console.error('Error deleting feedback:', error);
      setFeedbackError('No se pudo eliminar el feedback.');
    } finally {
      setFeedbackSaving(false);
    }
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
      await questionsAPI.saveDailyResponses(targetDate, payload);
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
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {isHistory && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    <CalendarDays className="h-3 w-3" />
                    Historial
                  </span>
                )}
                {!isHistory && isYesterday && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold">
                    <CalendarDays className="h-3 w-3" />
                    Ayer
                  </span>
                )}
                {!isHistory && isViewOnly && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                    Solo lectura
                  </span>
                )}
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  {isHistory
                    ? 'Respuestas del Día'
                    : isYesterday
                      ? (isViewOnly ? 'Respuestas de Ayer' : 'Preguntas de Ayer')
                      : 'Preguntas del Día'}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground capitalize">{targetDateLabel}</p>
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
          ) : displayQuestions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No hay respuestas registradas para este día.
            </div>
          ) : (
            displayQuestions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index + 1}
                value={responses[question.id]}
                feedback={feedbacks[question.id]}
                isSkipped={skippedQuestionIds.has(question.id)}
                isSaved={savedQuestions.has(question.id)}
                onChange={(value) => handleResponse(question.id, value)}
                onToggleSkip={() => handleToggleSkip(question.id)}
                onOpenFeedback={() => openFeedback(question)}
                readOnly={isViewOnly || isHistory}
                showDeactivatedBadge={isHistory && !question.active}
              />
            ))
          )}
        </div>

        {/* Guardar button / Editar button */}
        {!loading && !isHistory && (
          <div className="sticky bottom-6 flex justify-center pb-2">
            {isViewOnly ? (
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('view');
                  window.location.href = `/questions/answer?${params.toString()}`;
                }}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white shadow-lg bg-primary hover:bg-primary/90 hover:scale-105 transition-all"
              >
                <Pencil className="h-5 w-5" />
                Editar respuestas
              </button>
            ) : (
              <button
                onClick={handleSaveClick}
                disabled={pendingToSave.length === 0}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white shadow-lg transition-all ${
                  pendingToSave.length > 0
                    ? 'bg-primary hover:bg-primary/90 hover:scale-105'
                    : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                }`}
              >
                <Save className="h-5 w-5" />
                Guardar Respuestas
              </button>
            )}
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

      {feedbackQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-xl border border-border">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Feedback de la pregunta</h2>
                <p className="text-sm text-muted-foreground mt-1">{feedbackQuestion.title}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{targetDateLabel}</p>
              </div>
              <button
                onClick={closeFeedback}
                disabled={feedbackSaving}
                className="px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cerrar
              </button>
            </div>

            <div className="p-6 space-y-4">
              <textarea
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                readOnly={isViewOnly || isHistory}
                placeholder="Escribe el contexto, lo que pasó hoy, lo que notaste o lo que te deja esta pregunta..."
                className="w-full min-h-[180px] px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y read-only:opacity-80"
                maxLength={4000}
              />
              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <span>{feedbackDraft.length}/4000 caracteres</span>
                {feedbacks[feedbackQuestion.id]?.updatedAt && (
                  <span>
                    Última actualización: {new Date(feedbacks[feedbackQuestion.id].updatedAt + '').toLocaleString('es-ES')}
                  </span>
                )}
              </div>
              {feedbackError && (
                <p className="text-sm text-destructive">{feedbackError}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 p-6 pt-0">
              <div>
                {!isViewOnly && !isHistory && feedbacks[feedbackQuestion.id] && (
                  <button
                    onClick={handleDeleteFeedback}
                    disabled={feedbackSaving}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-destructive/20 text-destructive font-medium hover:bg-destructive/5 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                )}
              </div>

              {!isViewOnly && !isHistory && (
                <button
                  onClick={handleSaveFeedback}
                  disabled={feedbackSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {feedbackSaving ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {feedbackSaving ? 'Guardando...' : 'Guardar feedback'}
                </button>
              )}
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
  feedback,
  isSkipped,
  isSaved,
  onChange,
  onToggleSkip,
  onOpenFeedback,
  readOnly = false,
  showDeactivatedBadge = false,
}: {
  question: Question;
  index: number;
  value: string | string[] | undefined;
  feedback?: QuestionFeedback;
  isSkipped: boolean;
  isSaved: boolean;
  onChange: (value: string | string[]) => void;
  onToggleSkip: () => void;
  onOpenFeedback: () => void;
  readOnly?: boolean;
  showDeactivatedBadge?: boolean;
}) {
  const isAnswered = value !== undefined && (Array.isArray(value) ? value.length > 0 : value !== '');
  const hasFeedback = Boolean(feedback?.text?.trim());

  // In read-only mode, render the answer as plain text
  const renderReadOnly = () => {
    if (!isAnswered) return <p className="text-sm text-muted-foreground italic">Sin respuesta</p>;
    if (question.type === 'text') {
      return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{value as string}</p>;
    }
    if (question.type === 'checkbox') {
      let selected: string[] = [];
      if (Array.isArray(value)) {
        selected = value;
      } else if (typeof value === 'string' && value.trim().startsWith('[')) {
        try { selected = JSON.parse(value); } catch { selected = [value]; }
      } else if (typeof value === 'string' && value !== '') {
        selected = [value];
      }
      return (
        <div className="flex flex-wrap gap-2">
          {selected.map(v => {
            const label = question.options?.find(o => o.value === v)?.label ?? v;
            return <span key={v} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{label}</span>;
          })}
        </div>
      );
    }
    // radio / select
    const label = question.options?.find(o => o.value === (value as string))?.label ?? (value as string);
    return <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">{label}</span>;
  };

  return (
    <div className={`bg-card rounded-xl p-6 border transition-all ${
      isSkipped
        ? 'border-amber-400/60 bg-amber-50/30 shadow-sm'
        : readOnly
          ? 'border-green-200 bg-green-50/30'
          : isSaved ? 'border-green-500/50 shadow-sm' : isAnswered ? 'border-primary/50 shadow-sm' : 'border-border'
    }`}>
      {/* Question header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isSkipped
            ? 'bg-amber-500 text-white'
            : readOnly || isSaved
              ? 'bg-green-500 text-white'
            : isAnswered
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        }`}>
          {(readOnly && isAnswered) || isSaved ? <CheckCircle2 className="h-4 w-4" /> : isSkipped ? <SkipForward className="h-4 w-4" /> : index}
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
        <div className="flex flex-col items-end gap-1">
          {!readOnly && (
            <button
              onClick={onToggleSkip}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                isSkipped
                  ? 'text-amber-700 bg-amber-100 border-amber-200 hover:bg-amber-200/80'
                  : 'text-muted-foreground bg-background border-border hover:bg-muted'
              }`}
            >
              <SkipForward className="h-3.5 w-3.5" />
              {isSkipped ? 'Quitar salto' : 'Saltar hoy'}
            </button>
          )}
          {(hasFeedback || !readOnly) && (
            <button
              onClick={onOpenFeedback}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                hasFeedback
                  ? 'text-primary bg-primary/10 border-primary/20 hover:bg-primary/15'
                  : 'text-muted-foreground bg-background border-border hover:bg-muted'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {hasFeedback ? (readOnly ? 'Ver feedback' : 'Editar feedback') : 'Feedback'}
            </button>
          )}
          {showDeactivatedBadge && (
            <span className="flex-shrink-0 text-xs font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
              Desactivada
            </span>
          )}
          {(readOnly || isSaved) && isAnswered && (
            <span className="flex-shrink-0 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              Guardada
            </span>
          )}
          {isSkipped && (
            <span className="flex-shrink-0 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {readOnly ? 'Saltada' : 'Saltada hoy'}
            </span>
          )}
        </div>
      </div>

      {/* Question input / read-only display */}
      <div className="ml-11">
        {isSkipped ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">Pregunta saltada para este día.</p>
            <p className="text-sm text-amber-700 mt-1">
              Queda registrada como omitida intencionalmente, no como falta de respuesta.
            </p>
          </div>
        ) : readOnly ? renderReadOnly() : (
          <>
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
          </>
        )}
        {hasFeedback && (
          <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Feedback del día</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{feedback?.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
