import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./auth/LoginPage";
import { AppLayout } from "./layout/AppLayout";
import { MapPage } from "./features/map/MapPage";
import { TreeDetailPage } from "./features/tree/TreeDetailPage";
import { AreasPage } from "./features/areas/AreasPage";
import { TreeStatsPage } from "./features/stats/TreeStatsPage";
import { MfaSettingsPage } from "./features/settings/MfaSettingsPage";
import { AuditLogPage } from "./features/audit/AuditLogPage";
import { EntityListPage } from "./entities/EntityListPage";
import { EntityFormPage } from "./entities/EntityFormPage";
import {
  complaintEntity,
  diagnosisEntity,
  inspectionEntity,
  replantEntity,
  treeEntity,
  vendorEntity,
  workHistoryEntity,
  type EntityDef,
} from "./entities/config";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

// 樹木に紐づくエンティティ(診断・点検・作業履歴・苦情)は、樹木詳細ページから
// treeId付きで新規作成へ遷移する導線が主なため、fixedFieldKeysでtreeId列を隠す。
// EntityDef<any>にしているのは、異なるT同士を1つの配列としてマッピングする際、
// TypeScriptがジェネリックコンポーネントへのUnion型propsをうまく推論できないため
// (実行時の型安全性は各entityの定義自体で担保されている)。
const TREE_LINKED_ROUTE_ENTITIES: { entity: EntityDef<any>; fixedFieldKeys: string[] }[] = [
  { entity: diagnosisEntity, fixedFieldKeys: ["treeId"] },
  { entity: inspectionEntity, fixedFieldKeys: ["treeId"] },
  { entity: workHistoryEntity, fixedFieldKeys: ["treeId"] },
  { entity: complaintEntity, fixedFieldKeys: ["treeId"] },
];

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<MapPage />} />

              <Route path="/trees" element={<EntityListPage entity={treeEntity} rowLinkLabel="詳細" />} />
              <Route path="/trees/new" element={<EntityFormPage entity={treeEntity} backTo="/trees" />} />
              <Route path="/trees/stats" element={<TreeStatsPage />} />
              <Route path="/trees/:id" element={<TreeDetailPage />} />
              <Route path="/trees/:id/edit" element={<EntityFormPage entity={treeEntity} />} />

              {TREE_LINKED_ROUTE_ENTITIES.map(({ entity }) => (
                <Route key={entity.key} path={entity.path} element={<EntityListPage entity={entity} />} />
              ))}
              {TREE_LINKED_ROUTE_ENTITIES.map(({ entity, fixedFieldKeys }) => (
                <Route
                  key={`${entity.key}-new`}
                  path={`${entity.path}/new`}
                  element={<EntityFormPage entity={entity} fixedFieldKeys={fixedFieldKeys} />}
                />
              ))}
              {TREE_LINKED_ROUTE_ENTITIES.map(({ entity, fixedFieldKeys }) => (
                <Route
                  key={`${entity.key}-edit`}
                  path={`${entity.path}/:id`}
                  element={<EntityFormPage entity={entity} fixedFieldKeys={fixedFieldKeys} />}
                />
              ))}

              <Route path="/replants" element={<EntityListPage entity={replantEntity} />} />
              <Route path="/replants/new" element={<EntityFormPage entity={replantEntity} />} />
              <Route path="/replants/:id" element={<EntityFormPage entity={replantEntity} />} />

              <Route path="/vendors" element={<EntityListPage entity={vendorEntity} />} />
              <Route path="/vendors/new" element={<EntityFormPage entity={vendorEntity} />} />
              <Route path="/vendors/:id" element={<EntityFormPage entity={vendorEntity} />} />

              <Route
                path="/areas"
                element={
                  <ProtectedRoute roles={["system_admin", "facility_admin"]}>
                    <AreasPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/settings/mfa" element={<MfaSettingsPage />} />

              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute roles={["system_admin", "facility_admin"]}>
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
