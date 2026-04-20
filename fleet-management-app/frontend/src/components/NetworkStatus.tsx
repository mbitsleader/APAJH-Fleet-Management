"use client";

import { useEffect, useState } from "react";
import { ServerOff, RotateCcw, AlertTriangle, WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [isBackendDown, setIsBackendDown] = useState(false);

  useEffect(() => {
    // Écouteur d'internet (le Wifi/câble de l'utilisateur)
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Écouteur du backend (déclenché par apiFetch.ts)
    const handleBackendOutage = () => setIsBackendDown(true);
    const handleBackendRestored = () => setIsBackendDown(false);

    window.addEventListener("backend-outage", handleBackendOutage);
    window.addEventListener("backend-restored", handleBackendRestored);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("backend-outage", handleBackendOutage);
      window.removeEventListener("backend-restored", handleBackendRestored);
    };
  }, []);

  const forceRetry = () => {
    window.location.reload();
  };

  if (!isOffline && !isBackendDown) {
    return null; // Tout va bien, on n'affiche rien
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in-95 duration-300">
        
        {/* Titre et Icone en fonction du problème */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
            {isOffline ? (
              <WifiOff className="w-12 h-12 text-red-600 dark:text-red-400" />
            ) : (
              <ServerOff className="w-12 h-12 text-red-600 dark:text-red-400" />
            )}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {isOffline ? "Connexion Internet Perdue" : "Le serveur a été déconnecté"}
        </h2>
        
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          {isOffline
            ? "Veuillez vérifier votre connexion Wi-Fi ou câble réseau."
            : "Impossible de joindre le serveur. Nos petits mécaniciens sont peut-être en train de réparer le moteur !"}
        </p>

        {/* --- Petite animation mignonne pour distraire l'utilisateur --- */}
        {!isOffline && (
          <div className="relative w-full h-16 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden mb-8 border border-slate-200 dark:border-slate-700">
            {/* Ligne pointillée de route */}
            <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-slate-300 dark:border-slate-600"></div>
            
            {/* Voiture qui fait des allers-retours */}
            <div className="absolute top-1/2 -mt-4 animate-[drive_4s_ease-in-out_infinite_alternate]">
              <div className="text-3xl filter drop-shadow-md pb-4 pt-1">
                🚗💨
              </div>
            </div>
            <style jsx>{`
              @keyframes drive {
                0% { transform: translateX(10px) scaleX(1); }
                49% { transform: translateX(calc(100% + 280px)) scaleX(1); }
                50% { transform: translateX(calc(100% + 280px)) scaleX(-1); }
                100% { transform: translateX(10px) scaleX(-1); }
              }
            `}</style>
          </div>
        )}

        <button
          onClick={forceRetry}
          className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 group"
        >
          <RotateCcw className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-500" />
          {isOffline ? "J'ai retrouvé internet, actualiser" : "Réessayer la connexion"}
        </button>

        {!isOffline && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-500">
            <AlertTriangle className="w-4 h-4" />
            <span>Ne quittez pas la page sans sauvegarder !</span>
          </div>
        )}
      </div>
    </div>
  );
}
