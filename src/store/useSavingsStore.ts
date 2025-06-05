// src/store/useSavingsStore.ts
// StellarSave Zustand Store for State Management

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { 
  SavingsChallenge, 
  SavingsStats, 
  CreateChallengeRequest,
  ChallengeProgress,
  SavingsContribution,
  SavingsError,
  SavingsNotification,
  ParticipantProgress,
  ChallengeFilter,
  ChallengeStatusInfo
} from '../types/savings';
import { SavingsService } from '../services/SavingsService';

interface SavingsState {
  // ===== CORE STATE =====
  challenges: SavingsChallenge[];
  stats: SavingsStats | null;
  selectedChallenge: SavingsChallenge | null;
  challengeProgress: Record<string, ChallengeProgress>;
  participantProgress: Record<string, ParticipantProgress[]>;
  contributions: SavingsContribution[];
  notifications: SavingsNotification[];
  saveCoinBalance: number;

  // ===== UI STATE =====
  isLoading: boolean;
  isCreatingChallenge: boolean;
  isContributing: boolean;
  error: SavingsError | null;
  filter: ChallengeFilter;
  selectedTab: 'active' | 'completed' | 'all';
  
  // ===== MODAL STATES =====
  showCreateChallengeModal: boolean;
  showContributionModal: boolean;
  contributionModalChallengeId: string | null;
  
  // ===== CACHE AND TIMESTAMPS =====
  lastRefresh: Date | null;
  challengesLastFetch: Record<string, Date>;
  
  // ===== SYNC ACTIONS =====
  setChallenges: (challenges: SavingsChallenge[]) => void;
  addChallenge: (challenge: SavingsChallenge) => void;
  updateChallenge: (challengeId: string, updates: Partial<SavingsChallenge>) => void;
  removeChallenge: (challengeId: string) => void;
  
  setStats: (stats: SavingsStats) => void;
  updateStats: (updates: Partial<SavingsStats>) => void;
  
  setSelectedChallenge: (challenge: SavingsChallenge | null) => void;
  
  setChallengeProgress: (challengeId: string, progress: ChallengeProgress) => void;
  setParticipantProgress: (challengeId: string, progress: ParticipantProgress[]) => void;
  
  setContributions: (contributions: SavingsContribution[]) => void;
  addContribution: (contribution: SavingsContribution) => void;
  
  setNotifications: (notifications: SavingsNotification[]) => void;
  addNotification: (notification: SavingsNotification) => void;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  
  setSaveCoinBalance: (balance: number) => void;
  
  // ===== UI ACTIONS =====
  setLoading: (loading: boolean) => void;
  setCreatingChallenge: (creating: boolean) => void;
  setContributing: (contributing: boolean) => void;
  setError: (error: SavingsError | null) => void;
  clearError: () => void;
  
  setFilter: (filter: Partial<ChallengeFilter>) => void;
  setSelectedTab: (tab: 'active' | 'completed' | 'all') => void;
  
  // ===== MODAL ACTIONS =====
  openCreateChallengeModal: () => void;
  closeCreateChallengeModal: () => void;
  openContributionModal: (challengeId: string) => void;
  closeContributionModal: () => void;
  
  // ===== ASYNC ACTIONS =====
  loadUserChallenges: (userAddress: string, savingsService: SavingsService) => Promise<void>;
  loadUserStats: (userAddress: string, savingsService: SavingsService) => Promise<void>;
  loadChallengeProgress: (challengeId: string, savingsService: SavingsService) => Promise<void>;
  loadParticipantProgress: (challengeId: string, savingsService: SavingsService) => Promise<void>;
  loadSaveCoinBalance: (userAddress: string, savingsService: SavingsService) => Promise<void>;
  
  createChallenge: (request: CreateChallengeRequest, userAddress: string, savingsService: SavingsService) => Promise<string>;
  contributeToChallenge: (challengeId: string, amount: number, userAddress: string, savingsService: SavingsService) => Promise<void>;
  
  refreshAllData: (userAddress: string, savingsService: SavingsService) => Promise<void>;
  refreshChallenge: (challengeId: string, savingsService: SavingsService) => Promise<void>;
  
