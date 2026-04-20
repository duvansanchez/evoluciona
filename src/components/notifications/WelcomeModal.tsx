import { useEffect, useRef, useState } from 'react';
import { Bell, BrainCircuit, CalendarDays, ChevronDown, ChevronUp, Play, Square, Sun, Target, Wallet } from 'lucide-react';
import { goalsAPI, integrationsAPI, phrasesAPI } from '@/services/api';
import type { ExternalGoal, PhraseAudioPreferences, PhraseAudioStatus } from '@/services/api';
import {
  shouldShowNotification,
  markNotificationShown,
  getGreeting,
  OPEN_WELCOME_MODAL_EVENT,
} from './notificationState';

type GoalItem = {
  titulo: string;
  categoria: string;
  completado: boolean;
  recurrente?: boolean;
  fecha_completado?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
};

const PREVIEW = 3;
const AUTO_DISMISS_MS = 28000;
const DEFAULT_AUDIO_RATE = 1;
const DEFAULT_AUDIO_PITCH = 1;
const TIME_REMINDERS = [
  'Un dia parece mucho. Siete pasan volando.',
  'No te sobra tiempo. Solo te quedan decisiones.',
  'Posponer hoy ya le quita fuerza a esta semana.',
  'El año no espera a que te sientas listo.',
  'Cada dia sin avance le regala terreno a la inercia.',
  'Lo urgente cambia. El tiempo que se fue no vuelve.',
  'La semana termina igual, con accion o sin ella.',
] as const;

function normalizeCategory(cat: string | null | undefined): string {
  const value = (cat ?? '').toLowerCase().trim();
  if (value === 'diario' || value === 'diarios' || value === 'daily') return 'daily';
  if (value === 'semanal' || value === 'semanales' || value === 'weekly') return 'weekly';
  if (value === 'mensual' || value === 'mensuales' || value === 'monthly') return 'monthly';
  return value;
}

function shouldKeepGoalVisible(goal: GoalItem): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (goal.fecha_inicio) {
    const start = new Date(goal.fecha_inicio);
    start.setHours(0, 0, 0, 0);
    if (start > today) return false;
  }

  if (goal.fecha_fin) {
    const end = new Date(goal.fecha_fin);
    end.setHours(23, 59, 59, 999);
    if (end < today) return false;
  }

  return true;
}

function isCompletedToday(completedAt?: string | null): boolean {
  if (!completedAt) return false;

  const parsedDate = new Date(completedAt);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const localDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return localDate === todayKey;
}

function isGoalEffectivelyCompleted(goal: GoalItem): boolean {
  if (goal.completado !== true) return false;
  if (goal.recurrente === true) return isCompletedToday(goal.fecha_completado);
  return true;
}

