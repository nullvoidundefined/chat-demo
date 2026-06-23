/** Fetches the titles of articles linked from a Wikipedia page (namespace 0),
 * used as the agent's "related articles" signal. */
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

export async function getWikipediaPageLinks(title: string): Promise<string[]> {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        prop: 'links',
        plnamespace: '0',
        pllimit: '20',
        redirects: '1',
        titles: title,
    });
    const response = await fetch(`${WIKIPEDIA_API}?${params}`);
    if (!response.ok) {
        throw new Error(`Wikipedia links fetch failed: ${response.status}`);
    }
    const data = (await response.json()) as {
        query?: { pages?: Record<string, { links?: { title: string }[] }> };
    };
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    return (page?.links ?? []).map((link) => link.title);
}
