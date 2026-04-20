import React, { useState, useRef } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { X, Fuel, Gauge, Banknote, CheckCircle2, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FuelHistory } from './FuelHistory';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface FuelModalProps {
  vehicle: {
    id: string;
    brand: string;
    model: string;
    currentMileage: number;
  };
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const FuelModal: React.FC<FuelModalProps> = ({ vehicle, isOpen, userId, onClose, onSuccess }) => {
  const [cost, setCost] = useState('');
  const [mileageAtFill, setMileageAtFill] = useState(vehicle.currentMileage.toString());
  const [lowFuel, setLowFuel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);

  const resetAndClose = () => {
    setCost('');
    setMileageAtFill(vehicle.currentMileage.toString());
    setLowFuel(false);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cost && !mileageAtFill && !lowFuel) {
      alert("Veuillez saisir au moins un kilométrage, un montant, ou cocher l'alerte carburant.");
      return;
    }

    if (mileageAtFill && parseInt(mileageAtFill) < vehicle.currentMileage) {
      alert(`Le kilométrage ne peut pas être inférieur au kilométrage actuel (${vehicle.currentMileage.toLocaleString()} km).`);
      return;
    }

    if (mileageAtFill && parseInt(mileageAtFill) > 999999) {
      alert("Le kilométrage ne peut pas dépasser 999 999 km.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/api/fuel', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: vehicle.id,
          userId,
          cost: cost || undefined,
          mileageAtFill: mileageAtFill || undefined,
          lowFuel,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          resetAndClose();
        }, 1500);
      } else {
        const err = await response.json();
        alert(err.error || "Une erreur est survenue.");
      }
    } catch (error) {
      console.error('Error reporting fuel:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusTrap(isOpen, resetAndClose, modalRef);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        ref={modalRef}
        className="glass w-full max-w-md overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fuel-modal-title"
      >
        <div className="relative p-4 sm:p-5 max-h-[85vh] overflow-y-auto">
          <button
            onClick={resetAndClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Fermer la modale"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <Fuel className="h-5 w-5" />
            </div>
            <div>
              <h2 id="fuel-modal-title" className="text-xl font-bold tracking-tight">Saisir kilométrage</h2>
              <p className="text-xs text-muted-foreground">{vehicle.brand} {vehicle.model}</p>
            </div>
          </div>

          {success ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in duration-500">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Kilométrage enregistré !</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                {/* Kilométrage */}
                <div className="space-y-2">
                  <label htmlFor="mileage" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Gauge className="h-3 w-3" /> Kilométrage actuel
                  </label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                    <input
                      id="mileage"
                      type="number"
                      min={vehicle.currentMileage}
                      max="999999"
                      placeholder={vehicle.currentMileage.toString()}
                      value={mileageAtFill}
                      onChange={(e) => setMileageAtFill(e.target.value)}
                      className="w-full rounded-2xl border bg-muted/30 py-4 pl-12 pr-4 text-lg font-black outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic pl-1">
                    Min : {vehicle.currentMileage.toLocaleString()} km — Max : 999 999 km
                  </p>
                </div>

                {/* Coût */}
                <div className="space-y-2">
                  <label htmlFor="cost" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-3 w-3" /> Coût du plein (€) — <span className="text-[10px] font-normal lowercase italic">si applicable</span>
                  </label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 75.20"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full rounded-2xl border bg-muted/30 py-3 pl-12 pr-4 text-md font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                {/* Alerte carburant */}
                <label
                  className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-red-500 focus-within:ring-offset-2 rounded-2xl"
                >
                  <input
                    type="checkbox"
                    checked={lowFuel}
                    onChange={(e) => setLowFuel(e.target.checked)}
                    className="sr-only"
                  />
                  <div aria-hidden="true" className={cn(
                    "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                    lowFuel ? "bg-red-500 border-red-500 text-white" : "bg-white dark:bg-black/20 border-red-500/40"
                  )}>
                    {lowFuel && <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-red-600 dark:text-red-400">Plus de carburant ?</span>
                    <span className="text-[10px] font-medium text-red-500/60 uppercase tracking-wider">Alerte niveau bas</span>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || success}
                className={cn(
                  "w-full rounded-2xl py-4 text-sm font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 outline-none focus-visible:ring-2",
                  (loading || success)
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-white shadow-primary/20 hover:bg-primary/90 focus-visible:ring-primary"
                )}
              >
                {loading ? 'Enregistrement...' : success ? 'Succès !' : 'Enregistrer les données'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Historique récent
            </h3>
            <FuelHistory vehicleId={vehicle.id} />
          </div>
        </div>
      </div>
    </div>
  );
};
