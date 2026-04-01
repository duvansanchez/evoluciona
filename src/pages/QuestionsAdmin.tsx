import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Clock3, Send } from 'lucide-react';
import { questionsAPI, reportsAPI } from '@/services/api';
import QuestionModal from '@/components/questions/QuestionModal';
import type { Question, QuestionCategory } from '@/types';

type ReportScheduleState = {
  enabled: boolean;
  day_of_week: string;
  hour: number;
  minute: number;
};

type ReportHistoryItem = {
  timestamp: string;
  type: string;
  status: string;
  week_label: string;
  source: string;
  details?: {
    days_completed?: number;
    total_responses?: number;
  };
};

const dayLabels: Record<string, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

export default function QuestionsAdmin() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<QuestionCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [sendingPartial, setSendingPartial] = useState(false);
  const [sendingPrevious, setSendingPrevious] = useState(false);
  const [sendingCurrentMonth, setSendingCurrentMonth] = useState(false);
  const [sendingPreviousMonth, setSendingPreviousMonth] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [nextRunTime, setNextRunTime] = useState<string | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [schedule, setSchedule] = useState<ReportScheduleState>({
    enabled: true,
    day_of_week: 'mon',
    hour: 7,
    minute: 0,
  });

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
    updatedAt: item.updated_at || undefined,
    order: item.order ?? 0,
      options: parsedOptions,
    };
  };

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await reportsAPI.getHistory(5);
        setReportHistory(Array.isArray(history.items) ? history.items : []);
      } catch (error) {
        console.error('Error loading report history:', error);
      }
    };

    const loadSchedule = async () => {
      try {
        setScheduleLoading(true);
        setScheduleError(null);
        const state = await reportsAPI.getSchedule();
        const config = state.config ?? {};
        setSchedule({
          enabled: Boolean(config.enabled),
          day_of_week: config.day_of_week || 'mon',
          hour: Number.isInteger(config.hour) ? config.hour : 7,
          minute: Number.isInteger(config.minute) ? config.minute : 0,
        });
        setNextRunTime(state.next_run_time || null);
      } catch (error) {
        console.error('Error loading report schedule:', error);
        setScheduleError('No se pudo cargar la configuración del informe');
      } finally {
        setScheduleLoading(false);
      }
    };

    const loadQuestions = async () => {
      try {
        setLoading(true);
        const firstPage = await questionsAPI.getQuestions(1, 100);
        let allItems = [...firstPage.items];

        if (firstPage.pages > 1) {
          const pagePromises = [];
          for (let page = 2; page <= firstPage.pages; page++) {
            pagePromises.push(questionsAPI.getQuestions(page, 100));
          }
          const restPages = await Promise.all(pagePromises);
          allItems = [...allItems, ...restPages.flatMap(p => p.items)];
        }

        setQuestions(allItems.map(mapBackendQuestion));
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
    loadSchedule();
    loadQuestions();
  }, []);

  const handleSaveSchedule = async () => {
    try {
      setScheduleSaving(true);
      setScheduleError(null);
      setScheduleSuccess(null);

      const state = await reportsAPI.updateSchedule(schedule);
      const updated = state.config;
      setSchedule({
        enabled: Boolean(updated.enabled),
        day_of_week: updated.day_of_week,
        hour: updated.hour,
        minute: updated.minute,
      });
      setNextRunTime(state.next_run_time || null);
      setScheduleSuccess('Programación del informe actualizada');
    } catch (error) {
      console.error('Error updating report schedule:', error);
      setScheduleError('No se pudo actualizar la programación del informe');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSendCurrentWeek = async () => {
    try {
      setSendingPartial(true);
      setScheduleError(null);
      setScheduleSuccess(null);
      const result = await reportsAPI.sendCurrentWeekReport();
      const history = await reportsAPI.getHistory(5);
      setReportHistory(Array.isArray(history.items) ? history.items : []);
      setScheduleSuccess(`Informe parcial enviado: ${result.week}`);
    } catch (error) {
      console.error('Error sending current week report:', error);
      setScheduleError('No se pudo enviar el informe parcial');
    } finally {
      setSendingPartial(false);
    }
  };

  const handleSendPreviousWeek = async () => {
    try {
      setSendingPrevious(true);
      setScheduleError(null);
      setScheduleSuccess(null);
      const result = await reportsAPI.sendPreviousWeekReport();
      const history = await reportsAPI.getHistory(5);
      setReportHistory(Array.isArray(history.items) ? history.items : []);
      setScheduleSuccess(`Informe semanal enviado: ${result.week}`);
    } catch (error) {
      console.error('Error sending previous week report:', error);
      setScheduleError('No se pudo enviar el informe semanal de la semana anterior');
    } finally {
      setSendingPrevious(false);
    }
  };

  const handleSendCurrentMonth = async () => {
    try {
      setSendingCurrentMonth(true);
      setScheduleError(null);
      setScheduleSuccess(null);
      const result = await reportsAPI.sendCurrentMonthReport();
      const history = await reportsAPI.getHistory(5);
      setReportHistory(Array.isArray(history.items) ? history.items : []);
      setScheduleSuccess(`Informe mensual parcial enviado: ${result.week}`);
    } catch (error) {
      console.error('Error sending current month report:', error);
      setScheduleError('No se pudo enviar el informe parcial del mes');
    } finally {
      setSendingCurrentMonth(false);
    }
  };

  const handleSendPreviousMonth = async () => {
    try {
      setSendingPreviousMonth(true);
      setScheduleError(null);
      setScheduleSuccess(null);
      const result = await reportsAPI.sendPreviousMonthReport();
      const history = await reportsAPI.getHistory(5);
      setReportHistory(Array.isArray(history.items) ? history.items : []);
      setScheduleSuccess(`Informe mensual enviado: ${result.week}`);
    } catch (error) {
      console.error('Error sending previous month report:', error);
      setScheduleError('No se pudo enviar el informe mensual del mes anterior');
    } finally {
      setSendingPreviousMonth(false);
    }
  };

  const filteredQuestions = questions
    .filter(q => {
      const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           q.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || q.category === filterCategory;
      const matchesActive = showInactive || q.active;
      return matchesSearch && matchesCategory && matchesActive;
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return (a.order - b.order) || (a.createdAt || '').localeCompare(b.createdAt || '');
    });

  const handleToggleActive = async (id: string) => {
    const target = questions.find(q => q.id === id);
    if (!target) return;

    const nextActive = !target.active;
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, active: nextActive } : q
    ));

    try {
      const payload = {
        active: nextActive,
      };
      const updated = await questionsAPI.updateQuestion(id, payload);
      setQuestions(prev => prev.map(q => q.id === id ? mapBackendQuestion(updated) : q));
    } catch (error) {
      console.error('Error updating question:', error);
      setQuestions(prev => prev.map(q => q.id === id ? target : q));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta pregunta?')) {
      const prevQuestions = questions;
      setQuestions(prev => prev.filter(q => q.id !== id));
      try {
        await questionsAPI.deleteQuestion(id);
      } catch (error) {
        console.error('Error deleting question:', error);
        setQuestions(prevQuestions);
      }
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingQuestion(null);
    setShowModal(true);
  };

  const handleSave = async (formData: any) => {
    const payload = {
      text: formData.title,
      descripcion: formData.description || null,
      type: formData.type,
      categoria: formData.category,
      is_required: formData.required,
      active: formData.active,
      options: formData.options?.length ? JSON.stringify(formData.options) : null,
    };

    if (editingQuestion) {
      try {
        const updated = await questionsAPI.updateQuestion(editingQuestion.id, payload);
        setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? mapBackendQuestion(updated) : q));
      } catch (error) {
        console.error('Error updating question:', error);
      }
    } else {
      try {
        const created = await questionsAPI.createQuestion(payload);
        setQuestions(prev => [...prev, mapBackendQuestion(created)]);
      } catch (error) {
        console.error('Error creating question:', error);
      }
    }
  };

  const categories: { value: QuestionCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'personal', label: 'Personal' },
    { value: 'work', label: 'Trabajo' },
    { value: 'health', label: 'Salud' },
    { value: 'habits', label: 'Hábitos' },
    { value: 'goals', label: 'Objetivos' },
    { value: 'general', label: 'General' },
  ];

  const activeCount = questions.filter(q => q.active).length;
  const totalCount = questions.length;
  const lastReport = reportHistory[0];

  const getReportTypeLabel = (type: string) => {
    if (type === 'weekly_partial_current') return 'Parcial semana actual';
    if (type === 'weekly_previous') return 'Semana anterior';
    if (type === 'monthly_partial_current') return 'Parcial mes actual';
    if (type === 'monthly_previous') return 'Mes anterior';
    return type;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Administrar Preguntas
            </h1>
            <p className="text-muted-foreground">
              {activeCount} activas de {totalCount} preguntas totales
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all hover:scale-105"
          >
            <Plus className="h-5 w-5" />
            Nueva Pregunta
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar preguntas..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as QuestionCategory | 'all')}
              className="px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>

            {/* Toggle inactivas */}
            <button
              onClick={() => setShowInactive(v => !v)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showInactive
                  ? 'bg-muted text-foreground border-border'
                  : 'bg-background text-muted-foreground border-input hover:text-foreground hover:bg-muted'
              }`}
            >
              {showInactive ? 'Ocultar inactivas' : `Mostrar inactivas (${questions.filter(q => !q.active).length})`}
            </button>
          </div>
        </div>

        {/* Report schedule */}
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Informes por correo</h2>
          </div>

          {scheduleLoading ? (
            <p className="text-sm text-muted-foreground">Cargando configuración...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 md:col-span-1">
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={(e) => setSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span className="text-sm text-foreground">Activar automático</span>
                </label>

                <select
                  value={schedule.day_of_week}
                  onChange={(e) => setSchedule(prev => ({ ...prev, day_of_week: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {Object.entries(dayLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                <input
                  type="time"
                  value={`${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [hourStr, minuteStr] = e.target.value.split(':');
                    setSchedule(prev => ({
                      ...prev,
                      hour: Number(hourStr),
                      minute: Number(minuteStr),
                    }));
                  }}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />

                <button
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
                >
                  {scheduleSaving ? 'Guardando...' : 'Guardar horario'}
                </button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  El envío automático solo funciona mientras el backend esté corriendo.
                  {nextRunTime ? ` Próxima ejecución: ${new Date(nextRunTime).toLocaleString('es-CO')}` : ''}
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSendPreviousWeek}
                    disabled={sendingPrevious}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-muted text-foreground disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sendingPrevious ? 'Enviando...' : 'Enviar semana anterior ahora'}
                  </button>

                  <button
                    onClick={handleSendCurrentWeek}
                    disabled={sendingPartial}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-muted text-foreground disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sendingPartial ? 'Enviando...' : 'Enviar acumulado de esta semana'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Envíos manuales mensuales para compartir el progreso acumulado del mes.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSendPreviousMonth}
                    disabled={sendingPreviousMonth}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-muted text-foreground disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sendingPreviousMonth ? 'Enviando...' : 'Enviar mes anterior ahora'}
                  </button>

                  <button
                    onClick={handleSendCurrentMonth}
                    disabled={sendingCurrentMonth}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-muted text-foreground disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sendingCurrentMonth ? 'Enviando...' : 'Enviar acumulado de este mes'}
                  </button>
                </div>
              </div>

              {scheduleError && <p className="text-sm text-destructive">{scheduleError}</p>}
              {scheduleSuccess && <p className="text-sm text-success">{scheduleSuccess}</p>}

              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">Último envío</p>
                {lastReport ? (
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastReport.timestamp).toLocaleString('es-CO')} · {getReportTypeLabel(lastReport.type)} · {lastReport.source === 'automatic' ? 'Automático' : 'Manual'} · {lastReport.status === 'sent' ? 'Enviado' : 'Fallido'}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Aún no hay envíos registrados</p>
                )}

                {reportHistory.length > 0 && (
                  <div className="space-y-1">
                    {reportHistory.slice(0, 3).map((item, idx) => (
                      <p key={`${item.timestamp}-${idx}`} className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString('es-CO')} · {getReportTypeLabel(item.type)} · {item.status === 'sent' ? 'OK' : 'Error'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Questions list */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-card rounded-xl p-12 border border-border text-center">
              <p className="text-muted-foreground">Cargando preguntas...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="bg-card rounded-xl p-12 border border-border text-center">
              <p className="text-muted-foreground">No se encontraron preguntas</p>
            </div>
          ) : (
            filteredQuestions.map((question) => (
              <QuestionItem
                key={question.id}
                question={question}
                onToggleActive={handleToggleActive}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        {/* Question Modal */}
        <QuestionModal
          open={showModal}
          onOpenChange={setShowModal}
          question={editingQuestion}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

function QuestionItem({
  question,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  question: Question;
  onToggleActive: (id: string) => void;
  onEdit: (question: Question) => void;
  onDelete: (id: string) => void;
}) {
  const typeLabels = {
    text: 'Texto',
    select: 'Selección',
    checkbox: 'Múltiple',
    radio: 'Opción única',
  };

  const categoryColors = {
    personal: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    work: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    health: 'bg-green-500/10 text-green-600 border-green-500/20',
    habits: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    goals: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    general: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  };

  return (
    <div className={`bg-card rounded-xl p-5 border transition-all ${
      question.active ? 'border-border' : 'border-border opacity-60'
    }`}>
      <div className="flex items-start gap-4">
        {/* Order number */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-bold text-muted-foreground">
          {question.order}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground mb-1">
                {question.title}
                {question.required && <span className="text-destructive ml-1">*</span>}
              </h3>
              {question.description && (
                <p className="text-sm text-muted-foreground">{question.description}</p>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${categoryColors[question.category]}`}>
              {question.category}
            </span>
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
              {typeLabels[question.type]}
            </span>
            {question.options && question.options.length > 0 && (
              <span className="px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                {question.options.length} opciones
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleActive(question.id)}
            className={`p-2 rounded-lg transition-colors ${
              question.active
                ? 'text-success hover:bg-success/10'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            title={question.active ? 'Desactivar' : 'Activar'}
          >
            {question.active ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => onEdit(question)}
            className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
            title="Editar"
          >
            <Edit2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => onDelete(question.id)}
            className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
