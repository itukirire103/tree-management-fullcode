import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import "dotenv/config";

// pg_dumpはNeonのプール接続(-pooler)を経由すると長時間接続で問題が起きうるため、
// マイグレーション同様に直接接続(DIRECT_DATABASE_URL)を使う。
// カスタム形式(-Fc)で出力し、pg_restoreでの選択的リストア・並列リストアを可能にする。
const DIRECT_URL = process.env.DIRECT_DATABASE_URL;
if (!DIRECT_URL) {
  console.error("DIRECT_DATABASE_URLが設定されていません。");
  process.exit(1);
}

const PG_DUMP = process.env.PG_DUMP_PATH ?? "pg_dump";
const outDir = process.argv[2] ?? path.resolve(process.cwd(), "backups");
fs.mkdirSync(outDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(outDir, `tree-management-${timestamp}.dump`);

console.log(`pg_dumpを実行: ${outFile}`);
execFileSync(PG_DUMP, ["-Fc", "-f", outFile, DIRECT_URL], { stdio: "inherit" });
console.log("バックアップ完了。");
