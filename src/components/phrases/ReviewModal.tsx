import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareQuote, NotebookPen, Pencil, Pause, Play, Repeat, Settings2, Square, Trash2, X } from 'lucide-react';
import type { Phrase, PhraseCategory, PhraseFeedback } from '../../types';
import PhraseModal from './PhraseModal';
import { phrasesAPI } from '@/services/api';
import { getLocalDateString } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DEFAULT_AUDIO_RATE = 1;
const DEFAULT_AUDIO_PITCH = 1;
const DEFAULT_AUDIO_PAUSE_MS = 700;

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phrases: Phrase[];
  categories: PhraseCategory[];
  onReview: (id: string) => Promise<void> | void;
  onEdit: (id: string, formData: any) => void;
  sessionLabel?: string;
  initialAudioMode?: 'off' | 'manual' | 'continuous' | 'loop';
  initialLoopCycles?: number;
  initialLoopShuffle?: boolean;
}

export default function ReviewModal({
  open,
  onOpenChange,
  phrases,
  categories,
  onReview,
  onEdit,
  sessionLabel,
  initialAudioMode = 'off',
  initialLoopCycles = 2,
  initialLoopShuffle = false,
}: ReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [badgePopKey, setBadgePopKey] = useState(0);
  const [, setPendingReviewCount] = useState(0);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioProvider, setAudioProvider] = useState<'browser' | 'elevenlabs' | 'edge'>('browser');
  const [serviceVoiceName, setServiceVoiceName] = useState<string | null>(null);
  const [audioStatusLoading, setAudioStatusLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [continuousAudioEnabled, setContinuousAudioEnabled] = useState(initialAudioMode === 'continuous');
  const [loopAudioEnabled, setLoopAudioEnabled] = useState(initialAudioMode === 'loop');
  const [loopCycleCount, setLoopCycleCount] = useState(initialLoopCycles);
  const [loopShuffleEachCycle, setLoopShuffleEachCycle] = useState(initialLoopShuffle);
  const [completedLoopCycles, setCompletedLoopCycles] = useState(1);
  const [sessionPhrases, setSessionPhrases] = useState<Phrase[]>(phrases);
  const [voicesLoaded, setVoicesLoaded] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [audioRate, setAudioRate] = useState(DEFAULT_AUDIO_RATE);
  const [audioPitch, setAudioPitch] = useState(DEFAULT_AUDIO_PITCH);
  const [audioPauseMs, setAudioPauseMs] = useState(DEFAULT_AUDIO_PAUSE_MS);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showLoopSetup, setShowLoopSetup] = useState(false);
  const [feedbackDate, setFeedbackDate] = useState(getLocalDateString());
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackModalError, setFeedbackModalError] = useState<string | null>(null);
  const [feedbackSidebarError, setFeedbackSidebarError] = useState<string | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<Record<string, PhraseFeedback[]>>({});
  const [feedbackHistoryLoading, setFeedbackHistoryLoading] = useState(false);
  const [deletingFeedbackDate, setDeletingFeedbackDate] = useState<string | null>(null);
  const prevCategoryRef = useRef<{ categoryId: string | undefined; subcategoryId: string | undefined } | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const audioRequestIdRef = useRef(0);
  const continuousAudioEnabledRef = useRef(continuousAudioEnabled);
  const loopAudioEnabledRef = useRef(loopAudioEnabled);
  const currentIndexRef = useRef(currentIndex);
  const phrasesLengthRef = useRef(sessionPhrases.length);
  const openRef = useRef(open);
  const showEditModalRef = useRef(showEditModal);
  const reviewedPhraseIdsRef = useRef<Set<string>>(new Set());
  const originalPhrasesRef = useRef<Phrase[]>(phrases);

  const shufflePhrases = (items: Phrase[]) => {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
    }
    return next;
  };

  const mapFeedbacks = (items: Array<{ id: string; phrase_id: string; date: string; text: string; created_at?: string | null; updated_at?: string | null }>) => {
    return items.reduce((acc, item) => {
      acc[item.phrase_id] = {
        id: item.id,
        phraseId: item.phrase_id,
        date: item.date,
        text: item.text,
        createdAt: item.created_at || undefined,
        updatedAt: item.updated_at || undefined,
      };
      return acc;
    }, {} as Record<string, PhraseFeedback>);
  };

  const mapFeedbackList = (items: Array<{ id: string; phrase_id: string; date: string; text: string; created_at?: string | null; updated_at?: string | null }>) => {
    return items.map((item) => ({
      id: item.id,
      phraseId: item.phrase_id,
      date: item.date,
      text: item.text,
      createdAt: item.created_at || undefined,
      updatedAt: item.updated_at || undefined,
    }));
  };

  const availableSpanishVoices = useMemo(
    () => voicesLoaded.filter(voice => voice.lang.toLowerCase().startsWith('es')),
    [voicesLoaded],
  );

  const persistAudioPreferences = async (payload: {
    selected_voice_name?: string | null;
    rate?: number;
    pitch?: number;
    pause_ms?: number;
  }) => {
    try {
      await phrasesAPI.updateAudioPreferences(payload);
    } catch (error) {
      console.error('Error saving phrase audio preferences:', error);
    }
  };

  const preferredVoice = useMemo(() => {
    if (voicesLoaded.length === 0) return null;

    if (selectedVoiceName) {
      const selectedVoice = voicesLoaded.find(voice => voice.name === selectedVoiceName);
      if (selectedVoice) return selectedVoice;
    }

    if (availableSpanishVoices.length === 0) return null;

    const preferredPatterns = [
      /es-CO/i,
      /es-MX/i,
      /es-ES/i,
      /natural/i,
      /google/i,
      /helena|elvira|dalia|laura|sabina/i,
    ];

    for (const pattern of preferredPatterns) {
      const match = availableSpanishVoices.find(voice => pattern.test(voice.lang) || pattern.test(voice.name));
      if (match) return match;
    }

    return availableSpanishVoices.find(voice => voice.default) || availableSpanishVoices[0];
  }, [availableSpanishVoices, selectedVoiceName, voicesLoaded]);

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    utteranceRef.current = null;
    audioRequestIdRef.current += 1;
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const buildAudioScript = (phrase: Phrase) => {
    const phraseText = phrase.text?.trim() ?? '';
    const notesText = phrase.notes?.trim() ?? '';

    if (!notesText) return phraseText;

    return `${phraseText}. ${notesText}`;
  };

  const markPhraseAsReviewed = async (phraseId: string) => {
    if (reviewedPhraseIdsRef.current.has(phraseId)) return;
    reviewedPhraseIdsRef.current.add(phraseId);
    try {
      await onReview(phraseId);
    } catch (error) {
      reviewedPhraseIdsRef.current.delete(phraseId);
      throw error;
    }
  };

  const queueNextPhraseAfterPlayback = () => {
    if ((!continuousAudioEnabledRef.current && !loopAudioEnabledRef.current) || showEditModalRef.current || !openRef.current) return;

    window.setTimeout(async () => {
      if ((!continuousAudioEnabledRef.current && !loopAudioEnabledRef.current) || showEditModalRef.current || !openRef.current) return;

      const currentPhrase = sessionPhrases[currentIndexRef.current];
      if (currentPhrase) {
        try {
          await markPhraseAsReviewed(currentPhrase.id);
        } catch (error) {
          console.error('Error auto-registering reviewed phrase:', error);
        }
      }

      if (currentIndexRef.current >= phrasesLengthRef.current - 1) {
        if (loopAudioEnabledRef.current && completedLoopCycles < loopCycleCount) {
          const nextCycle = completedLoopCycles + 1;
          const nextPhrases = loopShuffleEachCycle ? shufflePhrases(originalPhrasesRef.current) : [...originalPhrasesRef.current];
          setCompletedLoopCycles(nextCycle);
          setSessionPhrases(nextPhrases);
          setCurrentIndex(0);
          return;
        }
        setContinuousAudioEnabled(false);
        setLoopAudioEnabled(false);
        setAudioEnabled(false);
        onOpenChange(false);
        return;
      }

      setCurrentIndex(prev => prev + 1);
    }, audioPauseMs);
  };

  const speakWithBrowser = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;

    stopSpeech();
    setAudioError(null);

    const utterance = new SpeechSynthesisUtterance(text);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = 'es-CO';
    }
    utterance.rate = audioRate;
    utterance.pitch = audioPitch;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
      queueNextPhraseAfterPlayback();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const speakWithServiceAudio = async (text: string) => {
    if (!text.trim()) return;

    stopSpeech();
    setAudioError(null);
    const requestId = audioRequestIdRef.current + 1;
    audioRequestIdRef.current = requestId;

    try {
      const audioBlob = await phrasesAPI.generateAudio(text, {
        rate: audioRate,
        pitch: audioPitch,
      });
      if (audioRequestIdRef.current !== requestId) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      currentAudioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };
      audio.onpause = () => {
        if (audio.currentTime < audio.duration) {
          setIsPaused(true);
          setIsSpeaking(false);
        }
      };
      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        audioElementRef.current = null;
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
        queueNextPhraseAfterPlayback();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      await audio.play();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo generar el audio del proveedor configurado.';
      console.error('Error playing service audio:', error);
      setAudioError(message);
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const speakPhrase = (text: string) => {
    if (audioProvider === 'elevenlabs' || audioProvider === 'edge') {
      void speakWithServiceAudio(text);
      return;
    }
    speakWithBrowser(text);
  };

  useEffect(() => {
    if (open) {
      originalPhrasesRef.current = phrases;
      setSessionPhrases(initialAudioMode === 'loop' && initialLoopShuffle ? shufflePhrases(phrases) : phrases);
      setCurrentIndex(0);
      setShowNotes(true);
      prevCategoryRef.current = null;
      setBadgePopKey(0);
      setAudioEnabled(initialAudioMode !== 'off');
      setContinuousAudioEnabled(initialAudioMode === 'continuous');
      setLoopAudioEnabled(initialAudioMode === 'loop');
      setCompletedLoopCycles(1);
      setAudioProvider('browser');
      setServiceVoiceName(null);
      setAudioStatusLoading(true);
      setAudioError(null);
      setReviewError(null);
      setFeedbackDate(getLocalDateString());
      setFeedbackDraft('');
      setFeedbackSaving(false);
      setFeedbackModalError(null);
      setFeedbackSidebarError(null);
      setDeletingFeedbackDate(null);
      setFeedbackModalOpen(false);
      setFeedbackHistory({});
      setFeedbackHistoryLoading(false);
      setIsSpeaking(false);
      setIsPaused(false);
      setShowAudioSettings(false);
      reviewedPhraseIdsRef.current = new Set();
    } else {
      stopSpeech();
    }
  }, [initialAudioMode, initialLoopShuffle, open, phrases]);

  useEffect(() => {
    if (!open) return;
    originalPhrasesRef.current = phrases;
    setSessionPhrases(phrases);
    setCurrentIndex(0);
    prevCategoryRef.current = null;
    setBadgePopKey(0);
    setReviewError(null);
    stopSpeech();
  }, [open, phrases]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadAudioStatus = async () => {
      setAudioStatusLoading(true);
      try {
        const status = await phrasesAPI.getAudioStatus();
        if (cancelled) return;
        if (status.enabled && (status.provider === 'elevenlabs' || status.provider === 'edge')) {
          setAudioProvider(status.provider);
          setServiceVoiceName(
            status.voice_name ?? (status.provider === 'edge' ? 'Edge TTS' : 'ElevenLabs'),
          );
        } else {
          setAudioProvider('browser');
          setServiceVoiceName(null);
        }
      } catch (error) {
        console.error('Error loading phrase audio provider status:', error);
        if (!cancelled) {
          setAudioProvider('browser');
          setServiceVoiceName(null);
        }
      } finally {
        if (!cancelled) {
          setAudioStatusLoading(false);
        }
      }
    };

    loadAudioStatus();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadAudioPreferences = async () => {
      try {
        const prefs = await phrasesAPI.getAudioPreferences();
        if (cancelled) return;
        setSelectedVoiceName(prefs.selected_voice_name ?? '');
        setAudioRate(prefs.rate ?? DEFAULT_AUDIO_RATE);
        setAudioPitch(prefs.pitch ?? DEFAULT_AUDIO_PITCH);
        setAudioPauseMs(prefs.pause_ms ?? DEFAULT_AUDIO_PAUSE_MS);
      } catch (error) {
        console.error('Error loading phrase audio preferences:', error);
      }
    };

    loadAudioPreferences();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    continuousAudioEnabledRef.current = continuousAudioEnabled;
  }, [continuousAudioEnabled]);

  useEffect(() => {
    loopAudioEnabledRef.current = loopAudioEnabled;
  }, [loopAudioEnabled]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    phrasesLengthRef.current = sessionPhrases.length;
  }, [sessionPhrases.length]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    showEditModalRef.current = showEditModal;
  }, [showEditModal]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoicesLoaded(voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (!preferredVoice || selectedVoiceName) return;
    setSelectedVoiceName(preferredVoice.name);
  }, [preferredVoice, selectedVoiceName]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (showEditModal) return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrevious();
      else if (e.key === 'Enter') void handleMarkAsReviewed();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, currentIndex, phrases.length, showEditModal]);

  useEffect(() => {
    if (!open || sessionPhrases.length === 0) return;
    const phrase = sessionPhrases[currentIndex];
    const prev = prevCategoryRef.current;
    const categoryChanged = prev && (prev.categoryId !== phrase.categoryId || prev.subcategoryId !== phrase.subcategoryId);

    if (categoryChanged) {
      setBadgePopKey(k => k + 1);
    }

    prevCategoryRef.current = { categoryId: phrase.categoryId, subcategoryId: phrase.subcategoryId };
  }, [currentIndex, open, sessionPhrases]);

  useEffect(() => {
    if (!open || sessionPhrases.length === 0) return;

    let cancelled = false;
    const current = sessionPhrases[currentIndex];
    const loadHistory = async () => {
      try {
        setFeedbackHistoryLoading(true);
        setFeedbackSidebarError(null);
        const loaded = await phrasesAPI.getPhraseFeedbackHistory(current.id);
        if (cancelled) return;
        const mappedList = mapFeedbackList(loaded);
        setFeedbackHistory(prev => ({ ...prev, [current.id]: mappedList }));
        const byDate = loaded.find(item => item.date === feedbackDate);
        setFeedbackDraft(byDate?.text ?? '');
      } catch (error) {
        console.error('Error loading phrase feedback history:', error);
        if (!cancelled) setFeedbackSidebarError('No se pudo cargar el historial de feedback.');
      } finally {
        if (!cancelled) setFeedbackHistoryLoading(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [open, currentIndex, sessionPhrases]);

  useEffect(() => {
    if (!feedbackModalOpen || sessionPhrases.length === 0) return;
    const current = sessionPhrases[currentIndex];
    const currentHistory = feedbackHistory[current.id] ?? [];
    const currentEntry = currentHistory.find(item => item.date === feedbackDate);
    setFeedbackDraft(currentEntry?.text ?? '');
    setFeedbackModalError(null);
  }, [feedbackModalOpen, feedbackDate, currentIndex, feedbackHistory, sessionPhrases]);

  useEffect(() => {
    if (!open || audioStatusLoading || !audioEnabled || showEditModal || sessionPhrases.length === 0) return;
    speakPhrase(buildAudioScript(sessionPhrases[currentIndex]));
  }, [audioEnabled, audioStatusLoading, currentIndex, open, showEditModal, preferredVoice, sessionPhrases]);

  useEffect(() => {
    if (showEditModal) {
      stopSpeech();
    }
  }, [showEditModal]);

  if (!open || sessionPhrases.length === 0) return null;

  const currentPhrase = sessionPhrases[currentIndex];
  const category = categories.find(c => c.id === currentPhrase.categoryId);
  const subcategory = category?.subcategories.find(s => s.id === currentPhrase.subcategoryId);
  const currentPhraseFeedbackHistory = feedbackHistory[currentPhrase.id] ?? [];
  const currentFeedback = currentPhraseFeedbackHistory.find(item => item.date === feedbackDate);

  const handleNext = () => {
    if (currentIndex < sessionPhrases.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleMarkAsReviewed = async () => {
    const phraseId = currentPhrase.id;
    const hasNext = currentIndex < sessionPhrases.length - 1;

    try {
      setPendingReviewCount(count => count + 1);
      setReviewError(null);

      // Avance optimista: no bloquear la navegación por latencia/errores de red.
      if (hasNext) {
        handleNext();
      } else {
        onOpenChange(false);
      }

      await markPhraseAsReviewed(phraseId);
    } catch (error) {
      console.error('Error registering phrase review:', error);
      setReviewError('No se pudo registrar este repaso en el servidor, pero puedes continuar.');
    } finally {
      setPendingReviewCount(count => Math.max(0, count - 1));
    }
  };

  const handleClose = () => {
    stopSpeech();
    onOpenChange(false);
  };

  const handlePlayCurrentPhrase = () => {
    if (audioStatusLoading) return;
    if (audioProvider === 'browser' && (typeof window === 'undefined' || !('speechSynthesis' in window))) return;

    setAudioError(null);
    setContinuousAudioEnabled(false);
    setLoopAudioEnabled(false);
    setAudioEnabled(true);
    speakPhrase(buildAudioScript(currentPhrase));
  };

  const handleToggleContinuousAudio = () => {
    if (audioStatusLoading) return;
    if (audioProvider === 'browser' && (typeof window === 'undefined' || !('speechSynthesis' in window))) return;

    setAudioError(null);
    setContinuousAudioEnabled((prev) => {
      const next = !prev;
      if (next) {
        setLoopAudioEnabled(false);
        setAudioEnabled(true);
        setTimeout(() => {
          speakPhrase(buildAudioScript(currentPhrase));
        }, 0);
      }
      return next;
    });
  };

  const handlePauseResume = () => {
    if (audioStatusLoading) return;
    if (!audioEnabled) {
      setAudioEnabled(true);
      speakPhrase(buildAudioScript(currentPhrase));
      return;
    }

    if (audioProvider === 'elevenlabs' || audioProvider === 'edge') {
      const audio = audioElementRef.current;
      if (audio && !audio.paused) {
        audio.pause();
        setIsPaused(true);
        setIsSpeaking(false);
        return;
      }

      if (audio && audio.paused) {
        void audio.play();
        setIsPaused(false);
        setIsSpeaking(true);
        return;
      }

      speakPhrase(buildAudioScript(currentPhrase));
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
      return;
    }

    speakPhrase(buildAudioScript(currentPhrase));
  };

  const handleConfirmLoopAudio = () => {
    const firstCyclePhrases = loopShuffleEachCycle ? shufflePhrases(originalPhrasesRef.current) : [...originalPhrasesRef.current];
    setSessionPhrases(firstCyclePhrases);
    setCurrentIndex(0);
    setCompletedLoopCycles(1);
    setContinuousAudioEnabled(false);
    setLoopAudioEnabled(true);
    setAudioEnabled(true);
    setShowLoopSetup(false);
    setTimeout(() => {
      speakPhrase(buildAudioScript(firstCyclePhrases[0]));
    }, 0);
  };

  const handleEditSave = (formData: any) => {
    onEdit(currentPhrase.id, formData);
    setShowEditModal(false);
  };

  const handleSaveFeedback = async () => {
    const trimmed = feedbackDraft.trim();
    if (!trimmed) {
      setFeedbackModalError('Escribe un feedback antes de guardar.');
      return;
    }

    try {
      setFeedbackSaving(true);
      setFeedbackModalError(null);
      const saved = await phrasesAPI.savePhraseFeedback(feedbackDate, currentPhrase.id, trimmed);
      setFeedbackHistory(prev => {
        const nextEntry = {
          id: saved.id,
          phraseId: saved.phrase_id,
          date: saved.date,
          text: saved.text,
          createdAt: saved.created_at || undefined,
          updatedAt: saved.updated_at || undefined,
        };
        const currentList = prev[currentPhrase.id] ?? [];
        const filtered = currentList.filter(item => item.date !== saved.date);
        return {
          ...prev,
          [currentPhrase.id]: [nextEntry, ...filtered].sort((a, b) => b.date.localeCompare(a.date)),
        };
      });
      setFeedbackModalOpen(false);
    } catch (error) {
      console.error('Error saving phrase feedback:', error);
      setFeedbackModalError('No se pudo guardar el feedback.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  // Eliminar desde el modal (usa la fecha seleccionada en el modal)
  const handleDeleteFeedback = async () => {
    try {
      setFeedbackSaving(true);
      setFeedbackModalError(null);
      await phrasesAPI.deletePhraseFeedback(feedbackDate, currentPhrase.id);
      setFeedbackHistory(prev => ({
        ...prev,
        [currentPhrase.id]: (prev[currentPhrase.id] ?? []).filter(item => item.date !== feedbackDate),
      }));
      setFeedbackDraft('');
      setFeedbackModalOpen(false);
    } catch (error) {
      console.error('Error deleting phrase feedback:', error);
      setFeedbackModalError('No se pudo eliminar el feedback.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  // Eliminar directamente desde el sidebar (sin abrir el modal)
  const handleDeleteFeedbackFromSidebar = async (date: string) => {
    try {
      setDeletingFeedbackDate(date);
      setFeedbackSidebarError(null);
      await phrasesAPI.deletePhraseFeedback(date, currentPhrase.id);
      setFeedbackHistory(prev => ({
        ...prev,
        [currentPhrase.id]: (prev[currentPhrase.id] ?? []).filter(item => item.date !== date),
      }));
      // Si el modal está abierto para esa fecha, cerrarlo
      if (feedbackModalOpen && feedbackDate === date) {
        setFeedbackDraft('');
        setFeedbackModalOpen(false);
      }
    } catch (error) {
      console.error('Error deleting phrase feedback from sidebar:', error);
      setFeedbackSidebarError('No se pudo eliminar el feedback.');
    } finally {
      setDeletingFeedbackDate(null);
    }
  };

  // Abrir modal en modo edición para un ítem del historial
  const handleEditFeedbackFromSidebar = (item: PhraseFeedback) => {
    setFeedbackDate(item.date);
    setFeedbackDraft(item.text);
    setFeedbackModalError(null);
    setFeedbackModalOpen(true);
  };

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    void persistAudioPreferences({ selected_voice_name: voiceName || null });

    if (audioEnabled) {
      setAudioError(null);
      setTimeout(() => {
        speakPhrase(buildAudioScript(currentPhrase));
      }, 0);
    }
  };

  const handleAudioRateChange = (value: number) => {
    setAudioRate(value);
    void persistAudioPreferences({ rate: value });
    if (audioEnabled) {
      setAudioError(null);
      setTimeout(() => {
        speakPhrase(buildAudioScript(currentPhrase));
      }, 0);
    }
  };

  const handleAudioPitchChange = (value: number) => {
    setAudioPitch(value);
    void persistAudioPreferences({ pitch: value });
    if (audioEnabled) {
      setAudioError(null);
      setTimeout(() => {
        speakPhrase(buildAudioScript(currentPhrase));
      }, 0);
    }
  };

  const handleAudioPauseChange = (value: number) => {
    setAudioPauseMs(value);
    void persistAudioPreferences({ pause_ms: value });
  };

  const handleResetAudioSettings = () => {
    setAudioRate(DEFAULT_AUDIO_RATE);
    setAudioPitch(DEFAULT_AUDIO_PITCH);
    setAudioPauseMs(DEFAULT_AUDIO_PAUSE_MS);

    if (audioProvider === 'browser') {
      setSelectedVoiceName('');
    }

    void persistAudioPreferences({
      selected_voice_name: audioProvider === 'browser' ? null : selectedVoiceName || null,
      rate: DEFAULT_AUDIO_RATE,
      pitch: DEFAULT_AUDIO_PITCH,
      pause_ms: DEFAULT_AUDIO_PAUSE_MS,
    });

    if (audioEnabled) {
      setAudioError(null);
      setTimeout(() => {
        speakPhrase(buildAudioScript(currentPhrase));
      }, 0);
    }
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
                  Repasando frases de: {sessionLabel || category?.name || 'Todas'}{loopAudioEnabled ? ` · Bucle ${completedLoopCycles}/${loopCycleCount}` : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progreso</p>
              <p className="text-sm font-semibold text-foreground">
                {currentIndex + 1} de {sessionPhrases.length}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePlayCurrentPhrase}
              disabled={audioStatusLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {audioStatusLoading ? 'Preparando audio...' : 'Reproducir frase'}
            </button>

            <button
              type="button"
              onClick={handleToggleContinuousAudio}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                continuousAudioEnabled
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'border border-border bg-background text-foreground hover:bg-accent'
              }`}
            >
              <Play className="h-4 w-4" />
              {continuousAudioEnabled ? 'Audio corrido activo' : 'Audio corrido'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (loopAudioEnabled) {
                  setLoopAudioEnabled(false);
                  setAudioEnabled(false);
                  stopSpeech();
                  return;
                }
                setShowLoopSetup(true);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                loopAudioEnabled
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'border border-border bg-background text-foreground'
              }`}
            >
              <Repeat className="h-4 w-4" />
              {loopAudioEnabled ? 'Bucle activo' : 'Audio en bucle'}
            </button>

            <button
              type="button"
              onClick={handlePauseResume}
              disabled={audioStatusLoading || (!audioEnabled && sessionPhrases.length === 0)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              {isSpeaking && !isPaused ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isSpeaking && !isPaused ? 'Pausar audio' : isPaused ? 'Continuar audio' : 'Reanudar audio'}
            </button>

            <button
              type="button"
              onClick={stopSpeech}
              disabled={!audioEnabled && !isSpeaking && !isPaused}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              Detener audio
            </button>

            <span className="text-xs text-muted-foreground">
              {audioStatusLoading
                ? 'Detectando proveedor de audio...'
                : audioProvider === 'elevenlabs'
                ? `Proveedor actual: ElevenLabs${serviceVoiceName ? ` · ${serviceVoiceName}` : ''}`
                : audioProvider === 'edge'
                ? `Proveedor actual: Edge TTS${serviceVoiceName ? ` · ${serviceVoiceName}` : ''}`
                : preferredVoice
                  ? `Voz actual: ${preferredVoice.name}`
                  : 'Se usara la mejor voz en espanol disponible'}
            </span>
            <button
              type="button"
              onClick={() => setShowAudioSettings((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                showAudioSettings
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              }`}
            >
              <Settings2 className="h-4 w-4" />
              {showAudioSettings ? 'Ocultar ajustes' : 'Ajustes de audio'}
            </button>
            {(continuousAudioEnabled || loopAudioEnabled) && (
              <span className="text-xs text-primary">
                {loopAudioEnabled ? 'La sesión repetirá el ciclo configurado automáticamente.' : 'La sesion avanzara sola al terminar cada frase.'}
              </span>
            )}
          </div>
          {showAudioSettings && !audioStatusLoading && (
            <div className="mt-3 rounded-xl border border-border bg-background/70 p-4 space-y-4">
              {audioProvider === 'browser' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="phrase-audio-voice" className="text-xs font-medium text-muted-foreground">
                    Voz del repaso
                  </label>
                  <select
                    id="phrase-audio-voice"
                    value={selectedVoiceName}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="min-w-[280px] max-w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {availableSpanishVoices.length === 0 ? (
                      <option value="">Sin voces en espanol disponibles</option>
                    ) : (
                      availableSpanishVoices.map((voice) => (
                        <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">Velocidad: {audioRate.toFixed(2)}x</span>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={audioRate}
                    onChange={(e) => handleAudioRateChange(Number(e.target.value))}
                    className="accent-primary"
                  />
                </label>

                <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">Tono: {audioPitch.toFixed(2)}x</span>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={audioPitch}
                    onChange={(e) => handleAudioPitchChange(Number(e.target.value))}
                    className="accent-primary"
                  />
                </label>

                <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">Pausa entre frases: {(audioPauseMs / 1000).toFixed(1)}s</span>
                  <input
                    type="range"
                    min="300"
                    max="2000"
                    step="100"
                    value={audioPauseMs}
                    onChange={(e) => handleAudioPauseChange(Number(e.target.value))}
                    className="accent-primary"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetAudioSettings}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Restablecer voz
                </button>
              </div>
            </div>
          )}
          {audioError && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {audioError}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / sessionPhrases.length) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <div className="h-[calc(100vh-88px)] overflow-y-auto">
        <div className="w-full px-6 py-8 pb-28 xl:px-10">
          <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <div className="w-full max-w-5xl">
            {/* Quote Card */}
            <div className="relative mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-8 shadow-lg border border-blue-100 dark:border-blue-900/30">
              <MessageSquareQuote className="absolute top-5 left-5 h-10 w-10 text-blue-300 dark:text-blue-700 opacity-50" />
              <button
                onClick={() => setShowEditModal(true)}
                title="Editar frase"
                className="absolute top-4 right-4 z-10 rounded-lg p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
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

            {/* Badges — pop animation on category change */}
            <div key={badgePopKey} className="flex justify-center gap-2 mb-5" style={{ animation: badgePopKey > 0 ? 'badgePop 1.4s ease forwards' : undefined }}>
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

            <style>{`
              @keyframes badgePop {
                0%   { transform: scale(1); }
                25%  { transform: scale(1.6); }
                55%  { transform: scale(1.6); }
                80%  { transform: scale(1.3); }
                100% { transform: scale(1); }
              }
            `}</style>

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

            <aside className="h-fit rounded-2xl border border-border bg-card p-4 shadow-sm xl:sticky xl:top-6 xl:justify-self-end xl:w-[340px]">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Feedback de la frase</h3>
                <p className="mt-1 text-xs text-muted-foreground">Guarda lo que te pasó, cómo se aplicó la frase o qué aprendizaje te dejó.</p>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackDate(getLocalDateString());
                    setFeedbackDraft('');
                    setFeedbackModalError(null);
                    setFeedbackModalOpen(true);
                  }}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  + Agregar feedback
                </button>

                {feedbackHistoryLoading && <p className="text-xs text-muted-foreground">Cargando historial...</p>}
                {feedbackSidebarError && <p className="text-xs text-destructive">{feedbackSidebarError}</p>}

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {currentPhraseFeedbackHistory.length === 0 && !feedbackHistoryLoading ? (
                    <div className="rounded-xl border border-dashed border-border bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">
                      Aún no hay feedback para esta frase.
                    </div>
                  ) : (
                    currentPhraseFeedbackHistory.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border bg-background/70 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary self-start">
                              {item.date}
                            </span>
                            {item.updatedAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(item.updatedAt).toLocaleString('es-ES')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              title="Editar feedback"
                              onClick={() => handleEditFeedbackFromSidebar(item)}
                              disabled={deletingFeedbackDate === item.date}
                              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              title="Eliminar feedback"
                              onClick={() => handleDeleteFeedbackFromSidebar(item.date)}
                              disabled={deletingFeedbackDate === item.date}
                              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                            >
                              {deletingFeedbackDate === item.date
                                ? <span className="text-[10px]">…</span>
                                : <Trash2 className="h-3 w-3" />
                              }
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{item.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          {reviewError && (
            <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {reviewError}
            </p>
          )}
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
              className="flex-1 max-w-md rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentIndex < sessionPhrases.length - 1 ? '✓ Repasada' : '✓ Finalizar Repaso'}
            </button>

            <button
              onClick={handleNext}
              disabled={currentIndex === sessionPhrases.length - 1}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Phrase Modal */}
      <PhraseModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        phrase={currentPhrase}
        categories={categories}
        onSave={handleEditSave}
      />

      <Dialog open={feedbackModalOpen} onOpenChange={(open) => { setFeedbackModalOpen(open); if (!open) setFeedbackModalError(null); }}>
        <DialogContent className="max-w-lg border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{currentFeedback ? 'Editar feedback' : 'Agregar feedback'}</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {currentPhrase.text}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha</label>
              <input
                type="date"
                value={feedbackDate}
                onChange={(e) => setFeedbackDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {currentFeedback && currentFeedback.date !== feedbackDate && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  No hay feedback para esta fecha. Guardar creará uno nuevo.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Feedback</label>
              <textarea
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="Ej: Hoy esta frase aplicó porque en una situación concreta pude verla clarísima..."
                className="min-h-[200px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                maxLength={4000}
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{feedbackDraft.length}/4000</span>
                {currentFeedback?.updatedAt && (
                  <span>Actualizado: {new Date(currentFeedback.updatedAt).toLocaleString('es-ES')}</span>
                )}
              </div>
            </div>

            {feedbackModalError && <p className="text-xs text-destructive">{feedbackModalError}</p>}

            <div className="flex items-center justify-between gap-2">
              <div>
                {currentFeedback && (
                  <button
                    type="button"
                    onClick={handleDeleteFeedback}
                    disabled={feedbackSaving}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setFeedbackModalOpen(false); setFeedbackModalError(null); }}
                  disabled={feedbackSaving}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeedback}
                  disabled={feedbackSaving || feedbackHistoryLoading}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {feedbackSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showLoopSetup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Configurar audio en bucle</h3>
              <p className="text-sm text-muted-foreground">Define cuántas veces quieres repetir todo el grupo y si quieres mezclar el orden entre ciclos.</p>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Número de ciclos completos</label>
                <input
                  type="number"
                  min={1}
                  value={loopCycleCount}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (Number.isNaN(parsed)) return;
                    setLoopCycleCount(Math.max(1, parsed));
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={loopCycleCount}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  if (!Number.isNaN(parsed)) {
                    setLoopCycleCount(parsed);
                  }
                }}
                className="w-full accent-primary"
              />

              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Modo aleatorio por ciclo</p>
                  <p className="text-xs text-muted-foreground">Cada vuelta puede cambiar el orden de las frases.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLoopShuffleEachCycle(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loopShuffleEachCycle ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${loopShuffleEachCycle ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLoopSetup(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLoopAudio}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Iniciar bucle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
