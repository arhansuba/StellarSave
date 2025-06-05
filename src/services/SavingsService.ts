// src/services/SavingsService.ts
// StellarSave Service for Smart Contract Interactions

import { 
  SavingsChallenge, 
  SavingsStats, 
  CreateChallengeRequest,
  ChallengeProgress,
  SavingsContribution,
  SavingsError,
  SavingsErrorType,
  ContractCallOptions,
  ContractCallResult,
  ParticipantProgress,
  ChallengeStatusInfo,
  ChallengeStatus
} from '../types/savings';

// Assuming SorobanService exists from the SEP wallet
interface SorobanService {
  invokeContract(options: ContractCallOptions): Promise<ContractCallResult>;
  getAccountInfo(address: string): Promise<unknown>; // Changed any to unknown
  submitTransaction(transaction: unknown): Promise<unknown>; // Changed any to unknown
}

export class SavingsService {
  private sorobanService: SorobanService;
  private savingsContractId: string;
  private rewardTokenContractId: string;
  private isDevelopment: boolean;

  constructor(sorobanService: SorobanService) {
    this.sorobanService = sorobanService;
    this.savingsContractId = import.meta.env.VITE_SAVINGS_CONTRACT_ID || '';
    this.rewardTokenContractId = import.meta.env.VITE_REWARD_TOKEN_CONTRACT_ID || '';
    this.isDevelopment = import.meta.env.DEV || !this.savingsContractId;
    
    if (this.isDevelopment) {
      console.warn('SavingsService running in development mode with mock data');
    }
  }

  // ===== CHALLENGE MANAGEMENT =====

  /**
   * Create a new savings challenge
   */
  async createChallenge(
    request: CreateChallengeRequest,
    creatorAddress: string
  ): Promise<{ challengeId: string; transactionHash: string }> {
    try {
      this.validateCreateChallengeRequest(request);

      if (this.isDevelopment) {
        return this.mockCreateChallenge();
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.savingsContractId,
        method: 'create_challenge',
        args: [
          creatorAddress,
          request.name,
          this.xlmToStroops(request.goalAmount),
          this.xlmToStroops(request.weeklyAmount),
          request.participantAddresses,
        ],
      });

      return {
        challengeId: String(result.result),
        transactionHash: result.transactionHash || '',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to create challenge');
    }
  }

  /**
   * Make a contribution to a savings challenge
   */
  async contributeToChallenge(
    challengeId: string,
    amount: number,
    contributorAddress: string
  ): Promise<{ transactionHash: string }> {
    try {
      this.validateContribution(challengeId, amount, contributorAddress);

      if (this.isDevelopment) {
        return this.mockContributeToChallenge(challengeId);
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.savingsContractId,
        method: 'contribute',
        args: [
          parseInt(challengeId),
          contributorAddress,
          this.xlmToStroops(amount),
        ],
      });

      return {
        transactionHash: result.transactionHash || '',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to contribute to challenge');
    }
  }

