import { createCrudRouter, prisma } from "../crud.js";
import type { Prisma } from "@prisma/client";

export const replantRouter = createCrudRouter({
  entity: "replant",
  delegate: prisma.replant,
  orderBy: { replantDate: "desc" },
  // 業務ロジック(Dataverse版ではPower Automateで実装): 植替え履歴が登録されると
  // 旧樹木のステータスを「植替え済」に自動更新する。
  onCreate: async (data) => {
    return prisma.$transaction(async (tx) => {
      const replant = await tx.replant.create({ data: data as Prisma.ReplantUncheckedCreateInput });
      if (replant.oldTreeId) {
        await tx.tree.update({ where: { id: replant.oldTreeId }, data: { status: "replanted" } });
      }
      return replant;
    });
  },
});
