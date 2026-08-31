# デプロイ手順(Render + Cloudflare R2)

**本番稼働中**: https://tree-management-fullcode.onrender.com

Render無料枠(`ohio`リージョン。NeonがAWS us-east-2/Ohioのため、性能検証章の
指針通りリージョンを揃えた)+ Neon(既存) + Cloudflare R2(`tree-management-files`
バケット)で実際にデプロイし、ログイン・地図表示・R2への実ファイルアップロード/
ダウンロード/削除まで本番環境で動作確認済み。

## 実際の手順と、途中で見つかった問題

### 1. Cloudflare R2

R2バケット(`tree-management-files`)とS3互換トークン(Access Key ID / Secret
Access Key / Account ID)はCloudflareダッシュボードでのみ発行できる
(この部分だけはCLI/APIで代行不可)。発行後は`@aws-sdk/client-s3`で
PutObject/GetObject/DeleteObjectが問題なく通ることを確認済み。バケットは
非公開のままでよい(`fileRouter`のダウンロードは署名付きURLへのリダイレクトで
アクセスするため、パブリック公開は不要)。

### 2. Renderサービスの作成

Render REST API(`POST /v1/services`)で直接作成した(Blueprint機能はダッシュボード
操作前提のため、`render.yaml`の内容をAPIのリクエストボディに手動で変換して投入)。

**つまずいた点1: プライベートリポジトリの取得**

Renderに一度もGitHub連携していない状態でプライベートリポジトリを指定すると
`repository URL is invalid or unfetchable`で作成自体が失敗する。本来の対処は
Renderダッシュボード→Account Settings→GitHubでこのリポジトリへのアクセスを
許可することだが、これはOAuth操作のためAPI/CLIから代行できない。今回は
リポジトリを一時的に公開にしてデプロイし、デプロイ完了後にプライベートへ
戻した(コミット履歴に秘密情報が無いことを事前に確認した上で実施)。

**リポジトリをプライベートに戻した後の影響**: Renderは初回クローン時に
リポジトリへの認証済みアクセスを持っていない(公開だったため匿名クローンで
成功しただけ)。そのため、**プライベートに戻した状態でのgit pushによる
自動再デプロイは失敗する可能性が高い**。今後継続的に自動デプロイしたい場合は、
RenderダッシュボードでこのリポジトリへのGitHub連携を設定すること
(Account Settings → GitHub → Configure → 対象リポジトリを選択)。
連携済みであれば、以後は再度公開にする必要はない。

**つまずいた点2: `npm ci`がdevDependenciesを省略してビルド失敗**

`NODE_ENV=production`を環境変数に設定していると、`npm ci`が既定で
devDependencies(vite/typescript/@types/node等)を省略してしまい、
`Cannot find type definition file for 'vite/client'`でビルドが失敗した。
`render.yaml`のbuildCommandに`--include=dev`を明示することで解決済み
(このリポジトリの`render.yaml`は修正済み)。

### 3. 環境変数

Render API経由で以下を設定済み(実際に使った値は各自のRender/Cloudflare
ダッシュボードで確認・管理する):

| 変数名 | 値 |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neonのプール接続文字列(ホスト名に`-pooler`) |
| `DIRECT_DATABASE_URL` | Neonの直接接続文字列 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `generateValue: true`でRenderが自動生成 |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `https://<Cloudflare Account ID>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `tree-management-files` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 APIトークン |
| `S3_REGION` | `auto` |

### 4. 初回デプロイ後の確認(実施済み)

1. `buildCommand`内の`prisma migrate deploy`で全マイグレーションがNeonに適用された。
2. システム管理者アカウントはこのセッションでのローカル開発時に既に
   `npm run prisma:seed`済みだったため、本番でも同じNeon DBを参照する形で
   そのままログインできることを確認した(本番用に別DBを使う場合は改めて
   `npm run prisma:seed`が必要)。
3. `https://tree-management-fullcode.onrender.com/health` → `{"status":"ok"}` 確認済み。
4. ブラウザ操作(Playwright)でログイン→地図表示→樹木一覧→アカウント管理画面まで確認済み。
5. `/api/files`への実アップロード→ダウンロード(R2署名付きURLへの302リダイレクト
   →実体の取得まで)→削除の一連の流れを本番環境で確認済み。

## 運用上の注意

- **コールドスタート**: Render無料枠は15分無アクセスでスリープし、復帰に
  30〜60秒かかる。DB(Neon)・ファイルストレージ(R2)は別サービスのため
  影響を受けない。
- **バックアップ/リストア**: `api/scripts/backup.ts`/`restore.ts`は
  `DIRECT_DATABASE_URL`を使うため、ローカル環境から本番のNeon接続文字列を
  指定して実行する(README「バックアップ・リストア」章を参照)。
- **マイグレーション追加時**: 新しいマイグレーションをコミットしてpushし、
  Renderの自動デプロイ(GitHub連携が有効な場合)または手動デプロイ
  (`POST /v1/services/{id}/deploys`)をトリガーすれば、次回ビルドの
  `prisma migrate deploy`で自動適用される。
- **認証情報の取り扱い**: デプロイ作業中に発行したR2/Render APIキーは
  チャット上でやり取りされたため、作業完了後にローテーション(失効・再発行)
  することを推奨する。R2キーをローテーションする場合は、Render側の
  `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`環境変数も同時に更新しないと
  本番のファイルアップロード機能が壊れる点に注意。
