import { z } from "zod";

// 各エンティティのcreate/updateで受け付ける入力形状。
// Prismaスキーマの必須/任意(NOT NULL制約)にそのまま対応させ、
// Prisma enumで型が決まっているフィールドはz.enum()で厳格化する。
// id/createdAt/updatedAt/deletedAtはクライアントが指定できないよう、
// 各スキーマに含めず.strict()で未知キーごと拒否する。
// updateは同じ形状の全項目optional版(create.partial())とする。

const uuid = (message = "有効なIDを指定してください。") => z.uuid(message);
const dateField = () => z.date({ error: "日付を指定してください。" });

// フロントの<input type="number">はvalueを常に文字列として送る(toSubmitPayload参照)。
// 空文字/null/undefinedは「未入力」として素通しし、後段のoptional/nullableに判定を委ねる。
// 数値に変換できない文字列は変換せずそのまま渡し、z.number()側でエラーにする。
function coerceNumberInput(val: unknown): unknown {
  if (val === "" || val === null || val === undefined) return val === "" ? null : val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isNaN(n) ? val : n;
  }
  return val;
}
const numberField = (message = "数値を指定してください。") =>
  z.preprocess(coerceNumberInput, z.number({ error: message }));
// 任意項目用: coerceNumberInputが空文字/nullをnullへ正規化するため、
// .nullable()はpreprocessの内側(変換後の値を受け取るスキーマ)に付ける必要がある。
// 外側に.optional()を付けることで、undefinedのみpreprocessを経由せず素通しする。
const optionalNumberField = (message = "数値を指定してください。") =>
  z.preprocess(coerceNumberInput, z.number({ error: message }).nullable()).optional();

export const treeCreateSchema = z
  .object({
    treeNumber: z.string().min(1, "樹木番号は必須です。"),
    routeNumber: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    treeHeight: optionalNumberField(),
    trunkGirth: optionalNumberField(),
    crownSpread: optionalNumberField(),
    notes: z.string().optional().nullable(),
    species: z.string().optional().nullable(),
    leafType: z.enum(["evergreen", "deciduous"]).optional().nullable(),
    sizeClass: z.enum(["tall", "medium", "short"]).optional().nullable(),
    healthStatus: z.enum(["A", "B1", "B2", "C"]).optional().nullable(),
    status: z.enum(["existing", "removed", "replanted"]).optional(),
    plantedDate: dateField().optional().nullable(),
    hasStake: z.boolean().optional(),
    hasTag: z.boolean().optional(),
    latitude: numberField("緯度は必須です。"),
    longitude: numberField("経度は必須です。"),
    replantFromTreeId: uuid().optional().nullable(),
  })
  .strict();
export const treeUpdateSchema = treeCreateSchema.partial();

export const diagnosisCreateSchema = z
  .object({
    diagnosisNumber: z.string().min(1, "診断記録番号は必須です。"),
    treeId: uuid(),
    diagnosisDate: dateField(),
    arborist: z.string().optional().nullable(),
    vigor: z.string().optional().nullable(),
    shape: z.string().optional().nullable(),
    rootFindings: z.string().optional().nullable(),
    trunkFindings: z.string().optional().nullable(),
    branchFindings: z.string().optional().nullable(),
    // フロントでは自由記述テキストとして実装されているため文字列のまま受ける
    // (overallJudgementのみ選択肢UIでA/B1/B2/Cに固定されている)。
    visualJudgement: z.string().optional().nullable(),
    overallJudgement: z.enum(["A", "B1", "B2", "C"]).optional().nullable(),
    judgementReason: z.string().optional().nullable(),
    nextDiagnosisTiming: z.string().optional().nullable(),
    needsDetailedDiagnosis: z.boolean().optional(),
    decayHollowRate: optionalNumberField(),
    reportFileId: uuid().optional().nullable(),
  })
  .strict();
export const diagnosisUpdateSchema = diagnosisCreateSchema.partial();

export const inspectionCreateSchema = z
  .object({
    inspectionNumber: z.string().min(1, "点検記録番号は必須です。"),
    treeId: uuid(),
    inspectionDate: dateField(),
    inspector: z.string().optional().nullable(),
    overRoadLimit: z.boolean().optional(),
    overSidewalkLimit: z.boolean().optional(),
    conflictWithFacility: z.boolean().optional(),
    stakeNeedsFix: z.boolean().optional(),
    bigBranchDamage: z.boolean().optional(),
    rootLiftPavementCrack: z.boolean().optional(),
    leafAbnormal: z.boolean().optional(),
    tipDieback: z.boolean().optional(),
    severeDecline: z.boolean().optional(),
    mushroom: z.boolean().optional(),
    barkDecay: z.boolean().optional(),
    pestDamage: z.boolean().optional(),
    swaying: z.boolean().optional(),
    unnaturalLean: z.boolean().optional(),
    inspectionResult: z.string().optional().nullable(),
    otherNotes: z.string().optional().nullable(),
  })
  .strict();
export const inspectionUpdateSchema = inspectionCreateSchema.partial();

