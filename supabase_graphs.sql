-- Gravity Claw: Knowledge Graph Architecture Schema
-- Paste this entire script into the Supabase SQL Editor and click "Run", or apply via migration

-- 1. Knowledge Graph Nodes
CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity TEXT NOT NULL,
    type TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (entity, type)
);

-- 2. Knowledge Graph Edges
CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source UUID REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    target UUID REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source, target, relation)
);

-- 3. Increment Node Access RPC
CREATE OR REPLACE FUNCTION increment_node_access(node_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE knowledge_graph_nodes
  SET access_count = access_count + 1,
      last_accessed = NOW()
  WHERE id = node_id;
$$;
