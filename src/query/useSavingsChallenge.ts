// src/query/useSavingsChallenge.ts
// React Query Hooks for StellarSave

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  // useInfiniteQuery, // Removed
  UseQueryOptions,
  UseMutationOptions,
  // UseInfiniteQueryOptions // Removed
} from '@tanstack/react-query';
import { toast } from 'react-hot-toast'; // Assuming toast notifications are used
import { 
  SavingsChallenge,
  SavingsStats,
  CreateChallengeRequest,
  ChallengeProgress,
  SavingsContribution,
  ParticipantProgress,
  SavingsError,
  ChallengeFilter,
  // PaginatedResponse // Removed
} from '../types/savings';
import { SavingsService } from '../services/SavingsService';
import { useSavingsStore } from '../store/useSavingsStore';

// ===== QUERY KEYS =====
export const savingsQueryKeys = {
  all: ['savings'] as const,
  challenges: () => [...savingsQueryKeys.all, 'challenges'] as const,
  challengesList: (userAddress?: string, filter?: ChallengeFilter) => 
    [...savingsQueryKeys.challenges(), 'list', userAddress, filter] as const,
  challenge: (challengeId: string) => 
    [...savingsQueryKeys.challenges(), 'detail', challengeId] as const,
  challengeProgress: (challengeId: string) => 
    [...savingsQueryKeys.challenges(), 'progress', challengeId] as const,
  participantProgress: (challengeId: string) => 
    [...savingsQueryKeys.challenges(), 'participants', challengeId] as const,
  
  stats: () => [...savingsQueryKeys.all, 'stats'] as const,
  userStats: (userAddress?: string) => 
    [...savingsQueryKeys.stats(), userAddress] as const,
  
  contributions: () => [...savingsQueryKeys.all, 'contributions'] as const,
  userContributions: (userAddress?: string) => 
    [...savingsQueryKeys.contributions(), 'user', userAddress] as const,
  challengeContributions: (challengeId: string) => 
    [...savingsQueryKeys.contributions(), 'challenge', challengeId] as const,
  
  saveCoin: () => [...savingsQueryKeys.all, 'savecoin'] as const,
  saveCoinBalance: (userAddress?: string) => 
    [...savingsQueryKeys.saveCoin(), 'balance', userAddress] as const,
};

// ===== SERVICES SETUP =====
// This would typically come from a context or dependency injection
// For now, we'll create it inline - in production, this should be injected
let savingsService: SavingsService;

export const initializeSavingsQueries = (service: SavingsService) => {
  savingsService = service;
};

// ===== QUERY HOOKS =====

/**
 * Hook to fetch user's savings challenges with filtering and sorting
 */
export const useSavingsChallenges = (
  userAddress?: string,
  filter?: ChallengeFilter,
  options?: Omit<UseQueryOptions<SavingsChallenge[], SavingsError>, 'queryKey' | 'queryFn'>
) => {
  const updateChallenges = useSavingsStore((state) => state.setChallenges);
  
  return useQuery({
    queryKey: savingsQueryKeys.challengesList(userAddress, filter),
    queryFn: async () => {
      if (!userAddress || !savingsService) {
        throw new Error('User address and savings service required');
      }
      
      const challenges = await savingsService.getUserChallenges(userAddress);
      
      // Update store with fresh data
      updateChallenges(challenges);
      
      return challenges;
    },
    enabled: !!userAddress && !!savingsService,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes, formerly cacheTime
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // 1 minute background refresh
    ...options,
  });
};

/**
 * Hook to fetch a single challenge by ID
 */
export const useSavingsChallenge = (
  challengeId?: string,
  options?: Omit<UseQueryOptions<SavingsChallenge, SavingsError>, 'queryKey' | 'queryFn'>
) => {
  const updateChallenge = useSavingsStore((state) => state.updateChallenge);
  
  return useQuery({
    queryKey: savingsQueryKeys.challenge(challengeId!),
    queryFn: async () => {
      if (!challengeId || !savingsService) {
        throw new Error('Challenge ID and savings service required');
      }
      
      const challenge = await savingsService.getChallenge(challengeId);
      
      // Update store
      updateChallenge(challengeId, challenge);
      
      return challenge;
    },
    enabled: !!challengeId && !!savingsService,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes, formerly cacheTime
    ...options,
  });
};

/**
 * Hook to fetch user's savings statistics
 */
