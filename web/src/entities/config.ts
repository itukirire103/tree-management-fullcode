import { createEntityQueries } from "./queries";
import {
  COMPLAINT_FIELDS,
  DIAGNOSIS_FIELDS,
  INSPECTION_FIELDS,
  REPLANT_FIELDS,
  SCHEDULE_FIELDS,
  TREE_FIELDS,
  VENDOR_FIELDS,
  WORK_HISTORY_FIELDS,
  type FieldConfig,
} from "./fields";
import type { Complaint, Diagnosis, Inspection, Replant, Schedule, Tree, Vendor, WorkHistory } from "../lib/types";

export type EntityDef<T extends { id: string }> = {
  key: string;
  path: string;
  label: string;
  fields: FieldConfig[];
  queries: ReturnType<typeof createEntityQueries<T>>;
  // 一覧テーブルに表示する列(多すぎると見づらいため、代表的な項目のみに絞る)。
  listColumns: string[];
  // 複数枚の写真添付(被害部写真・点検写真等)を持つエンティティのみ設定する。
  // 編集画面(EntityFormPage)でレコードid確定後にのみ表示される。
  photoConfig?: { label: string; maxCount?: number };
  // 作業前後写真(機能要件#9)のように、種別(photoType)ごとに分けて
  // アップロード欄を出す必要があるエンティティのみ設定する。photoConfigとは併用しない。
  photoTypeGroups?: { value: string; label: string }[];
  // CSV/Excel出力(機能要件#11)。バックエンドのGET {path}/export?format=csv|xlsxに対応する
  // エンティティのみtrueにする(全エンティティで有効)。
  exportable?: boolean;
  // 期間指定検索(機能要件#13)。バックエンドでdateFilterFieldが設定済みのエンティティのみ、
  // 一覧画面に開始日/終了日の入力欄を表示する。
  dateRangeFilter?: boolean;
  // 台帳の項目ごとの絞込検索(機能要件#19)。バックエンドのfilterFields(api/src/routes/*.ts)
  // と対になるキーのみ指定する。fields内の該当FieldConfigからtype(select/checkbox)や
  // options(選択肢)を引いて入力欄を出し分ける。
  filterableFields?: string[];
};

export const treeEntity: EntityDef<Tree> = {
  key: "tree",
  path: "/trees",
  label: "樹木",
  fields: TREE_FIELDS,
  queries: createEntityQueries<Tree>("/trees"),
  listColumns: ["treeNumber", "species", "status", "healthStatus", "address"],
  exportable: true,
  filterableFields: ["species", "status", "healthStatus", "address"],
};

export const diagnosisEntity: EntityDef<Diagnosis> = {
  key: "diagnosis",
  path: "/diagnoses",
  label: "樹木診断",
  fields: DIAGNOSIS_FIELDS,
  queries: createEntityQueries<Diagnosis>("/diagnoses"),
  listColumns: ["diagnosisNumber", "diagnosisDate", "overallJudgement", "arborist"],
  photoConfig: { label: "被害部写真" },
  exportable: true,
  dateRangeFilter: true,
  filterableFields: ["diagnosisNumber", "overallJudgement", "arborist"],
};

export const inspectionEntity: EntityDef<Inspection> = {
  key: "inspection",
  path: "/inspections",
  label: "日常点検",
  fields: INSPECTION_FIELDS,
  queries: createEntityQueries<Inspection>("/inspections"),
  listColumns: ["inspectionNumber", "inspectionDate", "inspector", "inspectionResult"],
  photoConfig: { label: "点検写真", maxCount: 5 },
  exportable: true,
  dateRangeFilter: true,
  filterableFields: ["inspectionNumber", "inspector", "inspectionResult"],
};

export const workHistoryEntity: EntityDef<WorkHistory> = {
  key: "workHistory",
  path: "/work-histories",
  label: "作業履歴",
  fields: WORK_HISTORY_FIELDS,
  queries: createEntityQueries<WorkHistory>("/work-histories"),
  listColumns: ["workNumber", "workType", "workDate", "performerType"],
  photoTypeGroups: [
    { value: "before", label: "作業前写真" },
    { value: "after", label: "作業後写真" },
  ],
  exportable: true,
  dateRangeFilter: true,
  filterableFields: ["workNumber", "workType", "performerType"],
};

export const scheduleEntity: EntityDef<Schedule> = {
  key: "schedule",
  path: "/schedules",
  label: "点検・作業予定",
  fields: SCHEDULE_FIELDS,
  queries: createEntityQueries<Schedule>("/schedules"),
  listColumns: ["scheduleNumber", "scheduleType", "plannedDate", "workType", "status"],
  exportable: true,
  dateRangeFilter: true,
  filterableFields: ["scheduleNumber", "scheduleType", "workType", "status"],
};

export const vendorEntity: EntityDef<Vendor> = {
  key: "vendor",
  path: "/vendors",
  label: "委託事業者",
  fields: VENDOR_FIELDS,
  queries: createEntityQueries<Vendor>("/vendors"),
  listColumns: ["vendorName", "vendorType", "contactInfo"],
  exportable: true,
  filterableFields: ["vendorName", "vendorType", "contactInfo"],
};

export const replantEntity: EntityDef<Replant> = {
  key: "replant",
  path: "/replants",
  label: "植替え履歴",
  fields: REPLANT_FIELDS,
  queries: createEntityQueries<Replant>("/replants"),
  listColumns: ["replantNumber", "replantDate", "background"],
  exportable: true,
  dateRangeFilter: true,
  filterableFields: ["replantNumber", "background"],
};

export const complaintEntity: EntityDef<Complaint> = {
  key: "complaint",
  path: "/complaints",
  label: "苦情・要望",
  fields: COMPLAINT_FIELDS,
  queries: createEntityQueries<Complaint>("/complaints"),
  listColumns: ["complaintNumber", "requestDate", "status", "routeNumber"],
  exportable: true,
  dateRangeFilter: true,
  filterableFields: ["complaintNumber", "status", "routeNumber"],
};

export const TREE_LINKED_ENTITIES = [
  diagnosisEntity,
  inspectionEntity,
  workHistoryEntity,
  scheduleEntity,
  complaintEntity,
];
