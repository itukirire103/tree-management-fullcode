import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7からdatasource urlはCLI(migrate等)の接続情報として
// ここで定義する。ランタイムのPrismaClientは別途ドライバアダプタ
// (src/db.ts の @prisma/adapter-pg)経由で接続する。
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
