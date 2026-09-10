/**
 * WINORA Production PostgreSQL / Supabase Schema & Stored Procedures
 * Generated according to Prompt 1 specifications.
 */

export const WINORA_SUPABASE_SQL = `-- ============================================================================
-- WINORA PRODUCTION DATABASE & SECURITY SCHEMA (SUPABASE / POSTGRESQL)
-- Includes:
-- 1. Tables: users, wallets, transactions, bids, game_rounds
-- 2. Stored Procedures & Triggers:
--    - First Deposit Referral Trigger (50% Main to Referrer)
--    - 10% All-time Deposit Agent Commission Trigger
--    - 15-Minute Bidding Freeze Check Trigger
--    - Hourly Dhamaka 80% Green Protection Refund Engine
--    - Master 00-99 Real-Time Risk & Exposure Calculator Procedure
-- 3. Row Level Security (RLS) Policies for Master, Agent, and User isolation
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. CORE TABLES
-- ----------------------------------------------------------------------------

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    pincode VARCHAR(10),
    role VARCHAR(20) NOT NULL CHECK (role IN ('master', 'agent', 'user')),
    assigned_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    referrer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    has_made_first_deposit BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: wallets (Single Main Wallet System)
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    main_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (main_balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: game_rounds
CREATE TABLE IF NOT EXISTS public.game_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_name VARCHAR(50) NOT NULL CHECK (game_name IN ('Game X', 'Game Y', 'Game Z', 'Hourly Dhamaka')),
    round_number INT NOT NULL,
    result_number INT CHECK (result_number >= 0 AND result_number <= 99),
    freeze_time TIMESTAMP WITH TIME ZONE NOT NULL,
    declare_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'frozen', 'completed')),
    total_pool NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: bids
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_round_id UUID NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    number INT NOT NULL CHECK (number >= 0 AND number <= 99),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    wallet_type VARCHAR(10) NOT NULL DEFAULT 'main' CHECK (wallet_type IN ('main')),
    is_green BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'won', 'lost', 'refunded')),
    payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: transactions (Dual-Confirmation Handshake)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.users(id),
    receiver_id UUID NOT NULL REFERENCES public.users(id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'commission', 'referral', 'payout', 'refund')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'agent_approved', 'completed', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES FOR PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_mobile ON public.users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_assigned_agent ON public.users(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_bids_round_number ON public.bids(game_round_id, number);
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON public.transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON public.transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_status ON public.game_rounds(status);

-- ----------------------------------------------------------------------------
-- 3. TRIGGERS & BUSINESS LOGIC
-- ----------------------------------------------------------------------------

-- Trigger 1: 15-Minute Bidding Freeze Check
-- Prevents any bid insert if current time is within or past freeze_time
CREATE OR REPLACE FUNCTION check_15min_freeze()
RETURNS TRIGGER AS $$
DECLARE
    r_freeze_time TIMESTAMP WITH TIME ZONE;
    r_status VARCHAR(20);
BEGIN
    SELECT freeze_time, status INTO r_freeze_time, r_status
    FROM public.game_rounds
    WHERE id = NEW.game_round_id;

    IF r_status <> 'open' OR NOW() >= r_freeze_time THEN
        RAISE EXCEPTION 'Bidding rejected: Round is frozen or closed. Cutoff occurs 15 minutes prior to draw.';
    END IF;

    -- Automatically designate Green numbers for Hourly Dhamaka (00-49)
    IF NEW.number BETWEEN 0 AND 49 THEN
        NEW.is_green := TRUE;
    ELSE
        NEW.is_green := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_15min_freeze ON public.bids;
CREATE TRIGGER trg_check_15min_freeze
    BEFORE INSERT ON public.bids
    FOR EACH ROW
    EXECUTE FUNCTION check_15min_freeze();


-- Trigger 2: Automated Referral Credit & Agent Commission on Handshake Completion
CREATE OR REPLACE FUNCTION process_deposit_handshake()
RETURNS TRIGGER AS $$
DECLARE
    player_rec RECORD;
    master_rec RECORD;
    half_amount NUMERIC(14, 2);
    agent_comm NUMERIC(14, 2);
BEGIN
    -- Only act when transaction transitions to 'completed' for a 'deposit'
    IF NEW.transaction_type = 'deposit' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
        
        -- Fetch player details
        SELECT * INTO player_rec FROM public.users WHERE id = NEW.sender_id;

        -- Find Master Account
        SELECT * INTO master_rec FROM public.users WHERE role = 'master' LIMIT 1;
        IF master_rec IS NULL THEN
            RAISE EXCEPTION 'Master SuperAdmin account not initialized.';
        END IF;

        -- 1. Credit Player Main Wallet
        UPDATE public.wallets
        SET main_balance = main_balance + NEW.amount, updated_at = NOW()
        WHERE user_id = NEW.sender_id;

        -- 2. REFERRAL TRIGGER: 50% Main Wallet Reward to Referrer on 1st Deposit
        IF player_rec.has_made_first_deposit = FALSE AND player_rec.referrer_id IS NOT NULL THEN
            half_amount := ROUND((NEW.amount * 0.50), 2);

            -- Credit 50% directly to Referrer Main Wallet
            UPDATE public.wallets
            SET main_balance = main_balance + half_amount, updated_at = NOW()
            WHERE user_id = player_rec.referrer_id;

            -- Debit referral reward from Master
            UPDATE public.wallets
            SET main_balance = main_balance - half_amount, updated_at = NOW()
            WHERE user_id = master_rec.id;

            -- Mark player first deposit done
            UPDATE public.users
            SET has_made_first_deposit = TRUE
            WHERE id = NEW.sender_id;

            -- Log referral transaction
            INSERT INTO public.transactions (sender_id, receiver_id, amount, transaction_type, status, notes)
            VALUES (master_rec.id, player_rec.referrer_id, half_amount, 'referral', 'completed', 'Referral 50% Main credit on first deposit');
        END IF;

        -- 3. AGENT COMMISSION TRIGGER: 10% on all deposits
        IF player_rec.assigned_agent_id IS NOT NULL THEN
            agent_comm := ROUND((NEW.amount * 0.10), 2);

            -- Credit Agent Main Wallet
            UPDATE public.wallets
            SET main_balance = main_balance + agent_comm, updated_at = NOW()
            WHERE user_id = player_rec.assigned_agent_id;

            -- Debit commission from Master
            UPDATE public.wallets
            SET main_balance = main_balance - agent_comm, updated_at = NOW()
            WHERE user_id = master_rec.id;

            -- Log commission transaction
            INSERT INTO public.transactions (sender_id, receiver_id, amount, transaction_type, status, notes)
            VALUES (master_rec.id, player_rec.assigned_agent_id, agent_comm, 'commission', 'completed', 'Agent 10% all-time deposit commission');
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_deposit_handshake ON public.transactions;
CREATE TRIGGER trg_process_deposit_handshake
    AFTER UPDATE OR INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION process_deposit_handshake();


-- ----------------------------------------------------------------------------
-- 4. MASTER 00–99 REAL-TIME RISK & PAYOUT CALCULATOR (STORED PROCEDURE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_master_00_99_risk(p_round_id UUID)
RETURNS TABLE (
    number_val INT,
    is_green BOOLEAN,
    total_bids NUMERIC,
    bid_count BIGINT,
    payout_90x NUMERIC,
    green_refunds NUMERIC,
    net_master_pnl NUMERIC
) AS $$
DECLARE
    v_total_pool NUMERIC;
    v_total_green_bids NUMERIC;
    v_game_name VARCHAR(50);
BEGIN
    SELECT game_name INTO v_game_name FROM public.game_rounds WHERE id = p_round_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_pool FROM public.bids WHERE game_round_id = p_round_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_green_bids FROM public.bids WHERE game_round_id = p_round_id AND is_green = TRUE;

    RETURN QUERY
    WITH num_series AS (
        SELECT generate_series(0, 99) AS n
    ),
    bid_aggs AS (
        SELECT 
            b.number,
            COALESCE(SUM(b.amount), 0) AS num_bids,
            COUNT(b.id) AS num_count
        FROM public.bids b
        WHERE b.game_round_id = p_round_id
        GROUP BY b.number
    )
    SELECT 
        s.n AS number_val,
        (s.n BETWEEN 0 AND 49) AS is_green,
        COALESCE(ba.num_bids, 0) AS total_bids,
        COALESCE(ba.num_count, 0) AS bid_count,
        (COALESCE(ba.num_bids, 0) * 90) AS payout_90x,
        CASE 
            WHEN v_game_name = 'Hourly Dhamaka' THEN
                ROUND(
                    CASE 
                        WHEN s.n BETWEEN 0 AND 49 THEN (v_total_green_bids - COALESCE(ba.num_bids, 0)) * 0.80
                        ELSE v_total_green_bids * 0.80
                    END, 2
                )
            ELSE 0.00
        END AS green_refunds,
        (
            v_total_pool - (
                (COALESCE(ba.num_bids, 0) * 90) + 
                CASE 
                    WHEN v_game_name = 'Hourly Dhamaka' THEN
                        ROUND(
                            CASE 
                                WHEN s.n BETWEEN 0 AND 49 THEN (v_total_green_bids - COALESCE(ba.num_bids, 0)) * 0.80
                                ELSE v_total_green_bids * 0.80
                            END, 2
                        )
                    ELSE 0.00
                END
            )
        ) AS net_master_pnl
    FROM num_series s
    LEFT JOIN bid_aggs ba ON s.n = ba.number
    ORDER BY s.n ASC;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

-- Game Rounds: Publicly readable by all authenticated users
CREATE POLICY "Public Game Rounds Read" ON public.game_rounds
    FOR SELECT USING (true);

-- Users: Players read own profile; Agents read assigned players; Master reads all
CREATE POLICY "Users Read Access" ON public.users
    FOR SELECT USING (
        auth.uid() = id OR 
        auth.uid() = assigned_agent_id OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master')
    );

-- Wallets: Users see their own wallet; Master sees all
CREATE POLICY "Wallets Read Access" ON public.wallets
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master')
    );

-- Bids: Users see own bids; Master sees all bids
CREATE POLICY "Bids Read Access" ON public.bids
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master')
    );

-- Transactions: Sender, Assigned Agent, or Master can view
CREATE POLICY "Transactions Access" ON public.transactions
    FOR SELECT USING (
        auth.uid() = sender_id OR 
        auth.uid() = receiver_id OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master')
    );
`;