  // ===== COMPUTED/DERIVED STATE =====
  getFilteredChallenges: () => SavingsChallenge[];
  getActiveChallenges: () => SavingsChallenge[];
  getCompletedChallenges: () => SavingsChallenge[];
  getUnreadNotifications: () => SavingsNotification[];
  getChallengeById: (challengeId: string) => SavingsChallenge | undefined;
  getChallengeStatus: (challengeId: string) => ChallengeStatusInfo | null;
  
  // ===== UTILITY ACTIONS =====
  reset: () => void;
  cleanup: () => void;
}

const initialState = {
  // Core state
  challenges: [],
  stats: null,
  selectedChallenge: null,
  challengeProgress: {},
  participantProgress: {},
  contributions: [],
  notifications: [],
  saveCoinBalance: 0,
  
  // UI state
  isLoading: false,
  isCreatingChallenge: false,
  isContributing: false,
  error: null,
  filter: {
    status: 'all' as const,
    sortBy: 'created' as const,
    sortOrder: 'desc' as const,
  },
  selectedTab: 'active' as const,
  
  // Modal states
  showCreateChallengeModal: false,
  showContributionModal: false,
  contributionModalChallengeId: null,
  
  // Cache
  lastRefresh: null,
  challengesLastFetch: {},
};

export const useSavingsStore = create<SavingsState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        // ===== SYNC ACTIONS =====
        setChallenges: (challenges) => 
          set((state) => {
            state.challenges = challenges;
            state.lastRefresh = new Date();
          }),

        addChallenge: (challenge) => 
          set((state) => {
            const existingIndex = state.challenges.findIndex(c => c.id === challenge.id);
            if (existingIndex >= 0) {
              state.challenges[existingIndex] = challenge;
            } else {
              state.challenges.unshift(challenge);
            }
            state.lastRefresh = new Date();
          }),

        updateChallenge: (challengeId, updates) => 
          set((state) => {
            const challenge = state.challenges.find(c => c.id === challengeId);
            if (challenge) {
              Object.assign(challenge, updates);
            }
            
            // Update selected challenge if it's the one being updated
            if (state.selectedChallenge?.id === challengeId) {
              Object.assign(state.selectedChallenge, updates);
            }
          }),

        removeChallenge: (challengeId) => 
          set((state) => {
            state.challenges = state.challenges.filter(c => c.id !== challengeId);
            if (state.selectedChallenge?.id === challengeId) {
              state.selectedChallenge = null;
            }
            delete state.challengeProgress[challengeId];
            delete state.participantProgress[challengeId];
          }),

        setStats: (stats) => 
          set((state) => {
            state.stats = stats;
          }),

        updateStats: (updates) => 
          set((state) => {
            if (state.stats) {
              Object.assign(state.stats, updates);
            }
          }),

        setSelectedChallenge: (challenge) => 
          set((state) => {
            state.selectedChallenge = challenge;
          }),

        setChallengeProgress: (challengeId, progress) => 
          set((state) => {
            state.challengeProgress[challengeId] = progress;
          }),

        setParticipantProgress: (challengeId, progress) => 
          set((state) => {
            state.participantProgress[challengeId] = progress;
          }),

        setContributions: (contributions) => 
          set((state) => {
            state.contributions = contributions;
          }),

        addContribution: (contribution) => 
          set((state) => {
            state.contributions.unshift(contribution);
            
            // Update challenge current amount
            const challenge = state.challenges.find(c => c.id === contribution.challengeId);
            if (challenge) {
              challenge.currentAmount += contribution.amount;
            }
            
            // Update selected challenge if it matches
            if (state.selectedChallenge?.id === contribution.challengeId) {
              state.selectedChallenge.currentAmount += contribution.amount;
            }
          }),

        setNotifications: (notifications) => 
          set((state) => {
            state.notifications = notifications;
          }),

        addNotification: (notification) => 
          set((state) => {
            state.notifications.unshift(notification);
          }),

        markNotificationRead: (notificationId) => 
          set((state) => {
            const notification = state.notifications.find(n => n.id === notificationId);
            if (notification) {
              notification.read = true;
            }
          }),

        clearNotifications: () => 
          set((state) => {
            state.notifications = [];
          }),

        setSaveCoinBalance: (balance) => 
          set((state) => {
            state.saveCoinBalance = balance;
          }),

        // ===== UI ACTIONS =====
        setLoading: (loading) => 
          set((state) => {
            state.isLoading = loading;
          }),

        setCreatingChallenge: (creating) => 
          set((state) => {
            state.isCreatingChallenge = creating;
          }),

        setContributing: (contributing) => 
          set((state) => {
            state.isContributing = contributing;
          }),

        setError: (error) => 
          set((state) => {
            state.error = error;
          }),

        clearError: () => 
          set((state) => {
            state.error = null;
          }),

        setFilter: (filter) => 
          set((state) => {
            Object.assign(state.filter, filter);
          }),

        setSelectedTab: (tab) => 
          set((state) => {
            state.selectedTab = tab;
            // Update filter when tab changes
            state.filter.status = tab === 'all' ? 'all' : tab === 'active' ? 'active' : 'completed';
          }),

        // ===== MODAL ACTIONS =====
        openCreateChallengeModal: () => 
          set((state) => {
            state.showCreateChallengeModal = true;
          }),

        closeCreateChallengeModal: () => 
          set((state) => {
            state.showCreateChallengeModal = false;
          }),

        openContributionModal: (challengeId) => 
          set((state) => {
            state.showContributionModal = true;
            state.contributionModalChallengeId = challengeId;
          }),

        closeContributionModal: () => 
          set((state) => {
            state.showContributionModal = false;
            state.contributionModalChallengeId = null;
          }),

        // ===== ASYNC ACTIONS =====
        loadUserChallenges: async (userAddress, savingsService) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const challenges = await savingsService.getUserChallenges(userAddress);
            set((state) => {
              state.challenges = challenges;
              state.challengesLastFetch[userAddress] = new Date();
              state.isLoading = false;
            });

            // Load progress for active challenges
            const activeChallenges = challenges.filter(c => c.isActive);
            for (const challenge of activeChallenges) {
              try {
                const progress = await savingsService.getChallengeProgress(challenge.id);
                set((state) => {
                  state.challengeProgress[challenge.id] = progress;
                });
              } catch (error) {
                console.warn(`Failed to load progress for challenge ${challenge.id}:`, error);
              }
            }
          } catch (error) {
            set((state) => {
              state.error = error as SavingsError;
              state.isLoading = false;
            });
          }
        },

        loadUserStats: async (userAddress, savingsService) => {
          try {
            const stats = await savingsService.getUserStats(userAddress);
            set((state) => {
              state.stats = stats;
            });
          } catch (error) {
            console.warn('Failed to load user stats:', error);
            set((state) => {
              state.error = error as SavingsError;
            });
          }
        },

        loadChallengeProgress: async (challengeId, savingsService) => {
          try {
            const progress = await savingsService.getChallengeProgress(challengeId);
            set((state) => {
              state.challengeProgress[challengeId] = progress;
            });
          } catch (error) {
            console.warn(`Failed to load progress for challenge ${challengeId}:`, error);
          }
        },

        loadParticipantProgress: async (challengeId, savingsService) => {
          try {
            const progress = await savingsService.getParticipantProgress(challengeId);
            set((state) => {
              state.participantProgress[challengeId] = progress;
            });
          } catch (error) {
            console.warn(`Failed to load participant progress for challenge ${challengeId}:`, error);
          }
        },

        loadSaveCoinBalance: async (userAddress, savingsService) => {
          try {
            const balance = await savingsService.getSaveCoinBalance(userAddress);
            set((state) => {
              state.saveCoinBalance = balance;
            });
          } catch (error) {
            console.warn('Failed to load SaveCoin balance:', error);
          }
        },

        createChallenge: async (request, userAddress, savingsService) => {
          set((state) => {
            state.isCreatingChallenge = true;
            state.error = null;
          });

          try {
            const result = await savingsService.createChallenge(request, userAddress);
            
            // Add notification
            const notification: SavingsNotification = {
              id: `notif_${Date.now()}`,
              type: 'milestone',
              challengeId: result.challengeId,
              message: `Challenge "${request.name}" created successfully!`,
              timestamp: new Date(),
              read: false,
              priority: 'medium',
            };

            set((state) => {
              state.isCreatingChallenge = false;
              state.showCreateChallengeModal = false;
              state.notifications.unshift(notification);
            });

            // Refresh data
            await get().refreshAllData(userAddress, savingsService);
            
            return result.challengeId;
          } catch (error) {
            set((state) => {
              state.error = error as SavingsError;
              state.isCreatingChallenge = false;
            });
            throw error;
          }
        },

        contributeToChallenge: async (challengeId, amount, userAddress, savingsService) => {
          set((state) => {
            state.isContributing = true;
            state.error = null;
          });

          try {
            await savingsService.contributeToChallenge(challengeId, amount, userAddress);
            
            // Create optimistic contribution
            const contribution: SavingsContribution = {
              challengeId,
              contributor: userAddress,
              amount,
              timestamp: new Date(),
              transactionHash: `pending_${Date.now()}`,
              weekNumber: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
            };

            // Add notification
            const notification: SavingsNotification = {
              id: `notif_${Date.now()}`,
              type: 'contribution',
              challengeId,
              message: `Successfully contributed ${amount} XLM!`,
              timestamp: new Date(),
              read: false,
              priority: 'low',
            };

            set((state) => {
              state.isContributing = false;
              state.showContributionModal = false;
              state.contributionModalChallengeId = null;
              state.notifications.unshift(notification);
            });

            // Add optimistic update
            get().addContribution(contribution);
            
            // Refresh data
            await get().refreshChallenge(challengeId, savingsService);
            await get().loadUserStats(userAddress, savingsService);
            await get().loadSaveCoinBalance(userAddress, savingsService);
          } catch (error) {
            set((state) => {
              state.error = error as SavingsError;
              state.isContributing = false;
            });
            throw error;
          }
        },

        refreshAllData: async (userAddress, savingsService) => {
          try {
            await Promise.all([
              get().loadUserChallenges(userAddress, savingsService),
              get().loadUserStats(userAddress, savingsService),
              get().loadSaveCoinBalance(userAddress, savingsService),
            ]);
            
            set((state) => {
              state.lastRefresh = new Date();
            });
          } catch (error) {
            console.error('Failed to refresh all data:', error);
          }
        },

        refreshChallenge: async (challengeId, savingsService) => {
          try {
            await Promise.all([
              get().loadChallengeProgress(challengeId, savingsService),
              get().loadParticipantProgress(challengeId, savingsService),
            ]);
          } catch (error) {
            console.error(`Failed to refresh challenge ${challengeId}:`, error);
          }
        },

        // ===== COMPUTED/DERIVED STATE =====
        getFilteredChallenges: () => {
          const { challenges, filter } = get();
          
          let filtered = challenges;
          
          // Filter by status
          if (filter.status && filter.status !== 'all') {
            filtered = filtered.filter(challenge => {
              switch (filter.status) {
                case 'active':
                  return challenge.isActive && !challenge.isCompleted;
                case 'completed':
                  return challenge.isCompleted;
                default:
                  return true;
              }
            });
          }
          
          // Filter by participant
          if (filter.participantAddress) {
            filtered = filtered.filter(c => c.participants.includes(filter.participantAddress!));
          }
          
          // Filter by creator
          if (filter.createdBy) {
            filtered = filtered.filter(c => c.creator === filter.createdBy);
          }
          
          // Filter by goal amount range
          if (filter.minGoalAmount !== undefined) {
            filtered = filtered.filter(c => c.goalAmount >= filter.minGoalAmount!);
          }
          if (filter.maxGoalAmount !== undefined) {
            filtered = filtered.filter(c => c.goalAmount <= filter.maxGoalAmount!);
          }
          
          // Sort
          if (filter.sortBy) {
            filtered.sort((a, b) => {
              let aValue: number | string, bValue: number | string;
              
              switch (filter.sortBy) {
                case 'created':
                  aValue = a.createdAt.getTime();
                  bValue = b.createdAt.getTime();
                  break;
                case 'deadline':
                  aValue = a.deadline.getTime();
                  bValue = b.deadline.getTime();
                  break;
                case 'progress':
                  aValue = (a.currentAmount / a.goalAmount) * 100;
                  bValue = (b.currentAmount / b.goalAmount) * 100;
                  break;
                case 'participants':
                  aValue = a.participants.length;
                  bValue = b.participants.length;
                  break;
                default:
                  return 0;
              }
              
              const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
              return filter.sortOrder === 'desc' ? -result : result;
            });
          }
          
          return filtered;
        },

        getActiveChallenges: () => {
          return get().challenges.filter(c => c.isActive && !c.isCompleted);
        },

        getCompletedChallenges: () => {
          return get().challenges.filter(c => c.isCompleted);
        },

        getUnreadNotifications: () => {
          return get().notifications.filter(n => !n.read);
        },

        getChallengeById: (challengeId) => {
          return get().challenges.find(c => c.id === challengeId);
        },

        getChallengeStatus: (challengeId) => {
          const challenge = get().getChallengeById(challengeId);
          if (!challenge) return null;
          
          // Import the service method or implement inline
          const now = new Date();
          const isExpired = now > challenge.deadline;
          const isCompleted = challenge.currentAmount >= challenge.goalAmount;
          
          let status: 'active' | 'completed' | 'expired' | 'cancelled';
          let statusMessage: string;
          
          if (isCompleted) {
            status = 'completed';
            statusMessage = 'Goal achieved! 🎉';
          } else if (isExpired) {
            status = 'expired';
            statusMessage = 'Challenge expired';
          } else if (challenge.isActive) {
            status = 'active';
            statusMessage = 'Active and accepting contributions';
          } else {
            status = 'cancelled';
            statusMessage = 'Challenge cancelled';
          }

          return {
            status,
            canContribute: status === 'active',
            canWithdraw: status === 'completed' || status === 'expired',
            canFinalize: (status === 'completed' || status === 'expired') && challenge.isActive,
            statusMessage,
          };
        },

        // ===== UTILITY ACTIONS =====
        reset: () => set(() => ({ ...initialState })),

        cleanup: () => {
          // Clean up old notifications (keep last 50)
          set((state) => {
            if (state.notifications.length > 50) {
              state.notifications = state.notifications.slice(0, 50);
            }
          });
        },
      }))
    ),
    {
      name: 'savings-store',
    }
  )
);

