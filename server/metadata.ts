import { ReadableStream } from 'node:stream/web';
import * as cheerio from 'cheerio';
import { EnvHttpProxyAgent, fetch } from 'undici';

export const DEFAULT_HOSTS = ['manga.line.me', 'piccoma.com', 'www.comico.jp', 'www.webtoons.com'];
export function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('URLが長すぎるか、形式が正しくありません。');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('https:// から始まるURLを入力してください。'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('認証情報を含まないHTTPSのURLを入力してください。');
  }
  url.hash = '';
  return url.href;
}
export function assertAllowed(value: string, hosts: string[]): URL {
  const url = new URL(normalizeUrl(value));
  if (!hosts.includes(url.hostname)) throw new Error('このサイトは自動取得の対象外です。リンクは保存できます。');
  return url;
}
export function parseMetadata(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const meta = (key: string) => $(`meta[property="${key}"],meta[name="${key}"]`).first().attr('content')?.trim();
  const title = (meta('og:title') || meta('twitter:title') || $('title').first().text().trim() || new URL(pageUrl).hostname).slice(0, 300);
  const description = (meta('og:description') || meta('description') || '').slice(0, 1000);
  const candidate = meta('og:image') || meta('twitter:image') || meta('twitter:image:src');
  let thumbnail: string | null = null;
  if (candidate) {
    try { thumbnail = normalizeUrl(new URL(candidate, pageUrl).href); } catch { /* fallback tile */ }
  }
  return { title, description, thumbnail };
}
const dispatcher = new EnvHttpProxyAgent();
export async function extractMetadata(value: string, hosts: string[]) {
  let current = assertAllowed(value, hosts);
  const signal = AbortSignal.timeout(10_000);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(current, {
      dispatcher, signal, redirect: 'manual',
      headers: { 'user-agent': 'ScrollMangaShelf/0.1 (link-preview)', accept: 'text/html,application/xhtml+xml' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw new Error('転送先が見つかりません。');
      current = assertAllowed(new URL(location, current).href, hosts);
      continue;
    }
    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel();
      throw new Error(`サムネイルを取得できませんでした（HTTP ${response.status}）。`);
    }
    if (!response.body) throw new Error('ページの内容が空です。');
    const html = await readMetadataHtml(response.body);
    return parseMetadata(html, current.href);
  }
  throw new Error('ページの転送が多すぎます。');
}

// Stop after </head>: cover metadata does not require downloading a long reader page.
export async function readMetadataHtml(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const limit = 1_048_576;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const available = limit - bytes;
      chunks.push(value.subarray(0, available));
      bytes += value.byteLength;
      const html = Buffer.concat(chunks).toString('utf8');
      const headEnd = html.toLowerCase().indexOf('</head>');
      if (headEnd !== -1) return html.slice(0, headEnd + 7);
      if (bytes >= limit) throw new Error('ページ先頭が大きすぎるため取得を中止しました。');
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel(); }
}
