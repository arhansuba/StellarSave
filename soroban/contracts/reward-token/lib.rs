// soroban/contracts/reward-token/src/lib.rs
// StellarSave SaveCoin Reward Token Contract

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Symbol, Map, log
};

// ===== TOKEN METADATA =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub total_supply: i128,
}

// ===== REWARD TYPES =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RewardType {
    WeeklyContribution = 1,
    MilestoneReached = 2,
    ChallengeCompleted = 3,
    StreakBonus = 4,
    ReferralBonus = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardRecord {
    pub recipient: Address,
    pub amount: i128,
    pub reward_type: RewardType,
    pub challenge_id: u32,
    pub timestamp: u64,
    pub multiplier: u32, // Basis points (10000 = 1x)
}

// ===== STORAGE KEYS =====

#[contracttype]
pub enum DataKey {
    // Token standard keys
    Balance(Address),
    Allowance(Address, Address), // Owner, Spender
    Metadata,
    Admin,
    
    // Reward system keys
    RewardConfig,
    RewardHistory(Address), // User's reward history
    TotalRewards,
    MinterContracts, // Vec<Address> of authorized minter contracts
    
    // Statistics
    RewardStats(RewardType), // Total distributed per reward type
    UserRewardStats(Address), // User's total rewards by type
}

// ===== ERRORS =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TokenError {
    NotAuthorized = 1,
    InsufficientBalance = 2,
    InsufficientAllowance = 3,
    InvalidAmount = 4,
    InvalidAddress = 5,
    AlreadyInitialized = 6,
    NotInitialized = 7,
    NotMinter = 8,
    InvalidRewardType = 9,
    RewardConfigNotSet = 10,
}

// ===== REWARD CONFIGURATION =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardConfig {
    pub base_weekly_reward: i128,      // Base reward for weekly contributions
    pub milestone_multiplier: u32,     // Multiplier for milestone rewards (basis points)
    pub completion_multiplier: u32,    // Multiplier for challenge completion (basis points)
    pub streak_bonus_per_week: i128,   // Additional reward per week in streak
    pub max_streak_bonus: i128,        // Maximum streak bonus
    pub referral_reward: i128,         // Reward for successful referrals
    pub min_contribution_for_reward: i128, // Minimum contribution to earn rewards
}

// ===== CONTRACT IMPLEMENTATION =====

#[contract]
pub struct SaveCoinToken;

#[contractimpl]
impl SaveCoinToken {
    
    // ===== INITIALIZATION =====
    
