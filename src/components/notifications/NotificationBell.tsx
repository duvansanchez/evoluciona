import { useState, useEffect, useRef } from 'react';
import { Bell, X, Quote, Target, Star, CalendarDays } from 'lucide-react';
import { phrasesAPI, goalsAPI } from '@/services/api';
import { isBellUnread, markBellRead } from './notificationState';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [phrase, setPhrase] = useState<{ texto: string; autor?: string } | null>(null);
  const [weeklyPending, setWeeklyPending] = useState(0);
  const [monthlyPending, setMonthlyPending] = useState(0);
  const [yearlyPending, setYearlyPending] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUnread(isBellUnread());
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
        goalsAPI.getGoals(1, 200),
      ]);

      if (phrasesRes.items.length > 0) {
        const idx = Math.floor(Math.random() * phrasesRes.items.length);
        setPhrase(phrasesRes.items[idx]);
      }

      const goals = goalsRes.items;
      setWeeklyPending(goals.filter((g: any) => g.categoria === 'weekly' && !g.completado).length);
      setMonthlyPending(goals.filter((g: any) => g.categoria === 'monthly' && !g.completado).length);
      setYearlyPending(goals.filter((g: any) => g.categoria === 'yearly' && !g.completado).length);
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
    }
  };

  const notifCount =
    (weeklyPending > 0 ? 1 : 0) +
    (monthlyPending > 0 ? 1 : 0) +
    (yearlyPending > 0 ? 1 : 0) +
    (phrase ? 1 : 0);

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

          <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
            {!loaded ? (
              <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
            ) : (
              <>
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

                {weeklyPending > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">{weeklyPending}</span> objetivo{weeklyPending > 1 ? 's' : ''} semanal{weeklyPending > 1 ? 'es' : ''} pendiente{weeklyPending > 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {monthlyPending > 0 && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">{monthlyPending}</span> objetivo{monthlyPending > 1 ? 's' : ''} mensual{monthlyPending > 1 ? 'es' : ''} pendiente{monthlyPending > 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {yearlyPending > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-center gap-2">
                    <Star className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">{yearlyPending}</span> objetivo{yearlyPending > 1 ? 's' : ''} anual{yearlyPending > 1 ? 'es' : ''} en progreso
                    </p>
                  </div>
                )}

                {!phrase && weeklyPending === 0 && monthlyPending === 0 && yearlyPending === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin notificaciones por ahora</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
