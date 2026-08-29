-- CreateTable
-- 樹木診断結果の「被害部写真」(要件定義書上は複数枚添付)。
CREATE TABLE "diagnosis_photos" (
    "id" TEXT NOT NULL,
    "diagnosis_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "diagnosis_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- 点検記録の「点検写真」(要件定義書上は複数枚、最大5枚)。上限チェックはAPI側で行う。
CREATE TABLE "inspection_photos" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "diagnosis_photos" ADD CONSTRAINT "diagnosis_photos_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_photos" ADD CONSTRAINT "diagnosis_photos_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
