import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, CalendarDays, MessageCircleQuestion, CheckCircle2,
  Flame, Quote, BookOpen, ChevronRight, Wallet, BrainCircuit, ExternalLink,
} from 'lucide-react';
import { integrationsAPI, statsAPI } from '@/services/api';
import type { DashboardData, ExternalGoal } from '@/services/api';

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

const formatToday = () => {
  const d = new Date();
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
};

// Barra de progreso pequeña reutilizable
function MiniProgress({ value, total, color = 'bg-primary' }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Tarjeta de racha
function RachaCard({ label, streak, icon: Icon }: { label: string; streak: number; icon: any }) {
  const active = streak > 0;
  return (
    <div className={`rounded-xl border p-4 flex flex-col items-center gap-1.5 text-center ${active ? 'border-amber-400/40 bg-amber-500/5' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-1.5">
        <Flame className={`h-4 w-4 ${active ? 'text-amber-500' : 'text-muted-foreground/30'}`} />
        <span className={`text-2xl font-bold ${active ? 'text-amber-500' : 'text-muted-foreground/50'}`}>{streak}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-[10px] text-muted-foreground">{streak === 1 ? '1 día' : `${streak} días`}</p>
    </div>
  );
}

// Tarjeta de resumen diario
function DayCard({
  title, icon: Icon, iconColor, completed, total, extra, to,
}: {
  title: string; icon: any; iconColor: string;
  completed?: number; total?: number; to: string;
}) {
  const hasPct = total !== undefined && total > 0;
  const allDone = hasPct && completed === total;
  const pctColor = allDone ? 'bg-green-500' : 'bg-primary';

  return (
    <Link to={to} className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {hasPct && (
        <>
          <p className={`text-2xl font-bold ${allDone ? 'text-green-500' : 'text-foreground'}`}>
            {completed}/{total}
            {allDone && <CheckCircle2 className="inline h-5 w-5 ml-1.5 text-green-500" />}
          </p>
          <MiniProgress value={completed!} total={total} color={pctColor} />
        </>
      )}
    </Link>
  );
}

function ExternalGoalsCard({
  title,
  icon: Icon,
  iconColor,
  goals,
  loading,
  error,
}: {
  title: string;
  icon: any;
  iconColor: string;
  goals: ExternalGoal[];
  loading: boolean;
  error: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {goals.length}
          </span>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-9 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">No se pudieron cargar estas metas.</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin metas pendientes.</p>
        ) : (
          <div className="space-y-2">
            {goals.slice(0, 4).map((goal) => {
              const Wrapper = goal.url ? 'a' : 'div';
              const wrapperProps = goal.url
                ? {
                    href: goal.url,
                    target: '_blank',
                    rel: 'noreferrer',
                  }
                : {};

              return (
                <Wrapper
                  key={goal.id}
                  {...wrapperProps}
                  className={`block rounded-lg border border-border px-3 py-2 transition-colors ${
                    goal.url ? 'hover:bg-accent' : 'bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2">{goal.title}</p>
                      {goal.category && (
                        <p className="mt-1 text-xs text-muted-foreground">{goal.category}</p>
                      )}
                    </div>
                    {goal.url && <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </div>
                </Wrapper>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [financeGoals, setFinanceGoals] = useState<ExternalGoal[]>([]);
  const [mindfulGoals, setMindfulGoals] = useState<ExternalGoal[]>([]);
  const [externalLoading, setExternalLoading] = useState({ finance: true, mindful: true });
  const [externalError, setExternalError] = useState({ finance: false, mindful: false });

  useEffect(() => {
    statsAPI.getDashboard()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    Promise.allSettled([
      integrationsAPI.getFinanceHubGoals(),
      integrationsAPI.getMindfulStudyGoals(),
    ]).then(([financeResult, mindfulResult]) => {
      if (financeResult.status === 'fulfilled') {
        setFinanceGoals(financeResult.value);
      } else {
        setExternalError(prev => ({ ...prev, finance: true }));
      }

      if (mindfulResult.status === 'fulfilled') {
        setMindfulGoals(mindfulResult.value);
      } else {
        setExternalError(prev => ({ ...prev, mindful: true }));
      }

      setExternalLoading({ finance: false, mindful: false });
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Saludo */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground capitalize">{greeting()}</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">{formatToday()}</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No se pudo conectar con el backend.</p>
          <p className="text-xs text-muted-foreground mt-1">Asegúrate de que el servidor esté corriendo.</p>
        </div>
      ) : data && (
        <div className="space-y-8">

          {/* Rachas */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" /> Rachas
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <RachaCard label="Rutinas" streak={data.rachas.rutinas} icon={CalendarDays} />
              <RachaCard label="Preguntas" streak={data.rachas.preguntas} icon={MessageCircleQuestion} />
              <RachaCard label="Objetivos" streak={data.rachas.objetivos} icon={Target} />
            </div>
          </section>

          {/* Resumen de hoy */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Hoy
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DayCard
                title="Objetivos diarios"
                icon={Target}
                iconColor="text-primary"
                completed={data.hoy.objetivos.completados}
                total={data.hoy.objetivos.total}
                to="/goals"
              />
              <DayCard
                title="Rutinas"
                icon={CalendarDays}
                iconColor="text-amber-500"
                completed={data.hoy.rutinas.completadas}
                total={data.hoy.rutinas.total}
                to="/rutina"
              />
              <DayCard
                title="Preguntas"
                icon={MessageCircleQuestion}
                iconColor="text-purple-500"
                to="/questions"
                completed={data.hoy.preguntas.respondidas}
                total={data.hoy.preguntas.total}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Metas externas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ExternalGoalsCard
                title="Metas de Finance Hub"
                icon={Wallet}
                iconColor="text-emerald-500"
                goals={financeGoals}
                loading={externalLoading.finance}
                error={externalError.finance}
              />
              <ExternalGoalsCard
                title="Metas de Mindful Study"
                icon={BrainCircuit}
                iconColor="text-sky-500"
                goals={mindfulGoals}
                loading={externalLoading.mindful}
                error={externalError.mindful}
              />
            </div>
          </section>

          {/* Frase del día */}
          {data.frase_del_dia && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Quote className="h-3.5 w-3.5" /> Frase del día
              </h2>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm leading-relaxed text-foreground italic">
                  "{data.frase_del_dia.texto}"
                </p>
                {data.frase_del_dia.autor && (
                  <p className="mt-3 text-xs text-muted-foreground">— {data.frase_del_dia.autor}</p>
                )}
                <Link
                  to="/phrases"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <BookOpen className="h-3 w-3" /> Ver más frases
                </Link>
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
