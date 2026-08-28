import { createCrudRouter, prisma } from "../crud.js";
import type { Prisma } from "@prisma/client";

// diagnosis.overallJudgement("A"/"B1"/"B2"/"C")が樹木マスタのhealthStatusと
// 同じ値体系であることを前提に、そのまま反映する。
const VALID_HEALTH_STATUS = new Set(["A", "B1", "B2", "C"]);

export const diagnosisRouter = createCrudRouter({
  entity: "diagnosis",
  delegate: prisma.diagnosis,
  orderBy: { diagnosisDate: "desc" },
  treeIdFilter: true,
  // 業務ロジック(Dataverse版ではPower Automateで実装): 樹木診断結果が登録されると
  // 樹木マスタの健全度を自動更新する。
  onCreate: async (data) => {
    // フロントエンドからはtreeIdをフラットな外部キーとして送るため、
    // リレーションconnect形式ではなくUncheckedCreateInputを使う。
    const input = data as Prisma.DiagnosisUncheckedCreateInput;
    return prisma.$transaction(async (tx) => {
      const diagnosis = await tx.diagnosis.create({ data: input });
      const judgement = diagnosis.overallJudgement;
      if (judgement && VALID_HEALTH_STATUS.has(judgement)) {
        await tx.tree.update({
          where: { id: diagnosis.treeId },
          data: { healthStatus: judgement as "A" | "B1" | "B2" | "C" },
        });
      }
      return diagnosis;
    });
  },
});
