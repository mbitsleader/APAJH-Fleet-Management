import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Check, Car, Users, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { formatLocalDate, getMonday } from '@/lib/date';

interface BulkCleaningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  professionals: any[];
  vehicles: any[];
}

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const BulkCleaningModal: React.FC<BulkCleaningModalProps> = ({
  isOpen, onClose, onSuccess, professionals, vehicles
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]); // ISO Strings
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calendar state
  const [monthOffset, setMonthOffset] = useState(0);
  
  if (!isOpen) return null;

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return setError('Veuillez choisir un véhicule.');
    if (selectedUserIds.length === 0) return setError('Veuillez choisir au moins un professionnel.');
    if (selectedDates.length === 0) return setError('Veuillez choisir au moins un jour.');

    setLoading(true);
    setError(null);

    try {
      // Group dates by week
      const weeks: Record<string, number[]> = {}; // "YYYY-MM-DD" (Monday) -> [dayNumbers]
      
      selectedDates.forEach(dStr => {
        const d = new Date(dStr);
        const mon = formatLocalDate(getMonday(d));
        let dayNum = d.getDay(); // 0=Sun, 1=Mon...
        if (!weeks[mon]) weeks[mon] = [];
        weeks[mon].push(dayNum);
      });

      // Send requests for each week
      const promises = Object.entries(weeks).map(([mon, dayNums]) => {
        return apiFetch('/api/cleaning/schedule', {
          method: 'POST',
          body: JSON.stringify({
            vehicleId: selectedVehicleId,
            weekDate: mon,
            assignedUserIds: selectedUserIds,
            plannedDays: dayNums.sort().join(',')
          })
        });
      });

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Erreur lors de la planification de ${failed.length} semaine(s).`);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        resetAndClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setSelectedVehicleId('');
    setSelectedUserIds([]);
    setSelectedDates([]);
    setError(null);
    setSuccess(false);
    onClose();
  };

  // Generate calendar days for current month view
  const now = new Date();
  const calendarStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(calendarStart.getFullYear(), calendarStart.getMonth() + 1, 0).getDate();
  const startDayOfWeek = (new Date(calendarStart.getFullYear(), calendarStart.getMonth(), 1).getDay() + 6) % 7; // 0=Mon

  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(calendarStart.getFullYear(), calendarStart.getMonth(), i));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-card border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b p-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Planification Multi-Semaines</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nettoyage Rapide</p>
            </div>
          </div>
          <button onClick={resetAndClose} className="rounded-full p-2 hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center animate-in zoom-in duration-300">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-10 w-10" />
            </div>
            <h4 className="text-2xl font-bold text-emerald-600">Planification réussie !</h4>
            <p className="text-muted-foreground mt-2">Le calendrier de nettoyage a été mis à jour.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm font-bold flex items-center gap-2">
                <X className="h-4 w-4" /> {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Vehicle & Pros */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                    <Car className="h-3.5 w-3.5" /> Véhicule
                  </label>
                  <select 
                    required
                    value={selectedVehicleId}
                    onChange={e => setSelectedVehicleId(e.target.value)}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- Choisir un véhicule --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plateNumber})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" /> Professionnels
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border bg-muted/10 min-h-[100px]">
                    {professionals.map(p => {
                      const active = selectedUserIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedUserIds(prev => 
                            active ? prev.filter(id => id !== p.id) : [...prev, p.id]
                          )}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                            active 
                              ? "bg-primary text-white border-primary shadow-sm" 
                              : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                          )}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Mini Calendar */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" /> Jours de nettoyage
                </label>
                <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                  <div className="bg-muted/30 p-3 flex items-center justify-between border-b">
                    <span className="text-sm font-black text-primary capitalize">
                      {calendarStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setMonthOffset(prev => prev - 1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setMonthOffset(prev => prev + 1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-7 gap-1">
                    {DAYS_SHORT.map(d => (
                      <div key={d} className="text-[10px] font-black text-center text-muted-foreground py-1 uppercase">{d}</div>
                    ))}
                    {days.map((date, idx) => {
                      if (!date) return <div key={`empty-${idx}`} />;
                      const dateStr = formatLocalDate(date);
                      const isSelected = selectedDates.includes(dateStr);
                      const isPast = date < new Date(new Date().setHours(0,0,0,0));
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={isPast}
                          onClick={() => toggleDate(dateStr)}
                          className={cn(
                            "aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all",
                            isSelected 
                              ? "bg-primary text-white shadow-md" 
                              : isPast 
                                ? "text-slate-200 cursor-not-allowed" 
                                : "hover:bg-primary/10 text-slate-700"
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic mt-2">
                  Cliquez sur les jours pour planifier le nettoyage. Les jours seront groupés par semaine automatiquement.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t shrink-0">
              <button type="button" onClick={resetAndClose} className="flex-1 py-3 rounded-xl border font-bold hover:bg-muted transition-colors">
                Annuler
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="h-5 w-5" />}
                Valider la planification ({selectedDates.length} jour{selectedDates.length > 1 ? 's' : ''})
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
