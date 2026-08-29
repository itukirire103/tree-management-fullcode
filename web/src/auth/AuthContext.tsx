import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { api, setAccessToken } from "../lib/api";
import type { AuthUser } from "../lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const login = async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>("/auth/login", { email, password });
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

  const value = useMemo(() => ({ user, status, login, logout }), [user, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth はAuthProviderの内側でのみ使用できます。");
  return ctx;
}
