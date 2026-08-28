import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

// エリア割当てUIで「どのユーザーに割り当てるか」を選ぶための一覧のみを提供する。
// ユーザーの新規登録・編集はこのプロジェクトの現時点のスコープ外
// (認証基盤は自前JWT+シードスクリプトのみで運用する前提のため)。
export const userRouter = Router();
userRouter.use(requireAuth, requireRole("system_admin", "facility_admin"));

userRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, displayName: true, role: true, vendorId: true },
    orderBy: { displayName: "asc" },
  });
  res.json({ data: users });
});
