'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/Sidebar';
import { CleaningLogModal } from '@/components/ui/CleaningLogModal';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/context/AuthContext';
import { formatLocalDate, getMonday, isoWeek, formatWeek } from '@/lib/date';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CheckCircle2, Sparkles, Car, ChevronDown, ChevronUp, Calendar, AlertTriangle } from 'lucide-react';

interface UserSimple { id: string; name: string; }
interface Service { id: string; name: string; }
interface Vehicle { id: string; brand: string; model: string; plateNumber: string; service: Service | null; }
interface Assignment { id: string; userId: string; user: UserSimple; completedAt: string | null; }
interface CleaningLog {
  id: string;
  date: string;
  notes: string | null;
  userId: string;
  user: { id: string; name: string };
}
interface Schedule { 
  id: string; 
  vehicleId: string; 
  isDone: boolean; 
  plannedDays: string | null;
  assignments: Assignment[]; 
  logs: CleaningLog[];
}
interface Item { vehicle: Vehicle; schedule: Schedule | null; }

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function VehicleCleanCard({
  vehicle, schedule, weekDate, onOpenLog,
}: {
  vehicle: Vehicle;
  schedule: Schedule;
  weekDate: Date;
  onOpenLog: (vehicle: Vehicle, scheduleId: string, date: Date) => void;
}) {
  const plannedDays = schedule.plannedDays?.split(',').map(Number) || [];
  
  const days = [1, 2, 3, 4, 5, 6, 0].map((d, i) => {
    const date = new Date(weekDate);
    date.setDate(date.getDate() + i);
    const isoDate = formatLocalDate(date);
    const hasLog = schedule.logs.some(l => l.date.startsWith(isoDate));
    const isPlanned = plannedDays.includes(d);
    
    return { date, hasLog, isPlanned, label: DAYS_SHORT[i] };
  });

  return (
    <div className={cn(
      "rounded-2xl border bg-white shadow-sm p-5 flex flex-col gap-4 transition-all",
      schedule.isDone ? 'border-green-200 bg-green-50/30' : 'border-slate-200'
    )}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Car className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 leading-tight">{vehicle.brand} {vehicle.model}</p>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-tighter">{vehicle.plateNumber}</p>
          {vehicle.service && (
            <span className="mt-1 inline-block text-[9px] font-bold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 uppercase">
              {vehicle.service.name}
            </span>
          )}
        </div>
        {schedule.isDone && (
          <span className="text-[10px] font-bold bg-green-100 text-green-700 rounded-full px-2 py-0.5 shrink-0 border border-green-200">
            Terminé ✓
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5 mt-1">
        {days.map(({ date, hasLog, isPlanned, label }, i) => (
          <button
            key={i}
            onClick={() => onOpenLog(vehicle, schedule.id, date)}
            className={cn(
              "flex flex-col items-center gap-1.5 py-2 rounded-xl transition-all active:scale-90 border",
              hasLog 
                ? "bg-green-500 border-green-600 text-white shadow-sm shadow-green-200" 
                : isPlanned 
                  ? "border-blue-500 border-2 bg-white text-blue-600 shadow-sm shadow-blue-50" 
                  : "bg-slate-50 border-slate-100 text-slate-400"
            )}
            title={hasLog ? "Nettoyage effectué" : isPlanned ? "Nettoyage planifié" : "Non planifié"}
          >
            <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              hasLog ? "bg-white" : isPlanned ? "bg-blue-500" : "bg-slate-300"
            )} />
          </button>
        ))}
      </div>

      {schedule.assignments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {schedule.assignments.map(a => (
            <span
              key={a.id}
              className={cn(
                "text-[10px] rounded-full px-2 py-0.5 flex items-center gap-1 border",
                a.completedAt
                  ? 'bg-green-50 text-green-700 border-green-100 font-bold'
                  : 'bg-slate-50 text-slate-500 border-slate-100'
              )}
            >
              {a.completedAt && <CheckCircle2 className="h-2.5 w-2.5" />}
              {a.user.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NettoyagePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [weekDate, setWeekDate] = useState<Date>(getMonday(new Date()));
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOthers, setShowOthers] = useState(false);
  const [pendingWeeks, setPendingWeeks] = useState<string[]>([]);

  // Log Modal states
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedLogDay, setSelectedLogDay] = useState<Date>(new Date());

  const fetchNotificationSummary = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications/summary');
      if (res.ok) {
        const data = await res.json();
        if (data.details?.cleaningWeeks) {
          setPendingWeeks(data.details.cleaningWeeks.map((d: string) => d.split('T')[0]));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/'); return; }
    if (['ADMIN', 'DIRECTEUR', 'MANAGER'].includes(user.role)) {
      router.replace('/admin/cleaning');
    } else {
      fetchNotificationSummary();
    }
  }, [authLoading, user, router, fetchNotificationSummary]);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/cleaning?week=${isoWeek(weekDate)}`);
      if (res.ok) {
        const data = await res.json();
        setItems((data.items || []).filter((i: Item) => i.schedule !== null));
      }
    } finally {
      setLoading(false);
    }
  }, [weekDate]);

  useEffect(() => {
    if (!authLoading && user && user.role === 'PROFESSIONNEL') fetchSchedule();
  }, [authLoading, user, fetchSchedule]);

  const onSave = async () => {
    await fetchSchedule();
    await fetchNotificationSummary();
  };

  const openLogModal = (vehicle: Vehicle, scheduleId: string, date: Date) => {
    setSelectedVehicle(vehicle);
    setSelectedScheduleId(scheduleId);
    setSelectedLogDay(date);
    setIsLogModalOpen(true);
  };

  if (authLoading || !user) return null;

  const currentMonday = getMonday(new Date());
  const isToday = isoWeek(weekDate) === isoWeek(currentMonday);
  const prevWeek = () => { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d); };
  const nextWeek = () => { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d); };

  // Filter pending weeks to only show those BEFORE current week
  const pastPendingWeeks = pendingWeeks.filter(w => w < isoWeek(currentMonday) && w !== isoWeek(weekDate));

  // Split: my assignments vs other scheduled vehicles
  const myItems = items.filter(i => i.schedule!.assignments.some(a => a.userId === user.id));
  const otherItems = items.filter(i => !i.schedule!.assignments.some(a => a.userId === user.id));

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="p-4 lg:pl-36 lg:p-12 transition-all duration-300 outline-none">

        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-accent" />
              Mes Nettoyages
            </h1>
            <p className="text-slate-500 mt-1">Confirmez les véhicules que vous avez nettoyés</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors" aria-label="Semaine précédente">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <div className="relative group">
              <button
                onClick={() => setWeekDate(getMonday(new Date()))}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${isToday ? 'bg-primary text-white border-primary' : 'border-slate-200 hover:bg-slate-100 text-slate-700'}`}
              >
                {formatWeek(weekDate)}
              </button>
              {pendingWeeks.includes(isoWeek(weekDate)) && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </div>
            <button onClick={nextWeek} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors" aria-label="Semaine suivante">
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Pending Weeks Alert */}
        {pastPendingWeeks.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in slide-in-from-top-4 duration-500">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">Retards détectés</p>
              <p className="text-xs text-amber-700">Vous avez des nettoyages non validés sur des semaines passées :</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pastPendingWeeks.map(w => (
                <button
                  key={w}
                  onClick={() => setWeekDate(new Date(w))}
                  className="px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-xs font-black text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Calendar className="h-3 w-3" />
                  {formatWeek(new Date(w))}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Chargement...</p>
          </div>
        ) : (
          <>
            {/* ── My assigned vehicles ── */}
            {myItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Sparkles className="h-10 w-10 opacity-20" />
                <p className="text-sm font-semibold">Aucun véhicule ne vous est assigné cette semaine</p>
                <p className="text-xs text-center max-w-xs">
                  Si vous avez quand même effectué un nettoyage, utilisez la section ci-dessous.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Vos véhicules assignés — {myItems.length}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-8">
                  {myItems.map(({ vehicle, schedule }) => (
                    <VehicleCleanCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      schedule={schedule!}
                      weekDate={weekDate}
                      onOpenLog={openLogModal}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── Other vehicles in service (for replacement declarations) ── */}
            {otherItems.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowOthers(v => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-3"
                >
                  {showOthers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  J'ai nettoyé un autre véhicule de mon service
                  <span className="text-xs bg-amber-100 text-amber-600 rounded-full px-2 py-0.5 font-bold">
                    {otherItems.length}
                  </span>
                </button>

                {showOthers && (
                  <>
                    <p className="text-xs text-slate-400 mb-3 ml-6">
                      Ces véhicules ont un nettoyage planifié cette semaine mais vous n'étiez pas assigné(e).
                      Cliquez sur une pastille de jour pour déclarer votre passage.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ml-6">
                      {otherItems.map(({ vehicle, schedule }) => (
                        <VehicleCleanCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          schedule={schedule!}
                          weekDate={weekDate}
                          onOpenLog={openLogModal}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {selectedVehicle && selectedScheduleId && (
        <CleaningLogModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          date={selectedLogDay}
          vehicle={selectedVehicle}
          scheduleId={selectedScheduleId}
          onSave={onSave}
        />
      )}
    </div>
  );
}
