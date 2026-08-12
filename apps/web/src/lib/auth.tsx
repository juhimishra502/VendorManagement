import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserRole } from "@vendor-management/shared";
import { apiFetch, ApiError } from "./http.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export interface CurrentUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function betterAuthPost(path: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let message = "Authentication failed";
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, message);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiFetch<CurrentUser>("/api/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await betterAuthPost("/api/auth/sign-in/email", { email, password });
      await refresh();
    },
    [refresh],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      await betterAuthPost("/api/auth/sign-up/email", { name, email, password });
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await betterAuthPost("/api/auth/sign-out", {});
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function canCreateVendor(role: UserRole | undefined): boolean {
  return role === "ADMIN" || role === "PROCUREMENT";
}
