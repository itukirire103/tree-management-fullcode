// api/prisma/schema.prisma のenum/モデル定義をフロントエンド用に手動で翻訳したもの。
// Prismaクライアントの型をフロントに直接共有する構成は取っていない
// (api/webが別デプロイ単位のため、型だけの依存関係を持ち込まない設計)。

export type Role = "system_admin" | "facility_admin" | "ward_staff" | "contractor" | "partner_admin" | "readonly_other";

export const ROLE_LABELS: Record<Role, string> = {
  system_admin: "システム管理者",
  facility_admin: "各所管理者",
  ward_staff: "区一般職員",
  contractor: "街路樹管理委託事業者",
  partner_admin: "協定管理者",
  readonly_other: "その他(閲覧専用)",
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type TreeStatus = "existing" | "removed" | "replanted";
export const TREE_STATUS_LABELS: Record<TreeStatus, string> = {
  existing: "現存",
  removed: "伐採済",
  replanted: "植替え済",
};

export type LeafType = "evergreen" | "deciduous";
export const LEAF_TYPE_LABELS: Record<LeafType, string> = { evergreen: "常緑", deciduous: "落葉" };

export type SizeClass = "tall" | "medium" | "short";
export const SIZE_CLASS_LABELS: Record<SizeClass, string> = { tall: "高木", medium: "中木", short: "低木" };

export type HealthStatus = "A" | "B1" | "B2" | "C";
export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = { A: "A(健全)", B1: "B1", B2: "B2", C: "C(要注意)" };
export const HEALTH_STATUS_COLORS: Record<HealthStatus, string> = {
  A: "#2f9e44",
  B1: "#f2b705",
  B2: "#f27405",
  C: "#e03131",
};

export type WorkType =
  | "pruning"
  | "felling"
  | "stumpRemoval"
  | "stakeWork"
  | "fertilizing"
  | "soilImprovement"
  | "other";
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  pruning: "剪定",
  felling: "伐採",
  stumpRemoval: "伐根",
  stakeWork: "支柱設置撤去",
  fertilizing: "施肥",
  soilImprovement: "土壌改良",
  other: "その他",
};

export type PerformerType = "ward" | "contractor";
export const PERFORMER_TYPE_LABELS: Record<PerformerType, string> = { ward: "区", contractor: "委託業者" };

export type ComplaintStatus = "received" | "inProgress" | "resolved";
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  received: "受付",
  inProgress: "対応中",
  resolved: "対応済",
};

export type Tree = {
  id: string;
  treeNumber: string;
  routeNumber: string | null;
  address: string | null;
  treeHeight: string | null;
  trunkGirth: string | null;
  crownSpread: string | null;
  notes: string | null;
  species: string | null;
  leafType: LeafType | null;
  sizeClass: SizeClass | null;
  healthStatus: HealthStatus | null;
  status: TreeStatus;
  plantedDate: string | null;
  hasStake: boolean;
  hasTag: boolean;
  latitude: string;
  longitude: string;
  replantFromTreeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TreeMapPoint = {
  id: string;
  treeNumber: string;
  latitude: string;
  longitude: string;
  healthStatus: HealthStatus | null;
};

export type Diagnosis = {
  id: string;
  diagnosisNumber: string;
  treeId: string;
  diagnosisDate: string;
  arborist: string | null;
  vigor: string | null;
  shape: string | null;
  rootFindings: string | null;
  trunkFindings: string | null;
  branchFindings: string | null;
  visualJudgement: string | null;
  overallJudgement: string | null;
  judgementReason: string | null;
  nextDiagnosisTiming: string | null;
  needsDetailedDiagnosis: boolean;
  decayHollowRate: string | null;
  reportFileId: string | null;
  createdAt: string;
};

export type Inspection = {
  id: string;
  inspectionNumber: string;
  treeId: string;
  inspectionDate: string;
  inspector: string | null;
  overRoadLimit: boolean;
  overSidewalkLimit: boolean;
  conflictWithFacility: boolean;
  stakeNeedsFix: boolean;
  bigBranchDamage: boolean;
  rootLiftPavementCrack: boolean;
  leafAbnormal: boolean;
  tipDieback: boolean;
  severeDecline: boolean;
  mushroom: boolean;
  barkDecay: boolean;
  pestDamage: boolean;
  swaying: boolean;
  unnaturalLean: boolean;
  inspectionResult: string | null;
  otherNotes: string | null;
  createdAt: string;
};

export type WorkHistory = {
  id: string;
  workNumber: string;
  treeId: string;
  workType: WorkType;
  workDate: string;
  performerType: PerformerType;
  workNotes: string | null;
  vendorId: string | null;
  createdAt: string;
};

export type Vendor = {
  id: string;
  vendorName: string;
  vendorType: string | null;
  areaInCharge: string | null;
  contactInfo: string | null;
  createdAt: string;
};

export type Replant = {
  id: string;
  replantNumber: string;
  replantDate: string;
  background: string | null;
  oldTreeId: string | null;
  newTreeId: string | null;
  createdAt: string;
};

export type Complaint = {
  id: string;
  complaintNumber: string;
  treeId: string;
  routeNumber: string | null;
  requestDate: string;
  requestContent: string | null;
  responseDate: string | null;
  responseRecord: string | null;
  status: ComplaintStatus;
  createdAt: string;
};

export type Area = {
  id: string;
  name: string;
  routeNumbers: string[];
  createdAt: string;
  userAreas: { userId: string; areaId: string; user: { id: string; displayName: string; email: string; role: Role } }[];
  vendorAreas: { vendorId: string; areaId: string; vendor: { id: string; vendorName: string } }[];
};

export type UserSummary = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  vendorId: string | null;
};

export type FileMeta = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
