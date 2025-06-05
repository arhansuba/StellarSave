// src/query/useCrossBorderYield.ts
// React Query Hooks for Cross-Border Yield Features

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions
} from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  YieldPool,
  YieldPosition,
  RemittanceCorridor,
  ExchangeRate,
  YieldStats,
  UserYieldSummary,
  CrossBorderTransaction,
  ArbitrageOpportunity,
  CreateYieldPoolRequest,
  DepositToPoolRequest,
  CrossBorderSendRequest,
  CrossBorderError,
  YieldPoolFilter,
} from '../types/crossBorder';
import { CrossBorderYieldService } from '../services/CrossBorderYieldService';
import { useCrossBorderStore } from '../stores/useCrossBorderStore';

// ===== QUERY KEYS =====
export const crossBorderQueryKeys = {
  all: ['cross-border'] as const,
  
  yieldPools: () => [...crossBorderQueryKeys.all, 'yield-pools'] as const,
  yieldPoolsList: (filter?: YieldPoolFilter) => 
    [...crossBorderQueryKeys.yieldPools(), 'list', filter] as const,
  yieldPool: (poolId: string) => 
    [...crossBorderQueryKeys.yieldPools(), 'detail', poolId] as const,
  
  positions: () => [...crossBorderQueryKeys.all, 'positions'] as const,
  userPositions: (userAddress?: string) => 
    [...crossBorderQueryKeys.positions(), 'user', userAddress] as const,
  
  corridors: () => [...crossBorderQueryKeys.all, 'corridors'] as const,
  corridorsList: () => [...crossBorderQueryKeys.corridors(), 'list'] as const,
  corridor: (corridorId: string) => 
    [...crossBorderQueryKeys.corridors(), 'detail', corridorId] as const,
  
  exchangeRates: () => [...crossBorderQueryKeys.all, 'exchange-rates'] as const,
  exchangeRate: (currencyPair: string) => 
    [...crossBorderQueryKeys.exchangeRates(), currencyPair] as const,
  
  stats: () => [...crossBorderQueryKeys.all, 'stats'] as const,
  yieldStats: () => [...crossBorderQueryKeys.stats(), 'yield'] as const,
  userStats: (userAddress?: string) => 
    [...crossBorderQueryKeys.stats(), 'user', userAddress] as const,
  
  transactions: () => [...crossBorderQueryKeys.all, 'transactions'] as const,
  transactionHistory: (userAddress?: string) => 
    [...crossBorderQueryKeys.transactions(), 'history', userAddress] as const,
  transaction: (txId: string) => 
    [...crossBorderQueryKeys.transactions(), 'detail', txId] as const,
  
  arbitrage: () => [...crossBorderQueryKeys.all, 'arbitrage'] as const,
  arbitrageOpportunities: () => 
    [...crossBorderQueryKeys.arbitrage(), 'opportunities'] as const,
  
  analytics: () => [...crossBorderQueryKeys.all, 'analytics'] as const,
  corridorAnalytics: (corridorId?: string) => 
    [...crossBorderQueryKeys.analytics(), 'corridor', corridorId] as const,
  marketInsights: () => 
    [...crossBorderQueryKeys.analytics(), 'insights'] as const,
};

// ===== SERVICES SETUP =====
let crossBorderService: CrossBorderYieldService;

export const initializeCrossBorderQueries = (service: CrossBorderYieldService) => {
  crossBorderService = service;
};

// ===== YIELD POOL HOOKS =====

/**
 * Hook to fetch all yield pools
 */
export const useYieldPools = (
  filter?: YieldPoolFilter,
  options?: Omit<UseQueryOptions<YieldPool[], CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  const updateYieldPools = useCrossBorderStore((state) => state.setYieldPools);
  
  return useQuery({
    queryKey: crossBorderQueryKeys.yieldPoolsList(filter),
    queryFn: async () => {
      if (!crossBorderService) {
        throw new Error('Cross-border service not initialized');
      }
      
      const pools = await crossBorderService.getYieldPools();
      
      // Update store with fresh data
      updateYieldPools(pools);
      
      return pools;
    },
    enabled: !!crossBorderService,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes (renamed from cacheTime)
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // 1 minute background refresh
    ...options,
  });
};

