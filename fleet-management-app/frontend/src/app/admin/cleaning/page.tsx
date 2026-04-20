'use client';

import React, { useState, useCallback } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { apiFetch } from '@/lib/apiFetch';
import { useAuthorizedAdminLoader } from '@/lib/adminAccess';
import { formatLocalDate, getMonday, formatWeek, isoWeek } from '@/lib/date';
import { ADMIN_ACCESS_ROLES } from '@/lib/permissions';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Pencil, Trash2, Plus, X, Check, UserPlus, Sparkles } from 'lucide-react';
import { BulkCleaningModal } from '@/components/ui/BulkCleaningModal';
import { cn } from '@/lib/utils';

interface UserSimple {
  id: string;
  name: string;
  role: string;
  userServices?: { serviceId: string; service: { id: string; name: string } }[];
}
interface Service { id: string; name: string; }
interface Vehicle {
  id: string; brand: string; model: string; plateNumber: string;
  service: Service | null;
  assignedUser: UserSimple | null;
}
interface Assignment { id: string; userId: string; user: UserSimple; completedAt: string | null; }
interface Schedule { 
  id: string; 
  vehicleId: string; 
  weekStart: string; 
  isDone: boolean; 
  notes: string | null; 
  plannedDays: string | null; // Nouveau
  assignments: Assignment[]; 
}
interface Item { vehicle: Vehicle; schedule: Schedule | null; }

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const DayBadges = ({ plannedDays }: { plannedDays: string | null }) => {
  if (!plannedDays) return null;
  const days = plannedDays.split(',').map(Number);
  return (
    <div className="flex gap-1 mt-1.5">
      {[1, 2, 3, 4, 5, 6, 0].map((d, i) => {
        const active = days.includes(d);
        return (
          <span
            key={d}
            className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-md border transition-all",
              active 
                ? "bg-primary text-white border-primary shadow-sm" 
                : "bg-slate-50 text-slate-300 border-slate-100"
            )}
          >
            {DAYS_SHORT[i]}
          </span>
        );
      })}
    </div>
  );
};

