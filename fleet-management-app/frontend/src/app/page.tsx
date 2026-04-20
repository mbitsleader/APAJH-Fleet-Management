'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiFetch';
import { VehicleCard } from '@/components/ui/VehicleCard';
import { ReservationModal } from '@/components/ui/ReservationModal';
import { TripModal } from '@/components/ui/TripModal';
import { IncidentModal } from '@/components/ui/IncidentModal';
import { Sidebar } from '@/components/ui/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { Filter, Search as SearchIcon, X, ChevronRight, Building2 } from 'lucide-react';
import { canManageCleaningSchedule, canViewAllVehicles } from '@/lib/permissions';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plateNumber: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'BLOCKED';
  category: string | null;
  currentMileage: number;
  fuelType: string | null;
  imageUrl: string | null;
  type: 'PERMANENT' | 'REPLACEMENT';
  serviceId: string | null;
  assignedUserId: string | null;
  service?: {
    id: string;
    name: string;
    pole: {
      id: string;
      name: string;
    };
  };
}

export default function Home() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [myServiceIds, setMyServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [tripType, setTripType] = useState<'START' | 'END'>('START');
  
  // Filtres
  const [poleFilter, setPoleFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [hiddenServices, setHiddenServices] = useState<Set<string>>(new Set());

  // États de visibilité (Accordion)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const savedPole = localStorage.getItem('dashboard_pole_filter');
    if (savedPole) setPoleFilter(savedPole);

    const savedCollapsed = localStorage.getItem('dashboard_collapsed_sections');
    if (savedCollapsed) {
      try {
        setCollapsedSections(JSON.parse(savedCollapsed));
      } catch (e) {
        console.error('Error parsing collapsed sections:', e);
      }
    }

    const savedHidden = localStorage.getItem('dashboard_hidden_services');
    if (savedHidden) {
      try {
        setHiddenServices(new Set(JSON.parse(savedHidden)));
      } catch (e) {
        console.error('Error parsing hidden services:', e);
      }
    }
  }, []);

  const handlePoleFilterChange = (pole: string) => {
    setPoleFilter(pole);
    localStorage.setItem('dashboard_pole_filter', pole);
  };

  const toggleServiceVisibility = (serviceName: string) => {
    setHiddenServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceName)) {
        next.delete(serviceName);
      } else {
        next.add(serviceName);
      }
      localStorage.setItem('dashboard_hidden_services', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const showAllServices = () => {
    setHiddenServices(new Set());
    localStorage.removeItem('dashboard_hidden_services');
  };

  const hideAllServices = (serviceNames: string[]) => {
    const next = new Set(serviceNames);
    setHiddenServices(next);
    localStorage.setItem('dashboard_hidden_services', JSON.stringify(Array.from(next)));
  };

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('dashboard_collapsed_sections', JSON.stringify(next));
      return next;
    });
  };

  const fetchData = async () => {
    try {
      const [vehiclesRes, usersRes] = await Promise.all([
        apiFetch('/api/vehicles'),
        apiFetch('/api/users'),
      ]);
      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        if (Array.isArray(data)) setVehicles(data);
      }
      if (usersRes.ok && user) {
        const users = await usersRes.json();
        const me = Array.isArray(users) ? users.find((u: any) => u.id === user.id) : null;
        if (me?.userServices) {
          setMyServiceIds(me.userServices.map((s: any) => s.serviceId));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await apiFetch('/api/vehicles');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setVehicles(data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  // ADMIN/DIRECTEUR see all vehicles fully; others see only assigned service vehicles interactable
  const isPrivileged = canViewAllVehicles(user.role);

  const isVehicleAssigned = (vehicle: Vehicle): boolean => {
    if (isPrivileged) return true;
    if (vehicle.assignedUserId === user.id) return true;
    if (vehicle.serviceId && myServiceIds.includes(vehicle.serviceId)) return true;
    return false;
  };

  const handleActionClick = (vehicle: Vehicle) => {
    if (!isVehicleAssigned(vehicle)) return;
    setSelectedVehicle(vehicle);
    if (vehicle.status === 'AVAILABLE') {
      setIsModalOpen(true);
    } else if (vehicle.status === 'IN_USE') {
      setTripType('END');
      setIsTripModalOpen(true);
    }
  };

  const handleIncidentClick = (vehicle: Vehicle) => {
    if (!isVehicleAssigned(vehicle)) return;
    setSelectedVehicle(vehicle);
    setIsIncidentModalOpen(true);
  };

  // Filtrage et Groupement
  const filteredVehicles = vehicles.filter(v => {
    const poleName = v.service?.pole?.name || 'Non assigné';
    const matchPole = poleFilter === 'ALL' || poleName === poleFilter;
    
    const searchLower = search.toLowerCase();
    const matchSearch = !search || 
      v.brand.toLowerCase().includes(searchLower) ||
      v.model.toLowerCase().includes(searchLower) ||
      v.plateNumber.toLowerCase().includes(searchLower) ||
      v.service?.name.toLowerCase().includes(searchLower);
      
    return matchPole && matchSearch;
  });

  // Extraction des pôles et services uniques pour les boutons de filtre
  const availablePoles = Array.from(new Set(vehicles.map(v => v.service?.pole?.name || 'Non assigné'))).sort();
  const availableServices = Array.from(new Set(vehicles.map(v => v.service?.name || 'Général / Inconnu'))).sort();

  // Groupement par Pole puis par Service
  const groupedData: Record<string, Record<string, Vehicle[]>> = {};
  filteredVehicles.forEach(v => {
    const poleName = v.service?.pole?.name || 'Non assigné';
    const serviceName = v.service?.name || 'Général / Inconnu';
    
    if (!groupedData[poleName]) groupedData[poleName] = {};
    if (!groupedData[poleName][serviceName]) groupedData[poleName][serviceName] = [];
    groupedData[poleName][serviceName].push(v);
  });

  const POLE_COLORS: Record<string, string> = {
    'Adulte': 'from-blue-600 to-blue-700',
    'Enfance': 'from-emerald-600 to-emerald-700',
    'Non assigné': 'from-slate-500 to-slate-600',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main id="main-content" tabIndex={-1} className="p-4 lg:pl-36 lg:p-12 transition-all duration-300 outline-none">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-primary uppercase">Tableau de bord</h1>
            <p className="text-slate-500 font-medium mt-1">Bienvenue, {user.name.split(' ')[0]}. Voici l'état de votre flotte.</p>
          </div>

          <div className="flex items-center gap-3">
            {canManageCleaningSchedule(user.role) && (
              <Link href="/admin/cleaning" className="rounded-2xl bg-white border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-primary/20 active:scale-95 flex items-center gap-2">
                ✨ Planning Nettoyage
              </Link>
            )}
          </div>
        </header>

        {/* Barre de Filtres */}
        <div className="mb-10 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePoleFilterChange('ALL')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${poleFilter === 'ALL' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                Tous les pôles
              </button>
              {availablePoles.map(pole => (
                <button
                  key={pole}
                  onClick={() => handlePoleFilterChange(pole)}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${poleFilter === pole ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {pole}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-80 group">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Rechercher service, plaque..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-10 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all shadow-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Pastilles de filtre par service */}
          {availableServices.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Services :</span>
              {availableServices.map(service => {
                const isHidden = hiddenServices.has(service);
                return (
                  <button
                    key={service}
                    onClick={() => toggleServiceVisibility(service)}
                    title={isHidden ? `Afficher ${service}` : `Masquer ${service}`}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 border ${
                      isHidden
                        ? 'bg-white border-slate-200 text-slate-300 line-through'
                        : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all ${isHidden ? 'bg-slate-300' : 'bg-primary'}`} />
                    {service}
                  </button>
                );
              })}
              {hiddenServices.size > 0 && (
                <button
                  onClick={showAllServices}
                  className="ml-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Tout afficher
                </button>
              )}
              {hiddenServices.size === 0 && availableServices.length > 1 && (
                <button
                  onClick={() => hideAllServices(availableServices)}
                  className="ml-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:underline"
                >
                  Tout masquer
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
             <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
             <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synchronisation de la flotte...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="py-20 text-center glass rounded-[40px] border border-dashed border-slate-200 bg-white/50">
            <Filter className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900">Aucun résultat</h3>
            <p className="text-slate-500 mt-2">Modifiez vos filtres ou votre recherche pour trouver un véhicule.</p>
            <button onClick={() => { setPoleFilter('ALL'); setSearch(''); }} className="mt-6 text-sm font-bold text-primary hover:underline">Réinitialiser les filtres</button>
          </div>
        ) : (
          <div className="space-y-16">
            {Object.entries(groupedData).sort(([a], [b]) => a === 'Adulte' ? -1 : b === 'Adulte' ? 1 : a.localeCompare(b)).map(([poleName, servicesMap]) => {
              const isPoleCollapsed = collapsedSections[`pole_${poleName}`];
              return (
                <div key={poleName} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <button 
                    onClick={() => toggleSection(`pole_${poleName}`)}
                    className="flex items-center justify-between w-full group mb-8"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-1.5 rounded-full bg-gradient-to-b ${POLE_COLORS[poleName] || 'from-primary to-primary/80'}`} />
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                        Pôle {poleName}
                        <span className="text-sm font-bold text-slate-400 normal-case tracking-normal bg-slate-100 px-3 py-1 rounded-full">
                          {Object.values(servicesMap).flat().length}
                        </span>
                      </h2>
                    </div>
                    <div className={`p-2 rounded-xl transition-all ${isPoleCollapsed ? 'bg-slate-100 text-slate-400' : 'text-slate-300 group-hover:bg-slate-50'}`}>
                      <ChevronRight className={`h-6 w-6 transition-transform duration-300 ${isPoleCollapsed ? '' : 'rotate-90'}`} />
                    </div>
                  </button>

                  {!isPoleCollapsed && (
                    <div className="space-y-12">
                      {Object.entries(servicesMap).sort(([nameA, vehiclesA], [nameB, vehiclesB]) => {
                        const aHidden = hiddenServices.has(nameA);
                        const bHidden = hiddenServices.has(nameB);
                        const aAllGrey = vehiclesA.every(v => !isVehicleAssigned(v));
                        const bAllGrey = vehiclesB.every(v => !isVehicleAssigned(v));
                        // Masqués tout en bas
                        if (aHidden !== bHidden) return aHidden ? 1 : -1;
                        // Ensuite services tous grisés
                        if (!aHidden && !bHidden && aAllGrey !== bAllGrey) return aAllGrey ? 1 : -1;
                        return nameA.localeCompare(nameB);
                      }).map(([serviceName, serviceVehicles]) => {
                        const sectionId = `service_${poleName}_${serviceName}`;
                        const isServiceCollapsed = collapsedSections[sectionId];
                        const isServiceHidden = hiddenServices.has(serviceName);
                        const allGreyed = serviceVehicles.every(v => !isVehicleAssigned(v));
                        return (
                          <div key={serviceName} className={`pl-6 border-l-2 ml-0.5 transition-all duration-200 ${isServiceHidden ? 'border-slate-50 opacity-30' : allGreyed ? 'border-slate-100 opacity-50' : 'border-slate-100'}`}>
                            <button
                              onClick={() => toggleSection(sectionId)}
                              className="flex items-center justify-between w-full mb-6 group/s"
                              disabled={isServiceHidden}
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-slate-400 group-hover/s:text-primary transition-colors" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                  Service {serviceName}
                                  <span className="text-[10px] font-bold text-slate-300 normal-case tracking-normal">
                                    ({serviceVehicles.length})
                                  </span>
                                </h3>
                                {isServiceHidden && (
                                  <span className="text-[10px] font-bold text-slate-300 normal-case bg-slate-100 px-2 py-0.5 rounded-full">masqué</span>
                                )}
                              </div>
                              {!isServiceHidden && (
                                <div className={`text-slate-300 transition-transform duration-200 ${isServiceCollapsed ? '' : 'rotate-90'}`}>
                                  <ChevronRight className="h-4 w-4" />
                                </div>
                              )}
                            </button>

                            {!isServiceCollapsed && !isServiceHidden && (
                              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in duration-500">
                                {serviceVehicles.map(vehicle => {
                                  const assigned = isVehicleAssigned(vehicle);
                                  return (
                                    <div key={vehicle.id} className={assigned ? undefined : 'opacity-40 grayscale-[0.5] pointer-events-none select-none transition-all'}>
                                      <VehicleCard
                                        vehicle={vehicle}
                                        onBook={() => handleActionClick(vehicle)}
                                        onReport={() => handleIncidentClick(vehicle)}
                                        onFuelSuccess={fetchVehicles}
                                        userId={user.id}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <ReservationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          vehicle={selectedVehicle}
          onSuccess={fetchVehicles}
        />

        {selectedVehicle && (
          <TripModal
            isOpen={isTripModalOpen}
            onClose={() => setIsTripModalOpen(false)}
            vehicle={selectedVehicle}
            userId={user.id}
            type={tripType}
            onSuccess={fetchVehicles}
          />
        )}
        {selectedVehicle && (
          <IncidentModal
            isOpen={isIncidentModalOpen}
            onClose={() => setIsIncidentModalOpen(false)}
            vehicle={selectedVehicle}
            userId={user.id}
            onSuccess={fetchVehicles}
          />
        )}
      </main>
    </div>
  );
}