/**
 * Hook to fetch a single yield pool
 */
export const useYieldPool = (
  poolId?: string,
  options?: Omit<UseQueryOptions<YieldPool, CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: crossBorderQueryKeys.yieldPool(poolId!),
    queryFn: async () => {
      if (!poolId || !crossBorderService) {
        throw new Error('Pool ID and cross-border service required');
      }
      
      return await crossBorderService.getYieldPool(poolId);
    },
    enabled: !!poolId && !!crossBorderService,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    ...options,
  });
};

/**
 * Hook to fetch user's yield positions
 */
export const useUserYieldPositions = (
  userAddress?: string,
  options?: Omit<UseQueryOptions<YieldPosition[], CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  const setUserPositions = useCrossBorderStore((state) => state.setUserPositions);
  
  return useQuery({
    queryKey: crossBorderQueryKeys.userPositions(userAddress),
    queryFn: async () => {
      if (!userAddress || !crossBorderService) {
        throw new Error('User address and cross-border service required');
      }
      
      const positions = await crossBorderService.getUserYieldPositions(userAddress);
      
      // Update store
      setUserPositions(positions);
      
      return positions;
    },
    enabled: !!userAddress && !!crossBorderService,
    staleTime: 45000, // 45 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
    ...options,
  });
};

/**
 * Hook to calculate projected yield
 */
export const useProjectedYield = (
  poolId?: string,
  amount?: number,
  durationDays?: number,
  options?: Omit<UseQueryOptions<number, CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: [...crossBorderQueryKeys.yieldPool(poolId!), 'projected', amount, durationDays],
    queryFn: async () => {
      if (!poolId || !amount || !durationDays || !crossBorderService) {
        throw new Error('Pool ID, amount, duration, and service required');
      }
      
      return await crossBorderService.calculateProjectedYield(poolId, amount, durationDays);
    },
    enabled: !!poolId && !!amount && !!durationDays && !!crossBorderService,
    staleTime: 120000, // 2 minutes
    gcTime: 300000, // 5 minutes
    ...options,
  });
};

// ===== CORRIDOR AND EXCHANGE RATE HOOKS =====

/**
 * Hook to fetch supported remittance corridors
 */
export const useRemittanceCorridors = (
  options?: Omit<UseQueryOptions<RemittanceCorridor[], CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  const setCorridors = useCrossBorderStore((state) => state.setCorridors);
  
  return useQuery({
    queryKey: crossBorderQueryKeys.corridorsList(),
    queryFn: async () => {
      if (!crossBorderService) {
        throw new Error('Cross-border service not initialized');
      }
      
      const corridors = await crossBorderService.getSupportedCorridors();
      
      // Update store
      setCorridors(corridors);
      
      return corridors;
    },
    enabled: !!crossBorderService,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false, // Corridors don't change frequently
    ...options,
  });
};

/**
 * Hook to fetch exchange rate for currency pair
 */
export const useExchangeRate = (
  currencyPair?: string,
  options?: Omit<UseQueryOptions<ExchangeRate, CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: crossBorderQueryKeys.exchangeRate(currencyPair!),
    queryFn: async () => {
      if (!currencyPair || !crossBorderService) {
        throw new Error('Currency pair and cross-border service required');
      }
      
      return await crossBorderService.getExchangeRate(currencyPair);
    },
    enabled: !!currencyPair && !!crossBorderService,
    staleTime: 30000, // 30 seconds (rates change frequently)
    gcTime: 120000, // 2 minutes
    refetchInterval: 60000, // 1 minute refresh for rates
    refetchOnWindowFocus: true,
    ...options,
  });
};

// ===== STATISTICS HOOKS =====

/**
 * Hook to fetch yield statistics
 */
export const useYieldStats = (
  options?: Omit<UseQueryOptions<YieldStats, CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  const setYieldStats = useCrossBorderStore((state) => state.setYieldStats);
  
  return useQuery({
    queryKey: crossBorderQueryKeys.yieldStats(),
    queryFn: async () => {
      if (!crossBorderService) {
        throw new Error('Cross-border service not initialized');
      }
      
      const stats = await crossBorderService.getYieldStats();
      
      // Update store
      setYieldStats(stats);
      
      return stats;
    },
    enabled: !!crossBorderService,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 120000, // 2 minutes
    ...options,
  });
};

