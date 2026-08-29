import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS } from "../lib/types";

const ADMIN_ROLES = new Set(["system_admin", "facility_admin"]);

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-title">港区樹木管理システム</span>
        <nav className="app-nav">
          <NavLink to="/" end>
            地図
          </NavLink>
          <NavLink to="/trees">樹木一覧</NavLink>
          <NavLink to="/vendors">委託事業者</NavLink>
          {user && ADMIN_ROLES.has(user.role) && <NavLink to="/areas">エリア割当て</NavLink>}
          {user && ADMIN_ROLES.has(user.role) && <NavLink to="/audit-logs">監査ログ</NavLink>}
        </nav>
        <div className="app-user">
          {user && (
            <>
              <NavLink to="/settings/mfa" className="mfa-nav-link">
                {user.displayName}({ROLE_LABELS[user.role]})
              </NavLink>
              <button type="button" onClick={() => logout()}>
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
