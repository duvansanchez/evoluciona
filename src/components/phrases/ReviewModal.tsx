import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareQuote, NotebookPen, X } from 'lucide-react';
import type { Phrase, PhraseCategory } from '../../types';

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phrases: Phrase[];
  categories: PhraseCategory[];
  onReview: (id: string) => void;
}

export default function ReviewModal({ open, onOpenChange, phrases, categories, onReview }: ReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setShowNotes(true);
    }
  }, [open]);

  if (!open || phrases.length === 0) return null;

  const currentPhrase = phrases[currentIndex];
  const category = categories.find(c => c.id === currentPhrase.categoryId);
  const subcategory = category?.subcategories.find(s => s.id === currentPhrase.subcategoryId);

  const handleNext = () => {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleMarkAsReviewed = () => {
    onReview(currentPhrase.id);
    if (currentIndex < phrases.length - 1) {
      handleNext();
    } else {
      // Última frase, cerrar modal
      onOpenChange(false);
      setCurrentIndex(0);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
                Terminar
              </button>
              <div className="h-6 w-px bg-border" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Sesión de Repaso</h2>
                <p className="text-xs text-muted-foreground">
                  Repasando frases de: {category?.name || 'Todas'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progreso</p>
              <p className="text-sm font-semibold text-foreground">
                {currentIndex + 1} de {phrases.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / phrases.length) * 100}%` }}
        />
      </div>

      {/* Main Content — scrollable, deja espacio para la barra fija inferior */}
      <div className="h-[calc(100vh-88px)] overflow-y-auto">
        <div className="container mx-auto px-4 py-8 pb-28">
          <div className="w-full max-w-3xl mx-auto">
            {/* Quote Card */}
            <div className="relative mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-8 shadow-lg border border-blue-100 dark:border-blue-900/30">
              <MessageSquareQuote className="absolute top-5 left-5 h-10 w-10 text-blue-300 dark:text-blue-700 opacity-50" />
              <div className="relative z-10">
                <p className="text-xl md:text-2xl leading-relaxed text-foreground italic font-light text-center mb-4">
                  "{currentPhrase.text}"
                </p>
                {currentPhrase.author && (
                  <p className="text-sm font-medium text-muted-foreground text-right">
                    — {currentPhrase.author}
                  </p>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex justify-center gap-2 mb-5">
              {category && (
                <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                  {category.name}
                </span>
              )}
              {subcategory && (
                <span className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground">
                  {subcategory.name}
                </span>
              )}
            </div>

            {/* Notes */}
            {currentPhrase.notes && (
              <div className="max-w-2xl mx-auto">
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <NotebookPen className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Notas personales</span>
                    </div>
                    <button
                      onClick={() => setShowNotes(!showNotes)}
                      className="text-xs text-primary hover:underline"
                    >
                      {showNotes ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  {showNotes && (
                    <div className="px-5 py-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap animate-fade-in">
                      {currentPhrase.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            
            <button
              onClick={handleMarkAsReviewed}
              className="flex-1 max-w-md rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-lg"
            >
              {currentIndex < phrases.length - 1 ? '✓ Repasada' : '✓ Finalizar Repaso'}
            </button>

            <button
              onClick={handleNext}
              disabled={currentIndex === phrases.length - 1}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
