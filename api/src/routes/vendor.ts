import { createCrudRouter, prisma } from "../crud.js";
import { vendorCreateSchema, vendorUpdateSchema } from "../validation/schemas.js";
import { VENDOR_EXPORT_COLUMNS } from "../exportColumns.js";

export const vendorRouter = createCrudRouter({
  entity: "vendor",
  delegate: prisma.vendor,
  orderBy: { vendorName: "asc" },
  createSchema: vendorCreateSchema,
  updateSchema: vendorUpdateSchema,
  exportColumns: VENDOR_EXPORT_COLUMNS,
});
