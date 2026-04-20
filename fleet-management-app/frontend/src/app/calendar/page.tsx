'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { Sidebar } from '@/components/ui/Sidebar';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Car,
  User,
  Info,
  Filter,
  Check,
  MapPin,
  Trash2,
  X,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ReservationModal } from '@/components/ui/ReservationModal';
import { useRef } from 'react';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 6h to 18h
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const VEHICLE_COLORS = [
  'bg-blue-600 border-blue-700',
  'bg-emerald-600 border-emerald-700',
  'bg-orange-600 border-orange-700',
  'bg-purple-600 border-purple-700',
  'bg-rose-600 border-rose-700',
  'bg-amber-600 border-amber-700',
  'bg-indigo-600 border-indigo-700',
  'bg-teal-600 border-teal-700',
  'bg-cyan-600 border-cyan-700',
  'bg-lime-600 border-lime-700',
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [pinnedEventId, setPinnedEventId] = useState<string | null>(null);
  const pinnedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
   const gridRef = useRef<HTMLDivElement>(null);
   const [selection, setSelection] = useState<{ dayIdx: number; startHour: number; endHour: number } | null>(null);
   const [isSelecting, setIsSelecting] = useState(false);
   const { user, loading: authLoading } = useAuth();

  const isCadre = user && ['ADMIN', 'DIRECTEUR', 'MANAGER'].includes(user.role);
  const canEditRes = (res: any) => isCadre || res.userId === user?.id;

  const fetchData = async () => {
    try {
      const [resReservations, resVehicles] = await Promise.all([
        apiFetch('/api/reservations'),
        apiFetch('/api/vehicles')
      ]);
      const [dataReservations, dataVehicles] = await Promise.all([
        resReservations.json(),
        resVehicles.json()
      ]);
      setReservations(dataReservations);
      setVehicles(dataVehicles);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const startOfWeek = getStartOfWeek(currentDate);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() + 7);
    setCurrentDate(d);
  };

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() - 7);
    setCurrentDate(d);
  };

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  const handleDelete = async (resId: string) => {
    try {
      const res = await apiFetch(`/api/reservations/${resId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleEventClick = (resId: string) => {
    if (pinnedTimeoutRef.current) clearTimeout(pinnedTimeoutRef.current);
    setPinnedEventId(resId);
    pinnedTimeoutRef.current = setTimeout(() => setPinnedEventId(null), 5000);
  };

  const handleEditClick = (res: any) => {
    setEditingReservation(res);
    setIsModalOpen(true);
  };

  const handleMouseDown = (dayIdx: number, hour: number, e: React.MouseEvent) => {
    if (selectedVehicleId === 'all') return;
    setIsSelecting(true);
    setSelection({ dayIdx, startHour: hour, endHour: hour });
  };

  const handleMouseMove = (hour: number) => {
    if (!isSelecting || !selection) return;
    setSelection(prev => prev ? { ...prev, endHour: hour + 0.5 } : null);
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selection) return;
    setIsSelecting(false);
    
    const sH = Math.min(selection.startHour, selection.endHour);
    const eH = Math.max(selection.startHour, selection.endHour);
    
    if (eH - sH >= 0.5) {
      const start = new Date(weekDays[selection.dayIdx]);
      start.setHours(Math.floor(sH), (sH % 1) * 60, 0, 0);
      
      const end = new Date(weekDays[selection.dayIdx]);
      end.setHours(Math.floor(eH), (eH % 1) * 60, 0, 0);

      setEditingReservation({
        vehicle: selectedVehicle,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        destination: ''
      });
      setIsModalOpen(true);
    }
    setSelection(null);
  };

  // -- EFFECT HOOKS --
  useEffect(() => {
    setMounted(true);
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user]);

  useEffect(() => () => { if (pinnedTimeoutRef.current) clearTimeout(pinnedTimeoutRef.current); }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mounted && gridRef.current) {
      const nowHour = now.getHours() + now.getMinutes() / 60;
      const top = Math.max(0, (nowHour - 6) * 96 - 120);
      setTimeout(() => gridRef.current?.scrollTo({ top, behavior: 'smooth' }), 400);
    }
  }, [mounted]);

  useEffect(() => {
    if (isSelecting) {
      const onMouseUpGlobal = () => handleMouseUp();
      window.addEventListener('mouseup', onMouseUpGlobal);
      return () => window.removeEventListener('mouseup', onMouseUpGlobal);
    }
  }, [isSelecting, selection]);

  if (authLoading || (loading && user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-bold text-muted-foreground animate-pulse uppercase tracking-widest">Initialisation calendrier sécurisé...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const filteredReservations = (selectedVehicleId === 'all' 
    ? reservations 
    : reservations.filter(r => r.vehicleId === selectedVehicleId)
  ).map(res => {
    const vehicleIndex = vehicles.findIndex(v => v.id === res.vehicleId);
    const colorClass = vehicleIndex !== -1 ? VEHICLE_COLORS[vehicleIndex % VEHICLE_COLORS.length] : 'bg-primary border-primary';
    return { ...res, colorClass };
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main id="main-content" tabIndex={-1} className="lg:pl-28 min-h-screen pb-20 outline-none">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
             <CalendarIcon className="h-6 w-6 text-primary" />
             <div>
                <h1 className="text-xl font-bold tracking-tight">Planning de la Flotte</h1>
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
                   {selectedVehicleId === 'all' ? 'Vue Globale' : `Vue Individuelle : ${selectedVehicle?.brand} ${selectedVehicle?.model}`}
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
             {/* Nouvelle Réservation */}
             <button
               onClick={() => {
                 setEditingReservation({
                   vehicle: selectedVehicleId !== 'all' ? selectedVehicle : null,
                   startTime: new Date().toISOString(),
                   endTime: new Date(Date.now() + 3600000).toISOString(),
                   destination: ''
                 });
                 setIsModalOpen(true);
               }}
               className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95"
             >
               <Plus aria-hidden="true" className="h-4 w-4" /> <span className="hidden sm:inline">Nouvelle réservation</span>
             </button>

             {/* Vehicle Selector */}
             <div className="relative">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center gap-2 rounded-xl bg-card border px-4 py-2 text-sm font-bold shadow-sm hover:bg-secondary transition-all"
                >
                   <Filter className="h-4 w-4 text-primary" />
                   <span className="max-w-[150px] truncate">
                      {selectedVehicleId === 'all' ? 'Tous les véhicules' : `${selectedVehicle?.brand} ${selectedVehicle?.model}`}
                   </span>
                </button>
                
                {isFilterOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl p-2 z-50 animate-in slide-in-from-top-2 duration-200">
                     <button 
                       onClick={() => { setSelectedVehicleId('all'); setIsFilterOpen(false); }}
                       className={cn(
                         "w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between hover:bg-secondary transition-colors",
                         selectedVehicleId === 'all' ? "text-primary bg-primary/10" : ""
                       )}
                     >
                        Tous les véhicules
                        {selectedVehicleId === 'all' && <Check className="h-4 w-4" />}
                     </button>
                     <div className="h-px bg-border my-1" />
                     <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {vehicles.map(v => (
                          <button 
                            key={v.id}
                            onClick={() => { setSelectedVehicleId(v.id); setIsFilterOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between hover:bg-secondary transition-colors",
                              selectedVehicleId === v.id ? "text-primary bg-primary/10" : ""
                            )}
                          >
                             <div className="flex flex-col">
                                <span>{v.brand} {v.model}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{v.plateNumber}</span>
                             </div>
                             {selectedVehicleId === v.id && <Check className="h-4 w-4" />}
                          </button>
                        ))}
                     </div>
                  </div>
                )}
             </div>

             <div className="flex items-center gap-4 bg-muted p-1 rounded-xl">
               <button onClick={prevWeek} className="p-2 hover:bg-card rounded-lg transition-all"><ChevronLeft className="h-4 w-4" /></button>
               <span className="text-sm font-bold px-2">
                 Semaine du {startOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
               </span>
               <button onClick={nextWeek} className="p-2 hover:bg-card rounded-lg transition-all"><ChevronRight className="h-4 w-4" /></button>
             </div>
          </div>
        </header>

        <section className="p-8 overflow-x-auto">
          <div className="min-w-[1000px] glass rounded-3xl border shadow-xl overflow-hidden">
            {/* Header jours */}
            <div className="grid grid-cols-8 border-b bg-muted/30 sticky top-0 z-20 backdrop-blur-md">
              <div className="p-4 border-r flex flex-col items-center justify-center gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sem.</span>
                <span className="text-lg font-black text-muted-foreground/40">
                  {startOfWeek.toLocaleDateString('fr-FR', { day: '2-digit' })}
                </span>
              </div>
              {weekDays.map((day, i) => {
                const isToday = mounted && day.toDateString() === new Date().toDateString();
                return (
                  <div key={i} className={cn(
                    "p-4 border-r text-center transition-all",
                    isToday ? "bg-primary text-white" : "hover:bg-muted/50"
                  )}>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isToday ? "text-white/80" : "text-muted-foreground")}>{DAYS[i]}</p>
                    <div className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-black mx-auto",
                      isToday ? "bg-white/20 text-white" : "text-foreground"
                    )}>
                      {day.getDate()}
                    </div>
                    {isToday && (
                      <p className="text-[9px] text-white/70 font-bold mt-1">
                        {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grille */}
            <div ref={gridRef} className="overflow-y-auto max-h-[calc(100vh-280px)]">
            <div className="grid grid-cols-8 divide-x relative">
               <div className="flex flex-col divide-y bg-muted/20 sticky left-0 z-10">
                  {HOURS.map(hour => (
                    <div key={hour} className="h-24 p-2 text-right flex flex-col justify-start">
                      <span className="text-[10px] font-black text-muted-foreground">{String(hour).padStart(2, '0')}:00</span>
                      <span className="mt-auto text-[9px] text-muted-foreground/30 border-t pt-1">{String(hour).padStart(2, '0')}:30</span>
                    </div>
                  ))}
               </div>

               {weekDays.map((day, dayIdx) => {
                 const isToday = mounted && day.toDateString() === new Date().toDateString();
                 const nowHour = now.getHours() + now.getMinutes() / 60;
                 const nowTop = (nowHour - 6) * 96;
                 const showNowLine = isToday && nowHour >= 6 && nowHour <= 19;

                 return (
                 <div key={dayIdx} className={cn("relative h-[1248px] divide-y divide-dashed divide-border/50", isToday ? "bg-primary/[0.02]" : "")}>
                    {HOURS.map(hour => (
                      <div 
                        key={hour} 
                        className="h-24 w-full relative group/cell"
                      >
                        {/* 30min zones for better precision */}
                        <div 
                          className="h-1/2 w-full hover:bg-primary/5 transition-colors cursor-crosshair" 
                          onMouseDown={(e) => handleMouseDown(dayIdx, hour, e)}
                          onMouseEnter={() => handleMouseMove(hour)}
                        />
                        <div 
                          className="h-1/2 w-full border-t border-dashed border-border/30 hover:bg-primary/5 transition-colors cursor-crosshair" 
                          onMouseDown={(e) => handleMouseDown(dayIdx, hour + 0.5, e)}
                          onMouseEnter={() => handleMouseMove(hour + 0.5)}
                        />
                      </div>
                    ))}

                    {/* Selection Overlay */}
                    {selection && selection.dayIdx === dayIdx && (
                      <div 
                        className="absolute left-1 right-1 bg-primary/30 border-2 border-primary/50 shadow-lg rounded-lg pointer-events-none z-40 transition-all flex flex-col items-center justify-center overflow-hidden"
                        style={{
                          top: `${(Math.min(selection.startHour, selection.endHour) - 6) * 96}px`,
                          height: `${Math.abs(selection.endHour - selection.startHour) * 96}px`
                        }}
                      >
                         <div className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">
                            RÉSERVER
                         </div>
                      </div>
                    )}

                    {/* Ligne heure actuelle */}
                    {showNowLine && (
                      <div
                        className="absolute left-0 right-0 z-30 pointer-events-none"
                        style={{ top: `${nowTop}px` }}
                      >
                        <div className="relative flex items-center">
                          <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.5)] shrink-0 -ml-1.5" />
                          <div className="flex-1 h-[2px] bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
                        </div>
                        {dayIdx === 0 && (
                          <div className="absolute -top-3 left-3 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-lg">
                            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Events Layer */}
                    <div className="absolute inset-0 pointer-events-none">
                       {filteredReservations.filter(res => {
                          const start = new Date(res.startTime);
                          return start.toDateString() === day.toDateString();
                       }).map((res, resIdx, dayResArray) => {
                          const start = new Date(res.startTime);
                          const end = new Date(res.endTime);
                          const startHour = start.getHours() + (start.getMinutes() / 60);
                          const endHour = end.getHours() + (end.getMinutes() / 60);
                          
                          // Only show if within 6h-18h
                          if (endHour < 6 || startHour > 18) return null;
                          
                          const displayStart = Math.max(6, startHour);
                          const displayEnd = Math.min(19, endHour); 
                          const top = (displayStart - 6) * 96;
                          const height = (displayEnd - displayStart) * 96;

                          const overlaps = dayResArray.filter(other => {
                             const oStart = new Date(other.startTime);
                             const oEnd = new Date(other.endTime);
                             const oSH = oStart.getHours() + (oStart.getMinutes() / 60);
                             const oEH = oEnd.getHours() + (oEnd.getMinutes() / 60);
                             return (oSH < displayEnd && oEH > displayStart);
                          });
                          
                          const overlapIndex = overlaps.findIndex(o => o.id === res.id);
                          const width = 100 / overlaps.length;
                          const left = overlapIndex * width;

                          return (
                            <div 
                              key={res.id}
                              tabIndex={0}
                              role="button"
                              aria-label={`Réservation pour ${res.vehicle?.brand} ${res.vehicle?.model} par ${res.user?.name}`}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEventClick(res.id); } }}
                              onMouseEnter={() => setHoveredEventId(res.id)}
                              onMouseLeave={() => setHoveredEventId(null)}
                              onClick={() => handleEventClick(res.id)}
                              className={cn(
                                "absolute rounded-lg p-2 text-[9px] font-bold text-white shadow-xl border-t-2 overflow-visible group cursor-pointer pointer-events-auto transition-all hover:z-50 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent",
                                res.colorClass,
                                pinnedEventId === res.id ? "ring-4 ring-white ring-offset-2 ring-offset-primary transform scale-[1.05] z-[60]" : ""
                              )}
                              style={{ 
                                top: `${top}px`, 
                                height: `${height}px`,
                                left: `${left}%`,
                                width: `${width - 1}%`
                              }}
                            >
                               <div className="flex flex-col h-full relative overflow-hidden">
                                  <p className="truncate font-black uppercase tracking-tighter leading-tight">
                                     {res.vehicle?.brand} {res.vehicle?.model}
                                  </p>
                                  <p className="truncate text-[8px] opacity-90 font-mono mt-0.5">
                                     {res.vehicle?.plateNumber}
                                  </p>
                                  
                                  {height > 40 && (
                                    <div className="mt-auto pt-1 border-t border-white/20 flex items-center justify-between">
                                       <span className="truncate flex items-center gap-1">
                                          <User className="h-2 w-2" /> {res.user?.name}
                                       </span>
                                       {canEditRes(res) && (
                                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(res.id); }}
                                              className="p-1 hover:bg-white/20 rounded"
                                              aria-label="Supprimer la réservation"
                                            >
                                               <X aria-hidden="true" className="h-2 w-2" />
                                            </button>
                                         </div>
                                       )}
                                    </div>
                                  )}
                               </div>

                               {(hoveredEventId === res.id || pinnedEventId === res.id) && (
                                 <div className={cn(
                                   "absolute w-48 z-[100] bg-card border shadow-2xl rounded-xl p-4 animate-in fade-in zoom-in duration-200 pointer-events-auto cursor-default",
                                   dayIdx > 4 ? "right-[105%]" : "left-[105%]",
                                   top < 200 ? "top-0" : "bottom-0"
                                 )}>
                                    <div className="flex items-center gap-2 mb-3">
                                       <div className={cn("h-3 w-3 rounded-full", res.colorClass)} />
                                       <span className="text-xs font-black uppercase tracking-widest text-primary">Détails Réservation</span>
                                       {pinnedEventId === res.id && (
                                         <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[7px] animate-pulse">
                                            ACTIF
                                         </div>
                                       )}
                                    </div>
                                    <div className="space-y-2 text-[10px] text-slate-600" onClick={(e) => e.stopPropagation()}>
                                       <div className="flex items-center gap-2 font-bold text-slate-900">
                                          <Car className="h-3 w-3 text-primary" /> {res.vehicle?.brand} {res.vehicle?.model}
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <Info className="h-3 w-3 text-muted-foreground" /> {res.vehicle?.plateNumber}
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <User className="h-3 w-3 text-muted-foreground" /> {res.user?.name}
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <Clock className="h-3 w-3 text-muted-foreground" /> 
                                          {new Date(res.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - 
                                          {new Date(res.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                       </div>
                                       <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border italic">
                                          <MapPin className="h-3 w-3 shrink-0" /> {res.destination || 'Sans destination'}
                                       </div>
                                    </div>
                                     {canEditRes(res) && (
                                      <div className="mt-3 pt-3 border-t flex gap-2" onClick={(e) => e.stopPropagation()}>
                                         <button
                                           onClick={() => handleEditClick(res)}
                                           className="flex-1 bg-primary text-white py-1.5 rounded-lg text-[9px] font-bold hover:bg-primary/90 transition-colors"
                                         >
                                            Modifier
                                         </button>
                                         <button
                                           onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(res.id); }}
                                           className="px-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20"
                                           title="Annuler la réservation"
                                           aria-label="Annuler la réservation"
                                         >
                                            <Trash2 aria-hidden="true" className="h-3 w-3" />
                                         </button>
                                      </div>
                                    )}
                                 </div>
                               )}
                            </div>
                          )
                       })}
                    </div>
                 </div>
                );
                })}
             </div>
             </div>{/* end scroll wrapper */}

            <div className="p-4 bg-muted/20 border-t flex items-center justify-center gap-6 text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex-wrap">
               <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-primary shadow-sm"></div> Réservation</div>
               <div className="flex items-center gap-2">
                 <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                 <span className="text-red-500">Heure actuelle</span>
               </div>
               <div className="flex items-center gap-2 font-black text-primary">6h00 — 18h00</div>
               {selectedVehicleId !== 'all' && (
                 <div className="flex items-center gap-2 text-accent">
                    <Info className="h-3 w-3" /> Filtré sur {selectedVehicle?.brand} {selectedVehicle?.model}
                 </div>
               )}
            </div>
          </div>
        </section>
      </main>

      {isModalOpen && editingReservation && (
        <ReservationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingReservation(null);
          }}
          onSuccess={() => {
            fetchData();
          }}
          vehicle={editingReservation.vehicle}
          initialData={{
            id: editingReservation.id,
            startTime: editingReservation.startTime,
            endTime: editingReservation.endTime,
            destination: editingReservation.destination,
            isRecurring: editingReservation.isRecurring
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Supprimer la réservation"
        description="Cette réservation sera définitivement supprimée. Cette action est irréversible."
        confirmLabel="Supprimer la réservation"
        danger
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