export default function CleaningPage() {
  const [weekDate, setWeekDate] = useState<Date>(getMonday(new Date()));
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<UserSimple[]>([]);

  // Edit state
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showExtraService, setShowExtraService] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Confirmation state (who actually did the cleaning)
  const [confirmingDoneId, setConfirmingDoneId] = useState<string | null>(null);
  const [completedByIds, setCompletedByIds] = useState<string[]>([]);
  const [showExtraForConfirmation, setShowExtraForConfirmation] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/cleaning?week=${isoWeek(weekDate)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [weekDate]);

  const fetchProfessionals = useCallback(async () => {
    const res = await apiFetch('/api/users');
    if (res.ok) {
      const users: any[] = await res.json();
      setProfessionals(users.filter(u => u.role === 'PROFESSIONNEL'));
    }
  }, []);

  const loadPageData = useCallback(async () => {
    await Promise.all([fetchSchedule(), fetchProfessionals()]);
  }, [fetchProfessionals, fetchSchedule]);

  const { user, isReady } = useAuthorizedAdminLoader(ADMIN_ACCESS_ROLES, loadPageData);

  const prevWeek = () => { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d); };
  const nextWeek = () => { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d); };
  const goToday = () => setWeekDate(getMonday(new Date()));

  // ── Edit helpers ──────────────────────────────────────────────
  const startEdit = (item: Item) => {
    cancelConfirmation();
    setEditingVehicleId(item.vehicle.id);
    setSelectedUserIds(item.schedule?.assignments.map(a => a.userId) || []);
    setShowExtraService(false);
  };

  const cancelEdit = () => {
    setEditingVehicleId(null);
    setSelectedUserIds([]);
    setShowExtraService(false);
  };

  const toggleUser = (uid: string) => {
    setSelectedUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const saveAssignment = async (vehicleId: string) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/cleaning/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, weekDate: isoWeek(weekDate), assignedUserIds: selectedUserIds }),
      });
      if (res.ok) {
        await fetchSchedule();
        cancelEdit();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la sauvegarde.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Confirmation helpers (who actually did the cleaning) ──────
  const startConfirmDone = (schedule: Schedule) => {
    cancelEdit();
    setConfirmingDoneId(schedule.id);
    // Pre-select all currently assigned professionals
    setCompletedByIds(schedule.assignments.map(a => a.userId));
    setShowExtraForConfirmation(false);
  };

  const cancelConfirmation = () => {
    setConfirmingDoneId(null);
    setCompletedByIds([]);
    setShowExtraForConfirmation(false);
  };

  const toggleCompleted = (uid: string) => {
    setCompletedByIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const confirmDone = async (scheduleId: string) => {
    const res = await apiFetch(`/api/cleaning/schedule/${scheduleId}/done`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: true, completedByUserIds: completedByIds }),
    });
    if (res.ok) {
      await fetchSchedule();
      cancelConfirmation();
    }
  };

  const toggleDone = async (schedule: Schedule) => {
    if (!schedule.isDone) {
      // Start confirmation flow instead of direct toggle
      startConfirmDone(schedule);
      return;
    }
    // Unmark directly
    const res = await apiFetch(`/api/cleaning/schedule/${schedule.id}/done`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: false }),
    });
    if (res.ok) fetchSchedule();
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Supprimer ce planning ?')) return;
    const res = await apiFetch(`/api/cleaning/schedule/${scheduleId}`, { method: 'DELETE' });
    if (res.ok) fetchSchedule();
  };

  if (!isReady || !user) return null;

  const isToday = isoWeek(weekDate) === isoWeek(getMonday(new Date()));

  // Helper: split professionals by vehicle's service
  const getProsForVehicle = (vehicle: Vehicle) => {
    if (!vehicle.service) return { inService: professionals, outService: [] };
    const inService = professionals.filter(p =>
      p.userServices?.some(us => us.serviceId === vehicle.service!.id)
    );
    const inServiceIds = new Set(inService.map(p => p.id));
    const outService = professionals.filter(p => !inServiceIds.has(p.id));
    return { inService, outService };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="p-4 lg:pl-36 lg:p-12 transition-all duration-300">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Planning Nettoyage</h1>
            <p className="text-slate-500">Planning hebdomadaire de lavage des véhicules</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setBulkModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="h-4 w-4" /> Planification Rapide
            </button>
            <div className="flex items-center gap-2">
              <button onClick={prevWeek} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={goToday} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${isToday ? 'bg-primary text-white border-primary' : 'border-slate-200 hover:bg-slate-100 text-slate-700'}`}>
                {formatWeek(weekDate)}
              </button>
              <button onClick={nextWeek} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Stats */}
        {!loading && (
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
              <p className="text-2xl font-black text-primary">{items.length}</p>
              <p className="text-xs text-slate-500 mt-1">Véhicules</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
              <p className="text-2xl font-black text-green-600">{items.filter(i => i.schedule?.isDone).length}</p>
              <p className="text-xs text-slate-500 mt-1">Nettoyés</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
              <p className="text-2xl font-black text-amber-500">{items.filter(i => i.schedule && !i.schedule.isDone).length}</p>
              <p className="text-xs text-slate-500 mt-1">Planifiés</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Chargement...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Aucun véhicule dans votre périmètre.</div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Véhicule</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Service</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Professionnels assignés</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Statut</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(({ vehicle, schedule }) => {
                  const isEditing = editingVehicleId === vehicle.id;
                  const isConfirming = confirmingDoneId !== null && schedule?.id === confirmingDoneId;
                  const isSolo = !!vehicle.assignedUser;
                  const { inService, outService } = getProsForVehicle(vehicle);

                  // For confirmation: assigned pros and "others" not assigned
                  const assignedIds = new Set(schedule?.assignments.map(a => a.userId) ?? []);
                  const otherPros = professionals.filter(p => !assignedIds.has(p.id));

                  return (
                    <React.Fragment key={vehicle.id}>
                      <tr className={`transition-colors ${schedule?.isDone ? 'bg-green-50/50' : isConfirming ? 'bg-green-50/30' : 'hover:bg-slate-50/50'}`}>

                        {/* Vehicle */}
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{vehicle.brand} {vehicle.model}</p>
                          <p className="text-xs text-slate-400">{vehicle.plateNumber}</p>
                          {isSolo && (
                            <span className="mt-1 inline-block text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                              Solo : {vehicle.assignedUser!.name}
                            </span>
                          )}
                        </td>

                        {/* Service */}
                        <td className="px-4 py-4">
                          {vehicle.service ? (
                            <span className="inline-block text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                              {vehicle.service.name}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Professionals */}
                        <td className="px-4 py-4 max-w-xs">
                          {isEditing ? (
                            <div className="space-y-2">
                              {inService.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {inService.map(p => (
                                    <button
                                      key={p.id}
                                      onClick={() => toggleUser(p.id)}
                                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                        selectedUserIds.includes(p.id)
                                          ? 'bg-primary text-white border-primary'
                                          : 'bg-white text-slate-600 border-slate-300 hover:border-primary'
                                      }`}
                                    >
                                      {p.name}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">Aucun professionnel dans ce service</p>
                              )}

                              {outService.length > 0 && (
                                <>
                                  <button
                                    onClick={() => setShowExtraService(v => !v)}
                                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                                      showExtraService
                                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                                        : 'bg-white text-slate-500 border-dashed border-slate-300 hover:border-amber-400 hover:text-amber-600'
                                    }`}
                                    title="Ajouter un professionnel d'un autre service (remplacement occasionnel)"
                                  >
                                    <UserPlus className="h-3 w-3" />
                                    {showExtraService ? 'Masquer autres services' : '+ Autre service'}
                                  </button>

                                  {showExtraService && (
                                    <div className="border border-dashed border-amber-300 rounded-xl p-2 bg-amber-50/50 space-y-1">
                                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">
                                        Remplacement occasionnel
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {outService.map(p => {
                                          const svcName = p.userServices?.[0]?.service?.name ?? 'autre service';
                                          return (
                                            <button
                                              key={p.id}
                                              onClick={() => toggleUser(p.id)}
                                              title={`Service : ${svcName}`}
                                              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                                selectedUserIds.includes(p.id)
                                                  ? 'bg-amber-500 text-white border-amber-500'
                                                  : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400'
                                              }`}
                                            >
                                              {p.name}
                                              <span className="ml-1 opacity-60 text-[10px]">({svcName})</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : schedule?.assignments && schedule.assignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {schedule.assignments.map(a => {
                                const isFromService = vehicle.service
                                  ? a.user.userServices?.some(us => us.serviceId === vehicle.service!.id)
                                  : true;
                                const didComplete = !!a.completedAt;
                                return (
                                  <span
                                    key={a.id}
                                    title={
                                      didComplete
                                        ? `A effectué le nettoyage${!isFromService ? ' (autre service)' : ''}`
                                        : !isFromService ? 'Remplacement depuis un autre service' : undefined
                                    }
                                    className={`text-xs rounded-full px-2 py-0.5 flex items-center gap-0.5 ${
                                      didComplete
                                        ? 'bg-green-100 text-green-700 border border-green-200 font-semibold'
                                        : isFromService
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {didComplete && <Check className="h-2.5 w-2.5 shrink-0" />}
                                    {a.user.name}
                                    {!isFromService && !didComplete && <span className="ml-1 opacity-60">↔</span>}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">Non planifié</span>
                          )}
                          
                          {/* Jours prévus */}
                          {schedule?.plannedDays && !isEditing && (
                            <DayBadges plannedDays={schedule.plannedDays} />
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 text-center">
                          {schedule ? (
                            <button
                              onClick={() => toggleDone(schedule)}
                              title={schedule.isDone ? 'Annuler — marquer comme non fait' : 'Confirmer le nettoyage'}
                              className="inline-flex items-center gap-1 mx-auto"
                            >
                              {schedule.isDone ? (
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                              ) : (
                                <Circle className={`h-6 w-6 transition-colors ${isConfirming ? 'text-green-400 animate-pulse' : 'text-slate-300 hover:text-green-400'}`} />
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveAssignment(vehicle.id)}
                                  disabled={saving}
                                  className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                                  title="Confirmer"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                  title="Annuler"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit({ vehicle, schedule })}
                                  className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                  title={schedule ? "Modifier l'assignation" : 'Planifier'}
                                >
                                  {schedule ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                </button>
                                {schedule && ['ADMIN', 'DIRECTEUR'].includes(user.role) && (
                                  <button
                                    onClick={() => deleteSchedule(schedule.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                                    title="Supprimer le planning"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Confirmation row: who did the cleaning ── */}
                      {isConfirming && schedule && (
                        <tr className="bg-green-50 border-green-100">
                          <td colSpan={5} className="px-6 py-4 border-t border-green-100">
                            <div className="flex items-start gap-6 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Qui a effectué le nettoyage ?
                                </p>

                                {/* Assigned professionals (pre-selected) */}
                                {schedule.assignments.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Assignés</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {schedule.assignments.map(a => {
                                        const isSelected = completedByIds.includes(a.userId);
                                        return (
                                          <button
                                            key={a.userId}
                                            onClick={() => toggleCompleted(a.userId)}
                                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                              isSelected
                                                ? 'bg-green-500 text-white border-green-500'
                                                : 'bg-white text-slate-600 border-slate-300 hover:border-green-400'
                                            }`}
                                          >
                                            {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                            {a.user.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* + Colleague from another service */}
                                {otherPros.length > 0 && (
                                  <>
                                    <button
                                      onClick={() => setShowExtraForConfirmation(v => !v)}
                                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                                        showExtraForConfirmation
                                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                                          : 'bg-white text-slate-500 border-dashed border-slate-300 hover:border-amber-400 hover:text-amber-600'
                                      }`}
                                    >
                                      <UserPlus className="h-3 w-3" />
                                      {showExtraForConfirmation ? 'Masquer' : '+ Collègue non assigné'}
                                    </button>

                                    {showExtraForConfirmation && (
                                      <div className="mt-2 border border-dashed border-amber-300 rounded-xl p-2.5 bg-amber-50/50">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                                          Remplacement — collègue d'un autre service
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {otherPros.map(p => {
                                            const svcName = p.userServices?.[0]?.service?.name ?? 'autre service';
                                            const isSelected = completedByIds.includes(p.id);
                                            return (
                                              <button
                                                key={p.id}
                                                onClick={() => toggleCompleted(p.id)}
                                                title={`Service : ${svcName}`}
                                                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                                  isSelected
                                                    ? 'bg-amber-500 text-white border-amber-500'
                                                    : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400'
                                                }`}
                                              >
                                                {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                                {p.name}
                                                <span className="opacity-50 text-[10px] ml-0.5">({svcName})</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                                {completedByIds.length === 0 && (
                                  <p className="mt-2 text-[10px] text-amber-600 font-semibold">
                                    Sélectionnez au moins 1 personne
                                  </p>
                                )}
                              </div>

                              {/* Confirm / Cancel */}
                              <div className="flex items-center gap-2 self-start pt-1 shrink-0">
                                <button
                                  onClick={() => confirmDone(schedule.id)}
                                  disabled={completedByIds.length === 0}
                                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Confirmer
                                </button>
                                <button
                                  onClick={cancelConfirmation}
                                  className="px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg border hover:bg-slate-50 transition-colors"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <BulkCleaningModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSuccess={fetchSchedule}
        professionals={professionals}
        vehicles={items.map(i => i.vehicle)}
      />
    </div>
  );
}