/**
 * Hook to fetch user's yield summary
 */
export const useUserYieldSummary = (
  userAddress?: string,
  options?: Omit<UseQueryOptions<UserYieldSummary, CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  const setUserSummary = useCrossBorderStore((state) => state.setUserSummary);
  
  return useQuery({
    queryKey: crossBorderQueryKeys.userStats(userAddress),
    queryFn: async () => {
      if (!userAddress || !crossBorderService) {
        throw new Error('User address and cross-border service required');
      }
      
      const summary = await crossBorderService.getUserYieldSummary(userAddress);
      
      // Update store
      setUserSummary(summary);
      
      return summary;
    },
    enabled: !!userAddress && !!crossBorderService,
    staleTime: 45000, // 45 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
    ...options,
  });
};

/**
 * Hook to fetch transaction history
 */
export const useTransactionHistory = (
  userAddress?: string,
  options?: Omit<UseQueryOptions<CrossBorderTransaction[], CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: crossBorderQueryKeys.transactionHistory(userAddress),
    queryFn: async () => {
      if (!userAddress || !crossBorderService) {
        throw new Error('User address and cross-border service required');
      }
      
      return await crossBorderService.getTransactionHistory(userAddress);
    },
    enabled: !!userAddress && !!crossBorderService,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    ...options,
  });
};

/**
 * Hook to fetch arbitrage opportunities
 */
export const useArbitrageOpportunities = (
  options?: Omit<UseQueryOptions<ArbitrageOpportunity[], CrossBorderError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: crossBorderQueryKeys.arbitrageOpportunities(),
    queryFn: async () => {
      if (!crossBorderService) {
        throw new Error('Cross-border service not initialized');
      }
      
      return await crossBorderService.getArbitrageOpportunities();
    },
    enabled: !!crossBorderService,
    staleTime: 30000, // 30 seconds
    gcTime: 120000, // 2 minutes
    refetchInterval: 60000, // 1 minute - opportunities change quickly
    ...options,
  });
};

// ===== MUTATION HOOKS =====

/**
 * Hook to create a new yield pool
 */
export const useCreateYieldPool = (
  options?: Omit<
    UseMutationOptions<
      { poolId: string; transactionHash: string },
      CrossBorderError,
      { request: CreateYieldPoolRequest; adminAddress: string }
    >,
    'mutationFn'
  >
) => {
  const queryClient = useQueryClient();
  const { addNotification } = useCrossBorderStore();
  
  return useMutation<
    { poolId: string; transactionHash: string },
    CrossBorderError,
    { request: CreateYieldPoolRequest; adminAddress: string }
  >({
    mutationFn: ({ request, adminAddress }) => {
      if (!crossBorderService) {
        throw new Error('Cross-border service not initialized');
      }
      
      return crossBorderService.createYieldPool(request, adminAddress);
    },
    onSuccess: (data, { request }) => { // Remove unused adminAddress parameter
      // Add success notification
      addNotification({
        id: `create_pool_success_${data.poolId}`,
        type: 'transaction_completed', // Changed from 'pool_created'
        title: 'Yield Pool Created',
        message: `Pool "${request.name}" created successfully!`,
        poolId: data.poolId,
        timestamp: new Date(),
        read: false,
      });
      
      // Show toast
      toast.success(`Yield pool "${request.name}" created!`);
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.yieldPoolsList() });
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.yieldStats() });
      
      // Prefetch the new pool
      queryClient.prefetchQuery({
        queryKey: crossBorderQueryKeys.yieldPool(data.poolId),
        queryFn: () => crossBorderService.getYieldPool(data.poolId),
      });
    },
    onError: (error, { request }) => {
      // Add error notification
      addNotification({
        id: `create_pool_error_${Date.now()}`,
        type: 'transaction_completed', // Changed from 'error'
        title: 'Pool Creation Failed',
        message: `Failed to create pool "${request.name}": ${error.message}`,
        timestamp: new Date(),
        read: false,
      });
      
      // Show error toast
      toast.error(`Failed to create pool: ${error.message}`);
      
      console.error('Create yield pool failed:', error);
    },
    ...options,
  });
};

