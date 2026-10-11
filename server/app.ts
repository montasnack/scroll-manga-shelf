import express from 'express';
import type { createStore } from './store.js';
import { DEFAULT_HOSTS, extractMetadata, normalizeUrl } from './metadata.js';

type Store = ReturnType<typeof createStore>;
export function createApp(store: Store, extract = extractMetadata) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && !['http://localhost:5173', 'http://127.0.0.1:5173', `http://${req.get('host')}`, `https://${req.get('host')}`].includes(origin)) {
        res.status(403).json({ error: 'この接続元からは変更できません。' }); return;
      }
      if (!req.is('application/json')) { res.status(415).json({ error: 'JSONで送信してください。' }); return; }
    }
    next();
  });
  const hosts = (process.env.METADATA_ALLOWED_HOSTS ?? DEFAULT_HOSTS.join(',')).split(',').map(x => x.trim()).filter(Boolean);
  const active = new Set<string>();
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/links', (_req, res) => res.json(store.list()));
  app.post('/api/links', (req, res) => {
    try {
      if (!Array.isArray(req.body?.urls) || req.body.urls.length < 1 || req.body.urls.length > 30) throw new Error('1回につき1〜30件のURLを登録できます。');
      const urls = req.body.urls.map(normalizeUrl);
      const ids = urls.map((url: string) => store.add(url)).filter(Boolean);
      res.status(201).json({ ids, added: ids.length, skipped: urls.length - ids.length });
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'URLを確認してください。' }); }
  });
  app.post('/api/links/:id/refresh', async (req, res) => {
    const link = store.get(req.params.id);
    if (!link) { res.status(404).json({ error: 'リンクが見つかりません。' }); return; }
    if (active.size >= 2 || active.has(link.id)) { res.status(429).json({ error: '取得中です。少し待って再試行してください。' }); return; }
    active.add(link.id);
    try { store.update(link.id, await extract(link.url, hosts)); }
    catch (error) { store.fail(link.id, error instanceof Error ? error.message : '取得できませんでした。'); }
    finally { active.delete(link.id); }
    res.json(store.get(link.id));
  });
  app.delete('/api/links/:id', (req, res) => { store.remove(req.params.id); res.status(204).end(); });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (error as { status?: number }).status;
    res.status(status === 413 ? 413 : 400).json({ error: '送信データを確認してください。' });
  });
  return app;
}
