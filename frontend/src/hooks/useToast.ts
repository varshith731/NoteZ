import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  icon?: 'heart' | 'heart-off';
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showFavoriteAdded = useCallback((songName: string) => {
    addToast({
      message: `Added "${songName}" to favorites`,
      type: 'success',
      icon: 'heart'
    });
  }, [addToast]);

  const showFavoriteRemoved = useCallback((songName: string) => {
    addToast({
      message: `Removed "${songName}" from favorites`,
      type: 'info',
      icon: 'heart-off'
    });
  }, [addToast]);

  const showError = useCallback((message: string) => {
    addToast({
      message,
      type: 'error'
    });
  }, [addToast]);

  return {
    toasts,
    removeToast,
    showFavoriteAdded,
    showFavoriteRemoved,
    showError,
    addToast
  };
}
