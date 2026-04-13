import { useEffect, useMemo, useState } from 'react';
import { EyeOff, Hash, Loader2, Shuffle, X } from 'lucide-react';
import { phrasesAPI } from '@/services/api';
import type { ReviewPlanConfig, ReviewPlanUpdatePayload } from '@/services/api';
import type { Phrase, PhraseCategory } from '@/types';

interface ReviewPlan {
  id: number;
  name: string;
  targets: string[];
  config: ReviewPlanConfig;
}

interface PlanConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ReviewPlan;
  categories: PhraseCategory[];
  onSave: (planId: number, payload: ReviewPlanUpdatePayload) => Promise<void>;
}

const mapBackendPhrase = (item: any): Phrase => ({
  id: item.id.toString(),
  text: item.texto,
  author: item.autor || undefined,
  categoryId: item.categoria_id?.toString(),
  subcategoryId: item.subcategoria_id?.toString(),
  notes: item.notas || undefined,
  active: item.activa,
  reviewCount: item.total_repasos || 0,
  lastReviewedAt: item.ultima_vez || undefined,
  createdAt: item.fecha_creacion,
});

export default function PlanConfigModal({ open, onOpenChange, plan, categories, onSave }: PlanConfigModalProps) {
  const [planName, setPlanName] = useState(plan.name);
  const [targets, setTargets] = useState<string[]>(plan.targets);
  const [targetToAdd, setTargetToAdd] = useState('');
  const [config, setConfig] = useState<ReviewPlanConfig>({ ...plan.config });
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loadingPhrases, setLoadingPhrases] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setPlanName(plan.name);
    setTargets(plan.targets);
    setTargetToAdd('');
    setConfig({
      shuffle: plan.config.shuffle ?? false,
      daily_limit: plan.config.daily_limit ?? null,
      excluded_phrase_ids: plan.config.excluded_phrase_ids ?? [],
    });
  }, [open, plan]);

  useEffect(() => {
    if (!open) return;
    void fetchPhrases(targets);
  }, [open, targets]);

  const studyTargets = useMemo(() => categories
    .filter(category => category.active)
    .flatMap(category => [
      { value: `cat:${category.id}`, label: `Categoria: ${category.name}` },
      ...category.subcategories
        .filter(sub => sub.active)
        .map(sub => ({
          value: `sub:${category.id}:${sub.id}`,
          label: `Subcategoria: ${category.name} / ${sub.name}`,
        })),
    ]), [categories]);

  const targetLabel = (target: string) => {
    const [type, categoryId, subcategoryId] = target.split(':');
    const category = categories.find(item => item.id === categoryId);

    if (type === 'cat') {
      return category ? `Categoria: ${category.name}` : 'Categoria';
    }

    const subcategory = category?.subcategories.find(item => item.id === subcategoryId);
    return category && subcategory
      ? `Subcategoria: ${category.name} / ${subcategory.name}`
      : 'Subcategoria';
  };

  const fetchPhrases = async (planTargets: string[]) => {
    setLoadingPhrases(true);
    const byId = new Map<string, Phrase>();

    try {
      for (const target of planTargets) {
        const [type, categoryId, subcategoryId] = target.split(':');
        let page = 1;
        let totalPages = 1;

        do {
          const response = await phrasesAPI.getPhrases(
            page,
            100,
            categoryId,
            type === 'sub' ? subcategoryId : undefined,
            true,
          );
          response.items.map(mapBackendPhrase).forEach(phrase => byId.set(phrase.id, phrase));
          totalPages = response.pages || 1;
          page += 1;
        } while (page <= totalPages);
      }
    } catch (error) {
      console.error('Error loading phrases for plan config:', error);
    }

    setPhrases(Array.from(byId.values()));
    setLoadingPhrases(false);
  };

  const addTarget = () => {
    if (!targetToAdd || targets.includes(targetToAdd)) return;
    setTargets(prev => [...prev, targetToAdd]);
    setTargetToAdd('');
  };

  const removeTarget = (target: string) => {
    setTargets(prev => prev.filter(item => item !== target));
  };

  const isExcluded = (phraseId: string) => config.excluded_phrase_ids.includes(Number(phraseId));

  const togglePhrase = (phraseId: string) => {
    const numId = Number(phraseId);
    setConfig(prev => ({
      ...prev,
      excluded_phrase_ids: prev.excluded_phrase_ids.includes(numId)
        ? prev.excluded_phrase_ids.filter(id => id !== numId)
        : [...prev.excluded_phrase_ids, numId],
    }));
  };

  const toggleAll = (exclude: boolean) => {
    setConfig(prev => ({
      ...prev,
      excluded_phrase_ids: exclude ? phrases.map(phrase => Number(phrase.id)) : [],
    }));
  };

  const handleSave = async () => {
    if (!planName.trim()) {
      alert('El nombre del plan es obligatorio.');
      return;
    }

    if (targets.length === 0) {
      alert('Agrega al menos una categoria o subcategoria al plan.');
      return;
    }

    setSaving(true);
    try {
      await onSave(plan.id, {
        name: planName.trim(),
        targets,
        config,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = phrases.length - config.excluded_phrase_ids.filter(
    id => phrases.some(phrase => Number(phrase.id) === id),
  ).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Editar plan de repaso</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{plan.name}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estructura del plan
            </h3>

            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Nombre</label>
                <input
                  type="text"
                  value={planName}
                  onChange={(event) => setPlanName(event.target.value)}
                  placeholder="Nombre de la planificacion"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <select
                  value={targetToAdd}
                  onChange={(event) => setTargetToAdd(event.target.value)}
                  className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecciona categoria o subcategoria</option>
                  {studyTargets.map(target => (
                    <option key={target.value} value={target.value}>{target.label}</option>
                  ))}
                </select>

                <button
                  onClick={addTarget}
                  disabled={!targetToAdd}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>

              {targets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {targets.map(target => (
                    <span key={target} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {targetLabel(target)}
                      <button
                        onClick={() => removeTarget(target)}
                        className="text-primary/80 hover:text-primary"
                        aria-label={`Quitar ${targetLabel(target)}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Este plan todavia no tiene categorias o subcategorias asociadas.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comportamiento de sesion
            </h3>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Shuffle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Orden aleatorio</p>
                  <p className="text-xs text-muted-foreground">Mezcla las frases en cada sesion</p>
                </div>
              </div>
              <div
                onClick={() => setConfig(prev => ({ ...prev, shuffle: !prev.shuffle }))}
                className={`relative h-5 w-10 flex-shrink-0 rounded-full transition-colors ${
                  config.shuffle ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    config.shuffle ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </label>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Hash className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Limite por sesion</p>
                  <p className="text-xs text-muted-foreground">Maximo de frases a repasar. Vacio = sin limite</p>
                </div>
              </div>
              <input
                type="number"
                min={1}
                placeholder="∞"
                value={config.daily_limit ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setConfig(prev => ({ ...prev, daily_limit: value === '' ? null : Number(value) }));
                }}
                className="w-20 rounded-lg border border-border bg-muted px-3 py-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Frases del plan
              </h3>
              {phrases.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {activeCount} activas de {phrases.length}
                  </span>
                  <button onClick={() => toggleAll(false)} className="text-xs text-primary hover:underline">
                    Activar todas
                  </button>
                  <button onClick={() => toggleAll(true)} className="text-xs text-muted-foreground hover:underline">
                    Desactivar todas
                  </button>
                </div>
              )}
            </div>

            {loadingPhrases ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="text-sm">Cargando frases...</span>
              </div>
            ) : phrases.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay frases activas en este plan con la seleccion actual.
              </p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {phrases.map(phrase => {
                  const excluded = isExcluded(phrase.id);
                  const category = categories.find(item => item.id === phrase.categoryId);
                  const subcategory = category?.subcategories.find(item => item.id === phrase.subcategoryId);

                  return (
                    <label
                      key={phrase.id}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                        excluded ? 'bg-muted/60 opacity-50' : 'bg-background hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => togglePhrase(phrase.id)}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-snug ${excluded ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {phrase.text}
                        </p>
                        {(category || subcategory) && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {category?.name}{subcategory ? ` / ${subcategory.name}` : ''}
                          </p>
                        )}
                      </div>
                      {excluded && <EyeOff className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
