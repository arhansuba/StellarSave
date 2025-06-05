// src/components/Savings/ChallengeList.tsx
// List Component for Displaying Savings Challenges

import React, { useState, useMemo } from 'react';
import { SavingsChallenge, ChallengeFilter } from '../../types/savings';
import ChallengeCard from './ChallengeCard';
import { useSavingsStore } from '../../store/useSavingsStore';

interface ChallengeListProps {
  challenges: SavingsChallenge[];
  userAddress: string;
  onChallengeSelect?: (challenge: SavingsChallenge) => void;
  showFilters?: boolean;
  defaultFilter?: Partial<ChallengeFilter>;
  compact?: boolean;
  maxItems?: number;
  className?: string;
}

const ChallengeList: React.FC<ChallengeListProps> = ({
  challenges,
  userAddress,
  onChallengeSelect,
  showFilters = true,
  defaultFilter = {},
  compact = false,
  maxItems,
  className = '',
}) => {
  const { openContributionModal, setSelectedChallenge } = useSavingsStore();
  
  const [localFilter, setLocalFilter] = useState<ChallengeFilter>({
    status: 'all',
    sortBy: 'created',
    sortOrder: 'desc',
    ...defaultFilter,
  });
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort challenges
  const filteredChallenges = useMemo(() => {
    let filtered = challenges;

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(challenge =>
        challenge.name.toLowerCase().includes(search) ||
        challenge.description?.toLowerCase().includes(search) ||
        challenge.creator === userAddress && 'my'.includes(search)
      );
    }

    // Status filter
    if (localFilter.status && localFilter.status !== 'all') {
      filtered = filtered.filter(challenge => {
        const now = new Date();
        const isExpired = now > challenge.deadline;
        const isCompleted = challenge.currentAmount >= challenge.goalAmount;

        switch (localFilter.status) {
          case 'active':
            return challenge.isActive && !isCompleted && !isExpired;
          case 'completed':
            return isCompleted;
          case 'expired':
            return isExpired && !isCompleted;
          default:
            return true;
        }
      });
    }

    // Creator filter
    if (localFilter.createdBy) {
      filtered = filtered.filter(challenge => challenge.creator === localFilter.createdBy);
    }

    // Participant filter
    if (localFilter.participantAddress) {
      filtered = filtered.filter(challenge => 
        challenge.participants.includes(localFilter.participantAddress!)
      );
    }

    // Goal amount range filter
    if (localFilter.minGoalAmount !== undefined) {
      filtered = filtered.filter(challenge => challenge.goalAmount >= localFilter.minGoalAmount!);
    }
    if (localFilter.maxGoalAmount !== undefined) {
      filtered = filtered.filter(challenge => challenge.goalAmount <= localFilter.maxGoalAmount!);
    }

    // Sort
    if (localFilter.sortBy) {
      filtered.sort((a, b) => {
        let aValue: number | Date, bValue: number | Date;

        switch (localFilter.sortBy) {
          case 'created':
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
            break;
          case 'deadline':
            aValue = a.deadline.getTime();
            bValue = b.deadline.getTime();
            break;
          case 'progress':
            aValue = (a.currentAmount / a.goalAmount) * 100;
            bValue = (b.currentAmount / b.goalAmount) * 100;
            break;
          case 'participants':
            aValue = a.participants.length;
            bValue = b.participants.length;
            break;
          default:
            return 0;
        }

        const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return localFilter.sortOrder === 'desc' ? -result : result;
      });
    }

    // Limit results if maxItems specified
    if (maxItems && maxItems > 0) {
      filtered = filtered.slice(0, maxItems);
    }

    return filtered;
  }, [challenges, localFilter, searchTerm, userAddress, maxItems]);

  const handleContribute = (challengeId: string) => {
    openContributionModal(challengeId);
  };

  const handleViewDetails = (challenge: SavingsChallenge) => {
    setSelectedChallenge(challenge);
    onChallengeSelect?.(challenge);
  };

  const updateFilter = (updates: Partial<ChallengeFilter>) => {
    setLocalFilter(prev => ({ ...prev, ...updates }));
  };

  const getStatusCounts = () => {
    const now = new Date();
    return {
      all: challenges.length,
      active: challenges.filter(c => 
        c.isActive && c.currentAmount < c.goalAmount && now <= c.deadline
      ).length,
      completed: challenges.filter(c => c.currentAmount >= c.goalAmount).length,
      expired: challenges.filter(c => 
        now > c.deadline && c.currentAmount < c.goalAmount
      ).length,
    };
  };

  const statusCounts = getStatusCounts();

  if (challenges.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-6xl mb-4">🎯</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No challenges yet
        </h3>
        <p className="text-gray-600 mb-6">
          Create your first savings challenge to get started on your financial goals!
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Search and Filters */}
      {showFilters && (
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search challenges..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Status Filter Tabs */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: 'all', label: 'All', count: statusCounts.all },
                { key: 'active', label: 'Active', count: statusCounts.active },
                { key: 'completed', label: 'Completed', count: statusCounts.completed },
                { key: 'expired', label: 'Expired', count: statusCounts.expired },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => updateFilter({ status: tab.key as 'all' | 'active' | 'completed' | 'expired' })}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    localFilter.status === tab.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Sort and View Controls */}
            <div className="flex items-center space-x-3">
              {/* Sort Dropdown */}
              <select
                value={`${localFilter.sortBy}-${localFilter.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  updateFilter({ 
                    sortBy: sortBy as 'created' | 'deadline' | 'progress' | 'participants', 
                    sortOrder: sortOrder as 'asc' | 'desc' 
                  });
                }}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="created-desc">Newest First</option>
                <option value="created-asc">Oldest First</option>
                <option value="deadline-asc">Deadline Soon</option>
                <option value="deadline-desc">Deadline Far</option>
                <option value="progress-desc">Most Progress</option>
                <option value="progress-asc">Least Progress</option>
                <option value="participants-desc">Most Participants</option>
                <option value="participants-asc">Fewest Participants</option>
              </select>

              {/* View Mode Toggle */}
              {!compact && (
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter({ createdBy: userAddress })}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                localFilter.createdBy === userAddress
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              My Challenges
            </button>
            <button
              onClick={() => updateFilter({ participantAddress: userAddress })}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                localFilter.participantAddress === userAddress
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              I'm Participating
            </button>
            <button
              onClick={() => setLocalFilter({ status: 'all', sortBy: 'created', sortOrder: 'desc' })}
              className="px-3 py-1 rounded-full text-sm border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Results Count */}
      {filteredChallenges.length !== challenges.length && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredChallenges.length} of {challenges.length} challenges
        </div>
      )}

      {/* Challenge Grid/List */}
      {filteredChallenges.length > 0 ? (
        <div className={
          compact || viewMode === 'list'
            ? 'space-y-4'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        }>
          {filteredChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              userAddress={userAddress}
              onContribute={handleContribute}
              onViewDetails={handleViewDetails}
              compact={compact || viewMode === 'list'}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No challenges found
          </h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your filters or search terms
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setLocalFilter({ status: 'all', sortBy: 'created', sortOrder: 'desc' });
            }}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Load More (if maxItems is set and there are more items) */}
      {maxItems && challenges.length > maxItems && (
        <div className="text-center mt-6">
          <button
            onClick={() => onChallengeSelect?.(challenges[0])} // Navigate to full list
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View all {challenges.length} challenges →
          </button>
        </div>
      )}
    </div>
  );
};

export default ChallengeList;