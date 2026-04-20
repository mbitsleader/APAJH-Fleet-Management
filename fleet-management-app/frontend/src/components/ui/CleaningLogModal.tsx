'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, Sparkles, Car, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface CleaningLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  vehicle: { brand: string; model: string; plateNumber: string };
  scheduleId: string;
  initialNotes?: string;
  onSave: () => void;
}

export const CleaningLogModal: React.FC<CleaningLogModalProps> = ({
  isOpen,
  onClose,
  date,
  vehicle,
  scheduleId,
  initialNotes = '',
  onSave
}) => {
  const [notes, setNotes] = useState(initialNotes);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes);
      setSuccess(false);
      setError(null);
    }
  }, [isOpen, initialNotes]);

  const resetAndClose = () => {
    setNotes(initialNotes);
    setSuccess(false);
    setError(null);
    onClose();
  };

  useFocusTrap(isOpen, resetAndClose, modalRef);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/cleaning/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          date: date.toISOString(),
          notes
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSave();
          resetAndClose();
        }, 1500);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Une erreur est survenue lors de l'enregistrement.");
      }
    } catch (err) {
      console.error('Error logging cleaning:', err);
      setError("Une erreur réseau est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        ref={modalRef}
        className="glass w-full max-w-md overflow-hidden rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cleaning-modal-title"
      >
        <div className="relative p-6">
          <button
            onClick={resetAndClose}
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 id="cleaning-modal-title" className="text-xl font-black tracking-tight text-slate-800">Rapport de Nettoyage</h2>
              <p className="text-sm font-bold text-primary/60 uppercase tracking-widest">Fiche journalière</p>
            </div>
          </div>

          {success ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-emerald-600">Nettoyage validé !</p>
                <p className="text-sm text-muted-foreground">Merci pour votre contribution.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div role="alert" className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 animate-in shake duration-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="font-bold">{error}</p>
                </div>
              )}

              <div className="space-y-4 rounded-2xl bg-muted/30 p-4 border border-border/50">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-primary/70" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Véhicule</p>
                    <p className="font-bold text-slate-700 leading-tight">{vehicle.brand} {vehicle.model}</p>
                    <p className="text-xs font-medium text-muted-foreground">{vehicle.plateNumber}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary/70" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date du passage</p>
                    <p className="font-bold text-slate-700 leading-tight">{capitalizedDate}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" /> Observations / Notes
                </label>
                <textarea
                  id="notes"
                  rows={4}
                  placeholder="Ex: Nettoyage intérieur effectué, aspirateur passé, vitres propres..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-2xl border-2 border-transparent bg-muted/50 p-4 text-sm font-medium outline-none focus:border-primary/20 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all resize-none"
                />
                <div className="flex items-start gap-2 px-1">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Signalez ici toute anomalie constatée lors du nettoyage (tâches tenaces, matériel manquant, etc.).
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full rounded-2xl py-4 text-sm font-black uppercase tracking-[0.2em] shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                  loading
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-white shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40"
                )}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5 shrink-0" />
                )}
                {loading ? 'Validation...' : 'Confirmer le nettoyage'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
