import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth/routes.js";
import { prisma } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 本番ビルド後、React SPA(web/dist)の成果物をここに配置する想定
// (deploy時にコピー、またはNODE_ENVに応じてパスを調整)。
const WEB_DIST_DIR = path.resolve(__dirname, "../../web/dist");

export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === "production";

  // 本番はAPIとフロントエンドを同一オリジンで配信する(別ドメインだと
  // リフレッシュトークンCookieのSameSite=Strictがクロスオリジンリクエストで
  // 送信されなくなり、本番環境でだけ認証が壊れるため)。
  // 開発時はVite dev server(別ポート)からのアクセスを許可する。
  if (!isProd) {
    app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
  }
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);

  if (isProd) {
    app.use(express.static(WEB_DIST_DIR));
    // SPAのクライアントサイドルーティング用: /api/* 以外はindex.htmlを返す。
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(WEB_DIST_DIR, "index.html"));
    });
  }

  return app;
}
