import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { PhraseCategory } from '@/types';

interface CategoryFormData {
  name: string;
  description: string;
  active: boolean;
}

const defaultForm: CategoryFormData = {
  name: '',
  description: '',
  active: true,
};

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: PhraseCategory | null;
  onSave: (data: CategoryFormData) => void;
}

export default function CategoryModal({ open, onOpenChange, category, onSave }: CategoryModalProps) {
  const isEditing = !!category;
  const [form, setForm] = useState<CategoryFormData>(defaultForm);

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        description: category.description || '',
        active: category.active,
      });
    } else {
      setForm(defaultForm);
    }
  }, [category, open]);

  const update = <K extends keyof CategoryFormData>(key: K, value: CategoryFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto border-border bg-background text-foreground p-0 gap-0 sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary px-6 pt-5 pb-4 rounded-t-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading font-bold text-primary-foreground">
              {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-foreground/75 mt-1">
              {isEditing
                ? 'Modifica los campos que desees y guarda los cambios.'
                : 'Completa los campos para crear una nueva categoría.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Nombre de la categoría */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Nombre de la categoría
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Ej: Motivación"
              className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              maxLength={100}
            />
          </div>

          {/* Descripción (opcional) */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Descripción (opcional)
            </label>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Describe de qué trata esta categoría..."
              className="w-full min-h-[100px] px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-y"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Máximo 500 caracteres. Esta descripción se mostrará al filtrar por esta categoría.
            </p>
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
            disabled={!form.name.trim()}
            className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Guardar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