function GoalPreviewList({ goals }: { goals: ExternalGoal[] }) {
  return (
    <ul className="space-y-2">
      {goals.map((goal) => (
        <li key={goal.id} className="text-base text-foreground">
          <p className="leading-snug">- {goal.title}</p>
          {goal.description && (
            <p className="mt-1 line-clamp-3 whitespace-pre-line pl-4 text-sm leading-relaxed text-muted-foreground">
              {textPreview(goal.description)}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function textPreview(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function MultilineDescription({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split('\n');

  return (
    <div className={`text-sm leading-relaxed text-muted-foreground ${className}`.trim()}>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className={index === 0 ? '' : 'mt-1'}>
          {line || <span>&nbsp;</span>}
        </p>
      ))}
    </div>
  );
}

function getDaysLeftInYear(): number {
  const now = new Date();
  const endOfYear = new Date(now.getFullYear(), 11, 31);
  now.setHours(0, 0, 0, 0);
  endOfYear.setHours(0, 0, 0, 0);
  const diffMs = endOfYear.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dailyGoals, setDailyGoals] = useState<GoalItem[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<GoalItem[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<GoalItem[]>([]);
  const [financeGoals, setFinanceGoals] = useState<ExternalGoal[]>([]);
  const [mindfulGoals, setMindfulGoals] = useState<ExternalGoal[]>([]);
  const [showMindfulDetails, setShowMindfulDetails] = useState(false);
  const [currentSpeechSection, setCurrentSpeechSection] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [audioProvider, setAudioProvider] = useState<PhraseAudioStatus['provider']>('browser');
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [audioRate, setAudioRate] = useState<number>(DEFAULT_AUDIO_RATE);
  const [audioPitch, setAudioPitch] = useState<number>(DEFAULT_AUDIO_PITCH);
  const [voicesLoaded, setVoicesLoaded] = useState<SpeechSynthesisVoice[]>([]);
  const [expandedWeekly, setExpandedWeekly] = useState(false);
  const [expandedDaily, setExpandedDaily] = useState(false);
  const [expandedMonthly, setExpandedMonthly] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(AUTO_DISMISS_MS / 1000));
  const [externalLoading, setExternalLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const audioRequestIdRef = useRef(0);

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    audioRequestIdRef.current += 1;
    speechUtteranceRef.current = null;
    setCurrentSpeechSection(null);
  };

  const getPreferredVoice = () => {
    if (voicesLoaded.length === 0) return null;

    if (selectedVoiceName) {
      const selectedVoice = voicesLoaded.find((voice) => voice.name === selectedVoiceName);
      if (selectedVoice) return selectedVoice;
    }

    const availableSpanishVoices = voicesLoaded.filter((voice) => voice.lang.toLowerCase().startsWith('es'));
    if (availableSpanishVoices.length === 0) return voicesLoaded.find((voice) => voice.default) || voicesLoaded[0];

    return availableSpanishVoices.find((voice) => voice.default) || availableSpanishVoices[0];
  };

  const speakWithBrowser = (section: string, text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = getPreferredVoice();
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = 'es-CO';
    }
    utterance.rate = audioRate;
    utterance.pitch = audioPitch;
    utterance.onstart = () => setCurrentSpeechSection(section);
    utterance.onend = () => {
      speechUtteranceRef.current = null;
      setCurrentSpeechSection(null);
    };
    utterance.onerror = () => {
      speechUtteranceRef.current = null;
      setCurrentSpeechSection(null);
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const speakWithServiceAudio = async (section: string, text: string) => {
    const requestId = audioRequestIdRef.current + 1;
    audioRequestIdRef.current = requestId;

    try {
      const audioBlob = await phrasesAPI.generateAudio(text, {
        rate: audioRate,
        pitch: audioPitch,
      });
      if (audioRequestIdRef.current !== requestId) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      currentAudioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;

      audio.onplay = () => setCurrentSpeechSection(section);
      audio.onended = () => {
        setCurrentSpeechSection(null);
        audioElementRef.current = null;
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
      };
      audio.onerror = () => {
        setCurrentSpeechSection(null);
      };

      await audio.play();
    } catch (error) {
      console.error('Error reproduciendo audio de metas:', error);
      setCurrentSpeechSection(null);
    }
  };

  const speakText = (section: string, text: string) => {
    if (!speechSupported || !text.trim()) return;

    if (currentSpeechSection === section) {
      stopSpeech();
      return;
    }

    stopSpeech();
    if (audioProvider === 'edge' || audioProvider === 'elevenlabs') {
      void speakWithServiceAudio(section, text);
      return;
    }
    speakWithBrowser(section, text);
  };

  const buildInternalGoalsSpeechText = (label: string, goals: GoalItem[]) => {
    if (goals.length === 0) return `No tienes metas ${label} pendientes.`;
    const goalsText = goals.map((goal, index) => `${index + 1}. ${goal.titulo}.`).join(' ');
    return `Metas ${label} pendientes. ${goalsText}`;
  };

  const buildExternalGoalsSpeechText = (label: string, goals: ExternalGoal[]) => {
    if (goals.length === 0) return `No tienes metas pendientes en ${label}.`;
    const goalsText = goals
      .map((goal, index) => {
        const description = goal.description?.trim() ? ` ${goal.description.trim()}.` : '';
        return `${index + 1}. ${goal.title}.${description}`;
      })
      .join(' ');
    return `Metas pendientes en ${label}. ${goalsText}`;
  };

  const renderSpeechButton = (section: string, text: string) => {
    if (!speechSupported) return null;

    const active = currentSpeechSection === section;
    return (
      <button
        type="button"
        onClick={() => speakText(section, text)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground hover:bg-muted'}`}
      >
        {active ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {active ? 'Detener' : 'Escuchar'}
      </button>
    );
  };

  const dismiss = () => {
    stopSpeech();
    clearTimers();
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      setShowMindfulDetails(false);
      markNotificationShown();
    }, 300);
  };

  const startAutoDismiss = (durationMs = AUTO_DISMISS_MS) => {
    clearTimers();
    setSecondsRemaining(Math.ceil(durationMs / 1000));

    countdownRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timerRef.current = setTimeout(() => dismiss(), durationMs);
  };

  const fetchData = async (forceOpen = false) => {
    try {
      setExternalLoading(true);

      const [goalsResult, financeResult, mindfulResult] = await Promise.allSettled([
        goalsAPI.getGoals(1, 100),
        integrationsAPI.getFinanceHubGoals(),
        integrationsAPI.getMindfulStudyGoals(),
      ]);

      if (goalsResult.status !== 'fulfilled') {
        throw goalsResult.reason;
      }

      const goals: GoalItem[] = goalsResult.value.items;
      const daily = goals.filter(
        (goal) => normalizeCategory(goal.categoria) === 'daily' && !isGoalEffectivelyCompleted(goal) && shouldKeepGoalVisible(goal),
      );
      const weekly = goals.filter(
        (goal) => normalizeCategory(goal.categoria) === 'weekly' && !isGoalEffectivelyCompleted(goal) && shouldKeepGoalVisible(goal),
      );
      const monthly = goals.filter(
        (goal) => normalizeCategory(goal.categoria) === 'monthly' && !isGoalEffectivelyCompleted(goal) && shouldKeepGoalVisible(goal),
      );
      const finance = financeResult.status === 'fulfilled' ? financeResult.value : [];
      const mindful = mindfulResult.status === 'fulfilled' ? mindfulResult.value : [];

      setDailyGoals(daily);
      setWeeklyGoals(weekly);
      setMonthlyGoals(monthly);
      setFinanceGoals(finance);
      setMindfulGoals(mindful);
      setExpandedDaily(false);
      setExpandedWeekly(false);
      setExpandedMonthly(false);
      setShowMindfulDetails(false);
      setExternalLoading(false);

      if (daily.length > 0 || weekly.length > 0 || monthly.length > 0 || finance.length > 0 || mindful.length > 0) {
        setExiting(false);
        setVisible(true);
        startAutoDismiss();
      } else if (!forceOpen) {
        markNotificationShown();
      }
    } catch (error) {
      console.error('Error fetching welcome data:', error);
      setExternalLoading(false);
    }
  };

  useEffect(() => {
    const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
    setSpeechSupported(hasSpeech);

    const handleManualOpen = () => {
      void fetchData(true);
    };

    const loadAudioConfiguration = async () => {
      try {
        const [status, preferences] = await Promise.all([
          phrasesAPI.getAudioStatus(),
          phrasesAPI.getAudioPreferences(),
        ]);
        setAudioProvider(status.provider || 'browser');
        setSelectedVoiceName(preferences.selected_voice_name || '');
        setAudioRate(preferences.rate ?? DEFAULT_AUDIO_RATE);
        setAudioPitch(preferences.pitch ?? DEFAULT_AUDIO_PITCH);
      } catch (error) {
        console.error('Error cargando configuracion de audio para notificaciones:', error);
      }
    };

    const syncVoices = () => {
      if (!hasSpeech) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(voices);
      }
    };

    if (shouldShowNotification()) {
      void fetchData(false);
    }

    window.addEventListener(OPEN_WELCOME_MODAL_EVENT, handleManualOpen);
    void loadAudioConfiguration();

    if (hasSpeech) {
      syncVoices();
      window.speechSynthesis.addEventListener('voiceschanged', syncVoices);
    }

    return () => {
      stopSpeech();
      clearTimers();
      window.removeEventListener(OPEN_WELCOME_MODAL_EVENT, handleManualOpen);
      if (hasSpeech) {
        window.speechSynthesis.removeEventListener('voiceschanged', syncVoices);
      }
    };
  }, []);

  const openMindfulDetails = () => {
    if (externalLoading || mindfulGoals.length === 0) return;
    clearTimers();
    setShowMindfulDetails(true);
  };

  const closeMindfulDetails = () => {
    setShowMindfulDetails(false);
    startAutoDismiss(Math.max(secondsRemaining, 1) * 1000);
  };

  if (!visible) return null;

  const total = dailyGoals.length + weeklyGoals.length + monthlyGoals.length + financeGoals.length + mindfulGoals.length;
  const daysLeftInYear = getDaysLeftInYear();
  const today = new Date();
  const reminderOfDay = TIME_REMINDERS[today.getDay() % TIME_REMINDERS.length];

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ animation: exiting ? undefined : 'fadeIn 0.3s ease-out' }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl max-h-[88vh] flex flex-col"
        style={{ animation: exiting ? undefined : 'scaleIn 0.3s ease-out' }}
      >
        <div className="h-1 bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-primary"
            style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
          />
        </div>

        <div className="flex items-start gap-4 px-8 pt-7 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-tight text-foreground">{getGreeting()}</p>
            <p className="mt-1 text-base text-muted-foreground">
              Tienes <span className="font-semibold text-primary">{total}</span> objetivo{total !== 1 ? 's' : ''}{' '}
              pendiente{total !== 1 ? 's' : ''}
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Este recordatorio se cerrara automaticamente en {secondsRemaining}s
            </p>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-8 pb-8">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                  Tiempo real
                </p>
                <p className="text-2xl font-bold text-foreground">
                  Faltan <span className="text-primary">{daysLeftInYear}</span> dia{daysLeftInYear !== 1 ? 's' : ''} para que se acabe el año
                </p>
                <p className="text-sm text-muted-foreground dark:text-foreground/85">
                  Parece mucho cuando se mira de lejos. En la práctica, cada semana se consume más rápido de lo que se siente.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Frase del dia
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {reminderOfDay}
                </p>
              </div>
            </div>
          </div>

          {dailyGoals.length > 0 && (
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/8 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
                    Diarias - {dailyGoals.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {renderSpeechButton('daily', buildInternalGoalsSpeechText('diarias', dailyGoals))}
                  {dailyGoals.length > PREVIEW && (
                    <button
                      onClick={() => setExpandedDaily((value) => !value)}
                      className="flex items-center gap-0.5 text-xs text-yellow-600 hover:underline dark:text-yellow-400"
                    >
                      {expandedDaily ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> Ver mas
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {(expandedDaily ? dailyGoals : dailyGoals.slice(0, PREVIEW)).map((goal, index) => (
                  <li key={`daily-${index}`} className="text-base text-foreground">
                    - {goal.titulo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {weeklyGoals.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Semanales - {weeklyGoals.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {renderSpeechButton('weekly', buildInternalGoalsSpeechText('semanales', weeklyGoals))}
                  {weeklyGoals.length > PREVIEW && (
                    <button
                      onClick={() => setExpandedWeekly((value) => !value)}
                      className="flex items-center gap-0.5 text-xs text-amber-600 hover:underline dark:text-amber-400"
                    >
                      {expandedWeekly ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> Ver mas
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {(expandedWeekly ? weeklyGoals : weeklyGoals.slice(0, PREVIEW)).map((goal, index) => (
                  <li key={`weekly-${index}`} className="text-base text-foreground">
                    - {goal.titulo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {monthlyGoals.length > 0 && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/8 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    Mensuales - {monthlyGoals.length}
                  </span>
                </div>
                {monthlyGoals.length > PREVIEW && (
                  <button
                    onClick={() => setExpandedMonthly((value) => !value)}
                    className="flex items-center gap-0.5 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {expandedMonthly ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" /> Ver menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" /> Ver mas
                      </>
                    )}
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {(expandedMonthly ? monthlyGoals : monthlyGoals.slice(0, PREVIEW)).map((goal, index) => (
                  <li key={`monthly-${index}`} className="text-base text-foreground">
                    - {goal.titulo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <div className="h-fit rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Finance Hub - {externalLoading ? '...' : financeGoals.length}
                  </span>
                </div>
                {!externalLoading && renderSpeechButton('finance', buildExternalGoalsSpeechText('Finance Hub', financeGoals))}
              </div>
              {externalLoading ? (
                <p className="text-sm text-muted-foreground">Cargando metas externas...</p>
              ) : financeGoals.length > 0 ? (
                <GoalPreviewList goals={financeGoals.slice(0, 4)} />
              ) : (
                <p className="text-sm text-muted-foreground">Sin metas pendientes.</p>
              )}
            </div>

            <div className="h-fit rounded-2xl border border-sky-500/20 bg-sky-500/8 p-5 text-left">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-sky-500" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                    Mindful Study - {externalLoading ? '...' : mindfulGoals.length}
                  </span>
                </div>
                {!externalLoading && renderSpeechButton('mindful', buildExternalGoalsSpeechText('Mindful Study', mindfulGoals))}
              </div>
              {externalLoading ? (
                <p className="text-sm text-muted-foreground">Cargando metas externas...</p>
              ) : mindfulGoals.length > 0 ? (
                <GoalPreviewList goals={mindfulGoals.slice(0, 4)} />
              ) : (
                <p className="text-sm text-muted-foreground">Sin metas pendientes.</p>
              )}
              {!externalLoading && mindfulGoals.length > 0 && (
                <button
                  type="button"
                  onClick={openMindfulDetails}
                  className="mt-3 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                >
                  Ver todas las metas
                </button>
              )}
            </div>
          </div>

          <div className="w-full rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-center text-sm font-medium text-primary">
            Este recordatorio permanecera visible hasta completar el tiempo.
          </div>
        </div>
      </div>

      {showMindfulDetails && (
        <div className="absolute inset-0 z-[210] flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl rounded-3xl border border-sky-500/20 bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-sky-500" />
                  <h3 className="text-lg font-semibold text-foreground">Metas de Mindful Study</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mindfulGoals.length} meta{mindfulGoals.length !== 1 ? 's' : ''} pendiente
                  {mindfulGoals.length !== 1 ? 's' : ''} en total
                </p>
              </div>

              <button
                type="button"
                onClick={closeMindfulDetails}
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {mindfulGoals.map((goal) => (
                <div
                  key={`mindful-detail-${goal.id}`}
                  className="rounded-2xl border border-sky-500/15 bg-sky-500/6 p-4"
                >
                  <p className="text-base font-medium text-foreground">{goal.title}</p>
                  {goal.description && <MultilineDescription className="mt-2" text={goal.description} />}
                  {goal.category && <p className="mt-1 text-sm text-muted-foreground">{goal.category}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
