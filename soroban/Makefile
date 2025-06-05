# SOROBAN envs that are sourced by stellar-cli automatically:
export STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
export STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
export STELLAR_ACCOUNT=default

# Choose an asset to use:
export ASSET=USDC:GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP 		# Our USD
# export ASSET=USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 	# CIRCLE USDC
# export ASSET=native		 													# XLM

# Factory and Wallet contracts
export WEBAUTHN_FACTORY=CAJWHSAL56JEL64QKPAODVK3WDHC2DFXDR5MRLOTQDXTIVAFFS5O3ACO
export WEBAUTHN_WASM=739eef7fae6d43b04a36f778dae6946436cff37712e328b46e8dabc9ea5917d9

generate-default-account:
	stellar keys generate default --global

clean:
	rm -rf out/
	rm -rf contracts/webauth-verify/target/
	rm -rf contracts/webauthn-factory/target/
	rm -rf contracts/webauthn-wallet/target/
	@cd contracts/webauth-verify && cargo clean
	@cd contracts/webauthn-factory && cargo clean
	@cd contracts/webauthn-wallet && cargo clean

fmt:
	@cd contracts/webauth-verify && cargo fmt --all
	@cd contracts/webauthn-factory && cargo fmt --all
	@cd contracts/webauthn-wallet && cargo fmt --all

build:
	rm -rf out/

	rm -rf contracts/webauth-verify/target/wasm32-unknown-unknown/
	@cd contracts/webauth-verify && stellar contract build --package webauth-verify --out-dir ../../out
	stellar contract optimize --wasm ./out/webauth_verify.wasm
	
	rm -rf contracts/webauthn-wallet/target/wasm32-unknown-unknown/
	@cd contracts/webauthn-wallet && stellar contract build --package webauthn-wallet --out-dir ../../out
	stellar contract optimize --wasm ./out/webauthn_wallet.wasm

	rm -rf contracts/webauthn-factory/target/wasm32-unknown-unknown/
	@cd contracts/webauthn-factory && stellar contract build --package webauthn-factory --out-dir ../../out
	stellar contract optimize --wasm ./out/webauthn_factory.wasm

get-or-create-token-contract:
	stellar contract asset deploy --asset $(ASSET) 2>/dev/null || stellar contract id asset --asset $(ASSET)

deploy:
	stellar contract deploy --wasm ./out/webauth_verify.optimized.wasm
	stellar contract deploy --wasm ./out/webauthn_factory.optimized.wasm
	stellar contract install --wasm ./out/webauthn_wallet.optimized.wasm

init:
	stellar contract invoke --id $(WEBAUTHN_FACTORY) -- init --wasm_hash $(WEBAUTHN_WASM)
# soroban/Makefile
# StellarSave Enhanced Makefile for Building and Deploying Contracts

# Default values
DEPLOY_ACCOUNT ?= alice
DEPLOY_NETWORK ?= testnet

# Contract paths
WEBAUTH_VERIFY_WASM = target/wasm32-unknown-unknown/release/webauth_verify.wasm
WEBAUTHN_FACTORY_WASM = target/wasm32-unknown-unknown/release/webauthn_factory.wasm
WEBAUTHN_WALLET_WASM = target/wasm32-unknown-unknown/release/webauthn_wallet.wasm
SAVINGS_CHALLENGE_WASM = target/wasm32-unknown-unknown/release/savings_challenge.wasm
REWARD_TOKEN_WASM = target/wasm32-unknown-unknown/release/reward_token.wasm

# ===== BUILD TARGETS =====

all: build build-stellarsave
	@echo "✅ All contracts built successfully!"

build: build-webauth build-factory build-wallet
	@echo "✅ SEP wallet contracts built"

build-stellarsave: build-savings-challenge build-reward-token
	@echo "✅ StellarSave contracts built"

build-webauth:
	@echo "🏗️ Building webauth-verify contract..."
	@cargo build --target wasm32-unknown-unknown --release --package webauth-verify

