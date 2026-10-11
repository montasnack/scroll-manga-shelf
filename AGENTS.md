# Scroll Manga Shelf — Codex 作業ガイド

## Goal
スクロール漫画の作品URLを集め、公開ページのサムネイルで探しやすくする個人用の本棚。UIとユーザー向け説明は日本語。

## Setup and verification
- Node.js 24 / npm。初回: `bash scripts/setup.sh`。
- 開発: `npm run dev` (UI 5173 / API 3001)。
- 必須確認: `npm run check`。テストは外部ネットワーク不要。
- ビルド済みUI: `npm run build && npm start` (127.0.0.1:3001)。
- `package-lock.json` を必ず更新・コミットする。

## Structure
- `src/`: React の画面。`server/`: Express API、SQLite、メタデータ抽出。
- `tests/`: URL検証・メタデータ・保存とAPIの振る舞い。
- `docs/codex-cloud.md`: クラウド環境の設定。

## Constraints
- 公開ページのOGP/Twitterメタデータのみ取得。作品本文・有料ページを収集しない。
- 自動取得は `METADATA_ALLOWED_HOSTS` の完全一致ホストのみ。各リダイレクトにも検証を適用。
- 対象ホストを追加するときは運営元と利用条件を確認し、`.env.example` とドキュメントを更新。
- レート制限、タイムアウト、サイズ上限を維持。ログインや取得拒否を回避しない。
- 画像URLを参照する方式。画像を保存・再配布する変更は別途設計する。
- `data/`, `.env`, 秘密情報をコミットしない。既存の保存データを消さない。
- 現状は認証なしの個人開発用。インターネット公開する際は認証・利用者ごとのデータ分離を先に実装。
- サイトの外部ページ取得はプロキシ環境変数とCA設定を尊重する。
