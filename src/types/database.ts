// User and Profile Types
export interface User {
  id: string;
  wallet_address: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Task/Wager Types
export type TaskStatus = 'pending' | 'active' | 'completed' | 'failed' | 'expired';

export interface Task {
  id: string;
  creator_id: string;
  buddy_id: string;
  title: string;
  description: string;
  stake_amount: number; // in satoshis
  deadline: string;
  status: TaskStatus;
  contract_id?: string;
  transaction_id?: string;
  created_at: string;
  updated_at: string;
}

// Buddy Relationship Types
export type BuddyStatus = 'pending' | 'accepted' | 'declined';

export interface BuddyRelationship {
  id: string;
  requester_id: string;
  buddy_id: string;
  status: BuddyStatus;
  created_at: string;
  updated_at: string;
}

// Transaction History Types
export type TransactionType = 'stake_deposit' | 'stake_release' | 'stake_forfeit';

export interface Transaction {
  id: string;
  task_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  stacks_tx_id: string;
  block_height?: number;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
  updated_at: string;
}

// Verification Types
export interface TaskVerification {
  id: string;
  task_id: string;
  buddy_id: string;
  verified: boolean;
  verification_note?: string;
  verification_date: string;
  created_at: string;
}

// Database Join Types
export interface TaskWithDetails extends Task {
  creator: User;
  buddy: User;
  verification?: TaskVerification;
  transactions: Transaction[];
}

export interface UserWithStats extends User {
  tasks_created: number;
  tasks_completed: number;
  tasks_failed: number;
  total_staked: number;
  success_rate: number;
}