build-factory:
	@echo "🏗️ Building webauthn-factory contract..."
	@cargo build --target wasm32-unknown-unknown --release --package webauthn-factory

build-wallet:
	@echo "🏗️ Building webauthn-wallet contract..."
	@cargo build --target wasm32-unknown-unknown --release --package webauthn-wallet

build-savings-challenge:
	@echo "🏗️ Building savings-challenge contract..."
	@cargo build --target wasm32-unknown-unknown --release --package savings-challenge

build-reward-token:
	@echo "🏗️ Building reward-token contract..."
	@cargo build --target wasm32-unknown-unknown --release --package reward-token

# ===== DEPLOYMENT TARGETS =====

deploy-all: deploy deploy-stellarsave
	@echo "🚀 All contracts deployed successfully!"

deploy: build deploy-webauth deploy-factory deploy-wallet
	@echo "🚀 SEP wallet contracts deployed"

deploy-stellarsave: build-stellarsave deploy-savings-challenge deploy-reward-token link-contracts
	@echo "🚀 StellarSave contracts deployed and linked!"

deploy-webauth:
	@echo "🚀 Deploying webauth-verify contract..."
	@WEBAUTH_ID=$$(stellar contract deploy \
		--wasm $(WEBAUTH_VERIFY_WASM) \
		--source $(DEPLOY_ACCOUNT) \
		--network $(DEPLOY_NETWORK)) && \
	echo "✅ WebAuth Verify Contract: $$WEBAUTH_ID" && \
	echo "$$WEBAUTH_ID" > .contract-ids/webauth-verify.txt

deploy-factory:
	@echo "🚀 Deploying webauthn-factory contract..."
	@FACTORY_ID=$$(stellar contract deploy \
		--wasm $(WEBAUTHN_FACTORY_WASM) \
		--source $(DEPLOY_ACCOUNT) \
		--network $(DEPLOY_NETWORK)) && \
	echo "✅ WebAuthn Factory Contract: $$FACTORY_ID" && \
	echo "$$FACTORY_ID" > .contract-ids/webauthn-factory.txt

deploy-wallet:
	@echo "🚀 Deploying webauthn-wallet contract..."
	@WALLET_ID=$$(stellar contract deploy \
		--wasm $(WEBAUTHN_WALLET_WASM) \
		--source $(DEPLOY_ACCOUNT) \
		--network $(DEPLOY_NETWORK)) && \
	echo "✅ WebAuthn Wallet Contract: $$WALLET_ID" && \
	echo "$$WALLET_ID" > .contract-ids/webauthn-wallet.txt

deploy-savings-challenge:
	@echo "🚀 Deploying savings-challenge contract..."
	@mkdir -p .contract-ids
	@SAVINGS_ID=$$(stellar contract deploy \
		--wasm $(SAVINGS_CHALLENGE_WASM) \
		--source $(DEPLOY_ACCOUNT) \
		--network $(DEPLOY_NETWORK)) && \
	echo "✅ Savings Challenge Contract: $$SAVINGS_ID" && \
	echo "$$SAVINGS_ID" > .contract-ids/savings-challenge.txt && \
	echo "🔧 Initializing savings challenge contract..." && \
	stellar contract invoke \
		--id "$$SAVINGS_ID" \
		--source $(DEPLOY_ACCOUNT) \
		--network $(DEPLOY_NETWORK) \
		-- initialize \
		--admin $$(stellar keys address $(DEPLOY_ACCOUNT))

