import type { ExportColumn } from "./export.js";

// CSV/Excelエクスポート(機能要件#11/#25)の列定義。フロントのfields.tsの
// ラベルと揃え、Prismaのフィールド名(camelCase)をkeyにする。

export const TREE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "treeNumber", header: "樹木番号" },
  { key: "routeNumber", header: "路線番号" },
  { key: "address", header: "所在地" },
  { key: "species", header: "樹種" },
  { key: "leafType", header: "葉タイプ" },
  { key: "sizeClass", header: "サイズ区分" },
  { key: "healthStatus", header: "健全度" },
  { key: "status", header: "状態" },
  { key: "treeHeight", header: "樹高(m)" },
  { key: "trunkGirth", header: "幹周(cm)" },
  { key: "crownSpread", header: "樹冠幅(m)" },
  { key: "plantedDate", header: "植栽日" },
  { key: "hasStake", header: "支柱あり" },
  { key: "hasTag", header: "樹木札あり" },
  { key: "latitude", header: "緯度" },
  { key: "longitude", header: "経度" },
  { key: "notes", header: "備考" },
];

export const DIAGNOSIS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "diagnosisNumber", header: "診断番号" },
  { key: "treeId", header: "対象樹木ID" },
  { key: "diagnosisDate", header: "診断日" },
  { key: "arborist", header: "診断者" },
  { key: "vigor", header: "樹勢" },
  { key: "shape", header: "樹形" },
  { key: "rootFindings", header: "根の所見" },
  { key: "trunkFindings", header: "幹の所見" },
  { key: "branchFindings", header: "枝の所見" },
  { key: "visualJudgement", header: "目視判定" },
  { key: "overallJudgement", header: "総合判定" },
  { key: "judgementReason", header: "判定理由" },
  { key: "nextDiagnosisTiming", header: "次回診断時期" },
  { key: "needsDetailedDiagnosis", header: "精密診断要否" },
  { key: "decayHollowRate", header: "腐朽・空洞化率(%)" },
];

export const INSPECTION_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "inspectionNumber", header: "点検番号" },
  { key: "treeId", header: "対象樹木ID" },
  { key: "inspectionDate", header: "点検日" },
  { key: "inspector", header: "点検者" },
  { key: "overRoadLimit", header: "車道側限界超過" },
  { key: "overSidewalkLimit", header: "歩道側限界超過" },
  { key: "conflictWithFacility", header: "施設との接触" },
  { key: "stakeNeedsFix", header: "支柱の補修要否" },
  { key: "bigBranchDamage", header: "大枝の損傷" },
  { key: "rootLiftPavementCrack", header: "根上がり舗装割れ" },
  { key: "leafAbnormal", header: "葉の異常" },
  { key: "tipDieback", header: "梢端枯れ" },
  { key: "severeDecline", header: "著しい衰弱" },
  { key: "mushroom", header: "きのこの発生" },
  { key: "barkDecay", header: "樹皮の腐朽" },
  { key: "pestDamage", header: "病害虫被害" },
  { key: "swaying", header: "揺れ" },
  { key: "unnaturalLean", header: "不自然な傾き" },
  { key: "inspectionResult", header: "点検結果" },
  { key: "otherNotes", header: "その他所見" },
];

export const WORK_HISTORY_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "workNumber", header: "作業番号" },
  { key: "treeId", header: "対象樹木ID" },
  { key: "workType", header: "作業種別" },
  { key: "workDate", header: "作業日" },
  { key: "performerType", header: "実施主体" },
  { key: "vendorId", header: "委託事業者ID" },
  { key: "workNotes", header: "作業内容メモ" },
];

export const SCHEDULE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "scheduleNumber", header: "予定番号" },
  { key: "scheduleType", header: "予定種別" },
  { key: "treeId", header: "対象樹木ID" },
  { key: "plannedDate", header: "予定日" },
  { key: "workType", header: "作業種別" },
  { key: "status", header: "進捗状況" },
  { key: "vendorId", header: "委託事業者ID" },
  { key: "memo", header: "メモ" },
];

export const VENDOR_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "vendorName", header: "事業者名" },
  { key: "vendorType", header: "種別" },
  { key: "areaInCharge", header: "担当エリア(参考)" },
  { key: "contactInfo", header: "連絡先" },
];

export const REPLANT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "replantNumber", header: "植替え番号" },
  { key: "replantDate", header: "植替え日" },
  { key: "oldTreeId", header: "旧樹木ID" },
  { key: "newTreeId", header: "新樹木ID" },
  { key: "background", header: "経緯" },
];

export const COMPLAINT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "complaintNumber", header: "苦情番号" },
  { key: "treeId", header: "対象樹木ID" },
  { key: "routeNumber", header: "路線番号" },
  { key: "requestDate", header: "受付日" },
  { key: "requestContent", header: "要望内容" },
  { key: "responseDate", header: "対応日" },
  { key: "responseRecord", header: "対応記録" },
  { key: "status", header: "対応状況" },
];
