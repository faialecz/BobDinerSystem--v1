'use client';

import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type ModalType = 'success' | 'warning' | 'info';
type ModalMode = 'alert' | 'confirm';

interface ModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  onConfirm?:  () => void;
  title:       string;
  message:     string;
  type?:       ModalType;
  mode?:       ModalMode;
  confirmLabel?: string;
  cancelLabel?:  string;
}

// ── Config maps ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ModalType, {
  banner:      string;
  iconBg:      string;
  icon:        React.ReactNode;
  confirmBtn:  string;
}> = {
  success: {
    banner:     'bg-emerald-600',
    iconBg:     'bg-emerald-600',
    icon:       <CheckCircle2 size={32} strokeWidth={2.5} className="text-white" />,
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700',
  },
  warning: {
    banner:     'bg-amber-500',
    iconBg:     'bg-amber-500',
    icon:       <AlertTriangle size={32} strokeWidth={2.5} className="text-white" />,
    confirmBtn: 'bg-amber-500 hover:bg-amber-600',
  },
  info: {
    banner:     'bg-blue-600',
    iconBg:     'bg-blue-600',
    icon:       <Info size={32} strokeWidth={2.5} className="text-white" />,
    confirmBtn: 'bg-blue-600 hover:bg-blue-700',
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  mode = 'confirm',
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
}: ModalProps) {
  const { banner, iconBg, icon, confirmBtn } = TYPE_CONFIG[type];

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Colored banner (top 25%) ── */}
        <div className={`${banner} h-24 w-full`} />

        {/* ── Close button ── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* ── Overlapping circular icon ── */}
        <div className="flex justify-center">
          <div className={`${iconBg} -mt-8 w-16 h-16 rounded-full flex items-center justify-center ring-4 ring-white shadow-md`}>
            {icon}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-8 pt-4 pb-7 flex flex-col items-center gap-2 text-center">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>

          {/* ── Buttons ── */}
          <div className={`mt-5 w-full flex gap-3 ${mode === 'alert' ? 'justify-center' : ''}`}>
            {mode === 'confirm' && (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                {cancelLabel}
              </button>
            )}
            <button
              onClick={() => { onConfirm?.(); onClose(); }}
              className={`${mode === 'alert' ? 'px-10' : 'flex-1'} py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${confirmBtn}`}
            >
              {mode === 'alert' ? 'OK' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
