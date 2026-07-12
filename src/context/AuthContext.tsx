/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useState, useEffect, useContext } from "react";
import { apiFetch } from "../utils/api.js";
import { UserRole } from "../types.js";

export interface LoggedInUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: LoggedInUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (form: any) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasAccess: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for session
    const storedToken = localStorage.getItem("transitops_token");
    const storedUser = localStorage.getItem("transitops_user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem("transitops_token");
        localStorage.removeItem("transitops_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      localStorage.setItem("transitops_token", data.token);
      localStorage.setItem("transitops_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (form: any) => {
    setLoading(true);
    try {
      const data = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify(form),
      });

      localStorage.setItem("transitops_token", data.token);
      localStorage.setItem("transitops_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Attempt backend notify, ignore if fails
    apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    
    localStorage.removeItem("transitops_token");
    localStorage.removeItem("transitops_user");
    setToken(null);
    setUser(null);
  };

  const hasAccess = (allowedRoles: UserRole[]) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
    isAuthenticated: !!token,
    hasAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
