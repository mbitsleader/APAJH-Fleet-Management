'use client';

import React from 'react';
import { Car, Fuel, AlertCircle, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BentoStatProps {
  title: string;
  value: string | number;
  label: string;
  icon: React.ElementType;
  color: string;
  className?: string;
  trend?: string;
}

const BentoStat: React.FC<BentoStatProps> = ({ title, value, label, icon: Icon, color, className, trend }) => (
  <div className={cn(
    "glass relative overflow-hidden rounded-3xl p-6 group",
    className
  )}>
    <div className={cn("absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-5 blur-2xl transition-all duration-500 group-hover:opacity-10 group-hover:scale-125", color)} />
    
    <div className="flex flex-col h-full justify-between gap-4">
      <div className="flex items-center justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shadow-soft-sm ring-1 ring-inset ring-white/20 transition-all duration-300 group-hover:scale-110", color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          {trend && (
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/5 px-2 py-0.5 text-[9px] font-black text-emerald-600 border border-emerald-500/10">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </div>
          )}
          <div className={cn("status-pulse", color.replace('bg-', 'text-'))}>
            <span className="status-pulse-inner" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current" />
          </div>
        </div>
      </div>
      
      <div className="space-y-1">
        <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">{title}</h4>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-black tracking-tight text-slate-900 leading-none">{value}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
        </div>
      </div>
    </div>
  </div>
);

export const DashboardBento = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
      {/* Total Flotte */}
      <BentoStat 
        title="Flotte Totale"
        value="12"
        label="Véhicules"
        icon={Car}
        color="bg-primary"
        className="md:col-span-2"
        trend="+1"
      />

      {/* Disponibles */}
      <BentoStat 
        title="Disponibilité"
        value="8"
        label="Véhicules"
        icon={CheckCircle2}
        color="bg-emerald-500"
      />

      {/* En Cours */}
      <BentoStat 
        title="Utilisation"
        value="3"
        label="Missions"
        icon={Clock}
        color="bg-blue-500"
      />

      {/* Alertes Carburant */}
      <BentoStat 
        title="Alertes Carburant"
        value="2"
        label="Critique"
        icon={Fuel}
        color="bg-red-500"
      />

      {/* Alertes Maintenance */}
      <BentoStat 
        title="Maintenance"
        value="1"
        label="Action"
        icon={AlertCircle}
        color="bg-amber-500"
        className="md:col-span-3"
      />
    </div>
  );
};