/**
 * Hook to deposit to a yield pool
 */
export const useDepositToPool = (
  options?: Omit<
    UseMutationOptions<
      { transactionHash: string }, 
      CrossBorderError,
      { request: DepositToPoolRequest; userAddress: string },
      { previousPool: YieldPool | undefined }
    >,
    'mutationFn'
  >
) => {
  const queryClient = useQueryClient();
  const { addNotification } = useCrossBorderStore();
  
  return useMutation<
    { transactionHash: string },
    CrossBorderError,
    { request: DepositToPoolRequest; userAddress: string },
    { previousPool: YieldPool | undefined }
  >({
    mutationFn: ({ request, userAddress }) => {
      if (!crossBorderService) {
        throw new Error('Cross-border service not initialized');
      }
      
      return crossBorderService.depositToPool(request, userAddress);
    },

    // Make other callbacks type-compatible
    onMutate: async ({ request, userAddress }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: crossBorderQueryKeys.yieldPool(request.poolId) });
      await queryClient.cancelQueries({ queryKey: crossBorderQueryKeys.userPositions(userAddress) });
      
      // Snapshot previous values
      const previousPool = queryClient.getQueryData<YieldPool>(
        crossBorderQueryKeys.yieldPool(request.poolId)
      );
      
      // Optimistically update pool
      if (previousPool) {
        queryClient.setQueryData<YieldPool>(
          crossBorderQueryKeys.yieldPool(request.poolId),
          {
            ...previousPool,
            totalDeposited: previousPool.totalDeposited + request.amount,
            participants: previousPool.participants.includes(userAddress) 
              ? previousPool.participants 
              : [...previousPool.participants, userAddress],
          }
        );
      }
      
      return { previousPool };
    },
    onSuccess: (data, { request, userAddress }) => {
      // Add success notification
      addNotification({
        id: `deposit_success_${data.transactionHash}`,
        type: 'transaction_completed', // Changed from 'deposit_completed'
        title: 'Deposit Successful',
        message: `Successfully deposited ${request.amount} to yield pool!`,
        poolId: request.poolId,
        timestamp: new Date(),
        read: false,
      });
      
      // Show toast
      toast.success(`Deposited ${request.amount} successfully!`);
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.yieldPoolsList() });
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.yieldPool(request.poolId) });
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.userPositions(userAddress) });
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.userStats(userAddress) });
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.yieldStats() });
    },
    onError: (error, { request }, context) => {
      // Revert optimistic updates
      if (context?.previousPool) {
        queryClient.setQueryData(
          crossBorderQueryKeys.yieldPool(request.poolId),
          context.previousPool
        );
      }
      
      // Add error notification
      addNotification({
        id: `deposit_error_${Date.now()}`,
        type: 'transaction_completed', // Changed from 'error'
        title: 'Deposit Failed',
        message: `Failed to deposit ${request.amount}: ${error.message}`,
        poolId: request.poolId,
        timestamp: new Date(),
        read: false,
      });
      
      // Show error toast
      toast.error(`Deposit failed: ${error.message}`);
      
      console.error('Deposit to pool failed:', error);
    },
    onSettled: (_data, _error, { request, userAddress }) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.yieldPool(request.poolId) });
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.userPositions(userAddress) });
    },
    ...options,
  });
};

/**
 * Hook to send cross-border payment
 */
