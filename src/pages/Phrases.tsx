import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Dices, Eye, Filter, Plus, RefreshCw, Settings } from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import PhraseCard from '@/components/phrases/PhraseCard';
import PhraseModal from '@/components/phrases/PhraseModal';
import ReviewModal from '@/components/phrases/ReviewModal';
import RandomPhraseModal from '@/components/phrases/RandomPhraseModal';
import { phrasesAPI } from '@/services/api';
import type { Phrase, PhraseCategory } from '@/types';
import { mockPhraseCategories } from '@/data/mockData';

interface ReviewPlan {
  id: string;
  name: string;
  targets: string[];
}

const REVIEW_PLANS_STORAGE_KEY = 'phrases.review-plans.v2';
const LEGACY_STUDY_PLANS_STORAGE_KEY = 'phrases.study-plans.v1';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [randomPhrase, setRandomPhrase] = useState<Phrase | null>(null);
  const [editingPhrase, setEditingPhrase] = useState<Phrase | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [reviewPhrases, setReviewPhrases] = useState<Phrase[]>([]);
  const [reviewSessionLabel, setReviewSessionLabel] = useState('Todas');
  const [reviewPlans, setReviewPlans] = useState<ReviewPlan[]>([]);
  const [planName, setPlanName] = useState('');
  const [targetToAdd, setTargetToAdd] = useState('');
  const [selectedPlanTargets, setSelectedPlanTargets] = useState<string[]>([]);

  // Cargar frases y categorías del backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Cargar categorías
        const categoriesData = await phrasesAPI.getCategoriesTree();
        const mappedCategories = categoriesData.map(mapBackendCategory);
        setCategories(mappedCategories);
        
        // Cargar TODAS las frases con paginación múltiple
        console.log('📖 Cargando frases...');
        const firstPage = await phrasesAPI.getPhrases(1, 100);
        console.log(`📊 Total frases en base de datos: ${firstPage.total}`);
        console.log(`📄 Total de páginas: ${firstPage.pages}`);
        
        let allPhrases = [...firstPage.items];
        
        // Si hay más páginas, cargarlas en paralelo
        if (firstPage.pages > 1) {
          const pagePromises = [];
          for (let page = 2; page <= firstPage.pages; page++) {
            pagePromises.push(phrasesAPI.getPhrases(page, 100));
          }
          const restPages = await Promise.all(pagePromises);
          allPhrases = [...allPhrases, ...restPages.flatMap(p => p.items)];
        }
        
        const mappedPhrases = allPhrases.map(mapBackendPhrase);
        console.log(`✅ Total frases cargadas: ${mappedPhrases.length}`);
        setPhrases(mappedPhrases);
      } catch (error) {
        console.error('Error loading phrases data:', error);
        // Usar mock data como fallback
        setCategories(mockPhraseCategories);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REVIEW_PLANS_STORAGE_KEY);
      const legacy = localStorage.getItem(LEGACY_STUDY_PLANS_STORAGE_KEY);
      const parsed = JSON.parse(saved || legacy || '[]');
      if (Array.isArray(parsed)) {
        const migrated: ReviewPlan[] = parsed
          .map((item: any) => {
            const hasTargetsArray = Array.isArray(item?.targets);
            if (hasTargetsArray) {
              return {
                id: String(item.id || `plan-${Date.now()}-${Math.random()}`),
                name: String(item.name || 'Planificación de repaso'),
                targets: Array.from(new Set(item.targets.filter((target: unknown) => typeof target === 'string'))),
              };
            }

            const legacyTargets = [item?.primaryTarget, item?.secondaryTarget].filter(
              (target: unknown) => typeof target === 'string' && target.length > 0,
            );
            if (legacyTargets.length === 0) return null;
            return {
              id: String(item.id || `plan-${Date.now()}-${Math.random()}`),
              name: String(item.name || 'Planificación de repaso'),
              targets: Array.from(new Set(legacyTargets)),
            };
          })
          .filter((item: ReviewPlan | null): item is ReviewPlan => Boolean(item));

        setReviewPlans(migrated);
      }
    } catch (error) {
      console.error('Error reading review plans from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(REVIEW_PLANS_STORAGE_KEY, JSON.stringify(reviewPlans));
    } catch (error) {
      console.error('Error saving review plans to localStorage:', error);
    }
  }, [reviewPlans]);

  // Filtrar frases según categoría y subcategoría seleccionadas
  const filtered = phrases.filter(p => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
    if (selectedSubcategory !== 'all' && p.subcategoryId !== selectedSubcategory) return false;
    return true;
  });

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

  const studyTargets = categories
    .filter(category => category.active)
    .flatMap(category => [
    { value: `cat:${category.id}`, label: `Categoría: ${category.name}` },
    ...category.subcategories
      .filter(sub => sub.active)
      .map(sub => ({
      value: `sub:${category.id}:${sub.id}`,
      label: `Subcategoría: ${category.name} / ${sub.name}`,
    })),
  ]);

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

  const openReviewSession = (items: Phrase[], label: string) => {
    setReviewPhrases(items);
    setReviewSessionLabel(label);
    setShowReviewModal(true);
  };

  const handleReview = (id: string) => {
    setPhrases(prev => prev.map(p =>
      p.id === id
        ? { ...p, reviewCount: p.reviewCount + 1, lastReviewedAt: new Date().toISOString() }
        : p
    ));
  };

  const handleReviewAll = () => {
    if (filteredActive.length === 0) return;
    const label =
      selectedCategory === 'all'
        ? 'Todas las categorías'
        : selectedSubcategory === 'all'
          ? (categories.find(c => c.id === selectedCategory)?.name || 'Categoría')
          : (currentSubcategory?.name || 'Subcategoría');
    openReviewSession(filteredActive, label);
  };

  const handleStartStudyReview = (plan: ReviewPlan) => {
    const activePhrases = phrases.filter(p => p.active);
    const selected = activePhrases.filter(p =>
      plan.targets.some(target => matchesTarget(p, target))
    );

    if (selected.length === 0) {
      alert('Esta planificación no tiene frases activas para repasar.');
      return;
    }

    openReviewSession(selected, `Planificación: ${plan.name}`);
  };

  const handleCreateReviewPlan = () => {
    if (!planName.trim()) {
      alert('El nombre de la planificación de repaso es obligatorio.');
      return;
    }

    if (selectedPlanTargets.length === 0) {
      alert('Selecciona al menos una categoría o subcategoría para crear la planificación.');
      return;
    }

    const newPlan: ReviewPlan = {
      id: `plan-${Date.now()}`,
      name: planName.trim(),
      targets: selectedPlanTargets,
    };

    setReviewPlans(prev => [newPlan, ...prev]);
    setPlanName('');
    setSelectedPlanTargets([]);
    setTargetToAdd('');
  };

  const handleRunDraftPlan = () => {
    if (selectedPlanTargets.length === 0) {
      alert('Selecciona una o más categorías/subcategorías para iniciar el repaso.');
      return;
    }

    const draftPlan: ReviewPlan = {
      id: 'draft',
      name: planName.trim() || 'Plan temporal',
      targets: selectedPlanTargets,
    };

    handleStartStudyReview(draftPlan);
  };

  const handleDeleteReviewPlan = (id: string) => {
    setReviewPlans(prev => prev.filter(plan => plan.id !== id));
  };

  const handleRandomPhrase = () => {
    if (filteredActive.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredActive.length);
    setRandomPhrase(filteredActive[randomIndex]);
    setShowRandomModal(true);
  };

  const handleNewRandomPhrase = () => {
    if (filteredActive.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredActive.length);
    setRandomPhrase(filteredActive[randomIndex]);
  };

  const getReviewButtonText = () => {
    if (filteredActive.length === 0) return 'Repasar';

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
    return `${text} (${filteredActive.length})`;
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
    } catch (error) {
      console.error('Error deleting phrase:', error);
      setPhrases(prev);
    }
  };

  const handleSavePhrase = (formData: any) => {
    if (editingPhrase) {
      // Editar frase existente
      setPhrases(prev => prev.map(p =>
        p.id === editingPhrase.id
          ? { ...p, ...formData }
          : p
      ));
    } else {
      // Crear nueva frase
      const newPhrase: Phrase = {
        id: `phrase-${Date.now()}`,
        ...formData,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      };
      setPhrases(prev => [...prev, newPhrase]);
    }
  };

  const handleEditFromReview = async (id: string, formData: any) => {
    setPhrases(prev => prev.map(p => p.id === id ? { ...p, ...formData } : p));
    try {
      await phrasesAPI.updatePhrase(id, {
        text: formData.text,
        author: formData.author || null,
        category_id: formData.categoryId ? parseInt(formData.categoryId) : null,
        subcategory_id: formData.subcategoryId ? parseInt(formData.subcategoryId) : null,
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
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Dices className="h-4 w-4" />
            Aleatoria
          </button>
          <button
            onClick={handleReviewAll}
            disabled={filtered.length === 0}
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
        <MetricCard title="Total" value={filtered.length} icon={BookOpen} color="primary" subtitle={`${filteredActive.length} activas`} />
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
          {showInactive ? 'Ocultar inactivas' : `Mostrar inactivas (${filteredInactive.length})`}
        </button>

        <span className="text-xs text-muted-foreground">{filteredVisible.length} frases</span>
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
            onClick={handleRunDraftPlan}
            disabled={selectedPlanTargets.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Iniciar repaso combinado
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
                    onClick={() => handleDeleteReviewPlan(plan.id)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
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

      {/* Phrase Modal */}
      <PhraseModal
        open={showPhraseModal}
        onOpenChange={setShowPhraseModal}
        phrase={editingPhrase}
        categories={categories}
        onSave={handleSavePhrase}
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
      />

      {/* Random Phrase Modal */}
      <RandomPhraseModal
        open={showRandomModal}
        onOpenChange={setShowRandomModal}
        phrase={randomPhrase}
        categories={categories}
        onNewRandom={handleNewRandomPhrase}
      />
    </div>
  );
}
