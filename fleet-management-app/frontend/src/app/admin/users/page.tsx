'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuthorizedAdminLoader } from '@/lib/adminAccess';
import { canDeleteUser, canResetPassword } from '@/lib/permissions';
import { Sidebar } from '@/components/ui/Sidebar';
import {
  Users, UserPlus, Search, Trash2, UserCircle,
  Mail, Building2, CheckCircle2, Lock as LockIcon,
  ChevronLeft, ChevronRight, X, KeyRound, Eye, EyeOff, ShieldCheck, Shuffle, Tags
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const ROLES = ['ADMIN', 'DIRECTEUR', 'MANAGER', 'PROFESSIONNEL'];
const PAGE_SIZE = 25;

const ROLE_STYLES: Record<string, string> = {
  ADMIN:         'bg-red-500/10 text-red-500 border-red-500/20',
  DIRECTEUR:     'bg-purple-500/10 text-purple-500 border-purple-500/20',
  MANAGER:       'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PROFESSIONNEL: 'bg-green-500/10 text-green-500 border-green-500/20',
};

function generateStrongPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '!@#$%&*+-=?';
  const all     = upper + lower + digits + special;

  // Garantir au moins 1 de chaque catégorie
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(upper), pick(upper), pick(lower), pick(lower), pick(digits), pick(special)];

  // Compléter à 12 caractères
  for (let i = base.length; i < 12; i++) base.push(pick(all));

  // Mélanger
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}