    /// Initialize the SaveCoin token
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), TokenError> {
        admin.require_auth();
        
        // Check if already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TokenError::AlreadyInitialized);
        }
        
        // Set admin
        env.storage().instance().set(&DataKey::Admin, &admin);
        
        // Set token metadata
        let metadata = TokenMetadata {
            name: name.clone(),
            symbol: symbol.clone(),
            decimals,
            total_supply: 0,
        };
        env.storage().instance().set(&DataKey::Metadata, &metadata);
        
        // Initialize minter contracts list
        let minters: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::MinterContracts, &minters);
        
        // Set default reward configuration
        let default_config = RewardConfig {
            base_weekly_reward: 10_0000000,        // 10 SaveCoin
            milestone_multiplier: 15000,           // 1.5x (150%)
            completion_multiplier: 20000,          // 2.0x (200%)
            streak_bonus_per_week: 1_0000000,      // 1 SaveCoin per week
            max_streak_bonus: 50_0000000,          // 50 SaveCoin max
            referral_reward: 25_0000000,           // 25 SaveCoin
            min_contribution_for_reward: 10_0000000, // 10 XLM minimum
        };
        env.storage().instance().set(&DataKey::RewardConfig, &default_config);
        
        // Initialize total rewards counter
        env.storage().instance().set(&DataKey::TotalRewards, &0i128);
        
        log!(&env, "SaveCoin token initialized: {} ({})", name, symbol);
        
        Ok(())
    }
    
    // ===== STANDARD TOKEN FUNCTIONS =====
    
    /// Get token balance for an address
    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }
    
    /// Transfer tokens between addresses
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        from.require_auth();
        
        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }
        
        if amount == 0 {
            return Ok(());
        }
        
        let from_balance = Self::balance(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        
        let to_balance = Self::balance(env.clone(), to.clone());
        
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(to_balance + amount));
        
        env.events().publish(
            (symbol_short!("transfer"), from, to),
            amount
        );
        
        Ok(())
    }
    
    /// Approve spending allowance
    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        from.require_auth();
        
        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }
        
        env.storage().persistent().set(&DataKey::Allowance(from.clone(), spender.clone()), &amount);
        
        env.events().publish(
            (symbol_short!("approve"), from, spender),
            amount
        );
        
        Ok(())
    }
    
    /// Get spending allowance
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }
    
    /// Transfer from allowance
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        spender.require_auth();
        
        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }
        
        if amount == 0 {
            return Ok(());
        }
        
        let allowance = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowance < amount {
            return Err(TokenError::InsufficientAllowance);
        }
        
        let from_balance = Self::balance(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        
        let to_balance = Self::balance(env.clone(), to.clone());
        
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(to_balance + amount));
        env.storage().persistent().set(&DataKey::Allowance(from.clone(), spender.clone()), &(allowance - amount));
        
        env.events().publish(
            (symbol_short!("transfer"), from, to),
            amount
        );
        
        Ok(())
    }
    
    // ===== TOKEN METADATA =====
    
    /// Get token name
    pub fn name(env: Env) -> String {
        let metadata: TokenMetadata = env.storage().instance()
            .get(&DataKey::Metadata)
            .unwrap_or(TokenMetadata {
                name: String::from_str(&env, "SaveCoin"),
                symbol: String::from_str(&env, "SAVE"),
                decimals: 7,
                total_supply: 0,
            });
        metadata.name
    }
    
    /// Get token symbol
    pub fn symbol(env: Env) -> String {
        let metadata: TokenMetadata = env.storage().instance()
            .get(&DataKey::Metadata)
            .unwrap_or(TokenMetadata {
                name: String::from_str(&env, "SaveCoin"),
                symbol: String::from_str(&env, "SAVE"),
                decimals: 7,
                total_supply: 0,
            });
        metadata.symbol
    }
    
    /// Get token decimals
    pub fn decimals(env: Env) -> u32 {
        let metadata: TokenMetadata = env.storage().instance()
            .get(&DataKey::Metadata)
            .unwrap_or(TokenMetadata {
                name: String::from_str(&env, "SaveCoin"),
                symbol: String::from_str(&env, "SAVE"),
                decimals: 7,
                total_supply: 0,
            });
        metadata.decimals
    }
    
    /// Get total supply
    pub fn total_supply(env: Env) -> i128 {
        let metadata: TokenMetadata = env.storage().instance()
            .get(&DataKey::Metadata)
            .unwrap_or(TokenMetadata {
                name: String::from_str(&env, "SaveCoin"),
                symbol: String::from_str(&env, "SAVE"),
                decimals: 7,
                total_supply: 0,
            });
        metadata.total_supply
    }
    
    // ===== REWARD SYSTEM =====
    
    /// Mint SaveCoin rewards (only authorized minters)
    pub fn mint_reward(
        env: Env,
        minter: Address,
        to: Address,
        amount: i128,
        reward_type: RewardType,
        challenge_id: u32,
        multiplier: u32, // Basis points
    ) -> Result<(), TokenError> {
        minter.require_auth();
        
        // Check if minter is authorized
        let minters: Vec<Address> = env.storage().instance()
            .get(&DataKey::MinterContracts)
            .unwrap_or(Vec::new(&env));
        
        if !minters.contains(&minter) {
            return Err(TokenError::NotMinter);
        }
        
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        
        // Apply multiplier
        let final_amount = (amount * multiplier as i128) / 10000;
        
        // Mint tokens
        let current_balance = Self::balance(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(current_balance + final_amount));
        
        // Update total supply
        let mut metadata: TokenMetadata = env.storage().instance()
            .get(&DataKey::Metadata)
            .ok_or(TokenError::NotInitialized)?;
        metadata.total_supply += final_amount;
        env.storage().instance().set(&DataKey::Metadata, &metadata);
        
        // Record reward
        let reward_record = RewardRecord {
            recipient: to.clone(),
            amount: final_amount,
            reward_type: reward_type.clone(),
            challenge_id,
            timestamp: env.ledger().timestamp(),
            multiplier,
        };
        
        // Add to user's reward history
        let mut user_rewards: Vec<RewardRecord> = env.storage().persistent()
            .get(&DataKey::RewardHistory(to.clone()))
            .unwrap_or(Vec::new(&env));
        user_rewards.push_back(reward_record);
        env.storage().persistent().set(&DataKey::RewardHistory(to.clone()), &user_rewards);
        
        // Update statistics
        let current_type_total: i128 = env.storage().persistent()
            .get(&DataKey::RewardStats(reward_type.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::RewardStats(reward_type.clone()), &(current_type_total + final_amount));
        
        let total_rewards: i128 = env.storage().instance()
            .get(&DataKey::TotalRewards)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalRewards, &(total_rewards + final_amount));
        
        // Emit events
        env.events().publish(
            (symbol_short!("mint"), to.clone()),
            (final_amount, reward_type, challenge_id)
        );
        
        env.events().publish(
            (symbol_short!("reward"), challenge_id),
            (to, final_amount, reward_type)
        );
        
        log!(&env, "Minted {} SaveCoin reward to {} for challenge {}", final_amount, to, challenge_id);
        
        Ok(())
    }
    
    /// Calculate reward amount based on contribution and type
    pub fn calculate_reward(
        env: Env,
        contribution_amount: i128,
        reward_type: RewardType,
        streak_weeks: u32,
    ) -> Result<i128, TokenError> {
        let config: RewardConfig = env.storage().instance()
            .get(&DataKey::RewardConfig)
            .ok_or(TokenError::RewardConfigNotSet)?;
        
        if contribution_amount < config.min_contribution_for_reward {
            return Ok(0);
        }
        
        let base_reward = match reward_type {
            RewardType::WeeklyContribution => config.base_weekly_reward,
            RewardType::MilestoneReached => {
                (config.base_weekly_reward * config.milestone_multiplier as i128) / 10000
            },
            RewardType::ChallengeCompleted => {
                (config.base_weekly_reward * config.completion_multiplier as i128) / 10000
            },
            RewardType::StreakBonus => {
                let streak_bonus = (streak_weeks as i128) * config.streak_bonus_per_week;
                streak_bonus.min(config.max_streak_bonus)
            },
            RewardType::ReferralBonus => config.referral_reward,
        };
        
        // Scale reward based on contribution size (larger contributions get slightly more)
        let contribution_factor = if contribution_amount >= 100_0000000 { // 100 XLM+
            12000 // 1.2x
        } else if contribution_amount >= 50_0000000 { // 50 XLM+
            11000 // 1.1x
        } else {
            10000 // 1.0x
        };
        
        let final_reward = (base_reward * contribution_factor) / 10000;
        Ok(final_reward)
    }
    
    // ===== ADMIN FUNCTIONS =====
    
    /// Add authorized minter contract (admin only)
    pub fn add_minter(env: Env, admin: Address, minter: Address) -> Result<(), TokenError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(TokenError::NotAuthorized);
        }
        
        let mut minters: Vec<Address> = env.storage().instance()
            .get(&DataKey::MinterContracts)
            .unwrap_or(Vec::new(&env));
        
        if !minters.contains(&minter) {
            minters.push_back(minter.clone());
            env.storage().instance().set(&DataKey::MinterContracts, &minters);
            
            env.events().publish(
                (symbol_short!("minter_add"), admin),
                minter
            );
        }
        
        Ok(())
    }
    
    /// Remove minter contract (admin only)
    pub fn remove_minter(env: Env, admin: Address, minter: Address) -> Result<(), TokenError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(TokenError::NotAuthorized);
        }
        
        let mut minters: Vec<Address> = env.storage().instance()
            .get(&DataKey::MinterContracts)
            .unwrap_or(Vec::new(&env));
        
        if let Some(index) = minters.first_index_of(&minter) {
            minters.remove(index);
            env.storage().instance().set(&DataKey::MinterContracts, &minters);
            
            env.events().publish(
                (symbol_short!("minter_rm"), admin),
                minter
            );
        }
        
        Ok(())
    }
    
    /// Update reward configuration (admin only)
    pub fn update_reward_config(
        env: Env,
        admin: Address,
        config: RewardConfig,
    ) -> Result<(), TokenError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(TokenError::NotAuthorized);
        }
        
        env.storage().instance().set(&DataKey::RewardConfig, &config);
        
        env.events().publish(
            (symbol_short!("config"), admin),
            config.base_weekly_reward
        );
        
        Ok(())
    }
    
    // ===== QUERY FUNCTIONS =====
    
    /// Get user's reward history
    pub fn get_reward_history(env: Env, user: Address) -> Vec<RewardRecord> {
        env.storage().persistent()
            .get(&DataKey::RewardHistory(user))
            .unwrap_or(Vec::new(&env))
    }
    
    /// Get total rewards distributed by type
    pub fn get_reward_stats(env: Env, reward_type: RewardType) -> i128 {
        env.storage().persistent()
            .get(&DataKey::RewardStats(reward_type))
            .unwrap_or(0)
    }
    
    /// Get total rewards distributed
    pub fn get_total_rewards(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalRewards)
            .unwrap_or(0)
    }
    
    /// Get current reward configuration
    pub fn get_reward_config(env: Env) -> Result<RewardConfig, TokenError> {
        env.storage().instance()
            .get(&DataKey::RewardConfig)
            .ok_or(TokenError::RewardConfigNotSet)
    }
    
    /// Get authorized minters
    pub fn get_minters(env: Env) -> Vec<Address> {
        env.storage().instance()
            .get(&DataKey::MinterContracts)
            .unwrap_or(Vec::new(&env))
    }
    
    /// Check if address is authorized minter
    pub fn is_minter(env: Env, address: Address) -> bool {
        let minters: Vec<Address> = env.storage().instance()
            .get(&DataKey::MinterContracts)
            .unwrap_or(Vec::new(&env));
        minters.contains(&address)
    }
}