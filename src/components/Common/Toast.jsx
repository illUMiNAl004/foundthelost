/**
 * Toast Component
 * Notification system with context provider
 * Supports success, error, warning, and info variants
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Toast Context
const ToastContext = createContext(null);

// Toast variants
const variants = {
  success: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: 'text-emerald-400',
    iconPath: 'M5 13l4 4L19 7',
  },
  error: {
    bg: 'bg-red-500/10 border-red-500/30',
    icon: 'text-red-400',
    iconPath: 'M6 18L18 6M6 6l12 12',
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: 'text-amber-400',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  info: {
    bg: 'bg-sky-500/10 border-sky-500/30',
    icon: 'text-sky-400',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

// Individual Toast Component
const Toast = ({ id, message, variant = 'info', onDismiss }) => {
  const { bg, icon, iconPath } = variants[variant];

  return (
    <div
      className={`
        flex items-start gap-3 p-4
        backdrop-blur-xl rounded-xl border shadow-lg
        animate-slide-in
        ${bg}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${icon}`}>
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={iconPath}
          />
        </svg>
      </div>

      {/* Message */}
      <p className="flex-1 text-sm text-slate-200">{message}</p>

      {/* Dismiss Button */}
      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 p-1 -m-1 text-slate-400 hover:text-slate-300 transition-colors rounded"
        aria-label="Dismiss notification"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

// Toast Container
const ToastContainer = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            id={toast.id}
            message={toast.message}
            variant={toast.variant}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>,
    document.body
  );
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Generate unique ID
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add toast
  const addToast = useCallback((message, variant = 'info', duration = 5000) => {
    const id = generateId();

    setToasts((prev) => [...prev, { id, message, variant }]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, []);

  // Dismiss toast
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Helper methods for different variants
  const toast = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
    dismiss: dismissToast,
    dismissAll: () => setToasts([]),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

// useToast hook
export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};

export default Toast;
