import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FolderOpen, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { GoalFolder } from '@/types';
import { goalFoldersAPI } from '@/services/api';

interface GoalFoldersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: GoalFolder[];
  onFoldersChange: (folders: GoalFolder[]) => void;
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function GoalFoldersModal({ open, onOpenChange, folders, onFoldersChange }: GoalFoldersModalProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [showNewForm, setShowNewForm] = useState(false);

  const startEdit = (f: GoalFolder) => {
    setEditingId(f.id);
    setEditName(f.nombre);
    setEditIcon(f.icono || '');
    setEditColor(f.color || COLORS[0]);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: number) => {
    const updated = await goalFoldersAPI.updateFolder(id, { nombre: editName.trim(), icono: editIcon || null, color: editColor });
    onFoldersChange(folders.map(f => f.id === id ? updated : f));
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const created = await goalFoldersAPI.createFolder({ nombre: newName.trim(), icono: newIcon || null, color: newColor });
    onFoldersChange([...folders, created]);
    setNewName('');
    setNewIcon('');
    setNewColor(COLORS[0]);
    setShowNewForm(false);
  };

  const handleDelete = async (id: number) => {
    await goalFoldersAPI.deleteFolder(id);
    onFoldersChange(folders.filter(f => f.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-background text-foreground sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <FolderOpen className="h-5 w-5 text-primary" />
            Carpetas de subobjetivos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {folders.length === 0 && !showNewForm && (
            <p className="text-sm text-muted-foreground text-center py-4">No hay carpetas aún.</p>
          )}
          {folders.map(f => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
              {editingId === f.id ? (
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input value={editIcon} onChange={e => setEditIcon(e.target.value)} placeholder="📁" maxLength={4} className="w-10 text-center text-lg bg-muted rounded-lg py-1 outline-none shrink-0" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 bg-muted rounded-lg px-2 py-1 text-sm outline-none" maxLength={100} autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                    <button onClick={() => saveEdit(f.id)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 shrink-0"><Check className="h-4 w-4" /></button>
                    <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex gap-1.5 pl-12">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)} className={`h-5 w-5 rounded-full transition-all ${editColor === c ? 'ring-2 ring-offset-1 ring-foreground/50 scale-110' : ''}`} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-lg w-7 text-center">{f.icono || '📁'}</span>
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ background: f.color || '#6366f1' }} />
                  <span className="flex-1 text-sm font-medium truncate">{f.nombre}</span>
                  <button onClick={() => startEdit(f)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(f.id)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              )}
            </div>
          ))}
        </div>

        {showNewForm ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2.5">
            <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="📁" maxLength={4} className="w-10 text-center text-lg bg-background rounded-lg py-1 outline-none border border-border" />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Nombre de la carpeta"
              autoFocus
              className="flex-1 bg-background rounded-lg px-2 py-1 text-sm outline-none border border-border"
              maxLength={100}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} className={`h-4 w-4 rounded-full transition-all ${newColor === c ? 'ring-2 ring-offset-1 ring-foreground/50 scale-110' : ''}`} style={{ background: c }} />
              ))}
            </div>
            <button onClick={handleCreate} disabled={!newName.trim()} className="p-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"><Check className="h-4 w-4" /></button>
            <button onClick={() => setShowNewForm(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 w-full justify-center rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva carpeta
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
