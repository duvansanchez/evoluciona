import { useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareQuote, X } from 'lucide-react';
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
  const [showNotes, setShowNotes] = useState(false);

  if (!open || phrases.length === 0) return null;

  const currentPhrase = phrases[currentIndex];
  const category = categories.find(c => c.id === currentPhrase.categoryId);
  const subcategory = category?.subcategories.find(s => s.id === currentPhrase.subcategoryId);

  const handleNext = () => {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowNotes(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowNotes(false);
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
    setCurrentIndex(0);
    setShowNotes(false);
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

      {/* Main Content */}
      <div className="container mx-auto px-4 h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="w-full max-w-3xl">
          {/* Quote Card */}
          <div className="relative mb-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-12 shadow-lg border border-blue-100 dark:border-blue-900/30">
            <MessageSquareQuote className="absolute top-6 left-6 h-12 w-12 text-blue-300 dark:text-blue-700 opacity-50" />
            <div className="relative z-10">
              <p className="text-2xl md:text-3xl leading-relaxed text-foreground italic font-light text-center mb-6">
                "{currentPhrase.text}"
              </p>
              {currentPhrase.author && (
                <p className="text-base font-medium text-muted-foreground text-right">
                  — {currentPhrase.author}
                </p>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex justify-center gap-2 mb-6">
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
            <div className="mb-8 text-center">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="text-sm text-primary hover:underline mb-3"
              >
                {showNotes ? 'Ocultar notas personales' : 'Ver notas personales'}
              </button>
              {showNotes && (
                <div className="rounded-xl bg-muted/50 p-6 text-sm text-muted-foreground animate-fade-in max-w-2xl mx-auto">
                  {currentPhrase.notes}
                </div>
              )}
            </div>
          )}
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