export const useSavingsStats = (
  userAddress?: string,
  options?: Omit<UseQueryOptions<SavingsStats, SavingsError>, 'queryKey' | 'queryFn'>
) => {
  const setStats = useSavingsStore((state) => state.setStats);
  
  return useQuery({
    queryKey: savingsQueryKeys.userStats(userAddress),
    queryFn: async () => {
      if (!userAddress || !savingsService) {
        throw new Error('User address and savings service required');
      }
      
      const stats = await savingsService.getUserStats(userAddress);
      
      // Update store
      setStats(stats);
      
      return stats;
    },
    enabled: !!userAddress && !!savingsService,
    staleTime: 45000, // 45 seconds
    gcTime: 300000, // 5 minutes, formerly cacheTime
    refetchOnWindowFocus: true,
    ...options,
  });
};

/**
 * Hook to fetch challenge progress
 */
export const useChallengeProgress = (
  challengeId?: string,
  options?: Omit<UseQueryOptions<ChallengeProgress, SavingsError>, 'queryKey' | 'queryFn'>
) => {
  const setChallengeProgress = useSavingsStore((state) => state.setChallengeProgress);
  
  return useQuery({
    queryKey: savingsQueryKeys.challengeProgress(challengeId!),
    queryFn: async () => {
      if (!challengeId || !savingsService) {
        throw new Error('Challenge ID and savings service required');
      }
      
      const progress = await savingsService.getChallengeProgress(challengeId);
      
      // Update store
      setChallengeProgress(challengeId, progress);
      
      return progress;
    },
    enabled: !!challengeId && !!savingsService,
    staleTime: 30000, // 30 seconds
    gcTime: 180000, // 3 minutes, formerly cacheTime
    refetchInterval: 45000, // 45 seconds for active challenges
    ...options,
  });
};

/**
 * Hook to fetch participant progress for a challenge
 */
export const useParticipantProgress = (
  challengeId?: string,
  options?: Omit<UseQueryOptions<ParticipantProgress[], SavingsError>, 'queryKey' | 'queryFn'>
) => {
  const setParticipantProgress = useSavingsStore((state) => state.setParticipantProgress);
  
  return useQuery({
    queryKey: savingsQueryKeys.participantProgress(challengeId!),
    queryFn: async () => {
      if (!challengeId || !savingsService) {
        throw new Error('Challenge ID and savings service required');
      }
      
      const progress = await savingsService.getParticipantProgress(challengeId);
      
      // Update store
      setParticipantProgress(challengeId, progress);
      
      return progress;
    },
    enabled: !!challengeId && !!savingsService,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes, formerly cacheTime
    ...options,
  });
};

/**
 * Hook to fetch SaveCoin balance
 */
export const useSaveCoinBalance = (
  userAddress?: string,
  options?: Omit<UseQueryOptions<number, SavingsError>, 'queryKey' | 'queryFn'>
) => {
  const setSaveCoinBalance = useSavingsStore((state) => state.setSaveCoinBalance);
  
  return useQuery({
    queryKey: savingsQueryKeys.saveCoinBalance(userAddress),
    queryFn: async () => {
      if (!userAddress || !savingsService) {
        throw new Error('User address and savings service required');
      }
      
      const balance = await savingsService.getSaveCoinBalance(userAddress);
      
      // Update store
      setSaveCoinBalance(balance);
      
      return balance;
    },
    enabled: !!userAddress && !!savingsService,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes, formerly cacheTime
    refetchOnWindowFocus: true,
    ...options,
  });
};

/**
 * Hook to fetch user's contribution history
 */
export const useUserContributions = (
  userAddress?: string,
  options?: Omit<UseQueryOptions<SavingsContribution[], SavingsError>, 'queryKey' | 'queryFn'>
) => {
  const setContributions = useSavingsStore((state) => state.setContributions);
  
  return useQuery({
    queryKey: savingsQueryKeys.userContributions(userAddress),
    queryFn: async () => {
      if (!userAddress || !savingsService) {
        throw new Error('User address and savings service required');
      }
      
      const contributions = await savingsService.getUserContributions(userAddress);
      
      // Update store
      setContributions(contributions);
      
      return contributions;
    },
    enabled: !!userAddress && !!savingsService,
    staleTime: 120000, // 2 minutes
    gcTime: 600000, // 10 minutes, formerly cacheTime
    ...options,
  });
};

/**
 * Hook to fetch contributions for a specific challenge
 */
export const useChallengeContributions = (
  challengeId?: string,
  options?: Omit<UseQueryOptions<SavingsContribution[], SavingsError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: savingsQueryKeys.challengeContributions(challengeId!),
    queryFn: async () => {
      if (!challengeId || !savingsService) {
        throw new Error('Challenge ID and savings service required');
      }
      
      return await savingsService.getChallengeContributions(challengeId);
    },
    enabled: !!challengeId && !!savingsService,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes, formerly cacheTime
    ...options,
  });
};

// ===== MUTATION HOOKS =====

/**
 * Hook to create a new savings challenge
 */
