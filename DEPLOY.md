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
許可することだが、これはOAuth操作のためAPI/CLIから代行できない。

このリポジトリでは、GitHub連携(OAuth)を設定する代わりに**リポジトリを
恒久的に公開にする**運用にした。理由は、(1) コミット履歴に秘密情報が
無いことを事前に確認済み、(2) `.env`はgit管理外のため本番のDB接続情報や
APIキーが公開されることはない、(3) 公開/非公開は「誰が閲覧できるか」の
設定であり「誰が書き込めるか(push権限)」とは別で、招待していない第三者が
リポジトリを書き換えることはできない、(4) ポートフォリオとしてはむしろ
ソースが読める方が都合が良い、という判断による。これにより、Renderは
匿名クローンでリポジトリに到達できるようになった。

**注意: これだけでは`git push`時の自動デプロイは動かない。** GitHub側の
Webhook(`gh api repos/{owner}/{repo}/hooks`で確認可能)がRender側に
登録されていないため、公開/非公開に関わらずpushをRenderが検知する
仕組みが無い。このサービスはRender REST APIで直接作成した(Blueprint/
ダッシュボード経由のGitHub連携フローを通していない)ため、Webhookが
自動登録されなかった。現状は、コードを変更するたびに
`POST /v1/services/{id}/deploys`を手動で呼んでデプロイをトリガーする
運用にしている。真の自動デプロイ(push→即デプロイ)がほしい場合は、
RenderダッシュボードでこのリポジトリへのGitHub連携を設定すること
(Account Settings → GitHub → Configure)。連携するとRenderがWebhookを
自動登録し、以後は本項で説明した「一時的に公開にする」対応も不要になる
(認証済みアクセスでプライベートリポジトリを直接クローンできるため)。

(一時的に非公開へ戻す運用にした場合は、Renderが認証済みアクセスを
持たなくなるため自動デプロイが失敗するようになる。その場合は上記の
GitHub連携を別途設定すること。)

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
- **マイグレーション追加時**: 新しいマイグレーションをコミットしてpushした後、
  上記の通り自動デプロイのWebhookが無いため`POST /v1/services/{id}/deploys`を
  手動で呼んでデプロイをトリガーする。デプロイが走れば、次回ビルドの
  `prisma migrate deploy`で自動適用される。
- **認証情報の取り扱い**: デプロイ作業中に発行したR2/Render APIキーは
  チャット上でやり取りされたため、作業完了後にローテーション(失効・再発行)
  することを推奨する。R2キーをローテーションする場合は、Render側の
  `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`環境変数も同時に更新しないと
  本番のファイルアップロード機能が壊れる点に注意。
