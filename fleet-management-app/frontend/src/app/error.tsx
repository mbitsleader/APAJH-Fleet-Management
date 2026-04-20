'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Home, RefreshCcw, Copy, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Front-end error:', error);
  }, [error]);

  const copyToClipboard = () => {
    const errorData = `Message: ${error.message}\nDigest: ${error.digest || 'N/A'}\nStack: ${error.stack}`;
    navigator.clipboard.writeText(errorData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <div className="w-full max-w-lg space-y-8 rounded-3xl bg-white p-10 shadow-2xl">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100 mx-auto">
          <AlertTriangle className="h-12 w-12 text-red-600" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-3xl font-black text-slate-900">Oups ! Une erreur est survenue</h1>
          <p className="text-slate-500">
            L'application a rencontré un problème inattendu. Ne vous inquiétez pas, vos données sont en sécurité.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => reset()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            <RefreshCcw className="h-5 w-5" />
            Réessayer
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 py-4 font-bold text-slate-600 transition-colors hover:bg-slate-200"
          >
            <Home className="h-5 w-5" />
            Retour à l'accueil
          </button>
        </div>
        
        {/* Panneau de Debug Modifiable */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-left">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-sm font-semibold text-slate-600"
          >
            Détails techniques pour les développeurs
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDetails && (
            <div className="mt-4 bg-slate-900 rounded-xl p-4 overflow-hidden relative group">
              <button 
                onClick={copyToClipboard}
                className="absolute top-2 right-2 p-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition"
                title="Copier l'erreur"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
              </button>
              <div className="overflow-x-auto text-[11px] font-mono text-slate-300 pr-10">
                <p className="text-red-400 font-bold mb-1">{error.message}</p>
                {error.digest && <p className="text-slate-500 mb-2">Digest: {error.digest}</p>}
                <pre className="whitespace-pre-wrap opacity-70">{error.stack}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