export const useCreateChallenge = (
  options?: UseMutationOptions<
    { challengeId: string; transactionHash: string },
    SavingsError,
    { request: CreateChallengeRequest; userAddress: string }
  >
) => {
  const queryClient = useQueryClient();
  const { 
    setCreatingChallenge, 
    addNotification, 
    closeCreateChallengeModal 
  } = useSavingsStore();
  
  return useMutation({
    mutationFn: async ({ request, userAddress }) => {
      if (!savingsService) {
        throw new Error('Savings service not initialized');
      }
      
      setCreatingChallenge(true);
      
      try {
        const result = await savingsService.createChallenge(request, userAddress);
        return result;
      } finally {
        setCreatingChallenge(false);
      }
    },
    onSuccess: (data, { userAddress, request }) => {
      // Close modal
      closeCreateChallengeModal();
      
      // Add success notification
      addNotification({
        id: `create_success_${data.challengeId}`,
        type: 'milestone',
        challengeId: data.challengeId,
        message: `Challenge "${request.name}" created successfully!`,
        timestamp: new Date(),
        read: false,
        priority: 'medium',
      });
      
      // Show toast
      toast.success(`Challenge "${request.name}" created!`);
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challengesList(userAddress) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.userStats(userAddress) });
      
      // Prefetch the new challenge
      queryClient.prefetchQuery({
        queryKey: savingsQueryKeys.challenge(data.challengeId),
        queryFn: () => savingsService.getChallenge(data.challengeId),
      });
    },
    onError: (error, { request }) => {
      // Add error notification
      addNotification({
        id: `create_error_${Date.now()}`,
        type: 'warning',
        challengeId: '',
        message: `Failed to create challenge "${request.name}": ${error.message}`,
        timestamp: new Date(),
        read: false,
        priority: 'high',
      });
      
      // Show error toast
      toast.error(`Failed to create challenge: ${error.message}`);
      
      console.error('Create challenge failed:', error);
    },
    ...options,
  });
};

/**
 * Hook to contribute to a savings challenge
 */
export const useContributeToChallenge = (
  options?: UseMutationOptions<
    { transactionHash: string },
    SavingsError,
    { challengeId: string; amount: number; userAddress: string },
    { previousChallenge: SavingsChallenge | undefined }
  >
) => {
  const queryClient = useQueryClient();
  const { 
    setContributing, 
    addContribution, 
    addNotification, 
    closeContributionModal 
  } = useSavingsStore();
  
  return useMutation<
    { transactionHash: string },
    SavingsError,
    { challengeId: string; amount: number; userAddress: string },
    { previousChallenge: SavingsChallenge | undefined }
  >({
    mutationFn: async ({ challengeId, amount, userAddress }) => {
      if (!savingsService) {
        throw new Error('Savings service not initialized');
      }
      
      setContributing(true);
      
      try {
        const result = await savingsService.contributeToChallenge(challengeId, amount, userAddress);
        return result;
      } finally {
        setContributing(false);
      }
    },
    onMutate: async ({ challengeId, amount, userAddress }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: savingsQueryKeys.challenge(challengeId) });
      await queryClient.cancelQueries({ queryKey: savingsQueryKeys.challengeProgress(challengeId) });
      
      // Snapshot previous values
      const previousChallenge = queryClient.getQueryData<SavingsChallenge>(
        savingsQueryKeys.challenge(challengeId)
      );
      
      // Optimistically update challenge
      if (previousChallenge) {
        queryClient.setQueryData<SavingsChallenge>(
          savingsQueryKeys.challenge(challengeId),
          {
            ...previousChallenge,
            currentAmount: previousChallenge.currentAmount + amount,
          }
        );
      }
      
      // Optimistically add contribution to store
      addContribution({
        challengeId,
        contributor: userAddress,
        amount,
        timestamp: new Date(),
        transactionHash: `optimistic_${Date.now()}`,
        weekNumber: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
      });
      
      return { previousChallenge };
    },
    onSuccess: (data, { challengeId, amount, userAddress }) => {
      // Close modal
      closeContributionModal();
      
      // Add success notification
      addNotification({
        id: `contrib_success_${data.transactionHash}`,
        type: 'contribution',
        challengeId,
        message: `Successfully contributed ${amount} XLM!`,
        timestamp: new Date(),
        read: false,
        priority: 'low',
      });
      
      // Show toast
      toast.success(`Contributed ${amount} XLM successfully!`);
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challengesList(userAddress) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challenge(challengeId) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challengeProgress(challengeId) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.participantProgress(challengeId) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.userStats(userAddress) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.saveCoinBalance(userAddress) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.userContributions(userAddress) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challengeContributions(challengeId) });
    },
    onError: (error, { challengeId, amount }, context) => {
      // Revert optimistic updates
      if (context?.previousChallenge) {
        queryClient.setQueryData(
          savingsQueryKeys.challenge(challengeId),
          context.previousChallenge
        );
      }
      
      // Add error notification
      addNotification({
        id: `contrib_error_${Date.now()}`,
        type: 'warning',
        challengeId,
        message: `Failed to contribute ${amount} XLM: ${error.message}`,
        timestamp: new Date(),
        read: false,
        priority: 'high',
      });
      
      // Show error toast
      toast.error(`Contribution failed: ${error.message}`);
      
      console.error('Contribution failed:', error);
    },
    onSettled: (_data, _error, { challengeId }) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challenge(challengeId) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challengeProgress(challengeId) });
    },
    ...options,
  });
};

