/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API_BASE = "/api";
const TOKEN_STORAGE_KEY = "transitops_token";
const LEGACY_USER_STORAGE_KEY = "transitops_user";

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
}

function isAuthenticationEndpoint(
  endpoint: string,
): boolean {
  return (
    endpoint === "/auth/login" ||
    endpoint === "/auth/signup"
  );
}

function getErrorMessage(
  responseData: unknown,
  fallback: string,
): string {
  if (
    typeof responseData === "object" &&
    responseData !== null &&
    "error" in responseData &&
    typeof responseData.error === "string"
  ) {
    return responseData.error;
  }

  return fallback;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem(
    TOKEN_STORAGE_KEY,
  );

  const headers = new Headers(options.headers);

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      headers,
    },
  );

  if (!response.ok) {
    let responseData: unknown;

    try {
      const contentType =
        response.headers.get("content-type") ?? "";

      responseData = contentType.includes(
        "application/json",
      )
        ? await response.json()
        : await response.text();
    } catch {
      responseData = null;
    }

    if (
      response.status === 401 &&
      !isAuthenticationEndpoint(endpoint)
    ) {
      clearStoredSession();

      window.dispatchEvent(
        new Event("transitops:unauthorized"),
      );
    }

    const fallbackMessage =
      `Request failed with status ${response.status}.`;

    throw new ApiError(
      getErrorMessage(
        responseData,
        fallbackMessage,
      ),
      response.status,
      responseData,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    contentType.includes("text/csv") ||
    contentType.includes("text/plain")
  ) {
    return (await response.text()) as T;
  }

  if (
    contentType.includes("application/json")
  ) {
    return (await response.json()) as T;
  }

  return null as T;
}