// src/components/Savings/ContributionModal.tsx
// Modal for Making Contributions to Savings Challenges

import React, { useState, useEffect } from 'react';
import { SavingsChallenge } from '../../types/savings';
import { useSavingsStore } from '../../store/useSavingsStore';
import { useContributeToChallenge } from '../../query/useSavingsChallenge';
import { SavingsProgress } from './ProgressBar';

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: SavingsChallenge | null;
  userAddress: string;
}

const ContributionModal: React.FC<ContributionModalProps> = ({
  isOpen,
  onClose,
  challenge,
  userAddress,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { isContributing } = useSavingsStore();
  const contributeMutation = useContributeToChallenge();

  // Reset form when modal opens/closes or challenge changes
  useEffect(() => {
    if (isOpen && challenge) {
      setAmount(challenge.weeklyAmount.toString());
      setCustomAmount('');
      setUseCustomAmount(false);
      setErrors({});
    }
  }, [isOpen, challenge]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !challenge) {
    return null;
  }

  const formatXLM = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
    }).format(value);
  };

  const parseAmount = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const contributionAmount = useCustomAmount ? parseAmount(customAmount) : parseAmount(amount);
  const newTotal = challenge.currentAmount + contributionAmount;
  const newProgress = (newTotal / challenge.goalAmount) * 100;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (contributionAmount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (contributionAmount < 0.0000001) { // Minimum XLM amount
      newErrors.amount = 'Amount too small (minimum 0.0000001 XLM)';
    } else if (contributionAmount > 10000) { // Reasonable maximum
      newErrors.amount = 'Amount too large (maximum 10,000 XLM)';
    }

    // Check if contribution would exceed goal by too much
    if (newTotal > challenge.goalAmount * 1.1) { // Allow 10% overage
      newErrors.amount = 'Contribution would significantly exceed goal';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await contributeMutation.mutateAsync({
        challengeId: challenge.id,
        amount: contributionAmount,
        userAddress,
      });
      
      onClose();
    } catch (error) {
      console.error('Contribution failed:', error);
      setErrors({ submit: 'Failed to process contribution. Please try again.' });
    }
  };

  const quickAmountButtons = [
    { label: 'Weekly', value: challenge.weeklyAmount, emoji: '📅' },
    { label: 'Double', value: challenge.weeklyAmount * 2, emoji: '2️⃣' },
    { label: 'Monthly', value: challenge.weeklyAmount * 4, emoji: '📆' },
  ];

  const getDaysLeft = (): number => {
    const now = new Date();
    const diffTime = challenge.deadline.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Contribute to Challenge
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mt-2">
              <h4 className="font-medium text-gray-900">{challenge.name}</h4>
              <p className="text-sm text-gray-600">
                {formatXLM(challenge.currentAmount)} / {formatXLM(challenge.goalAmount)} XLM saved
              </p>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* Current Progress */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="mb-3">
                <SavingsProgress
                  currentAmount={challenge.currentAmount}
                  goalAmount={challenge.goalAmount}
                  showAmounts={false}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-gray-500">Current</p>
                  <p className="font-medium">{formatXLM(challenge.currentAmount)} XLM</p>
                </div>
                <div>
                  <p className="text-gray-500">Goal</p>
                  <p className="font-medium">{formatXLM(challenge.goalAmount)} XLM</p>
                </div>
                <div>
                  <p className="text-gray-500">Days Left</p>
                  <p className="font-medium">{getDaysLeft()} days</p>
                </div>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Amounts
              </label>
              <div className="grid grid-cols-3 gap-2">
                {quickAmountButtons.map((button) => (
                  <button
                    key={button.label}
                    type="button"
                    onClick={() => {
                      setAmount(button.value.toString());
                      setUseCustomAmount(false);
                    }}
                    className={`p-3 text-sm rounded-lg border transition-colors ${
                      !useCustomAmount && parseAmount(amount) === button.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    <div className="text-lg mb-1">{button.emoji}</div>
                    <div className="font-medium">{button.label}</div>
                    <div className="text-xs text-gray-500">{formatXLM(button.value)} XLM</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="customAmount"
                checked={useCustomAmount}
                onChange={(e) => setUseCustomAmount(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="customAmount" className="ml-2 text-sm text-gray-700">
                Use custom amount
              </label>
            </div>

            {/* Custom Amount Input */}
            {useCustomAmount && (
              <div>
                <label htmlFor="customAmountInput" className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Amount (XLM)
                </label>
                <div className="relative">
                  <input
                    id="customAmountInput"
                    type="number"
                    step="0.0000001"
                    min="0.0000001"
                    max="10000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter amount in XLM"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.amount ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-sm">XLM</span>
                  </div>
                </div>
              </div>
            )}

            {/* Contribution Preview */}
            {contributionAmount > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Contribution Preview
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Your contribution:</span>
                    <span className="font-medium text-blue-900">{formatXLM(contributionAmount)} XLM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">New total:</span>
                    <span className="font-medium text-blue-900">{formatXLM(newTotal)} XLM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Progress:</span>
                    <span className="font-medium text-blue-900">{newProgress.toFixed(1)}%</span>
                  </div>
                  {newProgress >= 100 && (
                    <div className="mt-2 p-2 bg-green-100 rounded text-green-800 text-center">
                      🎉 This contribution will complete the challenge!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Messages */}
            {Object.entries(errors).map(([field, message]) => (
              <div key={field} className="text-red-600 text-sm bg-red-50 rounded-lg p-3">
                {message}
              </div>
            ))}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isContributing}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={contributionAmount <= 0 || isContributing || Object.keys(errors).length > 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {isContributing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Contributing...</span>
                  </>
                ) : (
                  <>
                    <span>💰</span>
                    <span>Contribute {contributionAmount > 0 ? formatXLM(contributionAmount) : ''} XLM</span>
                  </>
                )}
              </button>
            </div>

            {/* Help Text */}
            <div className="text-xs text-gray-500 text-center pt-2">
              💡 Tip: Regular contributions help build good saving habits and earn more SaveCoin rewards!
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContributionModal;