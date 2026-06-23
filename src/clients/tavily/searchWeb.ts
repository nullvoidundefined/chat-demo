/** Calls the Tavily search API and maps results to title/url/snippet. The
 * API key is passed in (read from server config) rather than read here. */

const TAVILY_API = 'https://api.tavily.com/search';

type WebResult = { title: string; url: string; snippet: string };

export async function searchWeb(
    query: string,
    apiKey: string,
    maxResults = 5,
): Promise<WebResult[]> {
    const response = await fetch(TAVILY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: maxResults,
        }),
    });
    if (!response.ok) {
        throw new Error(`Tavily search failed: ${response.status}`);
    }
    const data = (await response.json()) as {
        results?: { title: string; url: string; content: string }[];
    };
    return (data.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
    }));
}
