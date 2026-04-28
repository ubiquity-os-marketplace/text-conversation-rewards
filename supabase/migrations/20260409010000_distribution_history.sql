-- Track distribution history for differential reward calculations
CREATE TABLE IF NOT EXISTS distribution_history (
  id BIGSERIAL PRIMARY KEY,
  issue_node_id TEXT NOT NULL,
  beneficiary TEXT NOT NULL,
  amount TEXT NOT NULL,
  payout_mode TEXT NOT NULL DEFAULT 'permit',
  transaction_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by issue
CREATE INDEX IF NOT EXISTS idx_distribution_history_issue 
  ON distribution_history(issue_node_id);

-- Index for lookups by beneficiary
CREATE INDEX IF NOT EXISTS idx_distribution_history_beneficiary 
  ON distribution_history(beneficiary);

-- Unique constraint to prevent duplicate recordings
CREATE UNIQUE INDEX IF NOT EXISTS idx_distribution_history_unique 
  ON distribution_history(issue_node_id, beneficiary, transaction_hash);
