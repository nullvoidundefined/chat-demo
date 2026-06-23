/** Fetches a Wikipedia page's plain-text extract via the MediaWiki API,
 * truncating to MAX_ARTICLE_CHARS to bound context size. */
import { MAX_ARTICLE_CHARS } from '@/constants/agent';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

type RawPage = { title?: string; extract?: string };
type WikipediaPage = { title: string; extract: string; truncated: boolean };

export async function getWikipediaPage(title: string): Promise<WikipediaPage> {
    const url = buildPageUrl(title);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Wikipedia page fetch failed: ${response.status}`);
    }
    const data = (await response.json()) as {
        query?: { pages?: Record<string, RawPage> };
    };
    const page = extractFirstPage(data, title);
    return buildPageResult(page, title);
}

function buildPageUrl(title: string): string {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        prop: 'extracts',
        explaintext: '1',
        redirects: '1',
        titles: title,
    });
    return `${WIKIPEDIA_API}?${params}`;
}

function extractFirstPage(
    data: { query?: { pages?: Record<string, RawPage> } },
    title: string,
): RawPage {
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page || page.extract === undefined) {
        throw new Error(`Wikipedia page not found: ${title}`);
    }
    return page;
}

function buildPageResult(page: RawPage, fallbackTitle: string): WikipediaPage {
    const full = page.extract as string;
    const truncated = full.length > MAX_ARTICLE_CHARS;
    return {
        title: page.title ?? fallbackTitle,
        extract: truncated ? full.slice(0, MAX_ARTICLE_CHARS) : full,
        truncated,
    };
}
