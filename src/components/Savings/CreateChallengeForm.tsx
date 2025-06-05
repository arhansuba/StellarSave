// src/components/Savings/CreateChallengeForm.tsx
// Form Component for Creating New Savings Challenges

import React, { useState } from 'react';
import { CreateChallengeRequest } from '../../types/savings';
import { useCreateChallenge } from '../../query/useSavingsChallenge';
import { useSavingsStore } from '../../store/useSavingsStore';
import { StepProgress } from './ProgressBar';

interface CreateChallengeFormProps {
  userAddress: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface FormData {
  name: string;
  description: string;
  goalAmount: string;
  weeklyAmount: string;
  durationWeeks: string;
  participantAddresses: string[];
  requireMinWeekly: boolean;
  allowEarlyWithdrawal: boolean;
}

const CreateChallengeForm: React.FC<CreateChallengeFormProps> = ({
  userAddress,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    goalAmount: '',
    weeklyAmount: '',
    durationWeeks: '12',
    participantAddresses: [userAddress],
    requireMinWeekly: true,
    allowEarlyWithdrawal: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [participantInput, setParticipantInput] = useState('');

  const { isCreatingChallenge } = useSavingsStore();
  const createMutation = useCreateChallenge();

  const steps = [
    'Basic Info',
    'Financial Details',
    'Participants',
    'Settings & Review'
  ];

  const formatXLM = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const parseAmount = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic Info
        if (!formData.name.trim()) {
          newErrors.name = 'Challenge name is required';
        } else if (formData.name.length < 3) {
          newErrors.name = 'Name must be at least 3 characters';
        } else if (formData.name.length > 50) {
          newErrors.name = 'Name must be less than 50 characters';
        }

        if (formData.description.length > 200) {
          newErrors.description = 'Description must be less than 200 characters';
        }
        break;

      case 2: { // Financial Details - Add block scope with curly braces
        const goalAmount = parseAmount(formData.goalAmount);
        const weeklyAmount = parseAmount(formData.weeklyAmount);
        const duration = parseInt(formData.durationWeeks);

        if (goalAmount <= 0) {
          newErrors.goalAmount = 'Goal amount must be greater than 0';
        } else if (goalAmount > 100000) {
          newErrors.goalAmount = 'Goal amount too large (max 100,000 XLM)';
        }

        if (weeklyAmount <= 0) {
          newErrors.weeklyAmount = 'Weekly amount must be greater than 0';
        } else if (weeklyAmount > goalAmount) {
          newErrors.weeklyAmount = 'Weekly amount cannot exceed goal amount';
        }

        if (duration < 1 || duration > 104) {
          newErrors.durationWeeks = 'Duration must be between 1 and 104 weeks';
        }

        // Check if weekly amount makes sense for the duration
        const totalWeeklyContributions = weeklyAmount * duration * formData.participantAddresses.length;
        if (totalWeeklyContributions < goalAmount * 0.5) {
          newErrors.weeklyAmount = 'Weekly amount seems too low to reach the goal';
        }
        break;
      }

      case 3: // Participants
        if (formData.participantAddresses.length < 1) {
          newErrors.participants = 'At least one participant is required';
        } else if (formData.participantAddresses.length > 20) {
          newErrors.participants = 'Maximum 20 participants allowed';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
    setErrors({});
  };

  const addParticipant = () => {
    const address = participantInput.trim();
    if (!address) return;

    // Basic Stellar address validation
    if (!address.startsWith('G') || address.length !== 56) {
      setErrors({ participant: 'Invalid Stellar address format' });
      return;
    }

    if (formData.participantAddresses.includes(address)) {
      setErrors({ participant: 'Participant already added' });
      return;
    }

    setFormData(prev => ({
      ...prev,
      participantAddresses: [...prev.participantAddresses, address]
    }));
    setParticipantInput('');
    setErrors({});
  };

  const removeParticipant = (address: string) => {
    if (address === userAddress) return; // Can't remove creator

    setFormData(prev => ({
      ...prev,
      participantAddresses: prev.participantAddresses.filter(addr => addr !== address)
    }));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    const request: CreateChallengeRequest = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      goalAmount: parseAmount(formData.goalAmount),
      weeklyAmount: parseAmount(formData.weeklyAmount),
      durationWeeks: parseInt(formData.durationWeeks),
      participantAddresses: formData.participantAddresses,
      requireMinWeekly: formData.requireMinWeekly,
      allowEarlyWithdrawal: formData.allowEarlyWithdrawal,
    };

    try {
      await createMutation.mutateAsync({ request, userAddress });
      onSuccess?.();
    } catch {
      setErrors({ submit: 'Failed to create challenge. Please try again.' });
    }
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const goalAmount = parseAmount(formData.goalAmount);
  const weeklyAmount = parseAmount(formData.weeklyAmount);
  const duration = parseInt(formData.durationWeeks);
  const estimatedTotal = weeklyAmount * duration * formData.participantAddresses.length;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Create Savings Challenge
          </h3>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <StepProgress
          currentStep={currentStep}
          totalSteps={steps.length}
          stepLabels={steps}
        />
      </div>

      {/* Form Content */}
      <div className="px-6 py-6">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Challenge Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Summer Vacation Fund"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your savings goal and why it matters to you..."
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
              <p className="mt-1 text-xs text-gray-500">{formData.description.length}/200 characters</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips for Success</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Choose a specific, meaningful goal</li>
                <li>• Make it challenging but achievable</li>
                <li>• Include friends for accountability</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Financial Details */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="goalAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Amount (XLM) *
                </label>
                <input
                  id="goalAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.goalAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, goalAmount: e.target.value }))}
                  placeholder="1000.00"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.goalAmount ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.goalAmount && <p className="mt-1 text-sm text-red-600">{errors.goalAmount}</p>}
              </div>

              <div>
                <label htmlFor="weeklyAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Weekly Target per Person (XLM) *
                </label>
                <input
                  id="weeklyAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.weeklyAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, weeklyAmount: e.target.value }))}
                  placeholder="25.00"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.weeklyAmount ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.weeklyAmount && <p className="mt-1 text-sm text-red-600">{errors.weeklyAmount}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="durationWeeks" className="block text-sm font-medium text-gray-700 mb-1">
                Duration (weeks) *
              </label>
              <select
                id="durationWeeks"
                value={formData.durationWeeks}
                onChange={(e) => setFormData(prev => ({ ...prev, durationWeeks: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="4">1 Month (4 weeks)</option>
                <option value="8">2 Months (8 weeks)</option>
                <option value="12">3 Months (12 weeks)</option>
                <option value="16">4 Months (16 weeks)</option>
                <option value="20">5 Months (20 weeks)</option>
                <option value="24">6 Months (24 weeks)</option>
                <option value="52">1 Year (52 weeks)</option>
              </select>
            </div>

            {/* Financial Preview */}
            {goalAmount > 0 && weeklyAmount > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Financial Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total with {formData.participantAddresses.length} people:</span>
                    <span className="ml-1 font-medium">{formatXLM(estimatedTotal)} XLM</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Goal coverage:</span>
                    <span className={`ml-1 font-medium ${estimatedTotal >= goalAmount ? 'text-green-600' : 'text-red-600'}`}>
                      {((estimatedTotal / goalAmount) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Weekly per person:</span>
                    <span className="ml-1 font-medium">{formatXLM(weeklyAmount)} XLM</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total per person:</span>
                    <span className="ml-1 font-medium">{formatXLM(weeklyAmount * duration)} XLM</span>
                  </div>
                </div>
                
                {estimatedTotal < goalAmount && (
                  <div className="mt-3 p-2 bg-yellow-100 rounded text-yellow-800 text-sm">
                    ⚠️ Weekly contributions may not reach the goal. Consider increasing the weekly amount or duration.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Participants */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="participantInput" className="block text-sm font-medium text-gray-700 mb-1">
                Add Participants
              </label>
              <div className="flex space-x-2">
                <input
                  id="participantInput"
                  type="text"
                  value={participantInput}
                  onChange={(e) => setParticipantInput(e.target.value)}
                  placeholder="Enter Stellar address (G...)"
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.participant ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={addParticipant}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {errors.participant && <p className="mt-1 text-sm text-red-600">{errors.participant}</p>}
              {errors.participants && <p className="mt-1 text-sm text-red-600">{errors.participants}</p>}
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Participants ({formData.participantAddresses.length})
              </h4>
              <div className="space-y-2">
                {formData.participantAddresses.map((address) => (
                  <div
                    key={address}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        address === userAddress ? 'bg-blue-500' : 'bg-gray-500'
                      }`}>
                        {address === userAddress ? 'You' : address.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {address === userAddress ? 'You (Creator)' : truncateAddress(address)}
                        </p>
                        <p className="text-xs text-gray-500">{address}</p>
                      </div>
                    </div>
                    
                    {address !== userAddress && (
                      <button
                        type="button"
                        onClick={() => removeParticipant(address)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">👥 Participant Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Invite friends and family for better accountability</li>
                <li>• Make sure participants understand the commitment</li>
                <li>• Smaller groups (2-5 people) tend to be more successful</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 4: Settings & Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {/* Settings */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Challenge Settings</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requireMinWeekly}
                    onChange={(e) => setFormData(prev => ({ ...prev, requireMinWeekly: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Require minimum weekly contribution
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.allowEarlyWithdrawal}
                    onChange={(e) => setFormData(prev => ({ ...prev, allowEarlyWithdrawal: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Allow early withdrawal (with penalty)
                  </span>
                </label>
              </div>
            </div>

            {/* Review Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Challenge Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-1 font-medium">{formData.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Goal:</span>
                  <span className="ml-1 font-medium">{formatXLM(goalAmount)} XLM</span>
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <span className="ml-1 font-medium">{duration} weeks</span>
                </div>
                <div>
                  <span className="text-gray-600">Weekly per person:</span>
                  <span className="ml-1 font-medium">{formatXLM(weeklyAmount)} XLM</span>
                </div>
                <div>
                  <span className="text-gray-600">Participants:</span>
                  <span className="ml-1 font-medium">{formData.participantAddresses.length} people</span>
                </div>
                <div>
                  <span className="text-gray-600">Estimated total:</span>
                  <span className="ml-1 font-medium">{formatXLM(estimatedTotal)} XLM</span>
                </div>
              </div>
            </div>

            {/* Error Messages */}
            {errors.submit && (
              <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3">
                {errors.submit}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isCreatingChallenge}
              >
                Back
              </button>
            )}
          </div>

          <div className="flex space-x-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isCreatingChallenge}
              >
                Cancel
              </button>
            )}

            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isCreatingChallenge || Object.keys(errors).length > 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isCreatingChallenge ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Create Challenge</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateChallengeForm;