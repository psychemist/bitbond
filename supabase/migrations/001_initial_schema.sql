-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks/Wagers table
CREATE TYPE task_status AS ENUM ('pending', 'active', 'completed', 'failed', 'expired');

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  buddy_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  stake_amount BIGINT NOT NULL, -- in satoshis
  deadline TIMESTAMPTZ NOT NULL,
  status task_status DEFAULT 'pending',
  contract_id TEXT, -- Stacks contract transaction ID
  transaction_id TEXT, -- Initial stake transaction ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT tasks_creator_buddy_different CHECK (creator_id != buddy_id),
  CONSTRAINT tasks_stake_positive CHECK (stake_amount > 0),
  CONSTRAINT tasks_deadline_future CHECK (deadline > created_at)
);

-- Buddy relationships table
CREATE TYPE buddy_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE buddy_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  buddy_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status buddy_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(requester_id, buddy_id),
  CONSTRAINT buddy_relationships_different_users CHECK (requester_id != buddy_id)
);

-- Transaction history table
CREATE TYPE transaction_type AS ENUM ('stake_deposit', 'stake_release', 'stake_forfeit');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount BIGINT NOT NULL,
  stacks_tx_id TEXT NOT NULL,
  block_height INTEGER,
  status transaction_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT transactions_amount_positive CHECK (amount > 0)
);

-- Task verifications table
CREATE TABLE task_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  buddy_id UUID REFERENCES users(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL,
  verification_note TEXT,
  verification_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(task_id), -- Only one verification per task
  CONSTRAINT task_verifications_buddy_is_task_buddy 
    CHECK (buddy_id = (SELECT buddy_id FROM tasks WHERE tasks.id = task_id))
);

-- Indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX idx_tasks_buddy_id ON tasks(buddy_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_buddy_relationships_requester ON buddy_relationships(requester_id);
CREATE INDEX idx_buddy_relationships_buddy ON buddy_relationships(buddy_id);
CREATE INDEX idx_transactions_task_id ON transactions(task_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_stacks_tx_id ON transactions(stacks_tx_id);
CREATE INDEX idx_task_verifications_task_id ON task_verifications(task_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read all users but only update their own profile
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Tasks can be read by participants, created by authenticated users
CREATE POLICY "Users can view tasks they're involved in" ON tasks FOR SELECT 
  USING (creator_id::text = auth.uid()::text OR buddy_id::text = auth.uid()::text);
CREATE POLICY "Users can create tasks" ON tasks FOR INSERT 
  WITH CHECK (creator_id::text = auth.uid()::text);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE 
  USING (creator_id::text = auth.uid()::text OR buddy_id::text = auth.uid()::text);

-- Buddy relationships
CREATE POLICY "Users can view their buddy relationships" ON buddy_relationships FOR SELECT 
  USING (requester_id::text = auth.uid()::text OR buddy_id::text = auth.uid()::text);
CREATE POLICY "Users can create buddy requests" ON buddy_relationships FOR INSERT 
  WITH CHECK (requester_id::text = auth.uid()::text);
CREATE POLICY "Users can update buddy requests they're involved in" ON buddy_relationships FOR UPDATE 
  USING (requester_id::text = auth.uid()::text OR buddy_id::text = auth.uid()::text);

-- Transactions
CREATE POLICY "Users can view their transactions" ON transactions FOR SELECT 
  USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users can insert their transactions" ON transactions FOR INSERT 
  WITH CHECK (user_id::text = auth.uid()::text);

-- Task verifications
CREATE POLICY "Users can view verifications for their tasks" ON task_verifications FOR SELECT 
  USING (buddy_id::text = auth.uid()::text OR 
         task_id IN (SELECT id FROM tasks WHERE creator_id::text = auth.uid()::text));
CREATE POLICY "Buddies can create verifications" ON task_verifications FOR INSERT 
  WITH CHECK (buddy_id::text = auth.uid()::text);

-- Functions and Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buddy_relationships_updated_at BEFORE UPDATE ON buddy_relationships 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();