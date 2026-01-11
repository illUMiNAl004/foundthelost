-- UMass Lost & Found Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  karma_points INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "matches": true, "messages": true}',
  avg_response_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LOST ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS lost_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  color TEXT,
  brand TEXT,
  condition TEXT,
  serial_number TEXT,
  photo_url TEXT,
  identifying_marks TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  building TEXT,
  location_description TEXT,
  date_lost DATE NOT NULL,
  time_lost TIME,
  confidence TEXT DEFAULT 'pretty_sure',
  status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'in_discussion', 'claimed', 'closed')),
  reward_offered BOOLEAN DEFAULT FALSE,
  reward_amount TEXT,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  notify_push BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FOUND ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS found_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finder_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  color TEXT,
  brand TEXT,
  condition TEXT,
  photo_url TEXT,
  location_photo_url TEXT,
  identifying_marks TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  building TEXT,
  location_description TEXT,
  date_found DATE NOT NULL,
  time_found TIME,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'with_finder', 'deposited', 'in_discussion', 'claimed', 'closed')),
  is_carrying BOOLEAN DEFAULT TRUE,
  deposit_location TEXT,
  finder_experience TEXT DEFAULT 'first_time',
  show_contact BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MATCHES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lost_item_id UUID REFERENCES lost_items(id) ON DELETE CASCADE NOT NULL,
  found_item_id UUID REFERENCES found_items(id) ON DELETE CASCADE NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,
  keyword_match_score DECIMAL(5,2),
  color_match_score DECIMAL(5,2),
  time_proximity_score DECIMAL(5,2),
  location_proximity_score DECIMAL(5,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lost_item_id, found_item_id)
);

-- =====================================================
-- CONVERSATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1 UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lost_item_id UUID REFERENCES lost_items(id) ON DELETE SET NULL,
  found_item_id UUID REFERENCES found_items(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- KEYWORD NODES TABLE (for AI matching)
-- =====================================================
CREATE TABLE IF NOT EXISTS keyword_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT UNIQUE NOT NULL,
  synonyms TEXT[] DEFAULT '{}',
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI EXTRACTION LOG (for caching AI calls)
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_extraction_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  input_text TEXT NOT NULL,
  extracted_keywords TEXT[] NOT NULL,
  model_used TEXT DEFAULT 'claude-3-haiku',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REVIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  transaction_type TEXT CHECK (transaction_type IN ('return', 'pickup')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lost_items_user ON lost_items(user_id);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_location ON lost_items(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_lost_items_category ON lost_items(category);
CREATE INDEX IF NOT EXISTS idx_lost_items_created ON lost_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_found_items_finder ON found_items(finder_id);
CREATE INDEX IF NOT EXISTS idx_found_items_status ON found_items(status);
CREATE INDEX IF NOT EXISTS idx_found_items_location ON found_items(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_found_items_category ON found_items(category);
CREATE INDEX IF NOT EXISTS idx_found_items_created ON found_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_lost ON matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_keyword_nodes_keyword ON keyword_nodes(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_nodes_category ON keyword_nodes(category);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_extraction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Lost items policies
CREATE POLICY "Anyone can view lost items" ON lost_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create lost items" ON lost_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lost items" ON lost_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lost items" ON lost_items FOR DELETE USING (auth.uid() = user_id);

-- Found items policies
CREATE POLICY "Anyone can view found items" ON found_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create found items" ON found_items FOR INSERT WITH CHECK (auth.uid() = finder_id);
CREATE POLICY "Users can update own found items" ON found_items FOR UPDATE USING (auth.uid() = finder_id);
CREATE POLICY "Users can delete own found items" ON found_items FOR DELETE USING (auth.uid() = finder_id);

-- Matches policies
CREATE POLICY "Users can view relevant matches" ON matches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lost_items WHERE id = lost_item_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM found_items WHERE id = found_item_id AND finder_id = auth.uid()
  )
);
CREATE POLICY "System can create matches" ON matches FOR INSERT WITH CHECK (true);

-- Conversations policies
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);
CREATE POLICY "Authenticated users can create conversations" ON conversations FOR INSERT WITH CHECK (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = conversation_id 
    AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
  )
);
CREATE POLICY "Users can send messages to their conversations" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = conversation_id 
    AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
  )
);
CREATE POLICY "Users can update own messages" ON messages FOR UPDATE USING (auth.uid() = sender_id);

-- Keyword nodes policies (read-only for users)
CREATE POLICY "Anyone can view keywords" ON keyword_nodes FOR SELECT USING (true);
CREATE POLICY "System can manage keywords" ON keyword_nodes FOR ALL USING (true);

-- AI extraction log (system only)
CREATE POLICY "System can manage AI logs" ON ai_extraction_log FOR ALL USING (true);

-- Reviews policies
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lost_items_updated_at
  BEFORE UPDATE ON lost_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_found_items_updated_at
  BEFORE UPDATE ON found_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_keyword_nodes_updated_at
  BEFORE UPDATE ON keyword_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message_at = NEW.created_at 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Function to add karma points
CREATE OR REPLACE FUNCTION add_karma(user_uuid UUID, points INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET karma_points = karma_points + points,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA - Common Keywords
-- =====================================================
INSERT INTO keyword_nodes (keyword, synonyms, category) VALUES
  ('airpods', ARRAY['earbuds', 'headphones', 'earphones', 'wireless earbuds', 'apple earbuds'], 'electronics'),
  ('iphone', ARRAY['phone', 'smartphone', 'cell phone', 'mobile', 'apple phone'], 'electronics'),
  ('macbook', ARRAY['laptop', 'notebook', 'computer', 'mac', 'apple laptop'], 'electronics'),
  ('keys', ARRAY['keychain', 'car keys', 'house keys', 'key ring', 'key fob'], 'keys'),
  ('wallet', ARRAY['billfold', 'purse', 'card holder', 'money clip'], 'wallets'),
  ('backpack', ARRAY['bag', 'bookbag', 'rucksack', 'school bag', 'knapsack'], 'clothing'),
  ('jacket', ARRAY['coat', 'hoodie', 'sweater', 'fleece', 'windbreaker'], 'clothing'),
  ('glasses', ARRAY['eyeglasses', 'spectacles', 'sunglasses', 'shades', 'frames'], 'accessories'),
  ('watch', ARRAY['smartwatch', 'apple watch', 'wristwatch', 'timepiece'], 'accessories'),
  ('umbrella', ARRAY['parasol', 'brolly'], 'accessories'),
  ('charger', ARRAY['power adapter', 'charging cable', 'usb cable', 'power cord'], 'electronics'),
  ('water bottle', ARRAY['bottle', 'hydro flask', 'thermos', 'tumbler'], 'accessories'),
  ('textbook', ARRAY['book', 'coursebook', 'study guide', 'manual'], 'other'),
  ('calculator', ARRAY['ti-84', 'graphing calculator', 'scientific calculator'], 'electronics'),
  ('id card', ARRAY['student id', 'umass id', 'identification', 'id badge'], 'wallets')
ON CONFLICT (keyword) DO NOTHING;

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
-- Run this in Supabase Dashboard > Storage
-- Create a bucket named 'item-photos' with public access
