/** Agent tool: general web search via Tavily, for current or
 * non-encyclopedic information not covered well by Wikipedia. */
import { searchWeb } from '@/clients/tavily/searchWeb';
import type { AgentTool } from '@/tools/agentTool';

const webSearch: AgentTool = {
    schema: {
        name: 'web_search',
        description:
            'Search the web for current or non-encyclopedic information. Call this ' +
            'when Wikipedia is unlikely to cover the topic, or you need recent news.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search terms' },
            },
            required: ['query'],
        },
    },
    execute: async (input, deps) => {
        const { query } = input as { query?: string };
        if (!query || !query.trim()) {
            throw new Error('web_search requires a non-empty query');
        }
        const results = await searchWeb(query, deps.tavilyApiKey);
        return JSON.stringify(results);
    },
};

export default webSearch;
