import { useEffect, useState } from 'react';
import { X, Heart, HeartOff } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  icon?: 'heart' | 'heart-off';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type, icon, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-500/90',
    error: 'bg-red-500/90',
    info: 'bg-blue-500/90'
  }[type];

  const IconComponent = icon === 'heart' ? Heart : icon === 'heart-off' ? HeartOff : null;

  return (
    <div
      className={`fixed top-20 right-4 z-50 flex items-center space-x-3 px-4 py-3 rounded-lg backdrop-blur-xl border border-white/20 text-white shadow-lg transition-all duration-300 ${bgColor} ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      {IconComponent && (
        <IconComponent className={`w-5 h-5 ${icon === 'heart' ? 'fill-current' : ''}`} />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="text-white/80 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    icon?: 'heart' | 'heart-off';
  }>;
  onRemoveToast: (id: string) => void;
}

export function ToastContainer({ toasts, onRemoveToast }: ToastContainerProps) {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ top: `${index * 80}px` }}
          className="relative"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            icon={toast.icon}
            onClose={() => onRemoveToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
