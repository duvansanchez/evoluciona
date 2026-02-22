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

  const handleReview = (id: string) => {
    setPhrases(prev => prev.map(p =>
      p.id === id
        ? { ...p, reviewCount: p.reviewCount + 1, lastReviewedAt: new Date().toISOString() }
        : p
    ));
  };

  const handleReviewAll = () => {
    if (filteredActive.length === 0) return;
    setShowReviewModal(true);
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

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Frases Inspiracionales</h1>
          <p className="text-sm text-muted-foreground mt-1">Tu colección de sabiduría para el crecimiento personal</p>
        </div>
        <div className="flex items-center gap-2 self-start">
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
        phrases={filteredActive}
        categories={categories}
        onReview={handleReview}
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
