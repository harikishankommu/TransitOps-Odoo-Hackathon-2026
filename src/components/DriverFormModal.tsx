/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { Shield, X } from "lucide-react";

import {
  type Driver,
  DriverStatus,
  UserRole,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface DriverFormModalProps {
  mode: "create" | "edit";
  driver?: Driver | null;
  currentUserRole: UserRole;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface DriverFormState {
  full_name: string;
  licence_number: string;
  licence_category: string;
  licence_expiry_date: string;
  contact_number: string;
  safety_score: string;
  region: string;
  status: DriverStatus.AVAILABLE | DriverStatus.OFF_DUTY;
  user_id: string;
}

interface LinkableDriverUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

const LICENCE_PATTERN = /^[A-Z0-9/-]{4,30}$/;
const CONTACT_PATTERN = /^[0-9+()\- ]{7,20}$/;

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function normalizeLicence(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function makeInitialForm(driver?: Driver | null): DriverFormState {
  const editableStatus =
    driver?.status === DriverStatus.OFF_DUTY
      ? DriverStatus.OFF_DUTY
      : DriverStatus.AVAILABLE;

  return {
    full_name: driver?.full_name ?? "",
    licence_number: driver?.licence_number ?? "",
    licence_category:
      driver?.licence_category ?? "Heavy Commercial",
    licence_expiry_date:
      driver?.licence_expiry_date ?? "",
    contact_number: driver?.contact_number ?? "",
    safety_score: String(driver?.safety_score ?? 100),
    region: driver?.region ?? "Patna",
    status: editableStatus,
    user_id: driver?.user_id ?? "",
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The driver profile could not be saved.";
}

function validateForm(
  form: DriverFormState,
  driver?: Driver | null,
): string | null {
  const name = form.full_name.trim();
  const licence = normalizeLicence(form.licence_number);
  const category = form.licence_category.trim();
  const contact = form.contact_number.trim();
  const region = form.region.trim();
  const score = Number(form.safety_score);

  if (name.length < 2 || name.length > 80) {
    return "Driver name must contain between 2 and 80 characters.";
  }

  if (!LICENCE_PATTERN.test(licence)) {
    return "Licence number must contain 4–30 letters, numbers, slashes, or hyphens.";
  }

  if (category.length < 2 || category.length > 60) {
    return "Licence category must contain between 2 and 60 characters.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.licence_expiry_date)) {
    return "Enter a valid licence expiry date.";
  }

  if (!CONTACT_PATTERN.test(contact)) {
    return "Contact number must contain 7–20 valid phone characters.";
  }

  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return "Safety score must be between 0 and 100.";
  }

  if (region.length < 2 || region.length > 80) {
    return "Region must contain between 2 and 80 characters.";
  }

  const workflowControlledStatus =
    driver?.status === DriverStatus.ON_TRIP ||
    driver?.status === DriverStatus.SUSPENDED;

  if (
    !workflowControlledStatus &&
    form.status === DriverStatus.AVAILABLE &&
    form.licence_expiry_date < todayDate()
  ) {
    return "An expired licence cannot be marked Available. Select Off Duty or renew the licence.";
  }

  return null;
}

export const DriverFormModal: React.FC<
  DriverFormModalProps
> = ({
  mode,
  driver,
  currentUserRole,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<DriverFormState>(() =>
    makeInitialForm(driver),
  );
  const [linkableUsers, setLinkableUsers] = useState<
    LinkableDriverUser[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = currentUserRole === UserRole.ADMIN;
  const workflowControlledStatus =
    driver?.status === DriverStatus.ON_TRIP ||
    driver?.status === DriverStatus.SUSPENDED;

  useEffect(() => {
    setForm(makeInitialForm(driver));
    setError("");
  }, [driver, mode]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const loadUsers = async (): Promise<void> => {
      setLoadingUsers(true);

      try {
        const query = new URLSearchParams();
        if (driver?.user_id) {
          query.set("include_user_id", driver.user_id);
        }

        const users = await apiFetch<LinkableDriverUser[]>(
          `/drivers/linkable-users?${query.toString()}`,
        );
        setLinkableUsers(users);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoadingUsers(false);
      }
    };

    void loadUsers();
  }, [driver?.user_id, isAdmin]);

  const title = useMemo(
    () =>
      mode === "create"
        ? "Register Driver Profile"
        : "Edit Driver Profile",
    [mode],
  );

  const updateField = <Key extends keyof DriverFormState>(
    key: Key,
    value: DriverFormState[Key],
  ): void => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError("");

    const validationError = validateForm(form, driver);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      licence_number: normalizeLicence(form.licence_number),
      licence_category: form.licence_category.trim(),
      licence_expiry_date: form.licence_expiry_date,
      contact_number: form.contact_number.trim(),
      safety_score: Number(form.safety_score),
      region: form.region.trim(),
    };

    if (!workflowControlledStatus) {
      payload.status = form.status;
    }

    if (isAdmin) {
      payload.user_id = form.user_id || null;
    }

    setSubmitting(true);

    try {
      if (mode === "edit" && driver) {
        await apiFetch(`/drivers/${driver.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        onSaved("Driver profile updated successfully.");
      } else {
        await apiFetch("/drivers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved("Driver profile registered successfully.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-form-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
            <div>
              <h3
                id="driver-form-title"
                className="flex items-center gap-2 text-lg font-bold text-white"
              >
                <Shield size={18} className="text-emerald-400" />
                {title}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                On Trip and Suspended statuses are controlled by operational workflows.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
              aria-label="Close driver form"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="max-h-[calc(100vh-8rem)] overflow-y-auto p-6"
          >
            {error && (
              <div className="mb-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Driver Full Name
                </span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                  maxLength={80}
                  placeholder="Manoj Verma"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Licence Number
                </span>
                <input
                  type="text"
                  value={form.licence_number}
                  onChange={(event) =>
                    updateField(
                      "licence_number",
                      event.target.value.toUpperCase(),
                    )
                  }
                  maxLength={30}
                  placeholder="BR01-2024-0045678"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-sm uppercase text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Licence Category
                </span>
                <input
                  type="text"
                  value={form.licence_category}
                  onChange={(event) =>
                    updateField(
                      "licence_category",
                      event.target.value,
                    )
                  }
                  maxLength={60}
                  placeholder="Heavy Commercial"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Licence Expiry Date
                </span>
                <input
                  type="date"
                  value={form.licence_expiry_date}
                  onChange={(event) =>
                    updateField(
                      "licence_expiry_date",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Contact Number
                </span>
                <input
                  type="tel"
                  value={form.contact_number}
                  onChange={(event) =>
                    updateField(
                      "contact_number",
                      event.target.value,
                    )
                  }
                  maxLength={20}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Safety Score
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={form.safety_score}
                  onChange={(event) =>
                    updateField(
                      "safety_score",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Operating Region
                </span>
                <input
                  type="text"
                  value={form.region}
                  onChange={(event) =>
                    updateField("region", event.target.value)
                  }
                  maxLength={80}
                  placeholder="Patna"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Operational Status
                </span>
                {workflowControlledStatus ? (
                  <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-400">
                    {driver?.status.replaceAll("_", " ")}
                  </div>
                ) : (
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value as
                          | DriverStatus.AVAILABLE
                          | DriverStatus.OFF_DUTY,
                      )
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  >
                    <option value={DriverStatus.AVAILABLE}>
                      Available
                    </option>
                    <option value={DriverStatus.OFF_DUTY}>
                      Off Duty
                    </option>
                  </select>
                )}
              </label>

              {isAdmin && (
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase text-slate-400">
                    Linked Driver Login Account
                  </span>
                  <select
                    value={form.user_id}
                    onChange={(event) =>
                      updateField("user_id", event.target.value)
                    }
                    disabled={loadingUsers}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 disabled:opacity-60"
                  >
                    <option value="">
                      {loadingUsers
                        ? "Loading accounts..."
                        : "No linked account"}
                    </option>
                    {linkableUsers.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.full_name} — {account.email}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Only active accounts with the Driver role can be linked, and one account can belong to only one driver profile.
                  </p>
                </label>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingUsers}
                className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Saving Profile..."
                  : mode === "create"
                    ? "Register Driver"
                    : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
