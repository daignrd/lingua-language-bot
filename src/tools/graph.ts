import { upsertGraphNode, addGraphEdge, getEntityRelations } from '../services/supabase.ts';

export const upsertGraphNodeToolDefinition = {
    type: 'function',
    function: {
        name: 'upsert_graph_node',
        description: 'Add or update a node in the knowledge graph.',
        parameters: {
            type: 'object',
            properties: {
                entity: { type: 'string', description: 'The name of the entity, e.g., "Daigan" or "OpenAI"' },
                type: { type: 'string', description: 'The type of the entity, e.g., "Person", "Organization", "Concept"' },
                properties: { type: 'string', description: 'An optional JSON string of properties to attach to the node.' }
            },
            required: ['entity', 'type']
        }
    }
};

export const addGraphEdgeToolDefinition = {
    type: 'function',
    function: {
        name: 'add_graph_edge',
        description: 'Add a directed relationship between two nodes in the knowledge graph.',
        parameters: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'The UUID of the source node' },
                target: { type: 'string', description: 'The UUID of the target node' },
                relation: { type: 'string', description: 'The nature of the relationship, e.g., "WORKS_FOR", "LIKES"' },
                properties: { type: 'string', description: 'An optional JSON string of properties' }
            },
            required: ['source', 'target', 'relation']
        }
    }
};

export const getEntityRelationsToolDefinition = {
    type: 'function',
    function: {
        name: 'get_entity_relations',
        description: 'Retrieve all adjacent nodes (relationships) for a given entity.',
        parameters: {
            type: 'object',
            properties: {
                entity: { type: 'string', description: 'The exact string name of the entity to look up' }
            },
            required: ['entity']
        }
    }
};

export async function executeUpsertGraphNode(args: any): Promise<string> {
    try {
        const id = await upsertGraphNode(args.entity, args.type, args.properties ? JSON.parse(args.properties) : {});
        return id ? `Successfully upserted node [${args.entity}]. ID: ${id}` : `Failed to upsert node [${args.entity}].`;
    } catch (e: any) {
        return `Error parsing properties JSON: ${e.message}`;
    }
}

export async function executeAddGraphEdge(args: any): Promise<string> {
    try {
        const success = await addGraphEdge(args.source, args.target, args.relation, args.properties ? JSON.parse(args.properties) : {});
        return success ? `Successfully added edge [${args.relation}] between ${args.source} and ${args.target}` : `Failed to add edge.`;
    } catch (e: any) {
        return `Error parsing properties JSON: ${e.message}`;
    }
}

export async function executeGetEntityRelations(args: any): Promise<string> {
    const relations = await getEntityRelations(args.entity);
    if (!relations || relations.length === 0) {
        return `No relations found for entity [${args.entity}].`;
    }
    return `Relations for [${args.entity}]:\n` + relations.map(r =>
        r.target ? `-> [${r.relation}] -> ${r.target} (${r.target_type})` : `<- [${r.relation}] <- ${r.source} (${r.source_type})`
    ).join('\n');
}
