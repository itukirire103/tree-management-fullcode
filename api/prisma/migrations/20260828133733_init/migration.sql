-- CreateEnum
CREATE TYPE "Role" AS ENUM ('system_admin', 'facility_admin', 'ward_staff', 'contractor', 'partner_admin', 'readonly_other');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "TreeStatus" AS ENUM ('現存', '伐採済', '植替え済');

-- CreateEnum
CREATE TYPE "LeafType" AS ENUM ('常緑', '落葉');

-- CreateEnum
CREATE TYPE "SizeClass" AS ENUM ('高木', '中木', '低木');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('A', 'B1', 'B2', 'C');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('剪定', '伐採', '伐根', '支柱設置撤去', '施肥', '土壌改良', 'その他');

-- CreateEnum
CREATE TYPE "PerformerType" AS ENUM ('区', '委託業者');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('作業前', '作業後');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('受付', '対応中', '対応済');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "vendor_id" TEXT,
    "totp_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route_numbers" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_areas" (
    "user_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,

    CONSTRAINT "user_areas_pkey" PRIMARY KEY ("user_id","area_id")
);

-- CreateTable
CREATE TABLE "vendor_areas" (
    "vendor_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,

    CONSTRAINT "vendor_areas_pkey" PRIMARY KEY ("vendor_id","area_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diff" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trees" (
    "id" TEXT NOT NULL,
    "tree_number" TEXT NOT NULL,
    "route_number" TEXT,
    "address" TEXT,
    "tree_height" DECIMAL(5,1),
    "trunk_girth" DECIMAL(6,0),
    "crown_spread" DECIMAL(5,1),
    "notes" TEXT,
    "species" TEXT,
    "leaf_type" "LeafType",
    "size_class" "SizeClass",
    "health_status" "HealthStatus",
    "status" "TreeStatus" NOT NULL DEFAULT '現存',
    "planted_date" DATE,
    "has_stake" BOOLEAN NOT NULL DEFAULT false,
    "has_tag" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "replant_from_tree_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "diagnosis_number" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "diagnosis_date" DATE NOT NULL,
    "arborist" TEXT,
    "vigor" TEXT,
    "shape" TEXT,
    "root_findings" TEXT,
    "trunk_findings" TEXT,
    "branch_findings" TEXT,
    "visual_judgement" TEXT,
    "overall_judgement" TEXT,
    "judgement_reason" TEXT,
    "next_diagnosis_timing" TEXT,
    "needs_detailed_diagnosis" BOOLEAN NOT NULL DEFAULT false,
    "decay_hollow_rate" DECIMAL(5,1),
    "report_file_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "inspection_number" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "inspection_date" DATE NOT NULL,
    "inspector" TEXT,
    "over_road_limit" BOOLEAN NOT NULL DEFAULT false,
    "over_sidewalk_limit" BOOLEAN NOT NULL DEFAULT false,
    "conflict_with_facility" BOOLEAN NOT NULL DEFAULT false,
    "stake_needs_fix" BOOLEAN NOT NULL DEFAULT false,
    "big_branch_damage" BOOLEAN NOT NULL DEFAULT false,
    "root_lift_pavement_crack" BOOLEAN NOT NULL DEFAULT false,
    "leaf_abnormal" BOOLEAN NOT NULL DEFAULT false,
    "tip_dieback" BOOLEAN NOT NULL DEFAULT false,
    "severe_decline" BOOLEAN NOT NULL DEFAULT false,
    "mushroom" BOOLEAN NOT NULL DEFAULT false,
    "bark_decay" BOOLEAN NOT NULL DEFAULT false,
    "pest_damage" BOOLEAN NOT NULL DEFAULT false,
    "swaying" BOOLEAN NOT NULL DEFAULT false,
    "unnatural_lean" BOOLEAN NOT NULL DEFAULT false,
    "inspection_result" TEXT,
    "other_notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "vendor_type" TEXT,
    "area_in_charge" TEXT,
    "contact_info" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_histories" (
    "id" TEXT NOT NULL,
    "work_number" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "work_type" "WorkType" NOT NULL,
    "work_date" DATE NOT NULL,
    "performer_type" "PerformerType" NOT NULL,
    "work_notes" TEXT,
    "vendor_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_history_photos" (
    "id" TEXT NOT NULL,
    "work_history_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "photo_type" "PhotoType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_history_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replants" (
    "id" TEXT NOT NULL,
    "replant_number" TEXT NOT NULL,
    "replant_date" DATE NOT NULL,
    "background" TEXT,
    "old_tree_id" TEXT,
    "new_tree_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "complaint_number" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "route_number" TEXT,
    "request_date" DATE NOT NULL,
    "request_content" TEXT,
    "response_date" DATE,
    "response_record" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT '受付',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_log_table_name_record_id_idx" ON "audit_log"("table_name", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "trees_tree_number_key" ON "trees"("tree_number");

-- CreateIndex
CREATE INDEX "trees_status_deleted_at_idx" ON "trees"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "trees_latitude_longitude_idx" ON "trees"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "diagnoses_report_file_id_key" ON "diagnoses"("report_file_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_areas" ADD CONSTRAINT "user_areas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_areas" ADD CONSTRAINT "user_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_areas" ADD CONSTRAINT "vendor_areas_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_areas" ADD CONSTRAINT "vendor_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trees" ADD CONSTRAINT "trees_replant_from_tree_id_fkey" FOREIGN KEY ("replant_from_tree_id") REFERENCES "trees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_report_file_id_fkey" FOREIGN KEY ("report_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_histories" ADD CONSTRAINT "work_histories_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_histories" ADD CONSTRAINT "work_histories_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_history_photos" ADD CONSTRAINT "work_history_photos_work_history_id_fkey" FOREIGN KEY ("work_history_id") REFERENCES "work_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_history_photos" ADD CONSTRAINT "work_history_photos_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replants" ADD CONSTRAINT "replants_old_tree_id_fkey" FOREIGN KEY ("old_tree_id") REFERENCES "trees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replants" ADD CONSTRAINT "replants_new_tree_id_fkey" FOREIGN KEY ("new_tree_id") REFERENCES "trees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
