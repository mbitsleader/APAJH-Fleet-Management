import React, { useState, useRef } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { X, AlertTriangle, AlertCircle, ShieldAlert, CheckCircle2, Camera, ImageIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface IncidentModalProps {
  vehicle: {
    id: string;
    brand: string;
    model: string;
  };
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SEVERITIES = [
  { id: 'MINOR', label: 'Mineur', icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-50', desc: 'Défaut esthétique, rayure légère...' },
  { id: 'MODERATE', label: 'Modéré', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', desc: 'Voyant allumé, problème non bloquant...' },
  { id: 'MAJOR', label: 'Majeur', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', desc: 'Pneu crevé, vitre cassée, panne...' },
  { id: 'CRITICAL', label: 'Critique', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-50', desc: 'Accident grave, moteur HS, véhicule immobilisé.' },
];

export const IncidentModal: React.FC<IncidentModalProps> = ({
  vehicle,
  userId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MINOR');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const resetAndClose = () => {
    setDescription('');
    setSeverity('MINOR');
    setPhotoBase64(null);
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La photo ne doit pas dépasser 5 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoBase64(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useFocusTrap(isOpen, resetAndClose, modalRef);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/incidents', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: vehicle.id,
          userId,
          description,
          severity,
          photoUrl: photoBase64 || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Une erreur est survenue');
      setSuccess(true);
      onSuccess();
      setTimeout(() => { resetAndClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="incident-title">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={resetAndClose} />

      <div ref={modalRef} className="relative w-full max-w-lg transform overflow-hidden rounded-3xl bg-card border shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="incident-title" className="text-lg font-bold">Signaler un incident</h3>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{vehicle.brand} {vehicle.model}</p>
            </div>
          </div>
          <button onClick={resetAndClose} className="rounded-full p-2 hover:bg-secondary transition-colors" aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h4 className="text-2xl font-bold text-emerald-600">Signalement envoyé</h4>
            <p className="mt-2 text-muted-foreground">L'équipe de gestion a été prévenue.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {error && (
              <div role="alert" aria-live="polite" className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {/* Sévérité */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Niveau de sévérité</label>
              <div className="grid grid-cols-2 gap-3">
                {SEVERITIES.map((sev) => {
                  const Icon = sev.icon;
                  const isSelected = severity === sev.id;
                  return (
                    <button key={sev.id} type="button" onClick={() => setSeverity(sev.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all hover:border-primary/50 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card shadow-sm hover:shadow-md"
                      )}
                    >
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shadow-sm border", sev.bg, sev.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-sm font-bold">{sev.label}</span>
                        <span className="text-[10px] leading-tight text-muted-foreground line-clamp-2">{sev.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {severity === 'CRITICAL' && (
                <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                  Attention : un incident critique immobilise immédiatement le véhicule.
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Description du problème
              </label>
              <textarea id="description" required rows={3}
                placeholder="Expliquez ici le problème constaté..."
                className="w-full rounded-2xl border bg-secondary/50 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Photo */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Camera className="h-3 w-3" /> Photo <span className="font-normal lowercase italic">(optionnel)</span>
              </label>

              {photoBase64 ? (
                <div className="relative rounded-2xl overflow-hidden border bg-muted/30">
                  <img src={photoBase64} alt="Aperçu" className="w-full max-h-48 object-cover" />
                  <button type="button" onClick={removePhoto}
                    aria-label="Supprimer la photo"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Photo ajoutée
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
                >
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-xs font-bold">Cliquer pour ajouter une photo</span>
                  <span className="text-[10px]">JPG, PNG, WEBP — max 5 Mo</span>
                </button>
              )}

              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handlePhotoChange} />
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-3">
              <button type="button" onClick={resetAndClose}
                className="flex-1 rounded-xl border py-3 text-sm font-bold hover:bg-secondary transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={loading}
                className={cn(
                  "flex-[2] rounded-xl bg-destructive text-destructive-foreground py-3 text-sm font-bold shadow-lg shadow-destructive/20 transition-all active:scale-95",
                  loading && "opacity-50 cursor-not-allowed"
                )}>
                {loading ? 'Envoi...' : 'Envoyer le signalement'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
