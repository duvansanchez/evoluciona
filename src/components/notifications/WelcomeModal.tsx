import { useEffect, useState } from 'react';
import { X, Quote, Target, Star, CalendarDays } from 'lucide-react';
import { phrasesAPI, goalsAPI } from '@/services/api';
import { shouldShowNotification, markNotificationShown, getGreeting } from './notificationState';

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState<{ texto: string; autor?: string } | null>(null);
  const [weeklyPending, setWeeklyPending] = useState(0);
  const [monthlyPending, setMonthlyPending] = useState(0);
  const [yearlyPending, setYearlyPending] = useState(0);

  useEffect(() => {
    if (shouldShowNotification()) {
      setOpen(true);
      fetchData();
    }
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
    } catch (err) {
      console.error('Error fetching welcome data:', err);
    }
  };

  const handleClose = () => {
    markNotificationShown();
    setOpen(false);
  };

  if (!open) return null;

  const hasGoals = weeklyPending > 0 || monthlyPending > 0 || yearlyPending > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">{getGreeting()}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Tus objetivos pendientes</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {phrase && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex gap-3">
                <Quote className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground italic leading-relaxed">"{phrase.texto}"</p>
                  {phrase.autor && (
                    <p className="text-xs text-muted-foreground mt-2">— {phrase.autor}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {weeklyPending > 0 && (
              <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <Target className="h-5 w-5 text-orange-500 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{weeklyPending}</span> objetivo{weeklyPending > 1 ? 's' : ''} semanal{weeklyPending > 1 ? 'es' : ''} pendiente{weeklyPending > 1 ? 's' : ''}
                </p>
              </div>
            )}

            {monthlyPending > 0 && (
              <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                <CalendarDays className="h-5 w-5 text-purple-500 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{monthlyPending}</span> objetivo{monthlyPending > 1 ? 's' : ''} mensual{monthlyPending > 1 ? 'es' : ''} pendiente{monthlyPending > 1 ? 's' : ''}
                </p>
              </div>
            )}

            {yearlyPending > 0 && (
              <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <Star className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{yearlyPending}</span> objetivo{yearlyPending > 1 ? 's' : ''} anual{yearlyPending > 1 ? 'es' : ''} en progreso
                </p>
              </div>
            )}

            {!hasGoals && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">Sin objetivos pendientes por ahora</p>
              </div>
            )}
          </div>

          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Vamos a ello
          </button>
        </div>
      </div>
    </div>
  );
}
