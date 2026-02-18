import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MessageSquareQuote } from 'lucide-react';
import type { Phrase, PhraseCategory } from '@/types';

interface PhraseFormData {
  text: string;
  author: string;
  categoryId: string;
  subcategoryId: string;
  notes: string;
  active: boolean;
}

const defaultForm: PhraseFormData = {
  text: '',
  author: '',
  categoryId: '',
  subcategoryId: '',
  notes: '',
  active: true,
};

interface PhraseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phrase?: Phrase | null;
  categories: PhraseCategory[];
  onSave: (data: PhraseFormData) => void;
}

export default function PhraseModal({ open, onOpenChange, phrase, categories, onSave }: PhraseModalProps) {
  const isEditing = !!phrase;
  const [form, setForm] = useState<PhraseFormData>(defaultForm);

  useEffect(() => {
    if (phrase) {
      setForm({
        text: phrase.text,
        author: phrase.author || '',
        categoryId: phrase.categoryId,
        subcategoryId: phrase.subcategoryId,
        notes: phrase.notes || '',
        active: phrase.active,
      });
    } else {
      setForm(defaultForm);
    }
  }, [phrase, open]);

  const update = <K extends keyof PhraseFormData>(key: K, value: PhraseFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCategoryChange = (categoryId: string) => {
    update('categoryId', categoryId);
    update('subcategoryId', ''); // Reset subcategory when category changes
  };

  const handleSubmit = () => {
    if (!form.text.trim()) return;
    if (!form.categoryId) {
      alert('Debes seleccionar una categoría');
      return;
    }
    if (!form.subcategoryId) {
      alert('Debes seleccionar una subcategoría');
      return;
    }
    onSave(form);
    onOpenChange(false);
  };

  const selectedCategory = categories.find(c => c.id === form.categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border bg-background text-foreground p-0 gap-0 sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary px-6 pt-5 pb-4 rounded-t-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading font-bold text-primary-foreground flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5" />
              {isEditing ? 'Editar Frase' : 'Agregar Nueva Frase'}
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-foreground/75 mt-1">
              {isEditing
                ? 'Modifica los campos que desees y guarda los cambios.'
                : 'Completa los campos para agregar una nueva frase inspiracional.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Frase */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Frase
            </label>
            <textarea
              value={form.text}
              onChange={e => update('text', e.target.value)}
              placeholder="Escribe la frase inspiracional..."
              className="w-full min-h-[100px] px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-y"
              maxLength={1000}
            />
          </div>

          {/* Autor (opcional) */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Autor (opcional)
            </label>
            <input
              type="text"
              value={form.author}
              onChange={e => update('author', e.target.value)}
              placeholder="Nombre del autor"
              className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              maxLength={200}
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Categoría
            </label>
            <select
              value={form.categoryId}
              onChange={e => handleCategoryChange(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              <option value="">Selecciona una categoría</option>
              {categories.filter(c => c.active).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Subcategoría */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Subcategoría
            </label>
            <select
              value={form.subcategoryId}
              onChange={e => update('subcategoryId', e.target.value)}
              disabled={!form.categoryId || subcategories.length === 0}
              className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Selecciona una subcategoría</option>
              {subcategories.filter(s => s.active).map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
            {form.categoryId && subcategories.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Esta categoría no tiene subcategorías activas
              </p>
            )}
          </div>

          {/* Notas personales (opcional) */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Notas personales (opcional)
            </label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="¿Por qué es importante esta frase para ti?"
              className="w-full min-h-[80px] px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-y"
              maxLength={500}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4 rounded-b-2xl">
          <button
            onClick={() => onOpenChange(false)}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.text.trim() || !form.categoryId || !form.subcategoryId}
            className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isEditing ? 'Guardar Cambios' : 'Guardar Frase'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
