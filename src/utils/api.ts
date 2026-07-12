/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API_BASE = "/api";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("transitops_token");
  
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      errMsg = data.error || errMsg;
    } catch (e) {
      // no JSON body
    }
    throw new Error(errMsg);
  }

  // Handle CSV/text responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/csv")) {
    return response.text();
  }

  try {
    return await response.json();
  } catch (err) {
    return null;
  }
}
