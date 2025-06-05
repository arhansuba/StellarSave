use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Map, Symbol
};

#[contracttype]
pub enum DataKey {
    Admin,
    TokenAddress,
    Deposit(Address), // User address -> Deposit
    TotalDeposits,
}

#[contracttype]
pub struct Deposit {
    user: Address,
    amount: i128,
    lock_time: u64,
    withdrawn: bool,
}

#[contract]
pub struct TimelockVault;

#[contractimpl]
impl TimelockVault {
    // Initialize the contract with an admin and the token address to be used
    pub fn initialize(env: Env, admin: Address, token_address: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
        env.storage().instance().set(&DataKey::TotalDeposits, &0i128);
    }

    // Deposit tokens with a timelock
    pub fn deposit(env: Env, user: Address, amount: i128, lock_days: u32) {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }
        
        // Get the token client
        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        
        // Transfer tokens from user to this contract
        token_client.transfer(&user, &env.current_contract_address(), &amount);
        
        // Calculate lock time (current time + lock_days in seconds)
        let current_time = env.ledger().timestamp();
        let lock_time = current_time + (lock_days as u64 * 24 * 60 * 60);
        
        // Create deposit record
        let deposit = Deposit {
            user: user.clone(),
            amount,
            lock_time,
            withdrawn: false,
        };
        
        // Store the deposit
        env.storage().instance().set(&DataKey::Deposit(user), &deposit);
        
        // Update total deposits
        let total_deposits: i128 = env.storage().instance().get(&DataKey::TotalDeposits).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalDeposits, &(total_deposits + amount));
    }
    
    // Withdraw tokens after timelock expires
    pub fn withdraw(env: Env, user: Address) -> i128 {
        user.require_auth();
        
        // Get user's deposit
        let mut deposit: Deposit = env.storage().instance()
            .get(&DataKey::Deposit(user.clone()))
            .expect("No deposit found for this user");
        
        // Check if already withdrawn
        if deposit.withdrawn {
            panic!("Deposit already withdrawn");
        }
        
        // Check if lock time has expired
        let current_time = env.ledger().timestamp();
        if current_time < deposit.lock_time {
            panic!("Tokens are still locked");
        }
        
        // Mark as withdrawn
        deposit.withdrawn = true;
        env.storage().instance().set(&DataKey::Deposit(user.clone()), &deposit);
        
        // Update total deposits
        let total_deposits: i128 = env.storage().instance().get(&DataKey::TotalDeposits).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalDeposits, &(total_deposits - deposit.amount));
        
        // Transfer tokens back to user
        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &user,
            &deposit.amount
        );
        
        deposit.amount
    }
    
    // Emergency withdraw (admin only, for emergency situations)
    pub fn emergency_withdraw(env: Env, user: Address) -> i128 {
        // Check admin permission
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        
        // Get user's deposit
        let mut deposit: Deposit = env.storage().instance()
            .get(&DataKey::Deposit(user.clone()))
            .expect("No deposit found for this user");
        
        // Check if already withdrawn
        if deposit.withdrawn {
            panic!("Deposit already withdrawn");
        }
        
        // Mark as withdrawn
        deposit.withdrawn = true;
        env.storage().instance().set(&DataKey::Deposit(user.clone()), &deposit);
        
        // Update total deposits
        let total_deposits: i128 = env.storage().instance().get(&DataKey::TotalDeposits).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalDeposits, &(total_deposits - deposit.amount));
        
        // Transfer tokens back to user
        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &user,
            &deposit.amount
        );
        
        deposit.amount
    }
    
    // Get deposit information
    pub fn get_deposit(env: Env, user: Address) -> Deposit {
        env.storage().instance()
            .get(&DataKey::Deposit(user))
            .expect("No deposit found for this user")
    }
    
    // Check if deposit can be withdrawn
    pub fn can_withdraw(env: Env, user: Address) -> bool {
        let deposit: Deposit = match env.storage().instance().get(&DataKey::Deposit(user)) {
            Some(d) => d,
            None => return false,
        };
        
        if deposit.withdrawn {
            return false;
        }
        
        let current_time = env.ledger().timestamp();
        current_time >= deposit.lock_time
    }
    
    // Get total deposits in the vault
    pub fn get_total_deposits(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalDeposits).unwrap_or(0)
    }
}
