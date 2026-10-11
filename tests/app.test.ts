import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.js';
import { createApp } from '../server/app.js';

test('store persists saved links across restarts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'manga-test-'));
  try {
    const first = createStore(join(dir, 'test.sqlite'));
    first.add('https://example.com/manga'); first.close();
    const second = createStore(join(dir, 'test.sqlite'));
    assert.equal(second.list()[0].url, 'https://example.com/manga'); second.close();
  } finally { rmSync(dir, { recursive: true }); }
});
test('API supports bulk registration, deduplication, extraction failures and deletion', async () => {
  const store = createStore(':memory:');
  const app = createApp(store, async (url: string) => {
    if (url.includes('/fail')) throw new Error('取得できませんでした。');
    return { title: 'テスト漫画', description: '作品説明', thumbnail: 'https://example.com/cover.jpg' };
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api`;
  const call = (path: string, method = 'GET', data?: unknown, origin?: string) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  try {
    let response = await call('/links', 'POST', { urls: ['https://example.com/good', 'https://example.com/good#hash', 'https://example.com/fail'] });
    assert.equal(response.status, 201);
    const batch = await response.json() as { ids: string[]; added: number; skipped: number };
    assert.equal(batch.added, 2); assert.equal(batch.skipped, 1);
    response = await call(`/links/${batch.ids[0]}/refresh`, 'POST', {});
    assert.equal((await response.json() as { title: string }).title, 'テスト漫画');
    response = await call(`/links/${batch.ids[1]}/refresh`, 'POST', {});
    assert.equal((await response.json() as { status: string }).status, 'failed');
    assert.equal(store.list().length, 2);
    assert.equal((await call('/links', 'POST', { urls: ['https://example.com/valid', 'bad'] })).status, 400);
    assert.equal(store.list().length, 2, 'invalid batch should not partially save');
    assert.equal((await call('/links', 'POST', { urls: Array(31).fill('https://example.com/') })).status, 400);
    assert.equal((await call('/links', 'POST', { urls: ['https://example.com/'] }, 'https://evil.example')).status, 403);
    assert.equal((await call('/links/missing/refresh', 'POST', {})).status, 404);
    assert.equal((await call(`/links/${batch.ids[0]}`, 'DELETE', {})).status, 204);
    assert.equal(store.list().length, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); }
});
