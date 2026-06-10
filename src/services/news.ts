/**
 * News fetcher — pulls authentic target-language news from any RSS 2.0 feed.
 *
 * Generic: the feed is configured per deployment via the NEWS_RSS_URL env var
 * (e.g. Tagesschau for German, ANSA for Italian). The /news command can also
 * take a one-off feed URL as an argument. The agent scaffolds readings/vocab/
 * comprehension on top (see skills/news-reading.md).
 */

import { config } from '../config.ts';

export interface NewsItem {
    title: string;
    summary: string;
    link: string;
    pubDate: string;
}

function decodeEntities(s: string): string {
    return s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
}

function tag(block: string, name: string): string {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
    return m ? decodeEntities(m[1]) : '';
}

/**
 * Fetch recent headlines from an RSS feed.
 * @param feedUrl Optional override; defaults to config.news.rssUrl.
 * @param limit   Max items to return.
 */
export async function fetchHeadlines(feedUrl?: string, limit: number = 8): Promise<NewsItem[]> {
    const url = (feedUrl || config.news.rssUrl || '').trim();
    if (!url) {
        throw new Error('No news feed configured. Set NEWS_RSS_URL in your environment, or pass a feed URL: /news <rss-url>');
    }

    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
        throw new Error(`News feed fetch failed (${res.status}).`);
    }

    const xml = await res.text();
    // Support both RSS <item> and Atom <entry>.
    const unit = xml.includes('<item>') ? 'item' : 'entry';
    const blocks = xml.split(`<${unit}`).slice(1).map(b => b.split(`</${unit}>`)[0]);

    const items: NewsItem[] = [];
    for (const block of blocks) {
        const title = tag(block, 'title');
        if (!title) continue;
        const linkMatch = block.match(/<link[^>]*href="([^"]+)"/) || null;
        items.push({
            title,
            summary: tag(block, 'description') || tag(block, 'summary') || tag(block, 'content'),
            link: tag(block, 'link') || (linkMatch ? linkMatch[1] : ''),
            pubDate: tag(block, 'pubDate') || tag(block, 'updated'),
        });
        if (items.length >= limit) break;
    }

    if (items.length === 0) {
        throw new Error('News feed returned no parseable items.');
    }
    return items;
}
