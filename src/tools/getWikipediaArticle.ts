/** Agent tool: fetch the plain-text extract of a Wikipedia article. */
import { getWikipediaPage } from '@/clients/wikipedia/getWikipediaPage';
import type { AgentTool } from '@/tools/agentTool';

export const getWikipediaArticle: AgentTool = {
    schema: {
        name: 'get_wikipedia_article',
        description:
            'Fetch the full plain-text content of a Wikipedia article by its exact ' +
            'title. Call this after search_wikipedia to read an article you found.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Exact article title' },
            },
            required: ['title'],
        },
    },
    execute: async (input) => {
        const { title } = input as { title?: string };
        if (!title || !title.trim()) {
            throw new Error('get_wikipedia_article requires a non-empty title');
        }
        const page = await getWikipediaPage(title);
        return JSON.stringify(page);
    },
};
