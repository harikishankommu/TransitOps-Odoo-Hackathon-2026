/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch } from "../utils/api.js";

import {
  type AuthenticatedUser,
  UserRole,
} from "../types.js";

const TOKEN_STORAGE_KEY =
  "transitops_token";

const LEGACY_USER_STORAGE_KEY =
  "transitops_user";

interface SignupForm {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

interface AuthenticationResponse {
  token: string;
  user: AuthenticatedUser;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  token: string | null;
  loading: boolean;

  login: (
    email: string,
    password: string,
  ) => Promise<void>;

  signup: (
    form: SignupForm,
  ) => Promise<void>;

  logout: () => void;

  refreshSession: () => Promise<boolean>;

  isAuthenticated: boolean;

  hasAccess: (
    roles: UserRole[],
  ) => boolean;
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined,
  );

function removeStoredSession(): void {
  localStorage.removeItem(
    TOKEN_STORAGE_KEY,
  );

  localStorage.removeItem(
    LEGACY_USER_STORAGE_KEY,
  );
}

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] =
    useState<AuthenticatedUser | null>(null);

  const [token, setToken] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const clearSession = useCallback(() => {
    removeStoredSession();
    setToken(null);
    setUser(null);
  }, []);

  const applyAuthenticationResponse =
    useCallback(
      (
        authentication:
          AuthenticationResponse,
      ) => {
        localStorage.setItem(
          TOKEN_STORAGE_KEY,
          authentication.token,
        );

        // Remove the previous insecure cached-user value.
        localStorage.removeItem(
          LEGACY_USER_STORAGE_KEY,
        );

        setToken(authentication.token);
        setUser(authentication.user);
      },
      [],
    );

  const refreshSession =
    useCallback(async (): Promise<boolean> => {
      const storedToken =
        localStorage.getItem(
          TOKEN_STORAGE_KEY,
        );

      if (!storedToken) {
        clearSession();
        return false;
      }

      try {
        const verifiedUser =
          await apiFetch<AuthenticatedUser>(
            "/auth/me",
          );

        setToken(storedToken);
        setUser(verifiedUser);

        localStorage.removeItem(
          LEGACY_USER_STORAGE_KEY,
        );

        return true;
      } catch {
        clearSession();
        return false;
      }
    }, [clearSession]);

  useEffect(() => {
    let mounted = true;

    const initializeAuthentication =
      async () => {
        try {
          await refreshSession();
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void initializeAuthentication();

    const handleUnauthorized = () => {
      clearSession();
      setLoading(false);
    };

    const handleStorageChange = (
      event: StorageEvent,
    ) => {
      if (
        event.key !== TOKEN_STORAGE_KEY
      ) {
        return;
      }

      if (!event.newValue) {
        clearSession();
        setLoading(false);
        return;
      }

      setLoading(true);

      void refreshSession().finally(() => {
        setLoading(false);
      });
    };

    window.addEventListener(
      "transitops:unauthorized",
      handleUnauthorized,
    );

    window.addEventListener(
      "storage",
      handleStorageChange,
    );

    return () => {
      mounted = false;

      window.removeEventListener(
        "transitops:unauthorized",
        handleUnauthorized,
      );

      window.removeEventListener(
        "storage",
        handleStorageChange,
      );
    };
  }, [
    clearSession,
    refreshSession,
  ]);

  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<void> => {
      setLoading(true);

      try {
        const authentication =
          await apiFetch<AuthenticationResponse>(
            "/auth/login",
            {
              method: "POST",
              body: JSON.stringify({
                email,
                password,
              }),
            },
          );

        applyAuthenticationResponse(
          authentication,
        );
      } finally {
        setLoading(false);
      }
    },
    [applyAuthenticationResponse],
  );

  const signup = useCallback(
    async (
      form: SignupForm,
    ): Promise<void> => {
      setLoading(true);

      try {
        const authentication =
          await apiFetch<AuthenticationResponse>(
            "/auth/signup",
            {
              method: "POST",
              body: JSON.stringify(form),
            },
          );

        applyAuthenticationResponse(
          authentication,
        );
      } finally {
        setLoading(false);
      }
    },
    [applyAuthenticationResponse],
  );

  const logout = useCallback(() => {
    const currentToken =
      localStorage.getItem(
        TOKEN_STORAGE_KEY,
      );

    // Clear the browser session immediately.
    clearSession();

    if (!currentToken) {
      return;
    }

    // Notify the backend using the captured token.
    void fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${currentToken}`,
      },
    }).catch(() => {
      // Local logout must still succeed
      // even if the server is unavailable.
    });
  }, [clearSession]);

  const hasAccess = useCallback(
    (
      allowedRoles: UserRole[],
    ): boolean => {
      if (!user || !user.is_active) {
        return false;
      }

      return allowedRoles.includes(
        user.role,
      );
    },
    [user],
  );

  const contextValue =
    useMemo<AuthContextType>(
      () => ({
        user,
        token,
        loading,
        login,
        signup,
        logout,
        refreshSession,

        isAuthenticated: Boolean(
          token &&
          user &&
          user.is_active,
        ),

        hasAccess,
      }),
      [
        user,
        token,
        loading,
        login,
        signup,
        logout,
        refreshSession,
        hasAccess,
      ],
    );

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider.",
    );
  }

  return context;
}