import { createCrudRouter, prisma } from "../crud.js";
import { complaintCreateSchema, complaintUpdateSchema } from "../validation/schemas.js";
import { COMPLAINT_EXPORT_COLUMNS } from "../exportColumns.js";

export const complaintRouter = createCrudRouter({
  entity: "complaint",
  delegate: prisma.complaint,
  orderBy: { requestDate: "desc" },
  treeIdFilter: true,
  createSchema: complaintCreateSchema,
  updateSchema: complaintUpdateSchema,
  exportColumns: COMPLAINT_EXPORT_COLUMNS,
  dateFilterField: "requestDate",
});
