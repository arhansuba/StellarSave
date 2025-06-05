// src/components/Savings/ChallengeCard.tsx
// Individual Challenge Card Component for StellarSave

import React, { useState } from 'react';
import { SavingsChallenge } from '../../types/savings';
import { SavingsProgress, WeeklyProgress } from './ProgressBar';
import { useChallengeProgress } from '../../query/useSavingsChallenge';
import { useSavingsStore } from '../../store/useSavingsStore';

interface ChallengeCardProps {
  challenge: SavingsChallenge;
  userAddress: string;
  onContribute?: (challengeId: string) => void;
  onViewDetails?: (challenge: SavingsChallenge) => void;
  className?: string;
  compact?: boolean;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  userAddress,
  onContribute,
  onViewDetails,
  className = '',
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { openContributionModal } = useSavingsStore();
  
  // Get challenge progress
  const { data: progress } = useChallengeProgress(challenge.id);
  
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const formatXLM = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getDaysLeft = (): number => {
    const now = new Date();
    const diffTime = challenge.deadline.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getStatusInfo = () => {
    const now = new Date();
    const isExpired = now > challenge.deadline;
    const isCompleted = challenge.currentAmount >= challenge.goalAmount;
    const daysLeft = getDaysLeft();
    
    if (isCompleted) {
      return {
        status: 'completed' as const,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: '🎉',
        message: 'Goal achieved!',
      };
    } else if (isExpired) {
      return {
        status: 'expired' as const,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: '⏰',
        message: 'Challenge expired',
      };
    } else if (!challenge.isActive) {
      return {
        status: 'inactive' as const,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        icon: '⏸️',
        message: 'Challenge paused',
      };
    } else if (daysLeft <= 7) {
      return {
        status: 'urgent' as const,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        icon: '⚡',
        message: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`,
      };
    } else {
      return {
        status: 'active' as const,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        icon: '🎯',
        message: `${daysLeft} days left`,
      };
    }
  };

  const statusInfo = getStatusInfo();
  const isUserCreator = challenge.creator === userAddress;
  const canContribute = challenge.isActive && !challenge.isCompleted && getDaysLeft() > 0;

  const handleContribute = () => {
    if (onContribute) {
      onContribute(challenge.id);
    } else {
      openContributionModal(challenge.id);
    }
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (compact) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {challenge.name}
            </h4>
            <p className="text-xs text-gray-600">
              {formatXLM(challenge.currentAmount)} / {formatXLM(challenge.goalAmount)} XLM
            </p>
          </div>
          
          <div className="ml-4 flex items-center space-x-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
              {statusInfo.icon} {statusInfo.message}
            </span>
            
            {canContribute && (
              <button
                onClick={handleContribute}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium"
              >
                Add
              </button>
            )}
          </div>
        </div>
        
        <div className="mt-2">
          <SavingsProgress
            currentAmount={challenge.currentAmount}
            goalAmount={challenge.goalAmount}
            showAmounts={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-all duration-200 ${className}`}>
      {/* Card Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {challenge.name}
              </h3>
              {isUserCreator && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-blue-700 bg-blue-100">
                  Creator
                </span>
              )}
            </div>
            
            {challenge.description && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {challenge.description}
              </p>
            )}
          </div>
          
          <div className="ml-4 flex-shrink-0">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
              {statusInfo.icon} {statusInfo.message}
            </span>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-3">
          <SavingsProgress
            currentAmount={challenge.currentAmount}
            goalAmount={challenge.goalAmount}
            showAmounts={true}
          />
          
          {progress && (
            <WeeklyProgress
              weeksPassed={progress.weeksPassed}
              totalWeeks={progress.totalWeeks}
              isOnTrack={progress.onTrack}
            />
          )}
        </div>
      </div>

      {/* Expandable Details */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-3 text-left text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-between"
        >
          <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-6 pb-6 space-y-4">
            {/* Challenge Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Weekly Target</p>
                <p className="font-medium">{formatXLM(challenge.weeklyAmount)} XLM</p>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1">Participants</p>
                <p className="font-medium">{challenge.participants.length} people</p>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1">Started</p>
                <p className="font-medium">{formatDate(challenge.createdAt)}</p>
              </div>
              
              <div>
                <p className="text-gray-500 mb-1">Deadline</p>
                <p className="font-medium">{formatDate(challenge.deadline)}</p>
              </div>
            </div>

            {/* Participants List */}
            <div>
              <p className="text-gray-500 text-sm mb-2">Participants</p>
              <div className="flex flex-wrap gap-2">
                {challenge.participants.map((participant) => (
                  <div
                    key={participant}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      participant === userAddress
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {participant === userAddress ? 'You' : 
                     participant === challenge.creator ? `Creator (${truncateAddress(participant)})` :
                     truncateAddress(participant)}
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Details */}
            {progress && (
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Progress Details</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Expected by now:</span>
                    <span className="ml-1 font-medium">{formatXLM(progress.expectedAmount)} XLM</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Remaining:</span>
                    <span className="ml-1 font-medium">{formatXLM(progress.remainingAmount)} XLM</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Progress:</span>
                    <span className="ml-1 font-medium">{progress.progressPercentage.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className={`ml-1 font-medium ${progress.onTrack ? 'text-green-600' : 'text-yellow-600'}`}>
                      {progress.onTrack ? 'On track' : 'Behind schedule'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="border-t border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {canContribute && (
              <button
                onClick={handleContribute}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <span>💰</span>
                <span>Contribute</span>
              </button>
            )}
            
            {onViewDetails && (
              <button
                onClick={() => onViewDetails(challenge)}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-300 hover:border-gray-400"
              >
                View Details
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>💎</span>
            <span>{challenge.participants.length} saver{challenge.participants.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeCard;