import express from "express";
import path from "node:path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth/routes.js";
import { treeRouter } from "./routes/tree.js";
import { diagnosisRouter } from "./routes/diagnosis.js";
import { inspectionRouter } from "./routes/inspection.js";
import { workHistoryRouter } from "./routes/workHistory.js";
import { vendorRouter } from "./routes/vendor.js";
import { replantRouter } from "./routes/replant.js";
import { complaintRouter } from "./routes/complaint.js";
import { fileRouter } from "./routes/file.js";
import { areaRouter } from "./routes/area.js";
import { userRouter } from "./routes/user.js";
import { auditLogRouter } from "./routes/auditLog.js";
import { rolePermissionsRouter } from "./routes/rolePermissions.js";
import { ForbiddenError } from "./auth/scope.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { prisma } from "./db.js";
import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";

// TypeScriptの出力先はCommonJSのため、ESM専用のimport.metaではなく
// Node.jsが標準で提供する__dirnameをそのまま使う。
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
  // diagnosisDate/workDate/replantDate等の@db.Date列は、JSONで届く"YYYY-MM-DD"の
  // ままだとPrismaの厳密なISO-8601DateTimeバリデーションに弾かれる
  // ("premature end of input")。JSONにはDate型が無いため、パース時点で
  // 日付らしき文字列をDateオブジェクトへ変換しておく(7エンティティ共通の問題のため、
  // 各ルートで個別対応せずここ1箇所に集約する)。
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
  app.use(
    express.json({
      reviver: (_key, value) =>
        typeof value === "string" && ISO_DATE_RE.test(value) ? new Date(value) : value,
    })
  );
  app.use(cookieParser());
  // express.json()はContent-Type: application/jsonが無いリクエスト(例: ボディなしの
  // POST)ではreq.bodyを一切設定せずundefinedのままにする。各ルートが
  // `const { x } = req.body as {...}` のように分割代入している箇所が軒並み
  // クラッシュするため、ここでundefinedのときだけ空オブジェクトを補う。
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

  app.get("/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/trees", treeRouter);
  app.use("/api/diagnoses", diagnosisRouter);
  app.use("/api/inspections", inspectionRouter);
  app.use("/api/work-histories", workHistoryRouter);
  app.use("/api/vendors", vendorRouter);
  app.use("/api/replants", replantRouter);
  app.use("/api/complaints", complaintRouter);
  app.use("/api/files", fileRouter);
  app.use("/api/areas", areaRouter);
  app.use("/api/users", userRouter);
  app.use("/api/audit-logs", auditLogRouter);
  app.use("/api/role-permissions", rolePermissionsRouter);

  if (isProd) {
    app.use(express.static(WEB_DIST_DIR));
    // SPAのクライアントサイドルーティング用: /api/* 以外はindex.htmlを返す。
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(WEB_DIST_DIR, "index.html"));
    });
  }

  // Express 5はasyncハンドラ内でthrowされたエラーを自動でここに転送する。
  // ルート側でtry/catchを書かずに済むようにする共通ハンドラ。
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ForbiddenError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE" ? "ファイルサイズが上限を超えています。" : "ファイルアップロードに失敗しました。";
      res.status(400).json({ error: message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "サーバーエラーが発生しました。" });
  });

  return app;
}
