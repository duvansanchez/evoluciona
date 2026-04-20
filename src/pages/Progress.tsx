import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  BellOff,
  CalendarDays,
  Clock3,
  Download,
  FileText,
  Mail,
  Moon,
  Save,
  Send,
  Sun,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  CircleCheck,
  CircleSlash2,
  CircleDashed,
  Upload,
  Trash2,
  Volume2,
  Square,
} from 'lucide-react';
import { phrasesAPI, remindersAPI, reportsAPI, rutinasAPI } from '@/services/api';
import type { PhraseReportData, ReminderConfig, RutinaReportData, WeeklyConclusion } from '@/services/api';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { renderMarkdownPreview } from '@/utils/markdownPreview';

const DEFAULT_CONFIG: ReminderConfig = {
  manana: { enabled: false, hour: 8, minute: 0 },
  noche: { enabled: false, hour: 20, minute: 0 },
};

type ReportHistoryItem = {
  timestamp: string;
  type: string;
  status: string;
  week_label: string;
  source: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toTimeString(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`;
}

function fromTimeString(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h, minute: m };
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftReferenceDate(referenceDate: string, mode: 'weekly' | 'monthly', delta: number) {
  const date = new Date(`${referenceDate}T12:00:00`);
  if (mode === 'monthly') {
    date.setMonth(date.getMonth() + delta);
  } else {
    date.setDate(date.getDate() + (delta * 7));
  }
  return date.toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildPhraseFilename(mode: 'weekly' | 'monthly', referenceDate: string) {
  if (mode === 'weekly') {
    const { from, to } = getWeekRangeIso(referenceDate);
    return `informe-frases-semanal-desde-${from}-hasta-${to}.html`;
  }
  return `informe-frases-mensual-${referenceDate}.html`;
}

function buildQuestionsFilename(scope: 'current-week' | 'previous-week' | 'current-month' | 'previous-month') {
  return `informe-preguntas-${scope}.html`;
}

function getWeekMonday(referenceDate: string): Date {
  const date = new Date(`${referenceDate}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRangeIso(referenceDate: string): { from: string; to: string } {
  const monday = getWeekMonday(referenceDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: toIsoDateLocal(monday),
    to: toIsoDateLocal(sunday),
  };
}

function formatQuestionsWeekLabel(referenceDate: string): string {
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const monday = getWeekMonday(referenceDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fromDay = monday.getDate();
  const fromMonth = MONTHS[monday.getMonth()];
  const toDay = sunday.getDate();
  const toMonth = MONTHS[sunday.getMonth()];
  const year = sunday.getFullYear();
  if (monday.getMonth() === sunday.getMonth()) {
    return `Semana del ${fromDay} al ${toDay} de ${toMonth} ${year}`;
  }
  return `Semana del ${fromDay} ${fromMonth} al ${toDay} ${toMonth} ${year}`;
}

function isCurrentWeek(referenceDate: string): boolean {
  const todayMonday = getWeekMonday(getTodayIso()).toISOString().slice(0, 10);
  const refMonday = getWeekMonday(referenceDate).toISOString().slice(0, 10);
  return todayMonday === refMonday;
}

function formatQuestionsMonthLabel(referenceDate: string): string {
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const date = new Date(`${referenceDate}T12:00:00`);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function isCurrentMonth(referenceDate: string): boolean {
  const today = new Date();
  const ref = new Date(`${referenceDate}T12:00:00`);
  return today.getFullYear() === ref.getFullYear() && today.getMonth() === ref.getMonth();
}

function getMonthRef(referenceDate: string): string {
  const date = new Date(`${referenceDate}T12:00:00`);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function buildRutinasFilename(mode: 'weekly' | 'monthly', referenceDate: string) {
  if (mode === 'weekly') {
    const { from, to } = getWeekRangeIso(referenceDate);
    return `informe-rutinas-semanal-desde-${from}-hasta-${to}.html`;
  }
  return `informe-rutinas-mensual-${referenceDate}.html`;
}

function getReportTypeLabel(type: string) {
  if (type === 'weekly_partial_current') return 'Parcial semana actual';
  if (type === 'weekly_previous') return 'Semana anterior';
  if (type === 'monthly_partial_current') return 'Parcial mes actual';
  if (type === 'monthly_previous') return 'Mes anterior';
  if (type === 'phrases_weekly') return 'Frases semanal';
  if (type === 'phrases_monthly') return 'Frases mensual';
  if (type === 'rutinas_weekly') return 'Rutinas semanal';
  if (type === 'rutinas_monthly') return 'Rutinas mensual';
  return type;
}

interface ReminderCardProps {
  parte: 'manana' | 'noche';
  config: ReminderConfig['manana'];
  onChange: (cfg: ReminderConfig['manana']) => void;
  onTest: () => void;
  testing: boolean;
}

function ReminderCard({ parte, config, onChange, onTest, testing }: ReminderCardProps) {
  const isMorning = parte === 'manana';
  const Icon = isMorning ? Sun : Moon;
  const iconColor = isMorning ? 'text-amber-500' : 'text-indigo-500';
  const label = isMorning ? 'Recordatorio de manana' : 'Recordatorio de noche';

  return (
    <div className={`rounded-xl border p-5 transition-all ${config.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <button
          onClick={() => onChange({ ...config, enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Hora de envio</label>
          <input
            type="time"
            disabled={!config.enabled}
            value={toTimeString(config.hour, config.minute)}
            onChange={e => {
              const { hour, minute } = fromTimeString(e.target.value);
              onChange({ ...config, hour, minute });
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
        <div className="pt-5">
          <button
            onClick={onTest}
            disabled={testing}
            title="Enviar correo de prueba ahora"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {testing ? 'Enviando...' : 'Probar'}
          </button>
        </div>
      </div>

      {config.enabled && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Se enviara a <strong>{toTimeString(config.hour, config.minute)}</strong> todos los dias con tus pendientes del dia.
        </p>
      )}
    </div>
  );
}

function ReportActionButton({
  onClick,
  loading,
  icon,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  loading?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'primary';
}) {
  const className = variant === 'primary'
    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
    : 'border border-input bg-background text-foreground hover:bg-muted';

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${className}`}
    >
      {icon}
      {loading ? 'Procesando...' : children}
    </button>
  );
}

export default function Progress() {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<'manana' | 'noche' | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [questionsReportMessage, setQuestionsReportMessage] = useState<string | null>(null);
  const [questionsReportError, setQuestionsReportError] = useState<string | null>(null);
  const [phrasesReportMessage, setPhrasesReportMessage] = useState<string | null>(null);
  const [phrasesReportError, setPhrasesReportError] = useState<string | null>(null);
  const [rutinasReportMessage, setRutinasReportMessage] = useState<string | null>(null);
  const [rutinasReportError, setRutinasReportError] = useState<string | null>(null);
  const [questionsActionLoading, setQuestionsActionLoading] = useState<string | null>(null);
  const [questionsWeekRef, setQuestionsWeekRef] = useState(getTodayIso());
  const [questionsMonthRef, setQuestionsMonthRef] = useState(getTodayIso());
  const [phrasesActionLoading, setPhrasesActionLoading] = useState<string | null>(null);
  const [rutinasActionLoading, setRutinasActionLoading] = useState<string | null>(null);

  const [phraseReportMode, setPhraseReportMode] = useState<'weekly' | 'monthly'>('weekly');
  const [phraseReferenceDate, setPhraseReferenceDate] = useState(getTodayIso());
  const [phraseReport, setPhraseReport] = useState<PhraseReportData | null>(null);
  const [phraseReportLoading, setPhraseReportLoading] = useState(false);
  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [phrasesExpanded, setPhrasesExpanded] = useState(false);
  const [rutinaReportMode, setRutinaReportMode] = useState<'weekly' | 'monthly'>('weekly');
  const [rutinaReferenceDate, setRutinaReferenceDate] = useState(getTodayIso());
  const [rutinaReport, setRutinaReport] = useState<RutinaReportData | null>(null);
  const [rutinaReportLoading, setRutinaReportLoading] = useState(false);
  const [rutinasExpanded, setRutinasExpanded] = useState(false);
  const [conclusionsExpanded, setConclusionsExpanded] = useState(false);
  const [conclusionReferenceDate, setConclusionReferenceDate] = useState(getTodayIso());
  const [weeklyConclusion, setWeeklyConclusion] = useState<WeeklyConclusion | null>(null);
  const [weeklyConclusionText, setWeeklyConclusionText] = useState('');
  const [weeklyConclusionsHistory, setWeeklyConclusionsHistory] = useState<WeeklyConclusion[]>([]);
  const [weeklyConclusionLoading, setWeeklyConclusionLoading] = useState(false);
  const [weeklyConclusionSaving, setWeeklyConclusionSaving] = useState(false);
  const [weeklyConclusionMessage, setWeeklyConclusionMessage] = useState<string | null>(null);
  const [weeklyConclusionError, setWeeklyConclusionError] = useState<string | null>(null);
  const [selectedConclusionModal, setSelectedConclusionModal] = useState<WeeklyConclusion | null>(null);
  const [conclusionSpeaking, setConclusionSpeaking] = useState(false);
  const [conclusionAudioLoading, setConclusionAudioLoading] = useState(false);
  const [conclusionAudioProvider, setConclusionAudioProvider] = useState<'browser' | 'elevenlabs' | 'edge'>('browser');
  const [conclusionVoices, setConclusionVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [conclusionVoiceName, setConclusionVoiceName] = useState('');
  const [conclusionAudioRate, setConclusionAudioRate] = useState(1);
  const [conclusionAudioPitch, setConclusionAudioPitch] = useState(1);
  const conclusionUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const conclusionAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const conclusionAudioUrlRef = useRef<string | null>(null);
  const conclusionAudioRequestIdRef = useRef(0);
  const conclusionFileInputRef = useRef<HTMLInputElement | null>(null);

  const lastReport = reportHistory[0] ?? null;

  const phraseSummary = useMemo(() => {
    if (!phraseReport) return null;
    return [
      { label: 'Repasos', value: phraseReport.total_reviews },
      { label: 'Dias con repaso', value: phraseReport.days_with_review },
      { label: 'Cobertura', value: `${phraseReport.coverage.percent}%` },
    ];
  }, [phraseReport]);

  const rutinaSummary = useMemo(() => {
    if (!rutinaReport) return null;
    return [
      { label: 'Asignaciones', value: rutinaReport.total_assignments },
      { label: 'Completadas', value: rutinaReport.completed_assignments },
      { label: 'Cumplimiento', value: `${rutinaReport.completion_rate}%` },
    ];
  }, [rutinaReport]);

  const rutinaGoalSummary = useMemo(() => {
    if (!rutinaReport) return null;
    const goalCompletionSummary = rutinaReport.goal_completion_summary ?? {
      total_completions: 0,
      days_with_completions: 0,
      distinct_goals: 0,
    };
    return [
      { label: 'Completados', value: goalCompletionSummary.total_completions },
      { label: 'Dias con avance', value: goalCompletionSummary.days_with_completions },
      { label: 'Objetivos tocados', value: goalCompletionSummary.distinct_goals },
    ];
  }, [rutinaReport]);

  const rutinaBreakdown = rutinaReport?.routine_breakdown ?? [];

  const loadWeeklyConclusion = async (referenceDate = conclusionReferenceDate) => {
    setWeeklyConclusionLoading(true);
    setWeeklyConclusionError(null);
    try {
      const data = await reportsAPI.getWeeklyConclusion(referenceDate);
      setWeeklyConclusion(data);
      setWeeklyConclusionText(data.content || '');
    } catch (error: any) {
      console.error('Error loading weekly conclusion:', error);
      setWeeklyConclusion(null);
      setWeeklyConclusionText('');
      setWeeklyConclusionError(error?.message || 'No se pudo cargar la conclusion semanal.');
    } finally {
      setWeeklyConclusionLoading(false);
    }
  };

  const loadWeeklyConclusionsHistory = async () => {
    try {
      const items = await reportsAPI.getWeeklyConclusionsHistory(8);
      setWeeklyConclusionsHistory(items);
    } catch (error) {
      console.error('Error loading weekly conclusions history:', error);
    }
  };

  const loadReportHistory = async () => {
    try {
      const history = await reportsAPI.getHistory(8);
      setReportHistory(Array.isArray(history.items) ? history.items : []);
    } catch (error) {
      console.error('Error loading reports history:', error);
    }
  };

  const loadPhraseReport = async (mode = phraseReportMode, referenceDate = phraseReferenceDate) => {
    setPhraseReportLoading(true);
    try {
      const data = await phrasesAPI.getReport(mode, referenceDate);
      setPhraseReport(data);
    } catch (error) {
      console.error('Error loading phrase report:', error);
      setPhraseReport(null);
    } finally {
      setPhraseReportLoading(false);
    }
  };

  const loadRutinaReport = async (mode = rutinaReportMode, referenceDate = rutinaReferenceDate) => {
    setRutinaReportLoading(true);
    try {
      const data = await rutinasAPI.getReport(mode, referenceDate);
      setRutinaReport(data);
    } catch (error) {
      console.error('Error loading rutina report:', error);
      setRutinaReport(null);
    } finally {
      setRutinaReportLoading(false);
    }
  };

  useEffect(() => {
    remindersAPI.getConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false));

    loadReportHistory().finally(() => setReportsLoading(false));
  }, []);

  useEffect(() => {
    if (phrasesExpanded) {
      void loadPhraseReport();
    }
  }, [phraseReportMode, phraseReferenceDate, phrasesExpanded]);

  useEffect(() => {
    if (rutinasExpanded) {
      void loadRutinaReport();
    }
  }, [rutinaReportMode, rutinaReferenceDate, rutinasExpanded]);

  useEffect(() => {
    stopConclusionSpeech();
    if (conclusionsExpanded) {
      void loadWeeklyConclusion();
      void loadWeeklyConclusionsHistory();
    }
  }, [conclusionReferenceDate, conclusionsExpanded]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => setConclusionVoices(window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    let cancelled = false;
    Promise.all([phrasesAPI.getAudioPreferences(), phrasesAPI.getAudioStatus()])
      .then(([prefs, status]) => {
        if (cancelled) return;
        setConclusionVoiceName(prefs.selected_voice_name ?? '');
        setConclusionAudioRate(prefs.rate ?? 1);
        setConclusionAudioPitch(prefs.pitch ?? 1);
        setConclusionAudioProvider(status.provider ?? 'browser');
      })
      .catch(() => {/* usa defaults del browser */});
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await remindersAPI.updateConfig(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // no-op
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (parte: 'manana' | 'noche') => {
    setTesting(parte);
    setTestMsg(null);
    try {
      await remindersAPI.testReminder(parte);
      setTestMsg({ ok: true, text: 'Correo de prueba enviado, revisa tu bandeja.' });
    } catch (e: any) {
      setTestMsg({ ok: false, text: e.message || 'No se pudo enviar el correo de prueba.' });
    } finally {
      setTesting(null);
      setTimeout(() => setTestMsg(null), 5000);
    }
  };

  const runQuestionsAction = async (key: string, action: () => Promise<any>, successText: string) => {
    setQuestionsActionLoading(key);
    setQuestionsReportError(null);
    setQuestionsReportMessage(null);
    try {
      await action();
      setQuestionsReportMessage(successText);
      await loadReportHistory();
    } catch (error: any) {
      console.error('Error running questions report action:', error);
      setQuestionsReportError(error?.message || 'No se pudo completar la accion del informe.');
    } finally {
      setQuestionsActionLoading(null);
    }
  };

  const runPhrasesAction = async (key: string, action: () => Promise<any>, successText: string) => {
    setPhrasesActionLoading(key);
    setPhrasesReportError(null);
    setPhrasesReportMessage(null);
    try {
      await action();
      setPhrasesReportMessage(successText);
      await loadReportHistory();
    } catch (error: any) {
      console.error('Error running phrases report action:', error);
      setPhrasesReportError(error?.message || 'No se pudo completar la accion del informe.');
    } finally {
      setPhrasesActionLoading(null);
    }
  };

  const handleDownloadQuestions = async (
    key: string,
    action: () => Promise<Blob>,
    filename: string,
    successText: string,
  ) => {
    await runQuestionsAction(key, async () => {
      const blob = await action();
      downloadBlob(blob, filename);
    }, successText);
  };

  const handleDownloadPhrases = async () => {
    await runPhrasesAction(
      'phrases-download',
      async () => {
        const blob = await phrasesAPI.downloadReport(phraseReportMode, phraseReferenceDate);
        downloadBlob(blob, buildPhraseFilename(phraseReportMode, phraseReferenceDate));
      },
      'Informe de frases descargado correctamente.',
    );
  };

  const runRutinasAction = async (key: string, action: () => Promise<any>, successText: string) => {
    setRutinasActionLoading(key);
    setRutinasReportError(null);
    setRutinasReportMessage(null);
    try {
      await action();
      setRutinasReportMessage(successText);
      await loadReportHistory();
    } catch (error: any) {
      console.error('Error running rutinas report action:', error);
      setRutinasReportError(error?.message || 'No se pudo completar la accion del informe de rutinas.');
    } finally {
      setRutinasActionLoading(null);
    }
  };

  const handleDownloadRutinas = async () => {
    await runRutinasAction(
      'rutinas-download',
      async () => {
        const blob = await rutinasAPI.downloadReport(rutinaReportMode, rutinaReferenceDate);
        downloadBlob(blob, buildRutinasFilename(rutinaReportMode, rutinaReferenceDate));
      },
      'Informe de rutinas descargado correctamente.',
    );
  };

  const stopConclusionSpeech = () => {
    conclusionAudioRequestIdRef.current += 1; // invalida cualquier petición en vuelo
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (conclusionAudioElementRef.current) {
      conclusionAudioElementRef.current.pause();
      conclusionAudioElementRef.current = null;
    }
    if (conclusionAudioUrlRef.current) {
      URL.revokeObjectURL(conclusionAudioUrlRef.current);
      conclusionAudioUrlRef.current = null;
    }
    conclusionUtteranceRef.current = null;
    setConclusionSpeaking(false);
    setConclusionAudioLoading(false);
  };

  const stripMarkdownForSpeech = (text: string): string => {
    let r = text;
    // Encabezados → solo el texto
    r = r.replace(/#{1,6}\s+/g, '');
    // Negrita / cursiva → solo el texto
    r = r.replace(/\*\*(.*?)\*\*/gs, '$1');
    r = r.replace(/\*(.*?)\*/gs, '$1');
    // Código inline → eliminar
    r = r.replace(/`{1,3}[^`\n]*`{1,3}/g, '');
    // Links → solo la etiqueta
    r = r.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Viñetas sin número → eliminar guión/asterisco
    r = r.replace(/^[-*+]\s+/gm, '');
    // Listas ordenadas → conservar el número ("1. " → "1, ")
    r = r.replace(/^(\d+)\.\s+/gm, '$1, ');
    // Porcentajes → "por ciento"
    r = r.replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 por ciento');
    // Separador de miles con punto (ej: 1.000) → sin separador
    r = r.replace(/\b(\d{1,3})\.(\d{3})\b/g, '$1$2');
    // Decimal con punto → "coma" (convención es-CO)
    r = r.replace(/\b(\d+)\.(\d+)\b/g, '$1 coma $2');
    // Saltos dobles → pausa
    r = r.replace(/\n{2,}/g, '. ');
    // Salto simple → espacio
    r = r.replace(/\n/g, ' ');
    return r.trim();
  };

  const speakConclusion = async (text: string) => {
    if (!text.trim()) return;

    if (conclusionSpeaking || conclusionAudioLoading) {
      stopConclusionSpeech();
      return;
    }

    stopConclusionSpeech();
    const plainText = stripMarkdownForSpeech(text);
    if (!plainText) return;

    if (conclusionAudioProvider === 'elevenlabs' || conclusionAudioProvider === 'edge') {
      const requestId = conclusionAudioRequestIdRef.current + 1;
      conclusionAudioRequestIdRef.current = requestId;
      setConclusionAudioLoading(true);
      try {
        const audioBlob = await phrasesAPI.generateAudio(plainText, {
          rate: conclusionAudioRate,
          pitch: conclusionAudioPitch,
        });
        if (conclusionAudioRequestIdRef.current !== requestId) return; // petición cancelada
        setConclusionAudioLoading(false);
        const audioUrl = URL.createObjectURL(audioBlob);
        conclusionAudioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        conclusionAudioElementRef.current = audio;
        audio.onplay = () => setConclusionSpeaking(true);
        audio.onended = () => {
          setConclusionSpeaking(false);
          conclusionAudioElementRef.current = null;
          if (conclusionAudioUrlRef.current) {
            URL.revokeObjectURL(conclusionAudioUrlRef.current);
            conclusionAudioUrlRef.current = null;
          }
        };
        audio.onerror = () => {
          setConclusionSpeaking(false);
          conclusionAudioElementRef.current = null;
        };
        await audio.play();
      } catch (e) {
        if (conclusionAudioRequestIdRef.current === requestId) {
          console.error('Error playing conclusion audio:', e);
          setConclusionSpeaking(false);
          setConclusionAudioLoading(false);
        }
      }
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const preferredVoice =
      conclusionVoices.find(v => v.name === conclusionVoiceName) ||
      conclusionVoices.filter(v => v.lang.toLowerCase().startsWith('es'))[0] ||
      null;

    const utterance = new SpeechSynthesisUtterance(plainText);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = 'es-CO';
    }
    utterance.rate = conclusionAudioRate;
    utterance.pitch = conclusionAudioPitch;

    utterance.onstart = () => setConclusionSpeaking(true);
    utterance.onend = () => {
      setConclusionSpeaking(false);
      conclusionUtteranceRef.current = null;
    };
    utterance.onerror = () => {
      setConclusionSpeaking(false);
      conclusionUtteranceRef.current = null;
    };

    conclusionUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleSaveWeeklyConclusion = async () => {
    const content = weeklyConclusionText.trim();
    if (!content) {
      setWeeklyConclusionError('Escribe una conclusion antes de guardar.');
      setWeeklyConclusionMessage(null);
      return;
    }

    setWeeklyConclusionSaving(true);
    setWeeklyConclusionError(null);
    setWeeklyConclusionMessage(null);
    try {
      const savedConclusion = await reportsAPI.saveWeeklyConclusion(conclusionReferenceDate, content);
      setWeeklyConclusion(savedConclusion);
      setWeeklyConclusionText(savedConclusion.content);
      setWeeklyConclusionMessage('Conclusion semanal guardada correctamente.');
      await loadWeeklyConclusionsHistory();
    } catch (error: any) {
      console.error('Error saving weekly conclusion:', error);
      setWeeklyConclusionError(error?.message || 'No se pudo guardar la conclusion semanal.');
    } finally {
      setWeeklyConclusionSaving(false);
    }
  };

  const handleDeleteWeeklyConclusion = async (weekStart: string, closeModal = false) => {
    const confirmed = window.confirm('¿Seguro que quieres eliminar esta conclusión semanal?');
    if (!confirmed) return;

    setWeeklyConclusionSaving(true);
    setWeeklyConclusionError(null);
    setWeeklyConclusionMessage(null);
    try {
      await reportsAPI.deleteWeeklyConclusion(weekStart);

      if (weeklyConclusion?.week_start === weekStart) {
        await loadWeeklyConclusion(conclusionReferenceDate);
      }
      await loadWeeklyConclusionsHistory();

      if (selectedConclusionModal?.week_start === weekStart || closeModal) {
        setSelectedConclusionModal(null);
      }

      setWeeklyConclusionMessage('Conclusión semanal eliminada correctamente.');
    } catch (error: any) {
      console.error('Error deleting weekly conclusion:', error);
      setWeeklyConclusionError(error?.message || 'No se pudo eliminar la conclusión semanal.');
    } finally {
      setWeeklyConclusionSaving(false);
    }
  };

  const handleConclusionFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setWeeklyConclusionText(text);
      setWeeklyConclusionMessage(`Archivo cargado: ${file.name}. Recuerda guardar la conclusión.`);
      setWeeklyConclusionError(null);
    } catch (error) {
      console.error('Error loading markdown file:', error);
      setWeeklyConclusionError('No se pudo leer el archivo Markdown.');
      setWeeklyConclusionMessage(null);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Progreso</h1>
        <p className="mt-1 text-sm text-muted-foreground">Centro de informes, exportaciones y recordatorios.</p>
      </div>

      <section className="mb-8 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Centro de informes</h2>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">Preguntas diarias</h3>
                  <p className="text-xs text-muted-foreground">Envia o descarga los informes semanales y mensuales desde un solo lugar.</p>
                </div>
              </div>
              <button
                onClick={() => setQuestionsExpanded(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {questionsExpanded ? 'Ocultar' : 'Ver informe'}
                {questionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {!questionsExpanded ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Abre este bloque cuando quieras enviar o descargar informes de preguntas.
              </p>
            ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-1 rounded-lg border border-input bg-background px-2 py-1">
                  <button
                    onClick={() => setQuestionsWeekRef(prev => shiftReferenceDate(prev, 'weekly', -1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="flex-1 px-2 text-center text-sm font-medium text-foreground">
                    {formatQuestionsWeekLabel(questionsWeekRef)}
                  </span>
                  <button
                    onClick={() => setQuestionsWeekRef(prev => shiftReferenceDate(prev, 'weekly', 1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    onClick={() => {
                      const weekMonday = getWeekMonday(questionsWeekRef).toISOString().slice(0, 10);
                      if (isCurrentWeek(questionsWeekRef)) {
                        void runQuestionsAction('questions-send-week', () => reportsAPI.sendCurrentWeekReport(), 'Informe de esta semana enviado.');
                      } else {
                        void runQuestionsAction('questions-send-week', () => reportsAPI.sendPreviousWeekReport(weekMonday), 'Informe de la semana enviado.');
                      }
                    }}
                    disabled={questionsActionLoading === 'questions-send-week'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${isCurrentWeek(questionsWeekRef) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-input bg-background text-foreground hover:bg-muted'}`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {questionsActionLoading === 'questions-send-week' ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button
                    onClick={() => {
                      const weekMonday = getWeekMonday(questionsWeekRef).toISOString().slice(0, 10);
                      if (isCurrentWeek(questionsWeekRef)) {
                        void handleDownloadQuestions('questions-download-week', () => reportsAPI.downloadCurrentWeekReport(), `informe-preguntas-${weekMonday}.html`, 'Informe descargado.');
                      } else {
                        void handleDownloadQuestions('questions-download-week', () => reportsAPI.downloadPreviousWeekReport(weekMonday), `informe-preguntas-${weekMonday}.html`, 'Informe descargado.');
                      }
                    }}
                    disabled={questionsActionLoading === 'questions-download-week'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {questionsActionLoading === 'questions-download-week' ? 'Descargando...' : 'Descargar'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-1 rounded-lg border border-input bg-background px-2 py-1">
                  <button
                    onClick={() => setQuestionsMonthRef(prev => shiftReferenceDate(prev, 'monthly', -1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="flex-1 px-2 text-center text-sm font-medium text-foreground">
                    {formatQuestionsMonthLabel(questionsMonthRef)}
                  </span>
                  <button
                    onClick={() => setQuestionsMonthRef(prev => shiftReferenceDate(prev, 'monthly', 1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    onClick={() => {
                      const monthOf = getMonthRef(questionsMonthRef);
                      if (isCurrentMonth(questionsMonthRef)) {
                        void runQuestionsAction('questions-send-month', () => reportsAPI.sendCurrentMonthReport(), 'Informe de este mes enviado.');
                      } else {
                        void runQuestionsAction('questions-send-month', () => reportsAPI.sendPreviousMonthReport(monthOf), 'Informe del mes enviado.');
                      }
                    }}
                    disabled={questionsActionLoading === 'questions-send-month'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${isCurrentMonth(questionsMonthRef) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-input bg-background text-foreground hover:bg-muted'}`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {questionsActionLoading === 'questions-send-month' ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button
                    onClick={() => {
                      const monthOf = getMonthRef(questionsMonthRef);
                      if (isCurrentMonth(questionsMonthRef)) {
                        void handleDownloadQuestions('questions-download-month', () => reportsAPI.downloadCurrentMonthReport(), `informe-preguntas-${monthOf}.html`, 'Informe descargado.');
                      } else {
                        void handleDownloadQuestions('questions-download-month', () => reportsAPI.downloadPreviousMonthReport(monthOf), `informe-preguntas-${monthOf}.html`, 'Informe descargado.');
                      }
                    }}
                    disabled={questionsActionLoading === 'questions-download-month'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {questionsActionLoading === 'questions-download-month' ? 'Descargando...' : 'Descargar'}
                  </button>
                </div>
              </div>

              {questionsReportError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{questionsReportError}</p>
              )}
              {questionsReportMessage && (
                <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-600">{questionsReportMessage}</p>
              )}

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">Ultimos envios</p>
                {reportsLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">Cargando historial...</p>
                ) : lastReport ? (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(lastReport.timestamp).toLocaleString('es-CO')} · {getReportTypeLabel(lastReport.type)} · {lastReport.source === 'automatic' ? 'Automatico' : 'Manual'} · {lastReport.status === 'sent' ? 'Enviado' : 'Fallido'}
                    </p>
                    <div className="mt-2 space-y-1">
                      {reportHistory.slice(0, 4).map((item, idx) => (
                        <p key={`${item.timestamp}-${idx}`} className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString('es-CO')} · {getReportTypeLabel(item.type)} · {item.status === 'sent' ? 'OK' : 'Error'}
                        </p>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Aun no hay envios registrados.</p>
                )}
              </div>
            </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">Frases</h3>
                  <p className="text-xs text-muted-foreground">Gestiona el envio y la descarga del informe de frases desde aqui.</p>
                </div>
              </div>
              <button
                onClick={() => setPhrasesExpanded(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {phrasesExpanded ? 'Ocultar' : 'Ver informe'}
                {phrasesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {!phrasesExpanded ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Abre este bloque cuando quieras revisar, enviar o descargar el informe de frases.
              </p>
            ) : (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPhraseReportMode('weekly')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${phraseReportMode === 'weekly' ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-foreground hover:bg-muted'}`}
                >
                  Semanal
                </button>
                <button
                  onClick={() => setPhraseReportMode('monthly')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${phraseReportMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-foreground hover:bg-muted'}`}
                >
                  Mensual
                </button>

                <div className="ml-auto flex items-center gap-1 rounded-lg border border-input bg-background px-2 py-1">
                  <button
                    onClick={() => setPhraseReferenceDate(prev => shiftReferenceDate(prev, phraseReportMode, -1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[190px] px-2 text-center text-sm font-medium text-foreground">
                    {phraseReport?.period_label || 'Cargando periodo...'}
                  </span>
                  <button
                    onClick={() => setPhraseReferenceDate(prev => shiftReferenceDate(prev, phraseReportMode, 1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {phraseSummary && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {phraseSummary.map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-2xl font-heading font-bold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {phraseReportLoading && (
                <p className="text-sm text-muted-foreground">Cargando informe de frases...</p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <ReportActionButton
                  onClick={() => runPhrasesAction('phrases-send', () => phrasesAPI.sendReportEmail(phraseReportMode, phraseReferenceDate), `Informe de frases enviado: ${phraseReport?.period_label || phraseReferenceDate}`)}
                  loading={phrasesActionLoading === 'phrases-send'}
                  icon={<Mail className="h-4 w-4" />}
                  variant="primary"
                >
                  Enviar a Gmail
                </ReportActionButton>
                <ReportActionButton
                  onClick={handleDownloadPhrases}
                  loading={phrasesActionLoading === 'phrases-download'}
                  icon={<Download className="h-4 w-4" />}
                >
                  Descargar MD
                </ReportActionButton>
              </div>

              {phrasesReportError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{phrasesReportError}</p>
              )}
              {phrasesReportMessage && (
                <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-600">{phrasesReportMessage}</p>
              )}
            </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">Rutinas</h3>
                  <p className="text-xs text-muted-foreground">Centraliza el envio y la descarga del informe semanal o mensual de rutinas.</p>
                </div>
              </div>
              <button
                onClick={() => setRutinasExpanded(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {rutinasExpanded ? 'Ocultar' : 'Ver informe'}
                {rutinasExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {!rutinasExpanded ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Abre este bloque cuando quieras consultar o exportar el informe de rutinas.
              </p>
            ) : (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setRutinaReportMode('weekly')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${rutinaReportMode === 'weekly' ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-foreground hover:bg-muted'}`}
                >
                  Semanal
                </button>
                <button
                  onClick={() => setRutinaReportMode('monthly')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${rutinaReportMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-foreground hover:bg-muted'}`}
                >
                  Mensual
                </button>

                <div className="ml-auto flex items-center gap-1 rounded-lg border border-input bg-background px-2 py-1">
                  <button
                    onClick={() => setRutinaReferenceDate(prev => shiftReferenceDate(prev, rutinaReportMode, -1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[190px] px-2 text-center text-sm font-medium text-foreground">
                    {rutinaReport?.period_label || 'Cargando periodo...'}
                  </span>
                  <button
                    onClick={() => setRutinaReferenceDate(prev => shiftReferenceDate(prev, rutinaReportMode, 1))}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {rutinaSummary && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {rutinaSummary.map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-2xl font-heading font-bold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {!rutinaReportLoading && rutinaReport && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Dias con rutinas</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{rutinaReport.days_with_routines}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Dias cumplidos</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{rutinaReport.completed_days}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Cobertura</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{rutinaReport.coverage.percent}%</p>
                  </div>
                </div>
              )}

              {rutinaReportLoading && (
                <p className="text-sm text-muted-foreground">Cargando informe de rutinas...</p>
              )}

              {!rutinaReportLoading && rutinaReport && (
                <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Log de objetivos recurrentes completados</p>
                    <p className="text-xs text-muted-foreground">
                      Aqui queda trazabilidad diaria de los objetivos recurrentes vinculados a rutinas, aunque se reinicien visualmente al siguiente dia.
                    </p>
                  </div>

                  {rutinaGoalSummary && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {rutinaGoalSummary.map((item) => (
                        <div key={item.label} className="rounded-lg border border-border bg-background px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {(rutinaReport.goal_completion_log ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      En este periodo no hay completados diarios registrados para objetivos recurrentes de rutinas.
                    </p>
                  ) : (
                    <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                      {(rutinaReport.goal_completion_log ?? []).map((day) => (
                        <div key={day.date} className="rounded-lg border border-border bg-background px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">{day.date}</p>
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                              {day.count} completado{day.count === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {day.goals.map((goal) => (
                              <div key={`${day.date}-${goal.id}`} className="rounded-md border border-border/80 bg-background/80 px-3 py-2">
                                <p className="text-sm font-medium text-foreground">
                                  {[goal.icon, goal.title].filter(Boolean).join(' ')}
                                </p>
                                {goal.routine_names.length > 0 && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Rutina: {goal.routine_names.join(', ')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!rutinaReportLoading && rutinaReport && (
                <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Desempeño por rutina</p>
                    <p className="text-xs text-muted-foreground">
                      Revisa por rutina qué días quedó completa y qué objetivos fueron los que faltaron cuando no se logró cerrar bien.
                    </p>
                  </div>

                  {rutinaBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay rutinas asignadas en este periodo para analizar.
                    </p>
                  ) : (
                    <Accordion type="multiple" className="space-y-3">
                      {rutinaBreakdown.map((routine) => (
                        <AccordionItem
                          key={routine.id}
                          value={`routine-${routine.id}`}
                          className="rounded-lg border border-border bg-background px-4"
                        >
                          <AccordionTrigger className="py-4 hover:no-underline">
                            <div className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{routine.name}</p>
                                <p className="text-xs text-muted-foreground">{routine.day_part_label} · {routine.linked_goals} tarea{routine.linked_goals === 1 ? '' : 's'} vinculada{routine.linked_goals === 1 ? '' : 's'}</p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                                  Avance promedio {routine.average_progress_percent}%
                                </span>
                                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-600">
                                  {routine.failed_days} dia{routine.failed_days === 1 ? '' : 's'} incompleto{routine.failed_days === 1 ? '' : 's'}
                                </span>
                                <span className="rounded-full bg-slate-500/10 px-2.5 py-1 font-semibold text-slate-600">
                                  {routine.neutral_days} dia{routine.neutral_days === 1 ? '' : 's'} neutral{routine.neutral_days === 1 ? '' : 'es'}
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="space-y-3">
                              {routine.days.map((day) => (
                                <div key={`${routine.id}-${day.date}`} className="rounded-lg border border-border/80 bg-background/80 px-4 py-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{day.date}</p>
                                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                        <span className="rounded-full bg-green-500/10 px-2 py-1 font-medium text-green-600">
                                          {day.completed_count} completo{day.completed_count === 1 ? '' : 's'}
                                        </span>
                                        <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-600">
                                          {day.skipped_count} saltado{day.skipped_count === 1 ? '' : 's'}
                                        </span>
                                        <span className="rounded-full bg-destructive/10 px-2 py-1 font-medium text-destructive">
                                          {day.pending_count} pendiente{day.pending_count === 1 ? '' : 's'}
                                        </span>
                                      </div>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${day.is_neutral ? 'bg-slate-500/10 text-slate-600' : (day.progress_percent ?? 0) >= 100 ? 'bg-green-500/10 text-green-600' : (day.progress_percent ?? 0) >= 75 ? 'bg-blue-500/10 text-blue-600' : (day.progress_percent ?? 0) >= 25 ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive'}`}>
                                      {day.is_neutral ? 'No computa' : `${day.progress_percent ?? 0}%`} {day.progress_label}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid gap-2">
                                    {day.goals.map((goal) => {
                                      const statusStyles = goal.status === 'completed'
                                        ? {
                                            icon: <CircleCheck className="h-4 w-4 text-green-600" />,
                                            badge: 'bg-green-500/10 text-green-600',
                                            label: 'Completo',
                                          }
                                        : goal.status === 'skipped'
                                          ? {
                                              icon: <CircleSlash2 className="h-4 w-4 text-amber-600" />,
                                              badge: 'bg-amber-500/10 text-amber-600',
                                              label: 'Saltado',
                                            }
                                          : {
                                              icon: <CircleDashed className="h-4 w-4 text-destructive" />,
                                              badge: 'bg-destructive/10 text-destructive',
                                              label: 'Pendiente',
                                            };

                                      return (
                                        <div key={`${day.date}-${goal.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            {statusStyles.icon}
                                            <p className="text-sm text-foreground">{[goal.icon, goal.title].filter(Boolean).join(' ')}</p>
                                          </div>
                                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusStyles.badge}`}>
                                            {statusStyles.label}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <ReportActionButton
                  onClick={() => runRutinasAction('rutinas-send', () => rutinasAPI.sendReportEmail(rutinaReportMode, rutinaReferenceDate), `Informe de rutinas enviado: ${rutinaReport?.period_label || rutinaReferenceDate}`)}
                  loading={rutinasActionLoading === 'rutinas-send'}
                  icon={<Mail className="h-4 w-4" />}
                  variant="primary"
                >
                  Enviar a Gmail
                </ReportActionButton>
                <ReportActionButton
                  onClick={handleDownloadRutinas}
                  loading={rutinasActionLoading === 'rutinas-download'}
                  icon={<Download className="h-4 w-4" />}
                >
                  Descargar HTML
                </ReportActionButton>
              </div>

              {rutinasReportError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{rutinasReportError}</p>
              )}
              {rutinasReportMessage && (
                <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-600">{rutinasReportMessage}</p>
              )}
            </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">Conclusiones semana a semana</h3>
                  <p className="text-xs text-muted-foreground">Guarda las conclusiones de mejora que te devuelve la IA cada semana.</p>
                </div>
              </div>
              <button
                onClick={() => setConclusionsExpanded(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {conclusionsExpanded ? 'Ocultar' : 'Abrir'}
                {conclusionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {!conclusionsExpanded ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Abre este bloque para registrar y consultar tus conclusiones semanales de mejora.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-input bg-background px-2 py-1">
                    <button
                      onClick={() => setConclusionReferenceDate(prev => shiftReferenceDate(prev, 'weekly', -1))}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[220px] px-2 text-center text-sm font-medium text-foreground">
                      {weeklyConclusion?.period_label || 'Cargando semana...'}
                    </span>
                    <button
                      onClick={() => setConclusionReferenceDate(prev => shiftReferenceDate(prev, 'weekly', 1))}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {weeklyConclusion?.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Ultima edición: {new Date(weeklyConclusion.updated_at).toLocaleString('es-CO')}
                    </p>
                  )}
                </div>

                {weeklyConclusionLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando conclusion semanal...</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Semana: {weeklyConclusion?.week_start || '-'} a {weeklyConclusion?.week_end || '-'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={conclusionFileInputRef}
                          type="file"
                          accept=".md,text/markdown,text/plain"
                          onChange={handleConclusionFilePicked}
                          className="hidden"
                        />
                        {weeklyConclusionText.trim() && (
                          <button
                            onClick={() => conclusionFileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Upload className="h-4 w-4" />
                            Reemplazar .md
                          </button>
                        )}
                        {weeklyConclusionText.trim() && (
                          <>
                            <button
                              onClick={() => void speakConclusion(weeklyConclusionText)}
                              disabled={conclusionAudioLoading}
                              title={conclusionSpeaking ? 'Detener audio' : conclusionAudioLoading ? 'Generando audio...' : 'Escuchar conclusión'}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                conclusionSpeaking
                                  ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                                  : 'border-input bg-background text-foreground hover:bg-muted'
                              }`}
                            >
                              {conclusionSpeaking
                                ? <><Square className="h-4 w-4" />Detener</>
                                : conclusionAudioLoading
                                  ? <><Volume2 className="h-4 w-4 animate-pulse" />Generando...</>
                                  : <><Volume2 className="h-4 w-4" />Escuchar</>
                              }
                            </button>
                            {weeklyConclusion?.id ? (
                              <button
                                onClick={() => handleDeleteWeeklyConclusion(weeklyConclusion.week_start)}
                                disabled={weeklyConclusionSaving}
                                className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </button>
                            ) : null}
                            <button
                              onClick={handleSaveWeeklyConclusion}
                              disabled={weeklyConclusionSaving}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                            >
                              <Save className="h-4 w-4" />
                              {weeklyConclusionSaving ? 'Guardando...' : weeklyConclusion?.id ? 'Guardar cambios' : 'Guardar'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!weeklyConclusionText.trim() && (
                      <div
                        onClick={() => conclusionFileInputRef.current?.click()}
                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Carga un archivo <span className="font-medium text-foreground">.md</span> para esta semana</p>
                      </div>
                    )}
                  </>
                )}

                {weeklyConclusionError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{weeklyConclusionError}</p>
                )}
                {weeklyConclusionMessage && (
                  <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-600">{weeklyConclusionMessage}</p>
                )}

                <div className="rounded-lg border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-foreground">Semanas recientes</p>
                  {weeklyConclusionsHistory.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Todavia no has guardado conclusiones semanales.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {weeklyConclusionsHistory.map((item) => (
                        <button
                          key={item.week_start}
                          onClick={() => setSelectedConclusionModal(item)}
                          className="flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-muted"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.period_label}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
                          </div>
                          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{item.week_start}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={selectedConclusionModal !== null} onOpenChange={(open) => !open && setSelectedConclusionModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedConclusionModal?.period_label || 'Conclusión semanal'}</DialogTitle>
            <DialogDescription>
              {selectedConclusionModal
                ? `${selectedConclusionModal.week_start} a ${selectedConclusionModal.week_end}`
                : 'Detalle completo de la conclusión semanal.'}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background/60 px-4 py-4">
            <div
              className="prose prose-sm max-w-none text-[0.9rem] text-foreground dark:prose-invert prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-inherit prose-p:my-1.5 prose-li:my-0.5 [&_h1]:!text-xl [&_h2]:!text-lg [&_h3]:!text-base [&_p]:!text-sm [&_li]:!text-sm [&_code]:!text-xs"
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(selectedConclusionModal?.content || '') }}
            />
          </div>

          <DialogFooter>
            <button
              onClick={() => setSelectedConclusionModal(null)}
              className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cerrar
            </button>
            <button
              onClick={() => void speakConclusion(selectedConclusionModal?.content ?? '')}
              disabled={conclusionAudioLoading}
              title={conclusionSpeaking ? 'Detener audio' : conclusionAudioLoading ? 'Generando audio...' : 'Escuchar conclusión'}
              className={`inline-flex items-center gap-2 justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                conclusionSpeaking
                  ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border-input bg-background text-foreground hover:bg-muted'
              }`}
            >
              {conclusionSpeaking
                ? <><Square className="h-4 w-4" />Detener</>
                : conclusionAudioLoading
                  ? <><Volume2 className="h-4 w-4 animate-pulse" />Generando...</>
                  : <><Volume2 className="h-4 w-4" />Escuchar</>
              }
            </button>
            <button
              onClick={() => {
                if (selectedConclusionModal) {
                  void handleDeleteWeeklyConclusion(selectedConclusionModal.week_start, true);
                }
              }}
              className="inline-flex items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Eliminar
            </button>
            <button
              onClick={() => {
                if (selectedConclusionModal) {
                  setConclusionReferenceDate(selectedConclusionModal.week_start);
                }
                setSelectedConclusionModal(null);
              }}
              className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Editar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Recordatorios por correo</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Recibe un correo diario con tus objetivos, rutinas y preguntas pendientes del dia.
        </p>

        {loading ? (
          <div className="space-y-3">
            <div className="h-32 rounded-xl bg-muted animate-pulse" />
            <div className="h-32 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : (
          <div className="space-y-3">
            <ReminderCard
              parte="manana"
              config={config.manana}
              onChange={cfg => setConfig(prev => ({ ...prev, manana: cfg }))}
              onTest={() => handleTest('manana')}
              testing={testing === 'manana'}
            />
            <ReminderCard
              parte="noche"
              config={config.noche}
              onChange={cfg => setConfig(prev => ({ ...prev, noche: cfg }))}
              onTest={() => handleTest('noche')}
              testing={testing === 'noche'}
            />

            {testMsg && (
              <p className={`rounded-lg px-3 py-2 text-xs ${testMsg.ok ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                {testMsg.text}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {!config.manana.enabled && !config.noche.enabled
                  ? <span className="flex items-center gap-1"><BellOff className="h-3 w-3" /> Sin recordatorios activos</span>
                  : `${[config.manana.enabled && 'manana', config.noche.enabled && 'noche'].filter(Boolean).join(' y ')} activado`
                }
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'} disabled:opacity-50`}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
