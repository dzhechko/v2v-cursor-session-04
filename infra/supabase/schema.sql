-- Create custom types
CREATE TYPE salesai_user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE salesai_session_status AS ENUM ('active', 'completed', 'analyzed', 'archived');
CREATE TYPE salesai_subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- Companies table (tenant root)
CREATE TABLE IF NOT EXISTS salesai_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (user data)
CREATE TABLE IF NOT EXISTS salesai_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL,
  company_id UUID REFERENCES salesai_companies(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  position VARCHAR(255),
  phone VARCHAR(100),
  team_size INTEGER,
  role salesai_user_role DEFAULT 'user',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys table (secure storage)
CREATE TABLE IF NOT EXISTS salesai_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES salesai_profiles(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Sessions table (core metadata)
CREATE TABLE IF NOT EXISTS salesai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES salesai_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES salesai_companies(id),

  -- Session metadata
  title VARCHAR(255) NOT NULL,
  status salesai_session_status DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,

  -- Audio metadata
  audio_quality JSONB,
  audio_file_url TEXT,
  audio_file_size BIGINT,

  -- Transcript data
  transcript JSONB,

  -- Performance tracking
  minute_cost DECIMAL(10,4),
  processing_status TEXT DEFAULT 'pending',

  -- Analytics summary
  analytics_summary JSONB,
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  feedback_summary TEXT,
  session_type VARCHAR(50) DEFAULT 'practice',
  analyzed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS salesai_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES salesai_sessions(id) ON DELETE CASCADE,
  
  -- Content data
  content TEXT,
  structured_content JSONB,
  
  -- Processing metadata
  language VARCHAR(10) DEFAULT 'en-US',
  confidence_score DECIMAL(5,4),
  word_count INTEGER,
  
  -- GDPR compliance
  is_anonymized BOOLEAN DEFAULT FALSE,
  anonymized_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analysis results table
CREATE TABLE IF NOT EXISTS salesai_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES salesai_sessions(id) ON DELETE CASCADE,

  -- Analysis metadata
  analysis_type VARCHAR(50),
  provider VARCHAR(50),
  version VARCHAR(20),

  -- Results data
  results JSONB NOT NULL,

  -- Quality metrics
  confidence_score DECIMAL(5,4),
  processing_time_ms INTEGER,

  -- Cost tracking
  api_cost_usd DECIMAL(10,6),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint to prevent duplicate analysis results per session
  UNIQUE (session_id)
);

-- Session analytics table (for faster queries)
CREATE TABLE IF NOT EXISTS salesai_session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES salesai_sessions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES salesai_profiles(id),
  company_id UUID REFERENCES salesai_companies(id),

  -- Core metrics
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  talk_time_ratio DECIMAL(5,4),
  filler_words_count INTEGER,
  speaking_pace_wpm INTEGER,
  sentiment_score DECIMAL(5,4),

  -- Skill scores
  opening_score INTEGER CHECK (opening_score >= 0 AND opening_score <= 100),
  questioning_score INTEGER CHECK (questioning_score >= 0 AND questioning_score <= 100),
  objection_handling_score INTEGER CHECK (objection_handling_score >= 0 AND objection_handling_score <= 100),
  closing_score INTEGER CHECK (closing_score >= 0 AND closing_score <= 100),

  -- Time-based analytics
  session_date DATE,
  session_hour INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint to prevent duplicate analytics per session
  UNIQUE (session_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS salesai_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES salesai_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES salesai_companies(id),
  
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  
  plan_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  status salesai_subscription_status NOT NULL,
  
  minutes_limit INTEGER NOT NULL,
  minutes_used INTEGER DEFAULT 0,
  
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  canceled_at TIMESTAMP WITH TIME ZONE
);

-- Usage table (tracks consumption)
CREATE TABLE IF NOT EXISTS salesai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES salesai_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES salesai_companies(id),
  
  minutes_used DECIMAL(10,2) NOT NULL,
  session_id UUID REFERENCES salesai_sessions(id),
  
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback table
CREATE TABLE IF NOT EXISTS salesai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES salesai_sessions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES salesai_profiles(id),
  
  metrics JSONB NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS salesai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  company_id UUID,
  event_type VARCHAR(50) NOT NULL,
  resource VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details JSONB
);

-- Create indexes for performance
CREATE INDEX idx_salesai_profiles_company ON salesai_profiles (company_id);
CREATE INDEX idx_salesai_sessions_profile ON salesai_sessions (profile_id);
CREATE INDEX idx_salesai_sessions_company ON salesai_sessions (company_id);
CREATE INDEX idx_salesai_sessions_status ON salesai_sessions (status);
CREATE INDEX idx_salesai_sessions_created ON salesai_sessions (created_at);
CREATE INDEX idx_salesai_sessions_transcript ON salesai_sessions USING GIN (transcript);
CREATE INDEX idx_salesai_sessions_analyzed ON salesai_sessions (analyzed_at);
CREATE INDEX idx_salesai_transcripts_session ON salesai_transcripts (session_id);
CREATE INDEX idx_salesai_analysis_session ON salesai_analysis_results (session_id);
CREATE INDEX idx_salesai_analytics_profile ON salesai_session_analytics (profile_id);
CREATE INDEX idx_salesai_analytics_company ON salesai_session_analytics (company_id);
CREATE INDEX idx_salesai_analytics_date ON salesai_session_analytics (session_date);
CREATE INDEX idx_salesai_subscriptions_profile ON salesai_subscriptions (profile_id);
CREATE INDEX idx_salesai_subscriptions_company ON salesai_subscriptions (company_id);
CREATE INDEX idx_salesai_subscriptions_status ON salesai_subscriptions (status);
CREATE INDEX idx_salesai_usage_profile ON salesai_usage (profile_id);
CREATE INDEX idx_salesai_usage_company ON salesai_usage (company_id);
CREATE INDEX idx_salesai_usage_period ON salesai_usage (period_start, period_end);

-- Full text search on transcripts
CREATE INDEX idx_salesai_transcript_search ON salesai_transcripts USING GIN (to_tsvector('english', content));

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION salesai_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger to tables with updated_at
CREATE TRIGGER update_salesai_companies_timestamp
BEFORE UPDATE ON salesai_companies
FOR EACH ROW EXECUTE PROCEDURE salesai_update_timestamp();

CREATE TRIGGER update_salesai_profiles_timestamp
BEFORE UPDATE ON salesai_profiles
FOR EACH ROW EXECUTE PROCEDURE salesai_update_timestamp();

CREATE TRIGGER update_salesai_sessions_timestamp
BEFORE UPDATE ON salesai_sessions
FOR EACH ROW EXECUTE PROCEDURE salesai_update_timestamp();

CREATE TRIGGER update_salesai_transcripts_timestamp
BEFORE UPDATE ON salesai_transcripts
FOR EACH ROW EXECUTE PROCEDURE salesai_update_timestamp();

CREATE TRIGGER update_salesai_subscriptions_timestamp
BEFORE UPDATE ON salesai_subscriptions
FOR EACH ROW EXECUTE PROCEDURE salesai_update_timestamp();
