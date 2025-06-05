// src/types/savings.ts
// StellarSave TypeScript Types and Interfaces

export interface SavingsChallenge {
  id: string;
  name: string;
  description?: string;
  goalAmount: number; // in XLM
  weeklyAmount: number; // in XLM
  currentAmount: number;
  participants: string[]; // Stellar addresses
  creator: string; // Stellar address
  createdAt: Date;
  deadline: Date;
  isActive: boolean;
  isCompleted: boolean;
  contractAddress?: string;
}

export interface SavingsContribution {
  challengeId: string;
  contributor: string; // Stellar address
  amount: number; // in XLM
  timestamp: Date;
  transactionHash: string;
  weekNumber: number;
}

export interface SavingsStats {
  totalSaved: number;
  activeChallenges: number;
  completedChallenges: number;
  saveCoinBalance: number;
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  averageWeeklyContribution: number;
}

export interface CreateChallengeRequest {
  name: string;
  description?: string;
  goalAmount: number;
  weeklyAmount: number;
  durationWeeks: number;
  participantAddresses: string[];
  requireMinWeekly?: boolean;
  allowEarlyWithdrawal?: boolean;
}

export interface ChallengeProgress {
  challengeId: string;
  progressPercentage: number;
  remainingAmount: number;
  daysLeft: number;
  weeksPassed: number;
  totalWeeks: number;
  onTrack: boolean;
  expectedAmount: number; // What should be saved by now
  weeklyTarget: number;
  lastContributionDate?: Date;
}

export interface SavingsNotification {
  id: string;
  type: 'contribution' | 'milestone' | 'reminder' | 'completion' | 'warning';
  challengeId: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface ParticipantProgress {
  address: string;
  displayName?: string;
  totalContributed: number;
  weeklyAverage: number;
  contributionStreak: number;
  lastContribution?: Date;
  isOnTrack: boolean;
  progressPercentage: number;
}

export interface ChallengeMetrics {
  challengeId: string;
  participationRate: number; // Percentage of participants actively contributing
  averageContribution: number;
  totalContributions: number;
  weeklyGrowthRate: number;
  projectedCompletion: Date;
  riskLevel: 'low' | 'medium' | 'high'; // Based on progress vs timeline
}

export interface SaveCoinReward {
  id: string;
  userAddress: string;
  challengeId: string;
  amount: number;
  reason: 'weekly_contribution' | 'milestone' | 'completion' | 'streak_bonus';
  timestamp: Date;
  transactionHash?: string;
}

export interface ChallengeSettings {
  minContributionAmount: number;
  maxContributionAmount: number;
  allowPartialWithdrawals: boolean;
  penaltyPercentage: number; // For early withdrawals
  rewardMultiplier: number; // SaveCoin multiplier for this challenge
  reminderFrequency: 'daily' | 'weekly' | 'bi-weekly';
}

// Contract interaction types
export interface ContractCallOptions {
  contractAddress: string;
  method: string;
  args: unknown[];
  simulate?: boolean;
  maxFee?: number;
}

export interface ContractCallResult {
  result: unknown;
  transactionHash?: string;
  ledger?: number;
  gas?: number;
}

// Error types
export type SavingsErrorType = 
  | 'INSUFFICIENT_BALANCE'
  | 'CHALLENGE_NOT_FOUND'
  | 'NOT_PARTICIPANT'
  | 'CHALLENGE_INACTIVE'
  | 'CONTRACT_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED';

export interface SavingsError {
  type: SavingsErrorType;
  message: string;
  details?: unknown;
  challengeId?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: SavingsError;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Filter and sort types
export interface ChallengeFilter {
  status?: 'active' | 'completed' | 'expired' | 'all';
  participantAddress?: string;
  createdBy?: string;
  minGoalAmount?: number;
  maxGoalAmount?: number;
  sortBy?: 'created' | 'deadline' | 'progress' | 'participants';
  sortOrder?: 'asc' | 'desc';
}

export interface ContributionFilter {
  challengeId?: string;
  contributor?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

// Utility types
export type ChallengeStatus = 'active' | 'completed' | 'expired' | 'cancelled';

export interface ChallengeStatusInfo {
  status: ChallengeStatus;
  canContribute: boolean;
  canWithdraw: boolean;
  canFinalize: boolean;
  statusMessage: string;
}

// Mock data interfaces for development
export interface MockChallengeData {
  challenges: SavingsChallenge[];
  contributions: SavingsContribution[];
  participants: ParticipantProgress[];
  stats: SavingsStats;
}

// Blockchain event types
export interface ChallengeCreatedEvent {
  challengeId: string;
  creator: string;
  goalAmount: number;
  participants: string[];
  blockNumber: number;
  transactionHash: string;
}

export interface ContributionMadeEvent {
  challengeId: string;
  contributor: string;
  amount: number;
  newTotal: number;
  blockNumber: number;
  transactionHash: string;
}

export interface ChallengeCompletedEvent {
  challengeId: string;
  finalAmount: number;
  completionDate: Date;
  rewardsDistributed: SaveCoinReward[];
  blockNumber: number;
  transactionHash: string;
}

// Hook return types
export interface UseChallengesResult {
  challenges: SavingsChallenge[];
  isLoading: boolean;
  error: SavingsError | null;
  refetch: () => void;
  hasMore: boolean;
  loadMore: () => void;
}

export interface UseStatsResult {
  stats: SavingsStats | null;
  isLoading: boolean;
  error: SavingsError | null;
  refetch: () => void;
}

export interface UseProgressResult {
  progress: ChallengeProgress | null;
  isLoading: boolean;
  error: SavingsError | null;
  refetch: () => void;
}

// Stellar-specific types
export interface StellarAccountInfo {
  accountId: string;
  balance: string;
  sequence: string;
  subentryCount: number;
}

export interface StellarTransactionResult {
  hash: string;
  ledger: number;
  envelope_xdr: string;
  result_xdr: string;
  successful: boolean;
}