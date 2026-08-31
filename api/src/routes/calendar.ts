import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { checkPermissionAndGetFilter, ForbiddenError } from "../auth/scope.js";

// 機能要件#13: 陳情・作業の予定・進捗状況・履歴を一覧やカレンダーで確認できること。
// 3エンティティ(苦情・予定・作業履歴)を日付軸でまとめて返す集約エンドポイント。
// フロント側で3回ページング付きリクエストを積み上げる必要をなくし、月ビューの
// 表示ロジックをシンプルに保つ。
export const calendarRouter: Router = Router();
calendarRouter.use(requireAuth);

export type CalendarEvent = {
  id: string;
  category: "complaint" | "schedule" | "workHistory";
  date: string;
  path: string;
  label: string;
  subLabel: string | null;
};

calendarRouter.get("/", async (req, res) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const dateRange = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  };

  const events: CalendarEvent[] = [];

  // 各エンティティで権限が「none」のロールはcheckPermissionAndGetFilterがForbiddenErrorを
  // 投げるため、そのカテゴリだけ空扱いにしてスキップする(カレンダー全体を403にしない)。
  try {
    const filter = (await checkPermissionAndGetFilter("complaint", "read", req.user!)) as
      | Prisma.ComplaintWhereInput
      | undefined;
    const complaints = await prisma.complaint.findMany({
      where: { deletedAt: null, ...filter, requestDate: dateRange },
      select: { id: true, complaintNumber: true, status: true, requestDate: true },
    });
    for (const c of complaints) {
      events.push({
        id: c.id,
        category: "complaint",
        date: c.requestDate.toISOString().slice(0, 10),
        path: `/complaints/${c.id}`,
        label: `苦情 ${c.complaintNumber}`,
        subLabel: c.status,
      });
    }
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
  }

  try {
    const filter = (await checkPermissionAndGetFilter("schedule", "read", req.user!)) as
      | Prisma.ScheduleWhereInput
      | undefined;
    const schedules = await prisma.schedule.findMany({
      where: { deletedAt: null, ...filter, plannedDate: dateRange },
      select: { id: true, scheduleNumber: true, scheduleType: true, workType: true, status: true, plannedDate: true },
    });
    for (const s of schedules) {
      events.push({
        id: s.id,
        category: "schedule",
        date: s.plannedDate.toISOString().slice(0, 10),
        path: `/schedules/${s.id}`,
        label: `${s.scheduleType === "inspection" ? "点検予定" : "作業予定"} ${s.scheduleNumber}`,
        subLabel: s.status,
      });
    }
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
  }

  try {
    const filter = (await checkPermissionAndGetFilter("workHistory", "read", req.user!)) as
      | Prisma.WorkHistoryWhereInput
      | undefined;
    const workHistories = await prisma.workHistory.findMany({
      where: { deletedAt: null, ...filter, workDate: dateRange },
      select: { id: true, workNumber: true, workType: true, workDate: true },
    });
    for (const w of workHistories) {
      events.push({
        id: w.id,
        category: "workHistory",
        date: w.workDate.toISOString().slice(0, 10),
        path: `/work-histories/${w.id}`,
        label: `作業実績 ${w.workNumber}`,
        subLabel: w.workType,
      });
    }
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
  }

  res.json({ data: events });
});
