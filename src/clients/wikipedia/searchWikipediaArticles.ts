/** Searches Wikipedia article titles via the MediaWiki API and returns
 * title/snippet pairs with HTML markup removed. */
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

type SearchResult = { title: string; snippet: string };

export async function searchWikipediaArticles(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`);
  if (!response.ok) {
    throw new Error(`Wikipedia search failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    query?: { search?: { title: string; snippet: string }[] };
  };
  const hits = data.query?.search ?? [];
  return hits.map((hit) => ({
    title: hit.title,
    snippet: stripHtml(hit.snippet),
  }));
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').trim();
}
