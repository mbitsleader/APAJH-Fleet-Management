import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { History, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FuelLog {
  id: string;
  date: string;
  liters: number | null;
  cost: number | null;
  mileageAtFill: number | null;
  user: {
    name: string;
  };
}

interface FuelHistoryProps {
  vehicleId: string;
}

export const FuelHistory: React.FC<FuelHistoryProps> = ({ vehicleId }) => {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await apiFetch(`/api/fuel/vehicle/${vehicleId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching fuel logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [vehicleId]);

  if (loading) return <div className="p-4 animate-pulse text-muted-foreground">Chargement de l'historique...</div>;

  if (logs.length === 0) return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
      <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground font-medium">Aucun plein enregistré pour ce véhicule.</p>
    </div>
  );

  // Calcul du suivi mensuel simplifié
  const now = new Date();
  const currentMonthLogs = logs.filter(log => {
    const logDate = new Date(log.date);
    return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
  });

  const monthlyCost = currentMonthLogs.reduce((acc, log) => acc + (log.cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Résumé mensuel */}
      <div className="glass-dark p-4 rounded-2xl bg-orange-500/5 border-orange-500/10 inline-block">
        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Coût ce mois</p>
        <p className="text-xl font-black text-orange-600 dark:text-orange-400">{monthlyCost.toFixed(2)} €</p>
      </div>

      {/* Tableau d'historique */}
      <div className="overflow-hidden rounded-2xl border bg-card/30">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Compteur</th>
              <th className="px-4 py-3">Conducteur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted/50">
            {(showAll ? logs : logs.slice(0, 5)).map((log) => (
              <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">
                  {new Date(log.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </td>
                <td className="px-4 py-3 font-bold text-orange-600 dark:text-orange-400">
                  {log.cost ? `${log.cost.toFixed(2)} €` : '-'}
                </td>
                <td className="px-4 py-3">
                  {log.mileageAtFill ? (
                    <span className="flex items-center gap-1 font-mono text-xs">
                      <Gauge className="h-3 w-3 text-muted-foreground" /> {log.mileageAtFill.toLocaleString()} km
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20 shrink-0">
                      {log.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap overflow-visible">{log.user.name}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length > 5 && (
          <button 
            onClick={() => setShowAll(!showAll)}
            className="w-full py-3 bg-muted/20 hover:bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all flex items-center justify-center gap-2"
          >
            {showAll ? 'Réduire' : `Voir plus (${logs.length - 5} restants)`}
            <History className={cn("h-3 w-3 transition-transform", showAll ? "rotate-180" : "")} />
          </button>
        )}
      </div>
    </div>
  );
};
