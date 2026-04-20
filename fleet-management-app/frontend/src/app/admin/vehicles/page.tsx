'use client';

import React, { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuthorizedAdminLoader } from '@/lib/adminAccess';
import { ADMIN_ACCESS_ROLES, canDeleteVehicle } from '@/lib/permissions';
import { Sidebar } from '@/components/ui/Sidebar';
import { Car, Trash2, Edit, Plus, Search, Fuel, X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { CAR_CATALOGUE, getCarImageUrl } from '@/lib/carImage';

const STATUSES = ['AVAILABLE', 'MAINTENANCE', 'BLOCKED'];
const FUEL_TYPES = ['Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL'];
const CATEGORIES = ['Citadine', 'Compacte', 'Berline', 'SUV', 'Utilitaire'];
const VEHICLE_TYPES = ['PERMANENT', 'REPLACEMENT'];

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible', IN_USE: 'En Mission', MAINTENANCE: 'Maintenance', BLOCKED: 'Bloqué',
};

const emptyForm = {
  brand: '', model: '', plateNumber: '', category: 'Citadine',
  fuelType: 'Essence', status: 'AVAILABLE', currentMileage: '', type: 'PERMANENT', imageUrl: '',
  serviceId: '', assignedUserId: '', nextTechnicalInspection: '',
};

