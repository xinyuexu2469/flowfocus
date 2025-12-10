import { create } from 'zustand';
import { getApiClient } from '@/lib/clerk-api';

interface GoogleCalendarStore {
  // 状态
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  loading: boolean;

  // 操作
  checkConnectionStatus: () => Promise<void>;
  connect: () => Promise<string>; // 返回授权 URL
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  getSyncStatus: () => Promise<void>;
}

export const useGoogleCalendarStore = create<GoogleCalendarStore>((set, get) => ({
  // 初始状态
  isConnected: false,
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  loading: false,

  // 检查连接状态
  checkConnectionStatus: async () => {
    try {
      const api = getApiClient();
      const response = await api.googleCalendar.getStatus() as { connected: boolean };
      set({ isConnected: response.connected });
      
      if (response.connected) {
        // 获取最后同步时间
        await get().getSyncStatus();
      }
    } catch (error: any) {
      console.error('Failed to check connection status:', error);
      set({ isConnected: false });
    }
  },

  // 连接 Google Calendar
  connect: async () => {
    try {
      const api = getApiClient();
      const response = await api.googleCalendar.getAuthUrl() as { url: string };
      return response.url;
    } catch (error: any) {
      set({ syncError: error.message });
      throw error;
    }
  },

  // 断开连接
  disconnect: async () => {
    try {
      const api = getApiClient();
      await api.googleCalendar.disconnect();
      
      set({ 
        isConnected: false,
        lastSyncTime: null,
        syncError: null
      });

      // 刷新 calendarStore 以移除 Google 事件
      const { useCalendarStore } = await import('./calendarStore');
      await useCalendarStore.getState().fetchEvents(
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0)
      );
    } catch (error: any) {
      set({ syncError: error.message });
      throw error;
    }
  },

  // 立即同步
  syncNow: async () => {
    set({ isSyncing: true, syncError: null });
    
    try {
      const api = getApiClient();
      const response = await api.googleCalendar.sync() as { 
        success: boolean; 
        synced: number; 
        message: string 
      };
      
      set({ 
        isSyncing: false,
        lastSyncTime: new Date(),
        syncError: null
      });

      // 刷新 calendarStore 以显示新同步的事件
      const { useCalendarStore } = await import('./calendarStore');
      await useCalendarStore.getState().fetchEvents(
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0)
      );

      return response;
    } catch (error: any) {
      set({ 
        isSyncing: false,
        syncError: error.message 
      });
      throw error;
    }
  },

  // 获取同步状态
  getSyncStatus: async () => {
    try {
      const api = getApiClient();
      const response = await api.googleCalendar.getSyncStatus() as { lastSync: string | null };
      
      if (response.lastSync) {
        set({ lastSyncTime: new Date(response.lastSync) });
      }
    } catch (error: any) {
      console.error('Failed to get sync status:', error);
    }
  },
}));

