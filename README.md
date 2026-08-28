# 樹木管理システム(フルコーディング版)

> 東京都港区の公募資料をベースにした樹木管理システムのポートフォリオ — フルコーディング版

[`../樹木管理システム`](../樹木管理システム)(Power Platform/Dataverse版)と同じ要件定義・ドメインモデルを、フルコーディング(Node.js + React + PostgreSQL)で再実装したもの。

## なぜフルコーディングで作り直したか

Power Platform版の開発では、バックエンド(テーブル・セキュリティロール・Power Automate)は順調に進んだが、地図機能のPCF(PowerApps Component Framework)カスタムコントロールで繰り返し深刻な摩擦が発生した。JSバンドルのキャッシュ挙動が予測不能、`notifyOutputChanged`の再描画契約が信頼できない、メタデータAPIの一部操作が原因不明の400/405を返すなど、「プラットフォームのブラックボックス」と「カスタムコード」の両方の複雑さを同時に抱える状態になっていた。デバッグとデプロイを完全に自分でコントロールできる環境で、設計からやり直すことにした。

詳しい経緯は[`../樹木管理システム/map/README.md`](../樹木管理システム/map/README.md)を参照。

## 技術スタック

- バックエンド: Node.js + TypeScript + Express + Prisma **6.19.3(意図的に固定)**
- フロントエンド: React + Vite + TypeScript + react-leaflet + TanStack Query
- DB: PostgreSQL(開発・本番ともに [Neon](https://neon.tech) の無料枠を使用。プール接続と直接接続を用途で使い分け)
- 地図: Leaflet + Leaflet.markercluster
- 認証: 自前JWT(アクセストークン + ローテーション式リフレッシュトークン)
- デプロイ先(予定): Render無料枠

設計の詳細は開発時に作成した計画ドキュメントを参照(技術選定の理由・フェーズ構成・非機能要件の対応方針など)。

### 技術選定にあたっての調査メモ

- **Prisma 7ではなく6.19.3を採用**: `npm install`時点でのlatestはPrisma 7だったが、調査の結果「過去最多クラスの破壊的変更」「pgドライバの接続タイムアウトが既定で無期限」等、まだ枯れていないことが分かった。実績のある6系に明示的に固定した(`--save-exact`)。Power Platform版でPCFビルドツールの未成熟さに苦しんだ反省を踏まえた判断。
- **Neonの接続文字列はプール接続(`DATABASE_URL`)と直接接続(`DIRECT_DATABASE_URL`)を分離**: 常駐サーバーからのアプリケーションクエリはプール接続、`prisma migrate`等のマイグレーションは直接接続、という公式推奨構成。
- **Render無料枠のコールドスタート(15分無アクセスでスリープ、復帰に30〜60秒)は許容し、デプロイ後にREADMEで明記する方針**とした。DB(Neon)・ファイルストレージ(Cloudflare R2)は別サービスのため影響を受けない。

## セットアップ

```bash
# 1. api/.env を用意(DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRETを設定)
cp .env.example .env
cp .env api/.env

# 2. バックエンド
cd api
npm install
npm run prisma:migrate   # 初回のみ。以後は prisma:generate だけでOK
npm run prisma:seed      # システム管理者アカウントを作成
npm run dev               # http://localhost:3001

# 3. フロントエンド(別ターミナル)
cd web
npm install
npm run dev               # http://localhost:5173
```

## 現在の進捗

- [x] Phase 0: プロジェクトスキャフォールド(api/web、TypeScript、Prisma初期化)
- [x] Phase 1(一部): 全ドメインスキーマ(7テーブル+認証/RBAC/監査/ファイル)をNeonへマイグレーション済み。JWT認証(ログイン/リフレッシュ/ログアウト)・RBAC権限マトリクス設定・認証ミドルウェアまで動作確認済み
- [ ] Phase 1(残り): 各エンティティのCRUD API、エリア割当てAPI
- [ ] Phase 2: フロントエンドのCRUD画面
- [ ] Phase 3: 地図機能(Leaflet)
- [ ] Phase 4: 非機能要件(MFA、監査ログUI、バックアップ実証、負荷テスト)
- [ ] Phase 5: デプロイ(Render)・ドキュメント整備

---

本プロジェクトは東京都港区が公表した公募資料を参考にした個人の学習・ポートフォリオ目的の制作物であり、港区への正式な提案書・提出物ではありません。
