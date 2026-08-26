import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getAuthToken, setAuthToken, setUnauthorizedHandler, type AuthUser } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  function logout() {
    setAuthToken(null);
    setUser(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    if (getAuthToken()) {
      api
        .me()
        .then(setUser)
        .catch(() => setAuthToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => setUnauthorizedHandler(null);
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.login(email, password);
    setAuthToken(token);
    setUser(user);
    return user;
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
