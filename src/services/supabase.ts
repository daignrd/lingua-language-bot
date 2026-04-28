import { createClient } from '@supabase/supabase-js';
import { config } from '../config.ts';

// Initialize the Supabase client using the Service Role Key to bypass RLS 
// (since this is a secure, local, single-user agent)
export const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export interface CoreFact {
    id: string;
    fact_key: string;
    fact_value: string;
    created_at: string;
    updated_at: string;
}

/**
 * Retrieves all core facts to be injected into the agent's system prompt.
 */
export async function getCoreFacts(): Promise<CoreFact[]> {
    const { data, error } = await supabase
        .from('core_facts')
        .select('*')
        .order('fact_key', { ascending: true });

    if (error) {
        console.error('Failed to fetch core facts:', error);
        return [];
    }

    return data as CoreFact[];
}

/**
 * Inserts or updates a core fact.
 * Note: `fact_key` is unique. Upsert handles the conflict.
 */
export async function upsertCoreFact(key: string, value: string): Promise<boolean> {
    const { error } = await supabase
        .from('core_facts')
        .upsert({ fact_key: key, fact_value: value, updated_at: new Date().toISOString() }, { onConflict: 'fact_key' });

    if (error) {
        console.error(`Failed to upsert core fact [${key}]:`, error);
        return false;
    }

    return true;
}

/**
 * Deletes a core fact by its key.
 */
export async function deleteCoreFact(key: string): Promise<boolean> {
    const { error } = await supabase
        .from('core_facts')
        .delete()
        .eq('fact_key', key);

    if (error) {
        console.error(`Failed to delete core fact [${key}]:`, error);
        return false;
    }

    return true;
}

// --- WORKING MEMORY (SHORT-TERM CHAT LOGS) ---

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    created_at: string;
}

/**
 * Saves a single message to the episodic working memory.
 */
export async function saveMessage(role: 'user' | 'assistant' | 'system' | 'tool', content: string): Promise<boolean> {
    const { error } = await supabase
        .from('messages')
        .insert({ role, content });

    if (error) {
        console.error('Failed to save message to working memory:', error);
        return false;
    }
    return true;
}

/**
 * Retrieves the N most recent messages to provide short-term context to the LLM.
 */
export async function getRecentMessages(limit: number = 15): Promise<{ role: string, content: string }[]> {
    const { data, error } = await supabase
        .from('messages')
        .select('role, content')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Failed to fetch recent messages:', error);
        return [];
    }

    // We ordered by descending to get the most recent, but we need to return them in chronological order
    const formatted = data.map(msg => ({ role: msg.role, content: msg.content }));
    return formatted.reverse();
}

/**
 * Clears the working memory session (for the /new command).
 */
export async function clearWorkingMemory(): Promise<boolean> {
    const { error } = await supabase
        .from('messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
        console.error('Failed to clear working memory:', error);
        return false;
    }
    return true;
}

// --- EPISODIC MEMORY (SEMANTIC RAG) ---

export interface EpisodicMemory {
    id: string;
    content: string;
    similarity?: number;
}

/**
 * Inserts a new summarized conversational episode into the vector database.
 */
export async function insertEpisodicMemory(content: string, embedding: number[]): Promise<boolean> {
    const { error } = await supabase
        .from('episodic_memory')
        .insert({ content, embedding });

    if (error) {
        console.error('Failed to insert episodic memory:', error);
        return false;
    }
    return true;
}

/**
 * Semantically searches past conversational episodes based on the embedded query.
 * Uses the `match_episodes` RPC function defined in the SQL schema.
 */
export async function searchEpisodicMemory(queryEmbedding: number[], matchThreshold: number = 0.5, matchCount: number = 5): Promise<EpisodicMemory[]> {
    const { data, error } = await supabase.rpc('match_episodes', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount
    });

    if (error) {
        console.error('Failed to search episodic memory:', error);
        return [];
    }

    return data as EpisodicMemory[];
}

// --- KNOWLEDGE GRAPH MEMORY ---

export interface GraphNode {
    id: string;
    entity: string;
    type: string;
    properties?: any;
    last_accessed?: string;
    access_count?: number;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    relation: string;
    properties?: any;
}

/**
 * Inserts or updates a node in the knowledge graph.
 */
export async function upsertGraphNode(entity: string, type: string, properties: any = {}): Promise<string | null> {
    const { data, error } = await supabase
        .from('knowledge_graph_nodes')
        .upsert(
            { entity, type, properties, last_accessed: new Date().toISOString() },
            { onConflict: 'entity, type' }
        )
        .select('id')
        .single();

    if (error) {
        console.error(`Failed to upsert graph node [${entity}]:`, error);
        return null;
    }
    // Increment access count if it already existed
    const { error: rpcError } = await supabase.rpc('increment_node_access', { node_id: data.id });
    if (rpcError) {
        console.warn(`Could not increment node access for [${data.id}]:`, rpcError.message);
    }

    return data.id;
}

/**
 * Inserts a directed edge (relationship) between two nodes.
 */
export async function addGraphEdge(sourceId: string, targetId: string, relation: string, properties: any = {}): Promise<boolean> {
    const { error } = await supabase
        .from('knowledge_graph_edges')
        .upsert(
            { source: sourceId, target: targetId, relation, properties },
            { onConflict: 'source, target, relation' }
        );

    if (error) {
        console.error(`Failed to add graph edge [${relation}]:`, error);
        return false;
    }

    return true;
}

/**
 * Traverses the graph to find adjacent nodes of a given entity.
 */
export async function getEntityRelations(entity: string): Promise<any[]> {
    // Look up the node ID
    const { data: nodeData, error: nodeError } = await supabase
        .from('knowledge_graph_nodes')
        .select('id')
        .eq('entity', entity)
        .single();

    if (nodeError || !nodeData) {
        return [];
    }

    const nodeId = nodeData.id;

    // Get edges where this node is the source
    const { data: sourceEdges, error: sourceError } = await supabase
        .from('knowledge_graph_edges')
        .select('relation, target_node:target(entity, type)')
        .eq('source', nodeId);

    // Get edges where this node is the target
    const { data: targetEdges, error: targetError } = await supabase
        .from('knowledge_graph_edges')
        .select('relation, source_node:source(entity, type)')
        .eq('target', nodeId);

    const relations = [];

    if (!sourceError && sourceEdges) {
        relations.push(...sourceEdges.map((e: any) => ({
            relation: e.relation,
            target: e.target_node.entity,
            target_type: e.target_node.type
        })));
    }

    if (!targetError && targetEdges) {
        relations.push(...targetEdges.map((e: any) => ({
            source: e.source_node.entity,
            source_type: e.source_node.type,
            relation: e.relation
        })));
    }

    // Update access tally
    await supabase
        .from('knowledge_graph_nodes')
        .update({ last_accessed: new Date().toISOString() })
        .eq('id', nodeId);

    return relations;
}

/**
 * Pings the database to prevent it from pausing due to inactivity on the free tier.
 * A simple read query qualifies as activity.
 */
export async function pingDatabase(): Promise<boolean> {
    const { error } = await supabase.from('core_facts').select('id').limit(1);
    if (error) {
        console.error('Database keep-alive ping failed:', error.message);
        return false;
    }
    console.log('Database keep-alive ping successful.');
    return true;
}
