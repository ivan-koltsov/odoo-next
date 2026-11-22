"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { OdooSessionUser } from "@/lib/odoo/types";
import { apiFetch } from "@/lib/api/client";

interface AuthContextValue {
  user: OdooSessionUser | null;
  setUser: (user: OdooSessionUser | null) => void;
  refreshSession: () => Promise<OdooSessionUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: OdooSessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<OdooSessionUser | null>(initialUser);
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch<{ authenticated: boolean; user: OdooSessionUser | null }>(
        "/api/odoo/auth/session"
      );
      setUser(data.authenticated ? data.user : null);
      return data.authenticated ? data.user : null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/odoo/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, setUser, refreshSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
