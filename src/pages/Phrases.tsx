import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Dices,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Settings,
  Settings2,
  Volume2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import MetricCard from '@/components/MetricCard';
import PhraseCard from '@/components/phrases/PhraseCard';
import PhraseModal from '@/components/phrases/PhraseModal';
import ReviewModal from '@/components/phrases/ReviewModal';
import RandomPhraseModal from '@/components/phrases/RandomPhraseModal';
import { phrasesAPI, reviewPlansAPI } from '@/services/api';
import type { ReviewPlanConfig, ReviewPlanUpdatePayload } from '@/services/api';
import type { Phrase, PhraseCategory } from '@/types';
import { mockPhraseCategories } from '@/data/mockData';
import PlanConfigModal from '@/components/phrases/PlanConfigModal';

interface ReviewPlan {
  id: number;
  name: string;
  targets: string[];
  config: ReviewPlanConfig;
}

const DEFAULT_PLAN_CONFIG: ReviewPlanConfig = {
  shuffle: false,
  daily_limit: null,
  excluded_phrase_ids: [],
};

const PHRASES_PAGE_SIZE = 60;

// Mapear datos del backend al formato frontend
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

// Mapear categorías del backend al formato frontend
const mapBackendCategory = (item: any): PhraseCategory => ({
  id: item.id.toString(),
  name: item.name,
  description: item.description || undefined,
  active: item.active,
  subcategories: item.subcategories?.map((sub: any) => ({
    id: sub.id.toString(),
    name: sub.name,
    description: sub.description || undefined,
    active: sub.active,
  })) || [],
});

