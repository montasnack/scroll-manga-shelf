import { ReadableStream } from 'node:stream/web';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertAllowed, normalizeUrl, parseMetadata, readMetadataHtml } from '../server/metadata.js';

test('normalizes links and rejects non-HTTPS, credentials and custom ports', () => {
  assert.equal(normalizeUrl(' https://manga.line.me/test#chapter '), 'https://manga.line.me/test');
  for (const value of ['javascript:alert(1)', 'http://localhost', 'https://user:secret@example.com', 'https://example.com:8080', 'no url', null]) {
    assert.throws(() => normalizeUrl(value));
  }
});
test('fetch allowlist is exact, including redirected destinations', () => {
  assert.equal(assertAllowed('https://manga.line.me/test', ['manga.line.me']).hostname, 'manga.line.me');
  for (const url of ['https://127.0.0.1/', 'https://manga.line.me.evil.example/', 'https://evil.example/', 'https://[::1]/']) {
    assert.throws(() => assertAllowed(url, ['manga.line.me']));
  }
});
test('extracts OGP and resolves relative cover URLs', () => {
  const result = parseMetadata('<title>Fallback</title><meta property="og:title" content="作品 &amp; 続編"><meta property="og:image" content="/cover.jpg"><meta name="description" content="説明">', 'https://example.com/work/1');
  assert.deepEqual(result, { title: '作品 & 続編', description: '説明', thumbnail: 'https://example.com/cover.jpg' });
});
test('Twitter images and fallback work without unsafe schemes', () => {
  assert.equal(parseMetadata('<meta name="twitter:image" content="https://cdn.example.com/a.jpg">', 'https://example.com/').thumbnail, 'https://cdn.example.com/a.jpg');
  assert.deepEqual(parseMetadata('<title>Title</title><meta property="og:image" content="javascript:alert(1)">', 'https://example.com/'), { title: 'Title', description: '', thumbnail: null });
});

test('stops at the end of head before downloading a large reader body', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Buffer.from('<html><head><title>作品</title></he'));
      controller.enqueue(Buffer.from('ad>' + 'x'.repeat(2_000_000)));
    },
    cancel() { cancelled = true; },
  });
  const html = await readMetadataHtml(body);
  assert.equal(parseMetadata(html, 'https://example.com/').title, '作品');
  assert.ok(html.endsWith('</head>'));
  assert.equal(cancelled, true);
});
test('rejects oversized pages without a completed head', async () => {
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(Buffer.alloc(1_048_577)); c.close(); } });
  await assert.rejects(() => readMetadataHtml(body), /大きすぎる/);
});
