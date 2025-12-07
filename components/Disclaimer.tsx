import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const Disclaimer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="bg-amber-950/40 border-b border-amber-900/50 px-4 py-3 flex items-start sm:items-center justify-between shadow-sm relative z-10 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-sm text-amber-200/90">
          <span className="font-semibold text-amber-200">Important:</span> This AI assistant provides general educational information only. It does not provide medical diagnosis, advice, or treatment. Always consult a healthcare professional for medical concerns. In emergencies, call your local emergency number immediately.
        </p>
      </div>
      <button 
        onClick={onClose}
        className="text-amber-500 hover:text-amber-300 ml-4 p-1 rounded-full hover:bg-amber-900/50 transition-colors"
        aria-label="Close disclaimer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};