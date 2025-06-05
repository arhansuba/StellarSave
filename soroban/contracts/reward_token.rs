use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String,
};

#[contracttype]
pub enum DataKey {
    Admin,
    TokenName,
    TokenSymbol,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
    Decimals,
}

#[contract]
pub struct RewardToken;

#[contractimpl]
impl RewardToken {
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
        total_supply: i128,
    ) {
        if decimals > 18 || total_supply <= 0 {
            panic!("Invalid parameters");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenName, &name);
        env.storage().instance().set(&DataKey::TokenSymbol, &symbol);
        env.storage().instance().set(&DataKey::TotalSupply, &total_supply);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::Balance(admin.clone()), &total_supply);
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::TokenName).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::TokenSymbol).unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap()
    }

    pub fn balance_of(env: Env, addr: Address) -> i128 {
        env.storage().instance().get(&DataKey::Balance(addr)).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> bool {
        from.require_auth();
        
        if amount <= 0 {
            panic!("Invalid amount");
        }

        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount {
            panic!("Insufficient balance");
        }

        let to_balance = Self::balance_of(env.clone(), to.clone());
        
        env.storage().instance().set(&DataKey::Balance(from), &(from_balance - amount));
        env.storage().instance().set(&DataKey::Balance(to), &(to_balance + amount));

        true
    }

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        env.storage().instance().get(&DataKey::Allowance(owner, spender)).unwrap_or(0)
    }

    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) -> bool {
        owner.require_auth();

        if amount < 0 {
            panic!("Invalid amount");
        }

        env.storage().instance().set(&DataKey::Allowance(owner, spender), &amount);
        
        true
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> bool {
        spender.require_auth();

        if amount <= 0 {
            panic!("Invalid amount");
        }

        let allowed = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowed < amount {
            panic!("Insufficient allowance");
        }

        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount {
            panic!("Insufficient balance");
        }

        let to_balance = Self::balance_of(env.clone(), to.clone());

        env.storage().instance().set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage().instance().set(&DataKey::Balance(to), &(to_balance + amount));
        env.storage().instance().set(&DataKey::Allowance(from, spender), &(allowed - amount));

        true
    }

    // Admin function to mint new tokens
    pub fn mint(env: Env, to: Address, amount: i128) -> bool {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if amount <= 0 {
            panic!("Invalid amount");
        }

        let balance = Self::balance_of(env.clone(), to.clone());
        let total = Self::total_supply(env.clone());

        env.storage().instance().set(&DataKey::Balance(to), &(balance + amount));
        env.storage().instance().set(&DataKey::TotalSupply, &(total + amount));

        true
    }

    // Admin function to burn tokens
    pub fn burn(env: Env, from: Address, amount: i128) -> bool {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if amount <= 0 {
            panic!("Invalid amount");
        }

        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }

        let total = Self::total_supply(env.clone());

        env.storage().instance().set(&DataKey::Balance(from), &(balance - amount));
        env.storage().instance().set(&DataKey::TotalSupply, &(total - amount));

        true
    }
}
