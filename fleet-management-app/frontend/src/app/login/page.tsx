'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight, ShieldCheck, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Identifiants incorrects.');
        return;
      }
      // Les cookies ('access_token', 'refresh_token') sont posés automatiquement via credentials: 'include'
      login({ id: data.id, name: data.name, role: data.role, email: data.email });
    } catch (err) {
      setError('Impossible de contacter le serveur. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0b] flex items-center justify-center p-4">
      {/* Background Animated Elements — decorative, hidden from screen readers */}
      <div aria-hidden="true" className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div aria-hidden="true" className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] animate-pulse" />

      {/* Glass Card */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in duration-700">
        <div className="glass rounded-[32px] border border-white/10 shadow-2xl p-8 md:p-12 backdrop-blur-3xl">

          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="h-44 w-full max-w-[300px] mb-8 transition-transform duration-500 hover:scale-105 flex items-center justify-center">
              <img
                src="/apajh-logo-new.png"
                alt="APAJH Logo"
                className="h-40 w-full object-contain"
              />
            </div>
            <p className="text-white/40 text-sm font-medium tracking-wide">
              Gestion de parc automobile • Fédération APAJH
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6" aria-label="Formulaire de connexion">
            {/* Zone d'erreur — toujours présente dans le DOM pour que aria-live fonctionne */}
            <div
              role="alert"
              aria-live="polite"
              className={cn(
                "flex items-center gap-3 rounded-2xl p-4 text-sm font-medium",
                error
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "hidden"
              )}
            >
              <span className="shrink-0" aria-hidden="true">⚠</span>
              <p>{error}</p>
            </div>

            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Identifiant professionnel</label>
                <div className="relative group">
                  <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                  <input
                    id="email"
                    type="email"
                    placeholder="nom@apajh.org"
                    autoComplete="email"
                    className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-white font-bold outline-none focus:border-primary/50 focus:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] transition-all placeholder:text-white/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Mot de passe</label>
                <div className="relative group">
                  <Lock aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-white font-bold outline-none focus:border-primary/50 focus:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] transition-all placeholder:text-white/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              aria-label={loading ? 'Connexion en cours...' : 'Se connecter'}
              className={cn(
                "w-full h-14 rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]",
                loading ? "bg-white/10 text-white/40" : "bg-primary text-white shadow-primary/20 hover:shadow-primary/40 hover:bg-primary/90"
              )}
            >
              {loading ? (
                <div className="flex items-center gap-2" role="status">
                  <div aria-hidden="true" className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Validation...</span>
                </div>
              ) : (
                <>
                  Se connecter
                  <ArrowRight aria-hidden="true" className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-10 flex flex-col items-center gap-4">
             <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-accent" />
                <span className="text-[10px] font-bold text-white/40 tracking-tight">Accès réservé au personnel APAJH</span>
             </div>
          </div>
        </div>
      </div>

      {/* Footer Branding — decorative */}
      <div aria-hidden="true" className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-30 select-none">
         <img src="/logo.png" alt="" className="h-6 grayscale invert" />
      </div>
    </div>
  );
}
