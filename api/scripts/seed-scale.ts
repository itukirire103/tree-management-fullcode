import "dotenv/config";
import { prisma } from "../src/db.js";

// 港区の公募資料に記載の管理本数(約5,200本)相当のダミーデータを投入し、
// ページング・地図bboxクエリ・一覧検索の性能を実規模で検証するためのスクリプト。
// createMany(監査ログのPrisma拡張を経由しない一括insert)を使い、
// 5,200件分の監査ログが生成されるのを避ける。
const TARGET_COUNT = Number(process.env.SEED_SCALE_COUNT ?? 5200);
const BATCH_SIZE = 500;

// 港区のおおよその緯度経度範囲。
const LAT_RANGE: [number, number] = [35.62, 35.68];
const LNG_RANGE: [number, number] = [139.72, 139.78];

const SPECIES = ["クスノキ", "イチョウ", "ケヤキ", "サクラ", "プラタナス", "ハナミズキ", "トウカエデ"];
const LEAF_TYPES = ["evergreen", "deciduous"] as const;
const SIZE_CLASSES = ["tall", "medium", "short"] as const;
const HEALTH_STATUSES = ["A", "B1", "B2", "C", null] as const;
const STATUSES = ["existing", "existing", "existing", "existing", "removed", "replanted"] as const;

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

async function main() {
  const existing = await prisma.tree.count();
  if (existing >= TARGET_COUNT) {
    console.log(`既に${existing}件あるためスキップします(目標: ${TARGET_COUNT}件)。`);
    return;
  }

  const toCreate = TARGET_COUNT - existing;
  console.log(`${toCreate}件の樹木データを投入します(既存: ${existing}件、目標: ${TARGET_COUNT}件)...`);

  const startedAt = Date.now();
  for (let batchStart = 0; batchStart < toCreate; batchStart += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, toCreate - batchStart);
    const rows = Array.from({ length: batchSize }, (_, i) => {
      const seq = existing + batchStart + i + 1;
      return {
        treeNumber: `SEED-${String(seq).padStart(6, "0")}`,
        routeNumber: `R${String(Math.floor(seq / 50) + 1).padStart(3, "0")}`,
        species: randomFrom(SPECIES),
        leafType: randomFrom(LEAF_TYPES),
        sizeClass: randomFrom(SIZE_CLASSES),
        healthStatus: randomFrom(HEALTH_STATUSES),
        status: randomFrom(STATUSES),
        latitude: randomInRange(LAT_RANGE),
        longitude: randomInRange(LNG_RANGE),
      };
    });
    await prisma.tree.createMany({ data: rows });
    process.stdout.write(`\r${Math.min(batchStart + batchSize, toCreate)}/${toCreate}件投入済み`);
  }
  console.log(`\n完了(${((Date.now() - startedAt) / 1000).toFixed(1)}秒)。`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
