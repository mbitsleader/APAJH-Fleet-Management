import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { X, Gauge, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface TripModalProps {
  vehicle: {
    id: string;
    brand: string;
    model: string;
    currentMileage: number;
  };
  reservationId?: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'START' | 'END';
  activeTripId?: string;
}

export const TripModal: React.FC<TripModalProps> = ({ 
  vehicle, 
  reservationId,
  userId,
  isOpen, 
  onClose,
  onSuccess,
  type,
  activeTripId
}) => {
  const [mileage, setMileage] = useState(vehicle.currentMileage.toString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(activeTripId);
  // startMileage du trajet actif, récupéré depuis la DB — référence fiable pour la validation END
  const [tripStartMileage, setTripStartMileage] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isOpen, onClose, modalRef);

  useEffect(() => {
    // Toujours fetch le trajet actif en mode END pour avoir le startMileage fiable depuis la DB
    // (même si activeTripId est fourni en props, il peut ne pas inclure startMileage)
    if (isOpen && type === 'END') {
      const fetchActiveTrip = async () => {
        try {
          const res = await apiFetch(`/api/trips/vehicle/${vehicle.id}`);
          const trips = await res.json();
          const active = trips.find((t: any) => !t.endTime);
          if (active) {
            setCurrentTripId(active.id);
            setTripStartMileage(active.startMileage);
            // Pré-remplir avec le startMileage uniquement si le champ n'a pas encore été modifié
            setMileage(prev => prev === vehicle.currentMileage.toString() ? active.startMileage.toString() : prev);
          }
        } catch {
          // Silencieux — la validation côté serveur prendra le relais
        }
      };
      fetchActiveTrip();
    }
  }, [isOpen, type, vehicle.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const km = parseInt(mileage);

    // BUG B fix — validation START : le compteur ne peut pas régresser
    if (type === 'START') {
      if (km < vehicle.currentMileage) {
        setError(`Le kilométrage saisi (${km.toLocaleString()} km) ne peut pas être inférieur au kilométrage actuel du véhicule (${vehicle.currentMileage.toLocaleString()} km). Vérifiez le compteur.`);
        return;
      }
    }

    // BUG D fix — validation END : compare au startMileage du trajet (DB), pas à vehicle.currentMileage (props)
    if (type === 'END') {
      const startRef = tripStartMileage ?? vehicle.currentMileage;
      if (km < startRef) {
        setError(`Le kilométrage de retour (${km.toLocaleString()} km) ne peut pas être inférieur au kilométrage de départ (${startRef.toLocaleString()} km).`);
        return;
      }
    }

    setLoading(true);

    const endpoint = type === 'START' ? '/api/trips/start' : '/api/trips/end';
    const body = type === 'START'
      ? { vehicleId: vehicle.id, startMileage: mileage, reservationId }
      : { tripId: currentTripId, endMileage: mileage, notes };

    try {
      const response = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div ref={modalRef} className="relative w-full max-w-md transform overflow-hidden rounded-3xl bg-card border shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              type === 'START' ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"
            )}>
              {type === 'START' ? <Play className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <h3 id="modal-title" className="text-lg font-bold">
                {type === 'START' ? 'Prise du véhicule' : 'Restitution du véhicule'}
              </h3>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                {vehicle.brand} {vehicle.model}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 hover:bg-secondary transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center" role="alert" aria-live="polite">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h4 className="text-2xl font-bold text-emerald-600">Confirmé !</h4>
            <p className="mt-2 text-muted-foreground">
              {type === 'START' ? 'Bonne route !' : 'Véhicule restitué avec succès.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20" role="alert">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="mileage" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {type === 'START' ? 'Kilométrage au compteur au départ' : 'Kilométrage au compteur au retour'}
                </label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="mileage"
                    required
                    type="number"
                    className="w-full rounded-xl border bg-secondary/50 p-3 pl-10 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    aria-describedby="mileage-hint"
                  />
                </div>
                <p id="mileage-hint" className="text-[10px] text-muted-foreground">
                  {type === 'START'
                    ? `Valeur DB actuelle : ${vehicle.currentMileage.toLocaleString()} km — vérifiez le compteur physique.`
                    : tripStartMileage != null
                      ? `Kilométrage au départ enregistré : ${tripStartMileage.toLocaleString()} km — la valeur de retour doit être supérieure.`
                      : 'Vérifiez la valeur affichée sur le tableau de bord du véhicule.'
                  }
                </p>
              </div>

              {type === 'END' && (
                <div className="space-y-2">
                  <label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
                    <span>Notes / Remarques (Optionnel)</span>
                    <span className="text-[10px] lowercase font-normal italic text-amber-600">Usage pro uniquement — pas de données perso (RGPD)</span>
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    placeholder="Ex: Signalement d'un voyant, propreté..."
                    className="w-full rounded-xl border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border py-3 text-sm font-bold hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "flex-[2] rounded-xl py-3 text-sm font-bold shadow-lg transition-all active:scale-95",
                  type === 'START' 
                    ? "bg-emerald-600 text-white shadow-emerald-600/20" 
                    : "bg-orange-600 text-white shadow-orange-600/20",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? 'Traitement...' : type === 'START' ? 'Démarrer la mission' : 'Confirmer le retour'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
