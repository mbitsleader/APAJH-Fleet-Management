'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { Sidebar } from '@/components/ui/Sidebar';
import { Search as SearchIcon, Car, Calendar, Gauge, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type ResultType = 'vehicle' | 'reservation' | 'trip';

interface Result {
  type: ResultType;
  id: string;
  label: string;
  sub: string;
  meta?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [allReservations, setAllReservations] = useState<any[]>([]);
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Chargement initial des données
  useEffect(() => {
    const loadData = async () => {
      try {
        const [vRes, rRes, tRes] = await Promise.all([
          apiFetch('/api/vehicles'),
          apiFetch('/api/reservations'),
          apiFetch('/api/trips'),
        ]);
        const [vehicles, reservations, trips] = await Promise.all([
          vRes.json(), rRes.json(), tRes.json(),
        ]);
        setAllVehicles(Array.isArray(vehicles) ? vehicles : []);
        setAllReservations(Array.isArray(reservations) ? reservations : []);
        setAllTrips(Array.isArray(trips) ? trips : []);
        setDataLoaded(true);
      } catch (e) {
        console.error('Search data load error:', e);
      }
    };
    loadData();
  }, []);

  const runSearch = useCallback((q: string) => {
    if (!q.trim() || !dataLoaded) { setResults([]); return; }
    setLoading(true);
    const lq = q.toLowerCase();

    const vehicleResults: Result[] = allVehicles
      .filter(v =>
        v.brand?.toLowerCase().includes(lq) ||
        v.model?.toLowerCase().includes(lq) ||
        v.plateNumber?.toLowerCase().includes(lq) ||
        v.category?.toLowerCase().includes(lq)
      )
      .map(v => ({
        type: 'vehicle' as ResultType,
        id: v.id,
        label: `${v.brand} ${v.model}`,
        sub: v.plateNumber,
        meta: v.status === 'AVAILABLE' ? 'Disponible' : v.status === 'IN_USE' ? 'En mission' : v.status,
      }));

    const reservationResults: Result[] = allReservations
      .filter(r =>
        r.destination?.toLowerCase().includes(lq) ||
        r.user?.name?.toLowerCase().includes(lq) ||
        r.vehicle?.brand?.toLowerCase().includes(lq) ||
        r.vehicle?.model?.toLowerCase().includes(lq) ||
        r.vehicle?.plateNumber?.toLowerCase().includes(lq)
      )
      .map(r => ({
        type: 'reservation' as ResultType,
        id: r.id,
        label: `${r.vehicle?.brand} ${r.vehicle?.model}`,
        sub: r.destination || 'Sans destination',
        meta: r.user?.name + ' — ' + new Date(r.startTime).toLocaleDateString('fr-FR'),
      }));

    const tripResults: Result[] = allTrips
      .filter(t =>
        t.user?.name?.toLowerCase().includes(lq) ||
        t.vehicle?.brand?.toLowerCase().includes(lq) ||
        t.vehicle?.model?.toLowerCase().includes(lq) ||
        t.vehicle?.plateNumber?.toLowerCase().includes(lq) ||
        t.notes?.toLowerCase().includes(lq)
      )
      .map(t => ({
        type: 'trip' as ResultType,
        id: t.id,
        label: `${t.vehicle?.brand} ${t.vehicle?.model}`,
        sub: t.user?.name || 'Inconnu',
        meta: new Date(t.startTime).toLocaleDateString('fr-FR') + (t.endMileage ? ` — ${t.endMileage - t.startMileage} km` : ' — En cours'),
      }));

    setResults([...vehicleResults, ...reservationResults, ...tripResults]);
    setLoading(false);
  }, [allVehicles, allReservations, allTrips, dataLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const ICONS: Record<ResultType, React.ReactNode> = {
    vehicle: <Car className="h-4 w-4" />,
    reservation: <Calendar className="h-4 w-4" />,
    trip: <Gauge className="h-4 w-4" />,
  };

  const LABELS: Record<ResultType, string> = {
    vehicle: 'Véhicule',
    reservation: 'Réservation',
    trip: 'Trajet',
  };

  const COLORS: Record<ResultType, string> = {
    vehicle: 'bg-blue-500/10 text-blue-600',
    reservation: 'bg-primary/10 text-primary',
    trip: 'bg-emerald-500/10 text-emerald-600',
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="lg:pl-28 min-h-screen pb-20">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b bg-background/80 px-8 backdrop-blur-md">
          <SearchIcon className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Plaque, conducteur, destination, modèle..."
            className="bg-transparent border-none outline-none w-full font-medium text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {loading && <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin shrink-0" />}
        </header>

        <section className="p-8">
          {!query ? (
            <div className="py-20 text-center animate-in fade-in slide-in-from-bottom-5 duration-700">
              <div className="h-24 w-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <SearchIcon className="h-10 w-10 text-primary/20" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">Recherche Intelligente</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                Tapez un numéro de plaque, un nom de conducteur ou une destination.
              </p>
              {!dataLoaded && (
                <p className="text-xs text-muted-foreground mt-4 animate-pulse">Chargement des données...</p>
              )}
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground font-bold italic">Aucun résultat pour "{query}"</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-6">
                {results.length} résultat{results.length > 1 ? 's' : ''}
              </p>
              {results.map((r) => (
                <div key={r.type + r.id} className="glass rounded-2xl border p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', COLORS[r.type])}>
                    {ICONS[r.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{r.label}</p>
                    <p className="text-sm text-muted-foreground truncate">{r.sub}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-[10px] font-black uppercase px-2 py-1 rounded-lg', COLORS[r.type])}>{LABELS[r.type]}</p>
                    {r.meta && <p className="text-[10px] text-muted-foreground mt-1">{r.meta}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