export default function AdminVehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [services, setServices] = useState<{id:string; name:string}[]>([]);
  const [professionals, setProfessionals] = useState<{id:string; name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; plate: string } | null>(null);
  const [forceDelete, setForceDelete] = useState<{ id: string; plate: string; details: { reservations: number; trips: number; fuel: number; incidents: number } } | null>(null);
  const [forceDeleting, setForceDeleting] = useState(false);
  const [previewImgError, setPreviewImgError] = useState(false);

  // Models available for the selected brand
  const selectedBrand = CAR_CATALOGUE.find(b => b.label === form.brand);
  const availableModels = selectedBrand?.models ?? [];

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await apiFetch('/api/vehicles');
      setVehicles(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPageData = useCallback(async () => {
    await Promise.all([
      fetchVehicles(),
      apiFetch('/api/services').then(r => r.ok ? r.json() : []).then(setServices),
      apiFetch('/api/users').then(r => r.ok ? r.json() : []).then((users: any[]) =>
        setProfessionals(users.filter(u => u.role === 'PROFESSIONNEL').map(u => ({ id: u.id, name: u.name })))
      ),
    ]);
  }, [fetchVehicles]);

  const { user, isReady } = useAuthorizedAdminLoader(ADMIN_ACCESS_ROLES, loadPageData);

  const openCreate = () => {
    setEditingVehicle(null);
    setForm({ ...emptyForm });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (v: any) => {
    setEditingVehicle(v);
    setForm({
      brand: v.brand, model: v.model, plateNumber: v.plateNumber,
      category: v.category || 'Citadine', fuelType: v.fuelType || 'Essence',
      status: v.status, currentMileage: v.currentMileage.toString(),
      type: v.type || 'PERMANENT', imageUrl: v.imageUrl || '',
      serviceId: v.serviceId || '', assignedUserId: v.assignedUserId || '',
      nextTechnicalInspection: v.nextTechnicalInspection ? v.nextTechnicalInspection.split('T')[0] : '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand || !form.model || !form.plateNumber) {
      setFormError('Marque, modèle et plaque sont obligatoires.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const url = editingVehicle
        ? `/api/vehicles/${editingVehicle.id}`
        : '/api/vehicles';
      const method = editingVehicle ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...form,
          currentMileage: parseInt(form.currentMileage) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      setModalOpen(false);
      fetchVehicles();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/vehicles/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        setVehicles(v => v.filter(x => x.id !== id));
      } else if (res.status === 409) {
        const err = await res.json();
        const plate = confirmDelete?.plate || '';
        setConfirmDelete(null);
        setForceDelete({ id, plate, details: err.details });
        return;
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la suppression.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleForceDelete = async () => {
    if (!forceDelete) return;
    setForceDeleting(true);
    try {
      const res = await apiFetch(`/api/vehicles/${forceDelete.id}?force=true`, { method: 'DELETE' });
      if (res.status === 204) {
        setVehicles(v => v.filter(x => x.id !== forceDelete.id));
        setForceDelete(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la suppression forcée.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setForceDeleting(false);
    }
  };

  const filtered = vehicles.filter(v =>
    v.brand.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase()) ||
    v.plateNumber.toLowerCase().includes(search.toLowerCase())
  );

  // Group by pole name (vehicles with no pole go to 'Non assigné')
  const poleMap = new Map<string, any[]>();
  for (const v of filtered) {
    const poleName = v.service?.pole?.name || 'Non assigné';
    if (!poleMap.has(poleName)) poleMap.set(poleName, []);
    poleMap.get(poleName)!.push(v);
  }
  const POLE_COLORS: Record<string, string> = {
    'Adulte': 'bg-blue-600',
    'Enfance': 'bg-emerald-600',
    'Non assigné': 'bg-slate-400',
  };
  // [POLE-ADULTE] Pour réintégrer Pôle Adulte, ajouter 'Adulte' en premier
  const poleOrder = ['Adulte', 'Enfance'];
  const sortedPoles = [
    ...poleOrder.filter(p => poleMap.has(p)),
    ...[...poleMap.keys()].filter(p => !poleOrder.includes(p)).sort(),
  ];
  const grouped: { poleName: string; poleColor: string; vehicles: any[] }[] = [];
  for (const poleName of sortedPoles) {
    grouped.push({ poleName, poleColor: POLE_COLORS[poleName] || 'bg-primary', vehicles: poleMap.get(poleName)! });
  }

  if (!isReady || !user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main id="main-content" tabIndex={-1} className="lg:pl-28 min-h-screen pb-20 outline-none">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Car className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight">Gestion de Flotte</h1>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Nouveau Véhicule
          </button>
        </header>

        <section className="p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                aria-label="Rechercher un véhicule"
                placeholder="Rechercher par plaque, marque ou modèle..."
                className="w-full rounded-2xl border bg-card p-3 pl-12 text-sm outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase shrink-0">{filtered.length} véhicule{filtered.length > 1 ? 's' : ''}</p>
          </div>

          <div className="glass rounded-3xl overflow-hidden border shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b">
                    <th className="px-6 py-4">Véhicule</th>
                    <th className="px-6 py-4">Plaque</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4">Service</th>
                    <th className="px-6 py-4">Énergie</th>
                    <th className="px-6 py-4">Kilométrage</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">Chargement...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">Aucun véhicule trouvé</td></tr>
                  ) : grouped.map(({ poleName, poleColor, vehicles: groupVehicles }) => (
                    <React.Fragment key={poleName}>
                      {/* Pole header row */}
                      <tr>
                        <td colSpan={7} className="px-6 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-full px-3 py-1 text-xs font-black text-white uppercase tracking-wider', poleColor)}>
                              {poleName}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">{groupVehicles.length} véhicule{groupVehicles.length > 1 ? 's' : ''}</span>
                          </div>
                        </td>
                      </tr>
                      {groupVehicles.map(v => (
                        <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-16 overflow-hidden rounded-lg bg-muted flex items-center justify-center p-1 border">
                                <img src={v.imageUrl || '/logo.png'} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                              </div>
                              <div>
                                <p className="text-sm font-bold">{v.brand} {v.model}</p>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase">{v.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-md border bg-card px-2 py-1 text-xs font-mono font-bold shadow-sm">{v.plateNumber}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "h-2 w-2 rounded-full",
                                v.status === 'AVAILABLE' ? "bg-emerald-500" :
                                v.status === 'IN_USE' ? "bg-orange-500" :
                                "bg-red-500"
                              )} />
                              <span className="text-xs font-bold">{STATUS_LABELS[v.status] || v.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {v.service ? (
                              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 font-semibold">{v.service.name}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                              <Fuel className="h-3 w-3" aria-hidden="true" /> {v.fuelType}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold">{v.currentMileage.toLocaleString()} km</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEdit(v)}
                                className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors flex items-center gap-1.5"
                              >
                                <Edit className="h-3 w-3" aria-hidden="true" /> Éditer
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ id: v.id, plate: v.plateNumber })}
                                className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center gap-1.5"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" /> Suppr.
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Supprimer le véhicule"
        description={`Vous êtes sur le point de supprimer le véhicule ${confirmDelete?.plate}. Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        danger
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Modal suppression forcée */}
      {forceDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-card border border-destructive/30 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                  <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-destructive">Suppression impossible</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Le véhicule <span className="font-mono font-bold">{forceDelete.plate}</span> a des données associées.</p>
                </div>
              </div>

              {/* Détail des données liées */}
              <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-destructive mb-3">Données qui seront supprimées</p>
                {[
                  { label: 'Réservations', count: forceDelete.details.reservations, icon: '📅' },
                  { label: 'Trajets', count: forceDelete.details.trips, icon: '🛣️' },
                  { label: 'Pleins de carburant', count: forceDelete.details.fuel, icon: '⛽' },
                  { label: 'Incidents', count: forceDelete.details.incidents, icon: '⚠️' },
                ].filter(d => d.count > 0).map(d => (
                  <div key={d.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground font-medium">{d.icon} {d.label}</span>
                    <span className="font-black text-destructive">{d.count} entrée{d.count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs font-bold text-destructive bg-destructive/5 rounded-xl p-3 border border-destructive/20">
                ⚠️ Cette action est irréversible. Toutes les données ci-dessus seront définitivement perdues.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setForceDelete(null)}
                  className="flex-1 rounded-xl border py-3 text-sm font-bold hover:bg-muted transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleForceDelete}
                  disabled={forceDeleting}
                  className="flex-[2] rounded-xl bg-destructive text-white py-3 text-sm font-black shadow-lg shadow-destructive/30 hover:bg-destructive/90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {forceDeleting ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  Supprimer quand même
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajouter / Éditer */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-card border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Car className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold">
                  {editingVehicle ? 'Modifier le véhicule' : 'Nouveau véhicule'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} aria-label="Fermer" className="rounded-full p-2 hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> {formError}
                </div>
              )}

              {/* ── Aperçu image ─────────────────────────────────────── */}
              {(() => {
                const preview = !form.imageUrl && form.brand && form.model
                  ? getCarImageUrl(form.brand, form.model)
                  : form.imageUrl || null;
                return preview && !previewImgError ? (
                  <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30 border">
                    <img
                      src={preview}
                      alt="aperçu"
                      className="h-16 w-28 object-contain rounded-xl bg-white"
                      onError={() => setPreviewImgError(true)}
                    />
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aperçu image</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {form.imageUrl ? 'Image personnalisée' : 'Générée via imagin.studio'}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-brand" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marque *</label>
                  <select
                    id="vehicle-brand"
                    required
                    value={form.brand}
                    onChange={e => {
                      setForm(f => ({ ...f, brand: e.target.value, model: '' }));
                      setPreviewImgError(false);
                    }}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— Choisir une marque —</option>
                    {CAR_CATALOGUE.map(b => (
                      <option key={b.label} value={b.label}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-model" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modèle *</label>
                  <select
                    id="vehicle-model"
                    required
                    value={form.model}
                    onChange={e => {
                      setForm(f => ({ ...f, model: e.target.value }));
                      setPreviewImgError(false);
                    }}
                    disabled={!form.brand}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  >
                    <option value="">— Choisir un modèle —</option>
                    {availableModels.map(m => (
                      <option key={m.label} value={m.label}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vehicle-plate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plaque d'immatriculation *</label>
                <input id="vehicle-plate" required value={form.plateNumber} onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value.toUpperCase() }))}
                  placeholder="Ex: AA-123-BB"
                  className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Catégorie</label>
                  <select id="vehicle-category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-fuel" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Énergie</label>
                  <select id="vehicle-fuel" value={form.fuelType} onChange={e => setForm(f => ({ ...f, fuelType: e.target.value }))}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20">
                    {FUEL_TYPES.map(ft => <option key={ft}>{ft}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-status" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Statut</label>
                  <select id="vehicle-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20">
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-mileage" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kilométrage</label>
                  <input id="vehicle-mileage" type="number" min="0" max="999999" value={form.currentMileage}
                    onChange={e => setForm(f => ({ ...f, currentMileage: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-type" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</label>
                  <select id="vehicle-type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="PERMANENT">Permanent</option>
                    <option value="REPLACEMENT">Remplacement</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-image" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL Image</label>
                  <input id="vehicle-image" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="/vehicles/clio.png"
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-service" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service rattaché</label>
                  <select id="vehicle-service" value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">— Aucun —</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vehicle-ct" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prochain Contrôle Technique</label>
                  <input id="vehicle-ct" type="date" value={form.nextTechnicalInspection}
                    onChange={e => setForm(f => ({ ...f, nextTechnicalInspection: e.target.value }))}
                    className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vehicle-assign" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigné à (solo)</label>
                <select id="vehicle-assign" value={form.assignedUserId} onChange={e => setForm(f => ({ ...f, assignedUserId: e.target.value }))}
                  className="w-full rounded-xl border bg-muted/30 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">— Aucun —</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border py-3 text-sm font-bold hover:bg-muted transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-[2] rounded-xl bg-primary text-white py-3 text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {editingVehicle ? 'Enregistrer les modifications' : 'Créer le véhicule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
