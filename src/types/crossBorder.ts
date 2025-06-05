// src/types/crossBorder.ts
// TypeScript Types for Cross-Border Yield Features

export interface YieldPool {
  id: string;
  name: string;
  baseCurrency: string;      // XLM, USDC, etc.
  targetCurrency: string;    // NGN, KES, MXN, etc.
  corridor: string;          // e.g., "US-NG" for US to Nigeria
  totalDeposited: number;
  totalYieldEarned: number;
  apyBasisPoints: number;    // Annual percentage yield in basis points
  participants: string[];    // Participant addresses
  isActive: boolean;
  minDeposit: number;
  maxDeposit: number;
  lockDuration: number;      // Lock period in seconds
  moneygramCorridorId: string;
  icon?: string;
  description?: string;
}

export interface YieldPosition {
  user: string;              // User address
  poolId: string;
  principal: number;         // Original deposit amount
  yieldEarned: number;      // Yield accumulated
  depositTimestamp: Date;
  lastClaimTimestamp: Date;
  lockUntil: Date;          // When user can withdraw
  autoCompound: boolean;    // Auto-reinvest yields
  projectedYield?: number;  // Calculated projected yield
}

export interface CrossBorderTransaction {
  id: string;
  fromUser: string;         // Sender address
  toAddress: string;        // Recipient (wallet or bank details)
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  exchangeRate: number;
  fees: number;
  corridor: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  timestamp: Date;
  moneygramRef: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
}

export enum TransactionType {
  YieldDeposit = 'yield_deposit',
  YieldWithdraw = 'yield_withdraw', 
  RemittanceOut = 'remittance_out',
  RemittanceIn = 'remittance_in',
  ArbitrageBot = 'arbitrage_bot',
}

export enum TransactionStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface ExchangeRate {
  currencyPair: string;     // e.g., "USD-NGN"
  rate: number;
  timestamp: Date;
  source: string;           // Rate provider
  spread?: number;          // Bid-ask spread
}

export interface RemittanceCorridor {
  id: string;
  name: string;
  fromCountry: string;
  toCountry: string;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  fees: CorridorFees;
  deliveryTime: string;     // e.g., "1-2 hours"
  isActive: boolean;
  monthlyVolume?: number;
  icon?: string;
}

export interface CorridorFees {
  baseFeeBps: number;       // Base fee in basis points
  corridorPremiumBps: number; // Additional corridor fee
  minFee: number;           // Minimum fee amount
  maxFee: number;           // Maximum fee amount
  moneygramFee: number;     // MoneyGram processing fee
}

export interface YieldStats {
  totalValueLocked: number;
  totalYieldDistributed: number;
  activePositions: number;
  averageApy: number;
  totalUsers: number;
  totalCrossBorderVolume: number;
  topPerformingCorridor: string;
}

export interface UserYieldSummary {
  totalDeposited: number;
  totalYieldEarned: number;
  activePositions: number;
  weightedAverageApy: number;
  nextClaimDate?: Date;
  lockedUntil?: Date;
  projectedMonthlyYield: number;
}

export interface ArbitrageOpportunity {
  id: string;
  fromCorridor: string;
  toCorridor: string;
  profitBps: number;        // Profit in basis points
  amount: number;           // Optimal amount to trade
  confidence: number;       // Confidence score 0-100
  expiresAt: Date;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CreateYieldPoolRequest {
  name: string;
  baseCurrency: string;
  targetCurrency: string;
  corridor: string;
  apyBasisPoints: number;
  minDeposit: number;
  maxDeposit: number;
  lockDuration: number;     // In days
  moneygramCorridorId: string;
  description?: string;
}

export interface DepositToPoolRequest {
  poolId: string;
  amount: number;
  autoCompound: boolean;
  agreedToTerms: boolean;
}

export interface CrossBorderSendRequest {
  toAddress: string;
  toCurrency: string;
  amount: number;
  useYieldPool: boolean;
  recipientDetails?: RecipientDetails;
  deliveryMethod: 'wallet' | 'bank' | 'cash_pickup';
}

export interface RecipientDetails {
  name: string;
  phone?: string;
  email?: string;
  bankAccount?: string;
  bankCode?: string;
  address?: AddressDetails;
}

export interface AddressDetails {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

// MoneyGram Integration Types
export interface MoneyGramConfig {
  apiKey: string;
  baseUrl: string;
  webhookUrl: string;
  partnerId: string;
  supportedCorridors: string[];
}

export interface MoneyGramTransaction {
  referenceNumber: string;
  status: string;
  amount: number;
  fees: number;
  exchangeRate: number;
  estimatedDelivery: string;
  trackingUrl: string;
}

// Yield Farming Strategy Types
export interface YieldStrategy {
  id: string;
  name: string;
  description: string;
  targetApy: number;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  allocations: StrategyAllocation[];
  rebalanceFrequency: number; // Days
  minInvestment: number;
  fees: number; // Management fee in bps
}

export interface StrategyAllocation {
  corridor: string;
  percentage: number;
  reasoning: string;
}

// Revenue Sharing Types
export interface RevenueShare {
  totalRevenue: number;
  platformFee: number;
  userRewards: number;
  liquidityProviders: number;
  stakeholders: number;
  period: 'daily' | 'weekly' | 'monthly';
  timestamp: Date;
}

// Analytics and Insights
export interface CorridorAnalytics {
  corridor: string;
  volume24h: number;
  volume30d: number;
  averageTransactionSize: number;
  numberOfTransactions: number;
  averageDeliveryTime: number;
  customerSatisfaction: number;
  profitability: number;
}

export interface MarketInsight {
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  actionable: boolean;
  relatedCorridors: string[];
  timestamp: Date;
}

// Error Types
export type CrossBorderErrorType = 
  | 'POOL_NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'POSITION_LOCKED'
  | 'INVALID_AMOUNT'
  | 'UNSUPPORTED_CORRIDOR'
  | 'EXCHANGE_RATE_NOT_FOUND'
  | 'TRANSACTION_NOT_FOUND'
  | 'POOL_INACTIVE'
  | 'MIN_DEPOSIT_NOT_MET'
  | 'MAX_DEPOSIT_EXCEEDED'
  | 'MONEYGRAM_ERROR'
  | 'COMPLIANCE_ERROR';

export interface CrossBorderError {
  type: CrossBorderErrorType;
  message: string;
  details?: unknown;
  poolId?: string;
  transactionId?: string;
}

// API Response Types
export interface YieldPoolsResponse {
  pools: YieldPool[];
  totalCount: number;
  totalValueLocked: number;
  averageApy: number;
}

export interface CorridorsResponse {
  corridors: RemittanceCorridor[];
  exchangeRates: ExchangeRate[];
  lastUpdated: Date;
}

export interface TransactionHistoryResponse {
  transactions: CrossBorderTransaction[];
  totalCount: number;
  totalVolume: number;
  page: number;
  pageSize: number;
}

// Filter and Sort Types
export interface YieldPoolFilter {
  currency?: string;
  corridor?: string;
  minApy?: number;
  maxApy?: number;
  minDeposit?: number;
  maxDeposit?: number;
  isActive?: boolean;
  sortBy?: 'apy' | 'tvl' | 'created' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilter {
  type?: TransactionType;
  status?: TransactionStatus;
  corridor?: string;
  currency?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

// Real-time Updates
export interface YieldPoolUpdate {
  poolId: string;
  totalDeposited: number;
  participants: number;
  lastYieldDistribution: Date;
  apy: number;
}

export interface ExchangeRateUpdate {
  currencyPair: string;
  oldRate: number;
  newRate: number;
  changePercent: number;
  timestamp: Date;
}

// Notification Types
export interface CrossBorderNotification {
  id: string;
  type: 'transaction_completed' | 'pool_created' | 'yield_earned' | 'arbitrage_alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  poolId?: string;
  transactionId?: string;
  actionUrl?: string;
}

// Dashboard Summary Types
export interface CrossBorderDashboard {
  yieldSummary: UserYieldSummary;
  recentTransactions: CrossBorderTransaction[];
  activePositions: YieldPosition[];
  availableOpportunities: YieldPool[];
  marketInsights: MarketInsight[];
  notifications: CrossBorderNotification[];
}

// Integration Status
export interface IntegrationStatus {
  moneygramConnected: boolean;
  exchangeRateProvider: string;
  lastSync: Date;
  supportedCorridors: number;
  systemHealth: 'healthy' | 'degraded' | 'down';
  maintenanceMode: boolean;
}