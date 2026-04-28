import { getEmbedding } from '../services/embeddings.ts';
import { searchEpisodicMemory, insertEpisodicMemory } from '../services/supabase.ts';

export const searchPastConversationsToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'search_past_conversations',
        description: 'Semantically search through past conversational episodes to remember things the user told you that are not in your core facts. Use this when the user asks "Do you remember when..." or references a past project/idea.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query to embed and match against past episodes (e.g., "discussion about Pinecone vs Supabase").',
                },
            },
            required: ['query'],
        },
    },
};

export const commitEpisodeToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'commit_episode',
        description: 'Autonomously save a summary of the current conversation/topic to long-term episodic memory. Use this tool ONLY when a distinct topic of conversation concludes, summarizing what was discussed so you can remember it later.',
        parameters: {
            type: 'object',
            properties: {
                summary: {
                    type: 'string',
                    description: 'A rich, detailed summary of the conversation episode to save. Include important context, decisions made, and key takeaways.',
                },
            },
            required: ['summary'],
        },
    },
};

export async function executeSearchPastConversations(args: { query: string }): Promise<string> {
    try {
        const queryEmbedding = await getEmbedding(args.query);
        const results = await searchEpisodicMemory(queryEmbedding, 0.4, 5); // 0.4 threshold, 5 results

        if (results.length === 0) {
            return `No relevant past conversations found for: "${args.query}"`;
        }

        const formattedResults = results.map((res, index) =>
            `[Episode ${index + 1} - Match: ${Math.round(res.similarity! * 100)}%]\n${res.content}`
        ).join('\n\n');

        return `Found the following relevant past episodes:\n\n${formattedResults}`;
    } catch (error) {
        return `Failed to search past conversations: ${error instanceof Error ? error.message : String(error)}`;
    }
}

export async function executeCommitEpisode(args: { summary: string }): Promise<string> {
    try {
        const embedding = await getEmbedding(args.summary);
        const success = await insertEpisodicMemory(args.summary, embedding);

        return success
            ? "Successfully committed the episode to long-term memory."
            : "Failed to commit the episode to the database.";
    } catch (error) {
        return `Failed to commit episode: ${error instanceof Error ? error.message : String(error)}`;
    }
}