deploy-reward-token:
	@echo "🚀 Deploying reward-token contract..."
	@mkdir -p .contract-ids
	@REWARD_ID=$$(stellar contract deploy \
		--wasm $(REWARD_TOKEN_WASM) \
		--source $(DEPLOY_ACCOUNT) \
		--network $(DEPLOY_NETWORK)) && \
	echo "✅ Reward Token Contract: $$REWARD_ID" && \
	echo "$$REWARD_ID" > .contract-ids/reward-token.txt && \
	echo "🔧 Initializing SaveCoin token..." && \
	stellar contract invoke \
		--id "$$REWARD_ID" \
		--source $(DEPLOY_ACCOUNT) \
		--network $(DEPLOY_NETWORK) \
		-- initialize \
		--admin $$(stellar keys address $(DEPLOY_ACCOUNT)) \
		--name "SaveCoin" \
		--symbol "SAVE" \
		--decimals 7

# ===== CONTRACT LINKING =====

link-contracts:
	@echo "🔗 Linking StellarSave contracts..."
	@if [ -f .contract-ids/savings-challenge.txt ] && [ -f .contract-ids/reward-token.txt ]; then \
		SAVINGS_ID=$$(cat .contract-ids/savings-challenge.txt) && \
		REWARD_ID=$$(cat .contract-ids/reward-token.txt) && \
		echo "🔧 Adding savings contract as SaveCoin minter..." && \
		stellar contract invoke \
			--id "$$REWARD_ID" \
			--source $(DEPLOY_ACCOUNT) \
			--network $(DEPLOY_NETWORK) \
			-- add_minter \
			--admin $$(stellar keys address $(DEPLOY_ACCOUNT)) \
			--minter "$$SAVINGS_ID" && \
		echo "✅ Contracts linked successfully!"; \
	else \
		echo "❌ Contract deployment files not found. Deploy contracts first."; \
	fi

# ===== TESTING TARGETS =====

test: test-wallet test-stellarsave

test-wallet:
	@echo "🧪 Testing SEP wallet contracts..."
	@cargo test --package webauth-verify
	@cargo test --package webauthn-factory  
	@cargo test --package webauthn-wallet

test-stellarsave:
	@echo "🧪 Testing StellarSave contracts..."
	@cargo test --package savings-challenge
	@cargo test --package reward-token

# ===== UTILITY TARGETS =====

clean:
	@echo "🧹 Cleaning build artifacts..."
	@cargo clean
	@rm -rf .contract-ids/

check:
	@echo "🔍 Checking contract code..."
	@cargo check --target wasm32-unknown-unknown --release

fmt:
	@echo "🎨 Formatting contract code..."
	@cargo fmt

lint:
	@echo "🔍 Linting contract code..."
	@cargo clippy --target wasm32-unknown-unknown --release -- -D warnings

# ===== CONTRACT INFO =====

contract-ids:
	@echo "📋 Deployed Contract IDs:"
	@echo "========================"
	@if [ -f .contract-ids/webauth-verify.txt ]; then \
		echo "WebAuth Verify:     $$(cat .contract-ids/webauth-verify.txt)"; \
	fi
	@if [ -f .contract-ids/webauthn-factory.txt ]; then \
		echo "WebAuthn Factory:   $$(cat .contract-ids/webauthn-factory.txt)"; \
	fi
	@if [ -f .contract-ids/webauthn-wallet.txt ]; then \
		echo "WebAuthn Wallet:    $$(cat .contract-ids/webauthn-wallet.txt)"; \
	fi
	@if [ -f .contract-ids/savings-challenge.txt ]; then \
		echo "Savings Challenge:  $$(cat .contract-ids/savings-challenge.txt)"; \
	fi
	@if [ -f .contract-ids/reward-token.txt ]; then \
		echo "SaveCoin Token:     $$(cat .contract-ids/reward-token.txt)"; \
	fi

