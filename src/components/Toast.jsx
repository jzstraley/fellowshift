// src/components/Toast.jsx
// Singleton toast system — import { toast } anywhere, render <ToastContainer /> once in App.

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// ── singleton dispatcher ──────────────────────────────────────────────────────
let _dispatch = null;

export const toast = {
  success: (msg, duration = 3000) => _dispatch?.({ type: 'success', msg, duration }),
  error:   (msg, duration = 4000) => _dispatch?.({ type: 'error',   msg, duration }),
  info:    (msg, duration = 3000) => _dispatch?.({ type: 'info',    msg, duration }),
};

// ── styles ────────────────────────────────────────────────────────────────────
const ICON = {
  success: <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />,
  error:   <AlertCircle className="w-4 h-4 text-red-400   flex-shrink-0" />,
  info:    <Info        className="w-4 h-4 text-blue-400  flex-shrink-0" />,
};

const BORDER = {
  success: 'border-green-500/40',
  error:   'border-red-500/40',
  info:    'border-blue-500/40',
};

let _nextId = 0;

// ── ToastContainer ────────────────────────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  useEffect(() => {
    _dispatch = ({ type, msg, duration }) => {
      const id = ++_nextId;
      setToasts(t => [...t, { id, type, msg }]);
      setTimeout(() => remove(id), duration);
    };
    return () => { _dispatch = null; };
  }, [remove]);

  if (!toasts.length) return null;

  return (
    // sits above bottom nav on mobile (bottom-20), hugs bottom-right on desktop
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 px-3 py-2.5 rounded-lg border shadow-xl text-sm text-white bg-gray-900 max-w-xs ${BORDER[t.type]}`}
        >
          {ICON[t.type]}
          <span className="flex-1 leading-snug">{t.msg}</span>
          <button
            onClick={() => remove(t.id)}
            className="text-gray-400 hover:text-white flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
