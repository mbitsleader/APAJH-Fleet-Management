'use client';

import React, { useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, onCancel, modalRef);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="glass w-full max-w-sm rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                danger ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
              )}>
                <AlertTriangle aria-hidden="true" className="h-5 w-5" />
              </div>
              <h2 id="confirm-modal-title" className="text-base font-black text-foreground">{title}</h2>
            </div>
            <button
              onClick={onCancel}
              aria-label="Fermer"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground font-medium mb-6 pl-[52px]">
            {description}
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 h-11 rounded-xl border bg-card text-sm font-bold text-muted-foreground hover:bg-muted transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={cn(
                "flex-1 h-11 rounded-xl text-sm font-black transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                danger
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 focus-visible:ring-red-500"
                  : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 focus-visible:ring-primary"
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
