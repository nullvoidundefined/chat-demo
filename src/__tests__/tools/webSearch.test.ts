import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/clients/tavily/searchWeb', () => ({
    searchWeb: vi.fn(async () => [{ title: 'A', url: 'https://a.com', snippet: 's' }]),
}));

import { webSearch } from '@/tools/webSearch';
import { searchWeb } from '@/clients/tavily/searchWeb';

describe('webSearch tool', () => {
    afterEach(() => vi.clearAllMocks());

    it('passes the tavily api key from deps to the client', async () => {
        await webSearch.execute({ query: 'news' }, { tavilyApiKey: 'tvly-x' });
        expect(searchWeb).toHaveBeenCalledWith('news', 'tvly-x');
    });

    it('rejects empty query', async () => {
        await expect(
            webSearch.execute({ query: '   ' }, { tavilyApiKey: 'tvly-x' }),
        ).rejects.toThrow(/query/);
    });
});
