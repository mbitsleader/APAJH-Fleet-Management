'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { Settings as SettingsIcon, Shield, Save, Eye, EyeOff, Lock, User as UserIcon, Download, Package, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
  { label: 'Une majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Une minuscule', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un chiffre', test: (p: string) => /\d/.test(p) },
  { label: 'Un caractère spécial (!@#$...)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [rgpdLoading, setRgpdLoading] = useState(false);

  const confirmMismatch = confirmPwd.length > 0 && newPwd !== confirmPwd;

  const handleRgpdExport = async () => {
    setRgpdLoading(true);
    try {
      const response = await fetch('/api/exports/user-data', { credentials: 'include' });
      if (!response.ok) throw new Error('Erreur serveur');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mes_donnees_personnelles_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — user can retry
    } finally {
      setRgpdLoading(false);
    }
  };
  const allRulesPassed = PASSWORD_RULES.every(r => r.test(newPwd));

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (newPwd !== confirmPwd) {
      setPwdError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!allRulesPassed) {
      setPwdError('Le nouveau mot de passe ne respecte pas toutes les règles.');
      return;
    }
    setPwdLoading(true);
    try {
      const res = await apiFetch(`/api/users/${user!.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPwd, currentPassword: currentPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdSuccess(true);
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
        setTimeout(() => setPwdSuccess(false), 5000);
      } else {
        setPwdError(data.error || 'Erreur lors de la mise à jour.');
      }
    } catch {
      setPwdError('Impossible de contacter le serveur.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="lg:pl-28 min-h-screen pb-20 outline-none">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <UserIcon className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Mon Profil & Sécurité</h1>
          </div>
        </header>

        <section className="p-8 max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">

          {/* Section Profil */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Informations Personnelles</h3>
              <p className="text-sm text-muted-foreground">Vos détails professionnels enregistrés dans le système.</p>
            </div>
            <div className="md:col-span-2 glass p-8 rounded-3xl space-y-6 relative overflow-hidden border-primary/10 shadow-xl shadow-primary/5">
              <div className="absolute -top-6 -right-6 p-8 opacity-[0.03]">
                <UserIcon className="h-48 w-48 text-primary" />
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
                <div className="h-24 w-24 rounded-3xl bg-primary text-white flex items-center justify-center text-4xl font-black shadow-2xl shadow-primary/30 ring-4 ring-white/50">
                  {user?.name ? user.name.split(' ').map(n => n[0]).join('') : '?'}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">{user?.name}</h2>
                  <p className="text-primary font-bold text-lg">{user?.email}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                    <span className="px-3 py-1 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
                      {user?.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-slate-100">
                <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Identifiant Unique</p>
                  <p className="text-xs font-mono font-bold text-slate-500 break-all">{user?.id}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type de Compte</p>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                    <p className="text-xs font-bold text-slate-600 uppercase">Local Sécurisé</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Mot de passe */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t border-slate-200">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> Sécurité
              </h3>
              <p className="text-sm text-muted-foreground">Mettez à jour votre mot de passe pour sécuriser votre accès.</p>
            </div>
            <div className="md:col-span-2 glass p-8 rounded-3xl border-slate-200 shadow-lg">
              {pwdSuccess && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-emerald-700 font-bold text-sm animate-in fade-in zoom-in duration-300" role="alert">
                  <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Save className="h-3.5 w-3.5" />
                  </div>
                  Mot de passe mis à jour avec succès !
                </div>
              )}
              
              <form onSubmit={handleChangePwd} className="space-y-6" noValidate>
                {/* Mot de passe actuel */}
                <div className="space-y-2">
                  <label htmlFor="current-password" shaking-text="true" className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                    Mot de passe actuel
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                      id="current-password"
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      className="w-full h-12 rounded-2xl border bg-white/50 pl-11 pr-12 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                      required
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                      aria-label={showCurrentPwd ? 'Masquer' : 'Afficher'}
                    >
                      {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Nouveau mot de passe */}
                  <div className="space-y-2">
                    <label htmlFor="new-password" className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                      Nouveau mot de passe
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                      <input
                        id="new-password"
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPwd}
                        onChange={e => setNewPwd(e.target.value)}
                        className="w-full h-12 rounded-2xl border bg-white/50 pl-11 pr-12 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                        required
                        placeholder="Nouveau..."
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                        aria-label={showNewPwd ? 'Masquer' : 'Afficher'}
                      >
                        {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmer */}
                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                      <input
                        id="confirm-password"
                        type={showConfirmPwd ? 'text' : 'password'}
                        value={confirmPwd}
                        onChange={e => setConfirmPwd(e.target.value)}
                        className={cn(
                          "w-full h-12 rounded-2xl border bg-white/50 pl-11 pr-12 text-sm font-bold outline-none focus:ring-4 transition-all",
                          confirmMismatch ? "border-rose-400 focus:ring-rose-100" : "focus:ring-primary/10 focus:border-primary"
                        )}
                        required
                        placeholder="Confirmer..."
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                        aria-label={showConfirmPwd ? 'Masquer' : 'Afficher'}
                      >
                        {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Règles */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Règles de sécurité</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {PASSWORD_RULES.map(rule => (
                      <div
                        key={rule.label}
                        className={cn(
                          "flex items-center gap-2 text-xs font-bold transition-all",
                          rule.test(newPwd) ? "text-emerald-600" : "text-slate-400"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full flex items-center justify-center border transition-all",
                          rule.test(newPwd) ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300"
                        )}>
                          {rule.test(newPwd) && <Save className="h-2 w-2" />}
                        </div>
                        {rule.label}
                      </div>
                    ))}
                  </div>
                </div>

                {pwdError && (
                  <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold animate-shake" role="alert">
                    <Lock className="h-4 w-4" /> {pwdError}
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={pwdLoading || confirmMismatch || !currentPwd || !newPwd || !confirmPwd || !allRulesPassed}
                    className="group flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 font-black text-white shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:scale-100"
                  >
                    {pwdLoading ? (
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                    )}
                    {pwdLoading ? 'Mise à jour en cours...' : 'Mettre à jour le mot de passe'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Section RGPD */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t border-slate-200">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Mes données personnelles
              </h3>
              <p className="text-sm text-muted-foreground">
                Exportez toutes les données vous concernant (obligation RGPD Art. 15).
              </p>
            </div>
            <div className="md:col-span-2 glass p-8 rounded-3xl border-slate-200 shadow-lg">
              <p className="text-sm text-muted-foreground mb-6">
                Ce fichier JSON contient l'ensemble de vos données personnelles enregistrées dans le système :
                profil, réservations, trajets, incidents signalés, pleins de carburant et planning de nettoyage.
              </p>
              <button
                onClick={handleRgpdExport}
                disabled={rgpdLoading}
                aria-label="Exporter mes données personnelles au format JSON"
                aria-busy={rgpdLoading}
                className="flex items-center gap-3 rounded-2xl bg-primary/10 border border-primary/20 px-6 py-3 text-sm font-black text-primary hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rgpdLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Génération...</span></>
                  : <><Download className="h-4 w-4" /><span>Exporter mes données (JSON)</span></>
                }
              </button>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}
