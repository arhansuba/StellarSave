// src/components/Savings/ProgressBar.tsx
// Reusable Progress Bar Component for StellarSave

import React from 'react';

interface ProgressBarProps {
  /** Current progress value (0-100) */
  progress: number;
  /** Height of the progress bar in pixels */
  height?: number;
  /** Color scheme for the progress bar */
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** Whether to show the percentage text */
  showPercentage?: boolean;
  /** Custom label to display instead of percentage */
  label?: string;
  /** Whether to animate the progress */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height,
  variant = 'default',
  showPercentage = true,
  label,
  animated = true,
  className = '',
  size = 'md',
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Height based on size
  const heights = {
    sm: height || 6,
    md: height || 8,
    lg: height || 12,
  };
  
  const barHeight = heights[size];
  
  // Color schemes
  const colorSchemes = {
    default: {
      bg: 'bg-gray-200',
      fill: 'bg-blue-500',
      text: 'text-blue-700',
    },
    success: {
      bg: 'bg-gray-200',
      fill: 'bg-green-500',
      text: 'text-green-700',
    },
    warning: {
      bg: 'bg-gray-200',
      fill: 'bg-yellow-500',
      text: 'text-yellow-700',
    },
    danger: {
      bg: 'bg-gray-200',
      fill: 'bg-red-500',
      text: 'text-red-700',
    },
  };
  
  
  // Determine variant based on progress if not explicitly set
  const getAutoVariant = (prog: number): keyof typeof colorSchemes => {
    if (prog >= 100) return 'success';
    if (prog >= 75) return 'default';
    if (prog >= 50) return 'warning';
    return 'danger';
  };
  
  const finalVariant = variant === 'default' && progress > 0 ? getAutoVariant(clampedProgress) : variant;
  const finalColors = colorSchemes[finalVariant];
  
  return (
    <div className={`w-full ${className}`}>
      {/* Progress bar container */}
      <div 
        className={`relative overflow-hidden rounded-full ${finalColors.bg}`}
        style={{ height: barHeight }}
      >
        {/* Progress fill */}
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${finalColors.fill} ${
            animated ? 'transform-gpu' : ''
          }`}
          style={{ 
            width: `${clampedProgress}%`,
            transition: animated ? 'width 0.5s ease-out' : 'none'
          }}
        >
          {/* Shimmer effect for loading */}
          {animated && clampedProgress > 0 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-shimmer" />
          )}
        </div>
        
        {/* Percentage text overlay (for larger bars) */}
        {showPercentage && size === 'lg' && barHeight >= 20 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-white mix-blend-difference">
              {label || `${Math.round(clampedProgress)}%`}
            </span>
          </div>
        )}
      </div>
      
      {/* Percentage text below (for smaller bars or when requested) */}
      {showPercentage && (size !== 'lg' || barHeight < 20) && (
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs font-medium ${finalColors.text}`}>
            {label || `${Math.round(clampedProgress)}%`}
          </span>
          {clampedProgress >= 100 && (
            <span className="text-xs text-green-600 font-medium">
              ✓ Complete
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Specialized progress bars for common use cases

interface SavingsProgressProps {
  currentAmount: number;
  goalAmount: number;
  showAmounts?: boolean;
  className?: string;
}

export const SavingsProgress: React.FC<SavingsProgressProps> = ({
  currentAmount,
  goalAmount,
  showAmounts = true,
  className = '',
}) => {
  const progress = goalAmount > 0 ? (currentAmount / goalAmount) * 100 : 0;
  
  return (
    <div className={className}>
      <ProgressBar
        progress={progress}
        size="md"
        showPercentage={!showAmounts}
        animated={true}
      />
      {showAmounts && (
        <div className="flex justify-between items-center mt-1 text-xs text-gray-600">
          <span>{currentAmount.toFixed(2)} XLM</span>
          <span className="font-medium">
            {progress >= 100 ? '🎉 Goal Reached!' : `${goalAmount.toFixed(2)} XLM goal`}
          </span>
        </div>
      )}
    </div>
  );
};

interface WeeklyProgressProps {
  weeksPassed: number;
  totalWeeks: number;
  isOnTrack?: boolean;
  className?: string;
}

export const WeeklyProgress: React.FC<WeeklyProgressProps> = ({
  weeksPassed,
  totalWeeks,
  isOnTrack = true,
  className = '',
}) => {
  const progress = totalWeeks > 0 ? (weeksPassed / totalWeeks) * 100 : 0;
  const variant = isOnTrack ? 'default' : 'warning';
  
  return (
    <div className={className}>
      <ProgressBar
        progress={progress}
        variant={variant}
        size="sm"
        showPercentage={false}
        animated={true}
      />
      <div className="flex justify-between items-center mt-1 text-xs text-gray-600">
        <span>Week {weeksPassed} of {totalWeeks}</span>
        <span className={`font-medium ${isOnTrack ? 'text-green-600' : 'text-yellow-600'}`}>
          {isOnTrack ? '✓ On Track' : '⚠ Behind'}
        </span>
      </div>
    </div>
  );
};

interface StreakProgressProps {
  currentStreak: number;
  targetStreak?: number;
  className?: string;
}

export const StreakProgress: React.FC<StreakProgressProps> = ({
  currentStreak,
  targetStreak = 12,
  className = '',
}) => {
  const progress = targetStreak > 0 ? (currentStreak / targetStreak) * 100 : 0;
  
  return (
    <div className={className}>
      <ProgressBar
        progress={progress}
        variant="success"
        size="sm"
        label={`${currentStreak} week${currentStreak !== 1 ? 's' : ''}`}
        animated={true}
      />
      <div className="flex justify-between items-center mt-1 text-xs text-gray-600">
        <span>🔥 Saving Streak</span>
        <span className="font-medium text-green-600">
          {currentStreak >= targetStreak ? '🏆 Streak Master!' : `Target: ${targetStreak} weeks`}
        </span>
      </div>
    </div>
  );
};

// Multi-step progress indicator
interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  className?: string;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps,
  stepLabels = [],
  className = '',
}) => {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  
  return (
    <div className={className}>
      {/* Step indicators */}
      <div className="flex justify-between mb-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber <= currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div
              key={stepNumber}
              className={`flex flex-col items-center ${
                stepLabels.length > 0 ? 'flex-1' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'bg-blue-500 text-white'
                    : isCurrent
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-500'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted && stepNumber < currentStep ? '✓' : stepNumber}
              </div>
              {stepLabels[index] && (
                <span
                  className={`text-xs mt-1 text-center ${
                    isCompleted ? 'text-blue-600 font-medium' : 'text-gray-500'
                  }`}
                >
                  {stepLabels[index]}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Progress bar */}
      <ProgressBar
        progress={progress}
        size="sm"
        showPercentage={false}
        animated={true}
      />
    </div>
  );
};

export default ProgressBar;