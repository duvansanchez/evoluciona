import { Headphones, Plus, Play, Music, TrendingUp } from 'lucide-react';
import MetricCard from '@/components/MetricCard';

export default function Audios() {
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Audios Inspiracionales</h1>
          <p className="text-sm text-muted-foreground mt-1">Tu biblioteca de contenido motivacional en audio</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors self-start">
          <Plus className="h-4 w-4" />
          Subir Audio
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <MetricCard title="Total audios" value={0} icon={Music} color="primary" />
        <MetricCard title="Hoy" value={0} icon={Play} color="success" subtitle="Escuchados" />
        <MetricCard title="Esta semana" value={0} icon={Headphones} color="warning" />
        <MetricCard title="Reproducciones" value={0} icon={TrendingUp} color="primary" />
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Headphones className="h-10 w-10 text-primary" />
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Aún no tienes audios</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Sube tus audios motivacionales favoritos y organízalos por categorías para acceder a ellos cuando necesites inspiración.
        </p>
        <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Subir tu primer audio
        </button>
      </div>
    </div>
  );
}
