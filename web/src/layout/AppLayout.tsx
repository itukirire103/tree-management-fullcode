import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS } from "../lib/types";
import { canViewVendors } from "../lib/permissions";

const ADMIN_ROLES = new Set(["system_admin", "facility_admin"]);

export function AppLayout() {
  const { user, logout } = useAuth();
  // モバイル幅ではnav/user情報をハンバーガーメニューに畳む(機能要件#22の前提:
  // 現場のスマートフォン・タブレットからのアクセスを想定したレイアウト)。
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-title">港区樹木管理システム</span>
        <button
          type="button"
          className="app-nav-toggle"
          onClick={() => setNavOpen((open) => !open)}
          aria-label="メニューを開閉"
          aria-expanded={navOpen}
        >
          ☰
        </button>
        <nav className={`app-nav${navOpen ? " app-nav-open" : ""}`}>
          <NavLink to="/" end onClick={closeNav}>
            地図
          </NavLink>
          <NavLink to="/trees" onClick={closeNav}>
            樹木一覧
          </NavLink>
          <NavLink to="/trees/stats" onClick={closeNav}>
            数量集計
          </NavLink>
          {user && canViewVendors(user.role) && (
            <NavLink to="/vendors" onClick={closeNav}>
              委託事業者
            </NavLink>
          )}
          {user && ADMIN_ROLES.has(user.role) && (
            <NavLink to="/areas" onClick={closeNav}>
              エリア割当て
            </NavLink>
          )}
          {user && ADMIN_ROLES.has(user.role) && (
            <NavLink to="/audit-logs" onClick={closeNav}>
              監査ログ
            </NavLink>
          )}
          {/* 権限マトリクス編集・アカウント管理はエリア割当て/監査ログより一段強い操作のためsystem_admin限定 */}
          {user && user.role === "system_admin" && (
            <NavLink to="/settings/role-permissions" onClick={closeNav}>
              権限マトリクス
            </NavLink>
          )}
          {user && user.role === "system_admin" && (
            <NavLink to="/settings/users" onClick={closeNav}>
              アカウント管理
            </NavLink>
          )}
        </nav>
        <div className={`app-user${navOpen ? " app-nav-open" : ""}`}>
          {user && (
            <>
              <NavLink to="/settings/mfa" className="mfa-nav-link" onClick={closeNav}>
                {user.displayName}({ROLE_LABELS[user.role]})
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  closeNav();
                  logout();
                }}
              >
                ログアウト
              </button>
            </>
          )}
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
