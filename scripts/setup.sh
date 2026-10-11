#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'const major=Number(process.versions.node.split(".")[0]); if(major!==24){console.error("Node.js 24 が必要です。Codex Cloud のランタイム設定で Node.js 24 を選択してください。");process.exit(1)}'
npm ci
npm run check
