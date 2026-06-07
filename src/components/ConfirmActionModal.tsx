'use client';

import { useState } from 'react';
import { X, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ConfirmActionModalProps {
  title: string;
  description?: string;
  warningText?: string;
  warningPoints?: string[];
  confirmWord?: string; // defaults to "CONFIRM"
  actionButtonLabel: string; // e.g. "Delete Product", "Reject Vendor"
  actionButtonLabelAnyway?: string; // e.g. "Delete Anyway", "Reject Anyway"
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

const THEMES = {
  danger: {
    bgLight: 'bg-red-50',
    borderLight: 'border-red-100',
    bgBorder: 'border-red-200',
    textDark: 'text-red-900',
    textMedium: 'text-red-700',
    textLight: 'text-red-600',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    btnBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-100',
    inputFocus: 'focus:border-red-400 focus:ring-red-100',
    Icon: AlertTriangle,
  },
  warning: {
    bgLight: 'bg-amber-50',
    borderLight: 'border-amber-100',
    bgBorder: 'border-amber-200',
    textDark: 'text-amber-900',
    textMedium: 'text-amber-700',
    textLight: 'text-amber-600',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-100',
    inputFocus: 'focus:border-amber-400 focus:ring-amber-100',
    Icon: AlertCircle,
  },
  success: {
    bgLight: 'bg-emerald-50',
    borderLight: 'border-emerald-100',
    bgBorder: 'border-emerald-200',
    textDark: 'text-emerald-900',
    textMedium: 'text-emerald-700',
    textLight: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    btnBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-100',
    inputFocus: 'focus:border-emerald-400 focus:ring-emerald-100',
    Icon: CheckCircle,
  },
  info: {
    bgLight: 'bg-blue-50',
    borderLight: 'border-blue-100',
    bgBorder: 'border-blue-200',
    textDark: 'text-blue-900',
    textMedium: 'text-blue-700',
    textLight: 'text-blue-600',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    btnBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-100',
    inputFocus: 'focus:border-blue-400 focus:ring-blue-100',
    Icon: Info,
  },
};

export default function ConfirmActionModal({
  title,
  description,
  warningText = '⚠️ This action is permanent and cannot be undone.',
  warningPoints = [],
  confirmWord = 'CONFIRM',
  actionButtonLabel,
  actionButtonLabelAnyway,
  onConfirm,
  onCancel,
  isLoading = false,
  variant = 'danger',
}: ConfirmActionModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const t = THEMES[variant] || THEMES.danger;
  const Icon = t.Icon;

  const isConfirmed = confirmInput.trim().toUpperCase() === confirmWord.toUpperCase();

  const handleAnywayAction = () => {
    onConfirm();
  };

  const handleWordConfirmAction = () => {
    if (isConfirmed) onConfirm();
  };

  const anywayLabel = actionButtonLabelAnyway || `${actionButtonLabel} Anyway`;

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div className="bg-white rounded-t-[2rem] sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in duration-300 pb-safe">
        {/* Mobile Drag Indicator Pill */}
        <div className="w-full flex justify-center pt-3 pb-1 bg-gray-50/80 sm:hidden flex-shrink-0 rounded-t-[2rem]">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className={`px-6 py-4 border-b ${t.borderLight} ${t.bgLight} flex items-center gap-3`}>
          <div className={`w-10 h-10 rounded-full ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${t.iconColor}`} />
          </div>
          <div>
            <h2 className={`text-base font-extrabold ${t.textDark}`}>{title}</h2>
            {description && <p className={`text-xs ${t.textLight} mt-0.5`}>{description}</p>}
          </div>
          <button onClick={onCancel} className={`ml-auto p-1 text-gray-400 hover:text-gray-600 active:scale-90 transition-all cursor-pointer`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className={`${t.bgLight} border ${t.bgBorder} rounded-xl p-4`}>
            <p className={`text-sm font-bold ${t.textMedium} mb-1`}>{warningText}</p>
            {warningPoints.length > 0 && (
              <ul className={`text-xs ${t.textMedium} space-y-1 list-disc list-inside`}>
                {warningPoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-sm text-gray-600">
            To confirm, type <span className="font-extrabold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{confirmWord}</span> below, or click the confirmation button.
          </p>

          <input
            type="text"
            value={confirmInput}
            onChange={e => setConfirmInput(e.target.value)}
            placeholder={`Type ${confirmWord} to proceed...`}
            className={`w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-mono outline-none transition-all ${t.inputFocus}`}
            onKeyDown={e => { if (e.key === 'Enter') handleWordConfirmAction(); }}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all active:scale-95 duration-100 text-sm cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          {isConfirmed ? (
            <button
              onClick={handleWordConfirmAction}
              disabled={isLoading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all active:scale-95 duration-100 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading ? 'Processing...' : actionButtonLabel}
            </button>
          ) : (
            <button
              onClick={handleAnywayAction}
              disabled={isLoading}
              className={`flex-1 py-2.5 ${t.btnBg} text-white font-bold rounded-xl transition-all active:scale-95 duration-100 text-sm cursor-pointer disabled:opacity-50`}
            >
              {isLoading ? 'Processing...' : anywayLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