export default function Phrases() {
  const navigate = useNavigate();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [categories, setCategories] = useState<PhraseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [phrasesPage, setPhrasesPage] = useState(1);
  const [phrasesPages, setPhrasesPages] = useState(1);
  const [phrasesTotal, setPhrasesTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [inactiveTotal, setInactiveTotal] = useState(0);
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [randomPhrase, setRandomPhrase] = useState<Phrase | null>(null);
  const [editingPhrase, setEditingPhrase] = useState<Phrase | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [reviewPhrases, setReviewPhrases] = useState<Phrase[]>([]);
  const [reviewSessionLabel, setReviewSessionLabel] = useState('Todas');
  const [reviewSessionPlanId, setReviewSessionPlanId] = useState<number | undefined>(undefined);
  const [reviewSessionAudioMode, setReviewSessionAudioMode] = useState<'off' | 'manual' | 'continuous'>('off');
  const [reviewPlans, setReviewPlans] = useState<ReviewPlan[]>([]);
  const [configuringPlan, setConfiguringPlan] = useState<ReviewPlan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);
  const [planName, setPlanName] = useState('');
  const [targetToAdd, setTargetToAdd] = useState('');
  const [selectedPlanTargets, setSelectedPlanTargets] = useState<string[]>([]);

  const categoryFilter = selectedCategory !== 'all' ? selectedCategory : undefined;
  const subcategoryFilter = selectedSubcategory !== 'all' ? selectedSubcategory : undefined;

  const fetchPhraseCounts = async () => {
    const [activeRes, inactiveRes] = await Promise.all([
      phrasesAPI.getPhrases(1, 1, categoryFilter, subcategoryFilter, true),
      phrasesAPI.getPhrases(1, 1, categoryFilter, subcategoryFilter, false),
    ]);

    setActiveTotal(activeRes.total || 0);
    setInactiveTotal(inactiveRes.total || 0);
  };

  const fetchPhrasesPage = async (page: number, reset: boolean) => {
    const activeFilter = showInactive ? undefined : true;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await phrasesAPI.getPhrases(
        page,
        PHRASES_PAGE_SIZE,
        categoryFilter,
        subcategoryFilter,
        activeFilter,
      );
      const mapped = response.items.map(mapBackendPhrase);

      setPhrases(prev => (reset ? mapped : [...prev, ...mapped]));
      setPhrasesPage(response.page || page);
      setPhrasesPages(response.pages || 1);
      setPhrasesTotal(response.total || 0);
    } catch (error) {
      console.error('Error loading phrases:', error);
      if (reset) setPhrases([]);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Cargar categorías del backend
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await phrasesAPI.getCategoriesTree();
        const mappedCategories = categoriesData.map(mapBackendCategory);
        setCategories(mappedCategories);
      } catch (error) {
        console.error('Error loading categories data:', error);
        setCategories(mockPhraseCategories);
      }
    };

    loadCategories();
  }, []);

  // Cargar frases según filtros actuales (sin traer todo de golpe)
  useEffect(() => {
    fetchPhrasesPage(1, true);
    fetchPhraseCounts().catch(error => console.error('Error loading phrase counts:', error));
  }, [selectedCategory, selectedSubcategory, showInactive]);

  useEffect(() => {
    reviewPlansAPI.getPlans()
      .then(plans => setReviewPlans(plans.map(p => ({ ...p, config: p.config ?? DEFAULT_PLAN_CONFIG }))))
      .catch(error => console.error('Error loading review plans:', error));
  }, []);

  // Lista visible (ya viene filtrada desde backend)
  const filtered = phrases;

  // Métricas dinámicas basadas en el filtro actual
  const filteredActive = filtered.filter(p => p.active);
  const filteredInactive = filtered.filter(p => !p.active);
  const filteredVisible = showInactive ? filtered : filteredActive;
  const filteredTotalReviews = filtered.reduce((sum, p) => sum + p.reviewCount, 0);
  const filteredReviewedToday = filtered.filter(p => {
    if (!p.lastReviewedAt) return false;
    return new Date(p.lastReviewedAt).toDateString() === new Date().toDateString();
  }).length;

  const currentCategory = categories.find(c => c.id === selectedCategory);
  const subcategories = currentCategory?.subcategories ?? [];
  const currentSubcategory = subcategories.find(s => s.id === selectedSubcategory);

  const studyTargets = useMemo(() => categories
    .filter(category => category.active)
    .flatMap(category => [
    { value: `cat:${category.id}`, label: `Categoría: ${category.name}` },
    ...category.subcategories
      .filter(sub => sub.active)
      .map(sub => ({
      value: `sub:${category.id}:${sub.id}`,
      label: `Subcategoría: ${category.name} / ${sub.name}`,
    })),
  ]), [categories]);

  const targetLabel = (target: string) => {
    if (!target) return '';
    const [type, categoryId, subcategoryId] = target.split(':');
    const category = categories.find(c => c.id === categoryId);

    if (type === 'cat') {
      return category ? `Categoría: ${category.name}` : 'Categoría';
    }

    const sub = category?.subcategories.find(s => s.id === subcategoryId);
    return category && sub
      ? `Subcategoría: ${category.name} / ${sub.name}`
      : 'Subcategoría';
  };

  const matchesTarget = (phrase: Phrase, target: string) => {
    const [type, categoryId, subcategoryId] = target.split(':');
    if (type === 'cat') {
      return phrase.categoryId === categoryId;
    }
    if (type === 'sub') {
      return phrase.categoryId === categoryId && phrase.subcategoryId === subcategoryId;
    }
    return false;
  };

  const getPlanPhraseCount = (plan: ReviewPlan) => {
    const activePhrases = phrases.filter(p => p.active);
    return activePhrases.filter(p =>
      plan.targets.some(target => matchesTarget(p, target))
    ).length;
  };

  const addTargetToDraft = () => {
    if (!targetToAdd) return;
    if (selectedPlanTargets.includes(targetToAdd)) return;
    setSelectedPlanTargets(prev => [...prev, targetToAdd]);
    setTargetToAdd('');
  };

  const removeTargetFromDraft = (target: string) => {
    setSelectedPlanTargets(prev => prev.filter(item => item !== target));
  };

  const fetchAllActiveForCurrentFilters = async () => {
    let page = 1;
    const merged: Phrase[] = [];
    let totalPages = 1;

    do {
      const response = await phrasesAPI.getPhrases(
        page,
        100,
        categoryFilter,
        subcategoryFilter,
        true,
      );
      merged.push(...response.items.map(mapBackendPhrase));
      totalPages = response.pages || 1;
      page += 1;
    } while (page <= totalPages);

    return merged;
  };

  const fetchAllActiveForTargets = async (targets: string[]) => {
    const byId = new Map<string, Phrase>();

    for (const target of targets) {
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
        response.items.map(mapBackendPhrase).forEach((phrase) => byId.set(phrase.id, phrase));
        totalPages = response.pages || 1;
        page += 1;
      } while (page <= totalPages);
    }

    return Array.from(byId.values());
  };

  const openReviewSession = (
    items: Phrase[],
    label: string,
    planId?: number,
    audioMode: 'off' | 'manual' | 'continuous' = 'off',
  ) => {
    setReviewPhrases(items);
    setReviewSessionLabel(label);
    setReviewSessionPlanId(planId);
    setReviewSessionAudioMode(audioMode);
    setShowReviewModal(true);
  };

  const handleReview = async (id: string) => {
    const updated = await phrasesAPI.reviewPhrase(id, {
      review_plan_id: reviewSessionPlanId,
      session_label: reviewSessionLabel,
    });
    setPhrases(prev => prev.map(p =>
      p.id === id
        ? { ...p, reviewCount: updated.total_repasos || p.reviewCount + 1, lastReviewedAt: updated.ultima_vez || new Date().toISOString() }
        : p
    ));
    await refreshPhraseReport(true);
  };

  const handleReviewAll = async () => {
    const allActive = await fetchAllActiveForCurrentFilters();
    if (allActive.length === 0) return;
    const label =
      selectedCategory === 'all'
        ? 'Todas las categorías'
        : selectedSubcategory === 'all'
          ? (categories.find(c => c.id === selectedCategory)?.name || 'Categoría')
          : (currentSubcategory?.name || 'Subcategoría');
    openReviewSession(allActive, label);
  };

  const handleStartStudyReview = async (plan: ReviewPlan, audioMode: 'off' | 'manual' | 'continuous' = 'off') => {
    let selected = await fetchAllActiveForTargets(plan.targets);

    if (selected.length === 0) {
      alert('Esta planificación no tiene frases activas para repasar.');
      return;
    }

    const cfg = plan.config ?? DEFAULT_PLAN_CONFIG;

    // Aplicar exclusiones de la config del plan
    if (cfg.excluded_phrase_ids.length > 0) {
      const excluded = new Set(cfg.excluded_phrase_ids.map(String));
      selected = selected.filter(p => !excluded.has(p.id));
    }

    // Aplicar orden aleatorio
    if (cfg.shuffle) {
      selected = [...selected].sort(() => Math.random() - 0.5);
    }

    // Aplicar límite por sesión
    if (cfg.daily_limit && cfg.daily_limit > 0) {
      selected = selected.slice(0, cfg.daily_limit);
    }

    if (selected.length === 0) {
      alert('Todas las frases de esta planificación están desactivadas en la config.');
      return;
    }

    openReviewSession(selected, `Planificación: ${plan.name}`, plan.id, audioMode);
  };

  const handleSavePlanConfig = async (planId: number, payload: ReviewPlanUpdatePayload) => {
    const updated = await reviewPlansAPI.updatePlan(planId, payload);
    setReviewPlans(prev => prev.map(p => p.id === planId ? { ...p, ...updated, config: updated.config ?? DEFAULT_PLAN_CONFIG } : p));
    setConfiguringPlan(prev => prev && prev.id === planId ? { ...prev, ...updated, config: updated.config ?? DEFAULT_PLAN_CONFIG } : prev);
  };

  const handleCreateReviewPlan = async () => {
    if (!planName.trim()) {
      alert('El nombre de la planificación de repaso es obligatorio.');
      return;
    }

    if (selectedPlanTargets.length === 0) {
      alert('Selecciona al menos una categoría o subcategoría para crear la planificación.');
      return;
    }

    try {
      const newPlan = await reviewPlansAPI.createPlan({
        name: planName.trim(),
        targets: selectedPlanTargets,
      });
      setReviewPlans(prev => [{ ...newPlan, config: newPlan.config ?? DEFAULT_PLAN_CONFIG }, ...prev]);
      setPlanName('');
      setSelectedPlanTargets([]);
      setTargetToAdd('');
    } catch (error) {
      console.error('Error creating review plan:', error);
      alert('Error al guardar la planificación.');
    }
  };

  const handleRunDraftPlan = (audioMode: 'off' | 'manual' | 'continuous' = 'off') => {
    if (selectedPlanTargets.length === 0) {
      alert('Selecciona una o más categorías/subcategorías para iniciar el repaso.');
      return;
    }

    const draftPlan: ReviewPlan = {
      id: 'draft',
      name: planName.trim() || 'Plan temporal',
      targets: selectedPlanTargets,
    };

    handleStartStudyReview(draftPlan, audioMode);
  };

  const handleDeleteReviewPlan = async (id: number) => {
    setReviewPlans(prev => prev.filter(plan => plan.id !== id));
    try {
      await reviewPlansAPI.deletePlan(id);
    } catch (error) {
      console.error('Error deleting review plan:', error);
      reviewPlansAPI.getPlans().then(setReviewPlans).catch(() => {});
    }
  };

  const handleRandomPhrase = async () => {
    const allActive = await fetchAllActiveForCurrentFilters();
    if (allActive.length === 0) return;
    const randomIndex = Math.floor(Math.random() * allActive.length);
    setRandomPhrase(allActive[randomIndex]);
    setShowRandomModal(true);
  };

  const handleNewRandomPhrase = () => {
    const activeLoaded = filteredActive;
    if (activeLoaded.length === 0) return;
    const randomIndex = Math.floor(Math.random() * activeLoaded.length);
    setRandomPhrase(activeLoaded[randomIndex]);
  };

  const getReviewButtonText = () => {
    if (activeTotal === 0) return 'Repasar';

    let text = 'Repasar';
    if (selectedCategory !== 'all') {
      const cat = categories.find(c => c.id === selectedCategory);
      if (selectedSubcategory !== 'all') {
        const sub = cat?.subcategories.find(s => s.id === selectedSubcategory);
        text = `Repasar ${sub?.name || ''}`;
      } else {
        text = `Repasar ${cat?.name || ''}`;
      }
    } else {
      text = 'Repasar Todas';
    }
    return `${text} (${activeTotal})`;
  };

  const handleCreatePhrase = () => {
    setEditingPhrase(null);
    setShowPhraseModal(true);
  };

  const handleEditPhrase = (phrase: Phrase) => {
    setEditingPhrase(phrase);
    setShowPhraseModal(true);
  };

  const handleToggleActive = async (id: string) => {
    const target = phrases.find(p => p.id === id);
    if (!target) return;

    const nextActive = !target.active;
    setPhrases(prev => prev.map(p => p.id === id ? { ...p, active: nextActive } : p));

    try {
      await phrasesAPI.updatePhrase(id, { active: nextActive });
      await fetchPhrasesPage(1, true);
      await fetchPhraseCounts();
    } catch (error) {
      console.error('Error toggling phrase active:', error);
      setPhrases(prev => prev.map(p => p.id === id ? target : p));
    }
  };

  const handleDeletePhrase = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta frase?')) return;

    const prev = phrases;
    setPhrases(p => p.filter(x => x.id !== id));

    try {
      await phrasesAPI.deletePhrase(id);
      await fetchPhraseCounts();
    } catch (error) {
      console.error('Error deleting phrase:', error);
      setPhrases(prev);
    }
  };

  const handleSavePhrase = async (formData: any) => {
    if (editingPhrase) {
      setPhrases(prev => prev.map(p => p.id === editingPhrase.id ? { ...p, ...formData } : p));
      try {
        await phrasesAPI.updatePhrase(editingPhrase.id, {
          text: formData.text,
          author: formData.author || null,
          category_id: formData.categoryId || null,
          subcategory_id: formData.subcategoryId || null,
          notes: formData.notes || null,
          active: formData.active,
        });
      } catch (error) {
        console.error('Error updating phrase:', error);
      }
    } else {
      try {
        const created = await phrasesAPI.createPhrase({
          text: formData.text,
          author: formData.author || null,
          category_id: formData.categoryId || null,
          subcategory_id: formData.subcategoryId || null,
          notes: formData.notes || null,
          active: formData.active,
        });
        setPhrases(prev => [mapBackendPhrase(created), ...prev]);
        await fetchPhraseCounts();
        } catch (error) {
        console.error('Error creating phrase:', error);
      }
    }
  };

  const handleEditFromReview = async (id: string, formData: any) => {
    setPhrases(prev => prev.map(p => p.id === id ? { ...p, ...formData } : p));
    setReviewPhrases(prev => prev.map(p => p.id === id ? { ...p, ...formData } : p));
    try {
      await phrasesAPI.updatePhrase(id, {
        text: formData.text,
        author: formData.author || null,
        category_id: formData.categoryId || null,
        subcategory_id: formData.subcategoryId || null,
        notes: formData.notes || null,
      });
    } catch (error) {
      console.error('Error updating phrase from review:', error);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Frases Inspiracionales</h1>
          <p className="text-sm text-muted-foreground mt-1">Tu colección de sabiduría para el crecimiento personal</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => navigate('/phrases/categories')}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/80 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Categorías
          </button>
          <button
            onClick={handleRandomPhrase}
            disabled={activeTotal === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Dices className="h-4 w-4" />
            Aleatoria
          </button>
          <button
            onClick={handleReviewAll}
            disabled={activeTotal === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-4 w-4" />
            {getReviewButtonText()}
          </button>
          <button
            onClick={handleCreatePhrase}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva Frase
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <MetricCard title="Total" value={phrasesTotal} icon={BookOpen} color="primary" subtitle={`${activeTotal} activas`} />
        <MetricCard title="Hoy" value={filteredReviewedToday} icon={Eye} color="success" subtitle="Repasadas" />
        <MetricCard title="Total repasos" value={filteredTotalReviews} icon={RefreshCw} color="warning" />
        <MetricCard title="Categorías" value={categories.length} icon={Filter} color="primary" />
      </div>


      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={selectedCategory}
          onChange={e => { setSelectedCategory(e.target.value); setSelectedSubcategory('all'); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {subcategories.length > 0 && (
          <select
            value={selectedSubcategory}
            onChange={e => setSelectedSubcategory(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todas las subcategorías</option>
            {subcategories.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowInactive(v => !v)}
          className={`whitespace-nowrap px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showInactive
              ? 'bg-muted text-foreground border-border'
              : 'bg-background text-muted-foreground border-input hover:text-foreground hover:bg-muted'
          }`}
        >
          {showInactive ? 'Ocultar inactivas' : `Mostrar inactivas (${inactiveTotal})`}
        </button>

        <span className="text-xs text-muted-foreground">{phrasesTotal} frases</span>
      </div>

      {/* Subcategory description */}
      {currentSubcategory?.description && (
        <div className="mb-5 rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground animate-fade-in">
          {currentSubcategory.description}
        </div>
      )}

      {/* Review plans */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Planificaciones de repaso</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Combina todas las categorías y subcategorías que quieras para una sola sesión de repaso.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="Nombre de la planificación"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <select
            value={targetToAdd}
            onChange={(e) => setTargetToAdd(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecciona categoría/subcategoría</option>
            {studyTargets.map(target => (
              <option key={target.value} value={target.value}>{target.label}</option>
            ))}
          </select>

          <button
            onClick={addTargetToDraft}
            disabled={!targetToAdd}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Agregar selección
          </button>
        </div>

        {selectedPlanTargets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedPlanTargets.map(target => (
              <span key={target} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {targetLabel(target)}
                <button
                  onClick={() => removeTargetFromDraft(target)}
                  className="text-primary/80 hover:text-primary"
                  aria-label={`Quitar ${targetLabel(target)}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleRunDraftPlan()}
            disabled={selectedPlanTargets.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Iniciar repaso combinado
          </button>
          <button
            onClick={() => handleRunDraftPlan('continuous')}
            disabled={selectedPlanTargets.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            <Volume2 className="h-4 w-4" />
            Audio corrido
          </button>
          <button
            onClick={handleCreateReviewPlan}
            disabled={selectedPlanTargets.length === 0 || !planName.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Guardar planificación
          </button>
        </div>

        {reviewPlans.length > 0 && (
          <div className="space-y-2">
            {reviewPlans.map(plan => (
              <div key={plan.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.targets.map(target => targetLabel(target)).join(' + ')}
                    {` · ${getPlanPhraseCount(plan)} frases activas`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartStudyReview(plan)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Repasar
                  </button>
                  <button
                    onClick={() => handleStartStudyReview(plan, 'continuous')}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Audio
                  </button>
                  <button
                    onClick={() => setConfiguringPlan(plan)}
                    title="Configuración del plan"
                    className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingPlanId(plan.id)}
                    className="rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phrases Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVisible.map(phrase => (
          <PhraseCard
            key={phrase.id}
            phrase={phrase}
            categories={categories}
            onReview={handleReview}
            onEdit={handleEditPhrase}
            onToggleActive={handleToggleActive}
            onDelete={handleDeletePhrase}
          />
        ))}
      </div>

      {filteredVisible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No hay frases en esta categoría</p>
          <p className="text-xs text-muted-foreground mt-1">Agrega tu primera frase inspiracional</p>
        </div>
      )}

      {phrasesPage < phrasesPages && filteredVisible.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => fetchPhrasesPage(phrasesPage + 1, false)}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {loadingMore ? 'Cargando...' : 'Cargar más frases'}
          </button>
        </div>
      )}

      {/* Phrase Modal */}
      <PhraseModal
        open={showPhraseModal}
        onOpenChange={setShowPhraseModal}
        phrase={editingPhrase}
        categories={categories}
        onSave={handleSavePhrase}
        initialCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined}
        initialSubcategoryId={selectedSubcategory !== 'all' ? selectedSubcategory : undefined}
      />

      {/* Review Modal */}
      <ReviewModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        phrases={reviewPhrases}
        categories={categories}
        onReview={handleReview}
        onEdit={handleEditFromReview}
        sessionLabel={reviewSessionLabel}
        initialAudioMode={reviewSessionAudioMode}
      />

      {/* Random Phrase Modal */}
      <RandomPhraseModal
        open={showRandomModal}
        onOpenChange={setShowRandomModal}
        phrase={randomPhrase}
        categories={categories}
        onNewRandom={handleNewRandomPhrase}
      />

      {/* Confirmación eliminar plan */}
      <AlertDialog open={deletingPlanId !== null} onOpenChange={open => { if (!open) setDeletingPlanId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar planificación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La planificación y su configuración se eliminarán permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingPlanId !== null) handleDeleteReviewPlan(deletingPlanId); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan Config Modal */}
      {configuringPlan && (
        <PlanConfigModal
          open={!!configuringPlan}
          onOpenChange={open => { if (!open) setConfiguringPlan(null); }}
          plan={configuringPlan}
          categories={categories}
          onSave={handleSavePlanConfig}
        />
      )}
    </div>
  );
}
