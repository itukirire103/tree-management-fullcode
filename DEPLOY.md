# デプロイ手順(Render + Cloudflare R2)

このドキュメントは Phase 5(本番デプロイ)の手順書。実際のデプロイ実行には
Render/Cloudflareのアカウントと認証情報が必要なため、このリポジトリのコード
からは実行できない。ここでは手順と設定内容を記録し、実施は各自のアカウントで
行う想定。

## 前提

- [Neon](https://neon.tech) プロジェクト(既にセットアップ済み。`DATABASE_URL`/`DIRECT_DATABASE_URL`)
- [Cloudflare](https://dash.cloudflare.com) アカウント(R2用)
- [Render](https://render.com) アカウント
- 本リポジトリがGitHubにpush済みで、Renderからアクセスできるリポジトリであること

## 1. Cloudflare R2バケットの作成

1. Cloudflareダッシュボード → R2 → 「バケットを作成」で新規バケットを作成(例: `tree-management-files`)
2. 「R2 API トークンを管理」→「APIトークンを作成」で、対象バケットへの
   読み書き権限を持つトークンを発行する。発行時に以下が得られる:
   - `Access Key ID`
   - `Secret Access Key`
   - `Account ID`(エンドポイントURLの組み立てに使用: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
3. バケットはデフォルトで非公開のままでよい(`fileRouter`のダウンロードは
   署名付きURL/直接ストリーミングでアクセスするため、パブリック公開は不要)。

## 2. Renderサービスの作成

このリポジトリ直下の [`render.yaml`](render.yaml) をBlueprintとして使う。

1. Renderダッシュボード → 「New +」→「Blueprint」
2. このGitHubリポジトリを選択すると `render.yaml` が自動検出される
3. `sync: false` になっている環境変数は自動生成されないため、デプロイ前後に
   Renderダッシュボードの Environment 画面で手動設定する:

   | 変数名 | 値 |
   |---|---|
   | `DATABASE_URL` | Neonのプール接続文字列(ホスト名に`-pooler`) |
   | `DIRECT_DATABASE_URL` | Neonの直接接続文字列 |
   | `S3_ENDPOINT` | `https://<Cloudflare Account ID>.r2.cloudflarestorage.com` |
   | `S3_BUCKET` | 作成したR2バケット名 |
   | `S3_ACCESS_KEY_ID` | R2 APIトークンのAccess Key ID |
   | `S3_SECRET_ACCESS_KEY` | R2 APIトークンのSecret Access Key |

   `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` は `generateValue: true` により
   Renderが自動生成する(手動設定不要)。

4. リージョンはNeonのリージョン(既定 `us-east-2` 相当)になるべく近いものを
   選ぶと、性能検証(README「性能検証」章)で確認した通りネットワーク往復
   時間を短縮できる。`render.yaml`は`oregon`を既定にしているが、Neon側の
   実リージョンに合わせて変更すること。

## 3. 初回デプロイ後の確認

1. `buildCommand`内で `prisma migrate deploy` が実行されるため、初回デプロイ
   で全マイグレーションがNeonに適用される。
2. デプロイ完了後、Renderのシェル機能(またはローカルから`DATABASE_URL`を
   本番向けに向けて)で以下を一度だけ実行し、システム管理者アカウントを作成する:
   ```bash
   cd api
   npm run prisma:seed
   ```
3. `https://<サービス名>.onrender.com/health` が `{"status":"ok"}` を返すことを確認する。
4. ブラウザでSPAを開き、ログイン→樹木一覧→地図表示→ファイルアップロード
   (診断カルテPDF等、R2への実接続確認を兼ねる)まで一通り動作確認する。

## 4. 運用上の注意

- **コールドスタート**: Render無料枠は15分無アクセスでスリープし、復帰に
  30〜60秒かかる。DB(Neon)・ファイルストレージ(R2)は別サービスのため
  影響を受けない(README記載の通り)。
- **バックアップ/リストア**: `api/scripts/backup.ts`/`restore.ts`は
  `DIRECT_DATABASE_URL`を使うため、ローカル環境から本番のNeon接続文字列を
  指定して実行する(README「バックアップ・リストア」章を参照)。
- **マイグレーション追加時**: 新しいマイグレーションをコミットしてpushすれば、
  次回デプロイの`buildCommand`(`prisma migrate deploy`)で自動適用される。
