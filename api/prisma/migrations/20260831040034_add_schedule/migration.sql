-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('点検予定', '作業予定');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('予定', '進行中', '完了', '中止');

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_tree_id_fkey";

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "schedule_number" TEXT NOT NULL,
    "schedule_type" "ScheduleType" NOT NULL,
    "tree_id" TEXT NOT NULL,
    "planned_date" DATE NOT NULL,
    "work_type" "WorkType",
    "status" "ScheduleStatus" NOT NULL DEFAULT '予定',
    "vendor_id" TEXT,
    "memo" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
