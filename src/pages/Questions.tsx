import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleQuestion, Settings, CheckCircle2, Clock, CalendarDays, Eye, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { questionsAPI } from '@/services/api';
import { getLocalDateString } from '@/lib/utils';
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
  const [yesterdaySession, setYesterdaySession] = useState<{ answered_questions: number; total_questions: number } | null>(null);
  const [todaySkippedCount, setTodaySkippedCount] = useState(0);
  const [yesterdaySkippedCount, setYesterdaySkippedCount] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<{ date: string; has_responses: boolean; response_count: number; answered_count?: number; skipped_count?: number; status?: 'none' | 'answered' | 'skipped' | 'mixed' }[]>([]);

  // Cargar preguntas del backend
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const response = await questionsAPI.getQuestions(1, 100, undefined, true, 'diaria');
        const dailyItems = response.items.filter(isDailyQuestion);
        const mappedQuestions = dailyItems.map(mapBackendQuestion);
        setQuestions(mappedQuestions);

        const todayKey = getLocalDateString();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = getLocalDateString(yesterdayDate);

        const [session, ySession, todaySkips, yesterdaySkips] = await Promise.all([
          questionsAPI.getDailySession(todayKey),
          questionsAPI.getDailySession(yesterdayKey).catch(() => null),
          questionsAPI.getSkippedQuestions(todayKey).catch(() => []),
          questionsAPI.getSkippedQuestions(yesterdayKey).catch(() => []),
        ]);
        setTodaySkippedCount(todaySkips.length);
        setYesterdaySkippedCount(yesterdaySkips.length);
        // Use responses.length as source of truth (answered_questions in DB can be stale)
        setDailySession(session ? {
          answered_questions: session.responses?.length ?? session.answered_questions ?? 0,
          total_questions: session.total_questions ?? 0,
        } : null);
        setYesterdaySession(ySession ? {
          answered_questions: ySession.responses?.length ?? ySession.answered_questions ?? 0,
          total_questions: ySession.total_questions ?? 0,
        } : null);
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  useEffect(() => {
    questionsAPI.getCalendarSummary(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1)
      .then(data => setCalendarDays(data.days))
      .catch(() => {});
  }, [calendarMonth]);

  const today = getLocalDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDateString(yesterdayDate);
  const activeQuestions = questions.filter(q => q.active);
  const yesterdayAnswered = yesterdaySession?.answered_questions ?? 0;
  const yesterdayCovered = yesterdayAnswered + yesterdaySkippedCount;
  const yesterdayTotal = yesterdaySession?.total_questions ?? activeQuestions.length;
  const yesterdayComplete = yesterdayCovered > 0 && yesterdayCovered >= yesterdayTotal && yesterdayTotal > 0;
  
  const answeredCount = (dailySession?.answered_questions ?? 0) + todaySkippedCount;
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
                {isComplete ? '¡Completado!' : `${answeredCount} de ${totalCount} cubiertas`}
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
        <div className="grid md:grid-cols-2 gap-4 lg:grid-cols-3">
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

          {/* Ayer */}
          {yesterdayComplete ? (
            <div className="rounded-2xl p-6 border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 text-left">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-green-100">
                  <CalendarDays className="h-6 w-6 text-green-600" />
                </div>
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Completo
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-green-800">¡Ya respondidas!</p>
                  <p className="text-xs text-green-600 mt-0.5">Completaste todas las preguntas de ayer</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => navigate(`/questions/answer?date=${yesterdayKey}&view=1`)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver respuestas
                </button>
                <button
                  onClick={() => navigate(`/questions/answer?date=${yesterdayKey}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-green-50 border border-green-200 text-green-700 text-xs font-semibold transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate(`/questions/answer?date=${yesterdayKey}`)}
              className="group bg-card rounded-2xl p-6 border-2 border-amber-200 text-left transition-all hover:scale-105 hover:border-amber-400 hover:shadow-lg"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-amber-50">
                  <CalendarDays className="h-6 w-6 text-amber-500" />
                </div>
                {yesterdayAnswered > 0 ? (
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                    {yesterdayCovered}/{yesterdayTotal} cubiertas
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                    Sin respuestas
                  </span>
                )}
              </div>
              <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                Preguntas de Ayer
              </h3>
              <p className="text-muted-foreground text-sm">
                {yesterdayAnswered > 0
                  ? 'Completa las preguntas que quedaron pendientes'
                  : 'Responde las preguntas del día anterior'
                }
              </p>
            </button>
          )}

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

        {/* Calendar / Historial */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Historial de Respuestas</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-semibold text-foreground min-w-[120px] text-center capitalize">
                {calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                disabled={calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() === new Date().getMonth()}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <CalendarGrid
            days={calendarDays}
            month={calendarMonth}
            today={today}
            onDayClick={(date) => navigate(`/questions/answer?date=${date}&view=1&history=1`)}
          />
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Días con <span className="inline-block w-2 h-2 rounded-full bg-green-500 mx-1 align-middle" />respuestas · Clic para ver
          </p>
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

function CalendarGrid({
  days,
  month,
  today,
  onDayClick,
}: {
  days: { date: string; has_responses: boolean; response_count: number; answered_count?: number; skipped_count?: number; status?: 'none' | 'answered' | 'skipped' | 'mixed' }[];
  month: Date;
  today: string;
  onDayClick: (date: string) => void;
}) {
  // First day of month (0=Sun..6=Sat), convert to Mon-first (0=Mon..6=Sun)
  const firstDow = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1; // blanks before first day

  const dayMap = new Map(days.map(d => [d.date, d]));

  const cells: (string | null)[] = [
    ...Array(offset).fill(null),
    ...days.map(d => d.date),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((date, i) => {
        if (!date) return <div key={i} />;
        const info = dayMap.get(date);
        const isToday = date === today;
        const hasDot = info?.has_responses ?? false;
        const status = info?.status ?? 'none';
        const dayNum = new Date(date + 'T12:00:00').getDate();
        const isFuture = date > today;
        const dotClass = status === 'skipped'
          ? 'bg-amber-500'
          : status === 'mixed'
            ? 'bg-sky-500'
            : 'bg-green-500';
        const hoverClass = status === 'skipped'
          ? 'hover:bg-amber-100'
          : status === 'mixed'
            ? 'hover:bg-sky-100'
            : 'hover:bg-green-100';
        const title = !hasDot
          ? 'Sin respuestas'
          : status === 'skipped'
            ? `${info?.skipped_count ?? 0} preguntas saltadas`
            : status === 'mixed'
              ? `${info?.answered_count ?? 0} respuestas y ${info?.skipped_count ?? 0} preguntas saltadas`
              : `${info?.answered_count ?? info?.response_count ?? 0} respuestas`;

        return (
          <button
            key={date}
            onClick={() => !isFuture && hasDot && onDayClick(date)}
            disabled={isFuture || !hasDot}
            title={title}
            className={`
              relative flex flex-col items-center justify-center rounded-lg py-1.5 text-sm font-medium transition-all
              ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}
              ${isFuture ? 'text-muted-foreground/30 cursor-default' :
                hasDot ? `text-foreground ${hoverClass} cursor-pointer` :
                'text-muted-foreground cursor-default'}
            `}
          >
            <span>{dayNum}</span>
            {hasDot && (
              <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${dotClass}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
