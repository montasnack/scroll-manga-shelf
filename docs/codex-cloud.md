# Codex Cloud での開発

このファイルとスクリプトはクラウド開発の準備用です。GitHubリポジトリの作成・Codex Cloud画面での環境登録を自動実行する設定ファイルではありません。

1. https://chatgpt.com/codex を開き、GitHub接続で `montasnack/scroll-manga-shelf` にアクセスを許可します。
2. 環境設定で新規環境を作成し、このリポジトリと `main` ブランチを選択します。
3. Node.js **24** を選択します。別バージョンしかない場合は、環境に用意されたバージョンマネージャーで `.nvmrc` のバージョンをインストールしてください。
4. セットアップスクリプトに `bash scripts/setup.sh` を設定します。
5. メンテナンススクリプトを設定できる場合は `bash scripts/maintenance.sh` を指定します。
6. 環境テストで `npm run check` が成功することを確認し、保存します。

## ネットワーク

- 依存関係インストールには npm レジストリ (`registry.npmjs.org`) へのアクセスが必要です。
- ユニットテスト・型チェック・ビルドは依存導入後、ネットワーク不要です。
- 実サイトの取得を検証するときだけエージェントのネットワークを有効にし、必要な対象ドメインを許可してください。既定対象: `manga.line.me`, `piccoma.com`, `www.comico.jp`, `www.webtoons.com`。
- 画像はブラウザが配信元CDNから読みます。画像が出ない場合は画像URLのドメインと配信元の制約を確認してください。
- アプリ側の `METADATA_ALLOWED_HOSTS` と、クラウド側の通信許可は別の設定です。
- 初期開発にAPIキー・シークレット・外部データベースは不要です。

## 最初のタスク例

> AGENTS.md を読んで npm run check を実行してください。次に作品リンクのタグ付けとサイト別フィルターを実装し、必要なテストを追加してください。

## 起動とデータ

`npm run dev` でUIは5173番、APIは3001番。アプリの初期データは空です。公式サイトへの探索リンクは画面にあります。
SQLiteは `data/shelf.sqlite` に作られます。クラウド作業環境の破棄・再作成をまたぐ永続性は保証されないため、実際の本棚はJSON書き出しで保管してください。JSON再インポートは未実装です。URLを抽出して一括登録できます。

この環境には利用者認証がありません。個人開発用途に留め、共有公開時は認証とデータ分離を追加してください。

## GitHubから取得して開発

公開リポジトリ: https://github.com/montasnack/scroll-manga-shelf

```bash
git clone https://github.com/montasnack/scroll-manga-shelf.git
cd scroll-manga-shelf
bash scripts/setup.sh
npm run dev
```

GitHub接続が選択リポジトリのみを許可する設定なら、このリポジトリも接続対象に追加してください。コードの公開はアプリのホスティングとは別です。
