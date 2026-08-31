import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { parseOrThrow } from "../validation/parse.js";
import { areaCreateSchema, areaUpdateSchema } from "../validation/schemas.js";

// エリア割当て(Dataverse版のBusiness Unit階層に相当)の管理エンドポイント。
// エリアの新設・RouteNumber構成の変更、および担当職員(User)/委託事業者(Vendor)の
// 割当て・解除を行う。担当エリアはRBACのarea scope判定(auth/scope.ts)の
// 基礎データになるため、変更できるのはsystem_admin/facility_adminのみに絞る。
export const areaRouter = Router();
areaRouter.use(requireAuth);

const AREA_INCLUDE = {
  userAreas: { include: { user: { select: { id: true, displayName: true, email: true, role: true } } } },
  vendorAreas: { include: { vendor: { select: { id: true, vendorName: true } } } },
} as const;

areaRouter.get("/", async (_req, res) => {
  const areas = await prisma.area.findMany({ include: AREA_INCLUDE, orderBy: { name: "asc" } });
  res.json({ data: areas });
});

areaRouter.get("/:id", async (req, res) => {
  const area = await prisma.area.findUnique({ where: { id: String(req.params.id) }, include: AREA_INCLUDE });
  if (!area) throw new NotFoundError();
  res.json(area);
});

areaRouter.post("/", requireRole("system_admin", "facility_admin"), async (req, res) => {
  const data = parseOrThrow(areaCreateSchema, req.body);
  const area = await prisma.area.create({ data });
  res.status(201).json(area);
});

areaRouter.patch("/:id", requireRole("system_admin", "facility_admin"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.area.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  const data = parseOrThrow(areaUpdateSchema, req.body);
  const area = await prisma.area.update({ where: { id }, data });
  res.json(area);
});

areaRouter.delete("/:id", requireRole("system_admin", "facility_admin"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.area.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  // UserArea/VendorAreaはonDelete: Cascadeで自動的に削除される。
  await prisma.area.delete({ where: { id } });
  res.status(204).send();
});

areaRouter.post("/:id/users", requireRole("system_admin", "facility_admin"), async (req, res) => {
  const areaId = String(req.params.id);
  const { userId } = req.body as { userId?: string };
  if (!userId) throw new ValidationError("userIdは必須です。");
  const [area, user] = await Promise.all([
    prisma.area.findUnique({ where: { id: areaId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!area || !user) throw new NotFoundError();
  await prisma.userArea.upsert({
    where: { userId_areaId: { userId, areaId } },
    create: { userId, areaId },
    update: {},
  });
  res.status(201).json({ userId, areaId });
});

areaRouter.delete("/:id/users/:userId", requireRole("system_admin", "facility_admin"), async (req, res) => {
  const areaId = String(req.params.id);
  const userId = String(req.params.userId);
  const existing = await prisma.userArea.findUnique({ where: { userId_areaId: { userId, areaId } } });
  if (!existing) throw new NotFoundError();
  await prisma.userArea.delete({ where: { userId_areaId: { userId, areaId } } });
  res.status(204).send();
});

areaRouter.post("/:id/vendors", requireRole("system_admin", "facility_admin"), async (req, res) => {
  const areaId = String(req.params.id);
  const { vendorId } = req.body as { vendorId?: string };
  if (!vendorId) throw new ValidationError("vendorIdは必須です。");
  const [area, vendor] = await Promise.all([
    prisma.area.findUnique({ where: { id: areaId } }),
    prisma.vendor.findFirst({ where: { id: vendorId, deletedAt: null } }),
  ]);
  if (!area || !vendor) throw new NotFoundError();
  await prisma.vendorArea.upsert({
    where: { vendorId_areaId: { vendorId, areaId } },
    create: { vendorId, areaId },
    update: {},
  });
  res.status(201).json({ vendorId, areaId });
});

areaRouter.delete("/:id/vendors/:vendorId", requireRole("system_admin", "facility_admin"), async (req, res) => {
  const areaId = String(req.params.id);
  const vendorId = String(req.params.vendorId);
  const existing = await prisma.vendorArea.findUnique({ where: { vendorId_areaId: { vendorId, areaId } } });
  if (!existing) throw new NotFoundError();
  await prisma.vendorArea.delete({ where: { vendorId_areaId: { vendorId, areaId } } });
  res.status(204).send();
});
