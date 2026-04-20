'use client';

import React, { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuthorizedAdminLoader } from '@/lib/adminAccess';
import { ADMIN_ACCESS_ROLES } from '@/lib/permissions';
import { Sidebar } from '@/components/ui/Sidebar';
import { 
  Car, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Plus, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Stats {
  totalVehicles: number;
  availableVehicles: number;
  inUseVehicles: number;
  maintenanceVehicles: number;
  openIncidents: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalVehicles: 0,
    availableVehicles: 0,
    inUseVehicles: 0,
    maintenanceVehicles: 0,
    openIncidents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [incidentsData, setIncidentsData] = useState<any[]>([]);
  const [openTrips, setOpenTrips] = useState<any[]>([]);
  const [endingTripId, setEndingTripId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const [resVehicles, resIncidents, resOpenTrips] = await Promise.all([
        apiFetch('/api/vehicles'),
        apiFetch('/api/incidents'),
        apiFetch('/api/trips/open')
      ]);
      
      const vehicles = await resVehicles.json();
      const incidents = await resIncidents.json();
      const trips = await resOpenTrips.json();

      setIncidentsData(incidents);
      setOpenTrips(trips);
      
      setStats({
        totalVehicles: vehicles.length || 0,
        availableVehicles: (vehicles || []).filter((v: any) => v.status === 'AVAILABLE').length,
        inUseVehicles: (vehicles || []).filter((v: any) => v.status === 'IN_USE').length,
        maintenanceVehicles: (vehicles || []).filter((v: any) => v.status === 'MAINTENANCE').length,
        openIncidents: (incidents || []).filter((i: any) => i.status === 'OPEN').length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleForceEnd = async (tripId: string) => {
    if (!confirm('Voulez-vous vraiment forcer la clôture de ce trajet ?')) return;
    setEndingTripId(tripId);
    try {
      const res = await apiFetch('/api/trips/force-end', {
        method: 'POST',
        body: JSON.stringify({ tripId })
      });
      if (res.ok) {
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la clôture');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEndingTripId(null);
    }
  };

  const { isReady } = useAuthorizedAdminLoader(ADMIN_ACCESS_ROLES, fetchStats);

  if (!isReady) return null;

  const statCards = [
    { label: 'Total Véhicules', value: stats.totalVehicles, icon: Car, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'En Circulation', value: stats.inUseVehicles, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Incidents Ouverts', value: stats.openIncidents, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'En Maintenance', value: stats.maintenanceVehicles, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="lg:pl-28 min-h-screen pb-20">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
             <ShieldCheck className="h-6 w-6 text-primary" />
             <h1 className="text-xl font-bold tracking-tight">Espace Administration</h1>
          </div>
          <div className="flex items-center gap-4">
             <Link href="/admin/vehicles" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105">
                <Plus className="h-4 w-4" />
                Ajouter un véhicule
             </Link>
          </div>
        </header>

        <section className="p-8 space-y-8">
          {/* Top Stats */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
             {statCards.map((card, i) => (
               <div key={i} className="glass group relative overflow-hidden rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner", card.bg, card.color)}>
                     <card.icon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                  <p className="mt-1 text-3xl font-black">{card.value}</p>
                  <div className="absolute -right-4 -top-4 text-primary/5 transition-transform group-hover:scale-110 group-hover:rotate-12">
                     <card.icon className="h-32 w-32" />
                  </div>
               </div>
             ))}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
             {/* Recent Activity */}
             <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                   <h2 className="text-lg font-bold">Incidents Récents</h2>
                   <Link href="/admin/incidents" className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
                      Tout voir <ChevronRight className="h-4 w-4" />
                   </Link>
                </div>
                <div className="glass rounded-3xl overflow-hidden border">
                   {loading ? (
                     <div className="p-12 text-center">
                        <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4 animate-spin" />
                        <p className="text-muted-foreground italic uppercase text-[10px] font-black tracking-tighter">Récupération des incidents...</p>
                     </div>
                   ) : incidentsData.length === 0 ? (
                     <div className="p-12 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500/30 mx-auto mb-4" />
                        <p className="text-muted-foreground italic text-sm">Aucun incident à signaler. La flotte est opérationnelle.</p>
                     </div>
                   ) : (
                     <div className="divide-y">
                        {incidentsData.slice(0, 5).map((inc: any) => (
                          <div key={inc.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                             <div className="flex items-center gap-4">
                                <div className={cn(
                                  "h-10 w-10 flex items-center justify-center rounded-xl",
                                  inc.severity === 'CRITICAL' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                                )}>
                                   <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                   <p className="text-sm font-bold">{inc.vehicle?.brand} {inc.vehicle?.model}</p>
                                   <p className="text-xs text-muted-foreground truncate max-w-md">{inc.description}</p>
                                </div>
                             </div>
                             <span className={cn(
                               "text-[10px] font-black uppercase px-2 py-1 rounded-full",
                               inc.status === 'OPEN' ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                             )}>
                               {inc.status}
                             </span>
                          </div>
                        ))}
                     </div>
                   )}
                </div>
             </div>

             {/* Trajets en cours */}
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <h2 className="text-lg font-bold">Trajets en cours</h2>
                   <span className="text-[10px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase">
                     {openTrips.length} actif{openTrips.length > 1 ? 's' : ''}
                   </span>
                </div>
                <div className="glass rounded-3xl overflow-hidden border">
                   {loading ? (
                      <div className="p-8 text-center"><Clock className="h-8 w-8 animate-spin mx-auto text-muted-foreground/30" /></div>
                   ) : openTrips.length === 0 ? (
                      <div className="p-8 text-center italic text-xs text-muted-foreground">Aucun trajet en cours</div>
                   ) : (
                      <div className="divide-y">
                         {openTrips.map((trip: any) => (
                           <div key={trip.id} className="p-4 space-y-3 hover:bg-muted/30 transition-colors">
                              <div className="flex items-start justify-between">
                                 <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">
                                       {trip.user?.name?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                       <p className="text-sm font-bold">{trip.user?.name}</p>
                                       <p className="text-[10px] font-black text-primary uppercase">
                                          {trip.vehicle?.brand} {trip.vehicle?.model}
                                       </p>
                                    </div>
                                 </div>
                                 <button 
                                    onClick={() => handleForceEnd(trip.id)}
                                    disabled={endingTripId === trip.id}
                                    className="text-[10px] font-black text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg border border-red-100 transition-all disabled:opacity-50"
                                 >
                                    {endingTripId === trip.id ? '...' : 'FORCER FIN'}
                                 </button>
                              </div>
                              <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                 <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Depuis {new Date(trip.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                 </div>
                                 <div className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    {trip.startMileage} km
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                   )}
                </div>

             </div>
          </div>
        </section>
      </main>
    </div>
  );
}
