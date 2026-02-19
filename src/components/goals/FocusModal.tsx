import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, Save, X, Bold, Italic, List, ListChecks, Code, Heading1, Heading2, Heading3 } from 'lucide-react';
import type { SubGoal, Goal } from '../../types';

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
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  
  const intervalRef = useRef<number | null>(null);
  const autoSaveRef = useRef<number | null>(null);
  const notesTimeoutRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cargar datos del subobjetivo
  useEffect(() => {
    if (open && subGoal) {
      setSeconds(subGoal.focusTimeSeconds || 0);
      setNotes(subGoal.notes || '');
      setTimerState('idle');
      setHasUnsavedChanges(false);
      setIsEditingNotes(false);
      setHeadingMenuOpen(false);
    }
  }, [open, subGoal]);

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

  const handleSave = (showNotification = true) => {
    if (!subGoal) return;
    
    onSave(subGoal.id, {
      focusTimeSeconds: seconds,
      notes: notes,
    });
    
    setHasUnsavedChanges(false);
    
    if (showNotification) {
      // Aquí podrías mostrar un toast de éxito
      console.log('Progreso guardado');
    }
  };

  const handleComplete = () => {
    if (!subGoal) return;
    
    // Pausar timer si está corriendo
    if (timerState === 'running') {
      setTimerState('paused');
    }
    
    // Guardar estado final
    onSave(subGoal.id, {
      focusTimeSeconds: seconds,
      notes: notes,
    });
    
    // Marcar como completado
    onComplete(subGoal.id);
    
    // Cerrar modal
    onOpenChange(false);
  };

  const handleClose = () => {
    // Pausar timer si está corriendo
    if (timerState === 'running') {
      setTimerState('paused');
    }
    
    // Guardar si hay cambios
    if (hasUnsavedChanges) {
      handleSave(false);
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

  // Editor de notas - funciones de formato
  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = notes.substring(start, end);
    const beforeText = notes.substring(0, start);
    const afterText = notes.substring(end);

    const newText = beforeText + prefix + selectedText + suffix + afterText;
    setNotes(newText);

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
    
    // Encontrar el inicio de la línea actual
    const beforeCursor = notes.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    
    const beforeText = notes.substring(0, lineStart);
    const lineAndAfter = notes.substring(lineStart);
    
    const newText = beforeText + linePrefix + lineAndAfter;
    setNotes(newText);

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
  const insertCheckbox = () => insertAtLine('- [ ] ');
  const insertBulletList = () => insertAtLine('- ');
  const insertCodeBlock = () => insertFormatting('\n```\n', '\n```\n');

  const insertHeading = (level: 1 | 2 | 3) => {
    const prefix = '#'.repeat(level) + ' ';
    insertAtLine(prefix);
    setHeadingMenuOpen(false);
  };

  // Renderizar markdown preview (simple)
  const renderPreview = (text: string) => {
    const lines = text.split('\n');
    const processedLines: string[] = [];
    
    for (let line of lines) {
      let processed = line;
      
      // Headers
      if (processed.startsWith('### ')) {
        processed = `<h3 class="text-lg font-semibold mb-2 mt-4">${processed.slice(4)}</h3>`;
      } else if (processed.startsWith('## ')) {
        processed = `<h2 class="text-xl font-semibold mb-2 mt-4">${processed.slice(3)}</h2>`;
      } else if (processed.startsWith('# ')) {
        processed = `<h1 class="text-2xl font-bold mb-3 mt-4">${processed.slice(2)}</h1>`;
      }
      // Checkboxes (marcado) - con o sin contenido
      else if (processed.match(/^-\s*\[x\]\s*(.*)$/i)) {
        const match = processed.match(/^-\s*\[x\]\s*(.*)$/i);
        if (match) {
          const content = match[1] || '';
          // Procesar bold e italic en el contenido
          let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
          formatted = formatted.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
          processed = `<div class="flex items-center gap-2 my-1"><input type="checkbox" checked disabled class="rounded border-gray-400 w-4 h-4" /><span class="line-through text-muted-foreground">${formatted || '&nbsp;'}</span></div>`;
        }
      }
      // Checkboxes (sin marcar) - con o sin contenido
      else if (processed.match(/^-\s*\[\s*\]\s*(.*)$/)) {
        const match = processed.match(/^-\s*\[\s*\]\s*(.*)$/);
        if (match) {
          const content = match[1] || '';
          // Procesar bold e italic en el contenido
          let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
          formatted = formatted.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
          processed = `<div class="flex items-center gap-2 my-1"><input type="checkbox" disabled class="rounded border-gray-400 w-4 h-4" /><span>${formatted || '&nbsp;'}</span></div>`;
        }
      }
      // Bullet lists
      else if (processed.startsWith('- ')) {
        let content = processed.slice(2);
        // Procesar bold e italic
        content = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
        content = content.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
        processed = `<li class="ml-4 my-1">${content}</li>`;
      }
      else {
        // Procesar bold e italic en texto normal
        processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
        processed = processed.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
        // Inline code
        processed = processed.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>');
      }
      
      processedLines.push(processed);
    }
    
    let html = processedLines.join('<br />');
    
    // Code blocks (después de unir líneas)
    html = html.replace(/```([^`]+)```/g, '<pre class="bg-muted p-3 rounded-lg my-2 overflow-x-auto"><code>$1</code></pre>');
    
    // Agrupar <li> consecutivos en <ul>
    html = html.replace(/(<li class="ml-4 my-1">.+?<\/li>(<br \/>)?)+/g, '<ul class="list-disc my-2 ml-2">$&</ul>');
    
    return html;
  };

  if (!open || !subGoal || !parentGoal) return null;

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
              <button
                onClick={() => handleSave(true)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Save className="h-4 w-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 h-[calc(100vh-180px)] flex items-center justify-center">
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
            <div className="relative rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-12 border border-blue-500/20">
              <div className="text-center">
                <div className="text-7xl font-mono font-bold text-foreground mb-4 tracking-tight" style={{ wordWrap: 'break-word', maxWidth: '100%' }}>
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
                onClick={() => {
                  setIsEditingNotes(prev => !prev);
                  if (isEditingNotes) {
                    setHeadingMenuOpen(false);
                  }
                }}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                {isEditingNotes ? 'Cerrar edición' : 'Editar'}
              </button>
            </div>
            <div className="space-y-3">
              {/* Preview (siempre visible primero) */}
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-h-[80px]">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Vista previa:</div>
                {notes.trim() ? (
                  <div 
                    className="prose prose-sm max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderPreview(notes) }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Aún no hay contenido para previsualizar.</p>
                )}
              </div>

              {isEditingNotes && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex items-center gap-0.5 p-2 border-b border-border bg-muted/30">
                    <button
                      onClick={toggleBold}
                      className="p-2 rounded hover:bg-accent transition-colors"
                      title="Negrita (Ctrl+B)"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={toggleItalic}
                      className="p-2 rounded hover:bg-accent transition-colors"
                      title="Cursiva (Ctrl+I)"
                    >
                      <Italic className="h-4 w-4" />
                    </button>

                    <div className="h-6 w-px bg-border mx-1" />

                    {/* Dropdown de encabezados */}
                    <div className="relative">
                      <button
                        onClick={() => setHeadingMenuOpen(!headingMenuOpen)}
                        className="p-2 rounded hover:bg-accent transition-colors flex items-center gap-1"
                        title="Encabezados"
                      >
                        <Heading1 className="h-4 w-4" />
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {headingMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setHeadingMenuOpen(false)}
                          />
                          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                            <button
                              onClick={() => insertHeading(1)}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                            >
                              <Heading1 className="h-4 w-4" />
                              Título 1
                            </button>
                            <button
                              onClick={() => insertHeading(2)}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                            >
                              <Heading2 className="h-4 w-4" />
                              Título 2
                            </button>
                            <button
                              onClick={() => insertHeading(3)}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                            >
                              <Heading3 className="h-4 w-4" />
                              Título 3
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="h-6 w-px bg-border mx-1" />

                    <button
                      onClick={insertCheckbox}
                      className="p-2 rounded hover:bg-accent transition-colors"
                      title="Checkbox"
                    >
                      <ListChecks className="h-4 w-4" />
                    </button>

                    <button
                      onClick={insertBulletList}
                      className="p-2 rounded hover:bg-accent transition-colors"
                      title="Lista con viñetas"
                    >
                      <List className="h-4 w-4" />
                    </button>

                    <div className="h-6 w-px bg-border mx-1" />

                    <button
                      onClick={insertCodeBlock}
                      className="p-2 rounded hover:bg-accent transition-colors"
                      title="Bloque de código"
                    >
                      <Code className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Escribe tus notas, ideas o reflexiones durante esta sesión de focus..."
                    className="w-full min-h-[120px] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-y bg-transparent"
                    maxLength={2000}
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {notes.length}/2000 caracteres • Se guarda automáticamente
              </p>
            </div>
          </div>
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
