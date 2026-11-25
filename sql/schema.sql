-- Production PostgreSQL + pgvector Schema for EDXSO LinkedIn Discovery
-- Designed for strict provenance, canonical URL deduplication, and GDPR/DPDP retention hygiene.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_code TEXT NOT NULL UNIQUE,
  input_mode TEXT NOT NULL CHECK (input_mode IN ('keyword', 'post_url')),
  query_or_url TEXT NOT NULL,
  data_source TEXT NOT NULL CHECK (data_source IN ('labelled_test_dataset', 'supplied_url_manual', 'authorized_provider')),
  is_test_data BOOLEAN NOT NULL DEFAULT TRUE,
  ai_method TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE TABLE discovered_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  canonical_post_url TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT,
  author_profile_url TEXT,
  published_at TIMESTAMPTZ,
  snippet TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  relevance_to_query NUMERIC(4,3) NOT NULL,
  data_source TEXT NOT NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (run_id, canonical_post_url)
);

-- Canonicalized person profiles (stores outreach-essential public professional fields only)
CREATE TABLE prospect_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_linkedin_url TEXT NOT NULL UNIQUE,
  linkedin_url TEXT NOT NULL,
  full_name TEXT NOT NULL,
  headline TEXT,
  current_role TEXT,
  organization TEXT,
  location TEXT,
  school_ecosystem_indicators TEXT[] DEFAULT '{}',
  semantic_embedding vector(12),
  data_source TEXT NOT NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Engagement provenance: links original commenters to every source post they commented on
CREATE TABLE post_comment_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES discovered_posts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES prospect_profiles(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  commented_at TIMESTAMPTZ,
  UNIQUE (run_id, post_id, profile_id)
);

-- Ranked commenter assessments per run
CREATE TABLE commenter_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES prospect_profiles(id) ON DELETE CASCADE,
  relevance_score INTEGER NOT NULL CHECK (relevance_score BETWEEN 0 AND 100),
  ecosystem_fit_score INTEGER NOT NULL,
  network_reach_score INTEGER NOT NULL,
  semantic_alignment_score INTEGER NOT NULL,
  engagement_signal_score INTEGER NOT NULL,
  persona_tier TEXT NOT NULL,
  relevance_explanation TEXT NOT NULL,
  UNIQUE (run_id, profile_id)
);

-- Strictly separated AI-discovered lookalikes with explicit seed traceability
CREATE TABLE lookalike_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES prospect_profiles(id) ON DELETE CASCADE,
  top_seed_profile_id UUID NOT NULL REFERENCES prospect_profiles(id) ON DELETE CASCADE,
  similarity_score INTEGER NOT NULL CHECK (similarity_score BETWEEN 0 AND 100),
  relevance_score INTEGER NOT NULL CHECK (relevance_score BETWEEN 0 AND 100),
  similarity_evidence TEXT[] DEFAULT '{}',
  seed_rationale TEXT NOT NULL,
  relevance_explanation TEXT NOT NULL,
  UNIQUE (run_id, candidate_profile_id)
);
