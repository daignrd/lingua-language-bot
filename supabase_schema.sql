-- Gravity Claw: Tri-Partite Memory Architecture Schema
-- Paste this entire script into the Supabase SQL Editor and click "Run"

-- 1. Enable the pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Working Memory (Short-Term Chat Logs)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Declarative Memory (Core Facts)
CREATE TABLE IF NOT EXISTS core_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact_key TEXT UNIQUE NOT NULL,    -- e.g., "user_name", "user_company"
    fact_value TEXT NOT NULL,         -- e.g., "Daigan", "Laser Digital"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Episodic Memory (Semantic RAG Vectors)
CREATE TABLE IF NOT EXISTS episodic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,               -- The summarized content of the episode
    embedding VECTOR(768),               -- text-embedding-004 uses 768 dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We use 768 dimensions for the vector column because that is the standard
-- size for Gemini's `text-embedding-004` model.

-- 5. Create a function for Cosine Similarity Search on Episodic Memory
CREATE OR REPLACE FUNCTION match_episodes (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    episodic_memory.id,
    episodic_memory.content,
    1 - (episodic_memory.embedding <=> query_embedding) AS similarity
  FROM episodic_memory
  WHERE 1 - (episodic_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY episodic_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;
