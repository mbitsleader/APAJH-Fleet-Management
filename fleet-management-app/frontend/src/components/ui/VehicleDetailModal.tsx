'use client';

import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { X, Car, Gauge, Fuel, Calendar, User, Users, Info, AlertTriangle, Clock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VehiclePlaceholder } from './VehicleCard';
import { getCarImageUrl } from '@/lib/carImage';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 6h to 18h
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface VehicleDetailModalProps {
  vehicle: any;
  isOpen: boolean;
  onClose: () => void;
}

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({ vehicle, isOpen, onClose }) => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiImgError, setApiImgError] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isOpen, onClose, modalRef);

  useEffect(() => {
    if (isOpen && vehicle) {
      const fetchVehicleData = async () => {
        setLoading(true);
        try {
          const res = await apiFetch(`/api/reservations/vehicle/${vehicle.id}`);
          const data = await res.json();
          setReservations(data);
        } catch (error) {
          console.error('Error fetching vehicle details:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchVehicleData();
    }
  }, [isOpen, vehicle]);

  // Helper to get start of current week
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  if (!isOpen || !vehicle) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-[2px] bg-black/70 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-detail-title"
        className="glass w-full max-w-4xl h-full overflow-hidden rounded-[30px] shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20"
      >
        <div className="relative p-10 h-full overflow-y-auto">
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-8 top-8 rounded-full p-3 text-muted-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary z-50 bg-background/50 backdrop-blur-sm"
          >
            <X aria-hidden="true" className="h-6 w-6" />
          </button>

          {/* Header */}
          <div className="mb-8 flex items-center gap-6">
            <div className="h-24 w-40 overflow-hidden rounded-2xl border border-white/10">
              {vehicle.imageUrl ? (
                <img
                  src={vehicle.imageUrl}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  className="h-full w-full object-cover"
                />
              ) : !apiImgError && getCarImageUrl(vehicle.brand, vehicle.model) ? (
                <img
                  src={getCarImageUrl(vehicle.brand, vehicle.model)!}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  className="h-full w-full object-contain bg-white"
                  onError={() => setApiImgError(true)}
                />
              ) : (
                <VehiclePlaceholder brand={vehicle.brand} model={vehicle.model} />
              )}
            </div>
            <div>
              <h2 id="vehicle-detail-title" className="text-3xl font-black tracking-tighter text-primary uppercase">
                {vehicle.brand} <span className="text-accent italic">{vehicle.model}</span>
              </h2>
              <p className="font-mono text-sm font-bold text-muted-foreground bg-muted/50 px-3 py-1 rounded-lg inline-block mt-2">
                {vehicle.plateNumber}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Characteristics */}
            <div className="space-y-6">
               <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4" /> Fiche Technique
               </h3>
               <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border">
                     <div className="flex items-center gap-3">
                        <Gauge className="h-5 w-5 text-primary" />
                        <span className="text-sm font-bold">Kilométrage</span>
                     </div>
                     <span className="text-sm font-black">{vehicle.currentMileage.toLocaleString()} km</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border">
                     <div className="flex items-center gap-3">
                        <Fuel className="h-5 w-5 text-orange-500" />
                        <span className="text-sm font-bold">Énergie</span>
                     </div>
                     <span className="text-sm font-black uppercase">{vehicle.fuelType}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border">
                     <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-blue-500" />
                        <span className="text-sm font-bold">Catégorie</span>
                     </div>
                     <span className="text-sm font-black uppercase text-xs">{vehicle.category}</span>
                  </div>

                  {/* Nouveau: Contrôle Technique */}
                  <div className={cn(
                    "flex flex-col gap-2 p-4 rounded-2xl border transition-all",
                    (() => {
                      if (!vehicle.nextTechnicalInspection) return "bg-muted/20";
                      const diff = Math.ceil((new Date(vehicle.nextTechnicalInspection).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      return diff <= 7 ? "bg-rose-50 border-rose-200" : diff <= 30 ? "bg-amber-50 border-amber-200" : "bg-muted/20";
                    })()
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className={cn(
                          "h-5 w-5",
                          (() => {
                            if (!vehicle.nextTechnicalInspection) return "text-slate-400";
                            const diff = Math.ceil((new Date(vehicle.nextTechnicalInspection).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            return diff <= 7 ? "text-rose-500" : diff <= 30 ? "text-amber-500" : "text-emerald-500";
                          })()
                        )} />
                        <span className="text-sm font-bold">Contrôle Technique</span>
                      </div>
                      <span className="text-sm font-black uppercase">
                        {vehicle.nextTechnicalInspection 
                          ? new Date(vehicle.nextTechnicalInspection).toLocaleDateString('fr-FR')
                          : 'Non défini'}
                      </span>
                    </div>
                    {vehicle.nextTechnicalInspection && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-center opacity-60">
                        {(() => {
                          const diff = Math.ceil((new Date(vehicle.nextTechnicalInspection).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          if (diff < 0) return "Date dépassée !";
                          if (diff <= 7) return `Urgent : dans ${diff} jours`;
                          if (diff <= 30) return `À prévoir : dans ${diff} jours`;
                          return `Prochain dans ${diff} jours`;
                        })()}
                      </p>
                    )}
                  </div>
               </div>
            </div>

            {/* Reservations */}
            <div className="space-y-6">
               <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Planning de réservation
               </h3>
                <div className="space-y-3">
                   {loading ? (
                     <p className="text-sm text-muted-foreground italic">Chargement du planning...</p>
                   ) : reservations.length === 0 ? (
                     <div className="p-8 text-center glass rounded-2xl border border-dashed">
                        <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground font-bold">Aucune réservation à venir</p>
                     </div>
                   ) : (
                     <>
                       {reservations.slice(0, 5).map(res => (
                         <div key={res.id} className="p-4 rounded-2xl border bg-card/40 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/50 transition-colors">
                            <div className="flex items-center justify-between">
                               <span className="text-[10px] font-black uppercase text-primary tracking-tighter">
                                  {new Date(res.startTime).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                               </span>
                               <span className="text-[10px] font-bold text-muted-foreground">
                                  {new Date(res.startTime).getHours()}h - {new Date(res.endTime).getHours()}h
                               </span>
                            </div>
                             <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-bold">{res.user?.name}</span>
                             </div>

                             {res.passengers && res.passengers.length > 0 && (
                               <div className="flex items-center gap-2 mt-1">
                                 <Users className="h-3 w-3 text-primary/60" />
                                 <div className="flex flex-wrap gap-1">
                                   {res.passengers.map((p: any) => (
                                     <span key={p.userId} className="text-[10px] font-medium bg-primary/5 text-primary/80 px-1.5 py-0.5 rounded-md border border-primary/10">
                                       {p.user?.name}
                                     </span>
                                   ))}
                                 </div>
                               </div>
                             )}
                          </div>
                       ))}
                       {reservations.length > 5 && (
                         <div className="text-center pt-2">
                           <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">+ {reservations.length - 5} autres réservations</p>
                         </div>
                       )}
                     </>
                   )}
                </div>
            </div>
          </div>
          
          {/* Mini Weekly Calendar Grid (Fill empty space) */}
          <div className="mt-12 space-y-6 animate-in slide-in-from-bottom-4 duration-500 delay-150">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                   <Clock className="h-4 w-4" /> Vue Hebdomadaire (Non modifiable)
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/50 px-3 py-1 rounded-full border">
                   Semaine du {startOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
             </div>

             <div className="glass rounded-[24px] border border-white/10 overflow-hidden shadow-inner relative">
                {/* Scrollable Container with Sticky Header */}
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                   {/* Header Days - Sticky */}
                   <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b bg-muted/90 backdrop-blur-md sticky top-0 z-20">
                      <div className="p-3 border-r text-[9px] font-black uppercase text-muted-foreground/50 flex items-center justify-center bg-muted/50">
                         H
                      </div>
                      {weekDays.map((day, i) => (
                         <div key={i} className={cn(
                           "p-3 border-r text-center",
                           isOpen && day.toDateString() === new Date().toDateString() ? "bg-primary/10" : ""
                         )}>
                            <p className="text-[9px] font-black text-primary uppercase leading-tight">{DAYS_SHORT[i]}</p>
                            <p className="text-xs font-bold leading-tight">{day.getDate()}</p>
                         </div>
                      ))}
                   </div>

                   {/* Grid Rows */}
                   <div className="grid grid-cols-[40px_repeat(7,1fr)] divide-x divide-y border-b text-[8px]">
                      {HOURS.map((hour) => (
                        <React.Fragment key={hour}>
                           <div className="h-12 p-1.5 text-right font-black text-muted-foreground/60 border-b flex flex-col justify-start bg-muted/10">
                              {hour}h
                           </div>
                           {weekDays.map((day, i) => {
                             const dayReservations = reservations.filter(r => {
                               const start = new Date(r.startTime);
                               const end = new Date(r.endTime);
                               return start.toDateString() === day.toDateString() &&
                                      hour >= start.getHours() && hour < end.getHours();
                             });

                             return (
                               <div key={i} className="h-12 p-0.5 relative hover:bg-white/5 transition-colors border-b">
                                  {dayReservations.map(res => (
                                    <div key={res.id} className="absolute inset-0.5 rounded-md bg-accent p-1 text-[7px] font-bold text-accent-foreground shadow-sm border border-accent/50 overflow-hidden flex flex-col justify-center">
                                       <p className="truncate leading-tight uppercase font-black tracking-tighter">{res.user?.name}</p>
                                    </div>
                                  ))}
                               </div>
                             );
                           })}
                        </React.Fragment>
                      ))}
                   </div>
                </div>
             </div>
          </div>
          
          <div className="mt-8 p-4 rounded-2xl bg-accent/5 border border-accent/20 flex items-center gap-3">
             <AlertTriangle className="h-5 w-5 text-accent" />
             <p className="text-[11px] font-medium leading-relaxed italic">
                En cas de retard ou d'annulation, merci de prévenir immédiatement l'accueil des Services Généraux.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
