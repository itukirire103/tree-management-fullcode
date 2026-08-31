import type { Router } from "express";
import { createCrudRouter, prisma } from "../crud.js";
import { scheduleCreateSchema, scheduleUpdateSchema } from "../validation/schemas.js";
import { SCHEDULE_EXPORT_COLUMNS } from "../exportColumns.js";

// 機能要件#24(定期点検や作業予定を登録できること)。Inspection/WorkHistoryの
// 「実施済み」記録とは別に、未来の予定を管理する。
export const scheduleRouter: Router = createCrudRouter({
  entity: "schedule",
  delegate: prisma.schedule,
  orderBy: { plannedDate: "asc" },
  treeIdFilter: true,
  createSchema: scheduleCreateSchema,
  updateSchema: scheduleUpdateSchema,
  exportColumns: SCHEDULE_EXPORT_COLUMNS,
  dateFilterField: "plannedDate",
  filterFields: [
    { key: "scheduleNumber", mode: "text" },
    { key: "scheduleType", mode: "select" },
    { key: "workType", mode: "select" },
    { key: "status", mode: "select" },
  ],
});
