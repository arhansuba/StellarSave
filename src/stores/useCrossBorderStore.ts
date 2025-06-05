import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  YieldPool,
  YieldPosition,
  RemittanceCorridor,
  YieldStats,
  UserYieldSummary,
  CrossBorderNotification
} from '../types/crossBorder';

interface CrossBorderState {
  // Data
  yieldPools: YieldPool[];
  userPositions: YieldPosition[];
  corridors: RemittanceCorridor[];
  yieldStats: YieldStats | null;
  userSummary: UserYieldSummary | null;
  notifications: CrossBorderNotification[];
  
  // UI State
  selectedPoolId: string | null;
  isDepositModalOpen: boolean;
  isSendModalOpen: boolean;
  
  // Actions
  setYieldPools: (pools: YieldPool[]) => void;
  setUserPositions: (positions: YieldPosition[]) => void;
  setCorridors: (corridors: RemittanceCorridor[]) => void;
  setYieldStats: (stats: YieldStats) => void;
  setUserSummary: (summary: UserYieldSummary) => void;
  addNotification: (notification: CrossBorderNotification) => void;
  markNotificationRead: (id: string) => void;
  setSelectedPoolId: (poolId: string | null) => void;
  openDepositModal: () => void;
  closeDepositModal: () => void;
  openSendModal: () => void;
  closeSendModal: () => void;
}

export const useCrossBorderStore = create<CrossBorderState>()(
  devtools(
    (set) => ({
      // Initial state
      yieldPools: [],
      userPositions: [],
      corridors: [],
      yieldStats: null,
      userSummary: null,
      notifications: [],
      selectedPoolId: null,
      isDepositModalOpen: false,
      isSendModalOpen: false,
      
      // Actions
      setYieldPools: (pools) => set({ yieldPools: pools }),
      setUserPositions: (positions) => set({ userPositions: positions }),
      setCorridors: (corridors) => set({ corridors }),
      setYieldStats: (stats) => set({ yieldStats: stats }),
      setUserSummary: (summary) => set({ userSummary: summary }),
      
      addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications]
      })),
      
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        )
      })),
      
      setSelectedPoolId: (poolId) => set({ selectedPoolId: poolId }),
      openDepositModal: () => set({ isDepositModalOpen: true }),
      closeDepositModal: () => set({ isDepositModalOpen: false }),
      openSendModal: () => set({ isSendModalOpen: true }),
      closeSendModal: () => set({ isSendModalOpen: false }),
    }),
    { name: 'cross-border-store' }
  )
);
