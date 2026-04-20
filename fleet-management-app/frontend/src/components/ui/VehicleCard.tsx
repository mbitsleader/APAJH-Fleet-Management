'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Car, Fuel, Gauge, CheckCircle2, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FuelModal } from './FuelModal';
import { VehicleDetailModal } from './VehicleDetailModal';
import { getCarImageUrl } from '@/lib/carImage';

interface VehicleCardProps {
  vehicle: {
    id: string;
    plateNumber: string;
    brand: string;
    model: string;
    status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'BLOCKED';
    category: string | null;
    currentMileage: number;
    fuelType: string | null;
    imageUrl: string | null;
    type: 'PERMANENT' | 'REPLACEMENT';
    lowFuel?: boolean;
    nextTechnicalInspection?: string | null;
  };
  onBook: () => void;
  onReport?: () => void;
  onFuelSuccess?: () => void;
  userId: string;
}

// Generate a deterministic gradient + color from brand name
function brandVisual(brand: string): { from: string; to: string; initial: string } {
  const colors: [string, string][] = [
    ['#1e3a5f', '#2d6a9f'], // deep blue
    ['#1a472a', '#2d7a4f'], // forest green
    ['#4a1942', '#8b3a8a'], // purple
    ['#7c2d12', '#c2410c'], // burnt orange
    ['#1e293b', '#475569'], // slate
    ['#064e3b', '#059669'], // emerald
    ['#1e1b4b', '#4338ca'], // indigo
    ['#450a0a', '#b91c1c'], // crimson
    ['#422006', '#b45309'], // amber dark
    ['#0c4a6e', '#0369a1'], // sky blue
  ];
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) >>> 0;
  const [from, to] = colors[hash % colors.length];
  return { from, to, initial: brand.charAt(0).toUpperCase() };
}

const BRAND_LOGOS: Record<string, string> = {
  renault: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Renault_2021_Text.svg/320px-Renault_2021_Text.svg.png',
  peugeot: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Peugeot_2021_Logo.svg/320px-Peugeot_2021_Logo.svg.png',
  citroën: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Citro%C8%9Bn_2022_logo.svg/320px-Citro%C8%9Bn_2022_logo.svg.png',
  citroen: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Citro%C8%9Bn_2022_logo.svg/320px-Citro%C8%9Bn_2022_logo.svg.png',
  ford: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_logo_flat.svg/320px-Ford_logo_flat.svg.png',
  toyota: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Toyota_carlogo.svg/320px-Toyota_carlogo.svg.png',
  volkswagen: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/320px-Volkswagen_logo_2019.svg.png',
  opel: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Opel_logo_2017.svg/320px-Opel_logo_2017.svg.png',
  fiat: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Fiat_Automobiles_logo.svg/320px-Fiat_Automobiles_logo.svg.png',
  mercedes: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/320px-Mercedes-Logo.svg.png',
  bmw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/320px-BMW.svg.png',
  audi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Audi-Logo_2016.svg/320px-Audi-Logo_2016.svg.png',
  nissan: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Nissan_2020_logo.svg/320px-Nissan_2020_logo.svg.png',
  hyundai: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Hyundai_Motor_Company_logo.svg/320px-Hyundai_Motor_Company_logo.svg.png',
  kia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Kia-logo.svg/320px-Kia-logo.svg.png',
};

export function VehiclePlaceholder({ brand, model }: { brand: string; model: string }) {
  const { from, to, initial } = brandVisual(brand);
  const key = brand.toLowerCase();
  const logoUrl = BRAND_LOGOS[key];
  const [logoOk, setLogoOk] = React.useState(true);

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 select-none"
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {logoUrl && logoOk ? (
        <img
          src={logoUrl}
          alt={brand}
          className="h-14 w-auto object-contain opacity-90 drop-shadow-md"
          style={{ filter: 'brightness(0) invert(1)' }}
          onError={() => setLogoOk(false)}
        />
      ) : (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-black text-white/90 shadow-inner"
          style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}
        >
          {initial}
        </div>
      )}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-black uppercase tracking-widest text-white/80">{brand}</span>
        <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{model}</span>
      </div>
    </div>
  );
}

const statusConfig = {
  AVAILABLE: {
    label: 'Disponible',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2,
  },
  IN_USE: {
    label: 'En cours',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    icon: Clock,
  },
  MAINTENANCE: {
    label: 'Maintenance',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: AlertCircle,
  },
  BLOCKED: {
    label: 'Bloqué',
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    icon: AlertCircle,
  },
};

