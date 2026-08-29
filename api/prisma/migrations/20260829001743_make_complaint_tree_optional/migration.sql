-- AlterTable
-- 要件定義書上、苦情・陳情記録の樹木IDは任意(特定の樹木に紐づかない陳情もあるため)。
-- 実装がNOT NULLになっていたため、要件通りNULL許容に修正する。
ALTER TABLE "complaints" ALTER COLUMN "tree_id" DROP NOT NULL;
