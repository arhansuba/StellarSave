import { 
  Contract,
  SorobanRpc, 
  TransactionBuilder, 
  Networks, 
  Address,
  xdr,
  Horizon,
  Account
} from '@stellar/stellar-sdk';

// Define transaction response types with specific types instead of any
interface TransactionResponse {
  status: string;
  hash: string;
  resultXdr?: unknown;     // Changed from any to unknown
  resultMetaXdr?: unknown; // Changed from any to unknown
  returnValue?: unknown;   // Changed from any to unknown
}

// Define Freighter wallet types
declare global {
  interface Window {
    freighter?: {
      connect: () => Promise<void>;
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, options: { networkPassphrase: string }) => Promise<string>;
    };
  }
}

// Interfaces for function parameters
interface ChallengeCreationParams {
  creator: string;
  name?: string;
  goalAmount: number;
  weeklyAmount: number;
  durationWeeks?: number;
  participants?: string[];
  rewardPercentage?: number;
  vaultAddress?: string | null;
  rewardToken?: string | null;
  minWeeklyDeposit?: number;
  challengeType?: string;
  socialFeatures?: Record<string, unknown>;
}

interface ContributionParams {
  challengeId: string;
  contributor: string;
  amount: number;
}

interface Milestone {
  description: string;
  targetAmount: number;
  reached: boolean;
  reachedAt: number;
  rewardBonus: number;
}

interface ContributionRecord {
  contributor: string;
  amount: number;
  timestamp: number;
}

interface DepositRecord {
  amount: number;
  timestamp: number;
  weekNumber: number;
}

interface UserProgress {
  challengeId: string;
  user: string;
  currentAmount: number;
  lastDepositTime: number;
  streakWeeks: number;
  deposits: DepositRecord[];
  completed: boolean;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  goalAmount: number;
  weeklyAmount: number;
  currentAmount: number;
  participants: string[];
  creator: string;
  createdAt: Date;
  deadline: Date;
  isActive: boolean;
  isCompleted: boolean;
}

class StellarService {
  private server: Horizon.Server;
  private rpcServer: SorobanRpc.Server;
  private networkPassphrase: string;
  private savingsChallengeContractId: string | null;
  private rewardTokenContractId: string | null;

  constructor() {
    // Initialize with testnet by default, can be changed to public network
    this.server = new Horizon.Server('https://horizon-testnet.stellar.org');
    this.rpcServer = new SorobanRpc.Server('https://soroban-testnet.stellar.org:443');
    this.networkPassphrase = Networks.TESTNET;
    
    // Contract IDs - these should be set after deployment
    this.savingsChallengeContractId = process.env.VITE_SAVINGS_CONTRACT_ID || null;
    this.rewardTokenContractId = process.env.VITE_REWARD_TOKEN_CONTRACT_ID || null;
  }

  setNetwork(isTestnet: boolean = true): void {
    if (isTestnet) {
      this.server = new Horizon.Server('https://horizon-testnet.stellar.org');
      this.rpcServer = new SorobanRpc.Server('https://soroban-testnet.stellar.org:443');
      this.networkPassphrase = Networks.TESTNET;
    } else {
      this.server = new Horizon.Server('https://horizon.stellar.org');
      this.rpcServer = new SorobanRpc.Server('https://soroban-mainnet.stellar.org:443');
      this.networkPassphrase = Networks.PUBLIC;
    }
  }

  // Connect to a wallet (e.g., Freighter)
  async connectWallet(): Promise<string> {
    if (!window.freighter) {
      throw new Error('Freighter wallet extension not found');
    }
    
    try {
      await window.freighter.connect();
      const publicKey = await window.freighter.getPublicKey();
      return publicKey;
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      throw error;
    }
  }

  // Set contract IDs after deployment
  setContractIds(savingsChallenge: string, rewardToken: string): void {
    this.savingsChallengeContractId = savingsChallenge;
    this.rewardTokenContractId = rewardToken;
  }

