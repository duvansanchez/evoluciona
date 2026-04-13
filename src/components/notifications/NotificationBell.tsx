import { useState, useEffect, useRef } from 'react';
import { Bell, X, Quote, Target, CalendarDays, Sunrise, Sunset, CheckCircle2 } from 'lucide-react';
import { phrasesAPI, goalsAPI } from '@/services/api';
import {
  isBellUnread,
  markBellRead,
  getReadState,
  getCurrentInterval,
  requestWelcomeModalOpen,
} from './notificationState';

type GoalItem = {
  titulo: string;
  categoria: string;
  completado: boolean;
  recurrente?: boolean;
  fecha_creacion?: string;
  fecha_completado?: string | null;
};

function normalizeCategory(cat: string | null | undefined): string {
  const c = (cat ?? '').toLowerCase().trim();
  if (c === 'semanal' || c === 'semanales' || c === 'weekly') return 'weekly';
  if (c === 'mensual' || c === 'mensuales' || c === 'monthly') return 'monthly';
  return c;
}

function shouldShowGoal(item: GoalItem, normalizedCategory: string): boolean {
  if (item.recurrente === true) return true;
  if (!item.fecha_creacion) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fechaCreacion = new Date(item.fecha_creacion);

  if (normalizedCategory === 'weekly') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const fin = new Date(monday);
    fin.setDate(monday.getDate() + 7);
    return fechaCreacion >= monday && fechaCreacion < fin;
  }

  if (normalizedCategory === 'monthly') {
    const inicio = new Date(today.getFullYear(), today.getMonth(), 1);
    const fin = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return fechaCreacion >= inicio && fechaCreacion < fin;
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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [phrase, setPhrase] = useState<{ texto: string; autor?: string } | null>(null);
  const [weeklyGoals, setWeeklyGoals] = useState<GoalItem[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<GoalItem[]>([]);
  const [readState, setReadState] = useState({ morningRead: false, afternoonRead: false });
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUnread(isBellUnread());
    setReadState(getReadState());
    fetchData();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchData = async () => {
    try {
      const [phrasesRes, goalsRes] = await Promise.all([
        phrasesAPI.getPhrases(1, 100),
        goalsAPI.getGoals(1, 100),
      ]);

      if (phrasesRes.items.length > 0) {
        const idx = Math.floor(Math.random() * phrasesRes.items.length);
        setPhrase(phrasesRes.items[idx]);
      }

      const goals: GoalItem[] = goalsRes.items;
      setWeeklyGoals(goals.filter(g => {
        const cat = normalizeCategory(g.categoria);
        return cat === 'weekly' && !isGoalEffectivelyCompleted(g) && shouldShowGoal(g, cat);
      }));
      setMonthlyGoals(goals.filter(g => {
        const cat = normalizeCategory(g.categoria);
        return cat === 'monthly' && !isGoalEffectivelyCompleted(g) && shouldShowGoal(g, cat);
      }));
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setLoaded(true);
    }
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      markBellRead();
      setUnread(false);
      setReadState(getReadState());
    }
  };

  const handleOpenWelcomeModal = () => {
    requestWelcomeModalOpen();
    setOpen(false);
  };

  const hasPending = weeklyGoals.length > 0 || monthlyGoals.length > 0;
  const currentInterval = getCurrentInterval();
  const notifCount = (hasPending ? 1 : 0) + (phrase ? 1 : 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unread && notifCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {notifCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm text-foreground">Notificaciones</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
            ) : (
              <>
                {/* Frase del día */}
                {phrase && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-2">
                    <Quote className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-foreground italic leading-relaxed">"{phrase.texto}"</p>
                      {phrase.autor && (
                        <p className="text-[11px] text-muted-foreground mt-1">— {phrase.autor}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Recordatorio Mañana */}
                <ReminderCard
                  interval="morning"
                  current={currentInterval}
                  read={readState.morningRead}
                  weeklyGoals={weeklyGoals}
                  monthlyGoals={monthlyGoals}
                />

                {/* Recordatorio Tarde */}
                <ReminderCard
                  interval="afternoon"
                  current={currentInterval}
                  read={readState.afternoonRead}
                  weeklyGoals={weeklyGoals}
                  monthlyGoals={monthlyGoals}
                />

                {hasPending && (
                  <button
                    type="button"
                    onClick={handleOpenWelcomeModal}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    Ver modal del día
                  </button>
                )}

                {!phrase && !hasPending && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin objetivos pendientes</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderCard({
  interval,
  current,
  read,
  weeklyGoals,
  monthlyGoals,
}: {
  interval: 'morning' | 'afternoon';
  current: 'morning' | 'afternoon';
  read: boolean;
  weeklyGoals: GoalItem[];
  monthlyGoals: GoalItem[];
}) {
  const isMorning = interval === 'morning';
  const isCurrent = interval === current;
  const hasPending = weeklyGoals.length > 0 || monthlyGoals.length > 0;

  const label = isMorning ? 'Recordatorio Mañana' : 'Recordatorio Tarde';
  const timeRange = isMorning ? '6:00 – 13:00' : '13:00 – 20:00';
  const Icon = isMorning ? Sunrise : Sunset;

  const borderClass = isMorning
    ? 'border-amber-400/40'
    : 'border-indigo-400/40';
  const bgClass = isMorning
    ? 'bg-amber-50/60 dark:bg-amber-950/20'
    : 'bg-indigo-50/60 dark:bg-indigo-950/20';
  const iconColor = isMorning ? 'text-amber-500' : 'text-indigo-500';
  const labelColor = isMorning ? 'text-amber-700 dark:text-amber-400' : 'text-indigo-700 dark:text-indigo-400';

  // Si el intervalo es futuro (tarde cuando es mañana), mostrar placeholder
  const isFuture = !isCurrent && interval === 'afternoon' && current === 'morning';

  return (
    <div className={`rounded-lg border p-3 ${bgClass} ${borderClass} ${isCurrent ? 'ring-1 ring-inset ring-current/10' : 'opacity-70'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
          <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{timeRange}</span>
          {read && !isFuture && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />
          )}
        </div>
      </div>

      {/* Contenido */}
      {isFuture ? (
        <p className="text-xs text-muted-foreground">Recordatorio pendiente para esta tarde</p>
      ) : !hasPending ? (
        <p className="text-xs text-muted-foreground">Sin objetivos pendientes</p>
      ) : (
        <div className="space-y-2">
          {weeklyGoals.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Target className={`h-3 w-3 ${iconColor}`} />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Semanales ({weeklyGoals.length})
                </span>
              </div>
              <ul className="space-y-0.5 pl-4">
                {weeklyGoals.slice(0, 3).map((g, i) => (
                  <li key={i} className="text-xs text-foreground truncate">• {g.titulo}</li>
                ))}
                {weeklyGoals.length > 3 && (
                  <li className="text-xs text-muted-foreground">+{weeklyGoals.length - 3} más</li>
                )}
              </ul>
            </div>
          )}
          {monthlyGoals.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <CalendarDays className={`h-3 w-3 ${iconColor}`} />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Mensuales ({monthlyGoals.length})
                </span>
              </div>
              <ul className="space-y-0.5 pl-4">
                {monthlyGoals.slice(0, 3).map((g, i) => (
                  <li key={i} className="text-xs text-foreground truncate">• {g.titulo}</li>
                ))}
                {monthlyGoals.length > 3 && (
                  <li className="text-xs text-muted-foreground">+{monthlyGoals.length - 3} más</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
