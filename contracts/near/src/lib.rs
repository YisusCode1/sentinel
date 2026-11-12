use near_sdk::json_types::{U128, U64};
use near_sdk::store::IterableMap;
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

const DAY_NS: u64 = 86_400_000_000_000;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct AgentPolicy {
    pub max_per_tx: U128,
    pub daily_limit: U128,
    pub allowed_recipients: Vec<AccountId>,
    pub paused: bool,
    pub spent_in_window: U128,
    pub window_start_ns: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct SentinelVault {
    owner: AccountId,
    agents: IterableMap<AccountId, AgentPolicy>,
}

#[near]
impl SentinelVault {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            agents: IterableMap::new(b"a"),
        }
    }

    #[payable]
    pub fn deposit(&mut self) {
        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"deposit\",\"from\":\"{}\",\"amount\":\"{}\"}}",
            env::predecessor_account_id(),
            env::attached_deposit().as_yoctonear()
        ));
    }

    pub fn set_agent_policy(
        &mut self,
        agent: AccountId,
        max_per_tx: U128,
        daily_limit: U128,
        allowed_recipients: Vec<AccountId>,
    ) {
        self.assert_owner();
        require!(max_per_tx.0 > 0, "max_per_tx must be positive");
        require!(daily_limit.0 >= max_per_tx.0, "daily_limit must be >= max_per_tx");
        require!(!allowed_recipients.is_empty(), "at least one recipient required");
        self.agents.insert(
            agent.clone(),
            AgentPolicy {
                max_per_tx,
                daily_limit,
                allowed_recipients,
                paused: false,
                spent_in_window: U128(0),
                window_start_ns: U64(env::block_timestamp()),
            },
        );
        env::log_str(&format!("EVENT_JSON:{{\"event\":\"policy_set\",\"agent\":\"{}\"}}", agent));
    }

    pub fn pause_agent(&mut self, agent: AccountId) {
        self.assert_owner();
        let policy = self
            .agents
            .get_mut(&agent)
            .unwrap_or_else(|| env::panic_str("agent not registered"));
        policy.paused = true;
        env::log_str(&format!("EVENT_JSON:{{\"event\":\"agent_paused\",\"agent\":\"{}\"}}", agent));
    }

    pub fn resume_agent(&mut self, agent: AccountId) {
        self.assert_owner();
        let policy = self
            .agents
            .get_mut(&agent)
            .unwrap_or_else(|| env::panic_str("agent not registered"));
        policy.paused = false;
        env::log_str(&format!("EVENT_JSON:{{\"event\":\"agent_resumed\",\"agent\":\"{}\"}}", agent));
    }

    pub fn remove_agent(&mut self, agent: AccountId) {
        self.assert_owner();
        require!(self.agents.remove(&agent).is_some(), "agent not registered");
        env::log_str(&format!("EVENT_JSON:{{\"event\":\"agent_removed\",\"agent\":\"{}\"}}", agent));
    }

    /// Called by the agent account. Every rule is enforced here, on-chain.
    pub fn request_transfer(&mut self, recipient: AccountId, amount: U128) -> Promise {
        let agent = env::predecessor_account_id();
        let amount = amount.0;
        require!(amount > 0, "amount must be positive");

        let now = env::block_timestamp();
        let policy = self
            .agents
            .get_mut(&agent)
            .unwrap_or_else(|| env::panic_str("agent not registered"));

        require!(!policy.paused, "agent is paused");
        require!(policy.allowed_recipients.contains(&recipient), "recipient not allowed");
        require!(amount <= policy.max_per_tx.0, "amount exceeds per-transaction limit");

        if now.saturating_sub(policy.window_start_ns.0) >= DAY_NS {
            policy.window_start_ns = U64(now);
            policy.spent_in_window = U128(0);
        }
        let new_spent = policy
            .spent_in_window
            .0
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("overflow"));
        require!(new_spent <= policy.daily_limit.0, "daily limit exceeded");
        require!(
            amount <= env::account_balance().as_yoctonear(),
            "insufficient vault balance"
        );

        policy.spent_in_window = U128(new_spent);
        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"transfer\",\"agent\":\"{}\",\"recipient\":\"{}\",\"amount\":\"{}\"}}",
            agent, recipient, amount
        ));
        Promise::new(recipient).transfer(NearToken::from_yoctonear(amount))
    }

    pub fn get_agent_policy(&self, agent: AccountId) -> Option<AgentPolicy> {
        self.agents.get(&agent).cloned()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "only the owner can call this method"
        );
    }
}
