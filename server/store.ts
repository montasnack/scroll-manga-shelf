import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
export interface MangaLink {
  id: string; url: string; title: string; description: string; thumbnail: string | null;
  status: 'pending' | 'ready' | 'failed'; error: string | null; createdAt: string;
}
export function createStore(filename: string) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', thumbnail TEXT,
      status TEXT NOT NULL DEFAULT 'pending', error TEXT,
      createdAt TEXT NOT NULL
    );`);
  return {
    list: () => db.prepare('SELECT * FROM links ORDER BY createdAt DESC, rowid DESC').all() as unknown as MangaLink[],
    get: (id: string) => db.prepare('SELECT * FROM links WHERE id = ?').get(id) as unknown as MangaLink | undefined,
    add(url: string) {
      const id = randomUUID();
      const result = db.prepare('INSERT OR IGNORE INTO links (id,url,title,createdAt) VALUES (?,?,?,?)')
        .run(id, url, new URL(url).hostname, new Date().toISOString());
      return result.changes ? id : null;
    },
    update(id: string, metadata: { title: string; description: string; thumbnail: string | null }) {
      db.prepare("UPDATE links SET title=?, description=?, thumbnail=?, status='ready', error=NULL WHERE id=?")
        .run(metadata.title, metadata.description, metadata.thumbnail, id);
    },
    fail(id: string, error: string) { db.prepare("UPDATE links SET status='failed', error=? WHERE id=?").run(error, id); },
    remove(id: string) { return db.prepare('DELETE FROM links WHERE id=?').run(id).changes; },
    close() { db.close(); },
  };
}
