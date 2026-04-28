import { search, SafeSearchType } from 'duck-duck-scrape';

export const webSearchToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'web_search',
        description: 'Search the web using DuckDuckGo to find recent information, news, or answers.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query' }
            },
            required: ['query']
        }
    }
};

export async function executeWebSearch(args: any): Promise<string> {
    try {
        const query = args.query;
        const searchResults = await search(query, {
            safeSearch: SafeSearchType.MODERATE
        });

        if (!searchResults.results || searchResults.results.length === 0) {
            return `No meaningful search results found for query: ${query}`;
        }

        const topResults = searchResults.results.slice(0, 5); // Take top 5 results

        const formattedResults = topResults.map(result => {
            return `Title: ${result.title}\nURL: ${result.url}\nExcerpt: ${result.description}\n`;
        }).join('\n');

        return `Search results for "${query}":\n\n${formattedResults}`;
    } catch (e: any) {
        return `Web Search failed: ${e.message}`;
    }
}