export const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onBook, onReport, onFuelSuccess, userId }) => {
  const [isFuelModalOpen, setIsFuelModalOpen] = React.useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [apiImgError, setApiImgError] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Priority: stored imageUrl → imagin.studio API → placeholder
  const apiImageUrl = !vehicle.imageUrl && !apiImgError
    ? getCarImageUrl(vehicle.brand, vehicle.model)
    : null;

  const status = statusConfig[vehicle.status] || statusConfig.AVAILABLE;
  const StatusIcon = status.icon;

  // Calcul alerte Contrôle Technique
  let ctAlert: { color: string; label: string; urgent: boolean } | null = null;
  if (vehicle.nextTechnicalInspection) {
    const nextCt = new Date(vehicle.nextTechnicalInspection);
    const now = new Date();
    const diffDays = Math.ceil((nextCt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
      ctAlert = { color: 'bg-red-600 text-white shadow-red-500/40', label: diffDays < 0 ? 'C.T. DÉPASSÉ' : 'C.T. URGENT', urgent: true };
    } else if (diffDays <= 30) {
      ctAlert = { color: 'bg-amber-500 text-white shadow-amber-500/40', label: 'C.T. À PRÉVOIR', urgent: false };
    }
  }

  return (
    <>
      <div
        onClick={() => setIsDetailModalOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDetailModalOpen(true); } }}
        role="button"
        tabIndex={0}
        aria-label={`Voir les détails de ${vehicle.brand} ${vehicle.model}`}
        className="glass group relative overflow-hidden rounded-2xl p-0 transition-all hover:scale-[1.02] hover:shadow-2xl flex flex-col h-full cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
      >
        {/* Vehicle Image Header */}
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          {vehicle.imageUrl ? (
            <img
              src={vehicle.imageUrl}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : apiImageUrl ? (
            <img
              src={apiImageUrl}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="h-full w-full object-contain bg-white transition-transform duration-500 group-hover:scale-105"
              onError={() => setApiImgError(true)}
            />
          ) : (
            <VehiclePlaceholder brand={vehicle.brand} model={vehicle.model} />
          )}
          
          <div className="absolute right-4 top-4 flex flex-col gap-2 items-end">
            <div 
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md transition-colors", 
                status.color.replace('bg-', 'bg-').replace('/10', '/80')
              )}
              role="status"
              aria-label={`Statut : ${status.label}`}
            >
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {status.label}
            </div>

            {/* Alerte Contrôle Technique */}
            {ctAlert && (
              <div className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black shadow-lg border border-white/20 animate-in slide-in-from-right-2 duration-300",
                ctAlert.color,
                ctAlert.urgent && "animate-pulse"
              )}>
                <AlertCircle className="h-3 w-3" />
                {ctAlert.label}
              </div>
            )}
          </div>

          {/* Alerte Carburant Bas */}
          {vehicle.lowFuel && (
            <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black text-white shadow-lg animate-pulse border border-white/20">
              <Fuel className="h-3 w-3" />
              BESOIN PLEIN
            </div>
          )}
        </div>

        <div className="flex flex-col p-6 flex-grow">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight text-primary">
                  {vehicle.brand} <span className="text-muted-foreground font-medium">{vehicle.model}</span>
                </h3>
                {vehicle.type === 'REPLACEMENT' && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    Remplacement
                  </span>
                )}
              </div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
                {vehicle.plateNumber}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <Gauge className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold">Kilométrage</span>
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  {Number(vehicle.currentMileage).toLocaleString('fr-FR')} km
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <Fuel className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold">Énergie</span>
                <span className="text-sm font-semibold text-foreground">{vehicle.fuelType || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-3 pt-8">
            <button
              className={cn(
                "flex-[4] rounded-xl py-3 text-sm font-bold transition-all active:scale-95 shadow-md focus-visible:ring-2 outline-none",
                vehicle.status === 'AVAILABLE'
                  ? "bg-accent text-accent-foreground shadow-accent/20 hover:bg-accent/90 focus-visible:ring-accent"
                  : vehicle.status === 'IN_USE'
                  ? "bg-orange-500 text-white shadow-orange-500/20 hover:bg-orange-600 focus-visible:ring-orange-500"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
              disabled={vehicle.status !== 'AVAILABLE' && vehicle.status !== 'IN_USE'}
              onClick={(e) => { e.stopPropagation(); onBook(); }}
              aria-label={
                vehicle.status === 'AVAILABLE' 
                  ? `Réserver le véhicule ${vehicle.brand} ${vehicle.model}` 
                  : vehicle.status === 'IN_USE'
                  ? `Terminer le trajet pour ${vehicle.brand} ${vehicle.model}`
                  : 'Véhicule indisponible'
              }
            >
              {vehicle.status === 'AVAILABLE' ? 'Réserver maintenant' : vehicle.status === 'IN_USE' ? 'Terminer le trajet' : 'Indisponible'}
            </button>

            {onReport && (
              <button
                onClick={(e) => { e.stopPropagation(); onReport(); }}
                className="flex-[1] flex items-center justify-center rounded-xl bg-destructive/10 text-destructive py-3 transition-all hover:bg-destructive hover:text-white focus-visible:ring-2 focus-visible:ring-destructive outline-none group"
                title="Signaler un incident"
                aria-label={`Signaler un incident sur ${vehicle.brand} ${vehicle.model}`}
              >
                <AlertTriangle className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); setIsFuelModalOpen(true); }}
              className="flex-[1] flex items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 py-3 transition-all hover:bg-orange-500 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 outline-none group"
              title="Saisir un plein"
              aria-label={`Saisir un plein pour ${vehicle.brand} ${vehicle.model}`}
            >
              <Fuel className="h-5 w-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {mounted && createPortal(
        <>
          <FuelModal 
            vehicle={vehicle}
            isOpen={isFuelModalOpen}
            userId={userId}
            onClose={() => setIsFuelModalOpen(false)}
            onSuccess={() => onFuelSuccess?.()}
          />

          <VehicleDetailModal 
            vehicle={vehicle}
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
          />
        </>,
        document.body
      )}
    </>
  );
};
