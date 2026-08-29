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
- [x] Phase 1: 全ドメインスキーマ(7テーブル+認証/RBAC/監査/ファイル)をNeonへマイグレーション済み。JWT認証(ログイン/リフレッシュ/ログアウト/me)・RBAC権限マトリクス・エリア割当てAPI・監査ログ(Prisma拡張)・ファイルストレージ(ローカル/R2切り替え式)まで動作確認済み
- [x] Phase 2: 7エンティティのCRUD API + フロントエンドCRUD画面(FieldConfig駆動の汎用一覧/フォーム)、認証画面、樹木起点のサブグリッドUI(TreeDetailPage)、エリア割当て管理画面
- [x] Phase 3: 地図機能(Leaflet)。bboxスコープAPI+クラスタリング、健全度による色分け、ホバー表示、クリックで詳細、ドラッグで位置修正、空き地クリックで新規登録。Playwrightでの実ブラウザ動作確認済み
- [x] Phase 4: MFA(TOTP)・監査ログ閲覧UI・バックアップ/リストア実証・5,200件規模でのページング/性能検証・負荷テストまで完了
- [ ] Phase 5: デプロイ(Render)・Cloudflare R2への実接続・ドキュメント整備

## 仕様書要件との突き合わせで見つかった主な乖離と対応

Power Platform版の要件定義書(公募資料ベース)とコードベースを突き合わせた結果、下記を修正済み。

- [x] 入力バリデーション未実装(`req.body`を無検証でPrismaに渡していた)→ zodで7エンティティ分のcreate/updateスキーマを追加
- [x] 苦情・陳情記録の樹木ID: 要件は任意(樹木未特定の陳情もあるため)だが実装は必須になっていた → NULL許容に修正
- [x] 街路樹管理委託事業者の作業履歴アクセス範囲: 要件は「自社実施分のみ」だが担当エリア内の他社分まで見えていた → `vendorId`での絞り込みを追加
- [x] 樹木診断結果の「被害部写真」・点検記録の「点検写真」(要件定義書上は複数枚添付項目)が未実装 → 添付テーブルとアップロードUIを追加
- [x] 診断カルテ(PDF)のアップロードUIがフロントに未接続(バックエンドAPIのみ存在) → フォームに添付欄を追加

---

## バックアップ・リストア

`api/scripts/backup.ts`(pg_dumpのラッパー)でカスタム形式(`-Fc`)のダンプを取得し、
`api/scripts/restore.ts`(pg_restoreのラッパー)で復元する。マイグレーション同様、
プール接続ではなく直接接続(`DIRECT_DATABASE_URL`)を使う。

```bash
cd api
npm run backup                 # ./backups/tree-management-<timestamp>.dump を生成
npm run restore -- <dumpファイル> <復元先接続文字列>
```

`npm run restore`の復元先は暗黙のフォールバックを持たせず、必ず引数で明示させる設計にした
(本番/開発DBを誤って上書きする事故を防ぐため)。

**実際にリストアまで検証済み**: Neon上に空のブランチ(`restore-test`)を作成し、
スキーマを完全に削除した状態から`npm run backup`で取得したダンプを`npm run restore`で
復元、ユーザー数・リフレッシュトークン数などの行数が復元前と一致することを確認した後、
ブランチを削除して片付けた。「バックアップは取っているが復元したことがない」状態を避けるため。

---

## 性能検証(5,200件規模)・負荷テスト

港区の公募資料記載の管理本数(約5,200本)相当のダミーデータを`npm run seed:scale`で投入し、
実規模での検証を行った。

**ページングの正確性**: pageSize=100で全52ページを走査し、5,200件すべてが重複・欠落なく
1回ずつ取得できることを確認した(Dataverse版で実際に発生した「ページングが初回ロードに
間に合わず一部しか表示されない」バグの再発防止確認)。

**性能の内訳**: HTTPレスポンスとしては1リクエストあたり概ね560〜900ms程度だったが、
`EXPLAIN ANALYZE`で実際のPostgres側実行時間を計測したところ、一覧取得は0.1ms、
地図の絞り込み(ズームインした現実的な範囲、全体の約3%)は0.4ms、全域表示相当の
広い範囲でも1.9ms(この場合はインデックスではなくSeq Scanが選ばれるが、選択率が
ほぼ100%のため妥当なプランナー判断)だった。つまり**観測された遅延の大半はNeon
(us-east-2)への地理的なネットワーク往復時間であり、アプリケーション/DB側のクエリが
遅いわけではない**。本番デプロイ時はRenderのリージョンをNeonと近い場所に揃えることで
体感速度を改善できる。

**負荷テスト**: 元のDataverse版で実績のあったPython `concurrent.futures`方式を踏襲する
想定だったが、開発機のPython実行環境が不安定だったため、Node.jsのネイティブ並行fetchで
同等の検証(`api/scripts/load-test.ts`、`npm run load-test`)に置き換えた。同時ユーザー数20
×1ユーザーあたり10反復(一覧取得・地図bboxクエリ・作成・削除の混在ワークロード、
合計800リクエスト)で**エラー率0%**を確認済み。

```bash
cd api
npm run seed:scale     # 約5,200件のダミー樹木データを投入
npm run load-test      # 同時アクセスを模した負荷テスト
```

---

本プロジェクトは東京都港区が公表した公募資料を参考にした個人の学習・ポートフォリオ目的の制作物であり、港区への正式な提案書・提出物ではありません。
