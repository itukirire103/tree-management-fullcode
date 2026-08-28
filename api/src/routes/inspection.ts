import { createCrudRouter, prisma } from "../crud.js";

export const inspectionRouter = createCrudRouter({
  entity: "inspection",
  delegate: prisma.inspection,
  orderBy: { inspectionDate: "desc" },
  treeIdFilter: true,
});
