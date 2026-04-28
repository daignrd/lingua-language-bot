import { upsertCoreFact, deleteCoreFact } from '../services/supabase.ts';

export const addCoreFactToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'add_core_fact',
        description: 'Autonomously save a core, permanent fact about the user or their preferences so you never forget it. Overwrites existing facts with the same key. Use this for fundamental truths (e.g. name, location, preferred language, favorite color, project context).',
        parameters: {
            type: 'object',
            properties: {
                fact_key: {
                    type: 'string',
                    description: 'A concise, snake_case key identifying the fact (e.g., user_name, user_company, preferred_language).',
                },
                fact_value: {
                    type: 'string',
                    description: 'The actual fact to remember (e.g., a name, an employer, a preferred language).',
                },
            },
            required: ['fact_key', 'fact_value'],
        },
    },
};

export const deleteCoreFactToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'delete_core_fact',
        description: 'Delete a core fact that is no longer true or relevant.',
        parameters: {
            type: 'object',
            properties: {
                fact_key: {
                    type: 'string',
                    description: 'The snake_case key of the fact to remove.',
                },
            },
            required: ['fact_key'],
        },
    },
};

export async function executeAddCoreFact(args: { fact_key: string; fact_value: string }): Promise<string> {
    const success = await upsertCoreFact(args.fact_key, args.fact_value);
    return success
        ? `Successfully saved core fact: ${args.fact_key} = ${args.fact_value}`
        : `Failed to save core fact: ${args.fact_key}`;
}

export async function executeDeleteCoreFact(args: { fact_key: string }): Promise<string> {
    const success = await deleteCoreFact(args.fact_key);
    return success
        ? `Successfully deleted core fact: ${args.fact_key}`
        : `Failed to delete core fact: ${args.fact_key}`;
}
