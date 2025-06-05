// src/components/Savings/SavingsStats.tsx
// Statistics Display Component for StellarSave

import React from 'react';
import { SavingsStats } from '../../types/savings';
import { StreakProgress } from './ProgressBar';

interface SavingsStatsProps {
  stats: SavingsStats | null;
  isLoading?: boolean;
  className?: string;
}

const SavingsStatsComponent: React.FC<SavingsStatsProps> = ({
  stats,
  isLoading = false,
  className = '',
}) => {
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p>No statistics available</p>
        </div>
      </div>
    );
  }

  const formatXLM = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatSaveCoin = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      id: 'total-saved',
      title: 'Total Saved',
      value: `${formatXLM(stats.totalSaved)} XLM`,
      icon: '💰',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      trend: stats.totalSaved > 0 ? '+' : '',
      description: 'Across all challenges',
    },
    {
      id: 'active-challenges',
      title: 'Active Challenges',
      value: stats.activeChallenges.toString(),
      icon: '🎯',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Currently participating',
    },
    {
      id: 'completed-challenges',
      title: 'Completed',
      value: stats.completedChallenges.toString(),
      icon: '🏆',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Goals achieved',
    },
    {
      id: 'savecoin-balance',
      title: 'SaveCoin Balance',
      value: `${formatSaveCoin(stats.saveCoinBalance)} SAVE`,
      icon: '🪙',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Reward tokens earned',
    },
  ];

  const achievementLevel = stats.completedChallenges >= 10 ? 'Master' :
                          stats.completedChallenges >= 5 ? 'Expert' :
                          stats.completedChallenges >= 2 ? 'Advanced' :
                          stats.completedChallenges >= 1 ? 'Beginner' : 'New';

  const achievementColors = {
    Master: 'text-purple-600 bg-purple-100',
    Expert: 'text-blue-600 bg-blue-100',
    Advanced: 'text-green-600 bg-green-100',
    Beginner: 'text-yellow-600 bg-yellow-100',
    New: 'text-gray-600 bg-gray-100',
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Your Savings Overview
          </h3>
          <p className="text-sm text-gray-600">
            Track your progress and achievements
          </p>
        </div>
        
        {/* Achievement Badge */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${achievementColors[achievementLevel]}`}>
          {achievementLevel} Saver
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => (
          <div
            key={stat.id}
            className={`relative overflow-hidden rounded-lg border border-gray-100 p-4 transition-all hover:shadow-md ${stat.bgColor}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.title}
                </p>
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.trend}{stat.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stat.description}
                </p>
              </div>
              <div className="text-2xl opacity-60">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Current Streak */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">Current Streak</h4>
            <span className="text-xs text-gray-500">
              {stats.currentStreak} week{stats.currentStreak !== 1 ? 's' : ''}
            </span>
          </div>
          <StreakProgress 
            currentStreak={stats.currentStreak}
            targetStreak={12}
          />
        </div>

        {/* Contribution Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">Weekly Average</h4>
            <span className="text-xs text-gray-500">
              {formatXLM(stats.averageWeeklyContribution)} XLM/week
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${Math.min((stats.averageWeeklyContribution / 100) * 100, 100)}%` 
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Consistent</span>
            <span>Target: 100 XLM/week</span>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="border-t border-gray-100 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalContributions}</p>
            <p className="text-xs text-gray-500">Total Contributions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.longestStreak}</p>
            <p className="text-xs text-gray-500">Longest Streak</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {stats.completedChallenges > 0 ? Math.round((stats.completedChallenges / (stats.activeChallenges + stats.completedChallenges)) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-500">Success Rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {formatSaveCoin(stats.saveCoinBalance / Math.max(stats.totalContributions, 1))}
            </p>
            <p className="text-xs text-gray-500">SAVE per Contribution</p>
          </div>
        </div>
      </div>

      {/* Achievement Badges */}
      {stats.completedChallenges > 0 && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Achievements</h4>
          <div className="flex flex-wrap gap-2">
            {stats.completedChallenges >= 1 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                🎯 First Goal
              </span>
            )}
            {stats.currentStreak >= 4 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                🔥 4 Week Streak
              </span>
            )}
            {stats.totalSaved >= 1000 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                💎 1K Saver
              </span>
            )}
            {stats.completedChallenges >= 5 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                🏆 Challenge Master
              </span>
            )}
            {stats.saveCoinBalance >= 500 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                🪙 Coin Collector
              </span>
            )}
          </div>
        </div>
      )}

      {/* Motivational Message */}
      {stats.activeChallenges === 0 && stats.completedChallenges === 0 && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="text-center bg-blue-50 rounded-lg p-4">
            <div className="text-2xl mb-2">🚀</div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              Ready to start your savings journey?
            </h4>
            <p className="text-xs text-blue-700">
              Create your first challenge and start building healthy savings habits!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingsStatsComponent;