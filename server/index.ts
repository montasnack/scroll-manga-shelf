import express from 'express';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore } from './store.js';
import { createApp } from './app.js';
try { process.loadEnvFile(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const dir = resolve(process.env.DATA_DIR || 'data');
mkdirSync(dir, { recursive: true });
const store = createStore(resolve(dir, 'shelf.sqlite'));
const app = createApp(store);
app.use(express.static(resolve('dist')));
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log(`Scroll Manga Shelf: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