contract-info:
	@echo "📊 StellarSave Contract Information:"
	@echo "===================================="
	@if [ -f .contract-ids/savings-challenge.txt ]; then \
		SAVINGS_ID=$$(cat .contract-ids/savings-challenge.txt) && \
		echo "🎯 Savings Challenge Contract: $$SAVINGS_ID" && \
		stellar contract invoke \
			--id "$$SAVINGS_ID" \
			--source $(DEPLOY_ACCOUNT) \
			--network $(DEPLOY_NETWORK) \
			-- get_contract_info; \
	fi
	@if [ -f .contract-ids/reward-token.txt ]; then \
		REWARD_ID=$$(cat .contract-ids/reward-token.txt) && \
		echo "🪙 SaveCoin Token Contract: $$REWARD_ID" && \
		echo "Token Name: $$(stellar contract invoke --id "$$REWARD_ID" --source $(DEPLOY_ACCOUNT) --network $(DEPLOY_NETWORK) -- name)" && \
		echo "Token Symbol: $$(stellar contract invoke --id "$$REWARD_ID" --source $(DEPLOY_ACCOUNT) --network $(DEPLOY_NETWORK) -- symbol)" && \
		echo "Total Supply: $$(stellar contract invoke --id "$$REWARD_ID" --source $(DEPLOY_ACCOUNT) --network $(DEPLOY_NETWORK) -- total_supply)"; \
	fi

# ===== ENV FILE GENERATION =====

generate-env:
	@echo "📝 Generating .env file for frontend..."
	@echo "# StellarSave Contract Addresses (Auto-generated)" > ../.env.local
	@echo "# Generated on $$(date)" >> ../.env.local
	@echo "" >> ../.env.local
	@if [ -f .contract-ids/savings-challenge.txt ]; then \
		echo "VITE_SAVINGS_CONTRACT_ID=$$(cat .contract-ids/savings-challenge.txt)" >> ../.env.local; \
	fi
	@if [ -f .contract-ids/reward-token.txt ]; then \
		echo "VITE_REWARD_TOKEN_CONTRACT_ID=$$(cat .contract-ids/reward-token.txt)" >> ../.env.local; \
	fi
	@echo "VITE_STELLAR_NETWORK=$(DEPLOY_NETWORK)" >> ../.env.local
	@echo "✅ Environment file generated at ../.env.local"

# ===== HELP =====

help:
	@echo "StellarSave Smart Contract Build System"
	@echo "========================================"
	@echo ""
	@echo "📦 BUILD COMMANDS:"
	@echo "  make build              - Build SEP wallet contracts"
	@echo "  make build-stellarsave  - Build StellarSave contracts"
	@echo "  make all               - Build all contracts"
	@echo ""
	@echo "🚀 DEPLOYMENT COMMANDS:"
	@echo "  make deploy            - Deploy SEP wallet contracts"
	@echo "  make deploy-stellarsave - Deploy StellarSave contracts"
	@echo "  make deploy-all        - Deploy all contracts"
	@echo ""
	@echo "🧪 TESTING COMMANDS:"
	@echo "  make test              - Run all tests"
	@echo "  make test-wallet       - Test SEP wallet contracts"
	@echo "  make test-stellarsave  - Test StellarSave contracts"
	@echo ""
	@echo "🔧 UTILITY COMMANDS:"
	@echo "  make clean             - Clean build artifacts"
	@echo "  make check             - Check contract code"
	@echo "  make fmt               - Format contract code"
	@echo "  make lint              - Lint contract code"
	@echo ""
	@echo "📋 INFO COMMANDS:"
	@echo "  make contract-ids      - Show deployed contract IDs"
	@echo "  make contract-info     - Show contract information"
	@echo "  make generate-env      - Generate .env file for frontend"
	@echo ""
	@echo "⚙️ CONFIGURATION:"
	@echo "  DEPLOY_ACCOUNT=alice   - Stellar account for deployment"
	@echo "  DEPLOY_NETWORK=testnet - Network for deployment"

.PHONY: all build build-stellarsave build-webauth build-factory build-wallet build-savings-challenge build-reward-token
.PHONY: deploy deploy-all deploy-stellarsave deploy-webauth deploy-factory deploy-wallet deploy-savings-challenge deploy-reward-token
.PHONY: link-contracts test test-wallet test-stellarsave clean check fmt lint contract-ids contract-info generate-env help