// ===== SELECTORS FOR PERFORMANCE =====
export const useSavingsSelectors = {
  useChallenges: () => useSavingsStore(state => state.challenges),
  useActiveChallenges: () => useSavingsStore(state => state.getActiveChallenges()),
  useCompletedChallenges: () => useSavingsStore(state => state.getCompletedChallenges()),
  useFilteredChallenges: () => useSavingsStore(state => state.getFilteredChallenges()),
  useStats: () => useSavingsStore(state => state.stats),
  useSelectedChallenge: () => useSavingsStore(state => state.selectedChallenge),
  useIsLoading: () => useSavingsStore(state => state.isLoading),
  useError: () => useSavingsStore(state => state.error),
  useNotifications: () => useSavingsStore(state => state.notifications),
  useUnreadNotifications: () => useSavingsStore(state => state.getUnreadNotifications()),
  useSaveCoinBalance: () => useSavingsStore(state => state.saveCoinBalance),
  useChallengeProgress: (challengeId: string) => 
    useSavingsStore(state => state.challengeProgress[challengeId]),
  useParticipantProgress: (challengeId: string) => 
    useSavingsStore(state => state.participantProgress[challengeId]),
};

// ===== SUBSCRIPTION HELPERS =====
export const subscribeToChallengeUpdates = (
  challengeId: string,
  callback: (challenge: SavingsChallenge | undefined) => void
) => {
  return useSavingsStore.subscribe(
    (state) => state.getChallengeById(challengeId),
    callback
  );
};

export const subscribeToNotifications = (
  callback: (notifications: SavingsNotification[]) => void
) => {
  return useSavingsStore.subscribe(
    (state) => state.notifications,
    callback
  );
};