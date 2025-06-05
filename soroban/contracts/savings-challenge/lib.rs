// soroban/contracts/savings-challenge/src/lib.rs
// StellarSave Savings Challenge Smart Contract

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Map, String, Symbol, Vec, log
};

// ===== DATA STRUCTURES =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SavingsChallenge {
    pub id: u32,
    pub creator: Address,
    pub name: String,
    pub description: String,
    pub goal_amount: i128,
    pub weekly_amount: i128,
    pub current_amount: i128,
    pub participants: Vec<Address>,
    pub created_at: u64,
    pub deadline: u64,
    pub is_active: bool,
    pub min_weekly_required: bool,
    pub allow_early_withdrawal: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Contribution {
    pub contributor: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub week_number: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParticipantStats {
    pub total_contributed: i128,
    pub contribution_count: u32,
    pub last_contribution: u64,
    pub current_streak: u32,
}

// ===== STORAGE KEYS =====
#[contracttype]
pub enum DataKey {
    NextChallengeId,
    Challenge(u32),
    Contributions(u32),  // Challenge ID -> Vec<Contribution>
    ParticipantStats(u32, Address), // Challenge ID, Participant -> Stats
    UserChallenges(Address), // User -> Vec<u32> (challenge IDs)
    Admin,
    ContractInfo,
}

// ===== ERRORS =====
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SavingsError {
    NotAuthorized = 1,
    ChallengeNotFound = 2,
    ChallengeInactive = 3,
    NotParticipant = 4,
    InsufficientAmount = 5,
    InvalidParameters = 6,
    ChallengeExpired = 7,
    AlreadyFinalized = 8,
    GoalNotReached = 9,
    ContributionTooEarly = 10,
}

// ===== CONTRACT IMPLEMENTATION =====

#[contract]
pub struct SavingsChallengeContract;

#[contractimpl]
impl SavingsChallengeContract {
    
    // ===== INITIALIZATION =====
    
    /// Initialize the contract with admin
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextChallengeId, &1u32);
        
        // Store contract metadata
        let contract_info = (
            String::from_str(&env, "StellarSave Challenge Contract"),
            String::from_str(&env, "1.0.0")
        );
        env.storage().instance().set(&DataKey::ContractInfo, &contract_info);
        
        log!(&env, "SavingsChallenge contract initialized with admin: {}", admin);
    }
    
    // ===== CHALLENGE MANAGEMENT =====
    
    /// Create a new savings challenge
    pub fn create_challenge(
        env: Env,
        creator: Address,
        name: String,
        description: String,
        goal_amount: i128,
        weekly_amount: i128,
        participants: Vec<Address>,
        duration_weeks: u32,
        min_weekly_required: bool,
        allow_early_withdrawal: bool,
    ) -> Result<u32, SavingsError> {
        creator.require_auth();
        
        // Validate parameters
        if goal_amount <= 0 || weekly_amount <= 0 {
            return Err(SavingsError::InvalidParameters);
        }
        
        if duration_weeks == 0 || duration_weeks > 104 {  // Max 2 years
            return Err(SavingsError::InvalidParameters);
        }
        
        if participants.is_empty() {
            return Err(SavingsError::InvalidParameters);
        }
        
        if name.len() < 3 {
            return Err(SavingsError::InvalidParameters);
        }
        
        // Get next challenge ID
        let challenge_id: u32 = env.storage().instance()
            .get(&DataKey::NextChallengeId)
            .unwrap_or(1);
        
        // Calculate deadline (duration_weeks * 7 * 24 * 60 * 60)
        let current_time = env.ledger().timestamp();
        let deadline = current_time + (duration_weeks as u64 * 7 * 24 * 60 * 60);
        
        // Create challenge
        let challenge = SavingsChallenge {
            id: challenge_id,
            creator: creator.clone(),
            name: name.clone(),
            description,
            goal_amount,
            weekly_amount,
            current_amount: 0,
            participants: participants.clone(),
            created_at: current_time,
            deadline,
            is_active: true,
            min_weekly_required,
            allow_early_withdrawal,
        };
        
        // Store challenge
        env.storage().persistent().set(&DataKey::Challenge(challenge_id), &challenge);
        
        // Initialize contributions storage
        let empty_contributions: Vec<Contribution> = Vec::new(&env);
        env.storage().persistent().set(&DataKey::Contributions(challenge_id), &empty_contributions);
        
        // Add challenge to participants' challenge lists
        for participant in participants.iter() {
            Self::add_challenge_to_user(&env, &participant, challenge_id);
            
            // Initialize participant stats
            let stats = ParticipantStats {
                total_contributed: 0,
                contribution_count: 0,
                last_contribution: 0,
                current_streak: 0,
            };
            env.storage().persistent().set(
                &DataKey::ParticipantStats(challenge_id, participant), 
                &stats
            );
        }
        
        // Update next challenge ID
        env.storage().instance().set(&DataKey::NextChallengeId, &(challenge_id + 1));
        
        // Emit event
        env.events().publish(
            (symbol_short!("created"), challenge_id), 
            (creator, name, goal_amount, participants.len())
        );
        
        log!(&env, "Challenge {} created by {} with goal {}", challenge_id, creator, goal_amount);
        
        Ok(challenge_id)
    }
    
    /// Make a contribution to a challenge
    pub fn contribute(
        env: Env,
        challenge_id: u32,
        contributor: Address,
        amount: i128,
    ) -> Result<(), SavingsError> {
        contributor.require_auth();
        
        if amount <= 0 {
            return Err(SavingsError::InsufficientAmount);
        }
        
        // Get challenge
        let mut challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        // Validate challenge state
        if !challenge.is_active {
            return Err(SavingsError::ChallengeInactive);
        }
        
        let current_time = env.ledger().timestamp();
        if current_time > challenge.deadline {
            return Err(SavingsError::ChallengeExpired);
        }
        
        // Check if contributor is a participant
        if !challenge.participants.contains(&contributor) {
            return Err(SavingsError::NotParticipant);
        }
        
        // Calculate week number
        let weeks_elapsed = (current_time - challenge.created_at) / (7 * 24 * 60 * 60);
        let week_number = weeks_elapsed as u32 + 1;
        
        // Create contribution record
        let contribution = Contribution {
            contributor: contributor.clone(),
            amount,
            timestamp: current_time,
            week_number,
        };
        
        // Add to contributions
        let mut contributions: Vec<Contribution> = env.storage().persistent()
            .get(&DataKey::Contributions(challenge_id))
            .unwrap_or(Vec::new(&env));
        contributions.push_back(contribution);
        env.storage().persistent().set(&DataKey::Contributions(challenge_id), &contributions);
        
        // Update challenge amount
        challenge.current_amount += amount;
        env.storage().persistent().set(&DataKey::Challenge(challenge_id), &challenge);
        
        // Update participant stats
        let mut stats: ParticipantStats = env.storage().persistent()
            .get(&DataKey::ParticipantStats(challenge_id, contributor.clone()))
            .unwrap_or(ParticipantStats {
                total_contributed: 0,
                contribution_count: 0,
                last_contribution: 0,
                current_streak: 0,
            });
        
        stats.total_contributed += amount;
        stats.contribution_count += 1;
        stats.last_contribution = current_time;
        
        // Update streak (simplified: increment if within 8 days of last contribution)
        if stats.last_contribution > 0 && (current_time - stats.last_contribution) <= (8 * 24 * 60 * 60) {
            stats.current_streak += 1;
        } else if stats.contribution_count == 1 {
            stats.current_streak = 1;
        } else {
            stats.current_streak = 1; // Reset streak
        }
        
        env.storage().persistent().set(
            &DataKey::ParticipantStats(challenge_id, contributor.clone()), 
            &stats
        );
        
        // Emit event
        env.events().publish(
            (symbol_short!("contrib"), challenge_id), 
            (contributor, amount, challenge.current_amount)
        );
        
        log!(&env, "Contribution {} to challenge {} by {}", amount, challenge_id, contributor);
        
        // Check if goal is reached
        if challenge.current_amount >= challenge.goal_amount {
            env.events().publish(
                (symbol_short!("goal_met"), challenge_id), 
                challenge.current_amount
            );
            log!(&env, "Challenge {} goal reached!", challenge_id);
        }
        
        Ok(())
    }
    
    /// Finalize a completed challenge
    pub fn finalize_challenge(
        env: Env,
        challenge_id: u32,
        finalizer: Address,
    ) -> Result<(), SavingsError> {
        finalizer.require_auth();
        
        // Get challenge
        let mut challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        // Check if finalizer is authorized (creator or participant)
        if challenge.creator != finalizer && !challenge.participants.contains(&finalizer) {
            return Err(SavingsError::NotAuthorized);
        }
        
        if !challenge.is_active {
            return Err(SavingsError::AlreadyFinalized);
        }
        
        let current_time = env.ledger().timestamp();
        let goal_reached = challenge.current_amount >= challenge.goal_amount;
        let time_expired = current_time > challenge.deadline;
        
        // Can only finalize if goal reached or time expired
        if !goal_reached && !time_expired {
            return Err(SavingsError::InvalidParameters);
        }
        
        // Mark as inactive
        challenge.is_active = false;
        env.storage().persistent().set(&DataKey::Challenge(challenge_id), &challenge);
        
        // Emit finalization event
        env.events().publish(
            (symbol_short!("finalized"), challenge_id), 
            (goal_reached, challenge.current_amount, current_time)
        );
        
        log!(&env, "Challenge {} finalized. Goal reached: {}", challenge_id, goal_reached);
        
        Ok(())
    }
    
    // ===== QUERY FUNCTIONS =====
    
    /// Get challenge details
    pub fn get_challenge(env: Env, challenge_id: u32) -> Result<SavingsChallenge, SavingsError> {
        env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)
    }
    
    /// Get challenge contributions
    pub fn get_contributions(env: Env, challenge_id: u32) -> Result<Vec<Contribution>, SavingsError> {
        // Verify challenge exists
        let _challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        let contributions: Vec<Contribution> = env.storage().persistent()
            .get(&DataKey::Contributions(challenge_id))
            .unwrap_or(Vec::new(&env));
        
        Ok(contributions)
    }
    
    /// Get participant statistics for a challenge
    pub fn get_participant_stats(
        env: Env, 
        challenge_id: u32, 
        participant: Address
    ) -> Result<ParticipantStats, SavingsError> {
        // Verify challenge exists
        let _challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        let stats: ParticipantStats = env.storage().persistent()
            .get(&DataKey::ParticipantStats(challenge_id, participant))
            .unwrap_or(ParticipantStats {
                total_contributed: 0,
                contribution_count: 0,
                last_contribution: 0,
                current_streak: 0,
            });
        
        Ok(stats)
    }
    
    /// Get challenges for a user
    pub fn get_user_challenges(env: Env, user: Address) -> Vec<u32> {
        env.storage().persistent()
            .get(&DataKey::UserChallenges(user))
            .unwrap_or(Vec::new(&env))
    }
    
    /// Get challenge progress information
    pub fn get_challenge_progress(env: Env, challenge_id: u32) -> Result<(i128, i128, u32, bool), SavingsError> {
        let challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        let current_time = env.ledger().timestamp();
        let weeks_elapsed = ((current_time - challenge.created_at) / (7 * 24 * 60 * 60)) as u32;
        let is_expired = current_time > challenge.deadline;
        
        Ok((
            challenge.current_amount,
            challenge.goal_amount,
            weeks_elapsed,
            is_expired
        ))
    }
    
    /// Check if user is participant in challenge
    pub fn is_participant(env: Env, challenge_id: u32, user: Address) -> Result<bool, SavingsError> {
        let challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        Ok(challenge.participants.contains(&user))
    }
    
    // ===== ADMIN FUNCTIONS =====
    
    /// Emergency pause/unpause (admin only)
    pub fn set_challenge_active(
        env: Env,
        challenge_id: u32,
        active: bool,
        admin: Address
    ) -> Result<(), SavingsError> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(SavingsError::NotAuthorized)?;
        
        if admin != stored_admin {
            return Err(SavingsError::NotAuthorized);
        }
        
        let mut challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        challenge.is_active = active;
        env.storage().persistent().set(&DataKey::Challenge(challenge_id), &challenge);
        
        env.events().publish(
            (symbol_short!("admin_set"), challenge_id), 
            (admin, active)
        );
        
        Ok(())
    }
    
    /// Get contract information
    pub fn get_contract_info(env: Env) -> (String, String) {
        env.storage().instance()
            .get(&DataKey::ContractInfo)
            .unwrap_or((
                String::from_str(&env, "StellarSave Challenge Contract"),
                String::from_str(&env, "1.0.0")
            ))
    }
    
    // ===== HELPER FUNCTIONS =====
    
    /// Add challenge ID to user's challenge list
    fn add_challenge_to_user(env: &Env, user: &Address, challenge_id: u32) {
        let mut user_challenges: Vec<u32> = env.storage().persistent()
            .get(&DataKey::UserChallenges(user.clone()))
            .unwrap_or(Vec::new(env));
        
        if !user_challenges.contains(&challenge_id) {
            user_challenges.push_back(challenge_id);
            env.storage().persistent().set(&DataKey::UserChallenges(user.clone()), &user_challenges);
        }
    }
    
    /// Calculate expected contribution amount by week
    pub fn get_expected_amount(env: Env, challenge_id: u32) -> Result<i128, SavingsError> {
        let challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        let current_time = env.ledger().timestamp();
        let weeks_elapsed = (current_time - challenge.created_at) / (7 * 24 * 60 * 60);
        
        let expected = (weeks_elapsed as i128) * challenge.weekly_amount;
        Ok(expected.min(challenge.goal_amount))
    }
    
    /// Get challenge statistics
    pub fn get_challenge_stats(env: Env, challenge_id: u32) -> Result<(u32, i128, i128, u32), SavingsError> {
        let challenge: SavingsChallenge = env.storage().persistent()
            .get(&DataKey::Challenge(challenge_id))
            .ok_or(SavingsError::ChallengeNotFound)?;
        
        let contributions: Vec<Contribution> = env.storage().persistent()
            .get(&DataKey::Contributions(challenge_id))
            .unwrap_or(Vec::new(&env));
        
        let participant_count = challenge.participants.len();
        let total_contributions = contributions.len();
        let average_contribution = if total_contributions > 0 {
            challenge.current_amount / total_contributions as i128
        } else {
            0
        };
        
        Ok((
            participant_count, 
            challenge.current_amount, 
            average_contribution, 
            total_contributions
        ))
    }
}