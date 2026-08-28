import { Router } from "express";
import type { Entity } from "./auth/rbac.js";
import { requireAuth } from "./auth/middleware.js";
import { checkPermissionAndGetFilter } from "./auth/scope.js";
import { parsePagination, paginatedResponse } from "./pagination.js";
import { NotFoundError } from "./errors.js";
import { prisma } from "./db.js";

// Prismaの各モデルデリゲート(prisma.tree, prisma.diagnosis等)はモデルごとに
// 異なる引数の生成型を持つため、共通インターフェースにまとめる時点で
// 具体的な型情報は失われる。ここは意図的にanyを許容し、実引数の妥当性は
// Prisma自体のランタイムバリデーションに委ねる設計にしている。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaDelegate = {
  findMany: (args: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
};

type CrudRouterConfig = {
  entity: Entity;
  delegate: PrismaDelegate;
  orderBy: Record<string, "asc" | "desc">;
  // treeIdでの絞り込みを許可するか(diagnosis/inspection/workHistory等)
  treeIdFilter?: boolean;
  softDelete?: boolean; // 既定true。replant等も含め全ドメインテーブルがdeletedAtを持つ
  // 作成時に標準のdelegate.create(...)ではなく、この関数を使う。
  // 「植替え登録で旧樹木のステータスを自動更新する」のような、
  // 他テーブルへの副作用を伴う業務ロジック(Dataverse版でのPower Automate相当)を
  // トランザクション付きで差し込むための拡張点。
  onCreate?: (data: unknown) => Promise<unknown>;
};

/**
 * 標準的なCRUD(一覧+ページング/取得/作成/更新/論理削除)を持つRouterを
 * 生成する。7エンティティで同じパターンを手書きすると差分バグが出やすいため、
 * ここに集約している。特殊なエンドポイント(地図bbox、位置修正専用PATCH等)は
 * 個別のルートファイル側で追加する。
 */
export function createCrudRouter(config: CrudRouterConfig): Router {
  const { entity, delegate, orderBy, treeIdFilter = false, softDelete = true, onCreate } = config;
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    const filter = await checkPermissionAndGetFilter(entity, "read", req.user!);
    const { skip, take, page, pageSize } = parsePagination(req);
    const treeId = treeIdFilter ? (req.query.treeId as string | undefined) : undefined;

    const where = {
      ...(softDelete ? { deletedAt: null } : {}),
      ...filter,
      ...(treeId ? { treeId } : {}),
    };

    const [data, total] = await Promise.all([
      delegate.findMany({ where, skip, take, orderBy }),
      delegate.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  });

  router.get("/:id", async (req, res) => {
    const filter = await checkPermissionAndGetFilter(entity, "read", req.user!);
    const where = { id: req.params.id, ...(softDelete ? { deletedAt: null } : {}), ...filter };
    const record = await delegate.findFirst({ where });
    if (!record) throw new NotFoundError();
    res.json(record);
  });

  router.post("/", async (req, res) => {
    await checkPermissionAndGetFilter(entity, "create", req.user!);
    const record = onCreate ? await onCreate(req.body) : await delegate.create({ data: req.body });
    res.status(201).json(record);
  });

  router.patch("/:id", async (req, res) => {
    const filter = await checkPermissionAndGetFilter(entity, "update", req.user!);
    const where = { id: req.params.id, ...(softDelete ? { deletedAt: null } : {}), ...filter };
    const existing = await delegate.findFirst({ where });
    if (!existing) throw new NotFoundError();
    const record = await delegate.update({ where: { id: req.params.id }, data: req.body });
    res.json(record);
  });

  router.delete("/:id", async (req, res) => {
    const filter = await checkPermissionAndGetFilter(entity, "delete", req.user!);
    const where = { id: req.params.id, ...(softDelete ? { deletedAt: null } : {}), ...filter };
    const existing = await delegate.findFirst({ where });
    if (!existing) throw new NotFoundError();
    if (softDelete) {
      await delegate.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    }
    res.status(204).send();
  });

  return router;
}

export { prisma };
