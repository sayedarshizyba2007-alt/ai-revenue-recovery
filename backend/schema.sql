-- SQL Schema for Razorpay AI Revenue Recovery System
-- Compatible with Supabase PostgreSQL and SQLite

CREATE TABLE IF NOT EXISTS merchants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    customer_segment VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
    id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cart_amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    stage VARCHAR(50) NOT NULL, -- cart, address, review, payment, otp
    status VARCHAR(50) NOT NULL, -- converted, abandoned, expired
    last_event_at TIMESTAMP WITH TIME ZONE NOT NULL,
    recovery_eligible BOOLEAN DEFAULT TRUE,
    recovery_status VARCHAR(50) DEFAULT 'unrecovered', -- unrecovered, recovery_in_progress, recovered, abandoned_permanently
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    checkout_session_id VARCHAR(64) REFERENCES checkout_sessions(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- success, failed
    failure_reason VARCHAR(100), -- bank_decline, insufficient_funds, timeout, technical_error, authentication_failed, unknown
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recovery_cases (
    id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- payment_degradation, checkout_abandonment
    source_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
    amount_at_risk NUMERIC(12, 2) NOT NULL,
    risk_score INT NOT NULL,
    diagnosis TEXT,
    recommended_action VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'detected', -- detected, diagnosed, approved, recovering, recovered, failed, stopped
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recovery_attempts (
    id VARCHAR(64) PRIMARY KEY,
    recovery_case_id VARCHAR(64) NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    result VARCHAR(50) NOT NULL, -- success, failed, pending
    recovered_amount NUMERIC(12, 2) DEFAULT 0.00,
    stop_reason VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    recovery_case_id VARCHAR(64) REFERENCES recovery_cases(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- DETECTION, DIAGNOSIS, RECOMMENDATION, APPROVAL, EXECUTION, RECOVERY, STOP
    actor VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high performance analytics
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_started_at ON checkout_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_status ON recovery_cases(status);
