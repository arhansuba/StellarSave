use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Map, Symbol, Vec, BytesN,
    symbol_short, log, events,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Challenge(BytesN<32>),     // Challenge ID -> Challenge
    UserChallenges(Address),   // User -> Vector of challenge IDs
    TotalChallenges,
    UserProgress(BytesN<32>, Address), // Challenge ID, User -> UserProgress
    GroupMilestones(BytesN<32>),       // Challenge ID -> Vec<Milestone>
    UserMilestones(BytesN<32>, Address), // Challenge ID, User -> Vec<Milestone>
}

#[contracttype]
pub struct Challenge {
    id: BytesN<32>,
    creator: Address,
    target_amount: i128,
    duration_days: u32,
    start_time: u64,
    reward_percentage: u32,     // Basis points (e.g., 500 = 5%)
    participants: Vec<Address>,
    completed_users: Vec<Address>,
    vault_address: Address,
    reward_token: Address,
    active: bool,
    min_weekly_deposit: i128,   // Minimum weekly deposit amount
    group_target: i128,         // Total group target (sum of all individual targets)
    challenge_type: ChallengeType,
    social_features: SocialFeatures,
}

#[contracttype]
pub enum ChallengeType {
    Fixed,                // Fixed amount each period
    Incremental,          // Increasing amount each period (e.g., +5 XLM each week)
    Percentage,           // Percentage of income/custom amount
    Custom,               // Custom schedule defined by creator
}

#[contracttype]
pub struct SocialFeatures {
    public_leaderboard: bool,   // Show participant progress publicly
    enable_cheering: bool,      // Allow participants to cheer each other
    allow_group_milestone: bool, // Enable group milestones
}

#[contracttype]
pub struct UserProgress {
    challenge_id: BytesN<32>,
    user: Address,
    current_amount: i128,
    last_deposit_time: u64,
    streak_weeks: u32,           // Consecutive weeks with deposits
    deposits_history: Vec<Deposit>, // History of all deposits
    completed: bool,
}

#[contracttype]
pub struct Deposit {
    amount: i128,
    timestamp: u64,
    week_number: u32,
}

#[contracttype]
pub struct Milestone {
    description: Symbol,
    target_amount: i128,
    reached: bool,
    reached_at: u64,
    reward_bonus: u32,         // Additional bonus in basis points
}

// Event types for notifications
#[contracttype]
pub enum SavingsEvent {
    ChallengeCreated(BytesN<32>),
    UserJoined(BytesN<32>, Address),
    DepositMade(BytesN<32>, Address, i128),
    MilestoneReached(BytesN<32>, Symbol),
    ChallengeCompleted(BytesN<32>, Address),
    StreakAchieved(BytesN<32>, Address, u32),
}

#[contract]
pub struct SavingsChallenge;