const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
  { label: 'Une majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Une minuscule', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un chiffre', test: (p: string) => /\d/.test(p) },
  { label: 'Un caractère spécial (!@#$...)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(p) },
];

function PasswordStrengthIndicator({ password }: { password: string }) {
  const passed = PASSWORD_RULES.filter(r => r.test(password)).length;
  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {PASSWORD_RULES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < passed
                ? passed <= 2 ? "bg-red-500" : passed <= 3 ? "bg-amber-500" : passed <= 4 ? "bg-blue-500" : "bg-emerald-500"
                : "bg-muted"
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-0.5">
        {PASSWORD_RULES.map(rule => (
          <div key={rule.label} className={cn("flex items-center gap-2 text-[10px] font-medium transition-colors", rule.test(password) ? "text-emerald-600" : "text-muted-foreground")}>
            <span>{rule.test(password) ? '✓' : '○'}</span>
            {rule.label}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AddUserForm {
  name: string;
  email: string;
  role: string;
  department: string;
  password: string;
  poleIds: string[];
  serviceIds: string[];
}

interface RefItem { id: string; name: string; }

export default function UserManagementPage() {
  const [users, setUsers]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter]   = useState('ALL');
  const [deptFilter, setDeptFilter]   = useState('ALL');
  const [page, setPage]         = useState(1);

  const [poles, setPoles] = useState<RefItem[]>([]);
  const [services, setServices] = useState<RefItem[]>([]);
  const [assignTarget, setAssignTarget] = useState<{ id: string; name: string; poleIds: string[]; serviceIds: string[] } | null>(null);
  const [assignPoleIds, setAssignPoleIds] = useState<string[]>([]);
  const [assignServiceIds, setAssignServiceIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm]   = useState<AddUserForm>({ name: '', email: '', role: 'PROFESSIONNEL', department: '', password: '', poleIds: [], serviceIds: [] });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Change password modal
  const [pwdTarget, setPwdTarget] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdSuccessPassword, setPwdSuccessPassword] = useState('');
  const [pwdCopied, setPwdCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res  = await apiFetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRefs = useCallback(async () => {
    const [polesRes, servicesRes] = await Promise.all([apiFetch('/api/poles'), apiFetch('/api/services')]);
    if (polesRes.ok) setPoles(await polesRes.json());
    if (servicesRes.ok) setServices(await servicesRes.json());
  }, []);

  const loadPageData = useCallback(async () => {
    await Promise.all([fetchUsers(), fetchRefs()]);
  }, [fetchRefs, fetchUsers]);

  const { user, isReady } = useAuthorizedAdminLoader(['ADMIN', 'DIRECTEUR', 'MANAGER'], loadPageData);
  const canResetPasswords = canResetPassword(user?.role);
  const canDeleteUsers = canDeleteUser(user?.role);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password) {
      setAddError('Nom, email et mot de passe sont obligatoires.');
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: addForm.email.trim(),
          name: addForm.name.trim(),
          role: addForm.role,
          department: addForm.department.trim() || null,
          password: addForm.password,
          poleIds: addForm.poleIds,
          serviceIds: addForm.serviceIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(u => [...u, data]);
        setShowAddModal(false);
        setAddForm({ name: '', email: '', role: 'PROFESSIONNEL', department: '', password: '', poleIds: [], serviceIds: [] });
      } else {
        setAddError(data.error || 'Erreur lors de la création.');
      }
    } catch (e) {
      setAddError('Impossible de contacter le serveur.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTarget) return;
    setPwdLoading(true);
    setPwdError('');
    try {
      const res = await apiFetch(`/api/users/${pwdTarget.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdSuccess(true);
        setTimeout(() => {
          setPwdTarget(null);
          setNewPassword('');
          setPwdSuccess(false);
        }, 1500);
      } else {
        setPwdError(data.error || 'Erreur lors de la mise à jour.');
      }
    } catch (e) {
      setPwdError('Impossible de contacter le serveur.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (!assignTarget) return;
    setAssignLoading(true);
    try {
      const res = await apiFetch(`/api/users/${assignTarget.id}/assignments`, {
        method: 'PATCH',
        body: JSON.stringify({ poleIds: assignPoleIds, serviceIds: assignServiceIds }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === assignTarget.id ? { ...u, ...updated } : u));
        setAssignTarget(null);
      }
    } finally {
      setAssignLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(u => u.filter(x => x.id !== id));
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

  const departments = useMemo(
    () => Array.from(new Set(users.map(u => u.department).filter(Boolean))).sort() as string[],
    [users]
  );

  const filtered = useMemo(() => users.filter(u => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchDept = deptFilter === 'ALL' || u.department === deptFilter;
    return matchSearch && matchRole && matchDept;
  }), [users, search, roleFilter, deptFilter]);

  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const roleCounts = useMemo(
    () => ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {} as Record<string, number>),
    [users]
  );

  const hasActiveFilters = search || roleFilter !== 'ALL' || deptFilter !== 'ALL';
  const clearFilters = () => { setSearch(''); setRoleFilter('ALL'); setDeptFilter('ALL'); setPage(1); };

  if (!isReady) return null;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#f8f9fc] dark:bg-[#0a0a0b] lg:pl-28 outline-none">
      <Sidebar />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" aria-hidden="true" />
              Gestion du Personnel
            </h1>
            <p className="text-muted-foreground font-medium">{users.length} collaborateur{users.length > 1 ? 's' : ''} au total</p>
          </div>
          {(user?.role === 'ADMIN' || user?.role === 'DIRECTEUR') && (
            <button
              onClick={() => { setAddError(''); setShowAddModal(true); }}
              className="h-12 px-6 rounded-2xl bg-primary text-white font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all"
            >
              <UserPlus className="h-5 w-5" aria-hidden="true" /> Ajouter un collaborateur
            </button>
          )}
        </div>

        {/* Compteurs par rôle */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => applyFilter(() => setRoleFilter(roleFilter === r ? 'ALL' : r))}
              className={cn(
                "glass p-4 rounded-2xl flex items-center gap-3 text-left transition-all border-2",
                roleFilter === r ? "border-primary shadow-lg shadow-primary/10" : "border-transparent hover:border-primary/20"
              )}
            >
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0", ROLE_STYLES[r])}>
                {roleCounts[r]}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{r}</p>
                <p className="text-sm font-bold">{roleCounts[r]} membre{roleCounts[r] > 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Barre de filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              aria-label="Rechercher un collaborateur"
              placeholder="Rechercher par nom ou email..."
              className="w-full h-12 rounded-2xl border bg-card pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={search}
              onChange={e => applyFilter(() => setSearch(e.target.value))}
            />
          </div>
          <select
            aria-label="Filtrer par rôle"
            value={roleFilter}
            onChange={e => applyFilter(() => setRoleFilter(e.target.value))}
            className="h-12 rounded-2xl border bg-card px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all min-w-[160px]"
          >
            <option value="ALL">Tous les rôles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            aria-label="Filtrer par département"
            value={deptFilter}
            onChange={e => applyFilter(() => setDeptFilter(e.target.value))}
            className="h-12 rounded-2xl border bg-card px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all min-w-[180px]"
          >
            <option value="ALL">Tous les départements</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-12 px-4 rounded-2xl border bg-card text-sm font-bold text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all flex items-center gap-2 shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" /> Réinitialiser
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
          <span>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}{hasActiveFilters ? ' (filtré)' : ''}</span>
          {totalPages > 1 && <span>Page {page} / {totalPages}</span>}
        </div>

        {/* Tableau */}
        <div className="glass rounded-[32px] overflow-hidden border border-white/5 shadow-xl bg-white/40 dark:bg-white/5 backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-white/5">
                <tr className="bg-muted/30">
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Collaborateur</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rôle</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Département</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pôles / Services</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Statut</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginated.map(u => (
                  <tr key={u.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-black text-xs border border-primary/10 shrink-0">
                          {u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-black text-foreground">{u.name}</p>
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" aria-hidden="true" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border", ROLE_STYLES[u.role] || 'bg-muted text-muted-foreground border-muted')}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 opacity-50" aria-hidden="true" />
                        {u.department || 'Non assigné'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {u.userPoles?.map((up: any) => (
                          <span key={up.poleId} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5 font-semibold">{up.pole.name}</span>
                        ))}
                        {u.userServices?.map((us: any) => (
                          <span key={us.serviceId} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 font-semibold">{us.service.name}</span>
                        ))}
                        {(!u.userPoles?.length && !u.userServices?.length) && (
                          <span className="text-[10px] text-muted-foreground italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span className="text-xs font-bold uppercase tracking-widest">Actif</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Edit assignments button */}
                        {(user?.role === 'ADMIN' || user?.role === 'DIRECTEUR') && (
                          <button
                            onClick={() => {
                              const pids = u.userPoles?.map((up: any) => up.poleId) || [];
                              const sids = u.userServices?.map((us: any) => us.serviceId) || [];
                              setAssignTarget({ id: u.id, name: u.name, poleIds: pids, serviceIds: sids });
                              setAssignPoleIds(pids);
                              setAssignServiceIds(sids);
                            }}
                            className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all"
                            title="Modifier pôles & services"
                            aria-label="Modifier pôles & services"
                          >
                            <Tags className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {/* Change password button */}
                        {canResetPasswords && (
                          <button
                            onClick={() => { setPwdTarget({ id: u.id, name: u.name }); setPwdError(''); setNewPassword(''); setPwdSuccess(false); }}
                            className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white flex items-center justify-center transition-all"
                            title="Modifier le mot de passe"
                            aria-label="Modifier le mot de passe"
                          >
                            <KeyRound className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}

                        {canDeleteUsers && (u.role !== 'ADMIN' ? (
                          <button
                            onClick={() => setConfirmDelete({ id: u.id, name: u.name })}
                            className="h-9 w-9 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                            title="Supprimer"
                            aria-label="Supprimer le collaborateur"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground cursor-not-allowed" title="L'admin ne peut pas être supprimé">
                            <LockIcon className="h-4 w-4" aria-hidden="true" />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginated.length === 0 && (
              <div className="p-12 text-center">
                <UserCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="font-bold text-muted-foreground">Aucun collaborateur trouvé.</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="mt-3 text-xs text-primary font-bold hover:underline">
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Page précédente" disabled={page === 1} className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button key={p} onClick={() => setPage(p)} className={cn("h-9 w-9 rounded-xl border text-xs font-bold transition-all", page === p ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-card hover:bg-muted")}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-label="Page suivante" disabled={page === totalPages} className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Supprimer le collaborateur"
        description={`Vous êtes sur le point de supprimer "${confirmDelete?.name}". Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        danger
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Modal Changer le mot de passe */}
      {pwdTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <KeyRound className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Modifier le mot de passe</h2>
                    <p className="text-xs text-muted-foreground">{pwdTarget.name}</p>
                  </div>
                </div>
                <button onClick={() => setPwdTarget(null)} aria-label="Fermer" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {pwdSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <ShieldCheck className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <p className="font-black text-emerald-600">Mot de passe mis à jour !</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="pwd-target-new" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nouveau mot de passe *</label>
                      <button
                        type="button"
                        onClick={() => { setNewPassword(generateStrongPassword()); setShowNewPassword(true); }}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 transition-colors px-2 py-1 rounded-lg hover:bg-amber-500/5"
                      >
                        <Shuffle className="h-3 w-3" aria-hidden="true" /> Générer
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="pwd-target-new"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Nouveau mot de passe fort..."
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full h-11 rounded-xl border bg-muted/30 px-4 pr-11 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        required
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowNewPassword(v => !v)} aria-label="Afficher/Masquer le mot de passe" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newPassword && <PasswordStrengthIndicator password={newPassword} />}
                  </div>

                  {pwdError && (
                    <p className="text-xs font-bold text-red-500 bg-red-500/10 rounded-xl px-4 py-2">{pwdError}</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setPwdTarget(null)} className="flex-1 h-11 rounded-xl border bg-card text-sm font-bold text-muted-foreground hover:bg-muted transition-all">
                      Annuler
                    </button>
                    <button type="submit" disabled={pwdLoading} className="flex-1 h-11 rounded-xl bg-amber-500 text-white text-sm font-black shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {pwdLoading ? 'Mise à jour...' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajouter un collaborateur */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <UserPlus className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Ajouter un collaborateur</h2>
                    <p className="text-xs text-muted-foreground">Nouveau compte utilisateur</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} aria-label="Fermer" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="user-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom complet *</label>
                  <input
                    id="user-name"
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full h-11 rounded-xl border bg-muted/30 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="user-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email *</label>
                  <input
                    id="user-email"
                    type="email"
                    placeholder="jean.dupont@entreprise.fr"
                    value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full h-11 rounded-xl border bg-muted/30 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="user-role" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rôle *</label>
                  <select
                    id="user-role"
                    value={addForm.role}
                    onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full h-11 rounded-xl border bg-muted/30 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="user-department" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Département <span className="font-normal lowercase italic">(optionnel)</span></label>
                  <input
                    id="user-department"
                    type="text"
                    placeholder="Ex: RH, IT, Finance..."
                    value={addForm.department}
                    onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full h-11 rounded-xl border bg-muted/30 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="user-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mot de passe *</label>
                    <button
                      type="button"
                      onClick={() => { setAddForm(f => ({ ...f, password: generateStrongPassword() })); setShowAddPassword(true); }}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/5"
                    >
                      <Shuffle className="h-3 w-3" aria-hidden="true" /> Générer
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="user-password"
                      type={showAddPassword ? 'text' : 'password'}
                      placeholder="Mot de passe fort..."
                      value={addForm.password}
                      onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full h-11 rounded-xl border bg-muted/30 px-4 pr-11 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                    <button type="button" onClick={() => setShowAddPassword(v => !v)} aria-label="Afficher/Masquer le mot de passe" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {addForm.password && <PasswordStrengthIndicator password={addForm.password} />}
                </div>

                {poles.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pôles <span className="font-normal lowercase italic">(optionnel)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {poles.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAddForm(f => ({ ...f, poleIds: f.poleIds.includes(p.id) ? f.poleIds.filter(id => id !== p.id) : [...f.poleIds, p.id] }))}
                          className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors', addForm.poleIds.includes(p.id) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400')}
                        >{p.name}</button>
                      ))}
                    </div>
                  </div>
                )}

                {services.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Services <span className="font-normal lowercase italic">(optionnel)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {services.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setAddForm(f => ({ ...f, serviceIds: f.serviceIds.includes(s.id) ? f.serviceIds.filter(id => id !== s.id) : [...f.serviceIds, s.id] }))}
                          className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors', addForm.serviceIds.includes(s.id) ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400')}
                        >{s.name}</button>
                      ))}
                    </div>
                  </div>
                )}

                {addError && (
                  <p className="text-xs font-bold text-red-500 bg-red-500/10 rounded-xl px-4 py-2">{addError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 h-11 rounded-xl border bg-card text-sm font-bold text-muted-foreground hover:bg-muted transition-all">
                    Annuler
                  </button>
                  <button type="submit" disabled={addLoading} className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-black shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {addLoading ? 'Création...' : 'Créer le compte'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Modal Pôles & Services */}
      {assignTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <Tags className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Pôles & Services</h2>
                    <p className="text-xs text-muted-foreground">{assignTarget.name}</p>
                  </div>
                </div>
                <button onClick={() => setAssignTarget(null)} aria-label="Fermer" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5">
                {poles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pôles</p>
                    <div className="flex flex-wrap gap-2">
                      {poles.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => setAssignPoleIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                          className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors', assignPoleIds.includes(p.id) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400')}
                        >{p.name}</button>
                      ))}
                    </div>
                  </div>
                )}
                {services.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Services</p>
                    <div className="flex flex-wrap gap-2">
                      {services.map(s => (
                        <button key={s.id} type="button"
                          onClick={() => setAssignServiceIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                          className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors', assignServiceIds.includes(s.id) ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400')}
                        >{s.name}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setAssignTarget(null)} className="flex-1 h-11 rounded-xl border bg-card text-sm font-bold text-muted-foreground hover:bg-muted transition-all">Annuler</button>
                <button onClick={handleSaveAssignments} disabled={assignLoading} className="flex-1 h-11 rounded-xl bg-blue-500 text-white text-sm font-black hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50">
                  {assignLoading ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
