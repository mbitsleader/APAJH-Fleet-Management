'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-md bg-slate-200/60", className)} />
);

export const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
    <Skeleton className="h-32 md:col-span-2 rounded-3xl" />
    <Skeleton className="h-32 rounded-3xl" />
    <Skeleton className="h-32 rounded-3xl" />
    <Skeleton className="h-32 rounded-3xl" />
    <Skeleton className="h-32 md:col-span-3 rounded-3xl" />
  </div>
);

export const VehicleCardSkeleton = () => (
  <div className="glass rounded-3xl overflow-hidden border-slate-200/60 h-[400px]">
    <Skeleton className="h-44 w-full rounded-none" />
    <div className="p-5 flex flex-col gap-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <div className="mt-auto flex gap-2">
        <Skeleton className="h-10 flex-[3]" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  </div>
);
