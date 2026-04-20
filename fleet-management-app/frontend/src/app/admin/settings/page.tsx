'use client';

import { useCallback, useState } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { apiFetch } from '@/lib/apiFetch';
import { useAuthorizedAdminLoader } from '@/lib/adminAccess';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pole { id: string; name: string; }
interface Service { id: string; name: string; poleId: string | null; pole: Pole | null; }

export default function AdminSettingsPage() {
  const [poles, setPoles] = useState<Pole[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Pole editing state
  const [newPoleName, setNewPoleName] = useState('');
  const [editingPoleId, setEditingPoleId] = useState<string | null>(null);
  const [editPoleName, setEditPoleName] = useState('');

  // Service editing state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePoleId, setNewServicePoleId] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePoleId, setEditServicePoleId] = useState('');

  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const [p, s] = await Promise.all([apiFetch('/api/poles'), apiFetch('/api/services')]);
    if (p.ok) setPoles(await p.json());
    if (s.ok) setServices(await s.json());
    setLoading(false);
  }, []);

  const { user, isReady } = useAuthorizedAdminLoader(['ADMIN'], fetchAll);

  if (!isReady || !user) return null;

  // Poles CRUD
  const createPole = async () => {
    if (!newPoleName.trim()) return;
    setSaving(true);
    const res = await apiFetch('/api/poles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newPoleName.trim() }) });
    if (res.ok) { const p = await res.json(); setPoles(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name))); setNewPoleName(''); }
    else { const err = await res.json(); alert(err.error); }
    setSaving(false);
  };
  const updatePole = async () => {
    if (!editingPoleId || !editPoleName.trim()) return;
    setSaving(true);
    const res = await apiFetch(`/api/poles/${editingPoleId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editPoleName.trim() }) });
    if (res.ok) { const p = await res.json(); setPoles(prev => prev.map(x => x.id === editingPoleId ? p : x)); setEditingPoleId(null); }
    else { const err = await res.json(); alert(err.error); }
    setSaving(false);
  };
  const deletePole = async (id: string) => {
    if (!confirm('Supprimer ce pôle ? Les services rattachés seront détachés.')) return;
    const res = await apiFetch(`/api/poles/${id}`, { method: 'DELETE' });
    if (res.ok) { setPoles(prev => prev.filter(x => x.id !== id)); setServices(prev => prev.map(s => s.poleId === id ? { ...s, poleId: null, pole: null } : s)); }
  };

  // Services CRUD
  const createService = async () => {
    if (!newServiceName.trim()) return;
    setSaving(true);
    const res = await apiFetch('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newServiceName.trim(), poleId: newServicePoleId || null }) });
    if (res.ok) { const s = await res.json(); setServices(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name))); setNewServiceName(''); setNewServicePoleId(''); }
    else { const err = await res.json(); alert(err.error); }
    setSaving(false);
  };
  const updateService = async () => {
    if (!editingServiceId || !editServiceName.trim()) return;
    setSaving(true);
    const res = await apiFetch(`/api/services/${editingServiceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editServiceName.trim(), poleId: editServicePoleId || null }) });
    if (res.ok) { const s = await res.json(); setServices(prev => prev.map(x => x.id === editingServiceId ? s : x)); setEditingServiceId(null); }
    else { const err = await res.json(); alert(err.error); }
    setSaving(false);
  };
  const deleteService = async (id: string) => {
    if (!confirm('Supprimer ce service ?')) return;
    const res = await apiFetch(`/api/services/${id}`, { method: 'DELETE' });
    if (res.ok) setServices(prev => prev.filter(x => x.id !== id));
  };

  const POLE_COLORS: Record<string, string> = {
    // [POLE-ADULTE] 'Adulte': 'bg-blue-600',
    'Enfance': 'bg-emerald-600',
  };

  // Group services by pole for display
  const servicesByPole = poles.map(p => ({
    pole: p,
    services: services.filter(s => s.poleId === p.id).sort((a, b) => a.name.localeCompare(b.name)),
  }));
  const unassigned = services.filter(s => !s.poleId).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="p-4 lg:pl-36 lg:p-12 transition-all duration-300 outline-none">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-primary">Paramètres</h1>
          <p className="text-slate-500">Gestion des pôles et des services</p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── Pôles ── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-slate-800">Pôles</h2>
                  <p className="text-xs text-slate-400">{poles.length} pôle{poles.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {poles.map(p => (
                  <li key={p.id} className="flex items-center justify-between px-6 py-3">
                    {editingPoleId === p.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input value={editPoleName} onChange={e => setEditPoleName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') updatePole(); if (e.key === 'Escape') setEditingPoleId(null); }}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
                        <button onClick={updatePole} disabled={saving} aria-label="Confirmer" className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"><Check className="h-4 w-4" aria-hidden="true" /></button>
                        <button onClick={() => setEditingPoleId(null)} aria-label="Annuler" className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"><X className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', POLE_COLORS[p.name] || 'bg-primary')} />
                          <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                          <span className="text-xs text-slate-400">({services.filter(s => s.poleId === p.id).length} services)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingPoleId(p.id); setEditPoleName(p.name); }} aria-label="Éditer" className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                          <button onClick={() => deletePole(p.id)} aria-label="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
                {poles.length === 0 && <li className="px-6 py-4 text-sm text-slate-400 italic">Aucun pôle</li>}
              </ul>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                <input value={newPoleName} onChange={e => setNewPoleName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createPole(); }}
                  placeholder="Nouveau pôle..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                <button onClick={createPole} disabled={saving || !newPoleName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter
                </button>
              </div>
            </div>

            {/* ── Services ── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-black text-slate-800">Services</h2>
                <p className="text-xs text-slate-400">{services.length} service{services.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Services grouped by pole */}
              {servicesByPole.map(({ pole, services: poleSvcs }) => (
                <div key={pole.id}>
                  <div className={cn('px-6 py-2 flex items-center gap-2', POLE_COLORS[pole.name] ? 'bg-opacity-10' : '')}>
                    <span className={cn('text-xs font-black text-white px-2 py-0.5 rounded-full uppercase tracking-wider', POLE_COLORS[pole.name] || 'bg-primary')}>{pole.name}</span>
                  </div>
                  <ul className="divide-y divide-slate-100 border-b border-slate-100">
                    {poleSvcs.map(s => (
                      <li key={s.id} className="flex items-center justify-between px-6 py-2.5 pl-10">
                        {editingServiceId === s.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input value={editServiceName} onChange={e => setEditServiceName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') updateService(); if (e.key === 'Escape') setEditingServiceId(null); }}
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
                            <select value={editServicePoleId} onChange={e => setEditServicePoleId(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none">
                              <option value="">— Aucun pôle —</option>
                              {poles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button onClick={updateService} disabled={saving} aria-label="Confirmer" className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"><Check className="h-4 w-4" aria-hidden="true" /></button>
                            <button onClick={() => setEditingServiceId(null)} aria-label="Annuler" className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"><X className="h-4 w-4" aria-hidden="true" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-slate-700">{s.name}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingServiceId(s.id); setEditServiceName(s.name); setEditServicePoleId(s.poleId || ''); }} aria-label="Éditer" className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                              <button onClick={() => deleteService(s.id)} aria-label="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                    {poleSvcs.length === 0 && <li className="px-10 py-2 text-xs text-slate-400 italic">Aucun service</li>}
                  </ul>
                </div>
              ))}

              {/* Unassigned services */}
              {unassigned.length > 0 && (
                <div>
                  <div className="px-6 py-2"><span className="text-xs font-black text-slate-400 uppercase tracking-wider">Non assignés</span></div>
                  <ul className="divide-y divide-slate-100 border-b border-slate-100">
                    {unassigned.map(s => (
                      <li key={s.id} className="flex items-center justify-between px-6 py-2.5 pl-10">
                        {editingServiceId === s.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input value={editServiceName} onChange={e => setEditServiceName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') updateService(); if (e.key === 'Escape') setEditingServiceId(null); }}
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
                            <select value={editServicePoleId} onChange={e => setEditServicePoleId(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none">
                              <option value="">— Aucun pôle —</option>
                              {poles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button onClick={updateService} disabled={saving} aria-label="Confirmer" className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"><Check className="h-4 w-4" aria-hidden="true" /></button>
                            <button onClick={() => setEditingServiceId(null)} aria-label="Annuler" className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"><X className="h-4 w-4" aria-hidden="true" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-slate-700">{s.name}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingServiceId(s.id); setEditServiceName(s.name); setEditServicePoleId(s.poleId || ''); }} aria-label="Éditer" className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                              <button onClick={() => deleteService(s.id)} aria-label="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Add new service */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                <input value={newServiceName} onChange={e => setNewServiceName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createService(); }}
                  placeholder="Nouveau service..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                <select value={newServicePoleId} onChange={e => setNewServicePoleId(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">— Pôle —</option>
                  {poles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={createService} disabled={saving || !newServiceName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter
                </button>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
