/** Agent tool: list articles related to (linked from) a Wikipedia page. */
import { getWikipediaPageLinks } from '@/clients/wikipedia/getWikipediaPageLinks';
import type { AgentTool } from '@/tools/agentTool';

export const getRelatedArticles: AgentTool = {
    schema: {
        name: 'get_related_articles',
        description:
            'List Wikipedia article titles related to (linked from) a given ' +
            'article. Call this to discover adjacent topics worth reading.',
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
            throw new Error('get_related_articles requires a non-empty title');
        }
        const links = await getWikipediaPageLinks(title);
        return JSON.stringify(links);
    },
};
