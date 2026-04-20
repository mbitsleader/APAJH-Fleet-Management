'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { canAccessAdmin } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import {
  BarChart3, DollarSign, TrendingUp, ClipboardList,
  Calendar, Sparkles, Fuel, AlertTriangle, Wrench,
  FileText, Car, Download, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast { id: number; type: 'success' | 'error'; message: string }

interface VehicleOption { id: string; label: string }

export default function ExportsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const role = user?.role;

  const [startDate, setStartDate]   = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate]       = useState(() => new Date().toISOString().split('T')[0]);
  const [poleId, setPoleId]         = useState('');
  const [vehicleId, setVehicleId]   = useState('');
  const [selectedVehicleCard, setSelectedVehicleCard] = useState('');
  const [vehicles, setVehicles]     = useState<VehicleOption[]>([]);
  const [loading, setLoading]       = useState<string | null>(null);
  const [toasts, setToasts]         = useState<Toast[]>([]);
  const toastId = useRef(0);

  // Protection de rôle
  useEffect(() => {
    if (role && !canAccessAdmin(role)) router.replace('/');
  }, [role, router]);

  // Charger les véhicules pour la fiche véhicule
  useEffect(() => {
    fetch('/api/vehicles', { credentials: 'include' })
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setVehicles(data.map(v => ({ id: v.id, label: `${v.brand} ${v.model} — ${v.plateNumber}` })));
        }
      })
      .catch(() => {});
  }, []);

  function addToast(type: 'success' | 'error', message: string) {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function downloadExport(
    endpoint: string,
    format: 'xlsx' | 'pdf' | 'csv',
    filename: string,
    extraParams: Record<string, string> = {}
  ) {
    const key = endpoint + format;
    setLoading(key);
    try {
      const params = new URLSearchParams({
        format,
        ...(startDate && { startDate }),
        ...(endDate   && { endDate }),
        ...(poleId    && { poleId }),
        ...(vehicleId && { vehicleId }),
        ...extraParams,
      });

      const response = await fetch(`/api/exports/${endpoint}?${params}`, { credentials: 'include' });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur serveur');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('success', 'Export téléchargé avec succès');
    } catch (err: any) {
      addToast('error', err.message || 'Échec de l\'export — réessayez');
    } finally {
      setLoading(null);
    }
  }

  const isLoading = (key: string) => loading === key;

  function ExportBtn({
    endpoint, format, filename, label, extraParams,
    ariaLabel,
  }: {
    endpoint: string; format: 'xlsx' | 'pdf' | 'csv'; filename: string;
    label: string; extraParams?: Record<string, string>; ariaLabel?: string;
  }) {
    const key = endpoint + format;
    const busy = isLoading(key);
    const colorMap: Record<string, string> = {
      pdf:  'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/20',
      xlsx: 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20',
      csv:  'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20',
    };
    return (
      <button
        onClick={() => downloadExport(endpoint, format, filename, extraParams)}
        disabled={!!loading}
        aria-label={ariaLabel || `Télécharger ${label} en ${format.toUpperCase()}`}
        aria-busy={busy}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
          colorMap[format],
          loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
        )}
      >
        {busy
          ? <><Loader2 className="h-3 w-3 animate-spin" /><span>Génération...</span></>
          : <><Download className="h-3 w-3" />{label}</>
        }
      </button>
    );
  }

  function ExportRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="lg:pl-28 min-h-screen pb-20 outline-none">
        <header className="sticky top-0 z-30 flex h-20 items-center border-b bg-background/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Download className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight">Exports de données</h1>
          </div>
        </header>

        {/* Toasts */}
        <div role="region" aria-live="polite" aria-label="Notifications" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              role="alert"
              className={cn(
                'flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-in slide-in-from-bottom-2 duration-300',
                toast.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-600 text-white'
              )}
            >
              {toast.type === 'success'
                ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                : <XCircle     className="h-4 w-4 shrink-0" aria-hidden="true" />
              }
              {toast.message}
            </div>
          ))}
        </div>

        <section className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">

          {/* Spinner global */}
          {loading && (
            <div aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Génération en cours...</span>
            </div>
          )}

          {/* Filtres */}
          <fieldset className="glass rounded-3xl p-6 space-y-4 border border-border/20">
            <legend className="text-sm font-black uppercase tracking-widest text-muted-foreground px-2">Filtres</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="export-start-date" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Date début
                </label>
                <input
                  id="export-start-date"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-10 rounded-xl border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-end-date" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Date fin
                </label>
                <input
                  id="export-end-date"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full h-10 rounded-xl border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-vehicle" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Véhicule (optionnel)
                </label>
                <select
                  id="export-vehicle"
                  value={vehicleId}
                  onChange={e => setVehicleId(e.target.value)}
                  className="w-full h-10 rounded-xl border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Tous les véhicules</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); setPoleId(''); setVehicleId(''); }}
                  className="h-10 px-4 rounded-xl border text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-all"
                  aria-label="Réinitialiser les filtres"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </fieldset>

          {/* Rapports bailleurs */}
          <fieldset className="glass rounded-3xl p-6 border border-border/20">
            <legend className="text-sm font-black uppercase tracking-widest text-primary px-2 mb-4">
              Rapports bailleurs
            </legend>
            <div className="space-y-0">
              <ExportRow icon={BarChart3} label="Rapport d'activité">
                <ExportBtn endpoint="activity-report" format="pdf"  filename="rapport_activite" label="PDF"
                  ariaLabel="Télécharger le rapport d'activité en PDF" />
                <ExportBtn endpoint="activity-report" format="xlsx" filename="rapport_activite" label="Excel"
                  ariaLabel="Télécharger le rapport d'activité en Excel" />
              </ExportRow>
              {(role === 'ADMIN' || role === 'DIRECTEUR') && (
                <ExportRow icon={DollarSign} label="Synthèse des coûts">
                  <ExportBtn endpoint="cost-summary" format="xlsx" filename="synthese_couts" label="Excel"
                    ariaLabel="Télécharger la synthèse des coûts en Excel" />
                </ExportRow>
              )}
              <ExportRow icon={TrendingUp} label="Taux d'utilisation">
                <ExportBtn endpoint="utilization" format="xlsx" filename="taux_utilisation" label="Excel"
                  ariaLabel="Télécharger le taux d'utilisation en Excel" />
              </ExportRow>
              <ExportRow icon={ClipboardList} label="Journal des déplacements">
                <ExportBtn endpoint="trip-journal" format="xlsx" filename="journal_deplacements" label="Excel"
                  ariaLabel="Télécharger le journal des déplacements en Excel" />
                <ExportBtn endpoint="trip-journal" format="pdf"  filename="journal_deplacements" label="PDF"
                  ariaLabel="Télécharger le journal des déplacements en PDF" />
                <ExportBtn endpoint="trip-journal" format="csv"  filename="journal_deplacements" label="CSV"
                  ariaLabel="Télécharger le journal des déplacements en CSV" />
              </ExportRow>
            </div>
          </fieldset>

          {/* Rapports opérationnels */}
          <fieldset className="glass rounded-3xl p-6 border border-border/20">
            <legend className="text-sm font-black uppercase tracking-widest text-primary px-2 mb-4">
              Rapports opérationnels
            </legend>
            <div className="space-y-0">
              <ExportRow icon={Calendar} label="Planning hebdomadaire">
                <ExportBtn endpoint="weekly-planning" format="pdf" filename="planning_hebdomadaire" label="PDF"
                  ariaLabel="Télécharger le planning hebdomadaire en PDF" />
              </ExportRow>
              <ExportRow icon={Sparkles} label="Planning de nettoyage">
                <ExportBtn endpoint="cleaning-planning" format="pdf" filename="planning_nettoyage" label="PDF"
                  ariaLabel="Télécharger le planning de nettoyage en PDF" />
              </ExportRow>
              <ExportRow icon={Fuel} label="Historique carburant">
                <ExportBtn endpoint="fuel-history" format="xlsx" filename="historique_carburant" label="Excel"
                  ariaLabel="Télécharger l'historique carburant en Excel" />
                <ExportBtn endpoint="fuel-history" format="csv"  filename="historique_carburant" label="CSV"
                  ariaLabel="Télécharger l'historique carburant en CSV" />
              </ExportRow>
              <ExportRow icon={AlertTriangle} label="Rapport d'incidents">
                <ExportBtn endpoint="incident-report" format="pdf"  filename="rapport_incidents" label="PDF"
                  ariaLabel="Télécharger le rapport d'incidents en PDF" />
                <ExportBtn endpoint="incident-report" format="xlsx" filename="rapport_incidents" label="Excel"
                  ariaLabel="Télécharger le rapport d'incidents en Excel" />
                <ExportBtn endpoint="incident-report" format="csv"  filename="rapport_incidents" label="CSV"
                  ariaLabel="Télécharger le rapport d'incidents en CSV" />
              </ExportRow>
              <ExportRow icon={Wrench} label="Historique d'entretien">
                <ExportBtn endpoint="maintenance-history" format="pdf"  filename="historique_entretien" label="PDF"
                  ariaLabel="Télécharger l'historique d'entretien en PDF" />
                <ExportBtn endpoint="maintenance-history" format="xlsx" filename="historique_entretien" label="Excel"
                  ariaLabel="Télécharger l'historique d'entretien en Excel" />
                <ExportBtn endpoint="maintenance-history" format="csv"  filename="historique_entretien" label="CSV"
                  ariaLabel="Télécharger l'historique d'entretien en CSV" />
              </ExportRow>
            </div>
          </fieldset>

          {/* Documents réglementaires */}
          <fieldset className="glass rounded-3xl p-6 border border-border/20">
            <legend className="text-sm font-black uppercase tracking-widest text-primary px-2 mb-4">
              Documents réglementaires
            </legend>
            <div className="space-y-0">
              <ExportRow icon={FileText} label="Échéancier documents">
                <ExportBtn endpoint="document-schedule" format="pdf"  filename="echeancier_documents" label="PDF"
                  ariaLabel="Télécharger l'échéancier documents en PDF" />
                <ExportBtn endpoint="document-schedule" format="xlsx" filename="echeancier_documents" label="Excel"
                  ariaLabel="Télécharger l'échéancier documents en Excel" />
                <ExportBtn endpoint="document-schedule" format="csv"  filename="echeancier_documents" label="CSV"
                  ariaLabel="Télécharger l'échéancier documents en CSV" />
              </ExportRow>

              {/* Fiche véhicule */}
              <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  <Car className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium">Fiche véhicule</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <label htmlFor="vehicle-card-select" className="sr-only">Sélectionner un véhicule</label>
                  <select
                    id="vehicle-card-select"
                    value={selectedVehicleCard}
                    onChange={e => setSelectedVehicleCard(e.target.value)}
                    className="h-8 rounded-xl border bg-background px-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30 max-w-[200px]"
                    aria-label="Sélectionner le véhicule pour la fiche"
                  >
                    <option value="">— Choisir un véhicule —</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                  {selectedVehicleCard && (
                    <>
                      <button
                        onClick={() => downloadExport(`vehicle-card/${selectedVehicleCard}`, 'pdf', 'fiche_vehicule', { variant: 'summary' })}
                        disabled={!!loading}
                        aria-label="Télécharger la fiche véhicule synthèse en PDF"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/20 transition-all disabled:opacity-50"
                      >
                        {isLoading(`vehicle-card/${selectedVehicleCard}pdf`)
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />
                        } Synthèse
                      </button>
                      <button
                        onClick={() => downloadExport(`vehicle-card/${selectedVehicleCard}`, 'pdf', 'fiche_vehicule_detaillee', { variant: 'detailed' })}
                        disabled={!!loading}
                        aria-label="Télécharger la fiche véhicule détaillée en PDF"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/20 transition-all disabled:opacity-50"
                      >
                        {isLoading(`vehicle-card/${selectedVehicleCard}pdf`)
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />
                        } Détaillé
                      </button>
                    </>
                  )}
                  {!selectedVehicleCard && (
                    <span className="text-xs text-muted-foreground italic">Sélectionner un véhicule</span>
                  )}
                </div>
              </div>
            </div>
          </fieldset>

        </section>
      </main>
    </div>
  );
}
