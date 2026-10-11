import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MangaLink } from '../server/store';
import './style.css';

const starters = [
  { name: 'LINEマンガ', url: 'https://manga.line.me/', note: '作品を探す' },
  { name: 'ピッコマ', url: 'https://piccoma.com/web/', note: 'SMARTOONを探す' },
  { name: 'comico', url: 'https://www.comico.jp/', note: '作品を探す' },
  { name: 'WEBTOON', url: 'https://www.webtoons.com/en/', note: '海外作品を探す' },
];
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '接続できませんでした。');
  return result;
}
function Cover({ link }: { link: MangaLink }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [link.thumbnail]);
  return <div className="cover">
    {link.thumbnail && !broken ? <img src={link.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <div className="cover-fallback"><span>SCROLL<br/>MANGA</span><small>{new URL(link.url).hostname}</small></div>}
    <span className="cover-label">{link.thumbnail && !broken ? 'BOOKMARK' : 'LINK'}</span>
  </div>;
}
function App() {
  const [links, setLinks] = useState<MangaLink[]>([]);
  const [urls, setUrls] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const reload = async () => setLinks(await api<MangaLink[]>('/links'));
  useEffect(() => { reload().catch(e => setError(e.message)); }, []);
  const visible = useMemo(() => links.filter(link =>
    (filter === 'all' || (filter === 'images' ? Boolean(link.thumbnail) : link.status !== 'ready')) &&
    `${link.title} ${link.description} ${link.url}`.toLowerCase().includes(query.toLowerCase())), [links, query, filter]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : '処理に失敗しました。'); }
    finally { setBusy(false); }
  }
  async function refresh(ids: string[]) {
    let failed = 0;
    for (const id of ids) {
      const result = await api<MangaLink>(`/links/${id}/refresh`, 'POST', {});
      if (result.status === 'failed') failed++;
      await reload();
    }
    return failed;
  }
  function exportLinks() {
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'manga-links.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <header className="topbar"><a className="brand" href="/" aria-label="スクロール本棚 ホーム"><span className="brand-mark">▥</span>スクロール本棚</a><span className="edition">YOUR PERSONAL MANGA INDEX</span><span className="private-label">自分だけの本棚</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow">SAVE A LINK. FIND YOUR NEXT STORY.</p><h1>気になる漫画を、<br/><em>ひとつの本棚に。</em></h1><p className="lead">サイトをまたいで、読みたい作品をストック。<br/>表紙を眺めて、次の物語を見つけよう。</p></div><div className="intro-number"><strong>{String(links.length).padStart(2, '0')}</strong><span>保存したリンク</span></div></section>
      <section className="add-panel" aria-labelledby="add-heading"><div><span className="eyebrow">ADD TO YOUR SHELF</span><h2 id="add-heading">リンクを本棚に追加</h2><p>作品ページのURLを貼り付け。複数あるときは1行に1件ずつ。</p></div><form onSubmit={e => { e.preventDefault(); void run(async () => {
        const result = await api<{ ids: string[]; added: number; skipped: number }>('/links', 'POST', { urls: urls.split(/\r?\n/).map(x => x.trim()).filter(Boolean) });
        setUrls(''); await reload();
        const failed = await refresh(result.ids);
        setNotice(`${result.added}件を追加しました。${result.skipped ? ` 重複${result.skipped}件はスキップ。` : ''}${failed ? ` ${failed}件は画像を取得できなかったためリンクとして保存しました。` : ''}`);
      }); }}><label className="sr-only" htmlFor="urls">登録するURL</label><textarea id="urls" value={urls} onChange={e => setUrls(e.target.value)} placeholder={'https://manga.line.me/…\nhttps://piccoma.com/web/…'} rows={2} required disabled={busy}/><button className="primary" disabled={busy || !urls.trim()}>{busy ? '処理中…' : '＋ 本棚に追加'}</button></form></section>
      {error && <p className="message error" role="alert">{error}</p>}{notice && <p className="message" role="status">{notice}</p>}
      <section className="library" aria-labelledby="library-heading"><div className="section-title"><div><p className="eyebrow">MY COLLECTION</p><h2 id="library-heading">あなたの本棚 <span>{links.length}</span></h2></div><button className="text-button" onClick={exportLinks} disabled={!links.length}>JSONを書き出す ↗</button></div>
        <div className="toolbar"><div className="tabs" aria-label="表示対象">{[['all', 'すべて'], ['images', '画像あり'], ['pending', '未取得・要再試行']].map(([key, label]) => <button key={key} aria-pressed={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div><label className="search"><span aria-hidden="true">⌕</span><input aria-label="本棚を検索" placeholder="タイトル・サイトで検索" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
        {visible.length ? <div className="grid">{visible.map(link => <article className="card" key={link.id}><a href={link.url} target="_blank" rel="noopener noreferrer"><Cover link={link}/><p className="site-name">{new URL(link.url).hostname} ↗</p><h3>{link.title}</h3></a><p className="description">{link.description || '気になる物語は、元のサイトで。'}</p>{link.error && <p className="fetch-error">{link.error}</p>}<div className="card-actions"><button disabled={busy} onClick={() => void run(async () => { await refresh([link.id]); setNotice('取得結果を更新しました。'); })}>画像を再取得</button><button disabled={busy} onClick={() => { if (window.confirm('このリンクを本棚から削除しますか？')) void run(async () => { await api(`/links/${link.id}`, 'DELETE', {}); await reload(); }); }}>削除</button></div></article>)}</div> : <div className="empty"><span className="empty-icon">▤</span><h3>{links.length ? '該当するリンクがありません' : '最初の物語を、本棚に。'}</h3><p>{links.length ? '検索ワードや表示対象を変えてみてください。' : '上の入力欄に作品ページのURLを貼り付けると、ここに並びます。'}</p></div>}
      </section>
      <section className="discovery"><div><p className="eyebrow">DISCOVER</p><h2>新しい物語を探す</h2><p>公式サイトで作品を見つけて、リンクを持ち帰ろう。</p></div><div className="source-list">{starters.map(site => <a href={site.url} key={site.name} target="_blank" rel="noopener noreferrer"><div><strong>{site.name}</strong><small>{site.note}</small></div><span>↗</span></a>)}</div></section>
      <footer><span>SCROLL MANGA SHELF</span><p>サムネイルは公開ページの情報から取得します。作品はリンク先の公式サイトでお楽しみください。</p></footer>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
