DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
DROP FUNCTION IF EXISTS set_updated_at;
DROP TABLE IF EXISTS alchemy_events;
DROP TABLE IF EXISTS policy_audit_log;
DROP TABLE IF EXISTS policy_rules;
DROP TABLE IF EXISTS transactions;
DROP TYPE IF EXISTS tx_status;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS users;
