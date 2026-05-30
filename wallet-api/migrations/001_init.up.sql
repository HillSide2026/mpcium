CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    totp_secret     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mpc_wallet_id   TEXT NOT NULL UNIQUE,  -- walletID sent to mpcium
    chain           TEXT NOT NULL,          -- "ethereum" | "polygon"
    ecdsa_pub_key   BYTEA NOT NULL,         -- 33-byte compressed secp256k1 pubkey
    address         TEXT NOT NULL,          -- 0x... EVM address
    derivation_path TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

CREATE TYPE tx_status AS ENUM (
    'draft', 'policy_check', 'signing', 'signed',
    'broadcast', 'confirmed', 'failed'
);

CREATE TABLE transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id        UUID NOT NULL REFERENCES wallets(id),
    tx_id            TEXT NOT NULL UNIQUE,  -- correlates with mpcium TxID
    chain            TEXT NOT NULL,
    token            TEXT NOT NULL,         -- "USDC" | "USDT"
    to_address       TEXT NOT NULL,
    amount_raw       NUMERIC(78,0) NOT NULL, -- raw token units (6 decimals for USDC/USDT)
    status           tx_status NOT NULL DEFAULT 'draft',
    mpc_error_code   TEXT,
    unsigned_tx_rlp  BYTEA,
    signed_tx_rlp    BYTEA,
    tx_hash          TEXT,
    block_number     BIGINT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at     TIMESTAMPTZ
);

CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_tx_hash   ON transactions(tx_hash);
CREATE INDEX idx_transactions_status    ON transactions(status);

CREATE TABLE policy_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id   UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    rule_type   TEXT NOT NULL, -- "max_single_tx" | "daily_limit" | "velocity_per_hour" | "dest_whitelist"
    value       TEXT NOT NULL, -- JSON or plain value depending on rule_type
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (wallet_id, rule_type)
);

CREATE TABLE policy_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id   UUID NOT NULL REFERENCES wallets(id),
    tx_id       TEXT,
    rule_type   TEXT NOT NULL,
    result      TEXT NOT NULL, -- "pass" | "fail"
    reason      TEXT,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alchemy_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_type    TEXT NOT NULL,
    payload_json    JSONB NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auto-update updated_at on transactions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
