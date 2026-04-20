import React, { useState, useRef } from 'react';

const HOURS = Array.from({ length: 15 }, (_, i) => (i + 5).toString().padStart(2, '0')); // 05h–19h
const MINUTES = ['00', '30'];
import { X, Calendar as CalendarIcon, MapPin, AlertCircle, CheckCircle2, Clock, Users, Car } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/context/AuthContext';
import { formatLocalDate } from '@/lib/date';

interface ReservationModalProps {
  vehicle: {
    id: string;
    brand: string;
    model: string;
    plateNumber: string;
    imageUrl: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    startTime: string;
    endTime: string;
    destination: string;
    isRecurring?: boolean;
  } | null;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
  initialData
}) => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [startHour, setStartHour] = useState('08');
  const [startMinute, setStartMinute] = useState('00');
  const [endDate, setEndDate] = useState('');
  const [endHour, setEndHour] = useState('16');
  const [endMinute, setEndMinute] = useState('00');
  const [destination, setDestination] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(2);
  const [passengerIds, setPassengerIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  
  // States for dynamic vehicle selection
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      // Load users for accompaniment
      apiFetch('/api/users')
        .then(r => r.ok ? r.json() : [])
        .then((users: any[]) => setAllUsers(
          users.filter((u: any) => u.id !== user?.id)
               .map((u: any) => ({ id: u.id, name: u.name }))
        ))
        .catch(() => {});
      
      // Load vehicles if none provided (e.g. from global calendar)
      if (!vehicle && !initialData) {
        setLoadingVehicles(true);
        apiFetch('/api/vehicles')
          .then(r => r.ok ? r.json() : [])
          .then((data: any[]) => setVehicles(data.filter((v: any) => v.status !== 'BLOCKED')))
          .catch(() => {})
          .finally(() => setLoadingVehicles(false));
      }
    }
  }, [user?.id, isOpen, vehicle, initialData]);

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const start = new Date(initialData.startTime);
        const end = new Date(initialData.endTime);
        setStartDate(formatLocalDate(start));
        setStartHour(start.getHours().toString().padStart(2, '0'));
        setStartMinute(start.getMinutes().toString().padStart(2, '0'));
        setEndDate(formatLocalDate(end));
        setEndHour(end.getHours().toString().padStart(2, '0'));
        setEndMinute(end.getMinutes().toString().padStart(2, '0'));
        setDestination(initialData.destination || '');
        setIsRecurring(!!initialData.isRecurring);
      } else {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        const nextTwoHours = new Date(nextHour);
        nextTwoHours.setHours(nextHour.getHours() + 1);

        setStartDate(formatLocalDate(nextHour));
        setStartHour(nextHour.getHours().toString().padStart(2, '0'));
        setStartMinute('00');
        setEndDate(formatLocalDate(nextTwoHours));
        setEndHour(nextTwoHours.getHours().toString().padStart(2, '0'));
        setEndMinute('00');
        setDestination('');
      }
      setSelectedVehicleId(vehicle?.id || '');
    }
  }, [initialData, isOpen, vehicle]);


  const resetAndClose = () => {
    setStartDate('');
    setEndDate('');
    setStartHour('08');
    setStartMinute('00');
    setEndHour('16');
    setEndMinute('00');
    setDestination('');
    setIsAllDay(false);
    setIsRecurring(false);
    setRecurringCount(2);
    setPassengerIds([]);
    setSelectedVehicleId('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  useFocusTrap(isOpen, resetAndClose, modalRef);

  const handleAllDayChange = (checked: boolean) => {
    setIsAllDay(checked);
    if (checked) {
      const today = new Date();
      const datePart = formatLocalDate(today);
      setStartDate(datePart);
      setEndDate(datePart);
      setStartHour('06');
      setStartMinute('00');
      setEndHour('18');
      setEndMinute('00');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const vId = vehicle?.id || selectedVehicleId;
    if (!vId) {
      setError('Veuillez sélectionner un véhicule.');
      return;
    }

    const fullStartTime = `${startDate}T${startHour}:${startMinute}:00`;
    const fullEndTime = `${endDate}T${endHour}:${endMinute}:00`;

    // Client-side date validation
    if (new Date(fullStartTime) >= new Date(fullEndTime)) {
      setError('La date de fin doit être après la date de début.');
      return;
    }

    setLoading(true);

    try {
      const baseStart = new Date(fullStartTime);
      const baseEnd = new Date(fullEndTime);

      if (initialData?.id) {
        // Mode édition : simple PUT
        const response = await apiFetch(`/api/reservations/${initialData.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            vehicleId: vId,
            startTime: baseStart.toISOString(),
            endTime: baseEnd.toISOString(),
            destination,
            isRecurring,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erreur lors de la modification');
      } else {
        // Mode création : créer N occurrences hebdomadaires en parallèle
        const count = isRecurring ? recurringCount : 1;

        const results = await Promise.all(
          Array.from({ length: count }, (_, i) => {
            const start = new Date(baseStart);
            const end = new Date(baseEnd);
            start.setDate(start.getDate() + i * 7);
            end.setDate(end.getDate() + i * 7);
            return apiFetch('/api/reservations', {
              method: 'POST',
              body: JSON.stringify({
                vehicleId: vId,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                destination,
                passengerIds,
                isRecurring: isRecurring && count > 1,
              }),
            }).then(async res => ({ ok: res.ok, week: i + 1, data: await res.json() }));
          })
        );

        const errors = results.filter(r => !r.ok).map(r => `Semaine ${r.week} : ${r.data.error || 'Conflit'}`);
        if (errors.length > 0) {
          const succeeded = count - errors.length;
          if (succeeded === 0) throw new Error(errors[0]);
          throw new Error(`${succeeded}/${count} réservation(s) créée(s). Conflits : ${errors.join(' | ')}`);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        resetAndClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const activeVehicle = vehicle || vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={resetAndClose} 
      />
      
      <div
        ref={modalRef}
        className="relative w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden rounded-3xl bg-card border shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 id="reservation-modal-title" className="text-xl font-bold text-slate-800">
              {initialData ? 'Modifier ma réservation' : 'Nouvelle réservation'}
            </h3>
              {activeVehicle ? (
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  {activeVehicle.brand} {activeVehicle.model} - {activeVehicle.plateNumber}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  Sélectionnez un véhicule
                </p>
              )}
            </div>
          </div>
          <button
            onClick={resetAndClose}
            aria-label="Fermer"
            className="rounded-full p-2 hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center animate-in fade-in zoom-in duration-300">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h4 className="text-2xl font-bold text-emerald-600">
              {initialData ? 'Réservation modifiée !' : isRecurring && recurringCount > 1 ? `${recurringCount} réservations créées !` : 'Réservation réussie !'}
            </h4>
            <p className="mt-2 text-muted-foreground">
              {isRecurring && recurringCount > 1 && !initialData
                ? `${recurringCount} semaines consécutives planifiées.`
                : 'Votre demande a été enregistrée avec succès.'
              }
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
            {error && (
              <div role="alert" aria-live="polite" className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {/* Vehicle Selection (if none provided) */}
            {!vehicle && !initialData && (
              <div className="space-y-2">
                <label htmlFor="res-vehicle" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Car className="h-3 w-3" /> Véhicule à réserver *
                </label>
                <div className="relative">
                  <Car className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <select
                    id="res-vehicle"
                    required
                    className="w-full rounded-xl border bg-secondary/50 p-3 pl-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    disabled={loadingVehicles}
                  >
                    <option value="">-- Choisir un véhicule --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.brand} {v.model} ({v.plateNumber}) - {v.status === 'AVAILABLE' ? 'Dispo' : 'Occupé'}
                      </option>
                    ))}
                  </select>
                  {loadingVehicles && (
                    <div className="absolute right-3 top-3 h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-accent/5 border border-accent/20">
                <input 
                  type="checkbox" 
                  id="allDay" 
                  className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent accent-accent"
                  checked={isAllDay}
                  onChange={(e) => handleAllDayChange(e.target.checked)}
                />
                <label htmlFor="allDay" className="text-sm font-bold text-primary cursor-pointer">
                  Journée entière
                </label>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-4 rounded-xl border transition-all",
                isRecurring ? "bg-primary/5 border-primary/40" : "bg-primary/5 border-primary/20"
              )}>
                <input
                  type="checkbox"
                  id="recurring"
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary shrink-0"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  disabled={!!initialData}
                />
                <label htmlFor="recurring" className="text-sm font-bold text-primary cursor-pointer">
                  Récurrence hebdomadaire
                </label>
              </div>
            </div>

            {/* Sélecteur nombre de récurrences */}
            {isRecurring && !initialData && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="text-xs font-black">×{recurringCount}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-primary mb-1">Nombre de semaines</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRecurringCount(n)}
                        className={cn(
                          "h-8 w-8 rounded-lg text-xs font-black transition-all",
                          recurringCount === n
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "bg-white border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium max-w-[90px] text-right">
                  {recurringCount} réservation{recurringCount > 1 ? 's' : ''} créée{recurringCount > 1 ? 's' : ''}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <label htmlFor="res-start-date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                   <Clock className="h-3 w-3" /> Début de mission
                </label>
                <div className="space-y-2">
                  <input
                    id="res-start-date"
                    required
                    type="date"
                    className="w-full rounded-xl border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <select
                      aria-label="Heure de début"
                      className="flex-1 rounded-xl border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-center font-bold"
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                    >
                      {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
                    </select>
                    <select
                      aria-label="Minute de début"
                      className="flex-1 rounded-xl border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-center font-bold"
                      value={startMinute}
                      onChange={(e) => setStartMinute(e.target.value)}
                    >
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label htmlFor="res-end-date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                   <Clock className="h-3 w-3" /> Fin de mission
                </label>
                <div className="space-y-2">
                  <input
                    id="res-end-date"
                    required
                    type="date"
                    className="w-full rounded-xl border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <select 
                      aria-label="Heure de fin"
                      className="flex-1 rounded-xl border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-center font-bold"
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                    >
                      {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
                    </select>
                    <select 
                      aria-label="Minute de fin"
                      className="flex-1 rounded-xl border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-center font-bold"
                      value={endMinute}
                      onChange={(e) => setEndMinute(e.target.value)}
                    >
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="res-destination" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Destination / Motif
              </label>
              <p className="text-red-500 text-[10px] font-semibold" role="alert">
                ⚠️ Ne saisissez pas de noms de bénéficiaires/usagers (RGPD)
              </p>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="res-destination"
                  type="text"
                  placeholder="Ex: SESSAD, Réunion administrative, Visite terrain..."
                  className="w-full rounded-xl border bg-secondary/50 p-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>

            {/* ── Accompagnants ── */}
            {allUsers.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="h-3 w-3" /> Accompagnants
                </label>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl border bg-secondary/50 min-h-[48px]">
                  {allUsers.map(u => {
                    const selected = passengerIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setPassengerIds(prev =>
                          selected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        )}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-bold transition-all border',
                          selected
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-primary'
                        )}
                      >
                        {selected ? '✓ ' : ''}{u.name}
                      </button>
                    );
                  })}
                </div>
                {passengerIds.length > 0 && (
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {passengerIds.length} accompagnant{passengerIds.length > 1 ? 's' : ''} sélectionné{passengerIds.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            <div className="pt-4 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={resetAndClose}
                className="flex-1 rounded-xl border py-3 text-sm font-bold hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {initialData ? 'Mettre à jour' : 'Confirmer la réservation'}
            </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
