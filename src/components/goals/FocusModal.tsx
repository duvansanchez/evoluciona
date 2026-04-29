import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, X, Bold, Italic, List, ListChecks, Code, Heading1, Heading2, Heading3, Minus, Pencil, ChevronRight, VolumeX } from 'lucide-react';
import type { SubGoal, Goal } from '../../types';
import { renderMarkdownPreview } from '@/utils/markdownPreview';

interface FocusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subGoal: SubGoal | null;
  parentGoal: Goal | null;
  onSave: (subGoalId: string, updates: Partial<SubGoal>) => void;
  onComplete: (subGoalId: string) => void;
}

type TimerState = 'idle' | 'running' | 'paused';

export default function FocusModal({ open, onOpenChange, subGoal, parentGoal, onSave, onComplete }: FocusModalProps) {
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  
  const intervalRef = useRef<number | null>(null);
  const autoSaveRef = useRef<number | null>(null);
  const notesTimeoutRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorDialogRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(open);
  const reminderUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isReminderSpeaking, setIsReminderSpeaking] = useState(false);

  const getYearEndReminder = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    const diffMs = endOfYear.getTime() - today.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    if (daysLeft === 0) {
      return 'Hoy termina el año. Aprovecha este último día para avanzar en tus metas.';
    }
    if (daysLeft === 1) {
      return 'Queda un día para terminar el año. Enfócate y termina fuerte tus metas de hoy.';
    }
    return `Quedan ${daysLeft} días para terminar el año. Enfócate y avanza con tus metas de hoy.`;
  };

  const stopYearReminderSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    reminderUtteranceRef.current = null;
    setIsReminderSpeaking(false);
  };

  // Cargar datos del subobjetivo
  useEffect(() => {
    if (open && subGoal) {
      setSeconds(subGoal.focusTimeSeconds || 0);
      setNotes(subGoal.notes || '');
      setTimerState('idle');
      setHasUnsavedChanges(false);
      if (!prevOpenRef.current) {
        setIsEditingNotes(false);
      }
      setHeadingMenuOpen(false);
      setEditDraft('');
    }
    prevOpenRef.current = open;
  }, [open, subGoal?.id]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const reminder = getYearEndReminder();
    stopYearReminderSpeech();
    const utterance = new SpeechSynthesisUtterance(reminder);
    utterance.lang = 'es-CO';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setIsReminderSpeaking(false);
    utterance.onerror = () => setIsReminderSpeaking(false);
    reminderUtteranceRef.current = utterance;
    setIsReminderSpeaking(true);
    window.speechSynthesis.speak(utterance);

    return () => {
      stopYearReminderSpeech();
    };
  }, [open]);

  // Timer logic
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = window.setInterval(() => {
        setSeconds(prev => prev + 1);
        setHasUnsavedChanges(true);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState]);

  // Auto-save periódico (cada 30 segundos cuando está corriendo)
  useEffect(() => {
    if (timerState === 'running' && hasUnsavedChanges) {
      autoSaveRef.current = window.setInterval(() => {
        handleSave(false);
      }, 30000); // 30 segundos
    } else {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    }

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [timerState, hasUnsavedChanges]);

  // Auto-save de notas con debounce
  useEffect(() => {
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    if (notes !== (subGoal?.notes || '')) {
      setHasUnsavedChanges(true);
      notesTimeoutRef.current = window.setTimeout(() => {
        handleSave(false);
      }, 2000); // 2 segundos después de dejar de escribir
    }

    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, [notes]);

  const handleStart = () => {
    setTimerState('running');
  };

  const handlePause = () => {
    setTimerState('paused');
    handleSave(false);
  };

  const handleReset = () => {
    if (confirm('¿Estás seguro de reiniciar el timer? Se perderá el tiempo actual.')) {
      setSeconds(0);
      setTimerState('idle');
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = (showNotification = true, notesOverride?: string) => {
    if (!subGoal) return;

    onSave(subGoal.id, {
      focusTimeSeconds: seconds,
      notes: notesOverride ?? notes,
    });

    setHasUnsavedChanges(false);

    if (showNotification) {
      console.log('Progreso guardado');
    }
  };

  const handleComplete = () => {
    if (!subGoal) return;

    if (timerState === 'running') {
      setTimerState('paused');
    }

    // Si el editor está abierto, usar editDraft como fuente de verdad
    const notesToSave = isEditingNotes ? editDraft : notes;
    onSave(subGoal.id, {
      focusTimeSeconds: seconds,
      notes: notesToSave,
    });

    onComplete(subGoal.id);
    onOpenChange(false);
  };

  const handleClose = () => {
    if (timerState === 'running') {
      setTimerState('paused');
    }

    // Si el editor está abierto, usar editDraft como fuente de verdad
    const notesToSave = isEditingNotes ? editDraft : notes;
    if (hasUnsavedChanges || isEditingNotes) {
      handleSave(false, notesToSave);
    }

    onOpenChange(false);
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const openEditor = () => {
    setEditDraft(notes);
    setIsEditingNotes(true);
  };

  const closeEditor = (save: boolean) => {
    if (save) {
      setNotes(editDraft);
      setHasUnsavedChanges(true);
      handleSave(false, editDraft);
    }
    setIsEditingNotes(false);
    setHeadingMenuOpen(false);
    setColorMenuOpen(false);
  };

  const handleEditorBlur = () => {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (editorDialogRef.current?.contains(activeElement)) return;
      closeEditor(true);
    }, 0);
  };

  // Editor de notas - funciones de formato (operan sobre editDraft)
  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editDraft.substring(start, end);
    const beforeText = editDraft.substring(0, start);
    const afterText = editDraft.substring(end);

    const newText = beforeText + prefix + selectedText + suffix + afterText;
    setEditDraft(newText);

    // Restaurar focus y selección
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        end + prefix.length
      );
    }, 0);
  };

  const insertAtLine = (linePrefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const beforeCursor = editDraft.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;

    const beforeText = editDraft.substring(0, lineStart);
    const lineAndAfter = editDraft.substring(lineStart);

    const newText = beforeText + linePrefix + lineAndAfter;
    setEditDraft(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + linePrefix.length,
        end + linePrefix.length
      );
    }, 0);
  };

  const toggleBold = () => insertFormatting('**');
  const toggleItalic = () => insertFormatting('*');
  const insertCheckbox = () => insertAtLine('- [] ');
  const insertChildCheckbox = () => insertAtLine('  - [] ');
  const insertBulletList = () => insertAtLine('- ');
  const insertCodeBlock = () => insertFormatting('\n```\n', '\n```\n');
  const insertDivider = () => insertAtLine('\n---\n');
  const insertToggle = () => insertAtLine('> ');

  const handleNotesKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;

    event.preventDefault();

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = editDraft;

    const hasSelection = start !== end;

    if (!hasSelection) {
      const lineStart = currentText.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineEndIndex = currentText.indexOf('\n', start);
      const lineEnd = lineEndIndex === -1 ? currentText.length : lineEndIndex;
      const lineText = currentText.slice(lineStart, lineEnd);

      if (event.shiftKey) {
        let removeCount = 0;
        if (lineText.startsWith('  ')) removeCount = 2;
        else if (lineText.startsWith(' ') || lineText.startsWith('\t')) removeCount = 1;
        if (removeCount === 0) return;

        const updatedLine = lineText.slice(removeCount);
        const newText = currentText.slice(0, lineStart) + updatedLine + currentText.slice(lineEnd);
        const newCursor = Math.max(lineStart, start - removeCount);

        setEditDraft(newText);
        window.setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursor, newCursor);
        }, 0);
        return;
      }

      const updatedLine = `  ${lineText}`;
      const newText = currentText.slice(0, lineStart) + updatedLine + currentText.slice(lineEnd);
      const newCursor = start + 2;

      setEditDraft(newText);
      window.setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
      }, 0);
      return;
    }

    const lineStart = currentText.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const effectiveEnd = end > start && currentText[end - 1] === '\n' ? end - 1 : end;
    const lineEndIndex = currentText.indexOf('\n', effectiveEnd);
    const lineEnd = lineEndIndex === -1 ? currentText.length : lineEndIndex;

    const selectedBlock = currentText.slice(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');
    if (lines.length === 0) return;

    let transformedLines: string[];
    let newStart = start;
    let newEnd = end;

    if (event.shiftKey) {
      const removedPerLine = lines.map(line => {
        if (line.startsWith('  ')) return 2;
        if (line.startsWith(' ') || line.startsWith('\t')) return 1;
        return 0;
      });

      transformedLines = lines.map((line, index) => line.slice(removedPerLine[index]));

      const removedFromFirstLine = removedPerLine[0] || 0;
      const removedTotal = removedPerLine.reduce((sum, count) => sum + count, 0);

      newStart = Math.max(lineStart, start - removedFromFirstLine);
      newEnd = Math.max(newStart, end - removedTotal);
    } else {
      transformedLines = lines.map(line => `  ${line}`);
      const addedTotal = lines.length * 2;

      newStart = start + 2;
      newEnd = end + addedTotal;
    }

    const updatedBlock = transformedLines.join('\n');
    const newText = currentText.slice(0, lineStart) + updatedBlock + currentText.slice(lineEnd);

    setEditDraft(newText);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  const insertHeading = (level: 1 | 2 | 3) => {
    const prefix = '#'.repeat(level) + ' ';
    insertAtLine(prefix);
    setHeadingMenuOpen(false);
  };

  const insertHighlight = (color: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editDraft.substring(start, end) || 'texto resaltado';
    const beforeText = editDraft.substring(0, start);
    const afterText = editDraft.substring(end);

    const newText = beforeText + `{${color}:${selectedText}}` + afterText;
    setEditDraft(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + color.length + 2, start + color.length + 2 + selectedText.length);
    }, 0);
    setColorMenuOpen(false);
  };

  const renderPreview = renderMarkdownPreview;

  if (!open || !subGoal || !parentGoal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in overflow-y-auto">
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
                Salir
              </button>
              <div className="h-6 w-px bg-border" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Modo Focus</h2>
                <p className="text-xs text-muted-foreground">
                  {parentGoal.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-500 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Cambios sin guardar
                </span>
              )}
              {isReminderSpeaking && (
                <button
                  onClick={stopYearReminderSpeech}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                  title="Parar lectura"
                >
                  <VolumeX className="h-4 w-4" />
                  Parar voz
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 min-h-[calc(100vh-180px)] py-8 flex items-start justify-center">
        <div className="w-full max-w-3xl">
          {/* Subgoal Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {subGoal.title}
            </h1>
            {subGoal.priority && (
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                subGoal.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                subGoal.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                Prioridad {subGoal.priority === 'high' ? 'Alta' : subGoal.priority === 'medium' ? 'Media' : 'Baja'}
              </span>
            )}
          </div>

          {/* Timer Display */}
          <div className="mb-8">
            <div className="relative rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-12 border border-blue-500/20 overflow-hidden">
              <div className="text-center">
                <div className="text-7xl font-mono font-bold text-foreground mb-4 tracking-tight" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>
                  {formatTime(seconds)}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {timerState === 'idle' || timerState === 'paused' ? (
                    <button
                      onClick={handleStart}
                      className="flex items-center gap-2 rounded-xl bg-green-600 px-8 py-4 text-lg font-semibold text-white hover:bg-green-700 transition-all shadow-lg hover:scale-105"
                    >
                      <Play className="h-6 w-6" />
                      {timerState === 'idle' ? 'Iniciar' : 'Reanudar'}
                    </button>
                  ) : (
                    <button
                      onClick={handlePause}
                      className="flex items-center gap-2 rounded-xl bg-amber-600 px-8 py-4 text-lg font-semibold text-white hover:bg-amber-700 transition-all shadow-lg hover:scale-105"
                    >
                      <Pause className="h-6 w-6" />
                      Pausar
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    disabled={seconds === 0}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-4 text-lg font-medium text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Reiniciar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-foreground">
                Notas de la sesión
              </label>
              <button
                type="button"
                onClick={openEditor}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            </div>

            {/* Preview (siempre visible) */}
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-h-[80px]">
              {notes.trim() ? (
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: renderPreview(notes) }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Sin notas aún. Haz clic en "Editar" para agregar contenido.</p>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {notes.length}/10000 caracteres • Se guarda automáticamente
            </p>
          </div>

          {/* Editor dialog (modal superpuesto) */}
          {isEditingNotes && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => closeEditor(true)} />
              <div ref={editorDialogRef} className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col h-[88vh]">
                {/* Dialog header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                  <span className="text-sm font-semibold text-foreground">Editar notas</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => closeEditor(true)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted/30 shrink-0">
                  <button onClick={toggleBold} className="p-2 rounded hover:bg-accent transition-colors" title="Negrita"><Bold className="h-4 w-4" /></button>
                  <button onClick={toggleItalic} className="p-2 rounded hover:bg-accent transition-colors" title="Cursiva"><Italic className="h-4 w-4" /></button>
                  <div className="h-6 w-px bg-border mx-1" />

                  {/* Encabezados */}
                  <div className="relative">
                    <button onClick={() => setHeadingMenuOpen(!headingMenuOpen)} className="p-2 rounded hover:bg-accent transition-colors flex items-center gap-1" title="Encabezados">
                      <Heading1 className="h-4 w-4" />
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {headingMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setHeadingMenuOpen(false)} />
                        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                          <button onClick={() => insertHeading(1)} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"><Heading1 className="h-4 w-4" />Título 1</button>
                          <button onClick={() => insertHeading(2)} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"><Heading2 className="h-4 w-4" />Título 2</button>
                          <button onClick={() => insertHeading(3)} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"><Heading3 className="h-4 w-4" />Título 3</button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="h-6 w-px bg-border mx-1" />

                  {/* Colores */}
                  <div className="relative">
                    <button onClick={() => setColorMenuOpen(!colorMenuOpen)} className="p-2 rounded hover:bg-accent transition-colors flex items-center gap-1" title="Resaltar">
                      <span className="text-xs font-bold">🎨</span>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {colorMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setColorMenuOpen(false)} />
                        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-2 px-2 z-20 grid grid-cols-3 gap-2 w-max">
                          {(['yellow','pink','blue','green','purple','orange','red'] as const).map(c => (
                            <button key={c} onClick={() => insertHighlight(c)} className={`w-6 h-6 rounded bg-${c}-200 hover:ring-2 ring-foreground transition-all`} title={c} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="h-6 w-px bg-border mx-1" />
                  <button onClick={insertCheckbox} className="p-2 rounded hover:bg-accent transition-colors" title="Checkbox"><ListChecks className="h-4 w-4" /></button>
                  <button onClick={insertChildCheckbox} className="p-2 rounded hover:bg-accent transition-colors" title="Checkbox hijo"><span className="text-xs font-semibold">↳</span></button>
                  <button onClick={insertBulletList} className="p-2 rounded hover:bg-accent transition-colors" title="Lista"><List className="h-4 w-4" /></button>
                  <div className="h-6 w-px bg-border mx-1" />
                  <button onClick={insertCodeBlock} className="p-2 rounded hover:bg-accent transition-colors" title="Código"><Code className="h-4 w-4" /></button>
                  <button onClick={insertDivider} className="p-2 rounded hover:bg-accent transition-colors" title="Divisor"><Minus className="h-4 w-4" /></button>
                  <button onClick={insertToggle} className="p-2 rounded hover:bg-accent transition-colors" title="Desplegable"><ChevronRight className="h-4 w-4" /></button>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={handleEditorBlur}
                  onKeyDown={handleNotesKeyDown}
                  placeholder="Escribe tus notas, ideas o reflexiones..."
                  className="flex-1 min-h-0 w-full px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none bg-transparent overflow-y-auto"
                  maxLength={10000}
                  autoFocus
                />
                <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border shrink-0">
                  {editDraft.length}/10000 caracteres
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={handleClose}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cerrar sin completar
            </button>
            
            <button
              onClick={handleComplete}
              className="flex-1 max-w-md flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-lg"
            >
              <CheckCircle2 className="h-5 w-5" />
              Marcar como Completado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
