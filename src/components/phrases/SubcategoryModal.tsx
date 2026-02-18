import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import type { PhraseCategory, PhraseSubcategory } from '@/types';

interface SubcategoryFormData {
  name: string;
  description: string;
  active: boolean;
}

const defaultForm: SubcategoryFormData = {
  name: '',
  description: '',
  active: true,
};

interface SubcategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: PhraseCategory | null;
  subcategory?: PhraseSubcategory | null;
  onSave: (data: SubcategoryFormData) => void;
}

export default function SubcategoryModal({ open, onOpenChange, category, subcategory, onSave }: SubcategoryModalProps) {
  const isEditing = !!subcategory;
  const [form, setForm] = useState<SubcategoryFormData>(defaultForm);

  useEffect(() => {
    if (subcategory) {
      setForm({
        name: subcategory.name,
        description: subcategory.description || '',
        active: subcategory.active,
      });
    } else {
      setForm(defaultForm);
    }
  }, [subcategory, open]);

  const update = <K extends keyof SubcategoryFormData>(key: K, value: SubcategoryFormData[K]) => {
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
              {isEditing ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-foreground/75 mt-1">
              {isEditing
                ? 'Modifica los campos que desees y guarda los cambios.'
                : `Crea una nueva subcategoría para "${category?.name}".`}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Nombre de la subcategoría */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Nombre de la subcategoría
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Ej: Aprendizaje"
              className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              maxLength={100}
            />
          </div>

          {/* Categoría (solo lectura) */}
          {category && (
            <div>
              <label className="block mb-2 text-sm font-semibold text-primary">
                Categoría
              </label>
              <input
                type="text"
                value={category.name}
                disabled
                className="w-full px-4 py-3 rounded-lg border-2 border-input bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          )}

          {/* Descripción (opcional) */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-primary">
              Descripción (opcional)
            </label>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Describe de qué trata esta subcategoría..."
              className="w-full min-h-[100px] px-4 py-3 rounded-lg border-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-y"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Máximo 500 caracteres. Esta descripción se mostrará al filtrar por esta subcategoría.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-border bg-background px-6 py-4 rounded-b-2xl">
          {isEditing && (
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de eliminar esta subcategoría?')) {
                  // Esta funcionalidad se manejará desde el componente padre
                  onOpenChange(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-destructive hover:bg-destructive/10 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          )}
          <div className={`flex items-center gap-3 ${!isEditing ? 'ml-auto' : ''}`}>
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
              {isEditing ? 'Guardar Cambios' : 'Guardar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