  // Create a savings challenge
  async createChallenge({
    creator,
    name,
    goalAmount,
    weeklyAmount,
    participants
  }: ChallengeCreationParams): Promise<{ challengeId: string; transactionHash: string }> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }

    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get the user's account
      const account = await this.server.loadAccount(creator);
      
      // Prepare parameters
      const nameSymbol = name || 'Unnamed Challenge';
      const participantsList = participants || [creator];
      
      console.log('Creating challenge with params:', {
        creator,
        nameSymbol,
        goalAmount,
        weeklyAmount,
        participantsList
      });

      // Create a string sc_val for the name
      const nameScVal = xdr.ScVal.scvString(nameSymbol);
      
      // Convert amounts to bigint sc_vals
      const goalAmountScVal = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(this.xlmToStroops(goalAmount).toString()),
          hi: xdr.Int64.fromString('0')
        })
      );
      
      const weeklyAmountScVal = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(this.xlmToStroops(weeklyAmount).toString()),
          hi: xdr.Int64.fromString('0')
        })
      );

      // Build the transaction
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'create_challenge', 
            // Properly prepare the parameters as ScVal
            Address.fromString(creator).toScVal(),
            nameScVal,
            goalAmountScVal,
            weeklyAmountScVal,
            // Create a vector of address sc_vals
            xdr.ScVal.scvVec(participantsList.map(p => Address.fromString(p).toScVal()))
          )
        )
        .setTimeout(30)
        .build();

      // Sign the transaction
      const signedXDR = await this.signTransaction(transaction.toXDR());
      const signedTransaction = TransactionBuilder.fromXDR(signedXDR, this.networkPassphrase);

      // Submit the transaction
      const result = await this.rpcServer.sendTransaction(signedTransaction);
      
      // Wait for confirmation
      const confirmed = await this.waitForTransaction(result.hash);
      
      // Extract challengeId from result
      const challengeId = confirmed.returnValue 
        ? '1' // In production, you'd need to parse the ScVal properly
        : '1';
      
      return {
        challengeId, 
        transactionHash: result.hash
      };
    } catch (error) {
      console.error('Error creating savings challenge:', error);
      throw error;
    }
  }

  // Join a savings challenge
  async joinChallenge(userPublicKey: string, challengeId: string): Promise<boolean> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }

    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get the user's account
      const account = await this.server.loadAccount(userPublicKey);
      
      // Create ScVals for the parameters
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      
      // Build the transaction
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'join_challenge',
            challengeIdScVal,
            Address.fromString(userPublicKey).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      // Sign the transaction
      const signedXDR = await this.signTransaction(transaction.toXDR());
      const signedTransaction = TransactionBuilder.fromXDR(signedXDR, this.networkPassphrase);

      // Submit the transaction
      const result = await this.rpcServer.sendTransaction(signedTransaction);
      
      // Wait for confirmation
      await this.waitForTransaction(result.hash);
      
      return true;
    } catch (error) {
      console.error('Error joining challenge:', error);
      throw error;
    }
  }

  // Make a contribution to a savings challenge
  async makeContribution({
    challengeId,
    contributor,
    amount
  }: ContributionParams): Promise<{ transactionHash: string }> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }

    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get the user's account
      const account = await this.server.loadAccount(contributor);
      
      console.log('Contributing', amount, 'to challenge:', challengeId);

      // Create ScVals for the parameters
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      const amountScVal = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(amount.toString()),
          hi: xdr.Int64.fromString('0')
        })
      );

      // Build the transaction
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'contribute',
            challengeIdScVal,
            Address.fromString(contributor).toScVal(),
            amountScVal
          )
        )
        .setTimeout(30)
        .build();

      // Sign the transaction
      const signedXDR = await this.signTransaction(transaction.toXDR());
      const signedTransaction = TransactionBuilder.fromXDR(signedXDR, this.networkPassphrase);

      // Submit the transaction
      const result = await this.rpcServer.sendTransaction(signedTransaction);
      
      // Wait for confirmation
      await this.waitForTransaction(result.hash);
      
      return { transactionHash: result.hash };
    } catch (error) {
      console.error('Error contributing to challenge:', error);
      throw error;
    }
  }
  
  // Complete a challenge
  async completeChallenge(userPublicKey: string, challengeId: string): Promise<boolean> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }
    
    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get the user's account
      const account = await this.server.loadAccount(userPublicKey);
      
      // Create ScVals for the parameters
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      
      // Build the transaction
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'complete_challenge',
            challengeIdScVal,
            Address.fromString(userPublicKey).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      // Sign the transaction
      const signedXDR = await this.signTransaction(transaction.toXDR());
      const signedTransaction = TransactionBuilder.fromXDR(signedXDR, this.networkPassphrase);

      // Submit the transaction
      const result = await this.rpcServer.sendTransaction(signedTransaction);
      
      // Wait for confirmation
      await this.waitForTransaction(result.hash);
      
      return true;
    } catch (error) {
      console.error('Error completing challenge:', error);
      throw error;
    }
  }

  // Get user challenges - enhanced with full challenge details
  async getUserChallenges(userPublicKey: string): Promise<Challenge[]> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }

    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get the user's account
      const account = await this.server.loadAccount(userPublicKey);
      
      // Build the transaction to query user challenges
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_user_challenges',
            Address.fromString(userPublicKey).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      // Sign the transaction
      const signedXDR = await this.signTransaction(transaction.toXDR());
      const signedTransaction = TransactionBuilder.fromXDR(signedXDR, this.networkPassphrase);

      // Submit the transaction
      const result = await this.rpcServer.simulateTransaction(signedTransaction);
      
      // Parse the result and convert to Challenge objects
      // This is a simplified implementation - in production, you'd need to properly parse the ScVal
      // For now, we'll still use mock data
      console.log('Getting challenges for user:', userPublicKey, result);
      
      return [
        {
          id: '1',
          name: 'Summer Vacation Fund',
          description: 'Saving for a trip to Hawaii',
          goalAmount: 1000,
          weeklyAmount: 50,
          currentAmount: 450,
          participants: [userPublicKey, 'GA2CZKBI2C55WHALSTNPG54FOQCLC6F4EQTP5KC6P2XBHVFRR2N7MNRK', 'GD4FGASP76KQAYV3PBUZDMNK62V3OJ5LOATTJUIPAVWXP4JXLMUYYENC'],
          creator: userPublicKey,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
          isActive: true,
          isCompleted: false
        },
        {
          id: '2',
          name: 'Emergency Fund',
          description: 'Building a rainy day fund',
          goalAmount: 2000,
          weeklyAmount: 75,
          currentAmount: 750,
          participants: [userPublicKey, 'GA2CZKBI2C55WHALSTNPG54FOQCLC6F4EQTP5KC6P2XBHVFRR2N7MNRK'],
          creator: 'GA2CZKBI2C55WHALSTNPG54FOQCLC6F4EQTP5KC6P2XBHVFRR2N7MNRK',
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          isActive: true,
          isCompleted: false
        }
      ];
    } catch (error) {
      console.error('Error getting user challenges:', error);
      throw error;
    }
  }

  // Get challenge details - enhanced with progress info
  async getChallengeDetails(challengeId: string): Promise<Challenge> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }

    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get an account to use for the read-only simulation
      // In production, you might want to use a dedicated account for this
      const accountsResponse = await this.server.accounts().limit(1).call();
      const accountRecord = accountsResponse.records[0];
      const account = new Account(accountRecord.account_id, accountRecord.sequence);
      
      // Create ScVal for the parameter
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      
      // Build the transaction to query challenge details
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_challenge',
            challengeIdScVal
          )
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction (we don't need to sign for simulations)
      const result = await this.rpcServer.simulateTransaction(transaction);
      
      console.log('Getting details for challenge:', challengeId, result);
      
      // For demonstration purposes, returning mock data
      // In production, you would parse the result from the simulation
      const mockChallenge: Challenge = {
        id: challengeId,
        name: 'Summer Vacation Fund',
        description: 'Saving for a trip to Hawaii',
        goalAmount: 1000,
        weeklyAmount: 50,
        currentAmount: 450,
        participants: ['GA2CZKBI2C55WHALSTNPG54FOQCLC6F4EQTP5KC6P2XBHVFRR2N7MNRK', 'GD4FGASP76KQAYV3PBUZDMNK62V3OJ5LOATTJUIPAVWXP4JXLMUYYENC'],
        creator: 'GA2CZKBI2C55WHALSTNPG54FOQCLC6F4EQTP5KC6P2XBHVFRR2N7MNRK',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        isActive: true,
        isCompleted: false
      };
      
      return mockChallenge;
    } catch (error) {
      console.error('Error getting challenge details:', error);
      throw error;
    }
  }
  
  // Get user progress for a specific challenge
  async getUserProgress(challengeId: string, userPublicKey: string): Promise<UserProgress> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }
    
    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get an account to use for the read-only simulation
      const accountsResponse = await this.server.accounts().limit(1).call();
      const accountRecord = accountsResponse.records[0];
      const account = new Account(accountRecord.account_id, accountRecord.sequence);
      
      // Create ScVals for the parameters
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      
      // Build the transaction to query user progress
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_user_progress',
            challengeIdScVal,
            Address.fromString(userPublicKey).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction
      const result = await this.rpcServer.simulateTransaction(transaction);
      
      console.log('Getting progress for user:', userPublicKey, 'in challenge:', challengeId, result);
      
      // Mock data for demonstration purposes
      // In production, you would parse the result from the simulation
      return {
        challengeId,
        user: userPublicKey,
        currentAmount: 325,
        lastDepositTime: Date.now() - 5 * 24 * 60 * 60 * 1000,
        streakWeeks: 4,
        deposits: [
          { amount: 50, timestamp: Date.now() - 26 * 24 * 60 * 60 * 1000, weekNumber: 1 },
          { amount: 50, timestamp: Date.now() - 19 * 24 * 60 * 60 * 1000, weekNumber: 2 },
          { amount: 75, timestamp: Date.now() - 12 * 24 * 60 * 60 * 1000, weekNumber: 3 },
          { amount: 50, timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, weekNumber: 4 }
        ],
        completed: false
      };
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }
  
  // Get user milestones
  async getUserMilestones(challengeId: string, userPublicKey: string): Promise<Milestone[]> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }
    
    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get an account to use for the read-only simulation
      const accountsResponse = await this.server.accounts().limit(1).call();
      const accountRecord = accountsResponse.records[0];
      const account = new Account(accountRecord.account_id, accountRecord.sequence);
      
      // Create ScVals for the parameters
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      
      // Build the transaction to query user milestones
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_user_milestones',
            challengeIdScVal,
            Address.fromString(userPublicKey).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction
      const result = await this.rpcServer.simulateTransaction(transaction);
      
      console.log('Getting milestones for user:', userPublicKey, 'in challenge:', challengeId, result);
      
      // Mock data for demonstration purposes
      // In production, you would parse the result from the simulation
      return [
        { description: '25% Complete', targetAmount: 250, reached: true, reachedAt: Date.now() - 15 * 24 * 60 * 60 * 1000, rewardBonus: 50 },
        { description: '50% Complete', targetAmount: 500, reached: false, reachedAt: 0, rewardBonus: 100 },
        { description: '75% Complete', targetAmount: 750, reached: false, reachedAt: 0, rewardBonus: 150 }
      ];
    } catch (error) {
      console.error('Error getting user milestones:', error);
      throw error;
    }
  }
  
  // Get group milestones
  async getGroupMilestones(challengeId: string): Promise<Milestone[]> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }
    
    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get an account to use for the read-only simulation
      const accountsResponse = await this.server.accounts().limit(1).call();
      const accountRecord = accountsResponse.records[0];
      const account = new Account(accountRecord.account_id, accountRecord.sequence);
      
      // Create ScVal for the parameter
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      
      // Build the transaction to query group milestones
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_group_milestones',
            challengeIdScVal
          )
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction
      const result = await this.rpcServer.simulateTransaction(transaction);
      
      console.log('Getting group milestones for challenge:', challengeId, result);
      
      // Mock data for demonstration purposes
      // In production, you would parse the result from the simulation
      return [
        { description: '25% Complete', targetAmount: 500, reached: true, reachedAt: Date.now() - 20 * 24 * 60 * 60 * 1000, rewardBonus: 50 },
        { description: '50% Complete', targetAmount: 1000, reached: false, reachedAt: 0, rewardBonus: 100 },
        { description: '75% Complete', targetAmount: 1500, reached: false, reachedAt: 0, rewardBonus: 150 }
      ];
    } catch (error) {
      console.error('Error getting group milestones:', error);
      throw error;
    }
  }
  
  // Create a custom milestone
  async createMilestone(
    creator: string, 
    challengeId: string, 
    description: string, 
    targetAmount: number, 
    rewardBonus: number
  ): Promise<boolean> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }
    
    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get the user's account
      const account = await this.server.loadAccount(creator);
      
      // Create ScVals for the parameters
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      const descriptionScVal = xdr.ScVal.scvString(description);
      
      const targetAmountScVal = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(this.xlmToStroops(targetAmount).toString()),
          hi: xdr.Int64.fromString('0')
        })
      );
      
      const rewardBonusScVal = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(rewardBonus.toString()),
          hi: xdr.Int64.fromString('0')
        })
      );
      
      // Build the transaction
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'create_milestone',
            challengeIdScVal,
            descriptionScVal,
            targetAmountScVal,
            rewardBonusScVal
          )
        )
        .setTimeout(30)
        .build();

      // Sign the transaction
      const signedXDR = await this.signTransaction(transaction.toXDR());
      const signedTransaction = TransactionBuilder.fromXDR(signedXDR, this.networkPassphrase);

      // Submit the transaction
      const result = await this.rpcServer.sendTransaction(signedTransaction);
      
      // Wait for confirmation
      await this.waitForTransaction(result.hash);
      
      return true;
    } catch (error) {
      console.error('Error creating milestone:', error);
      throw error;
    }
  }
  
  // Get contribution history for a challenge
  async getContributionHistory(challengeId: string): Promise<ContributionRecord[]> {
    if (!this.savingsChallengeContractId) {
      throw new Error('Savings Challenge contract ID not set');
    }
    
    try {
      const contract = new Contract(this.savingsChallengeContractId);
      
      // Get an account to use for the read-only simulation
      const accountsResponse = await this.server.accounts().limit(1).call();
      const accountRecord = accountsResponse.records[0];
      const account = new Account(accountRecord.account_id, accountRecord.sequence);
      
      // Create ScVal for the parameter
      const challengeIdScVal = xdr.ScVal.scvU32(parseInt(challengeId, 10));
      
      // Build the transaction to query contribution history
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_contribution_history',
            challengeIdScVal
          )
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction
      const result = await this.rpcServer.simulateTransaction(transaction);
      
      console.log('Getting contribution history for challenge:', challengeId, result);
      
      // Mock data for demonstration purposes
      // In production, you would parse the result from the simulation
      return [
        { contributor: 'GA2CZKBI2C55WHALSTNPG54FOQCLC6F4EQTP5KC6P2XBHVFRR2N7MNRK', amount: 50, timestamp: Date.now() - 26 * 24 * 60 * 60 * 1000 },
        { contributor: 'GD4FGASP76KQAYV3PBUZDMNK62V3OJ5LOATTJUIPAVWXP4JXLMUYYENC', amount: 75, timestamp: Date.now() - 25 * 24 * 60 * 60 * 1000 },
        { contributor: 'GA2CZKBI2C55WHALSTNPG54FOQCLC6F4EQTP5KC6P2XBHVFRR2N7MNRK', amount: 50, timestamp: Date.now() - 19 * 24 * 60 * 60 * 1000 },
        { contributor: 'GD4FGASP76KQAYV3PBUZDMNK62V3OJ5LOATTJUIPAVWXP4JXLMUYYENC', amount: 75, timestamp: Date.now() - 18 * 24 * 60 * 60 * 1000 }
      ];
    } catch (error) {
      console.error('Error getting contribution history:', error);
      throw error;
    }
  }
  
  // Get SaveCoin token balance
  async getSaveCoinBalance(userAddress: string): Promise<number> {
    if (!this.rewardTokenContractId) {
      // Return mock balance if contract ID is not set
      return 150;
    }
    
    try {
      const contract = new Contract(this.rewardTokenContractId);
      
      // Get an account to use for the read-only simulation
      const accountsResponse = await this.server.accounts().limit(1).call();
      const accountRecord = accountsResponse.records[0];
      const account = new Account(accountRecord.account_id, accountRecord.sequence);
      
      // Build the transaction to query token balance
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'balance',
            Address.fromString(userAddress).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction
      const result = await this.rpcServer.simulateTransaction(transaction);
      
      console.log('Getting SaveCoin balance for user:', userAddress, result);
      
      // In production, we would parse the result to get the actual balance
      // For now, returning mock data
      return 150;
    } catch (error) {
      console.error('Error getting SaveCoin balance:', error);
      return 0;
    }
  }
  
  // Sign a transaction using the wallet
  async signTransaction(xdr: string): Promise<string> {
    try {
      if (!window.freighter) {
        throw new Error('Freighter wallet extension not found');
      }
      
      return await window.freighter.signTransaction(xdr, {
        networkPassphrase: this.networkPassphrase,
      });
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  }
  
  // Wait for a transaction to be confirmed
  async waitForTransaction(transactionHash: string): Promise<TransactionResponse> {
    const MAX_ATTEMPTS = 20;
    const POLL_INTERVAL = 2000;
    let attempts = 0;
    
    while (attempts < MAX_ATTEMPTS) {
      try {
        const response = await this.rpcServer.getTransaction(transactionHash);
        
        if (response.status === 'SUCCESS') {
          // Convert the response to our TransactionResponse type
          return {
            status: response.status,
            hash: transactionHash,
            resultXdr: response.resultXdr,    // Now compatible with any type
            resultMetaXdr: response.resultMetaXdr,  // Now compatible with any type
            returnValue: response.returnValue  // Now compatible with any type
          };
        } else if (response.status === 'FAILED') {
          throw new Error(`Transaction failed: ${response.resultXdr}`);
        }
        
        // Still pending, wait and try again
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        attempts++;
      } catch (error: unknown) {
        // Type guard for error with message property
        if (typeof error === 'object' && error !== null && 'message' in error) {
          const errMsg = (error as {message: string}).message;
          if (errMsg.includes('404')) {
            // Transaction not found yet, continue waiting
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            attempts++;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Transaction confirmation timeout');
  }
  
  // Helper methods for converting between XLM and stroops
  xlmToStroops(xlm: number): number {
    return Math.round(xlm * 10000000);
  }
  
  stroopsToXlm(stroops: number): number {
    return stroops / 10000000;
  }
}

export default new StellarService();
