import { createCrudRouter, prisma } from "../crud.js";
import { inspectionCreateSchema, inspectionUpdateSchema } from "../validation/schemas.js";

export const inspectionRouter = createCrudRouter({
  entity: "inspection",
  delegate: prisma.inspection,
  orderBy: { inspectionDate: "desc" },
  treeIdFilter: true,
  createSchema: inspectionCreateSchema,
  updateSchema: inspectionUpdateSchema,
});
