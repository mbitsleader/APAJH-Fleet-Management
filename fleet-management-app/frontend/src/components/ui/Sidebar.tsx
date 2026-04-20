'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Calendar, ShieldCheck, Settings, Car, Menu, X as CloseIcon, LogOut, Users, Sparkles, User as UserIcon, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canAccessAdmin, canManageCleaningSchedule, canManageSettings, canManageUsers, canManageVehicles } from '@/lib/permissions';
import { apiFetch } from '@/lib/apiFetch';

export const Sidebar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifCount, setNotifCount] = React.useState(0);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role;

  // Récupération du nombre de notifications
  const fetchNotifications = React.useCallback(async () => {
    try {
      const response = await apiFetch('/api/notifications/summary');
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.count === 'number') {
          setNotifCount(data.count);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // 60 secondes
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // DEBUG LOG
  React.useEffect(() => {
    console.log('Sidebar Role Detection:', role);
  }, [role]);

  const navItems = [
    { href: '/settings', icon: UserIcon, label: 'Profil', visible: true, highlight: true },
    { href: '/', icon: LayoutDashboard, label: 'Tableau', visible: !!role },
    { href: '/calendar', icon: Calendar, label: 'Planning', visible: !!role },
    { href: '/nettoyage', icon: Sparkles, label: 'Nettoyage', visible: role === 'PROFESSIONNEL' },
    { href: '/admin', icon: ShieldCheck, label: 'Admin', visible: canAccessAdmin(role) },
    { href: '/admin/vehicles', icon: Car, label: 'Véhicules', visible: canManageVehicles(role) },
    { href: '/admin/users', icon: Users, label: 'Utilisateurs', visible: canManageUsers(role) },
    { href: '/admin/cleaning', icon: Sparkles, label: 'Planning', visible: canManageCleaningSchedule(role) },
    { href: '/admin/exports', icon: Download, label: 'Exports', visible: canAccessAdmin(role) },
    { href: '/admin/settings', icon: Settings, label: 'Paramètres', visible: canManageSettings(role) },
  ];

  const filteredNavItems = navItems.filter(item => item.visible);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="sidebar-nav"
        aria-label={isOpen ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'}
        className="fixed left-4 top-4 z-[100] flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white lg:hidden shadow-lg border border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {isOpen ? <CloseIcon aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
        />
      )}

      <aside
        id="sidebar-nav"
        className={cn(
          "fixed left-0 top-0 h-full w-28 flex-col items-center border-r bg-primary py-8 z-[95] shadow-2xl transition-transform duration-300 lg:flex lg:translate-x-0 overflow-y-auto custom-scrollbar",
          isOpen ? "translate-x-0 flex" : "-translate-x-full hidden lg:flex"
        )}
      >
        <div className="mb-12 p-4 w-full overflow-hidden flex items-center justify-center h-20 shrink-0">
          <img
            src="/logo.png"
            alt="APAJH"
            className="h-auto w-full filter brightness-0 invert scale-[1.8] transform"
          />
        </div>

        <nav className="flex flex-col gap-6 shrink-0" role="menubar" aria-label="Navigation principale">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-1 w-16 py-2.5 rounded-2xl transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white",
                  isActive
                    ? "bg-white text-primary shadow-lg"
                    : item.highlight 
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                )}
                aria-label={item.label}
              >
                <Icon aria-hidden="true" className={cn("h-5 w-5 transition-transform shrink-0", isActive ? "scale-110" : "group-hover:scale-110")} />
                
                {item.href === '/nettoyage' && notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg animate-in zoom-in duration-300">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}

                <span
                  className={cn(
                    "text-[9px] font-bold tracking-tight leading-none text-center",
                    isActive ? "text-primary" : "text-white/50 group-hover:text-white/80"
                  )}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute -right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-6 py-4 shrink-0">
          <button
            onClick={logout}
            aria-label="Déconnexion"
            className="group flex h-14 w-14 items-center justify-center rounded-2xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <LogOut aria-hidden="true" className="h-6 w-6 group-hover:scale-110 transition-transform" />
          </button>

          <div 
            className="h-10 w-10 rounded-full bg-white/10 border border-white/5 flex items-center justify-center text-white/40 overflow-hidden" 
            aria-label={`Utilisateur : ${user?.name || 'Inconnu'}`}
          >
            {user?.name ? (
              <span className="text-xs font-bold text-white/60 uppercase">
                {user.name.split(' ').map(n => n[0]).join('')}
              </span>
            ) : (
              <span className="text-xs font-bold">?</span>
            )}
          </div>
          
          <Link 
            href="/politique-confidentialite" 
            className="text-[10px] text-slate-400 hover:text-white transition-colors uppercase tracking-widest font-bold"
            aria-label="Politique de confidentialité et RGPD"
          >
            RGPD
          </Link>
        </div>
      </aside>
    </>
  );
};