export const vendorCreateSchema = z
  .object({
    vendorName: z.string().min(1, "事業者名は必須です。"),
    vendorType: z.string().optional().nullable(),
    areaInCharge: z.string().optional().nullable(),
    contactInfo: z.string().optional().nullable(),
  })
  .strict();
export const vendorUpdateSchema = vendorCreateSchema.partial();

export const workHistoryCreateSchema = z
  .object({
    workNumber: z.string().min(1, "作業記録番号は必須です。"),
    treeId: uuid(),
    workType: z.enum([
      "pruning",
      "felling",
      "stumpRemoval",
      "stakeWork",
      "fertilizing",
      "soilImprovement",
      "other",
    ]),
    workDate: dateField(),
    performerType: z.enum(["ward", "contractor"]),
    workNotes: z.string().optional().nullable(),
    vendorId: uuid().optional().nullable(),
  })
  .strict();
export const workHistoryUpdateSchema = workHistoryCreateSchema.partial();

export const workHistoryPhotoCreateSchema = z
  .object({
    fileId: uuid(),
    photoType: z.enum(["before", "after"]),
    sortOrder: z.preprocess(coerceNumberInput, z.number().int()).optional(),
  })
  .strict();

const photoCreateSchema = z
  .object({
    fileId: uuid(),
    sortOrder: z.preprocess(coerceNumberInput, z.number().int()).optional(),
  })
  .strict();
// 樹木診断結果の「被害部写真」登録用。photoTypeを持たない点がworkHistoryPhotoと異なる。
export const diagnosisPhotoCreateSchema = photoCreateSchema;
// 点検記録の「点検写真」登録用。5枚上限のチェックはルート側(件数を数えてから判定)で行う。
export const inspectionPhotoCreateSchema = photoCreateSchema;

export const replantCreateSchema = z
  .object({
    replantNumber: z.string().min(1, "植替え記録番号は必須です。"),
    replantDate: dateField(),
    background: z.string().optional().nullable(),
    // 要件定義書上は旧樹木ID・新樹木IDともに必須(○)。DBスキーマは既存データとの
    // 互換性のためNULL許容のままにし、アプリケーション層(ここ)で必須を強制する。
    oldTreeId: uuid("旧樹木は必須です。"),
    newTreeId: uuid("新樹木は必須です。"),
  })
  .strict();
export const replantUpdateSchema = replantCreateSchema.partial();

export const complaintCreateSchema = z
  .object({
    complaintNumber: z.string().min(1, "苦情記録番号は必須です。"),
    // 要件定義書上は任意(特定の樹木に紐づかない陳情もあるため)。
    treeId: uuid().optional().nullable(),
    routeNumber: z.string().optional().nullable(),
    requestDate: dateField(),
    requestContent: z.string().optional().nullable(),
    responseDate: dateField().optional().nullable(),
    responseRecord: z.string().optional().nullable(),
    status: z.enum(["received", "inProgress", "resolved"]).optional(),
  })
  .strict();
export const complaintUpdateSchema = complaintCreateSchema.partial();

// エリア(担当エリア=路線番号の集合)の登録・変更。
export const areaCreateSchema = z
  .object({
    name: z.string().min(1, "エリア名は必須です。"),
    routeNumbers: z.array(z.string().min(1)).default([]),
  })
  .strict();
export const areaUpdateSchema = areaCreateSchema.partial();

// 機能要件#2: アカウントの登録・変更・停止。system_adminは権限マトリクス編集と
// 同様にコード側で固定の扱いのため、この画面からは新規付与できない(役割の選択肢から除外)。
const ASSIGNABLE_ROLE = z.enum(["facility_admin", "ward_staff", "contractor", "partner_admin", "readonly_other"]);

export const userCreateSchema = z
  .object({
    email: z.email("有効なメールアドレスを指定してください。"),
    password: z.string().min(8, "パスワードは8文字以上にしてください。"),
    displayName: z.string().min(1, "表示名は必須です。"),
    role: ASSIGNABLE_ROLE,
    vendorId: uuid().optional().nullable(),
  })
  .strict();

export const userUpdateSchema = z
  .object({
    displayName: z.string().min(1, "表示名は必須です。").optional(),
    role: ASSIGNABLE_ROLE.optional(),
    vendorId: uuid().optional().nullable(),
    isActive: z.boolean().optional(),
    password: z.string().min(8, "パスワードは8文字以上にしてください。").optional(),
  })
  .strict();

// 機能要件#3: 権限マトリクス(role_permissions)の一括更新用。system_adminはコード側で
// 固定のため許可ロールから除外する(送られてきても400で弾く)。
export const rolePermissionUpdateSchema = z
  .object({
    changes: z
      .array(
        z
          .object({
            role: z.enum(["facility_admin", "ward_staff", "contractor", "partner_admin", "readonly_other"]),
            entity: z.enum(["tree", "diagnosis", "inspection", "workHistory", "replant", "complaint", "vendor"]),
            action: z.enum(["create", "read", "update", "delete"]),
            scope: z.enum(["global", "area", "own", "none"]),
          })
          .strict()
      )
      .min(1, "変更内容がありません。"),
  })
  .strict();
