import useStellar from '@/hooks/useStellar';
import React, { useState, FormEvent, ChangeEvent } from 'react';



interface Challenge {
  id: string;
  name?: string;
  description?: string;
  targetAmount: number;
  currentAmount?: number;
  weeklyAmount?: number;
  durationDays: number;
  rewardPercentage: number;
  active: boolean;
  participants: string[];
  isParticipant: boolean;
  creator?: string;
}

interface ChallengeCardProps {
  challenge: Challenge;
  onJoin?: (challengeId: string) => Promise<void>;
  onDeposit?: (challengeId: string, amount: string) => Promise<void>;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onJoin, onDeposit }) => {
  const [depositAmount, setDepositAmount] = useState<string>('');
  const { isLoading, makeContribution, joinChallenge } = useStellar();
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Format duration in days to a human-readable format
  const formatDuration = (days: number): string => {
    if (days < 30) {
      return `${days} days`;
    } else if (days < 365) {
      const months = Math.floor(days / 30);
      return `${months} ${months === 1 ? 'month' : 'months'}`;
    } else {
      const years = Math.floor(days / 365);
      return `${years} ${years === 1 ? 'year' : 'years'}`;
    }
  };
  
  // Format reward percentage
  const formatReward = (percentage: number): string => {
    // Percentage is stored in basis points (1/100 of a percent)
    return `${percentage / 100}%`;
  };

  // Calculate progress percentage
  const calculateProgress = (): number => {
    if (!challenge.currentAmount || !challenge.targetAmount) return 0;
    const progress = (challenge.currentAmount / challenge.targetAmount) * 100;
    return Math.min(Math.round(progress), 100);
  };

  const handleJoin = async (): Promise<void> => {
    setIsJoining(true);
    setError(null);
    
    try {
      if (onJoin) {
        await onJoin(challenge.id);
      } else {
        // Use the service directly if no handler provided
        await joinChallenge(challenge.id);
      }
      // Successfully joined
      window.location.reload(); // Refresh to update state
    } catch (err) {
      console.error('Error joining challenge:', err);
      setError('Failed to join the challenge. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };
  
  const handleDeposit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsDepositing(true);
    setError(null);
    
    try {
      if (onDeposit && depositAmount) {
        await onDeposit(challenge.id, depositAmount);
      } else if (depositAmount) {
        // Use the service directly if no handler provided
        await makeContribution({
          challengeId: challenge.id,
          amount: parseFloat(depositAmount)
        });
      }
      
      // Reset form after successful deposit
      setDepositAmount('');
      
      // Show success message or update UI
      alert('Deposit successful!');
    } catch (err) {
      console.error('Error making deposit:', err);
      setError('Failed to make the deposit. Please try again.');
    } finally {
      setIsDepositing(false);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-4">
      <h2 className="text-xl font-bold mb-2">
        {challenge.name || 'Savings Challenge'}
      </h2>
      
      {challenge.description && (
        <p className="text-gray-600 mb-4">{challenge.description}</p>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-gray-600">Progress:</span>
          <span className="text-gray-600 font-medium">
            {challenge.currentAmount || 0} / {challenge.targetAmount} XLM ({calculateProgress()}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${calculateProgress()}%` }}
          ></div>
        </div>
      </div>
      
      <div className="mb-4">
        <p className="text-gray-600">Target: {challenge.targetAmount} XLM</p>
        {challenge.weeklyAmount && (
          <p className="text-gray-600">Weekly Target: {challenge.weeklyAmount} XLM</p>
        )}
        <p className="text-gray-600">Duration: {formatDuration(challenge.durationDays)}</p>
        <p className="text-gray-600">Reward: {formatReward(challenge.rewardPercentage)}</p>
        <p className="text-gray-600">
          Status: 
          <span className={challenge.active ? 'text-green-500' : 'text-red-500'}>
            {challenge.active ? ' Active' : ' Closed'}
          </span>
        </p>
        <p className="text-gray-600">
          Participants: {challenge.participants.length}
        </p>
      </div>
      
      {challenge.active && (
        <div>
          {challenge.isParticipant ? (
            <form onSubmit={handleDeposit} className="mb-2">
              <div className="flex items-center">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDepositAmount(e.target.value)}
                  placeholder="Amount to deposit"
                  className="border rounded px-3 py-2 mr-2 flex-grow"
                  min="0"
                  step="0.0000001"
                  required
                  disabled={isLoading || isDepositing}
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300"
                  disabled={isLoading || isDepositing}
                >
                  {isDepositing ? 'Processing...' : 'Deposit'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={handleJoin}
              className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:bg-green-300 w-full"
              disabled={isLoading || isJoining}
            >
              {isJoining ? 'Processing...' : 'Join Challenge'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChallengeCard;
