'use client';

import React, { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuthorizedAdminLoader } from '@/lib/adminAccess';
import { ADMIN_ACCESS_ROLES } from '@/lib/permissions';
import { Sidebar } from '@/components/ui/Sidebar';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter,
  Eye,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [confirmResolve, setConfirmResolve] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/incidents');
      const data = await res.json();
      setIncidents(data);
    } catch (error) {
      console.error('Error fetching admin incidents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const { isReady } = useAuthorizedAdminLoader(ADMIN_ACCESS_ROLES, fetchIncidents);

  if (!isReady) return null;

  const resolveIncident = async (id: string) => {
    try {
      const res = await apiFetch(`/api/incidents/${id}/resolve`, { method: 'PATCH' });
      if (res.ok) {
        setIncidents(incidents.map(i => i.id === id ? { ...i, status: 'RESOLVED' } : i));
      }
    } catch (error) {
       console.error('Resolution error:', error);
    } finally {
      setConfirmResolve(null);
    }
  };

  const filteredIncidents = incidents.filter(i => filter === 'ALL' || i.status === filter);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main id="main-content" tabIndex={-1} className="lg:pl-28 min-h-screen pb-20 outline-none">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
             <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
             <h1 className="text-xl font-bold tracking-tight">Gestion des Incidents</h1>
          </div>
          <div className="flex bg-muted p-1 rounded-xl">
            <button 
               onClick={() => setFilter('ALL')}
               className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", filter === 'ALL' ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >Tous</button>
            <button 
               onClick={() => setFilter('OPEN')}
               className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", filter === 'OPEN' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-muted-foreground hover:text-foreground")}
            >Ouverts</button>
            <button 
               onClick={() => setFilter('RESOLVED')}
               className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", filter === 'RESOLVED' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-muted-foreground hover:text-foreground")}
            >Résolus</button>
          </div>
        </header>

        <section className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="col-span-full py-12 text-center text-muted-foreground italic tracking-widest uppercase text-xs">Chargement des signalements...</p>
            ) : filteredIncidents.length === 0 ? (
              <div className="col-span-full py-12 text-center glass rounded-3xl border border-dashed">
                 <CheckCircle2 className="h-12 w-12 text-emerald-500/30 mx-auto mb-4" aria-hidden="true" />
                 <p className="text-muted-foreground font-bold italic">Aucun incident à signaler</p>
              </div>
            ) : filteredIncidents.map((incident) => (
              <div key={incident.id} className={cn(
                "glass group relative overflow-hidden rounded-3xl border p-6 transition-all hover:-translate-y-1 hover:shadow-2xl",
                incident.status === 'OPEN' ? "border-l-4 border-l-red-500" : "border-l-4 border-l-emerald-500 opacity-60 hover:opacity-100"
              )}>
                <div className="mb-4 flex items-center justify-between">
                   <div className={cn(
                     "flex h-10 w-10 items-center justify-center rounded-xl font-bold",
                     incident.severity === 'CRITICAL' ? "bg-red-500 text-white shadow-lg shadow-red-500/30" :
                     incident.severity === 'MAJOR' ? "bg-orange-100 text-orange-600" :
                     "bg-blue-100 text-blue-600"
                   )}>
                      {incident.severity === 'CRITICAL' ? '!!' : '!'}
                   </div>
                   <div className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      {new Date(incident.createdAt).toLocaleDateString()}
                   </div>
                </div>

                <div className="mb-4">
                   <p className="text-sm font-bold truncate">{incident.vehicle?.brand} {incident.vehicle?.model}</p>
                   <p className="text-[10px] text-muted-foreground font-mono font-bold">{incident.vehicle?.plateNumber}</p>
                </div>

                <p className="mb-4 text-sm text-muted-foreground line-clamp-3 leading-relaxed italic font-medium">
                   "{incident.description}"
                </p>

                {incident.photoUrl && (
                  <a href={incident.photoUrl} target="_blank" rel="noopener noreferrer" className="block mb-4 rounded-xl overflow-hidden border hover:opacity-90 transition-opacity">
                    <img src={incident.photoUrl} alt="Photo incident" className="w-full max-h-32 object-cover" />
                    <div className="bg-muted/50 px-3 py-1.5 text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" aria-hidden="true" /> Voir la photo en taille réelle
                    </div>
                  </a>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                   <div className="flex items-center gap-2">
                       <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <ShieldCheck className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                       </div>
                       <span className="text-[10px] font-bold text-muted-foreground">{incident.user?.name || 'Utilisateur'}</span>
                   </div>
                   {incident.status === 'OPEN' ? (
                     <button
                        onClick={() => setConfirmResolve(incident.id)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                     >
                        Résoudre
                     </button>
                   ) : (
                     <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Résolu
                     </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <ConfirmModal
        isOpen={!!confirmResolve}
        title="Marquer comme résolu"
        description="Confirmer la résolution de cet incident ? Il sera archivé et ne sera plus traité."
        confirmLabel="Marquer résolu"
        onConfirm={() => confirmResolve && resolveIncident(confirmResolve)}
        onCancel={() => setConfirmResolve(null)}
      />
    </div>
  );
}
