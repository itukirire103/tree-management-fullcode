import { execFileSync } from "node:child_process";
import "dotenv/config";

// 使い方: npx tsx scripts/restore.ts <dumpファイルパス> <復元先接続文字列>
// 復元先は本番/開発DBを直接上書きしないよう、必ず引数で明示的に指定させる
// (DIRECT_DATABASE_URLへの暗黙フォールバックはしない)。
const [dumpFile, targetUrl] = process.argv.slice(2);
if (!dumpFile || !targetUrl) {
  console.error("使い方: npx tsx scripts/restore.ts <dumpファイルパス> <復元先接続文字列>");
  process.exit(1);
}

const PG_RESTORE = process.env.PG_RESTORE_PATH ?? "pg_restore";

console.log(`pg_restoreを実行: ${dumpFile} -> ${targetUrl.replace(/:[^:@]+@/, ":****@")}`);
execFileSync(PG_RESTORE, ["--clean", "--if-exists", "--no-owner", "--no-privileges", "-d", targetUrl, dumpFile], {
  stdio: "inherit",
});
console.log("リストア完了。");