  /**
   * Get challenge details by ID
   */
  async getChallenge(challengeId: string): Promise<SavingsChallenge> {
    try {
      if (this.isDevelopment) {
        return this.mockGetChallenge(challengeId);
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.savingsContractId,
        method: 'get_challenge',
        args: [parseInt(challengeId)],
        simulate: true,
      });

      return this.parseChallenge(result.result);
    } catch (error) {
      throw this.handleError(error, 'Failed to get challenge');
    }
  }

  /**
   * Get all challenges for a user
   */
  async getUserChallenges(userAddress: string): Promise<SavingsChallenge[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockChallenges(userAddress);
      }

      // In production, this would query the blockchain for user's challenges
      // For now, returning mock data for demo purposes
      return this.getMockChallenges(userAddress);
    } catch (error) {
      throw this.handleError(error, 'Failed to get user challenges');
    }
  }

  /**
   * Finalize a completed challenge
   */
  async finalizeChallenge(challengeId: string): Promise<{ transactionHash: string }> {
    try {
      if (this.isDevelopment) {
        return { transactionHash: `mock_finalize_${challengeId}_${Date.now()}` };
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.savingsContractId,
        method: 'finalize_challenge',
        args: [parseInt(challengeId)],
      });

      return {
        transactionHash: result.transactionHash || '',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to finalize challenge');
    }
  }

  // ===== STATISTICS AND PROGRESS =====

  /**
   * Get user's savings statistics
   */
  async getUserStats(userAddress: string): Promise<SavingsStats> {
    try {
      const challenges = await this.getUserChallenges(userAddress);
      const saveCoinBalance = await this.getSaveCoinBalance(userAddress);
      const contributions = await this.getUserContributions(userAddress);
      
      const totalSaved = challenges.reduce((sum, c) => sum + c.currentAmount, 0);
      const activeChallenges = challenges.filter(c => c.isActive).length;
      const completedChallenges = challenges.filter(c => c.isCompleted).length;
      
      const stats: SavingsStats = {
        totalSaved,
        activeChallenges,
        completedChallenges,
        saveCoinBalance,
        currentStreak: this.calculateCurrentStreak(contributions),
        longestStreak: this.calculateLongestStreak(contributions),
        totalContributions: contributions.length,
        averageWeeklyContribution: this.calculateAverageWeeklyContribution(contributions),
      };

      return stats;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user stats');
    }
  }

  /**
   * Calculate challenge progress
   */
  async getChallengeProgress(challengeId: string): Promise<ChallengeProgress> {
    try {
      const challenge = await this.getChallenge(challengeId);
      
      const now = new Date();
      const progressPercentage = Math.min((challenge.currentAmount / challenge.goalAmount) * 100, 100);
      const remainingAmount = Math.max(challenge.goalAmount - challenge.currentAmount, 0);
      const daysLeft = Math.max(Math.ceil((challenge.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)), 0);
      
      const totalDuration = challenge.deadline.getTime() - challenge.createdAt.getTime();
      const elapsed = now.getTime() - challenge.createdAt.getTime();
      const weeksPassed = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000));
      const totalWeeks = Math.ceil(totalDuration / (7 * 24 * 60 * 60 * 1000));
      
      const expectedAmount = Math.min(weeksPassed * challenge.weeklyAmount, challenge.goalAmount);
      const onTrack = challenge.currentAmount >= expectedAmount * 0.85; // 85% tolerance

      return {
        challengeId,
        progressPercentage,
        remainingAmount,
        daysLeft,
        weeksPassed: Math.max(weeksPassed, 0),
        totalWeeks,
        onTrack,
        expectedAmount,
        weeklyTarget: challenge.weeklyAmount,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get challenge progress');
    }
  }

  /**
   * Get participant progress for a challenge
   */
  async getParticipantProgress(challengeId: string): Promise<ParticipantProgress[]> {
    try {
      const challenge = await this.getChallenge(challengeId);
      const contributions = await this.getChallengeContributions(challengeId);
      
      return challenge.participants.map(address => {
        const userContributions = contributions.filter(c => c.contributor === address);
        const totalContributed = userContributions.reduce((sum, c) => sum + c.amount, 0);
        const progressPercentage = (totalContributed / challenge.goalAmount) * 100;
        
        return {
          address,
          totalContributed,
          weeklyAverage: this.calculateWeeklyAverage(userContributions),
          contributionStreak: this.calculateUserStreak(userContributions),
          lastContribution: userContributions.length > 0 ? userContributions[userContributions.length - 1].timestamp : undefined,
          isOnTrack: progressPercentage >= 80,
          progressPercentage: Math.min(progressPercentage, 100),
        };
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to get participant progress');
    }
  }

  // ===== SAVECOIN TOKEN OPERATIONS =====

  /**
   * Get SaveCoin token balance
   */
  async getSaveCoinBalance(userAddress: string): Promise<number> {
    try {
      if (this.isDevelopment) {
        return Math.floor(Math.random() * 500) + 100; // Mock balance 100-600
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.rewardTokenContractId,
        method: 'balance',
        args: [userAddress],
        simulate: true,
      });

      return this.stroopsToXlm(Number(result.result) || 0);
    } catch (error) {
      console.warn('Failed to get SaveCoin balance:', error);
      return 0;
    }
  }

  /**
   * Transfer SaveCoin tokens
   */
  async transferSaveCoins(
    fromAddress: string,
    toAddress: string,
    amount: number
  ): Promise<{ transactionHash: string }> {
    try {
      if (this.isDevelopment) {
        return { transactionHash: `mock_transfer_${Date.now()}` };
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.rewardTokenContractId,
        method: 'transfer',
        args: [fromAddress, toAddress, this.xlmToStroops(amount)],
      });

      return {
        transactionHash: result.transactionHash || '',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to transfer SaveCoins');
    }
  }

  // ===== CONTRIBUTION HISTORY =====

  /**
   * Get user's contribution history
   */
  async getUserContributions(userAddress: string): Promise<SavingsContribution[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockContributions(userAddress);
      }

      // In production, query blockchain events
      return this.getMockContributions(userAddress);
    } catch (error) {
      throw this.handleError(error, 'Failed to get user contributions');
    }
  }

  /**
   * Get contributions for a specific challenge
   */
  async getChallengeContributions(challengeId: string): Promise<SavingsContribution[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockChallengeContributions(challengeId);
      }

      // In production, query blockchain events for this challenge
      return this.getMockChallengeContributions(challengeId);
    } catch (error) {
      throw this.handleError(error, 'Failed to get challenge contributions');
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get challenge status information
   */
  getChallengeStatus(challenge: SavingsChallenge): ChallengeStatusInfo {
    const now = new Date();
    const isExpired = now > challenge.deadline;
    const isCompleted = challenge.currentAmount >= challenge.goalAmount;
    
    let status: ChallengeStatus;
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
  }

  /**
   * Convert XLM to stroops (Stellar's smallest unit)
   */
  private xlmToStroops(xlm: number): number {
    return Math.round(xlm * 10000000);
  }

  /**
   * Convert stroops to XLM
   */
  private stroopsToXlm(stroops: number): number {
    return stroops / 10000000;
  }

  /**
   * Parse contract result into SavingsChallenge
   */
  private parseChallenge(contractResult: unknown): SavingsChallenge {
    // Assert contractResult to a more specific type if known, or use Record<string, unknown>
    const result = contractResult as Record<string, unknown>;

    return {
      id: String(result.id), // Cast to string
      name: String(result.name), // Cast to string
      description: result.description ? String(result.description) : '', // Cast to string
      goalAmount: this.stroopsToXlm(Number(result.goal_amount)), // Cast to number
      weeklyAmount: this.stroopsToXlm(Number(result.weekly_amount)), // Cast to number
      currentAmount: this.stroopsToXlm(Number(result.current_amount || 0)), // Cast to number
      participants: (result.participants as string[]) || [], // Assert as string array
      creator: String(result.creator), // Cast to string
      createdAt: new Date(Number(result.created_at) * 1000), // Cast to number
      deadline: new Date(Number(result.deadline) * 1000), // Cast to number
      isActive: Boolean(result.is_active), // Cast to boolean
      isCompleted: Number(result.current_amount) >= Number(result.goal_amount), // Cast to number for comparison
      contractAddress: this.savingsContractId,
    };
  }

  // ===== VALIDATION METHODS =====

  private validateCreateChallengeRequest(request: CreateChallengeRequest): void {
    if (!request.name || request.name.trim().length < 3) {
      throw this.createError('VALIDATION_ERROR', 'Challenge name must be at least 3 characters');
    }
    
    if (request.goalAmount <= 0) {
      throw this.createError('VALIDATION_ERROR', 'Goal amount must be positive');
    }
    
    if (request.weeklyAmount <= 0) {
      throw this.createError('VALIDATION_ERROR', 'Weekly amount must be positive');
    }
    
    if (request.weeklyAmount > request.goalAmount) {
      throw this.createError('VALIDATION_ERROR', 'Weekly amount cannot exceed goal amount');
    }
    
    if (request.durationWeeks < 1 || request.durationWeeks > 104) {
      throw this.createError('VALIDATION_ERROR', 'Duration must be between 1 and 104 weeks');
    }
    
    if (!request.participantAddresses || request.participantAddresses.length === 0) {
      throw this.createError('VALIDATION_ERROR', 'At least one participant required');
    }
  }

  private validateContribution(challengeId: string, amount: number, contributorAddress: string): void {
    if (!challengeId) {
      throw this.createError('VALIDATION_ERROR', 'Challenge ID is required');
    }
    
    if (amount <= 0) {
      throw this.createError('VALIDATION_ERROR', 'Contribution amount must be positive');
    }
    
    if (!contributorAddress) {
      throw this.createError('VALIDATION_ERROR', 'Contributor address is required');
    }
  }

  // ===== ERROR HANDLING =====

  private handleError(error: unknown, message: string): SavingsError {
    console.error(`SavingsService Error: ${message}`, error);
    
    let errorType: SavingsErrorType = 'CONTRACT_ERROR';
    let errorMessage = message;
    
    // Check if error is an object and has a message property
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const errMessage = (error as { message: string }).message;
      if (errMessage?.includes('insufficient')) {
        errorType = 'INSUFFICIENT_BALANCE';
        errorMessage = 'Insufficient balance for this transaction';
      } else if (errMessage?.includes('not found')) {
        errorType = 'CHALLENGE_NOT_FOUND';
        errorMessage = 'Challenge not found';
      } else if (errMessage?.includes('not participant')) {
        errorType = 'NOT_PARTICIPANT';
        errorMessage = 'You are not a participant in this challenge';
      } else if (errMessage?.includes('inactive')) {
        errorType = 'CHALLENGE_INACTIVE';
        errorMessage = 'Challenge is no longer active';
      }
    }
    
    return this.createError(errorType, errorMessage, error);
  }

  private createError(type: SavingsErrorType, message: string, details?: unknown): SavingsError {
    return {
      type,
      message,
      details,
    };
  }

  // ===== CALCULATION HELPERS =====

  private calculateCurrentStreak(contributions: SavingsContribution[]): number {
    if (contributions.length === 0) return 0;
    
    // Sort by date descending
    const sorted = contributions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    let streak = 0;
    let lastWeek = this.getWeekNumber(sorted[0].timestamp);
    
    for (const contribution of sorted) {
      const week = this.getWeekNumber(contribution.timestamp);
      if (week === lastWeek || week === lastWeek - 1) {
        streak++;
        lastWeek = week;
      } else {
        break;
      }
    }
    
    return streak;
  }

  private calculateLongestStreak(contributions: SavingsContribution[]): number {
    if (contributions.length === 0) return 0;
    
    // For simplicity, return current streak + some random variation
    const current = this.calculateCurrentStreak(contributions);
    return current + Math.floor(Math.random() * 5);
  }

  private calculateAverageWeeklyContribution(contributions: SavingsContribution[]): number {
    if (contributions.length === 0) return 0;
    
    const total = contributions.reduce((sum, c) => sum + c.amount, 0);
    const weeks = Math.max(1, contributions.length / 2); // Rough estimate
    
    return total / weeks;
  }

  private calculateWeeklyAverage(contributions: SavingsContribution[]): number {
    if (contributions.length === 0) return 0;
    
    const total = contributions.reduce((sum, c) => sum + c.amount, 0);
    const firstDate = contributions[0]?.timestamp;
    const lastDate = contributions[contributions.length - 1]?.timestamp;
    
    if (!firstDate || !lastDate) return 0;
    
    const weeksDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return total / weeksDiff;
  }

  private calculateUserStreak(contributions: SavingsContribution[]): number {
    return Math.floor(contributions.length / 2) + 1; // Simplified calculation
  }

  private getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  }

  // ===== MOCK DATA FOR DEVELOPMENT =====

  private mockCreateChallenge(/* _request: CreateChallengeRequest, _creatorAddress: string */): Promise<{ challengeId: string; transactionHash: string }> {
    const challengeId = `mock_${Date.now()}`;
    const transactionHash = `tx_${challengeId}`;
    
    return Promise.resolve({ challengeId, transactionHash });
  }

  private mockContributeToChallenge(challengeId: string): Promise<{ transactionHash: string }> {
    const transactionHash = `contrib_${challengeId}_${Date.now()}`;
    return Promise.resolve({ transactionHash });
  }

  private mockGetChallenge(challengeId: string): Promise<SavingsChallenge> {
    const challenges = this.getMockChallenges('GXXXXXXX...EXAMPLE');
    const challenge = challenges.find(c => c.id === challengeId);
    
    if (!challenge) {
      throw this.createError('CHALLENGE_NOT_FOUND', 'Challenge not found');
    }
    
    return Promise.resolve(challenge);
  }

  private getMockChallenges(userAddress: string): SavingsChallenge[] {
    return [
      {
        id: '1',
        name: 'Summer Vacation Fund',
        description: 'Saving for a group trip to Hawaii with college friends',
        goalAmount: 1000,
        weeklyAmount: 50,
        currentAmount: 450,
        participants: [userAddress, 'GXXXXXXX...EXAMPLE1', 'GYYYYYY...EXAMPLE2'],
        creator: userAddress,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        isActive: true,
        isCompleted: false,
      },
      {
        id: '2',
        name: 'Emergency Fund Challenge',
        description: 'Building emergency savings together for financial security',
        goalAmount: 2500,
        weeklyAmount: 75,
        currentAmount: 1200,
        participants: [userAddress, 'GAAAAAAA...EXAMPLE3', 'GBBBBBB...EXAMPLE4', 'GCCCCCC...EXAMPLE5'],
        creator: 'GAAAAAAA...EXAMPLE3',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
        isActive: true,
        isCompleted: false,
      },
      {
        id: '3',
        name: 'New Car Fund',
        description: 'Saving for reliable transportation',
        goalAmount: 5000,
        weeklyAmount: 100,
        currentAmount: 5000,
        participants: [userAddress, 'GDDDDDDD...EXAMPLE6'],
        creator: userAddress,
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        isActive: false,
        isCompleted: true,
      },
    ];
  }

  private getMockContributions(userAddress: string): SavingsContribution[] {
    return [
      {
        challengeId: '1',
        contributor: userAddress,
        amount: 50,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        transactionHash: 'tx_contrib_1',
        weekNumber: 1,
      },
      {
        challengeId: '1',
        contributor: userAddress,
        amount: 50,
        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        transactionHash: 'tx_contrib_2',
        weekNumber: 2,
      },
      {
        challengeId: '2',
        contributor: userAddress,
        amount: 75,
        timestamp: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        transactionHash: 'tx_contrib_3',
        weekNumber: 1,
      },
    ];
  }

  private getMockChallengeContributions(challengeId: string): SavingsContribution[] {
    const allContributions = [
      {
        challengeId: '1',
        contributor: 'GXXXXXXX...EXAMPLE',
        amount: 50,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        transactionHash: 'tx_1',
        weekNumber: 1,
      },
      {
        challengeId: '1',
        contributor: 'GXXXXXXX...EXAMPLE1',
        amount: 50,
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        transactionHash: 'tx_2',
        weekNumber: 1,
      },
    ];
    
    return allContributions.filter(c => c.challengeId === challengeId);
  }
}