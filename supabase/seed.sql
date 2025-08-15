-- Sample seed data for development and testing

-- Insert sample users
INSERT INTO users (id, wallet_address, username, display_name, bio) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 'alice_builder', 'Alice the Builder', 'Full-stack developer passionate about accountability'),
  ('550e8400-e29b-41d4-a716-446655440002', 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', 'bob_designer', 'Bob the Designer', 'UI/UX designer who loves creating beautiful experiences'),
  ('550e8400-e29b-41d4-a716-446655440003', 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX0XR2TCBZJJ', 'charlie_coach', 'Charlie the Coach', 'Fitness coach helping others achieve their goals');

-- Insert sample buddy relationships
INSERT INTO buddy_relationships (requester_id, buddy_id, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'accepted'),
  ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'accepted'),
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'pending');

-- Insert sample tasks
INSERT INTO tasks (id, creator_id, buddy_id, title, description, stake_amount, deadline, status) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 
   '550e8400-e29b-41d4-a716-446655440001', 
   '550e8400-e29b-41d4-a716-446655440002',
   'Complete React Tutorial',
   'Finish the advanced React tutorial on component patterns by Friday',
   50000, -- 0.0005 BTC in satoshis
   NOW() + INTERVAL '5 days',
   'active'),
  ('650e8400-e29b-41d4-a716-446655440002',
   '550e8400-e29b-41d4-a716-446655440002',
   '550e8400-e29b-41d4-a716-446655440003',
   'Daily Workout Routine',
   'Complete 30-minute workout every day this week',
   25000, -- 0.00025 BTC in satoshis
   NOW() + INTERVAL '7 days',
   'active'),
  ('650e8400-e29b-41d4-a716-446655440003',
   '550e8400-e29b-41d4-a716-446655440003',
   '550e8400-e29b-41d4-a716-446655440001',
   'Write Blog Post',
   'Publish a blog post about fitness motivation',
   75000, -- 0.00075 BTC in satoshis
   NOW() + INTERVAL '3 days',
   'pending');

-- Insert sample transactions
INSERT INTO transactions (task_id, user_id, type, amount, stacks_tx_id, status) VALUES
  ('650e8400-e29b-41d4-a716-446655440001',
   '550e8400-e29b-41d4-a716-446655440001',
   'stake_deposit',
   50000,
   '0x1234567890abcdef1234567890abcdef12345678',
   'confirmed'),
  ('650e8400-e29b-41d4-a716-446655440002',
   '550e8400-e29b-41d4-a716-446655440002',
   'stake_deposit',
   25000,
   '0x2234567890abcdef1234567890abcdef12345678',
   'confirmed');