/**
 * Hook to finalize a completed challenge
 */
export const useFinalizeChallenge = (
  options?: UseMutationOptions<
    { transactionHash: string },
    SavingsError,
    { challengeId: string; userAddress: string }
  >
) => {
  const queryClient = useQueryClient();
  const { addNotification } = useSavingsStore();
  
  return useMutation({
    mutationFn: async ({ challengeId }) => {
      if (!savingsService) {
        throw new Error('Savings service not initialized');
      }
      
      return await savingsService.finalizeChallenge(challengeId);
    },
    onSuccess: (data, { challengeId, userAddress }) => {
      // Add success notification
      addNotification({
        id: `finalize_success_${data.transactionHash}`,
        type: 'completion',
        challengeId,
        message: 'Challenge finalized successfully!',
        timestamp: new Date(),
        read: false,
        priority: 'medium',
      });
      
      // Show toast
      toast.success('Challenge finalized!');
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challengesList(userAddress) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challenge(challengeId) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.userStats(userAddress) });
      queryClient.invalidateQueries({ queryKey: savingsQueryKeys.saveCoinBalance(userAddress) });
    },
    onError: (error, { challengeId }) => {
      // Add error notification
      addNotification({
        id: `finalize_error_${Date.now()}`,
        type: 'warning',
        challengeId,
        message: `Failed to finalize challenge: ${error.message}`,
        timestamp: new Date(),
        read: false,
        priority: 'high',
      });
      
      // Show error toast
      toast.error(`Finalization failed: ${error.message}`);
      
      console.error('Challenge finalization failed:', error);
    },
    ...options,
  });
};

// ===== UTILITY HOOKS =====

/**
 * Hook to refresh all user data
 */
export const useRefreshUserData = () => {
  const queryClient = useQueryClient();
  
  return (userAddress: string) => {
    // Invalidate all user-related queries
    queryClient.invalidateQueries({ queryKey: savingsQueryKeys.challengesList(userAddress) });
    queryClient.invalidateQueries({ queryKey: savingsQueryKeys.userStats(userAddress) });
    queryClient.invalidateQueries({ queryKey: savingsQueryKeys.saveCoinBalance(userAddress) });
    queryClient.invalidateQueries({ queryKey: savingsQueryKeys.userContributions(userAddress) });
    
    // Force refetch
    queryClient.refetchQueries({ queryKey: savingsQueryKeys.challengesList(userAddress) });
    queryClient.refetchQueries({ queryKey: savingsQueryKeys.userStats(userAddress) });
  };
};

/**
 * Hook to prefetch challenge data
 */
export const usePrefetchChallenge = () => {
  const queryClient = useQueryClient();
  
  return (challengeId: string) => {
    queryClient.prefetchQuery({
      queryKey: savingsQueryKeys.challenge(challengeId),
      queryFn: () => savingsService.getChallenge(challengeId),
      staleTime: 60000,
    });
    
    queryClient.prefetchQuery({
      queryKey: savingsQueryKeys.challengeProgress(challengeId),
      queryFn: () => savingsService.getChallengeProgress(challengeId),
      staleTime: 30000,
    });
  };
};

/**
 * Hook to get cached data without triggering fetches
 */
export const useCachedSavingsData = (userAddress?: string) => {
  const queryClient = useQueryClient();
  
  const getCachedChallenges = () => 
    queryClient.getQueryData<SavingsChallenge[]>(
      savingsQueryKeys.challengesList(userAddress)
    );
  
  const getCachedStats = () => 
    queryClient.getQueryData<SavingsStats>(
      savingsQueryKeys.userStats(userAddress)
    );
  
  const getCachedBalance = () => 
    queryClient.getQueryData<number>(
      savingsQueryKeys.saveCoinBalance(userAddress)
    );
  
  const getCachedChallenge = (challengeId: string) => 
    queryClient.getQueryData<SavingsChallenge>(
      savingsQueryKeys.challenge(challengeId)
    );
  
  return {
    getCachedChallenges,
    getCachedStats,
    getCachedBalance,
    getCachedChallenge,
  };
};