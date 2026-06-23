/** Agent tool: search Wikipedia article titles. Wraps the Wikipedia client
 * and validates input before calling it. */
import { searchWikipediaArticles } from '@/clients/wikipedia/searchWikipediaArticles';
import { DEFAULT_SEARCH_LIMIT } from '@/constants/agent';
import type { AgentTool } from '@/tools/agentTool';

const searchWikipedia: AgentTool = {
    schema: {
        name: 'search_wikipedia',
        description:
            'Search Wikipedia for article titles matching a query. Call this first ' +
            'when you need to find which articles exist about a topic, person, ' +
            'company, or event.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search terms' },
                limit: { type: 'integer', description: 'Max results (default 5)' },
            },
            required: ['query'],
        },
    },
    execute: async (input) => {
        const { query, limit } = input as { query?: string; limit?: number };
        if (!query || !query.trim()) {
            throw new Error('search_wikipedia requires a non-empty query');
        }
        const results = await searchWikipediaArticles(
            query,
            limit ?? DEFAULT_SEARCH_LIMIT,
        );
        return JSON.stringify(results);
    },
};

export default searchWikipedia;
