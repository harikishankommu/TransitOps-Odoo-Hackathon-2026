/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useEffect,
  useState,
} from "react";
import { CheckCircle, X } from "lucide-react";

import type { MaintenanceLog } from "../types.js";
import { apiFetch } from "../utils/api.js";

interface CompleteMaintenanceModalProps {
  maintenance: MaintenanceLog;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface CompletionFormState {
  actual_cost: string;
  completed_date: string;
  notes: string;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Maintenance could not be completed.";
}

export const CompleteMaintenanceModal: React.FC<
  CompleteMaintenanceModalProps
> = ({
  maintenance,
  onClose,
  onSaved,
}) => {
  const [form, setForm] =
    useState<CompletionFormState>({
      actual_cost: String(
        maintenance.estimated_cost,
      ),
      completed_date: getToday(),
      notes: "",
    });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    setForm({
      actual_cost: String(
        maintenance.estimated_cost,
      ),
      completed_date: getToday(),
      notes: "",
    });
    setError("");
  }, [maintenance]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError("");

    const actualCost = Number(form.actual_cost);

    if (
      !Number.isFinite(actualCost) ||
      actualCost < 0
    ) {
      setError(
        "Actual cost must be zero or greater.",
      );
      return;
    }

    if (
      form.completed_date <
      maintenance.start_date
    ) {
      setError(
        "Completed date cannot be before the maintenance start date.",
      );
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(
        `/maintenance/${maintenance.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            actual_cost: actualCost,
            completed_date:
              form.completed_date,
            notes: form.notes.trim(),
          }),
        },
      );

      onSaved(
        "Maintenance completed. The vehicle is AVAILABLE again.",
      );
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
      aria-labelledby="complete-maintenance-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div>
              <h3
                id="complete-maintenance-title"
                className="flex items-center gap-2 text-lg font-bold text-white"
              >
                <CheckCircle
                  size={18}
                  className="text-emerald-400"
                />
                Complete Maintenance
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Closing this record creates a maintenance
                expense and releases the vehicle.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close completion form"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-6"
          >
            {error && (
              <div className="mb-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Actual Cost (Rs.)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.actual_cost}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      actual_cost:
                        event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Completed Date
                </span>
                <input
                  type="date"
                  min={maintenance.start_date}
                  value={form.completed_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      completed_date:
                        event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Completion Notes
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  maxLength={500}
                  rows={4}
                  placeholder="Work completed, replaced parts, inspection results..."
                  className="w-full resize-y rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Completing..."
                  : "Complete & Release"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