#[contractimpl]
impl SavingsChallenge {
    // Initialize the contract with an admin
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalChallenges, &0u32);
    }

    // Create a new savings challenge with enhanced features
    pub fn create_challenge(
        env: Env,
        creator: Address,
        target_amount: i128,
        duration_days: u32,
        reward_percentage: u32,
        vault_address: Address,
        reward_token: Address,
        min_weekly_deposit: i128,
        challenge_type: ChallengeType,
        social_features: SocialFeatures,
    ) -> BytesN<32> {
        creator.require_auth();
        
        // Validate inputs
        if target_amount <= 0 || duration_days == 0 || reward_percentage > 10000 || min_weekly_deposit < 0 {
            panic!("Invalid challenge parameters");
        }
        
        let challenge_count: u32 = env.storage().instance().get(&DataKey::TotalChallenges).unwrap_or(0);
        let id = env.crypto().sha256(&challenge_count.to_be_bytes());
        
        // Calculate group target (initially just individual target, will be updated as users join)
        let group_target = target_amount;
        
        let challenge = Challenge {
            id: id.clone(),
            creator,
            target_amount,
            duration_days,
            start_time: env.ledger().timestamp(),
            reward_percentage,
            participants: Vec::new(&env),
            completed_users: Vec::new(&env),
            vault_address,
            reward_token,
            active: true,
            min_weekly_deposit,
            group_target,
            challenge_type,
            social_features,
        };
        
        env.storage().instance().set(&DataKey::Challenge(id.clone()), &challenge);
        env.storage().instance().set(&DataKey::TotalChallenges, &(challenge_count + 1));
        
        // Create default group milestones
        let mut milestones = Vec::new(&env);
        
        // 25% milestone
        milestones.push_back(Milestone {
            description: symbol_short!("25% Complete"),
            target_amount: target_amount / 4,
            reached: false,
            reached_at: 0,
            reward_bonus: 50, // 0.5% bonus
        });
        
        // 50% milestone
        milestones.push_back(Milestone {
            description: symbol_short!("50% Complete"),
            target_amount: target_amount / 2,
            reached: false,
            reached_at: 0,
            reward_bonus: 100, // 1% bonus
        });
        
        // 75% milestone
        milestones.push_back(Milestone {
            description: symbol_short!("75% Complete"),
            target_amount: target_amount * 3 / 4,
            reached: false,
            reached_at: 0,
            reward_bonus: 150, // 1.5% bonus
        });
        
        env.storage().instance().set(&DataKey::GroupMilestones(id.clone()), &milestones);
        
        // Emit event for challenge creation
        env.events().publish(
            (Symbol::new(&env, "savings_challenge"), Symbol::new(&env, "created")),
            SavingsEvent::ChallengeCreated(id.clone())
        );
        
        id
    }
    
    // Join a savings challenge with user-specific progress tracking
    pub fn join_challenge(env: Env, user: Address, challenge_id: BytesN<32>) {
        user.require_auth();
        
        let mut challenge: Challenge = env.storage().instance()
            .get(&DataKey::Challenge(challenge_id.clone()))
            .expect("Challenge not found");
            
        // Check if the challenge is active
        if !challenge.active {
            panic!("Challenge is not active");
        }
        
        // Check if user is already a participant
        for participant in challenge.participants.iter() {
            if &participant == &user {
                panic!("User already joined this challenge");
            }
        }
        
        // Add user to participants
        challenge.participants.push_back(user.clone());
        
        // Update group target
        challenge.group_target += challenge.target_amount;
        
        // Update challenge
        env.storage().instance().set(&DataKey::Challenge(challenge_id.clone()), &challenge);
        
        // Add challenge to user's challenges
        let mut user_challenges: Vec<BytesN<32>> = env.storage().instance()
            .get(&DataKey::UserChallenges(user.clone()))
            .unwrap_or(Vec::new(&env));
            
        user_challenges.push_back(challenge_id.clone());
        env.storage().instance().set(&DataKey::UserChallenges(user.clone()), &user_challenges);
        
        // Initialize user progress
        let user_progress = UserProgress {
            challenge_id: challenge_id.clone(),
            user: user.clone(),
            current_amount: 0,
            last_deposit_time: env.ledger().timestamp(),
            streak_weeks: 0,
            deposits_history: Vec::new(&env),
            completed: false,
        };
        
        env.storage().instance().set(&DataKey::UserProgress(challenge_id.clone(), user.clone()), &user_progress);
        
        // Create user-specific milestones (same as group milestones initially)
        let group_milestones: Vec<Milestone> = env.storage().instance()
            .get(&DataKey::GroupMilestones(challenge_id.clone()))
            .expect("Group milestones not found");
            
        env.storage().instance().set(&DataKey::UserMilestones(challenge_id.clone(), user.clone()), &group_milestones);
        
        // Emit event
        env.events().publish(
            (Symbol::new(&env, "savings_challenge"), Symbol::new(&env, "joined")),
            SavingsEvent::UserJoined(challenge_id, user)
        );
    }
    
    // Enhanced deposit function with streak and milestone tracking
    pub fn deposit(
        env: Env, 
        user: Address, 
        challenge_id: BytesN<32>,
        amount: i128,
    ) {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Deposit amount must be positive");
        }
        
        let challenge: Challenge = env.storage().instance()
            .get(&DataKey::Challenge(challenge_id.clone()))
            .expect("Challenge not found");
            
        if !challenge.active {
            panic!("Challenge is not active");
        }
        
        // Check if user is a participant
        let mut is_participant = false;
        for participant in challenge.participants.iter() {
            if &participant == &user {
                is_participant = true;
                break;
            }
        }
        
        if !is_participant {
            panic!("User is not a participant in this challenge");
        }
        
        // Get user progress
        let mut user_progress: UserProgress = env.storage().instance()
            .get(&DataKey::UserProgress(challenge_id.clone(), user.clone()))
            .expect("User progress not found");
        
        // Check if this is a weekly deposit (if applicable)
        let current_time = env.ledger().timestamp();
        let week_in_seconds: u64 = 7 * 24 * 60 * 60;
        
        // Calculate week number since challenge started
        let weeks_elapsed = (current_time - challenge.start_time) / week_in_seconds;
        let current_week = weeks_elapsed as u32 + 1; // Add 1 so first week is week 1, not 0
        
        // Check if this is a new week
        let last_deposit_week = (user_progress.last_deposit_time - challenge.start_time) / week_in_seconds;
        
        // Update streak if deposit is made in a consecutive week
        if weeks_elapsed > last_deposit_week && weeks_elapsed <= last_deposit_week + 1 {
            user_progress.streak_weeks += 1;
            
            // Emit streak event on significant streaks
            if user_progress.streak_weeks % 4 == 0 {
                env.events().publish(
                    (Symbol::new(&env, "savings_challenge"), Symbol::new(&env, "streak")),
                    SavingsEvent::StreakAchieved(challenge_id.clone(), user.clone(), user_progress.streak_weeks)
                );
            }
        }
        // Reset streak if user missed a week
        else if weeks_elapsed > last_deposit_week + 1 {
            user_progress.streak_weeks = 1; // Reset to 1 for the current week
        }
        
        // Transfer funds to the vault
        let client = token::Client::new(&env, &challenge.vault_address);
        client.transfer(&user, &env.current_contract_address(), &amount);
        
        // Add to deposit history
        let deposit = Deposit {
            amount,
            timestamp: current_time,
            week_number: current_week,
        };
        
        user_progress.deposits_history.push_back(deposit);
        user_progress.current_amount += amount;
        user_progress.last_deposit_time = current_time;
        
        // Update user progress
        env.storage().instance().set(&DataKey::UserProgress(challenge_id.clone(), user.clone()), &user_progress);
        
        // Check for user milestones
        Self::check_user_milestones(env.clone(), challenge_id.clone(), user.clone(), user_progress.current_amount);
        
        // Check for group milestones
        Self::check_group_milestones(env.clone(), challenge_id.clone());
        
        // Emit deposit event
        env.events().publish(
            (Symbol::new(&env, "savings_challenge"), Symbol::new(&env, "deposit")),
            SavingsEvent::DepositMade(challenge_id, user, amount)
        );
    }
    
    // Helper function to check user milestones
    fn check_user_milestones(env: Env, challenge_id: BytesN<32>, user: Address, current_amount: i128) {
        let mut milestones: Vec<Milestone> = env.storage().instance()
            .get(&DataKey::UserMilestones(challenge_id.clone(), user.clone()))
            .expect("User milestones not found");
            
        let mut updated = false;
        
        for i in 0..milestones.len() {
            let mut milestone = milestones.get(i).unwrap();
            
            // If milestone is not reached yet and user has reached the amount
            if !milestone.reached && current_amount >= milestone.target_amount {
                milestone.reached = true;
                milestone.reached_at = env.ledger().timestamp();
                milestones.set(i, milestone.clone());
                updated = true;
                
                // Emit milestone event
                env.events().publish(
                    (Symbol::new(&env, "savings_challenge"), Symbol::new(&env, "milestone")),
                    SavingsEvent::MilestoneReached(challenge_id.clone(), milestone.description)
                );
                
                // Award milestone bonus (could be implemented here or tracked for later reward)
            }
        }
        
        if updated {
            env.storage().instance().set(&DataKey::UserMilestones(challenge_id, user), &milestones);
        }
    }
    
    // Helper function to check group milestones
    fn check_group_milestones(env: Env, challenge_id: BytesN<32>) {
        let challenge: Challenge = env.storage().instance()
            .get(&DataKey::Challenge(challenge_id.clone()))
            .expect("Challenge not found");
            
        let mut milestones: Vec<Milestone> = env.storage().instance()
            .get(&DataKey::GroupMilestones(challenge_id.clone()))
            .expect("Group milestones not found");
            
        // Calculate total amount saved by all participants
        let mut total_saved: i128 = 0;
        
        for participant in challenge.participants.iter() {
            let user_progress: UserProgress = env.storage().instance()
                .get(&DataKey::UserProgress(challenge_id.clone(), participant.clone()))
                .unwrap_or(UserProgress {
                    challenge_id: challenge_id.clone(),
                    user: participant.clone(),
                    current_amount: 0,
                    last_deposit_time: 0,
                    streak_weeks: 0,
                    deposits_history: Vec::new(&env),
                    completed: false,
                });
                
            total_saved += user_progress.current_amount;
        }
        
        let mut updated = false;
        
        for i in 0..milestones.len() {
            let mut milestone = milestones.get(i).unwrap();
            
            // If milestone is not reached yet and group has reached the amount
            if !milestone.reached && total_saved >= milestone.target_amount {
                milestone.reached = true;
                milestone.reached_at = env.ledger().timestamp();
                milestones.set(i, milestone.clone());
                updated = true;
                
                // Emit milestone event
                env.events().publish(
                    (Symbol::new(&env, "savings_challenge"), Symbol::new(&env, "group_milestone")),
                    SavingsEvent::MilestoneReached(challenge_id.clone(), milestone.description)
                );
            }
        }
        
        if updated {
            env.storage().instance().set(&DataKey::GroupMilestones(challenge_id), &milestones);
        }
    }
    
    // Complete a challenge with enhanced reward calculation
    pub fn complete_challenge(env: Env, user: Address, challenge_id: BytesN<32>) {
        user.require_auth();
        
        let mut challenge: Challenge = env.storage().instance()
            .get(&DataKey::Challenge(challenge_id.clone()))
            .expect("Challenge not found");
            
        if !challenge.active {
            panic!("Challenge is not active");
        }
        
        // Get user progress
        let mut user_progress: UserProgress = env.storage().instance()
            .get(&DataKey::UserProgress(challenge_id.clone(), user.clone()))
            .expect("User progress not found");
            
        // Check if user has already completed this challenge
        if user_progress.completed {
            panic!("User has already completed this challenge");
        }
            
        // Check if user has reached the target amount
        if user_progress.current_amount < challenge.target_amount {
            panic!("Target amount not reached");
        }
        
        // Check if challenge duration has passed
        let current_time = env.ledger().timestamp();
        let end_time = challenge.start_time + (challenge.duration_days as u64 * 24 * 60 * 60);
        
        if current_time < end_time {
            panic!("Challenge duration has not ended yet");
        }
        
        // Mark user as completed
        challenge.completed_users.push_back(user.clone());
        
        // Update challenge
        env.storage().instance().set(&DataKey::Challenge(challenge_id.clone()), &challenge);
        
        // Mark user progress as completed
        user_progress.completed = true;
        env.storage().instance().set(&DataKey::UserProgress(challenge_id.clone(), user.clone()), &user_progress);
        
        // Calculate base reward
        let mut reward_percentage = challenge.reward_percentage;
        
        // Add bonus for milestones
        let user_milestones: Vec<Milestone> = env.storage().instance()
            .get(&DataKey::UserMilestones(challenge_id.clone(), user.clone()))
            .expect("User milestones not found");
            
        for milestone in user_milestones.iter() {
            if milestone.reached {
                reward_percentage += milestone.reward_bonus;
            }
        }
        
        // Add streak bonus (0.5% for every 4 weeks of streak)
        let streak_bonus = (user_progress.streak_weeks / 4) * 50; // 50 basis points = 0.5%
        reward_percentage += streak_bonus;
        
        // Calculate final reward
        let reward_amount = (challenge.target_amount * reward_percentage as i128) / 10000;
        
        // Transfer rewards
        let reward_token_client = token::Client::new(&env, &challenge.reward_token);
        reward_token_client.transfer(
            &env.current_contract_address(), 
            &user, 
            &reward_amount
        );
        
        // Emit completion event
        env.events().publish(
            (Symbol::new(&env, "savings_challenge"), Symbol::new(&env, "completed")),
            SavingsEvent::ChallengeCompleted(challenge_id, user)
        );
    }
    
    // Get enhanced user progress
    pub fn get_user_progress(env: Env, challenge_id: BytesN<32>, user: Address) -> UserProgress {
        env.storage().instance()
            .get(&DataKey::UserProgress(challenge_id, user))
            .expect("User progress not found")
    }
    
    // Get user milestones
    pub fn get_user_milestones(env: Env, challenge_id: BytesN<32>, user: Address) -> Vec<Milestone> {
        env.storage().instance()
            .get(&DataKey::UserMilestones(challenge_id, user))
            .expect("User milestones not found")
    }
    
    // Get group milestones
    pub fn get_group_milestones(env: Env, challenge_id: BytesN<32>) -> Vec<Milestone> {
        env.storage().instance()
            .get(&DataKey::GroupMilestones(challenge_id))
            .expect("Group milestones not found")
    }
    
    // Create custom milestones for a challenge
    pub fn create_milestone(
        env: Env,
        creator: Address,
        challenge_id: BytesN<32>,
        description: Symbol,
        target_amount: i128,
        reward_bonus: u32,
    ) {
        creator.require_auth();
        
        let challenge: Challenge = env.storage().instance()
            .get(&DataKey::Challenge(challenge_id.clone()))
            .expect("Challenge not found");
            
        // Only the creator of the challenge can add milestones
        if challenge.creator != creator {
            panic!("Only challenge creator can add milestones");
        }
        
        let milestone = Milestone {
            description,
            target_amount,
            reached: false,
            reached_at: 0,
            reward_bonus,
        };
        
        let mut group_milestones: Vec<Milestone> = env.storage().instance()
            .get(&DataKey::GroupMilestones(challenge_id.clone()))
            .expect("Group milestones not found");
            
        group_milestones.push_back(milestone);
        env.storage().instance().set(&DataKey::GroupMilestones(challenge_id), &group_milestones);
    }
    
    // Add functions to create custom user milestones, challenge management, etc.
    
    // Get user challenges (existing function)
    pub fn get_user_challenges(env: Env, user: Address) -> Vec<BytesN<32>> {
        env.storage().instance()
            .get(&DataKey::UserChallenges(user))
            .unwrap_or(Vec::new(&env))
    }
    
    // Get challenge details (existing function)
    pub fn get_challenge(env: Env, challenge_id: BytesN<32>) -> Challenge {
        env.storage().instance()
            .get(&DataKey::Challenge(challenge_id))
            .expect("Challenge not found")
    }
}
