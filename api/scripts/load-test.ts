import "dotenv/config";

// Dataverse版で実績のあるPython concurrent.futures方式の負荷テストを踏襲する予定だったが、
// 開発機のPython実行環境が不安定だったため、Node.jsのネイティブ並行fetchで同等の
// 検証(複数ユーザーの同時アクセスを模した読み書き混在ワークロード)を行う設計にした。
const BASE_URL = process.env.LOAD_TEST_BASE_URL ?? "http://localhost:3001";
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const ITERATIONS = Number(process.env.LOAD_TEST_ITERATIONS ?? 10);
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

type Sample = { ok: boolean; ms: number; label: string; status?: number };

async function timed<T>(label: string, fn: () => Promise<{ status: number; ok: boolean }>): Promise<Sample> {
  const start = performance.now();
  try {
    const { status, ok } = await fn();
    return { ok, ms: performance.now() - start, label, status };
  } catch {
    return { ok: false, ms: performance.now() - start, label };
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

// 1「仮想ユーザー」が行う一連の操作(閲覧中心+一部書き込み、実利用パターンを想定)。
async function virtualUserWorkload(userId: number, token: string): Promise<Sample[]> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const samples: Sample[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    samples.push(
      await timed("GET /trees", async () => {
        const res = await fetch(`${BASE_URL}/api/trees?page=1&pageSize=20`, { headers });
        return { status: res.status, ok: res.ok };
      })
    );
    samples.push(
      await timed("GET /trees/map", async () => {
        const res = await fetch(
          `${BASE_URL}/api/trees/map?swLat=35.62&swLng=139.72&neLat=35.68&neLng=139.78`,
          { headers }
        );
        return { status: res.status, ok: res.ok };
      })
    );

    let createdId: string | undefined;
    samples.push(
      await timed("POST /trees", async () => {
        const res = await fetch(`${BASE_URL}/api/trees`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            treeNumber: `LOADTEST-U${userId}-${i}-${Date.now()}`,
            latitude: 35.65 + Math.random() * 0.01,
            longitude: 139.75 + Math.random() * 0.01,
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { id: string };
          createdId = body.id;
        }
        return { status: res.status, ok: res.ok };
      })
    );

    if (createdId) {
      samples.push(
        await timed("DELETE /trees/:id", async () => {
          const res = await fetch(`${BASE_URL}/api/trees/${createdId}`, { method: "DELETE", headers });
          return { status: res.status, ok: res.ok };
        })
      );
    }
  }
  return samples;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`負荷テスト開始: 同時ユーザー数=${CONCURRENCY}, 1ユーザーあたりの反復=${ITERATIONS}`);
  const startedAt = performance.now();

  const tokens = await Promise.all(Array.from({ length: CONCURRENCY }, () => login()));
  console.log(`${CONCURRENCY}ユーザー分のログイン完了。負荷をかけます...`);

  const results = await Promise.all(tokens.map((token, i) => virtualUserWorkload(i, token)));
  const samples = results.flat();

  const totalMs = performance.now() - startedAt;
  const errorSamples = samples.filter((s) => !s.ok);
  const byLabel = new Map<string, Sample[]>();
  for (const s of samples) {
    if (!byLabel.has(s.label)) byLabel.set(s.label, []);
    byLabel.get(s.label)!.push(s);
  }

  console.log(`\n=== 結果 (総所要時間: ${(totalMs / 1000).toFixed(1)}秒, 総リクエスト数: ${samples.length}) ===`);
  for (const [label, list] of byLabel) {
    const sorted = list.map((s) => s.ms).sort((a, b) => a - b);
    const errors = list.filter((s) => !s.ok).length;
    console.log(
      `${label}: n=${list.length} p50=${percentile(sorted, 50).toFixed(0)}ms p95=${percentile(sorted, 95).toFixed(0)}ms p99=${percentile(sorted, 99).toFixed(0)}ms errors=${errors}`
    );
  }
  console.log(`\nエラー率: ${((errorSamples.length / samples.length) * 100).toFixed(2)}% (${errorSamples.length}/${samples.length})`);
  if (errorSamples.length > 0) {
    const statusCounts = new Map<string, number>();
    for (const s of errorSamples) {
      const key = `${s.label} status=${s.status ?? "network error"}`;
      statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
    }
    console.log("エラー内訳:", Object.fromEntries(statusCounts));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
