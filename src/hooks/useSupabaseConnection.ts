import { useCallback, useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';

export type SupabaseConnectionState = 'checking' | 'connected' | 'disconnected';

export function useSupabaseConnection() {
  const [connectionState, setConnectionState] = useState<SupabaseConnectionState>('checking');

  const refreshConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setConnectionState('disconnected');
      return;
    }

    setConnectionState('checking');
    try {
      const status = await supabaseService.testConnection();
      setConnectionState(status.connected ? 'connected' : 'disconnected');
    } catch {
      setConnectionState('disconnected');
    }
  }, []);

  useEffect(() => {
    const markOffline = () => setConnectionState('disconnected');
    const markOnline = () => void refreshConnection();

    void refreshConnection();
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, [refreshConnection]);

  return { connectionState, refreshConnection };
}
