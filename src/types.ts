export interface ContributionParams {
  challengeId: string;
  contributor: string;
  amount: number;
}

export interface ChallengeCreationParams {
  creator: string;
  name?: string;
  goalAmount: number;
  weeklyAmount: number;
  durationWeeks?: number;
  participants?: string[];
  rewardPercentage?: number;
  vaultAddress?: string | null;
  rewardToken?: string | null;
  minWeeklyDeposit?: number;
  challengeType?: string;
  socialFeatures?: Record<string, unknown>;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  goalAmount: number;
  weeklyAmount: number;
  currentAmount: number;
  participants: string[];
  creator: string;
  createdAt: Date;
  deadline: Date;
  isActive: boolean;
  isCompleted: boolean;
}

export interface UserProgress {
  challengeId: string;
  user: string;
  currentAmount: number;
  lastDepositTime: number;
  streakWeeks: number;
  deposits: DepositRecord[];
  completed: boolean;
}

export interface DepositRecord {
  amount: number;
  timestamp: number;
  weekNumber: number;
}

export interface Milestone {
  description: string;
  targetAmount: number;
  reached: boolean;
  reachedAt: number;
  rewardBonus: number;
}

export interface ContributionRecord {
  contributor: string;
  amount: number;
  timestamp: number;
}
