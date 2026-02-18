import { BarChart3, Calendar, CheckCircle2, TrendingUp } from 'lucide-react';
import MetricCard from '@/components/MetricCard';

export default function Progress() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Progreso</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualiza tu evolución a lo largo del tiempo</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <MetricCard title="Racha actual" value="5 días" icon={TrendingUp} color="success" />
        <MetricCard title="Completados" value={42} icon={CheckCircle2} color="primary" subtitle="Este mes" />
        <MetricCard title="Frases repasadas" value={87} icon={BarChart3} color="warning" subtitle="Este mes" />
        <MetricCard title="Días activos" value={18} icon={Calendar} color="primary" subtitle="Febrero" />
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <BarChart3 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Estadísticas detalladas próximamente</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Aquí podrás ver gráficos de tu progreso, rachas, y tendencias a lo largo del tiempo.
        </p>
      </div>
    </div>
  );
}