export const useSendCrossBorder = (
  options?: Omit<
    UseMutationOptions<
      { transactionId: string; moneygramRef: string },
      CrossBorderError,
      { request: CrossBorderSendRequest; userAddress: string }
    >,
    'mutationFn'
  >
) => {
  const queryClient = useQueryClient();
  const { addNotification } = useCrossBorderStore();
  
  return useMutation<
    { transactionId: string; moneygramRef: string },
    CrossBorderError,
    { request: CrossBorderSendRequest; userAddress: string }
  >({
    mutationFn: ({ request, userAddress }) => {
      if (!crossBorderService) {
        throw new Error('Cross-border service not initialized');
      }
      
      return crossBorderService.sendCrossBorder(request, userAddress);
    },
    onSuccess: (data, { request, userAddress }) => {
      // Add success notification
      addNotification({
        id: `send_success_${data.transactionId}`,
        type: 'transaction_completed',
        title: 'Transfer Initiated',
        message: `Cross-border transfer of ${request.amount} ${request.toCurrency} initiated!`,
        transactionId: data.transactionId,
        timestamp: new Date(),
        read: false,
        actionUrl: `https://moneygram.com/track/${data.moneygramRef}`,
      });
      
      // Show toast
      toast.success(`Transfer initiated! Reference: ${data.moneygramRef}`);
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.transactionHistory(userAddress) });
      queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.userStats(userAddress) });
      
      if (request.useYieldPool) {
        queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.userPositions(userAddress) });
      }
    },
    onError: (error, { request }) => {
      // Add error notification
      addNotification({
        id: `send_error_${Date.now()}`,
        type: 'transaction_completed', // Changed from 'error'
        title: 'Transfer Failed',
        message: `Failed to send ${request.amount}: ${error.message}`,
        timestamp: new Date(),
        read: false,
      });
      
      // Show error toast
      toast.error(`Transfer failed: ${error.message}`);
      
      console.error('Cross-border send failed:', error);
    },
    ...options,
  });
};

// ===== UTILITY HOOKS =====

/**
 * Hook to refresh all cross-border data
 */
export const useRefreshCrossBorderData = () => {
  const queryClient = useQueryClient();
  
  return (userAddress?: string) => {
    // Invalidate all cross-border queries
    queryClient.invalidateQueries({ queryKey: crossBorderQueryKeys.all });
    
    // Force refetch key queries
    if (userAddress) {
      queryClient.refetchQueries({ queryKey: crossBorderQueryKeys.userPositions(userAddress) });
      queryClient.refetchQueries({ queryKey: crossBorderQueryKeys.userStats(userAddress) });
      queryClient.refetchQueries({ queryKey: crossBorderQueryKeys.transactionHistory(userAddress) });
    }
    
    queryClient.refetchQueries({ queryKey: crossBorderQueryKeys.yieldPoolsList() });
    queryClient.refetchQueries({ queryKey: crossBorderQueryKeys.yieldStats() });
    queryClient.refetchQueries({ queryKey: crossBorderQueryKeys.corridorsList() });
  };
};

/**
 * Hook to prefetch yield pool data
 */
export const usePrefetchYieldPool = () => {
  const queryClient = useQueryClient();
  
  return (poolId: string) => {
    queryClient.prefetchQuery({
      queryKey: crossBorderQueryKeys.yieldPool(poolId),
      queryFn: () => crossBorderService.getYieldPool(poolId),
      staleTime: 60000,
      // Remove cacheTime which is not supported
    });
  };
};

/**
 * Hook to get cached cross-border data
 */
export const useCachedCrossBorderData = (userAddress?: string) => {
  const queryClient = useQueryClient();
  
  const getCachedYieldPools = () => 
    queryClient.getQueryData<YieldPool[]>(
      crossBorderQueryKeys.yieldPoolsList()
    );
  
  const getCachedUserPositions = () => 
    queryClient.getQueryData<YieldPosition[]>(
      crossBorderQueryKeys.userPositions(userAddress)
    );
  
  const getCachedYieldStats = () => 
    queryClient.getQueryData<YieldStats>(
      crossBorderQueryKeys.yieldStats()
    );
  
  const getCachedCorridors = () => 
    queryClient.getQueryData<RemittanceCorridor[]>(
      crossBorderQueryKeys.corridorsList()
    );
  
  const getCachedUserSummary = () => 
    queryClient.getQueryData<UserYieldSummary>(
      crossBorderQueryKeys.userStats(userAddress)
    );
  
  return {
    getCachedYieldPools,
    getCachedUserPositions,
    getCachedYieldStats,
    getCachedCorridors,
    getCachedUserSummary,
  };
};