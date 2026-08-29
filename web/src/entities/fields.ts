import {
  COMPLAINT_STATUS_LABELS,
  HEALTH_STATUS_LABELS,
  LEAF_TYPE_LABELS,
  PERFORMER_TYPE_LABELS,
  SIZE_CLASS_LABELS,
  TREE_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "../lib/types";

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "treeSelect" | "vendorSelect";

export type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  step?: string; // number入力のstep(小数桁数)
  // 新規作成時の初期値。DB側に@defaultがある必須select(Tree.status等)は、
  // 未選択のままだとHTMLのrequired検証で送信がブロックされてしまうため、
  // フロント側にも同じ既定値を持たせて初期選択しておく。
  defaultValue?: string;
};

function selectOptions(labels: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export const TREE_FIELDS: FieldConfig[] = [
  { key: "treeNumber", label: "樹木番号", type: "text", required: true },
  { key: "routeNumber", label: "路線番号", type: "text" },
  { key: "address", label: "所在地", type: "text" },
  { key: "species", label: "樹種", type: "text" },
  { key: "leafType", label: "葉タイプ", type: "select", options: selectOptions(LEAF_TYPE_LABELS) },
  { key: "sizeClass", label: "サイズ区分", type: "select", options: selectOptions(SIZE_CLASS_LABELS) },
  { key: "healthStatus", label: "健全度", type: "select", options: selectOptions(HEALTH_STATUS_LABELS) },
  {
    key: "status",
    label: "状態",
    type: "select",
    options: selectOptions(TREE_STATUS_LABELS),
    required: true,
    defaultValue: "existing",
  },
  { key: "treeHeight", label: "樹高(m)", type: "number", step: "0.1" },
  { key: "trunkGirth", label: "幹周(cm)", type: "number", step: "1" },
  { key: "crownSpread", label: "樹冠幅(m)", type: "number", step: "0.1" },
  { key: "plantedDate", label: "植栽日", type: "date" },
  { key: "hasStake", label: "支柱あり", type: "checkbox" },
  { key: "hasTag", label: "樹木札あり", type: "checkbox" },
  { key: "latitude", label: "緯度", type: "number", step: "0.000001", required: true },
  { key: "longitude", label: "経度", type: "number", step: "0.000001", required: true },
  { key: "notes", label: "備考", type: "textarea" },
];

export const DIAGNOSIS_FIELDS: FieldConfig[] = [
  { key: "diagnosisNumber", label: "診断番号", type: "text", required: true },
  { key: "treeId", label: "対象樹木", type: "treeSelect", required: true },
  { key: "diagnosisDate", label: "診断日", type: "date", required: true },
  { key: "arborist", label: "診断者", type: "text" },
  { key: "vigor", label: "樹勢", type: "text" },
  { key: "shape", label: "樹形", type: "text" },
  { key: "rootFindings", label: "根の所見", type: "textarea" },
  { key: "trunkFindings", label: "幹の所見", type: "textarea" },
  { key: "branchFindings", label: "枝の所見", type: "textarea" },
  { key: "visualJudgement", label: "目視判定", type: "text" },
  {
    key: "overallJudgement",
    label: "総合判定",
    type: "select",
    options: selectOptions(HEALTH_STATUS_LABELS),
  },
  { key: "judgementReason", label: "判定理由", type: "textarea" },
  { key: "nextDiagnosisTiming", label: "次回診断時期", type: "text" },
  { key: "needsDetailedDiagnosis", label: "精密診断要否", type: "checkbox" },
  { key: "decayHollowRate", label: "腐朽・空洞化率(%)", type: "number", step: "0.1" },
];

export const INSPECTION_FIELDS: FieldConfig[] = [
  { key: "inspectionNumber", label: "点検番号", type: "text", required: true },
  { key: "treeId", label: "対象樹木", type: "treeSelect", required: true },
  { key: "inspectionDate", label: "点検日", type: "date", required: true },
  { key: "inspector", label: "点検者", type: "text" },
  { key: "overRoadLimit", label: "車道側限界超過", type: "checkbox" },
  { key: "overSidewalkLimit", label: "歩道側限界超過", type: "checkbox" },
  { key: "conflictWithFacility", label: "施設との接触", type: "checkbox" },
  { key: "stakeNeedsFix", label: "支柱の補修要否", type: "checkbox" },
  { key: "bigBranchDamage", label: "大枝の損傷", type: "checkbox" },
  { key: "rootLiftPavementCrack", label: "根上がり舗装割れ", type: "checkbox" },
  { key: "leafAbnormal", label: "葉の異常", type: "checkbox" },
  { key: "tipDieback", label: "梢端枯れ", type: "checkbox" },
  { key: "severeDecline", label: "著しい衰弱", type: "checkbox" },
  { key: "mushroom", label: "きのこの発生", type: "checkbox" },
  { key: "barkDecay", label: "樹皮の腐朽", type: "checkbox" },
  { key: "pestDamage", label: "病害虫被害", type: "checkbox" },
  { key: "swaying", label: "揺れ", type: "checkbox" },
  { key: "unnaturalLean", label: "不自然な傾き", type: "checkbox" },
  { key: "inspectionResult", label: "点検結果", type: "text" },
  { key: "otherNotes", label: "その他所見", type: "textarea" },
];

export const WORK_HISTORY_FIELDS: FieldConfig[] = [
  { key: "workNumber", label: "作業番号", type: "text", required: true },
  { key: "treeId", label: "対象樹木", type: "treeSelect", required: true },
  { key: "workType", label: "作業種別", type: "select", options: selectOptions(WORK_TYPE_LABELS), required: true },
  { key: "workDate", label: "作業日", type: "date", required: true },
  {
    key: "performerType",
    label: "実施主体",
    type: "select",
    options: selectOptions(PERFORMER_TYPE_LABELS),
    required: true,
  },
  { key: "vendorId", label: "委託事業者", type: "vendorSelect" },
  { key: "workNotes", label: "作業内容メモ", type: "textarea" },
];

export const VENDOR_FIELDS: FieldConfig[] = [
  { key: "vendorName", label: "事業者名", type: "text", required: true },
  { key: "vendorType", label: "種別", type: "text" },
  { key: "areaInCharge", label: "担当エリア(参考)", type: "text" },
  { key: "contactInfo", label: "連絡先", type: "text" },
];

export const REPLANT_FIELDS: FieldConfig[] = [
  { key: "replantNumber", label: "植替え番号", type: "text", required: true },
  { key: "replantDate", label: "植替え日", type: "date", required: true },
  { key: "oldTreeId", label: "旧樹木", type: "treeSelect" },
  { key: "newTreeId", label: "新樹木", type: "treeSelect" },
  { key: "background", label: "経緯", type: "textarea" },
];

export const COMPLAINT_FIELDS: FieldConfig[] = [
  { key: "complaintNumber", label: "苦情番号", type: "text", required: true },
  // 要件定義書上は任意(特定の樹木に紐づかない陳情もあるため)。
  { key: "treeId", label: "対象樹木", type: "treeSelect" },
  { key: "routeNumber", label: "路線番号", type: "text" },
  { key: "requestDate", label: "受付日", type: "date", required: true },
  { key: "requestContent", label: "要望内容", type: "textarea" },
  {
    key: "status",
    label: "対応状況",
    type: "select",
    options: selectOptions(COMPLAINT_STATUS_LABELS),
    required: true,
    defaultValue: "received",
  },
  { key: "responseDate", label: "対応日", type: "date" },
  { key: "responseRecord", label: "対応記録", type: "textarea" },
];
