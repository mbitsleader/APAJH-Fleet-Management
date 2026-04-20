'use client';

import React, { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuthorizedAdminLoader } from '@/lib/adminAccess';
import { ADMIN_ACCESS_ROLES } from '@/lib/permissions';
import { Sidebar } from '@/components/ui/Sidebar';
import { 
  History, 
  Fuel, 
  Gauge, 
  Calendar, 
  Download,
  Search,
  ChevronRight,
  TrendingUp,
  MapPin,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminHistory() {
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<{ totalDistance: number; totalCost: number; totalLiters: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab ] = useState<'TRIPS' | 'FUEL' | 'MONTHLY'>('TRIPS');

  const fetchData = useCallback(async () => {
    try {
      const [tripsRes, fuelRes, statsRes] = await Promise.all([
        apiFetch('/api/trips'),
        apiFetch('/api/fuel/all'),
        apiFetch('/api/fuel/stats'),
      ]);

      const tripsData = await tripsRes.json();
      const fuelData = await fuelRes.json();
      const statsData = await statsRes.json();

      setTrips(Array.isArray(tripsData) ? tripsData : []);
      setFuelLogs(Array.isArray(fuelData) ? fuelData : []);

      // Calculer les stats mensuelles à partir des données
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const monthTrips = (Array.isArray(tripsData) ? tripsData : []).filter((t: any) =>
        t.endMileage && new Date(t.startTime) >= startOfMonth
      );
      const totalDistance = monthTrips.reduce((acc: number, t: any) => acc + (t.endMileage - t.startMileage), 0);

      const totalCost = (Array.isArray(statsData) ? statsData : []).reduce((acc: number, s: any) => acc + (s._sum?.cost || 0), 0);
      const totalLiters = (Array.isArray(statsData) ? statsData : []).reduce((acc: number, s: any) => acc + (s._sum?.liters || 0), 0);

      setMonthlyStats({ totalDistance, totalCost, totalLiters });
    } catch (error) {
      console.error('History fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const { isReady } = useAuthorizedAdminLoader(ADMIN_ACCESS_ROLES, fetchData);

  if (!isReady) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="lg:pl-28 min-h-screen pb-20">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
             <History className="h-6 w-6 text-primary" />
             <h1 className="text-xl font-bold tracking-tight">Historiques & Suivis</h1>
          </div>
          <button className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-bold hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary">
             <Download aria-hidden="true" className="h-4 w-4" />
             Exporter (CSV)
          </button>
        </header>

        <section className="p-8 space-y-6">
           {/* Tabs Navigation */}
           <div role="tablist" aria-label="Sections de l'historique" className="flex border-b">
              <button
                role="tab"
                aria-selected={activeTab === 'TRIPS'}
                onClick={() => setActiveTab('TRIPS')}
                className={cn("px-6 py-4 text-sm font-bold transition-all border-b-2 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset", activeTab === 'TRIPS' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >Missions / Trajets</button>
              <button
                role="tab"
                aria-selected={activeTab === 'FUEL'}
                onClick={() => setActiveTab('FUEL')}
                className={cn("px-6 py-4 text-sm font-bold transition-all border-b-2 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset", activeTab === 'FUEL' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >Suivi des Pleins</button>
              <button
                role="tab"
                aria-selected={activeTab === 'MONTHLY'}
                onClick={() => setActiveTab('MONTHLY')}
                className={cn("px-6 py-4 text-sm font-bold transition-all border-b-2 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset", activeTab === 'MONTHLY' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >Statistiques Mensuelles</button>
           </div>

           <div className="glass rounded-3xl border shadow-xl overflow-hidden">
              {activeTab === 'TRIPS' && (
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="bg-muted text-xs font-bold uppercase text-muted-foreground border-b">
                            <th className="px-6 py-4">Véhicule</th>
                            <th className="px-6 py-4">Utilisateur</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">KM Début</th>
                            <th className="px-6 py-4">KM Fin</th>
                            <th className="px-6 py-4">Distance</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-sm">
                         {trips.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">Aucun trajet enregistré</td></tr>
                         ) : trips.map(trip => (
                            <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                               <td className="px-6 py-4">
                                  <p className="font-bold">{trip.vehicle?.brand} {trip.vehicle?.model}</p>
                                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{trip.vehicle?.plateNumber}</p>
                               </td>
                               <td className="px-6 py-4">{trip.user?.name}</td>
                               <td className="px-6 py-4">
                                  {new Date(trip.startTime).toLocaleDateString()}
                               </td>
                               <td className="px-6 py-4">{trip.startMileage}</td>
                               <td className="px-6 py-4">{trip.endMileage || '--'}</td>
                               <td className="px-6 py-4">
                                  {trip.endMileage ? `${trip.endMileage - trip.startMileage} km` : 'En cours'}
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              )}

              {activeTab === 'FUEL' && (
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="bg-muted text-xs font-bold uppercase text-muted-foreground border-b">
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Véhicule</th>
                            <th className="px-6 py-4">Litres</th>
                            <th className="px-6 py-4">Coût</th>
                            <th className="px-6 py-4">Kilométrage</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-sm">
                         {fuelLogs.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">Aucun plein enregistré</td></tr>
                         ) : fuelLogs.map(log => (
                            <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                               <td className="px-6 py-4">{new Date(log.createdAt).toLocaleDateString()}</td>
                               <td className="px-6 py-4">
                                  <p className="font-bold">{log.vehicle?.brand} {log.vehicle?.model}</p>
                                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{log.vehicle?.plateNumber}</p>
                               </td>
                               <td className="px-6 py-4 font-bold text-orange-600">{log.liters ? `${log.liters} L` : '--'}</td>
                               <td className="px-6 py-4 font-bold text-emerald-600">{log.cost ? `${log.cost} €` : '--'}</td>
                               <td className="px-6 py-4">{log.mileageAtFill || '--'} km</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              )}

              {activeTab === 'MONTHLY' && (
                <div className="p-12 text-center">
                   <TrendingUp className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                   <h3 className="text-xl font-bold">Analyse Mensuelle</h3>
                   <p className="text-muted-foreground max-w-md mx-auto mt-2 italic font-medium">
                      Cette section affichera le récapitulatif mensuel par véhicule (consommation moyenne, kilométrage parcouru).
                   </p>
                   <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 rounded-2xl border bg-muted/20">
                         <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Distance Totale</p>
                         <p className="text-2xl font-black">--- km</p>
                      </div>
                      <div className="p-6 rounded-2xl border bg-muted/20">
                         <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Carburant Total</p>
                         <p className="text-2xl font-black">--- €</p>
                      </div>
                      <div className="p-6 rounded-2xl border bg-muted/20">
                         <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Moyenne / 100km</p>
                         <p className="text-2xl font-black">--- L</p>
                      </div>
                   </div>
                </div>
              )}
           </div>
        </section>
      </main>
    </div>
  );
}
