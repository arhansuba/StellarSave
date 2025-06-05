// src/components/Savings/SavingsDashboard.tsx
// Main Dashboard Component for StellarSave

import React, { useState, useEffect } from 'react';
import { useSavingsChallenges, useSavingsStats, useSaveCoinBalance } from '../../query/useSavingsChallenge';
import { useSavingsStore } from '../../store/useSavingsStore';
import { SavingsStats as SavingsStatsType } from '../../types/savings';

// Import components
import SavingsStats from './SavingsStats';
import ChallengeList from './ChallengeList';
import CreateChallengeForm from './CreateChallengeForm';
import ContributionModal from './ContributionModal';

// Assuming we have access to user state from the SEP wallet
interface SavingsDashboardProps {
  userAccountPublicKey?: string;
  className?: string;
}

const SavingsDashboard: React.FC<SavingsDashboardProps> = ({
  userAccountPublicKey,
  className = '',
}) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'active' | 'completed' | 'all'>('overview');

  const {
    showCreateChallengeModal,
    showContributionModal,
    contributionModalChallengeId,
    closeCreateChallengeModal,
    closeContributionModal,
    openCreateChallengeModal,
  } = useSavingsStore();

  // Data fetching
  const {
    data: challenges,
    isLoading: challengesLoading,
    error: challengesError,
    refetch: refetchChallenges,
  } = useSavingsChallenges(userAccountPublicKey);

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useSavingsStats(userAccountPublicKey);

  const {
    data: saveCoinBalance,
    refetch: refetchBalance,
  } = useSaveCoinBalance(userAccountPublicKey);

  // Auto-refresh data
  useEffect(() => {
    if (!userAccountPublicKey) return;

    const interval = setInterval(() => {
      refetchChallenges();
      refetchStats();
      refetchBalance();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userAccountPublicKey, refetchChallenges, refetchStats, refetchBalance]);

  // Handle null stats properly
  const safeStats: SavingsStatsType | null = stats || null;

  // Get challenge for contribution modal
  const contributionChallenge = challenges?.find(c => c.id === contributionModalChallengeId) || null;

  if (!userAccountPublicKey) {
    return (
      <div className={`min-h-screen bg-gray-50 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="mb-8">
              <div className="text-6xl mb-4">💰</div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Welcome to StellarSave
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                The social way to save money. Create group challenges, track progress together, 
                and earn rewards for building healthy financial habits on Stellar.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="text-3xl mb-4">🎯</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Set Goals Together
                </h3>
                <p className="text-gray-600">
                  Create savings challenges with friends and family. Social accountability makes saving easier and more fun.
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="text-3xl mb-4">📊</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Track Progress
                </h3>
                <p className="text-gray-600">
                  Monitor your savings progress in real-time. See how you and your group are doing towards your goals.
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="text-3xl mb-4">🏆</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Earn Rewards
                </h3>
                <p className="text-gray-600">
                  Get SaveCoin tokens for consistent saving. Build streaks and hit milestones to earn bonus rewards.
                </p>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-blue-50 rounded-lg p-8 mb-12">
              <h2 className="text-2xl font-bold text-blue-900 mb-6">
                Why Choose StellarSave?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="flex items-start space-x-3">
                  <div className="text-blue-600 text-xl">⚡</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Lightning Fast</h4>
                    <p className="text-blue-800 text-sm">Stellar network enables instant transactions with minimal fees</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-blue-600 text-xl">🌍</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Global Reach</h4>
                    <p className="text-blue-800 text-sm">Save with friends anywhere in the world</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-blue-600 text-xl">🔒</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Secure & Transparent</h4>
                    <p className="text-blue-800 text-sm">All transactions recorded on blockchain</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-blue-600 text-xl">💸</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Low Fees</h4>
                    <p className="text-blue-800 text-sm">Save more with 0.001 XLM transaction costs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Ready to Start Saving?
              </h3>
              <p className="text-gray-600 mb-4">
                Connect your Stellar wallet to create your first savings challenge
              </p>
              <div className="text-sm text-blue-600 bg-blue-50 rounded-lg p-3">
                💡 Use the wallet connection in the top navigation to get started
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const error = challengesError || statsError;
  const isLoading = challengesLoading || statsLoading;

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                StellarSave Dashboard
              </h1>
              <p className="text-gray-600">
                Manage your savings challenges and track your progress
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* SaveCoin Balance */}
              {saveCoinBalance !== undefined && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-yellow-600">🪙</span>
                    <span className="text-sm font-medium text-yellow-800">
                      {Math.floor(saveCoinBalance)} SAVE
                    </span>
                  </div>
                </div>
              )}
              
              {/* Create Challenge Button */}
              <button
                onClick={openCreateChallengeModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
              >
                <span>➕</span>
                <span>Create Challenge</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <span className="mr-2">⚠️</span>
              <div>
                <p className="font-medium">Error loading data</p>
                <p className="text-sm">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="mb-8">
          <SavingsStats stats={safeStats} isLoading={statsLoading} />
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'overview', label: 'Overview', count: challenges?.length || 0 },
                { key: 'active', label: 'Active', count: challenges?.filter(c => c.isActive && !c.isCompleted).length || 0 },
                { key: 'completed', label: 'Completed', count: challenges?.filter(c => c.isCompleted).length || 0 },
                { key: 'all', label: 'All Challenges', count: challenges?.length || 0 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedView(tab.key as 'overview' | 'active' | 'completed' | 'all')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    selectedView === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      selectedView === tab.key
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {selectedView === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats Cards */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Challenges</p>
                        <p className="text-3xl font-bold text-blue-600">{stats.activeChallenges}</p>
                      </div>
                      <div className="text-3xl">🎯</div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Saving Streak</p>
                        <p className="text-3xl font-bold text-green-600">{stats.currentStreak}</p>
                        <p className="text-xs text-gray-500">weeks</p>
                      </div>
                      <div className="text-3xl">🔥</div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Saved</p>
                        <p className="text-3xl font-bold text-purple-600">
                          {stats.totalSaved.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">XLM</p>
                      </div>
                      <div className="text-3xl">💰</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Challenges */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Challenges</h3>
                  <button
                    onClick={() => setSelectedView('all')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View all →
                  </button>
                </div>
                
                {challenges && challenges.length > 0 ? (
                  <ChallengeList
                    challenges={challenges}
                    userAddress={userAccountPublicKey}
                    onChallengeSelect={() => {}} // Empty handler since we removed the state
                    showFilters={false}
                    compact={true}
                    maxItems={3}
                  />
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🎯</div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      No challenges yet
                    </h4>
                    <p className="text-gray-600 mb-4">
                      Create your first savings challenge to get started!
                    </p>
                    <button
                      onClick={openCreateChallengeModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Create Challenge
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedView !== 'overview' && challenges && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <ChallengeList
                challenges={challenges}
                userAddress={userAccountPublicKey}
                onChallengeSelect={() => {}} // Empty handler since we removed the state
                defaultFilter={{
                  status: selectedView === 'active' ? 'active' :
                          selectedView === 'completed' ? 'completed' : 'all'
                }}
              />
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-gray-600">Loading your challenges...</div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateChallengeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeCreateChallengeModal} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CreateChallengeForm
                userAddress={userAccountPublicKey}
                onSuccess={closeCreateChallengeModal}
                onCancel={closeCreateChallengeModal}
              />
            </div>
          </div>
        </div>
      )}

      {showContributionModal && contributionChallenge && (
        <ContributionModal
          isOpen={showContributionModal}
          onClose={closeContributionModal}
          challenge={contributionChallenge}
          userAddress={userAccountPublicKey}
        />
      )}
    </div>
  );
};

export default SavingsDashboard;