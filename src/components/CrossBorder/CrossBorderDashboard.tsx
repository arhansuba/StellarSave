// src/components/CrossBorder/CrossBorderDashboard.tsx
// Main Dashboard for Cross-Border Yield Features

import React, { useState } from 'react';
import { 
  useYieldPools,
  useRemittanceCorridors,
  useYieldStats,
  useUserYieldSummary,
  useArbitrageOpportunities
} from '../../query/useCrossBorderYield';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface CrossBorderDashboardProps {
  userAddress?: string;
  className?: string;
}

const CrossBorderDashboard: React.FC<CrossBorderDashboardProps> = ({
  userAddress,
  className = '',
}) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'yield' | 'corridors' | 'analytics'>('overview');
  
  // Use real query hooks
  const { data: yieldPools, isLoading: poolsLoading, error: poolsError } = useYieldPools();
  const { data: corridors, isLoading: corridorsLoading, error: corridorsError } = useRemittanceCorridors();
  const { data: yieldStats, isLoading: statsLoading, error: statsError } = useYieldStats();
  const { data: userSummary, isLoading: summaryLoading, error: summaryError } = useUserYieldSummary(userAddress);
  const { data: arbitrageOps, isLoading: arbitrageLoading } = useArbitrageOpportunities();

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value / 100).toFixed(2)}%`;
  };

  // Show loading state
  if (userAddress && (poolsLoading || corridorsLoading || statsLoading || summaryLoading)) {
    return (
      <div className={`bg-white rounded-lg p-8 ${className}`}>
        <LoadingSpinner />
        <p className="text-center text-gray-600 mt-4">Loading cross-border data...</p>
      </div>
    );
  }

  // Show error state
  const hasError = poolsError || corridorsError || statsError || summaryError;
  if (hasError) {
    return (
      <div className={`bg-white rounded-lg p-8 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-red-400">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Failed to load cross-border data</h3>
              {hasError?.message && (
                <div className="mt-2 text-sm text-red-700">
                  <p>{hasError.message}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!userAddress) {
    return (
      <div className={`bg-white rounded-lg p-8 ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">🌍</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Global Yield Platform
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Earn yield on cross-border money transfers. Access 180+ countries through MoneyGram 
            integration with sophisticated DeFi strategies on Stellar.
          </p>

          {/* Key Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="font-semibold text-blue-900 mb-2">Up to 8.5% APY</h3>
              <p className="text-blue-800 text-sm">
                Earn competitive yields on remittance corridors with real demand
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold text-green-900 mb-2">Instant Transfers</h3>
              <p className="text-green-800 text-sm">
                MoneyGram integration for 30-minute to 2-hour delivery worldwide
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-6">
              <div className="text-3xl mb-3">🌍</div>
              <h3 className="font-semibold text-purple-900 mb-2">180+ Countries</h3>
              <p className="text-purple-800 text-sm">
                Access global remittance markets with institutional infrastructure
              </p>
            </div>
          </div>

          <div className="text-blue-600 bg-blue-50 rounded-lg p-4">
            💡 Connect your wallet to access cross-border yield opportunities
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Cross-Border Yield Platform
            </h1>
            <p className="text-gray-600">
              Earn yield on global remittance corridors powered by MoneyGram
            </p>
          </div>
          
          {userSummary && (
            <div className="mt-4 lg:mt-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatPercentage(userSummary.weightedAverageApy)}</div>
                <div className="text-sm opacity-90">Your Avg APY</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'yield', label: 'Yield Pools', icon: '💰' },
              { key: 'corridors', label: 'Corridors', icon: '🌍' },
              { key: 'analytics', label: 'Analytics', icon: '📈' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedView(tab.key as 'overview' | 'yield' | 'corridors' | 'analytics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${
                  selectedView === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Stats Overview */}
          {yieldStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Value Locked</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(yieldStats.totalValueLocked)}
                    </p>
                  </div>
                  <div className="text-3xl">🏦</div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg APY</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatPercentage(yieldStats.averageApy * 100)}
                    </p>
                  </div>
                  <div className="text-3xl">📈</div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Monthly Volume</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {formatCurrency(yieldStats.totalCrossBorderVolume)}
                    </p>
                  </div>
                  <div className="text-3xl">🌍</div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-3xl font-bold text-orange-600">{yieldStats.totalUsers}</p>
                  </div>
                  <div className="text-3xl">👥</div>
                </div>
              </div>
            </div>
          )}

          {/* User Summary */}
          {userSummary && (
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Portfolio</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Deposited</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(userSummary.totalDeposited)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Yield Earned</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(userSummary.totalYieldEarned)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Monthly Projection</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(userSummary.projectedMonthlyYield)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Performing Pools */}
          {yieldPools && yieldPools.length > 0 && (
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Pools</h3>
              <div className="space-y-4">
                {yieldPools.slice(0, 3).map((pool) => (
                  <div key={pool.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{pool.icon}</div>
                      <div>
                        <h4 className="font-medium text-gray-900">{pool.name}</h4>
                        <p className="text-sm text-gray-600">{pool.corridor}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-green-600">
                        {formatPercentage(pool.apyBasisPoints)}
                      </p>
                      <p className="text-sm text-gray-600">APY</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Yield Pools Tab */}
      {selectedView === 'yield' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Available Yield Pools</h3>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                Create Pool
              </button>
            </div>
            
            {poolsLoading ? (
              <LoadingSpinner />
            ) : yieldPools && yieldPools.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {yieldPools.map((pool) => (
                  <div key={pool.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-3xl">{pool.icon}</div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {formatPercentage(pool.apyBasisPoints)}
                        </div>
                        <div className="text-sm text-gray-600">APY</div>
                      </div>
                    </div>
                    
                    <h4 className="font-semibold text-gray-900 mb-2">{pool.name}</h4>
                    <p className="text-sm text-gray-600 mb-4">{pool.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Deposited:</span>
                        <span className="font-medium">{formatCurrency(pool.totalDeposited)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Participants:</span>
                        <span className="font-medium">{pool.participants.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Min Deposit:</span>
                        <span className="font-medium">{formatCurrency(pool.minDeposit)}</span>
                      </div>
                    </div>
                    
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors">
                      Deposit Now
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">💰</div>
                <p className="text-gray-600">No yield pools available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Corridors Tab */}
      {selectedView === 'corridors' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Active Remittance Corridors</h3>
            
            {corridorsLoading ? (
              <LoadingSpinner />
            ) : corridors && corridors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Corridor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Exchange Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fees
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Delivery Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monthly Volume
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {corridors.map((corridor) => (
                      <tr key={corridor.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-lg mr-3">{corridor.icon}</div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{corridor.name}</div>
                              <div className="text-sm text-gray-500">{corridor.fromCurrency} → {corridor.toCurrency}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            1 {corridor.fromCurrency} = {corridor.exchangeRate.toLocaleString()} {corridor.toCurrency}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatPercentage(corridor.fees.baseFeeBps + corridor.fees.corridorPremiumBps)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Min ${corridor.fees.minFee} + ${corridor.fees.moneygramFee}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {corridor.deliveryTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(corridor.monthlyVolume || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                            Send Money
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🌍</div>
                <p className="text-gray-600">No corridors available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {selectedView === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Breakdown */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Sources</h3>
              {yieldStats ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Yield Farming</span>
                    <span className="font-medium">65%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Cross-border Fees</span>
                    <span className="font-medium">25%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Arbitrage</span>
                    <span className="font-medium">10%</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">Loading revenue data...</p>
                </div>
              )}
            </div>

            {/* Top Corridors */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Corridors</h3>
              {corridors && corridors.length > 0 ? (
                <div className="space-y-3">
                  {corridors.slice(0, 3).map((corridor) => (
                    <div key={corridor.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-lg">{corridor.icon}</div>
                        <span className="text-sm font-medium text-gray-900">{corridor.name}</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {formatCurrency(corridor.monthlyVolume || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">Loading corridor data...</p>
                </div>
              )}
            </div>
          </div>

          {/* Market Insights with Arbitrage Opportunities */}
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Insights</h3>
            <div className="space-y-4">
              {arbitrageLoading ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">Loading market insights...</p>
                </div>
              ) : arbitrageOps && arbitrageOps.length > 0 ? (
                arbitrageOps.slice(0, 3).map((opportunity) => (
                  <div key={opportunity.id} className={`border-l-4 p-4 ${
                    opportunity.confidence > 80 ? 'bg-green-50 border-green-400' :
                    opportunity.confidence > 60 ? 'bg-blue-50 border-blue-400' :
                    'bg-yellow-50 border-yellow-400'
                  }`}>
                    <div className="flex">
                      <div className="ml-3">
                        <p className={`text-sm font-medium ${
                          opportunity.confidence > 80 ? 'text-green-700' :
                          opportunity.confidence > 60 ? 'text-blue-700' :
                          'text-yellow-700'
                        }`}>
                          {opportunity.confidence > 80 ? '📈' : 
                           opportunity.confidence > 60 ? '💱' : '⚠️'} {' '}
                          {opportunity.fromCorridor} → {opportunity.toCorridor} arbitrage opportunity
                        </p>
                        <p className={`text-xs mt-1 ${
                          opportunity.confidence > 80 ? 'text-green-600' :
                          opportunity.confidence > 60 ? 'text-blue-600' :
                          'text-yellow-600'
                        }`}>
                          {(opportunity.profitBps / 100).toFixed(1)}% profit potential with {opportunity.riskLevel} risk
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-gray-700 font-medium">
                        📊 No arbitrage opportunities detected
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Markets are currently efficient across all corridors
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossBorderDashboard;