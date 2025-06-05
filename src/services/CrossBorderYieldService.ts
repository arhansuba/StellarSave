// src/services/CrossBorderYieldService.ts
// Service for Cross-Border Yield and MoneyGram Integration

import {
  YieldPool,
  YieldPosition,
  CrossBorderTransaction,
  ExchangeRate,
  RemittanceCorridor,
  YieldStats,
  UserYieldSummary,
  CreateYieldPoolRequest,
  DepositToPoolRequest,
  CrossBorderSendRequest,
  CrossBorderError,
  CrossBorderErrorType,
  TransactionType,
  TransactionStatus,
  ArbitrageOpportunity,
  MoneyGramTransaction,

} from '../types/crossBorder';

interface SorobanService {
  invokeContract(options: ContractInvokeOptions): Promise<ContractInvokeResult>;
  getAccountInfo(address: string): Promise<AccountInfo>;
}

// Define specific types to replace 'any'
interface ContractInvokeOptions {
  contractAddress: string;
  method: string;
  args: unknown[];
  simulate?: boolean;
}

interface ContractInvokeResult {
  result: unknown;
  transactionHash?: string;
}

interface AccountInfo {
  address: string;
  balances: Record<string, number>;
  sequence: string;
}

export class CrossBorderYieldService {
  private sorobanService: SorobanService;
  private yieldContractId: string;
  private isDevelopment: boolean;
  private moneygramApiKey: string;
  private exchangeRateCache: Map<string, ExchangeRate> = new Map();

  constructor(sorobanService: SorobanService) {
    this.sorobanService = sorobanService;
    this.yieldContractId = import.meta.env.VITE_CROSS_BORDER_YIELD_CONTRACT_ID || '';
    this.moneygramApiKey = import.meta.env.VITE_MONEYGRAM_API_KEY || '';
    this.isDevelopment = import.meta.env.DEV || !this.yieldContractId;
    
    if (this.isDevelopment) {
      console.warn('CrossBorderYieldService running in development mode with mock data');
    }
  }

  // ===== YIELD POOL MANAGEMENT =====

  /**
   * Get all available yield pools
   */
  async getYieldPools(): Promise<YieldPool[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockYieldPools();
      }

      // In production, query blockchain for yield pools
      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'get_all_yield_pools',
        args: [],
        simulate: true,
      });

      const pools = Array.isArray(result.result) ? result.result : [];
      return pools.map((pool) => this.parseYieldPool(pool as Record<string, unknown>));
    } catch (error) {
      throw this.handleError(error, 'Failed to get yield pools');
    }
  }

  /**
   * Get specific yield pool details
   */
  async getYieldPool(poolId: string): Promise<YieldPool> {
    try {
      if (this.isDevelopment) {
        const pools = this.getMockYieldPools();
        const pool = pools.find(p => p.id === poolId);
        if (!pool) {
          throw this.createError('POOL_NOT_FOUND', 'Pool not found');
        }
        return pool;
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'get_yield_pool',
        args: [parseInt(poolId)],
        simulate: true,
      });

      if (!result.result) {
        throw this.createError('POOL_NOT_FOUND', 'Pool not found');
      }

      return this.parseYieldPool(result.result as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error, 'Failed to get yield pool');
    }
  }

  /**
   * Create a new yield pool (admin only)
   */
  async createYieldPool(
    request: CreateYieldPoolRequest,
    adminAddress: string
  ): Promise<{ poolId: string; transactionHash: string }> {
    try {
      this.validateCreatePoolRequest(request);

      if (this.isDevelopment) {
        return this.mockCreateYieldPool();
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'create_yield_pool',
        args: [
          adminAddress,
          request.name,
          request.baseCurrency,
          request.targetCurrency,
          request.corridor,
          request.apyBasisPoints,
          this.xlmToStroops(request.minDeposit),
          this.xlmToStroops(request.maxDeposit),
          request.lockDuration * 24 * 60 * 60, // Convert days to seconds
          request.moneygramCorridorId,
        ],
      });

      return {
        poolId: String(result.result),
        transactionHash: result.transactionHash || '',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to create yield pool');
    }
  }

  /**
   * Deposit funds into a yield pool
   */
  async depositToPool(
    request: DepositToPoolRequest,
    userAddress: string
  ): Promise<{ transactionHash: string }> {
    try {
      this.validateDepositRequest(request);

      if (this.isDevelopment) {
        return this.mockDepositToPool();
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'deposit_to_pool',
        args: [
          userAddress,
          parseInt(request.poolId),
          this.xlmToStroops(request.amount),
          request.autoCompound,
        ],
      });

      return {
        transactionHash: result.transactionHash || '',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to deposit to pool');
    }
  }

  /**
   * Get user's yield positions
   */
  async getUserYieldPositions(userAddress: string): Promise<YieldPosition[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockYieldPositions(userAddress);
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'get_user_positions',
        args: [userAddress],
        simulate: true,
      });

      const positions = Array.isArray(result.result) ? result.result : [];
      return positions.map((position) => 
        this.parseYieldPosition(position as Record<string, unknown>));
    } catch (error) {
      throw this.handleError(error, 'Failed to get user positions');
    }
  }

  /**
   * Calculate projected yield for a position
   */
  async calculateProjectedYield(
    poolId: string,
    amount: number,
    durationDays: number
  ): Promise<number> {
    try {
      if (this.isDevelopment) {
        // Mock calculation: 8% APY
        const dailyRate = 0.08 / 365;
        return amount * dailyRate * durationDays;
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'calculate_projected_yield',
        args: [parseInt(poolId), this.xlmToStroops(amount), durationDays],
        simulate: true,
      });

      const resultValue = typeof result.result === 'number' 
        ? result.result 
        : 0;

      return this.stroopsToXlm(resultValue);
    } catch (error) {
      throw this.handleError(error, 'Failed to calculate projected yield');
    }
  }

  // ===== CROSS-BORDER TRANSACTIONS =====

  /**
   * Send money across borders with yield optimization
   */
  async sendCrossBorder(
    request: CrossBorderSendRequest,
    userAddress: string
  ): Promise<{ transactionId: string; moneygramRef: string }> {
    try {
      this.validateCrossBorderRequest(request);

      if (this.isDevelopment) {
        return this.mockSendCrossBorder();
      }

      // Get exchange rate
      const exchangeRate = await this.getExchangeRate(`USD-${request.toCurrency}`);
      
      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'send_cross_border',
        args: [
          userAddress,
          request.toAddress,
          'USD', // Assuming base currency is USD
          request.toCurrency,
          this.xlmToStroops(request.amount),
          request.useYieldPool,
        ],
      });

      // Initiate MoneyGram transaction
      const moneygramTx = await this.initiateMoneyGramTransfer(request, exchangeRate.rate);

      return {
        transactionId: typeof result.result === 'string' || typeof result.result === 'number'
          ? result.result.toString()
          : '',
        moneygramRef: moneygramTx.referenceNumber,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to send cross-border payment');
    }
  }

  /**
   * Get supported remittance corridors
   */
  async getSupportedCorridors(): Promise<RemittanceCorridor[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockCorridors();
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'get_supported_corridors',
        args: [],
        simulate: true,
      });

      const corridors = Array.isArray(result.result) 
        ? result.result.map(c => String(c))
        : [];
        
      return await Promise.all(
        corridors.map(async (corridor: string) => {
          const exchangeRate = await this.getExchangeRate(corridor);
          return this.parseRemittanceCorridor(corridor, exchangeRate);
        })
      );
    } catch (error) {
      throw this.handleError(error, 'Failed to get supported corridors');
    }
  }

  private parseRemittanceCorridor(corridor: string, exchangeRate: ExchangeRate): RemittanceCorridor {
    const [fromCountry, toCountry] = corridor.split('-');
    const fromCurrency = 'USD'; // Default to USD for now
    const toCurrency = toCountry === 'NG' ? 'NGN' : 
                      toCountry === 'KE' ? 'KES' :
                      toCountry === 'PH' ? 'PHP' : 'USD';
    
    return {
      id: corridor.toLowerCase(),
      name: `${fromCountry} to ${toCountry}`,
      fromCountry,
      toCountry,
      fromCurrency,
      toCurrency,
      exchangeRate: exchangeRate.rate,
      fees: {
        baseFeeBps: 50,
        corridorPremiumBps: 25,
        minFee: 2.99,
        maxFee: 50.00,
        moneygramFee: 4.99,
      },
      deliveryTime: '1-2 hours',
      isActive: true,
      monthlyVolume: 1000000,
      icon: `🇺🇸→🇳🇬`, // Default icon
    };
  }

  /**
   * Get exchange rate for currency pair
   */
  async getExchangeRate(currencyPair: string): Promise<ExchangeRate> {
    try {
      // Check cache first
      const cached = this.exchangeRateCache.get(currencyPair);
      if (cached && (Date.now() - cached.timestamp.getTime()) < 60000) { // 1 minute cache
        return cached;
      }

      if (this.isDevelopment) {
        return this.getMockExchangeRate(currencyPair);
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'get_exchange_rate',
        args: [currencyPair],
        simulate: true,
      });

      const rateValue = typeof result.result === 'number' 
        ? result.result 
        : 0;

      const rate: ExchangeRate = {
        currencyPair,
        rate: this.stroopsToXlm(rateValue),
        timestamp: new Date(),
        source: 'stellar_contract',
      };

      // Cache the rate
      this.exchangeRateCache.set(currencyPair, rate);
      
      return rate;
    } catch (error) {
      throw this.handleError(error, 'Failed to get exchange rate');
    }
  }

  /**
   * Get user's cross-border transaction history
   */
  async getTransactionHistory(userAddress: string): Promise<CrossBorderTransaction[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockTransactionHistory(userAddress);
      }

      // In production, query blockchain events or indexer
      return [];
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction history');
    }
  }

  // ===== ANALYTICS AND INSIGHTS =====

  /**
   * Get yield statistics
   */
  async getYieldStats(): Promise<YieldStats> {
    try {
      if (this.isDevelopment) {
        return this.getMockYieldStats();
      }

      const result = await this.sorobanService.invokeContract({
        contractAddress: this.yieldContractId,
        method: 'get_total_value_locked',
        args: [],
        simulate: true,
      });

      const tvlValue = typeof result.result === 'number' 
        ? result.result 
        : 0;
      
      const tvl = this.stroopsToXlm(tvlValue);
      const pools = await this.getYieldPools();
      
      return {
        totalValueLocked: tvl,
        totalYieldDistributed: pools.reduce((sum, p) => sum + p.totalYieldEarned, 0),
        activePositions: pools.reduce((sum, p) => sum + p.participants.length, 0),
        averageApy: pools.reduce((sum, p) => sum + p.apyBasisPoints, 0) / pools.length / 100,
        totalUsers: new Set(pools.flatMap(p => p.participants)).size,
        totalCrossBorderVolume: 0, // Would be calculated from transaction history
        topPerformingCorridor: pools.sort((a, b) => b.apyBasisPoints - a.apyBasisPoints)[0]?.corridor || 'US-NG',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get yield stats');
    }
  }

  /**
   * Get user's yield summary
   */
  async getUserYieldSummary(userAddress: string): Promise<UserYieldSummary> {
    try {
      const positions = await this.getUserYieldPositions(userAddress);
      
      const totalDeposited = positions.reduce((sum, p) => sum + p.principal, 0);
      const totalYieldEarned = positions.reduce((sum, p) => sum + p.yieldEarned, 0);
      const activePositions = positions.filter(p => p.lockUntil > new Date()).length;
      
      // Calculate weighted average APY
      const weightedApy = positions.length > 0 
        ? positions.reduce((sum, p) => {
            // This would require pool info to get APY
            return sum + (p.principal * 8.0); // Mock 8% APY
          }, 0) / totalDeposited
        : 0;

      return {
        totalDeposited,
        totalYieldEarned,
        activePositions,
        weightedAverageApy: weightedApy,
        nextClaimDate: positions
          .filter(p => p.yieldEarned > 0)
          .sort((a, b) => a.lastClaimTimestamp.getTime() - b.lastClaimTimestamp.getTime())[0]
          ?.lastClaimTimestamp,
        lockedUntil: positions
          .filter(p => p.lockUntil > new Date())
          .sort((a, b) => b.lockUntil.getTime() - a.lockUntil.getTime())[0]
          ?.lockUntil,
        projectedMonthlyYield: (totalDeposited * weightedApy / 100) / 12,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get user yield summary');
    }
  }

  /**
   * Get arbitrage opportunities
   */
  async getArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    try {
      if (this.isDevelopment) {
        return this.getMockArbitrageOpportunities();
      }

      // In production, this would analyze exchange rates across corridors
      return [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      throw this.handleError(undefined, 'Failed to get arbitrage opportunities');
    }
  }

  // ===== MONEYGRAM INTEGRATION =====

  /**
   * Initiate MoneyGram transfer
   */
  private async initiateMoneyGramTransfer(
    request: CrossBorderSendRequest,
    exchangeRate: number
  ): Promise<MoneyGramTransaction> {
    if (this.isDevelopment) {
      return {
        referenceNumber: `MG${Date.now()}`,
        status: 'pending',
        amount: request.amount,
        fees: request.amount * 0.005, // 0.5% fee
        exchangeRate,
        estimatedDelivery: '1-2 hours',
        trackingUrl: `https://moneygram.com/track/MG${Date.now()}`,
      };
    }

    // In production, integrate with MoneyGram API
    try {
      const response = await fetch(`${import.meta.env.VITE_MONEYGRAM_API_URL}/transfers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.moneygramApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: request.amount,
          currency: request.toCurrency,
          recipient: request.toAddress,
          deliveryMethod: request.deliveryMethod,
        }),
      });

      if (!response.ok) {
        throw new Error('MoneyGram API error');
      }

      return await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw this.createError('MONEYGRAM_ERROR', 'Failed to initiate MoneyGram transfer');
    }
  }

  // ===== HELPER METHODS =====

  private xlmToStroops(xlm: number): number {
    return Math.round(xlm * 10000000);
  }

  private stroopsToXlm(stroops: unknown): number {
    return (typeof stroops === 'number' ? stroops : 0) / 10000000;
  }

  private parseYieldPool(contractResult: Record<string, unknown>): YieldPool {
    return {
      id: String(contractResult.id || ''),
      name: String(contractResult.name || ''),
      baseCurrency: String(contractResult.base_currency || ''),
      targetCurrency: String(contractResult.target_currency || ''),
      corridor: String(contractResult.corridor || ''),
      totalDeposited: this.stroopsToXlm(Number(contractResult.total_deposited || 0)),
      totalYieldEarned: this.stroopsToXlm(Number(contractResult.total_yield_earned || 0)),
      apyBasisPoints: Number(contractResult.apy_basis_points || 0),
      participants: Array.isArray(contractResult.participants) 
        ? contractResult.participants.map(String)
        : [],
      isActive: Boolean(contractResult.is_active),
      minDeposit: this.stroopsToXlm(Number(contractResult.min_deposit || 0)),
      maxDeposit: this.stroopsToXlm(Number(contractResult.max_deposit || 0)),
      lockDuration: Number(contractResult.lock_duration || 0),
      moneygramCorridorId: String(contractResult.moneygram_corridor_id || ''),
    };
  }

  private parseYieldPosition(contractResult: Record<string, unknown>): YieldPosition {
    return {
      user: String(contractResult.user || ''),
      poolId: String(contractResult.pool_id || ''),
      principal: this.stroopsToXlm(Number(contractResult.principal || 0)),
      yieldEarned: this.stroopsToXlm(Number(contractResult.yield_earned || 0)),
      depositTimestamp: new Date(Number(contractResult.deposit_timestamp || 0) * 1000),
      lastClaimTimestamp: new Date(Number(contractResult.last_claim_timestamp || 0) * 1000),
      lockUntil: new Date(Number(contractResult.lock_until || 0) * 1000),
      autoCompound: Boolean(contractResult.auto_compound),
    };
  }

  // ===== VALIDATION =====

  private validateCreatePoolRequest(request: CreateYieldPoolRequest): void {
    if (!request.name || request.name.trim().length < 3) {
      throw this.createError('INVALID_AMOUNT', 'Pool name must be at least 3 characters');
    }
    
    if (request.apyBasisPoints < 0 || request.apyBasisPoints > 10000) {
      throw this.createError('INVALID_AMOUNT', 'APY must be between 0% and 100%');
    }
    
    if (request.minDeposit <= 0 || request.maxDeposit <= request.minDeposit) {
      throw this.createError('INVALID_AMOUNT', 'Invalid deposit limits');
    }
  }

  private validateDepositRequest(request: DepositToPoolRequest): void {
    if (!request.poolId) {
      throw this.createError('INVALID_AMOUNT', 'Pool ID is required');
    }
    
    if (request.amount <= 0) {
      throw this.createError('INVALID_AMOUNT', 'Deposit amount must be positive');
    }
    
    if (!request.agreedToTerms) {
      throw this.createError('COMPLIANCE_ERROR', 'Must agree to terms and conditions');
    }
  }

  private validateCrossBorderRequest(request: CrossBorderSendRequest): void {
    if (!request.toAddress) {
      throw this.createError('INVALID_AMOUNT', 'Recipient address is required');
    }
    
    if (request.amount <= 0) {
      throw this.createError('INVALID_AMOUNT', 'Amount must be positive');
    }
    
    if (!request.toCurrency) {
      throw this.createError('UNSUPPORTED_CORRIDOR', 'Target currency is required');
    }
  }

  // ===== ERROR HANDLING =====

  private handleError(error: unknown, message: string): CrossBorderError {
    console.error(`CrossBorderYieldService Error: ${message}`, error);
    
    let errorType: CrossBorderErrorType = 'POOL_NOT_FOUND';
    
    if (error instanceof Error) {
      if (error.message?.includes('insufficient')) {
        errorType = 'INSUFFICIENT_BALANCE';
      } else if (error.message?.includes('locked')) {
        errorType = 'POSITION_LOCKED';
      } else if (error.message?.includes('not found')) {
        errorType = 'POOL_NOT_FOUND';
      }
    }
    
    return this.createError(errorType, message, error);
  }

  private createError(type: CrossBorderErrorType, message: string, details?: unknown): CrossBorderError {
    return { type, message, details };
  }

  // ===== MOCK DATA FOR DEVELOPMENT =====

  private getMockYieldPools(): YieldPool[] {
    return [
      {
        id: '1',
        name: 'Nigeria High-Yield Pool',
        baseCurrency: 'USDC',
        targetCurrency: 'NGN',
        corridor: 'US-NG',
        totalDeposited: 125000,
        totalYieldEarned: 8500,
        apyBasisPoints: 850, // 8.5% APY
        participants: ['GXXXXXXX...USER1', 'GYYYYYY...USER2', 'GZZZZZZ...USER3'],
        isActive: true,
        minDeposit: 100,
        maxDeposit: 50000,
        lockDuration: 2592000, // 30 days
        moneygramCorridorId: 'MG-US-NG-001',
        icon: '🇳🇬',
        description: 'High-yield pool for USD to Nigerian Naira corridor with MoneyGram integration',
      },
      {
        id: '2',
        name: 'Kenya Stable Pool',
        baseCurrency: 'USDC',
        targetCurrency: 'KES',
        corridor: 'US-KE',
        totalDeposited: 87500,
        totalYieldEarned: 4200,
        apyBasisPoints: 650, // 6.5% APY
        participants: ['GAAAAAAA...USER4', 'GBBBBBB...USER5'],
        isActive: true,
        minDeposit: 50,
        maxDeposit: 25000,
        lockDuration: 1296000, // 15 days
        moneygramCorridorId: 'MG-US-KE-001',
        icon: '🇰🇪',
        description: 'Stable yield pool for USD to Kenyan Shilling with fast settlement',
      },
      {
        id: '3',
        name: 'Philippines Express Pool',
        baseCurrency: 'USDC',
        targetCurrency: 'PHP',
        corridor: 'US-PH',
        totalDeposited: 195000,
        totalYieldEarned: 12800,
        apyBasisPoints: 750, // 7.5% APY
        participants: ['GCCCCCC...USER6', 'GDDDDDD...USER7', 'GEEEEE...USER8', 'GFFFFFF...USER9'],
        isActive: true,
        minDeposit: 75,
        maxDeposit: 40000,
        lockDuration: 2160000, // 25 days
        moneygramCorridorId: 'MG-US-PH-001',
        icon: '🇵🇭',
        description: 'Express yield pool for USD to Philippine Peso with 1-hour delivery',
      },
    ];
  }

  private getMockYieldPositions(userAddress: string): YieldPosition[] {
    return [
      {
        user: userAddress,
        poolId: '1',
        principal: 1000,
        yieldEarned: 45.2,
        depositTimestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        lastClaimTimestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        lockUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        autoCompound: true,
      },
      {
        user: userAddress,
        poolId: '2',
        principal: 500,
        yieldEarned: 18.7,
        depositTimestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        lastClaimTimestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        lockUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        autoCompound: false,
      },
    ];
  }

  private getMockCorridors(): RemittanceCorridor[] {
    return [
      {
        id: 'us-ng',
        name: 'United States to Nigeria',
        fromCountry: 'US',
        toCountry: 'NG',
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        exchangeRate: 1650.50,
        fees: {
          baseFeeBps: 50,
          corridorPremiumBps: 25,
          minFee: 2.99,
          maxFee: 50.00,
          moneygramFee: 4.99,
        },
        deliveryTime: '1-2 hours',
        isActive: true,
        monthlyVolume: 2500000,
        icon: '🇺🇸→🇳🇬',
      },
      {
        id: 'us-ke',
        name: 'United States to Kenya',
        fromCountry: 'US',
        toCountry: 'KE',
        fromCurrency: 'USD',
        toCurrency: 'KES',
        exchangeRate: 155.75,
        fees: {
          baseFeeBps: 45,
          corridorPremiumBps: 20,
          minFee: 1.99,
          maxFee: 35.00,
          moneygramFee: 3.99,
        },
        deliveryTime: '30 minutes',
        isActive: true,
        monthlyVolume: 1800000,
        icon: '🇺🇸→🇰🇪',
      },
    ];
  }

  private getMockExchangeRate(currencyPair: string): ExchangeRate {
    const rates: Record<string, number> = {
      'USD-NGN': 1650.50,
      'USD-KES': 155.75,
      'USD-PHP': 56.25,
      'USD-MXN': 17.85,
      'USD-INR': 84.50,
      'EUR-NGN': 1785.25,
    };

    return {
      currencyPair,
      rate: rates[currencyPair] || 1.0,
      timestamp: new Date(),
      source: 'mock_provider',
      spread: 0.02, // 2% spread
    };
  }

  private getMockYieldStats(): YieldStats {
    return {
      totalValueLocked: 407500,
      totalYieldDistributed: 25500,
      activePositions: 147,
      averageApy: 7.33,
      totalUsers: 89,
      totalCrossBorderVolume: 15750000,
      topPerformingCorridor: 'US-NG',
    };
  }

  private getMockTransactionHistory(userAddress: string): CrossBorderTransaction[] {
    return [
      {
        id: '1',
        fromUser: userAddress,
        toAddress: 'recipient@example.com',
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        amount: 200,
        exchangeRate: 1650.50,
        fees: 7.99,
        corridor: 'US-NG',
        transactionType: TransactionType.RemittanceOut,
        status: TransactionStatus.Completed,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        moneygramRef: 'MG123456789',
      },
    ];
  }

  private getMockArbitrageOpportunities(): ArbitrageOpportunity[] {
    return [
      {
        id: 'arb_1',
        fromCorridor: 'US-NG',
        toCorridor: 'EU-NG',
        profitBps: 150, // 1.5% profit
        amount: 10000,
        confidence: 85,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        riskLevel: 'medium',
      },
    ];
  }

  private mockCreateYieldPool(): Promise<{ poolId: string; transactionHash: string }> {
    return Promise.resolve({
      poolId: `mock_${Date.now()}`,
      transactionHash: `tx_create_${Date.now()}`,
    });
  }

  private mockDepositToPool(): Promise<{ transactionHash: string }> {
    return Promise.resolve({
      transactionHash: `tx_deposit_${Date.now()}`,
    });
  }

  private mockSendCrossBorder(): Promise<{ transactionId: string; moneygramRef: string }> {
    return Promise.resolve({
      transactionId: `tx_xborder_${Date.now()}`,
      moneygramRef: `MG${Date.now()}`,
    });
  }
}