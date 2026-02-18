import { Edit2, Eye, EyeOff, MessageSquareQuote, RefreshCw, Trash2 } from 'lucide-react';
import type { Phrase, PhraseCategory } from '@/types';
import { useState } from 'react';

interface PhraseCardProps {
  phrase: Phrase;
  categories: PhraseCategory[];
  onReview?: (id: string) => void;
}

export default function PhraseCard({ phrase, categories, onReview }: PhraseCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const category = categories.find(c => c.id === phrase.categoryId);
  const subcategory = category?.subcategories.find(s => s.id === phrase.subcategoryId);

  const timeAgo = phrase.lastReviewedAt
    ? new Date(phrase.lastReviewedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : 'Nunca';

  return (
    <div className={`group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md ${
      !phrase.active ? 'opacity-50' : 'hover:border-primary/30'
    }`}>
      {/* Quote */}
      <div className="relative">
        <MessageSquareQuote className="absolute -top-1 -left-1 h-5 w-5 text-primary/20" />
        <p className="pl-5 text-sm leading-relaxed text-foreground italic">
          "{phrase.text}"
        </p>
      </div>

      {/* Author */}
      {phrase.author && (
        <p className="mt-2 text-xs font-medium text-muted-foreground">— {phrase.author}</p>
      )}

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {category && (
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {category.name}
          </span>
        )}
        {subcategory && (
          <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            {subcategory.name}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{phrase.reviewCount} repasos</span>
        <span>·</span>
        <span>Último: {timeAgo}</span>
      </div>

      {/* Notes */}
      {phrase.notes && (
        <>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="mt-2 text-[11px] text-primary hover:underline"
          >
            {showNotes ? 'Ocultar notas' : 'Ver notas'}
          </button>
          {showNotes && (
            <p className="mt-1.5 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground animate-fade-in">
              {phrase.notes}
            </p>
          )}
        </>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
        <button
          onClick={() => onReview?.(phrase.id)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Repasar
        </button>
        <div className="flex-1" />
        <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
          {phrase.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
