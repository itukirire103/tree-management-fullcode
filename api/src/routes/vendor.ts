import { createCrudRouter, prisma } from "../crud.js";
import { vendorCreateSchema, vendorUpdateSchema } from "../validation/schemas.js";

export const vendorRouter = createCrudRouter({
  entity: "vendor",
  delegate: prisma.vendor,
  orderBy: { vendorName: "asc" },
  createSchema: vendorCreateSchema,
  updateSchema: vendorUpdateSchema,
});
