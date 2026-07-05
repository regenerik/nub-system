"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  readStoredUser,
  readToken,
  writeStoredUser,
  writeToken,
} from "@/lib/auth-storage";
import { disconnectSocket } from "@/lib/socket";
import {
  auth0LogoutUrl,
  completeAuth0Login as completeAuth0PkceLogin,
  startAuth0Login,
} from "@/lib/auth0-spa";
import type { LoginResponse, User, UserRole } from "@/types/domain";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  startAuth0Login: () => Promise<void>;
  completeAuth0Login: () => Promise<User>;
  googleLogin: (payload: {
    email: string;
    full_name: string;
    google_account_id: string;
  }) => Promise<User>;
  logout: () => void;
  me: () => Promise<User | null>;
  redirectForRole: (role?: UserRole) => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((nextToken: string | null, nextUser: User | null) => {
    setToken(nextToken);
    setUser(nextUser);
    writeToken(nextToken);
    writeStoredUser(nextUser);
  }, []);

  const redirectForRole = useCallback((role?: UserRole) => {
    if (role === "admin") return "/admin";
    if (role === "recepcion") return "/recepcion";
    if (role === "barbero") return "/barbero";
    return "/cliente";
  }, []);

  const me = useCallback(async () => {
    const currentToken = readToken();
    if (!currentToken) {
      setSession(null, null);
      return null;
    }
    try {
      const data = await api.get<{ user: User }>("/auth/me", { token: currentToken });
      setSession(currentToken, data.user);
      return data.user;
    } catch {
      setSession(null, null);
      return null;
    }
  }, [setSession]);

  useEffect(() => {
    setToken(readToken());
    setUser(readStoredUser<User>());
    me().finally(() => setLoading(false));
  }, [me]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<LoginResponse>("/auth/login", { email, password });
      setSession(data.access_token, data.user);
      return data.user;
    },
    [setSession],
  );

  const googleLogin = useCallback(
    async (payload: { email: string; full_name: string; google_account_id: string }) => {
      const data = await api.post<LoginResponse>("/auth/google", payload);
      setSession(data.access_token, data.user);
      return data.user;
    },
    [setSession],
  );

  const completeAuth0Login = useCallback(async () => {
    const idToken = await completeAuth0PkceLogin();
    const data = await api.post<LoginResponse>("/auth/auth0", { id_token: idToken });
    setSession(data.access_token, data.user);
    return data.user;
  }, [setSession]);

  const logout = useCallback(() => {
    disconnectSocket();
    setSession(null, null);
    try {
      window.location.assign(auth0LogoutUrl());
    } catch {
      window.location.assign("/");
    }
  }, [setSession]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      startAuth0Login,
      completeAuth0Login,
      googleLogin,
      logout,
      me,
      redirectForRole,
    }),
    [completeAuth0Login, googleLogin, loading, login, logout, me, redirectForRole, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
