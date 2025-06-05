import { useState } from 'react';
import stellarService from '../services/stellarService';

// Define the challenge creation params interface
interface ChallengeCreationParams {
  creator: string;
  name?: string;
  goalAmount: number;
  weeklyAmount: number;
  durationWeeks?: number;
  participants?: string[];
  rewardPercentage?: number;
  vaultAddress?: string | null;
  rewardToken?: string | null;
}

// Define the contribution params interface
interface ContributionParams {
  challengeId: string;
  amount: number;
  contributor?: string;
}

// Interface for the hook return value
interface UseStellarReturn {
  isLoading: boolean;
  error: string | null;
  connectWallet: () => Promise<string>;
  createSavingsChallenge: (params: ChallengeCreationParams) => Promise<{ challengeId: string; transactionHash: string }>;
  joinChallenge: (challengeId: string) => Promise<boolean>;
  makeContribution: (params: ContributionParams) => Promise<{ transactionHash: string }>;
  completeChallenge: (challengeId: string) => Promise<boolean>;
}

const useStellar = (): UseStellarReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Connect to the wallet and retrieve the public key
   */
  const connectWallet = async (): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      const publicKey = await stellarService.connectWallet();
      return publicKey;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create a new savings challenge
   */
  const createSavingsChallenge = async (params: ChallengeCreationParams): Promise<{ challengeId: string; transactionHash: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await stellarService.createChallenge(params);
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create savings challenge';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Join an existing challenge
   */
  const joinChallenge = async (challengeId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const publicKey = await stellarService.connectWallet();
      const result = await stellarService.joinChallenge(publicKey, challengeId);
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join challenge';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Make a contribution to a challenge
   */
  const makeContribution = async (params: ContributionParams): Promise<{ transactionHash: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      let contributor = params.contributor;
      if (!contributor) {
        contributor = await stellarService.connectWallet();
      }
      
      const result = await stellarService.makeContribution({
        challengeId: params.challengeId,
        contributor,
        amount: params.amount
      });
      
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make contribution';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Complete a challenge
   */
  const completeChallenge = async (challengeId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const publicKey = await stellarService.connectWallet();
      const result = await stellarService.completeChallenge(publicKey, challengeId);
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete challenge';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    connectWallet,
    createSavingsChallenge,
    joinChallenge,
    makeContribution,
    completeChallenge
  };
};

export default useStellar;
