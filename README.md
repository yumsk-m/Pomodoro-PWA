# White Loop

Astro + React + Web Audio API で作った、ホワイトノイズ対応のポモドーロタイマーです。

## 実装済み機能

- ホワイトノイズ時間（分）指定
- 無音時間（分）指定
- 繰り返し回数指定
- 開始 / 一時停止 / リセット
- 音量調整
- localStorage による設定保存
- スマホ/PC レスポンシブ対応
- Cloudflare Workers デプロイ構成

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## 本番デプロイ設定

SEO 用の canonical URL、sitemap URL を本番ドメインにするため、Cloudflare のビルド環境変数 `SITE_URL` に本番 URL（例: `https://example.com`）を設定してください。
