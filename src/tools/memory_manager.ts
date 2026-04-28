import { supabase } from '../services/supabase.ts';

export const optimizeMemoryToolDefinition = {
    type: 'function',
    function: {
        name: 'optimize_memory',
        description: 'Run self-evolving memory maintenance. This will merge duplicate episodic memories and apply decay to old, unused knowledge graph nodes.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    }
};

export async function executeOptimizeMemory(): Promise<string> {
    let output = "Starting Memory Optimization...\n";

    try {
        // 1. Memory Decay: Delete unaccessed, low-value knowledge graph nodes
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: decayedNodes, error: decayError } = await supabase
            .from('knowledge_graph_nodes')
            .delete()
            .lt('last_accessed', thirtyDaysAgo.toISOString())
            .lt('access_count', 3)
            .select('id, entity');

        if (decayError) {
            output += `Error during memory decay: ${decayError.message}\n`;
        } else {
            output += `Decayed (forgot) ${decayedNodes?.length || 0} stale graph nodes.\n`;
        }

        // 2. Merge Duplicates: We'll find episodic memories with exact same content and delete duplicates
        // For semantic duplicates, an RPC would be required. This is a basic structural dedup.
        const { data: allEpisodes, error: epError } = await supabase
            .from('episodic_memory')
            .select('id, content')
            .order('created_at', { ascending: true });

        if (epError) {
            output += `Error fetching episodes for deduplication: ${epError.message}\n`;
        } else if (allEpisodes) {
            const seenContents = new Set<string>();
            const duplicatesToDelete: string[] = [];

            for (const ep of allEpisodes) {
                if (seenContents.has(ep.content)) {
                    duplicatesToDelete.push(ep.id);
                } else {
                    seenContents.add(ep.content);
                }
            }

            if (duplicatesToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from('episodic_memory')
                    .delete()
                    .in('id', duplicatesToDelete);

                if (deleteError) {
                    output += `Error deleting duplicates: ${deleteError.message}\n`;
                } else {
                    output += `Merged (deleted) ${duplicatesToDelete.length} duplicate episodic memories.\n`;
                }
            } else {
                output += `No duplicate episodic memories found to merge.\n`;
            }
        }

        output += "Memory optimization complete.";
        return output;
    } catch (e: any) {
        return `Failed to optimize memory: ${e.message}`;
    }
}
