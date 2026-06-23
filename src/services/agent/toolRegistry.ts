/** Maps tool names to their AgentTool and exposes the schema list for the
 * Anthropic request. */
import { getRelatedArticles } from '@/tools/getRelatedArticles';
import { getWikipediaArticle } from '@/tools/getWikipediaArticle';
import { searchWikipedia } from '@/tools/searchWikipedia';
import { webSearch } from '@/tools/webSearch';
import type { AgentTool } from '@/tools/agentTool';
import type Anthropic from '@anthropic-ai/sdk';

export const toolRegistry: Record<string, AgentTool> = {
    search_wikipedia: searchWikipedia,
    get_wikipedia_article: getWikipediaArticle,
    get_related_articles: getRelatedArticles,
    web_search: webSearch,
};

export const toolSchemas: Anthropic.Tool[] = Object.values(toolRegistry).map((tool) => tool.schema);
