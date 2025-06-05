// soroban/contracts/cross-border-yield/src/lib.rs
// Cross-Border Yield Farming Contract for StellarSave

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Map, String, Symbol, Vec, log
};

// ===== YIELD POOL STRUCTURES =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct YieldPool {
    pub id: u32,
    pub name: String,
    pub base_currency: String,      // XLM, USDC, etc.
    pub target_currency: String,    // Local currency (NGN, KES, etc.)
    pub corridor: String,           // e.g., "US-NG" for US to Nigeria
    pub total_deposited: i128,
    pub total_yield_earned: i128,
    pub apy_basis_points: u32,      // Annual percentage yield in basis points
    pub participants: Vec<Address>,
    pub is_active: bool,
    pub min_deposit: i128,
    pub max_deposit: i128,
    pub lock_duration: u64,         // Lock period in seconds
    pub moneygram_corridor_id: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct YieldPosition {
    pub user: Address,
    pub pool_id: u32,
    pub principal: i128,           // Original deposit amount
    pub yield_earned: i128,        // Yield accumulated
    pub deposit_timestamp: u64,
    pub last_claim_timestamp: u64,
    pub lock_until: u64,          // When user can withdraw
    pub auto_compound: bool,      // Auto-reinvest yields
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossBorderTransaction {
    pub id: u32,
    pub from_user: Address,
    pub to_address: String,        // Can be wallet or traditional bank
    pub from_currency: String,
    pub to_currency: String,
    pub amount: i128,
    pub exchange_rate: i128,       // Rate * 10^7 for precision
    pub fees: i128,
    pub corridor: String,
    pub transaction_type: TransactionType,
    pub status: TransactionStatus,
    pub timestamp: u64,
    pub moneygram_ref: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransactionType {
    YieldDeposit = 1,
    YieldWithdraw = 2,
    RemittanceOut = 3,
    RemittanceIn = 4,
    ArbitrageBot = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransactionStatus {
    Pending = 1,
    Processing = 2,
    Completed = 3,
    Failed = 4,
    Cancelled = 5,
}

// ===== STORAGE KEYS =====

#[contracttype]
pub enum DataKey {
    NextPoolId,
    NextTransactionId,
    YieldPool(u32),
    UserPositions(Address),        // User -> Vec<YieldPosition>
    PoolPositions(u32),           // Pool -> Vec<Address> 
    CrossBorderTx(u32),
    ExchangeRates(String),        // Currency pair -> rate
    MoneyGramCorridors,           // Supported corridors
    YieldDistribution,            // Revenue sharing config
    PlatformFees,                 // Fee structure
    Admin,
    TotalValueLocked,
    GlobalYieldStats,
}

// ===== ERRORS =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum YieldError {
    NotAuthorized = 1,
    PoolNotFound = 2,
    InsufficientBalance = 3,
    PositionLocked = 4,
    InvalidAmount = 5,
    UnsupportedCorridor = 6,
    ExchangeRateNotFound = 7,
    TransactionNotFound = 8,
    PoolInactive = 9,
    MinDepositNotMet = 10,
    MaxDepositExceeded = 11,
}

// ===== CONTRACT IMPLEMENTATION =====

#[contract]
pub struct CrossBorderYieldContract;

#[contractimpl]
impl CrossBorderYieldContract {
    
    // ===== INITIALIZATION =====
    
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextPoolId, &1u32);
        env.storage().instance().set(&DataKey::NextTransactionId, &1u32);
        env.storage().instance().set(&DataKey::TotalValueLocked, &0i128);
        
        // Initialize supported MoneyGram corridors
        let corridors = vec![
            &env,
            String::from_str(&env, "US-MX"),   // US to Mexico
            String::from_str(&env, "US-PH"),   // US to Philippines  
            String::from_str(&env, "US-NG"),   // US to Nigeria
            String::from_str(&env, "US-KE"),   // US to Kenya
            String::from_str(&env, "US-IN"),   // US to India
            String::from_str(&env, "EU-NG"),   // Europe to Nigeria
            String::from_str(&env, "CA-JM"),   // Canada to Jamaica
        ];
        env.storage().instance().set(&DataKey::MoneyGramCorridors, &corridors);
        
        log!(&env, "CrossBorderYield contract initialized with admin: {}", admin);
    }
    
    // ===== YIELD POOL MANAGEMENT =====
    
    /// Create a new cross-border yield pool
    pub fn create_yield_pool(
        env: Env,
        admin: Address,
        name: String,
        base_currency: String,
        target_currency: String,
        corridor: String,
        apy_basis_points: u32,
        min_deposit: i128,
        max_deposit: i128,
        lock_duration: u64,
        moneygram_corridor_id: String,
    ) -> Result<u32, YieldError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(YieldError::NotAuthorized);
        }
        
        let pool_id: u32 = env.storage().instance()
            .get(&DataKey::NextPoolId)
            .unwrap_or(1);
        
        let pool = YieldPool {
            id: pool_id,
            name: name.clone(),
            base_currency: base_currency.clone(),
            target_currency: target_currency.clone(),
            corridor: corridor.clone(),
            total_deposited: 0,
            total_yield_earned: 0,
            apy_basis_points,
            participants: Vec::new(&env),
            is_active: true,
            min_deposit,
            max_deposit,
            lock_duration,
            moneygram_corridor_id,
        };
        
        env.storage().persistent().set(&DataKey::YieldPool(pool_id), &pool);
        env.storage().instance().set(&DataKey::NextPoolId, &(pool_id + 1));
        
        // Set initial exchange rate (would be updated by oracle in production)
        let rate_key = format!("{}-{}", base_currency, target_currency);
        env.storage().persistent().set(
            &DataKey::ExchangeRates(String::from_str(&env, &rate_key)), 
            &(100_0000000i128) // Default 1:1 rate
        );
        
        env.events().publish(
            (symbol_short!("pool_created"), pool_id),
            (admin, name, corridor, apy_basis_points)
        );
        
        log!(&env, "Yield pool {} created for corridor {}", pool_id, corridor);
        
        Ok(pool_id)
    }
    
    /// Deposit funds into a yield pool
    pub fn deposit_to_pool(
        env: Env,
        user: Address,
        pool_id: u32,
        amount: i128,
        auto_compound: bool,
    ) -> Result<(), YieldError> {
        user.require_auth();
        
        let mut pool: YieldPool = env.storage().persistent()
            .get(&DataKey::YieldPool(pool_id))
            .ok_or(YieldError::PoolNotFound)?;
        
        if !pool.is_active {
            return Err(YieldError::PoolInactive);
        }
        
        if amount < pool.min_deposit {
            return Err(YieldError::MinDepositNotMet);
        }
        
        if amount > pool.max_deposit {
            return Err(YieldError::MaxDepositExceeded);
        }
        
        let current_time = env.ledger().timestamp();
        let lock_until = current_time + pool.lock_duration;
        
        // Create position
        let position = YieldPosition {
            user: user.clone(),
            pool_id,
            principal: amount,
            yield_earned: 0,
            deposit_timestamp: current_time,
            last_claim_timestamp: current_time,
            lock_until,
            auto_compound,
        };
        
        // Add to user positions
        let mut user_positions: Vec<YieldPosition> = env.storage().persistent()
            .get(&DataKey::UserPositions(user.clone()))
            .unwrap_or(Vec::new(&env));
        user_positions.push_back(position);
        env.storage().persistent().set(&DataKey::UserPositions(user.clone()), &user_positions);
        
        // Update pool
        pool.total_deposited += amount;
        if !pool.participants.contains(&user) {
            pool.participants.push_back(user.clone());
        }
        env.storage().persistent().set(&DataKey::YieldPool(pool_id), &pool);
        
        // Update global TVL
        let tvl: i128 = env.storage().instance()
            .get(&DataKey::TotalValueLocked)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalValueLocked, &(tvl + amount));
        
        env.events().publish(
            (symbol_short!("deposit"), pool_id),
            (user, amount, lock_until)
        );
        
        log!(&env, "User {} deposited {} to pool {}", user, amount, pool_id);
        
        Ok(())
    }
    
    /// Calculate and distribute yield to pool participants
    pub fn distribute_yield(
        env: Env,
        admin: Address,
        pool_id: u32,
        total_yield: i128,
    ) -> Result<(), YieldError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(YieldError::NotAuthorized);
        }
        
        let mut pool: YieldPool = env.storage().persistent()
            .get(&DataKey::YieldPool(pool_id))
            .ok_or(YieldError::PoolNotFound)?;
        
        // Distribute yield proportionally to each participant
        for participant in pool.participants.iter() {
            let mut user_positions: Vec<YieldPosition> = env.storage().persistent()
                .get(&DataKey::UserPositions(participant.clone()))
                .unwrap_or(Vec::new(&env));
            
            for position in user_positions.iter_mut() {
                if position.pool_id == pool_id {
                    let user_share = (position.principal * total_yield) / pool.total_deposited;
                    position.yield_earned += user_share;
                    
                    // Auto-compound if enabled
                    if position.auto_compound {
                        position.principal += user_share;
                        pool.total_deposited += user_share;
                    }
                }
            }
            
            env.storage().persistent().set(&DataKey::UserPositions(participant.clone()), &user_positions);
        }
        
        pool.total_yield_earned += total_yield;
        env.storage().persistent().set(&DataKey::YieldPool(pool_id), &pool);
        
        env.events().publish(
            (symbol_short!("yield_dist"), pool_id),
            total_yield
        );
        
        Ok(())
    }
    
    // ===== CROSS-BORDER TRANSACTIONS =====
    
    /// Initiate cross-border remittance with yield optimization
    pub fn send_cross_border(
        env: Env,
        sender: Address,
        to_address: String,
        from_currency: String,
        to_currency: String,
        amount: i128,
        use_yield_pool: bool,
    ) -> Result<u32, YieldError> {
        sender.require_auth();
        
        let corridor = format!("{}-{}", 
            Self::get_currency_country(&from_currency),
            Self::get_currency_country(&to_currency)
        );
        
        // Get exchange rate
        let rate_key = format!("{}-{}", from_currency, to_currency);
        let exchange_rate: i128 = env.storage().persistent()
            .get(&DataKey::ExchangeRates(String::from_str(&env, &rate_key)))
            .unwrap_or(100_0000000); // Default rate
        
        // Calculate fees (0.5% base + corridor premium)
        let base_fee = amount * 50 / 10000; // 0.5%
        let corridor_premium = amount * 25 / 10000; // 0.25% corridor premium
        let total_fees = base_fee + corridor_premium;
        
        let tx_id: u32 = env.storage().instance()
            .get(&DataKey::NextTransactionId)
            .unwrap_or(1);
        
        let transaction = CrossBorderTransaction {
            id: tx_id,
            from_user: sender.clone(),
            to_address,
            from_currency,
            to_currency,
            amount,
            exchange_rate,
            fees: total_fees,
            corridor: String::from_str(&env, &corridor),
            transaction_type: if use_yield_pool { 
                TransactionType::YieldWithdraw 
            } else { 
                TransactionType::RemittanceOut 
            },
            status: TransactionStatus::Pending,
            timestamp: env.ledger().timestamp(),
            moneygram_ref: format!("SSAVE{}", tx_id),
        };
        
        env.storage().persistent().set(&DataKey::CrossBorderTx(tx_id), &transaction);
        env.storage().instance().set(&DataKey::NextTransactionId, &(tx_id + 1));
        
        env.events().publish(
            (symbol_short!("xborder_tx"), tx_id),
            (sender, amount, corridor)
        );
        
        Ok(tx_id)
    }
    
    /// Update exchange rates (called by oracle or admin)
    pub fn update_exchange_rate(
        env: Env,
        admin: Address,
        currency_pair: String,
        new_rate: i128,
    ) -> Result<(), YieldError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(YieldError::NotAuthorized);
        }
        
        env.storage().persistent().set(
            &DataKey::ExchangeRates(currency_pair.clone()), 
            &new_rate
        );
        
        env.events().publish(
            (symbol_short!("rate_update"), currency_pair),
            new_rate
        );
        
        Ok(())
    }
    
    // ===== ARBITRAGE AND YIELD OPTIMIZATION =====
    
    /// Execute arbitrage opportunity across corridors
    pub fn execute_arbitrage(
        env: Env,
        admin: Address,
        from_corridor: String,
        to_corridor: String,
        amount: i128,
    ) -> Result<i128, YieldError> {
        admin.require_auth();
        
        // Get rates for both corridors
        let from_rate: i128 = env.storage().persistent()
            .get(&DataKey::ExchangeRates(from_corridor.clone()))
            .unwrap_or(100_0000000);
        
        let to_rate: i128 = env.storage().persistent()
            .get(&DataKey::ExchangeRates(to_corridor.clone()))
            .unwrap_or(100_0000000);
        
        // Calculate arbitrage profit
        let converted_amount = (amount * from_rate) / 100_0000000;
        let final_amount = (converted_amount * 100_0000000) / to_rate;
        let profit = final_amount - amount;
        
        // Only execute if profitable after fees
        let fees = amount * 100 / 10000; // 1% arbitrage fee
        if profit > fees {
            // Execute arbitrage logic here
            // In production, this would interact with MoneyGram APIs
            
            env.events().publish(
                (symbol_short!("arbitrage"), profit),
                (from_corridor, to_corridor, amount)
            );
            
            Ok(profit - fees)
        } else {
            Ok(0)
        }
    }
    
    // ===== QUERY FUNCTIONS =====
    
    /// Get yield pool details
    pub fn get_yield_pool(env: Env, pool_id: u32) -> Result<YieldPool, YieldError> {
        env.storage().persistent()
            .get(&DataKey::YieldPool(pool_id))
            .ok_or(YieldError::PoolNotFound)
    }
    
    /// Get user's yield positions
    pub fn get_user_positions(env: Env, user: Address) -> Vec<YieldPosition> {
        env.storage().persistent()
            .get(&DataKey::UserPositions(user))
            .unwrap_or(Vec::new(&env))
    }
    
    /// Get exchange rate for currency pair
    pub fn get_exchange_rate(env: Env, currency_pair: String) -> i128 {
        env.storage().persistent()
            .get(&DataKey::ExchangeRates(currency_pair))
            .unwrap_or(100_0000000) // Default 1:1 rate
    }
    
    /// Get total value locked across all pools
    pub fn get_total_value_locked(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalValueLocked)
            .unwrap_or(0)
    }
    
    /// Get supported MoneyGram corridors
    pub fn get_supported_corridors(env: Env) -> Vec<String> {
        env.storage().instance()
            .get(&DataKey::MoneyGramCorridors)
            .unwrap_or(Vec::new(&env))
    }
    
    /// Calculate projected yield for a position
    pub fn calculate_projected_yield(
        env: Env,
        pool_id: u32,
        amount: i128,
        duration_days: u32,
    ) -> Result<i128, YieldError> {
        let pool: YieldPool = env.storage().persistent()
            .get(&DataKey::YieldPool(pool_id))
            .ok_or(YieldError::PoolNotFound)?;
        
        // Calculate annualized yield
        let daily_rate = pool.apy_basis_points as i128 * amount / (10000 * 365);
        let projected_yield = daily_rate * duration_days as i128;
        
        Ok(projected_yield)
    }
    
    // ===== HELPER FUNCTIONS =====
    
    fn get_currency_country(currency: &str) -> &str {
        match currency {
            "USD" | "USDC" => "US",
            "EUR" | "EURC" => "EU", 
            "NGN" => "NG",
            "KES" => "KE",
            "MXN" => "MX",
            "PHP" => "PH",
            "INR" => "IN",
            "JMD" => "JM",
            _ => "XX", // Unknown
        }
    }
    
    /// Emergency withdraw (admin only)
    pub fn emergency_withdraw(
        env: Env,
        admin: Address,
        user: Address,
        pool_id: u32,
    ) -> Result<(), YieldError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(YieldError::NotAuthorized);
        }
        
        // Allow emergency withdrawal regardless of lock period
        // Implementation would handle the actual withdrawal logic
        
        env.events().publish(
            (symbol_short!("emergency"), pool_id),
            (admin, user)
        );
        
        Ok(())
    }
}