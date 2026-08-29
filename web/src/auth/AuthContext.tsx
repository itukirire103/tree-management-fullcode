import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { api, setAccessToken } from "../lib/api";
import type { AuthUser } from "../lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // ページロード時、httpOnly Cookieのリフレッシュトークンでサイレントログインを試みる。
    axios
      .post<{ accessToken: string }>("/api/auth/refresh", {}, { withCredentials: true })
      .then(async (res) => {
        setAccessToken(res.data.accessToken);
        const me = await api.get<AuthUser>("/auth/me");
        setUser(me.data);
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("unauthenticated");
      });
  }, []);

  const login = async (email: string, password: string, totpCode?: string) => {
    // MFA必須ユーザーがtotpCode無しでログインすると401 {mfaRequired:true}が返る。
    // ここでは握りつぶさずそのままthrowし、LoginPage側でaxiosエラーの中身を見て
    // 「コード入力欄を出す」か「認証情報エラー」かを判定させる。
    const res = await api.post<{ accessToken: string; user: AuthUser }>("/auth/login", {
      email,
      password,
      totpCode,
    });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setStatus("authenticated");
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  };

  const refreshUser = async () => {
    const res = await api.get<AuthUser>("/auth/me");
    setUser(res.data);
  };

  const value = useMemo(() => ({ user, status, login, logout, refreshUser }), [user, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth はAuthProviderの内側でのみ使用できます。");
  return ctx;
}
